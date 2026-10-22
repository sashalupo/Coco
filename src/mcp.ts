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

/** A single MCP server entry (stdio transport). */
export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/** A tool discovered from an MCP server via `tools/list`. */
export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

/** The result of an MCP `tools/call`. */
export interface McpToolResult {
  content?: { type: string; text?: string }[];
  isError?: boolean;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Parse the raw `llm.mcpServers` setting into validated server configs.
 * Pure validation: non-object input → `{}`; entries without a non-empty
 * string `command` are dropped; `args`/`env` are coerced only when they
 * have the right shape, otherwise left undefined.
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
    if (typeof command !== "string" || command.length === 0) {
      continue;
    }
    const cfg: McpServerConfig = { command };
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
