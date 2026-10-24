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
  inputs?: Record<string, McpInput>;
}

/** A user-provided input value for an MCP server (e.g. a secret). */
export interface McpInput {
  description?: string;
  type?: "string" | "number" | "boolean";
  password?: boolean;
  required?: boolean;
}

/** Optional MCP tool annotations (human-readable hints). */
export interface McpToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

/** A tool discovered from an MCP server via `tools/list`. */
export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  annotations?: McpToolAnnotations;
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

/** A prompt discovered from an MCP server via `prompts/list`. */
export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: { name: string; description?: string; required?: boolean }[];
}

/** The result of an MCP `prompts/get`. */
export interface McpPromptResult {
  messages?: {
    role: string;
    content: { type: string; text?: string }[] | string;
  }[];
  description?: string;
}

/** Params of an MCP `notifications/progress` message. */
export interface McpProgressNotification {
  progressToken?: unknown;
  progress: number;
  total?: number;
  message?: string;
}

/** Callback invoked for each MCP progress notification. */
export type McpProgressCallback = (p: McpProgressNotification) => void;

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
    if (isPlainObject(entry.inputs)) {
      const inputs: Record<string, McpInput> = {};
      let ok = true;
      for (const [k, v] of Object.entries(entry.inputs)) {
        if (!isPlainObject(v)) {
          ok = false;
          break;
        }
        if (v.description !== undefined && typeof v.description !== "string") {
          ok = false;
          break;
        }
        if (
          v.type !== undefined &&
          v.type !== "string" &&
          v.type !== "number" &&
          v.type !== "boolean"
        ) {
          ok = false;
          break;
        }
        if (v.password !== undefined && typeof v.password !== "boolean") {
          ok = false;
          break;
        }
        if (v.required !== undefined && typeof v.required !== "boolean") {
          ok = false;
          break;
        }
        inputs[k] = {
          ...(typeof v.description === "string" ? { description: v.description } : {}),
          ...(v.type === "string" || v.type === "number" || v.type === "boolean"
            ? { type: v.type }
            : {}),
          ...(typeof v.password === "boolean" ? { password: v.password } : {}),
          ...(typeof v.required === "boolean" ? { required: v.required } : {}),
        };
      }
      if (ok) {
        cfg.inputs = inputs;
      }
    }
    out[name] = cfg;
  }
  return out;
}

/**
 * Case-insensitive test for env-var names that look like secrets.
 * Used to decide whether a value should be stored as a prompted input
 * reference instead of a literal.
 */
export function detectSecretEnvName(name: string): boolean {
  return /key|token|secret|password|passwd|pwd|apikey|api_key|auth|credential|bearer/i.test(name);
}

/**
 * Resolve `${input:name}` references in a server's `env` map against the
 * provided values. Non-reference values pass through unchanged. Throws
 * `missing required input: <name>` when a referenced input is absent.
 * Returns `{}` when `cfg.env` is undefined.
 */
export function resolveMcpInputs(
  cfg: McpServerConfig,
  provided: Record<string, string>,
): Record<string, string> {
  if (!cfg.env) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(cfg.env)) {
    const m = /^\$\{input:([A-Za-z0-9_-]+)\}$/.exec(v);
    if (!m) {
      out[k] = v;
      continue;
    }
    const name = m[1];
    if (!(name in provided)) {
      throw new Error(`missing required input: ${name}`);
    }
    out[k] = provided[name];
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
  /** Invoked for incoming notifications (messages without a pending id). */
  public onNotification?: (method: string, params: unknown) => void;
  /**
   * Invoked for incoming server→client JSON-RPC *requests* (a message with
   * a numeric `id` that is not one of our own pending requests AND a string
   * `method`). The handler answers via `respond({ result })` or
   * `respond({ error })`; the response is written back over the same
   * transport. Purely additive — when unset, such messages are dropped
   * exactly as before.
   */
  public onRequest?: (
    method: string,
    params: unknown,
    respond: (r: {
      result?: unknown;
      error?: { code: number; message: string };
    }) => void,
  ) => void;

  constructor(
    input: NodeJS.ReadableStream,
    output: NodeJS.WritableStream,
    onNotification?: (method: string, params: unknown) => void,
  ) {
    this.input = input;
    this.output = output;
    this.onNotification = onNotification;
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
      if (
        typeof msg.id === "number" &&
        typeof msg.method === "string" &&
        this.onRequest
      ) {
        // Server→client request (numeric id not pending + method):
        // answer via the respond closure.
        const id = msg.id;
        this.onRequest(msg.method, msg.params, (r) => {
          if (this.closed) {
            return;
          }
          const out: Record<string, unknown> = { jsonrpc: "2.0", id };
          if (r.error !== undefined) {
            out.error = r.error;
          } else {
            out.result = r.result;
          }
          this.output.write(JSON.stringify(out) + "\n");
        });
      } else if (typeof msg.method === "string" && this.onNotification) {
        this.onNotification(msg.method, msg.params);
      }
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
 * Race a promise against a timeout. Rejects with `timed out after <ms>ms`
 * when the promise does not settle in time. Used for best-effort requests
 * (e.g. `prompts/list`) that must never stall startup.
 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`timed out after ${ms}ms`));
    }, ms);
    t.unref?.();
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
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
  /** Prompts discovered via best-effort `prompts/list` after the handshake. */
  public prompts: McpPrompt[] = [];
  /** Resources discovered via best-effort `resources/list` after the handshake. */
  public resources: McpResource[] = [];
  /** Resource templates discovered via best-effort `resources/templates/list`. */
  public resourceTemplates: McpResourceTemplate[] = [];

  constructor(config: McpServerConfig, inputs?: Record<string, string>) {
    if (!config.command) {
      throw new Error("McpClient requires a stdio `command` config");
    }
    // `${input:name}` env references are always resolved at construction
    // (throws `missing required input: <name>` when one is absent); with no
    // references the env map is byte-identical to the plain path.
    const env = resolveMcpInputs(config, inputs ?? {});
    this.child = spawn(config.command, config.args ?? [], {
      env: { ...process.env, ...env },
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
      // Best-effort prompt discovery: issued AFTER the tools/list handshake
      // has fully resolved, with its own short timeout, so a server that
      // does not answer `prompts/list` can never stall or fail startup.
      await this.loadPrompts();
      // Best-effort resource discovery: same pattern as prompts/list.
      await this.loadResources();
    } catch (e) {
      this.close();
      throw e;
    }
  }

  /**
   * Best-effort `prompts/list`: any failure (error, timeout, missing
   * capability) leaves `prompts` as `[]` and never throws.
   */
  private async loadPrompts(): Promise<void> {
    try {
      const result = (await withTimeout(
        this.rpc.request("prompts/list", {}),
        2000,
      )) as { prompts?: McpPrompt[] } | null;
      this.prompts = Array.isArray(result?.prompts) ? result!.prompts : [];
    } catch {
      this.prompts = [];
    }
  }

  /**
   * Best-effort `resources/list` + `resources/templates/list`: any failure
   * leaves both arrays as `[]` and never throws.
   */
  private async loadResources(): Promise<void> {
    try {
      const result = (await withTimeout(
        this.rpc.request("resources/list", {}),
        2000,
      )) as { resources?: McpResource[] } | null;
      this.resources = Array.isArray(result?.resources) ? result!.resources : [];
    } catch {
      this.resources = [];
    }
    try {
      const result = (await withTimeout(
        this.rpc.request("resources/templates/list", {}),
        2000,
      )) as { resourceTemplates?: McpResourceTemplate[] } | null;
      this.resourceTemplates = Array.isArray(result?.resourceTemplates)
        ? result!.resourceTemplates
        : [];
    } catch {
      this.resourceTemplates = [];
    }
  }

  /** Fetch a prompt by name via `prompts/get`. */
  getPrompt(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<McpPromptResult> {
    return this.rpc
      .request("prompts/get", { name, arguments: args })
      .then((r) => r as McpPromptResult);
  }

  /** Read a resource by URI via `resources/read`. */
  readResource(uri: string): Promise<McpResourceReadResult> {
    return this.rpc
      .request("resources/read", { uri })
      .then((r) => r as McpResourceReadResult);
  }

  /**
   * Call a discovered tool by name. When `onProgress` is provided it is
   * wired for the duration of the call and cleared once the call settles
   * (success or failure). Note: a concurrent `callTool` on the same client
   * would overwrite the first's callback — acceptable for now.
   */
  callTool(
    name: string,
    args: Record<string, unknown>,
    onProgress?: McpProgressCallback,
  ): Promise<McpToolResult> {
    if (onProgress) {
      this.setProgressCallback(onProgress);
    }
    return this.rpc
      .request("tools/call", { name, arguments: args })
      .then((r) => r as McpToolResult)
      .finally(() => {
        if (onProgress) {
          this.setProgressCallback(undefined);
        }
      });
  }

  /**
   * Wire (or clear) a callback for `notifications/progress` messages
   * received over stdio while a tool runs.
   */
  setProgressCallback(cb: McpProgressCallback | undefined): void {
    this.rpc.onNotification = cb
      ? (method, params) => {
          if (
            method === "notifications/progress" &&
            params !== null &&
            typeof params === "object" &&
            !Array.isArray(params)
          ) {
            cb(params as McpProgressNotification);
          }
        }
      : undefined;
  }

  /**
   * Wire (or clear) the handler for server→client `sampling/createMessage`
   * requests. Any other server-initiated method is answered with a
   * JSON-RPC `-32601 method not found` error so the server never hangs on
   * an unanswered request.
   */
  setSamplingHandler(
    cb: ((server: string, params: McpSamplingParams) => Promise<McpSamplingResult>) | undefined,
  ): void {
    this.rpc.onRequest = cb
      ? (method, params, respond) => {
          if (method !== "sampling/createMessage") {
            respond({
              error: { code: -32601, message: "method not found" },
            });
            return;
          }
          cb("", params as McpSamplingParams)
            .then((result) => respond({ result }))
            .catch((e: unknown) =>
              respond({
                error: {
                  code: -32000,
                  message: e instanceof Error ? e.message : String(e),
                },
              }),
            );
        }
      : undefined;
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
  /** Prompts discovered via best-effort `prompts/list` after the handshake. */
  public prompts: McpPrompt[] = [];
  /** Resources discovered via best-effort `resources/list` after the handshake. */
  public resources: McpResource[] = [];
  /** Resource templates discovered via best-effort `resources/templates/list`. */
  public resourceTemplates: McpResourceTemplate[] = [];
  /** Optional callback for `notifications/progress` SSE messages. */
  private progressCb: McpProgressCallback | undefined;
  /** Handler for server→client `sampling/createMessage` requests. */
  private samplingCb:
    | ((server: string, params: McpSamplingParams) => Promise<McpSamplingResult>)
    | undefined;

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
      // Best-effort prompt discovery: issued AFTER the tools/list handshake
      // has fully resolved, with its own short timeout, so a server that
      // does not answer `prompts/list` can never stall or fail startup.
      await this.loadPrompts();
      // Best-effort resource discovery: same pattern as prompts/list.
      await this.loadResources();
    } catch (e) {
      this.close();
      throw e;
    }
  }

  /**
   * Best-effort `prompts/list`: any failure (error, timeout, missing
   * capability) leaves `prompts` as `[]` and never throws.
   */
  private async loadPrompts(): Promise<void> {
    try {
      const result = (await withTimeout(
        this.post("prompts/list", {}),
        2000,
      )) as { prompts?: McpPrompt[] } | null;
      this.prompts = Array.isArray(result?.prompts) ? result!.prompts : [];
    } catch {
      this.prompts = [];
    }
  }

  /**
   * Best-effort `resources/list` + `resources/templates/list`: any failure
   * leaves both arrays as `[]` and never throws.
   */
  private async loadResources(): Promise<void> {
    try {
      const result = (await withTimeout(
        this.post("resources/list", {}),
        2000,
      )) as { resources?: McpResource[] } | null;
      this.resources = Array.isArray(result?.resources) ? result!.resources : [];
    } catch {
      this.resources = [];
    }
    try {
      const result = (await withTimeout(
        this.post("resources/templates/list", {}),
        2000,
      )) as { resourceTemplates?: McpResourceTemplate[] } | null;
      this.resourceTemplates = Array.isArray(result?.resourceTemplates)
        ? result!.resourceTemplates
        : [];
    } catch {
      this.resourceTemplates = [];
    }
  }

  /** Fetch a prompt by name via `prompts/get`. */
  getPrompt(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<McpPromptResult> {
    return this.post("prompts/get", { name, arguments: args }).then(
      (r) => r as McpPromptResult,
    );
  }

  /** Read a resource by URI via `resources/read`. */
  readResource(uri: string): Promise<McpResourceReadResult> {
    return this.post("resources/read", { uri }).then(
      (r) => r as McpResourceReadResult,
    );
  }

  /**
   * Call a discovered tool by name. When `onProgress` is provided it is
   * wired for the duration of the call and cleared once the call settles
   * (success or failure). Note: a concurrent `callTool` on the same client
   * would overwrite the first's callback — acceptable for now.
   */
  callTool(
    name: string,
    args: Record<string, unknown>,
    onProgress?: McpProgressCallback,
  ): Promise<McpToolResult> {
    if (onProgress) {
      this.setProgressCallback(onProgress);
    }
    return this.post("tools/call", { name, arguments: args })
      .then((r) => r as McpToolResult)
      .finally(() => {
        if (onProgress) {
          this.setProgressCallback(undefined);
        }
      });
  }

  /**
   * Wire (or clear) a callback for `notifications/progress` messages
   * received over SSE while a tool runs.
   */
  setProgressCallback(cb: McpProgressCallback | undefined): void {
    this.progressCb = cb;
  }

  /**
   * Wire (or clear) the handler for server→client `sampling/createMessage`
   * requests. Any other server-initiated method is answered with a
   * JSON-RPC `-32601 method not found` error so the server never hangs on
   * an unanswered request.
   */
  setSamplingHandler(
    cb: ((server: string, params: McpSamplingParams) => Promise<McpSamplingResult>) | undefined,
  ): void {
    this.samplingCb = cb;
  }

  /**
   * Answer a server-initiated JSON-RPC request (detected inside a response
   * body) by POSTing the response back, echoing the session header. Never
   * throws — failures are logged nowhere but must not break the client.
   */
  private async handleServerRequest(
    id: number,
    method: string,
    params: unknown,
  ): Promise<void> {
    let response: { result?: unknown; error?: { code: number; message: string } };
    if (method !== "sampling/createMessage" || !this.samplingCb) {
      response = {
        error: { code: -32601, message: "method not found" },
      };
    } else {
      try {
        const result = await this.samplingCb("", params as McpSamplingParams);
        response = { result };
      } catch (e: unknown) {
        response = {
          error: {
            code: -32000,
            message: e instanceof Error ? e.message : String(e),
          },
        };
      }
    }
    if (this.closed) {
      return;
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (this.sessionId) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }
    const out: Record<string, unknown> = { jsonrpc: "2.0", id };
    if (response.error !== undefined) {
      out.error = response.error;
    } else {
      out.result = response.result;
    }
    try {
      await fetch(this.url, {
        method: "POST",
        headers,
        body: JSON.stringify(out),
      });
    } catch {
      // Best-effort: a failed response POST must not break the client.
    }
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
      for (const m of messages) {
        if (
          this.progressCb &&
          isPlainObject(m) &&
          m.method === "notifications/progress" &&
          m.params !== null &&
          typeof m.params === "object" &&
          !Array.isArray(m.params)
        ) {
          this.progressCb(m.params as McpProgressNotification);
        }
        // Server→client request: numeric id that is not our own pending
        // request AND a string method. Answer it by POSTing back; the
        // client's own response (if present) is still resolved below.
        if (
          isPlainObject(m) &&
          typeof m.id === "number" &&
          m.id !== msg.id &&
          typeof m.method === "string"
        ) {
          void this.handleServerRequest(m.id, m.method, m.params).catch(() => {
            // never break the client on a failed response POST
          });
        }
      }
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
 * Human-readable display name for an MCP tool: the `annotations.title`
 * when it is a non-empty string, otherwise the raw tool `name`.
 */
export function mcpToolDisplayName(tool: McpTool): string {
  const t = tool.annotations?.title;
  return typeof t === "string" && t.length > 0 ? t : tool.name;
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

/**
 * Parse a `/mcp.<server>.<prompt> [variable text]` chat command. Returns
 * `{ server, prompt, variableText }` on a match (case-sensitive), or null
 * when the text is not MCP-command-shaped or the server/prompt part is
 * empty. `variableText` is the trimmed trailing text, omitted when absent.
 * (Server/prompt names containing `.` are unsupported.)
 */
export function parseMcpPromptCommand(
  text: string,
): { server: string; prompt: string; variableText?: string } | null {
  const m = /^\/mcp\.([^.]+)\.([^\s]+)(?:[ \t]+([\s\S]+))?$/.exec(text);
  if (!m) {
    return null;
  }
  const server = m[1];
  const prompt = m[2];
  if (server === "" || prompt === "") {
    return null;
  }
  const variableText = m[3] !== undefined ? m[3].trim() : undefined;
  return variableText === undefined
    ? { server, prompt }
    : { server, prompt, variableText };
}

/**
 * Flatten an MCP prompt result to text: join each message's text with
 * newlines. Message content may be a plain string or an array of parts;
 * only `type: "text"` parts with a `text` field contribute. Returns `""`
 * when there are no messages.
 */
export function mcpPromptToText(result: McpPromptResult): string {
  const lines: string[] = [];
  for (const msg of result.messages ?? []) {
    if (typeof msg.content === "string") {
      lines.push(msg.content);
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "text" && typeof part.text === "string") {
          lines.push(part.text);
        }
      }
    }
  }
  return lines.join("\n");
}

/** A resource discovered from an MCP server via `resources/list`. */
export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/** A resource template discovered via `resources/templates/list`. */
export interface McpResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/** The result of an MCP `resources/read`. */
export interface McpResourceReadResult {
  contents?: { uri: string; mimeType?: string; text?: string; blob?: string }[];
  description?: string;
}

/**
 * Flatten an MCP `resources/read` result to text: join the `text` of each
 * content entry with newlines. Blob-only entries (no `text`) are skipped.
 * Returns `""` when there is no text content.
 */
export function mcpResourceReadToText(result: McpResourceReadResult): string {
  const lines: string[] = [];
  for (const c of result.contents ?? []) {
    if (typeof c.text === "string") {
      lines.push(c.text);
    }
  }
  return lines.join("\n");
}

/**
 * Parse `#mcp:<server>/<uri>` resource refs out of chat text. The server is
 * the first path segment (no whitespace, no `/`); the uri is the rest of the
 * token (no whitespace). Returns unique `{ server, uri }` pairs in order of
 * first appearance; `[]` when there are no matches.
 */
export function parseMcpResourceRef(
  text: string,
): { server: string; uri: string }[] {
  const re = /#mcp:([^\s/]+)\/(\S+)/g;
  const seen = new Set<string>();
  const out: { server: string; uri: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const server = m[1];
    const uri = m[2];
    const key = `${server}/${uri}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ server, uri });
    }
  }
  return out;
}

/** A single message in an MCP `sampling/createMessage` request. */
export interface McpSamplingMessage {
  role: "user" | "assistant" | "system";
  content: { type: string; text?: string };
}

/** The params of an MCP `sampling/createMessage` request. */
export interface McpSamplingParams {
  messages: McpSamplingMessage[];
  maxTokens: number;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  stopSequences?: string[];
}

/** The result returned for an MCP `sampling/createMessage` request. */
export interface McpSamplingResult {
  role: "assistant";
  content: { type: string; text: string };
  model?: string;
}

/** One entry in the in-memory MCP sampling request log. */
export interface McpSamplingLogEntry {
  server: string;
  model?: string;
  maxTokens: number;
  messageCount: number;
  allowed: boolean;
  ok: boolean;
  error?: string;
  at: number;
}

/**
 * Map MCP sampling params to plain chat messages: each message's `content.text`
 * becomes the string content; `systemPrompt` (when present) is prepended as a
 * leading system message. Empty/invalid input → `[]`.
 */
export function mcpSamplingParamsToMessages(
  params: McpSamplingParams,
): { role: string; content: string }[] {
  const out: { role: string; content: string }[] = [];
  if (typeof params?.systemPrompt === "string" && params.systemPrompt.length > 0) {
    out.push({ role: "system", content: params.systemPrompt });
  }
  for (const msg of params?.messages ?? []) {
    if (msg && typeof msg.role === "string" && typeof msg.content?.text === "string") {
      out.push({ role: msg.role, content: msg.content.text });
    }
  }
  return out;
}

/**
 * Extract the text from an MCP sampling result. Returns `""` when absent.
 */
export function mcpSamplingResultToText(result: McpSamplingResult): string {
  return typeof result?.content?.text === "string" ? result.content.text : "";
}
