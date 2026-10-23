// mcp.ts — pure MCP (Model Context Protocol) client primitives.
//
// No `vscode` import: this module is unit-testable from the smoke test via
// `out/mcp.js`. It provides:
//   - settings parsing for `llm.mcpServers` (command/args/env per server),
//   - `McpJsonRpc`: newline-delimited JSON-RPC 2.0 over injected streams,
//   - `McpClient`: thin child_process.spawn wrapper (initialize handshake,
//     tools/list, tools/call),
//   - pure name mappers between MCP tools and OpenAI function-calling tools.

import { spawn, ChildProcess } from "child_process";
import type { Tool } from "./tools";

/**
 * A single MCP server entry. Exactly one transport is configured:
 * `command` (stdio) or `url` (Streamable HTTP / SSE). `args`/`env` only
 * apply to the stdio transport.
 */
export interface McpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

/** A tool discovered from an MCP server via `tools/list`. */
export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

/** The result of an MCP `tools/call`. */
export interface McpToolResult {
  content?: {
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }[];
  isError?: boolean;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Parse the raw `llm.mcpServers` setting into validated server configs.
 * Pure validation: non-object input → `{}`; entries must have exactly one
 * of a non-empty string `command` (stdio) or `url` (Streamable HTTP) —
 * entries with neither or with both are dropped; `args`/`env` are coerced
 * only when they have the right shape, otherwise left undefined.
 */
export function parseMcpServers(
  raw: unknown,
): Record<string, McpServerConfig> {
  if (!isPlainObject(raw)) {
    return {};
  }
  const out: Record<string, McpServerConfig> = {};
  for (const [name, entry] of Object.entries(raw)) {
    if (!isPlainObject(entry)) {
      continue;
    }
    const command = entry.command;
    const url = entry.url;
    const hasCommand = typeof command === "string" && command.length > 0;
    const hasUrl = typeof url === "string" && url.length > 0;
    if (hasCommand === hasUrl) {
      // Neither transport, or both: drop the entry.
      continue;
    }
    const cfg: McpServerConfig = hasUrl
      ? { url: url as string }
      : { command: command as string };
    if (
      Array.isArray(entry.args) &&
      entry.args.every((a) => typeof a === "string")
    ) {
      cfg.args = entry.args as string[];
    }
    if (isPlainObject(entry.env)) {
      const env: Record<string, string> = {};
      let ok = true;
      for (const [k, v] of Object.entries(entry.env)) {
        if (typeof v !== "string") {
          ok = false;
          break;
        }
        env[k] = v;
      }
      if (ok) {
        cfg.env = env;
      }
    }
    out[name] = cfg;
  }
  return out;
}

/**
 * Pure SSE parser for Streamable HTTP responses: keep lines starting with
 * `data:`, strip the prefix, `JSON.parse` each payload (skip malformed),
 * and return the parsed JSON-RPC messages in order.
 */
export function parseSseMessages(text: string): unknown[] {
  const out: unknown[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) {
      continue;
    }
    const payload = line.slice("data:".length).trim();
    if (payload === "") {
      continue;
    }
    try {
      out.push(JSON.parse(payload));
    } catch {
      // skip malformed payloads
    }
  }
  return out;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

/**
 * Newline-delimited JSON-RPC 2.0 over injected streams. No child_process
 * here — the caller wires up the streams (e.g. a spawned child's
 * stdin/stdout, or PassThrough pairs in tests).
 */
export class McpJsonRpc {
  private input: NodeJS.ReadableStream;
  private output: NodeJS.WritableStream;
  private buffer = "";
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private onData: (chunk: any) => void;
  private closed = false;

  constructor(input: NodeJS.ReadableStream, output: NodeJS.WritableStream) {
    this.input = input;
    this.output = output;
    this.onData = (chunk: any) => {
      this.buffer +=
        typeof chunk === "string" ? chunk : String(chunk.toString());
      let idx: number;
      while ((idx = this.buffer.indexOf("\n")) !== -1) {
        const line = this.buffer.slice(0, idx);
        this.buffer = this.buffer.slice(idx + 1);
        if (line.trim() === "") {
          continue;
        }
        this.handleLine(line);
      }
    };
    this.input.on("data", this.onData);
  }

  private handleLine(line: string): void {
    let msg: any;
    try {
      msg = JSON.parse(line);
    } catch {
      return; // ignore malformed lines
    }
    if (msg === null || typeof msg !== "object") {
      return;
    }
    // Only settle pending requests; ignore notifications and unknown ids.
    if (typeof msg.id !== "number" || !this.pending.has(msg.id)) {
      return;
    }
    const entry = this.pending.get(msg.id)!;
    this.pending.delete(msg.id);
    if (msg.error !== undefined) {
      const message =
        typeof msg.error === "object" && msg.error !== null &&
        typeof msg.error.message === "string"
          ? msg.error.message
          : JSON.stringify(msg.error);
      entry.reject(new Error(`JSON-RPC error: ${message}`));
    } else {
      entry.resolve(msg.result);
    }
  }

  /** Send a request and resolve with the matching response's `result`. */
  request(method: string, params?: unknown): Promise<unknown> {
    if (this.closed) {
      return Promise.reject(new Error("McpJsonRpc is closed"));
    }
    const id = this.nextId++;
    const msg: Record<string, unknown> = { jsonrpc: "2.0", id, method };
    if (params !== undefined) {
      msg.params = params;
    }
    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.output.write(JSON.stringify(msg) + "\n");
    });
  }

  /** Send a notification (no id, no response expected). */
  notify(method: string, params?: unknown): void {
    if (this.closed) {
      return;
    }
    const msg: Record<string, unknown> = { jsonrpc: "2.0", method };
    if (params !== undefined) {
      msg.params = params;
    }
    this.output.write(JSON.stringify(msg) + "\n");
  }

  /** Reject all pending requests and stop reading input. */
  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    const err = new Error("McpJsonRpc closed");
    for (const [id, entry] of this.pending) {
      entry.reject(err);
      this.pending.delete(id);
    }
    try {
      this.input.removeListener("data", this.onData);
    } catch {
      // ignore
    }
  }
}

/**
 * Thin spawn wrapper around an MCP stdio server: performs the
 * initialize handshake, discovers tools, and exposes `callTool`.
 */
export class McpClient {
  private child: ChildProcess;
  private rpc: McpJsonRpc;
  private stderrTail = "";
  private closed = false;
  /** Tools discovered during the `tools/list` handshake. */
  public tools: McpTool[] = [];

  constructor(config: McpServerConfig) {
    if (!config.command) {
      throw new Error("McpClient requires a stdio `command` config");
    }
    this.child = spawn(config.command, config.args ?? [], {
      env: { ...process.env, ...(config.env ?? {}) },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout = this.child.stdout;
    const stdin = this.child.stdin;
    const stderr = this.child.stderr;
    if (!stdout || !stdin || !stderr) {
      throw new Error("MCP child process stdio pipes unavailable");
    }
    this.rpc = new McpJsonRpc(stdout, stdin);
    stderr.on("data", (chunk: Buffer) => {
      this.stderrTail += chunk.toString();
      if (this.stderrTail.length > 4096) {
        this.stderrTail = this.stderrTail.slice(-4096);
      }
    });
    this.child.on("exit", () => {
      // Unexpected exit: reject everything still pending.
      this.rpc.close();
    });
  }

  /**
   * Handshake: initialize → notifications/initialized → tools/list.
   * Rejects (after closing) if the handshake does not complete within 10 s.
   */
  async start(): Promise<void> {
    const timeout = new Promise<never>((_, reject) => {
      const t = setTimeout(() => {
        reject(
          new Error(
            `MCP server handshake timed out after 10s` +
              (this.stderrTail ? ` (stderr: ${this.stderrTail})` : ""),
          ),
        );
      }, 10_000);
      t.unref?.();
    });
    try {
      await Promise.race([
        (async () => {
          await this.rpc.request("initialize", {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "llm-vscode", version: "1.0.0" },
          });
          this.rpc.notify("notifications/initialized");
          const result = (await this.rpc.request("tools/list", {})) as {
            tools?: McpTool[];
          } | null;
          this.tools = Array.isArray(result?.tools) ? result!.tools : [];
        })(),
        timeout,
      ]);
    } catch (e) {
      this.close();
      throw e;
    }
  }

  /** Call a discovered tool by name. */
  callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<McpToolResult> {
    return this.rpc
      .request("tools/call", { name, arguments: args })
      .then((r) => r as McpToolResult);
  }

  /** Close the RPC channel and kill the child. Idempotent. */
  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.rpc.close();
    try {
      this.child.kill();
    } catch {
      // ignore
    }
  }
}

/**
 * Thin fetch wrapper around an MCP Streamable HTTP server: performs the
 * initialize handshake, discovers tools, and exposes `callTool`. Each
 * request is a POST of a JSON-RPC 2.0 message; the response is either a
 * single JSON body or an SSE stream (each `data:` line a JSON-RPC
 * message). The `Mcp-Session-Id` response header (if present) is echoed
 * on every subsequent request.
 */
export class McpHttpClient {
  private url: string;
  private sessionId: string | null = null;
  private nextId = 1;
  private closed = false;
  /** Tools discovered during the `tools/list` handshake. */
  public tools: McpTool[] = [];

  constructor(config: McpServerConfig) {
    if (!config.url) {
      throw new Error("McpHttpClient requires a `url` config");
    }
    this.url = config.url;
  }

  /**
   * Handshake: initialize → notifications/initialized → tools/list.
   * Rejects (after closing) if the handshake does not complete within 10 s.
   */
  async start(): Promise<void> {
    const timeout = new Promise<never>((_, reject) => {
      const t = setTimeout(() => {
        reject(new Error("MCP server handshake timed out after 10s"));
      }, 10_000);
      t.unref?.();
    });
    try {
      await Promise.race([
        (async () => {
          await this.post("initialize", {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "llm-vscode", version: "1.0.0" },
          });
          await this.post("notifications/initialized");
          const result = (await this.post("tools/list", {})) as {
            tools?: McpTool[];
          } | null;
          this.tools = Array.isArray(result?.tools) ? result!.tools : [];
        })(),
        timeout,
      ]);
    } catch (e) {
      this.close();
      throw e;
    }
  }

  /** Call a discovered tool by name. */
  callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<McpToolResult> {
    return this.post("tools/call", { name, arguments: args }).then(
      (r) => r as McpToolResult,
    );
  }

  /**
   * POST a JSON-RPC message and resolve with the matching response's
   * `result`. Notifications (no `params` and no id) expect a 202 and
   * resolve with `undefined`.
   */
  private async post(
    method: string,
    params?: unknown,
  ): Promise<unknown> {
    if (this.closed) {
      throw new Error("McpHttpClient is closed");
    }
    const isNotification = method.startsWith("notifications/");
    const msg: Record<string, unknown> = { jsonrpc: "2.0", method };
    if (!isNotification) {
      msg.id = this.nextId++;
    }
    if (params !== undefined) {
      msg.params = params;
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (this.sessionId) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }
    const res = await fetch(this.url, {
      method: "POST",
      headers,
      body: JSON.stringify(msg),
    });
    const body = await res.text();
    const sessionHeader = res.headers.get("mcp-session-id");
    if (sessionHeader) {
      this.sessionId = sessionHeader;
    }
    if (isNotification) {
      if (res.status !== 202) {
        throw new Error(
          `MCP HTTP notification failed: ${res.status} ${body.slice(-512)}`,
        );
      }
      return undefined;
    }
    if (!res.ok) {
      throw new Error(
        `MCP HTTP request failed: ${res.status} ${body.slice(-512)}`,
      );
    }
    const contentType = res.headers.get("content-type") ?? "";
    let response: any;
    if (contentType.includes("text/event-stream")) {
      const messages = parseSseMessages(body);
      response = messages.find(
        (m) => isPlainObject(m) && m.id === msg.id,
      );
    } else {
      try {
        response = JSON.parse(body);
      } catch {
        throw new Error(
          `MCP HTTP response is not valid JSON: ${body.slice(-512)}`,
        );
      }
    }
    if (!isPlainObject(response)) {
      throw new Error(
        `MCP HTTP response has no matching message: ${body.slice(-512)}`,
      );
    }
    if (response.error !== undefined) {
      const errObj = response.error as Record<string, unknown>;
      const message =
        typeof errObj === "object" &&
        errObj !== null &&
        typeof errObj.message === "string"
          ? errObj.message
          : JSON.stringify(response.error);
      throw new Error(`JSON-RPC error: ${message}`);
    }
    return response.result;
  }

  /** Mark the client closed; further requests reject. Idempotent. */
  close(): void {
    this.closed = true;
  }
}

/** Map an MCP server+tool to its OpenAI function name. */
export function mcpToolName(server: string, tool: string): string {
  return `mcp__${server}__${tool}`;
}

/**
 * Parse an `mcp__server__tool` name back into its parts. Returns null if
 * the name is not MCP-shaped or either part is empty. (Server/tool names
 * containing `__` are unsupported.)
 */
export function parseMcpToolName(
  name: string,
): { server: string; tool: string } | null {
  if (!name.startsWith("mcp__")) {
    return null;
  }
  const rest = name.slice("mcp__".length);
  const firstSep = rest.indexOf("__");
  const lastSep = rest.lastIndexOf("__");
  if (firstSep === -1 || lastSep === -1) {
    return null;
  }
  const server = rest.slice(0, firstSep);
  const tool = rest.slice(lastSep + 2);
  if (server === "" || tool === "") {
    return null;
  }
  return { server, tool };
}

/** True if the name looks like an MCP-mapped tool name. */
export function isMcpToolName(name: string): boolean {
  return name.startsWith("mcp__");
}

/**
 * Map discovered MCP tools to OpenAI function-calling tool schemas,
 * namespaced by server. `parameters.type` is forced to `"object"` even
 * when the tool has no `inputSchema`.
 */
export function mcpToolsToOpenAITools(
  server: string,
  tools: McpTool[],
): Tool[] {
  return tools.map((t) => {
    const props = (t.inputSchema?.properties as Record<string, unknown>) ?? {};
    const required = t.inputSchema?.required as string[] | undefined;
    return {
      type: "function",
      function: {
        name: mcpToolName(server, t.name),
        description: t.description ?? "",
        parameters: {
          type: "object",
          properties: props,
          ...(required ? { required } : {}),
        },
      },
    } as Tool;
  });
}

/**
 * Flatten an MCP tool result to text: join `content` parts of type
 * `"text"` with newlines; prefix `Error: ` when `isError` is true.
 */
export function mcpResultToText(result: McpToolResult): string {
  const parts = (result.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "");
  const text = parts.join("\n");
  return result.isError ? `Error: ${text}` : text;
}

/**
 * Extract image data URLs from an MCP tool result: for each `content` part
 * of type `"image"` with a non-empty string `data` and `mimeType`, emit a
 * `data:<mimeType>;base64,<data>` URL. Malformed parts are skipped; returns
 * `[]` when there are no image parts.
 */
export function mcpResultToImages(result: McpToolResult): string[] {
  return (result.content ?? [])
    .filter(
      (c) =>
        c.type === "image" &&
        typeof c.data === "string" &&
        c.data.length > 0 &&
        typeof c.mimeType === "string" &&
        c.mimeType.length > 0,
    )
    .map((c) => `data:${c.mimeType};base64,${c.data}`);
}
