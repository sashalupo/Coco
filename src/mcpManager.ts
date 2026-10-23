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
  McpServerConfig,
  McpTool,
  McpToolResult,
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
  start(): Promise<void>;
  callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult>;
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
      const client: McpClientLike = cfg.url
        ? new McpHttpClient(cfg)
        : new McpClient(cfg);
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
   * Execute an `mcp__server__tool` call. Never throws: every failure path
   * resolves with `{ content: "Error: ..." }` (same shape the chat loop
   * consumes from `ToolExecutor.execute` results). Successful results may
   * additionally carry `images` (data-URLs from image content blocks).
   */
  async execute(
    name: string,
    args: Record<string, unknown>,
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
      const result = await client.callTool(tool, args);
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
