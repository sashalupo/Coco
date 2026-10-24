// mcpManager.ts — lifecycle manager for MCP servers (1.99-2.S3).
//
// No `vscode` import: require-able from the smoke test via `out/mcpManager.js`.
// Owns one `McpClient` per configured server, dedupes concurrent starts,
// exposes OpenAI-shaped tools for running servers, and executes
// `mcp__server__tool` calls. `execute` never throws — every failure is
// returned as `{ content: "Error: ..." }` (same shape the chat loop consumes
// from `ToolExecutor.execute` results).

import {
  McpClient,
  McpHttpClient,
  McpProgressCallback,
  McpPrompt,
  McpPromptResult,
  McpResource,
  McpResourceReadResult,
  McpResourceTemplate,
  McpServerConfig,
  McpTool,
  McpToolAnnotations,
  McpToolResult,
  mcpPromptToText,
  mcpResourceReadToText,
  mcpResultToImages,
  mcpResultToText,
  mcpToolsToOpenAITools,
  parseMcpToolName,
} from "./mcp";
import type { Tool } from "./tools";

/**
 * Transport-agnostic MCP client surface. Both `McpClient` (stdio) and
 * `McpHttpClient` (Streamable HTTP / SSE) satisfy it structurally.
 */
export interface McpClientLike {
  tools: McpTool[];
  prompts: McpPrompt[];
  resources: McpResource[];
  resourceTemplates: McpResourceTemplate[];
  start(): Promise<void>;
  callTool(
    name: string,
    args: Record<string, unknown>,
    onProgress?: McpProgressCallback,
  ): Promise<McpToolResult>;
  getPrompt(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<McpPromptResult>;
  readResource(uri: string): Promise<McpResourceReadResult>;
  close(): void;
}

/** Per-server status surfaced to the UI / status bar. */
export interface McpServerStatus {
  name: string;
  status: "stopped" | "running" | "error";
  toolCount: number;
  error?: string;
}

/**
 * Manages the lifecycle of all configured MCP servers.
 *
 * `setServers` is expected to be called each turn with the freshly parsed
 * `llm.mcpServers` setting so edits take effect; servers that disappear are
 * closed and dropped.
 */
export class McpManager {
  private servers: Record<string, McpServerConfig> = {};
  private clients = new Map<string, McpClientLike>();
  private statuses = new Map<string, McpServerStatus>();
  private starting = new Map<string, Promise<McpClientLike>>();
  /**
   * Session-only `${input:...}` values per server (1.100-16). In-memory by
   * design — no SecretStorage; values must be re-entered after a reload.
   */
  private inputs = new Map<string, Record<string, string>>();
  private notify: (msg: string) => void;

  constructor(notify?: (msg: string) => void) {
    this.notify = notify ?? (() => undefined);
  }

  /**
   * Replace the configured server map. Servers no longer present get their
   * client closed and their client/status entries dropped.
   */
  setServers(servers: Record<string, McpServerConfig>): void {
    this.servers = servers;
    for (const name of [...this.clients.keys()]) {
      if (!(name in servers)) {
        this.clients.get(name)?.close();
        this.clients.delete(name);
        this.statuses.delete(name);
      }
    }
    for (const name of [...this.inputs.keys()]) {
      if (!(name in servers)) {
        this.inputs.delete(name);
      }
    }
  }

  /**
   * Store session-only `${input:...}` values for a server. An empty object
   * clears the entry. Values are held in memory only (no persistence).
   */
  setInputs(name: string, values: Record<string, string>): void {
    if (Object.keys(values).length === 0) {
      this.inputs.delete(name);
      return;
    }
    this.inputs.set(name, values);
  }

  /**
   * Return a live client for `name`, starting it if needed. Concurrent calls
   * for the same server share one in-flight start. Rejects (after closing
   * the client and recording an `error` status) if the start fails.
   */
  ensureStarted(name: string): Promise<McpClientLike> {
    const existing = this.clients.get(name);
    if (existing && this.statuses.get(name)?.status === "running") {
      return Promise.resolve(existing);
    }
    const inFlight = this.starting.get(name);
    if (inFlight) {
      return inFlight;
    }
    const cfg = this.servers[name];
    if (!cfg) {
      return Promise.reject(new Error(`unknown MCP server: ${name}`));
    }
    const p = (async () => {
      let client: McpClientLike;
      try {
        // `McpClient` resolves `${input:...}` env refs at construction
        // (throws `missing required input: <name>` when one is absent);
        // the HTTP transport ignores inputs entirely.
        client = cfg.url
          ? new McpHttpClient(cfg)
          : new McpClient(cfg, this.inputs.get(name));
      } catch (e) {
        // No client exists yet — surface via the existing error path.
        const message = e instanceof Error ? e.message : String(e);
        this.statuses.set(name, {
          name,
          status: "error",
          toolCount: 0,
          error: message,
        });
        this.notify(`MCP server '${name}' failed to start: ${message}`);
        this.starting.delete(name);
        throw e;
      }
      try {
        await client.start();
        this.clients.set(name, client);
        this.statuses.set(name, {
          name,
          status: "running",
          toolCount: client.tools.length,
        });
        this.notify(`MCP server '${name}' started (${client.tools.length} tools)`);
        return client;
      } catch (e) {
        client.close();
        const message = e instanceof Error ? e.message : String(e);
        this.statuses.set(name, {
          name,
          status: "error",
          toolCount: 0,
          error: message,
        });
        this.notify(`MCP server '${name}' failed to start: ${message}`);
        throw e;
      } finally {
        this.starting.delete(name);
      }
    })();
    this.starting.set(name, p);
    // If the constructor threw synchronously, the catch block's
    // `starting.delete(name)` ran before the set above (a no-op), leaving
    // the rejected promise cached forever. This microtask runs after the
    // set, so the delete actually removes the entry. Idempotent with the
    // in-catch/finally deletes on the async failure path.
    p.catch(() => this.starting.delete(name));
    return p;
  }

  /**
   * Pure status read: one entry per configured server (default `stopped`,
   * toolCount 0). Does not spawn anything.
   */
  listServers(): McpServerStatus[] {
    return Object.keys(this.servers).map((name) => this.statusFor(name));
  }

  /**
   * Restart a server (close the running client first) and return its
   * resulting status. Never rejects — failures yield the `error` status.
   */
  async refresh(name: string): Promise<McpServerStatus> {
    const client = this.clients.get(name);
    if (client && this.statuses.get(name)?.status === "running") {
      client.close();
      this.clients.delete(name);
    }
    try {
      await this.ensureStarted(name);
    } catch {
      // status already recorded by ensureStarted
    }
    return this.statusFor(name);
  }

  /**
   * OpenAI function-calling tools for every running server. Only
   * successfully started servers contribute.
   */
  getTools(): Tool[] {
    const tools: Tool[] = [];
    for (const [name, client] of this.clients) {
      if (this.statuses.get(name)?.status === "running") {
        tools.push(...mcpToolsToOpenAITools(name, client.tools));
      }
    }
    return tools;
  }

  /**
   * Read-only accessor: the tools of a single server's live client (empty
   * array if the server is not running).
   */
  getServerTools(name: string): McpTool[] {
    const client = this.clients.get(name);
    if (client && this.statuses.get(name)?.status === "running") {
      return client.tools;
    }
    return [];
  }

  /**
   * Read-only accessor: the prompts of a single server's live client (empty
   * array if the server is not running). Mirrors `getServerTools`.
   */
  getServerPrompts(name: string): McpPrompt[] {
    const client = this.clients.get(name);
    if (client && this.statuses.get(name)?.status === "running") {
      return client.prompts;
    }
    return [];
  }

  /**
   * Read-only accessor: the resources of a single server's live client (empty
   * array if the server is not running). Mirrors `getServerPrompts`.
   */
  getServerResources(name: string): McpResource[] {
    const client = this.clients.get(name);
    if (client && this.statuses.get(name)?.status === "running") {
      return client.resources;
    }
    return [];
  }

  /**
   * Read-only accessor: the resource templates of a single server's live
   * client (empty array if the server is not running). Mirrors
   * `getServerResources`.
   */
  getServerResourceTemplates(name: string): McpResourceTemplate[] {
    const client = this.clients.get(name);
    if (client && this.statuses.get(name)?.status === "running") {
      return client.resourceTemplates;
    }
    return [];
  }

  /**
   * Resolve an MCP prompt to text. Never throws: every failure path
   * (unknown server, start failure, prompt not found, JSON-RPC error)
   * resolves with `{ content: "Error: ..." }` (same convention as
   * `execute`). `variableText` is mapped to the first declared argument of
   * the matched prompt; when the prompt declares no arguments or
   * `variableText` is empty, no arguments are passed.
   */
  async getPrompt(
    server: string,
    prompt: string,
    variableText?: string,
  ): Promise<{ content: string }> {
    try {
      if (!(server in this.servers)) {
        return { content: `Error: unknown MCP server: ${server}` };
      }
      let client: McpClientLike;
      try {
        client = await this.ensureStarted(server);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return {
          content: `Error: MCP server '${server}' failed to start: ${message}`,
        };
      }
      const found = client.prompts.find((p) => p.name === prompt);
      if (!found) {
        return { content: `Error: unknown MCP prompt: ${prompt}` };
      }
      const firstArg = found.arguments?.[0];
      const args =
        firstArg && variableText ? { [firstArg.name]: variableText } : undefined;
      const result = await client.getPrompt(prompt, args);
      return { content: mcpPromptToText(result) };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { content: `Error: MCP prompt resolution failed: ${message}` };
    }
  }

  /**
   * Read an MCP resource by URI. Never throws: every failure path
   * (unknown server, start failure, JSON-RPC error) resolves with
   * `{ content: "Error: ..." }` (same convention as `getPrompt`).
   * Maps the result via `mcpResourceReadToText`.
   */
  async readResource(
    server: string,
    uri: string,
  ): Promise<{ content: string }> {
    try {
      if (!(server in this.servers)) {
        return { content: `Error: unknown MCP server: ${server}` };
      }
      let client: McpClientLike;
      try {
        client = await this.ensureStarted(server);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return {
          content: `Error: MCP server '${server}' failed to start: ${message}`,
        };
      }
      const result = await client.readResource(uri);
      const text = mcpResourceReadToText(result);
      if (text === "") {
        return {
          content: `Error: MCP resource has no text content: ${uri}`,
        };
      }
      return { content: text };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { content: `Error: MCP resource read failed: ${message}` };
    }
  }

  /**
   * Annotations for a single MCP tool, looked up by its OpenAI-shaped name
   * (`mcp__server__tool`). Returns null when the name is not MCP-shaped,
   * the server is unknown/not running, the tool is not found, or the tool
   * carries no annotations.
   */
  getToolAnnotations(openaiName: string): McpToolAnnotations | null {
    const parsed = parseMcpToolName(openaiName);
    if (!parsed) {
      return null;
    }
    const { server, tool } = parsed;
    const tools = this.getServerTools(server);
    const found = tools.find((t) => t.name === tool);
    return found?.annotations ?? null;
  }

  /**
   * Execute an `mcp__server__tool` call. Never throws: every failure path
   * resolves with `{ content: "Error: ..." }` (same shape the chat loop
   * consumes from `ToolExecutor.execute` results). Successful results may
   * additionally carry `images` (data-URLs from image content blocks).
   */
  async execute(
    name: string,
    args: Record<string, unknown>,
    onProgress?: McpProgressCallback,
  ): Promise<{ content: string; images?: string[] }> {
    try {
      const parsed = parseMcpToolName(name);
      if (!parsed) {
        return { content: `Error: not an MCP tool name: ${name}` };
      }
      const { server, tool } = parsed;
      if (!(server in this.servers)) {
        return { content: `Error: unknown MCP server: ${server}` };
      }
      let client: McpClientLike;
      try {
        client = await this.ensureStarted(server);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return {
          content: `Error: MCP server '${server}' failed to start: ${message}`,
        };
      }
      const result = await client.callTool(tool, args, onProgress);
      const images = mcpResultToImages(result);
      return {
        content: mcpResultToText(result),
        ...(images.length ? { images } : {}),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { content: `Error: MCP tool execution failed: ${message}` };
    }
  }

  /** Close all clients and clear all state. Idempotent. */
  dispose(): void {
    for (const client of this.clients.values()) {
      client.close();
    }
    this.clients.clear();
    this.statuses.clear();
    this.starting.clear();
    this.servers = {};
  }

  private statusFor(name: string): McpServerStatus {
    const existing = this.statuses.get(name);
    if (existing) {
      return existing;
    }
    return { name, status: "stopped", toolCount: 0 };
  }
}
