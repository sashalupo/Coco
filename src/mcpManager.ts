// mcpManager.ts — lifecycle manager for MCP servers (1.99-2.S3).
//
// No `vscode` import: require-able from the smoke test via `out/mcpManager.js`.
// Owns one `McpClient` per configured server, dedupes concurrent starts,
// exposes OpenAI-shaped tools for running servers, and executes
// `mcp__server__tool` calls. `execute` never throws — every failure is
// returned as `{ content: "Error: ..." }` (same shape the chat loop consumes
// from `ToolExecutor.execute` results).

import * as fs from "fs";
import {
  McpClient,
  McpHttpClient,
  McpProgressCallback,
  McpPrompt,
  McpPromptResult,
  McpResource,
  McpResourceReadResult,
  McpResourceTemplate,
  McpSamplingLogEntry,
  McpSamplingParams,
  McpSamplingResult,
  McpServerConfig,
  McpTool,
  McpToolAnnotations,
  McpToolResult,
  mcpDebugArgs,
  mcpPromptToText,
  mcpResourceReadToText,
  mcpResultToImages,
  mcpResultToText,
  mcpToolsToOpenAITools,
  mcpWatchTarget,
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
  setSamplingHandler(
    cb:
      | ((server: string, params: McpSamplingParams) => Promise<McpSamplingResult>)
      | undefined,
  ): void;
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
  /**
   * Per-server sampling allow/deny map (1.101-4). Absent/`undefined` =
   * allow; only an explicit `false` denies.
   */
  private samplingAllowed = new Map<string, boolean>();
  /** In-memory sampling request log, capped at 100 (oldest dropped). */
  private samplingLog: McpSamplingLogEntry[] = [];
  /** Host-provided sampling callback (confirmation + model round-trip). */
  private samplingCb:
    | ((server: string, params: McpSamplingParams) => Promise<McpSamplingResult>)
    | undefined;
  /**
   * Per-server `dev.watch` watchers (1.101-5). One directory-level
   * `fs.watch` per stdio server with a `dev.watch` glob; a matching change
   * (500 ms debounce) triggers `refresh(name)`.
   */
  private devWatchers = new Map<
    string,
    { watcher: fs.FSWatcher; timer: NodeJS.Timeout | undefined }
  >();
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
    // Stop the `dev.watch` watcher for every removed server (1.101-5).
    // Iterated independently of the client map: a watch-triggered `refresh`
    // may have already closed + deleted the client before this runs, so a
    // client-based loop would miss the watcher.
    for (const name of [...this.devWatchers.keys()]) {
      if (!(name in servers)) {
        this.stopDevWatch(name);
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
        if (cfg.url) {
          client = new McpHttpClient(cfg);
        } else {
          // `dev.debug` (1.101-5): rewrite the spawn args for the debugger
          // (node → `--inspect`, python → `-m debugpy --listen 5678`) via a
          // shallow-copied config — `McpClient` itself is untouched.
          const spawnArgs = cfg.dev?.debug
            ? mcpDebugArgs(cfg.command ?? "", cfg.args ?? [], true)
            : cfg.args;
          client = new McpClient({ ...cfg, args: spawnArgs }, this.inputs.get(name));
        }
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
        this.wireSamplingHandler(name, client);
        this.statuses.set(name, {
          name,
          status: "running",
          toolCount: client.tools.length,
        });
        this.notify(`MCP server '${name}' started (${client.tools.length} tools)`);
        // `dev.watch` (1.101-5): stdio-only — start a directory-level
        // watcher that restarts the server on a matching file change.
        // `refresh` refuses to restart removed servers, so a removed server
        // never reaches this point.
        if (!cfg.url && typeof cfg.dev?.watch === "string" && cfg.dev.watch.length > 0) {
          this.startDevWatch(name, cfg.dev.watch);
        }
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
    // A watch-triggered refresh may resolve after the server was removed via
    // `setServers` — never restart (or re-watch) a server that no longer
    // exists in the config.
    if (!(name in this.servers)) {
      this.statuses.delete(name);
      return this.statusFor(name);
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

  /**
   * Set the per-server sampling allow/deny flag. `undefined` clears the
   * entry (back to the default: allow). Only an explicit `false` denies.
   */
  setSamplingAllowed(name: string, allowed: boolean | undefined): void {
    if (allowed === undefined) {
      this.samplingAllowed.delete(name);
      return;
    }
    this.samplingAllowed.set(name, allowed);
  }

  /** Whether a server may sample the model (default `true`). */
  isSamplingAllowed(name: string): boolean {
    return this.samplingAllowed.get(name) !== false;
  }

  /**
   * Register (or clear) the host sampling callback and (re)wire the
   * per-client handler on every currently running client. Clients started
   * later are wired by `ensureStarted`.
   */
  setSamplingHandler(
    cb:
      | ((server: string, params: McpSamplingParams) => Promise<McpSamplingResult>)
      | undefined,
  ): void {
    this.samplingCb = cb;
    for (const [name, client] of this.clients) {
      if (this.statuses.get(name)?.status === "running") {
        this.wireSamplingHandler(name, client);
      }
    }
  }

  /**
   * Copy of the in-memory sampling request log (newest last). Pass a
   * server name to filter to that server.
   */
  getSamplingLog(server?: string): McpSamplingLogEntry[] {
    const entries = server
      ? this.samplingLog.filter((e) => e.server === server)
      : this.samplingLog;
    return [...entries];
  }

  /**
   * Install the manager's sampling handler on one client. The closure
   * enforces the allow/deny policy, records every request (allowed or
   * denied) in the log, and delegates to the host callback when allowed.
   */
  private wireSamplingHandler(name: string, client: McpClientLike): void {
    // The clients pass `""` as the server name to the callback (they don't
    // know their own configured name) — the closure-captured `name` is the
    // authoritative server identity for policy + logging.
    client.setSamplingHandler(async (_server, params) => {
      const messageCount = Array.isArray(params.messages)
        ? params.messages.length
        : 0;
      if (!this.isSamplingAllowed(name)) {
        this.pushSamplingLog({
          server: name,
          model: params.model,
          maxTokens: params.maxTokens,
          messageCount,
          allowed: false,
          ok: false,
          error: `sampling denied for server '${name}'`,
          at: Date.now(),
        });
        throw new Error(`sampling denied for server '${name}'`);
      }
      if (!this.samplingCb) {
        this.pushSamplingLog({
          server: name,
          model: params.model,
          maxTokens: params.maxTokens,
          messageCount,
          allowed: true,
          ok: false,
          error: "sampling not configured",
          at: Date.now(),
        });
        throw new Error("sampling not configured");
      }
      try {
        const result = await this.samplingCb(name, params);
        this.pushSamplingLog({
          server: name,
          model: params.model,
          maxTokens: params.maxTokens,
          messageCount,
          allowed: true,
          ok: true,
          at: Date.now(),
        });
        return result;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        this.pushSamplingLog({
          server: name,
          model: params.model,
          maxTokens: params.maxTokens,
          messageCount,
          allowed: true,
          ok: false,
          error: message,
          at: Date.now(),
        });
        throw e;
      }
    });
  }

  /** Append a sampling log entry, dropping the oldest past 100. */
  private pushSamplingLog(entry: McpSamplingLogEntry): void {
    this.samplingLog.push(entry);
    if (this.samplingLog.length > 100) {
      this.samplingLog.splice(0, this.samplingLog.length - 100);
    }
  }

  /**
   * Start a `dev.watch` watcher for a stdio server (1.101-5). Resolves the
   * glob to a directory via `mcpWatchTarget`, `fs.watch`es it
   * (`persistent: false`), and on each event (500 ms debounce, `unref`'d)
   * restarts the server when the changed path matches the glob. Failures
   * (bad glob, missing dir) are surfaced via `notify` and swallowed — a
   * broken watch never breaks the server itself. Idempotent: an existing
   * watcher for the server is stopped first.
   */
  private startDevWatch(name: string, glob: string): void {
    this.stopDevWatch(name);
    let target: { dir: string; match: RegExp };
    try {
      target = mcpWatchTarget(glob);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.notify(`MCP server '${name}' dev.watch: ${message}`);
      return;
    }
    let watcher: fs.FSWatcher;
    try {
      watcher = fs.watch(target.dir, { persistent: false });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.notify(`MCP server '${name}' dev.watch: cannot watch '${target.dir}': ${message}`);
      return;
    }
    let timer: NodeJS.Timeout | undefined;
    watcher.on("change", (_eventType, filename) => {
      // Debounce: coalesce bursts of events into one restart. The timer is
      // `unref`'d so a pending debounce never keeps the process alive.
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = undefined;
        const entry = this.devWatchers.get(name);
        if (!entry) {
          return; // stopped while the debounce was pending
        }
        const changed = typeof filename === "string" ? filename : "";
        if (changed.length > 0 && target.match.test(changed)) {
          void this.refresh(name);
        }
      }, 500);
      timer.unref?.();
    });
    watcher.on("error", (err) => {
      this.notify(`MCP server '${name}' dev.watch error: ${err.message}`);
      this.stopDevWatch(name);
    });
    this.devWatchers.set(name, { watcher, timer });
  }

  /**
   * Stop and drop the `dev.watch` watcher for a server (1.101-5).
   * Idempotent: safe to call when no watcher is active.
   */
  private stopDevWatch(name: string): void {
    const entry = this.devWatchers.get(name);
    if (!entry) {
      return;
    }
    if (entry.timer) {
      clearTimeout(entry.timer);
    }
    try {
      entry.watcher.close();
    } catch {
      // already closed — nothing to do
    }
    this.devWatchers.delete(name);
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
    this.samplingAllowed.clear();
    this.samplingLog = [];
    this.samplingCb = undefined;
    for (const name of [...this.devWatchers.keys()]) {
      this.stopDevWatch(name);
    }
  }

  private statusFor(name: string): McpServerStatus {
    const existing = this.statuses.get(name);
    if (existing) {
      return existing;
    }
    return { name, status: "stopped", toolCount: 0 };
  }
}
