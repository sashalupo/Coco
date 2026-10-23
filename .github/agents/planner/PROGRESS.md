# Planner — Progress Memory

> **This file is the agent's persistent memory.** The `Planner` agent
> (`.github/agents/planner.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Turn each changelog feature (from the Changelog Researcher's backlog) into a concrete,
step-by-step implementation plan for the `llm` VS Code extension. The planner does NOT write
code — only the Coder writes code.

## Active plan — 1.100-13 · MCP support for Streamable HTTP

- **Status:** Planned (2026-10-23)
- **Changelog:** VS Code 1.100 (Apr 2025) — new **Streamable HTTP** transport for MCP
  servers, configured via `url` like SSE servers; backwards-compatible with SSE servers.
  Local reframe: `llm.mcp.servers` entries may now be `{ url }` (HTTP) instead of
  `{ command, args?, env? }` (stdio). No screenshots — no UI-fidelity requirement beyond
  the existing MCP UI.
- **Grounding notes:** `src/mcp.ts` (pure, no `vscode` import) holds `McpServerConfig`
  (`command`/`args`/`env`), `parseMcpServers` (drops entries without a non-empty string
  `command`), `McpJsonRpc`, `McpClient` (spawn + `initialize` handshake with 10 s timeout
  + `tools/list` + `callTool` + `close`), and the pure name/result mappers.
  `src/mcpManager.ts` (pure) holds `McpManager` with `clients = Map<string, McpClient>`;
  `ensureStarted` does `new McpClient(cfg)`; everything else (`getTools`, `execute`,
  `refresh`, `dispose`) only uses `.tools`, `.callTool`, `.close` — a common interface
  keeps the diff tiny. `src/config.ts` line 91 calls `parseMcpServers` (no change needed
  there). `package.json` line 390: `llm.mcp.servers` is a free-form `object` — only the
  description changes. `src/extension.ts` `llm.mcp.addServer` (line 365) hardcodes the
  stdio prompt flow. Smoke test already has an `http.createServer` mock (PORT 18099) and
  an MCP section (~line 2510); hard gate is 736 (line 5817). Node 18+ `fetch` is
  available; no new npm dependencies.
- **Spec (minimal, engine-agnostic):** client POSTs JSON-RPC 2.0 to a single `url` with
  `Content-Type: application/json` and `Accept: application/json, text/event-stream`;
  response is either a single JSON body or an SSE stream where each `data:` line is a
  JSON-RPC message (first message with the matching `id` settles the request); the
  `Mcp-Session-Id` response header (if present) is echoed on subsequent requests;
  `initialize` (protocolVersion `2025-03-26`) → `notifications/initialized` (POST, 202)
  → `tools/list`. Plain-JSON responses are handled by the same code path (content-type
  check) — that is the SSE backwards compatibility.
- **Files to touch:** `src/mcp.ts`, `package.json`, `src/mcpManager.ts`,
  `src/extension.ts`, `scripts/smoke-test.js`.
- **Slices (in order):**
  - `1.100-13.S1` — HTTP transport client + config shape in `src/mcp.ts`:
    (a) `McpServerConfig` gains an optional `url?: string` field (single interface;
    validation enforces exactly one of `command`/`url`); (b) `parseMcpServers` accepts
    an entry with a non-empty string `url` (HTTP) or a non-empty string `command`
    (stdio, existing behavior); entries with neither or with both are dropped;
    (c) `export function parseSseMessages(text: string): unknown[]` — pure SSE parser:
    keep lines starting with `data:`, strip the prefix, `JSON.parse` each payload
    (skip malformed), return the parsed JSON-RPC messages; (d) `export class
    McpHttpClient` mirroring `McpClient`'s public surface (`tools: McpTool[]`,
    `start()`, `callTool(name, args)`, `close()`): `start()` uses the same 10 s timeout
    pattern, POSTs `initialize` (protocolVersion `"2025-03-26"`, same `clientInfo`),
    captures the `Mcp-Session-Id` response header into a private field and echoes it on
    every subsequent POST, POSTs `notifications/initialized` (expect 202, ignore body),
    POSTs `tools/list` and stores `tools`; private `post(method, params)` uses
    `fetch(url, { method: "POST", headers: { "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream", ...(sessionId ? {
    "Mcp-Session-Id": sessionId } : {}) }, body: JSON.stringify(msg) })`, reads the full
    body as text, and if the response `content-type` includes `text/event-stream` runs
    `parseSseMessages(body)` and takes the first message with the matching `id`,
    otherwise `JSON.parse(body)` directly; non-2xx (except 202 for notifications)
    rejects with the status + body tail; `close()` is an idempotent flag that makes
    further `post` calls reject.
  - `1.100-13.S2` — `package.json`: update the `llm.mcp.servers` description to
    `"MCP servers to connect to. Each entry: { command, args?, env? } (stdio) or { url }
    (Streamable HTTP / SSE)."` No schema shape change (free-form object).
  - `1.100-13.S3` — manager transport selection in `src/mcpManager.ts`: import
    `McpHttpClient` (and the `McpToolResult` type) from `./mcp`; add `export interface
    McpClientLike { tools: McpTool[]; callTool(name: string, args:
    Record<string, unknown>): Promise<McpToolResult>; close(): void; }` (both clients
    satisfy it structurally); change the `clients`/`starting` maps from `McpClient` to
    `McpClientLike`; `ensureStarted` picks the transport: `const client: McpClientLike =
    cfg.url ? new McpHttpClient(cfg) : new McpClient(cfg);` — `refresh`, `getTools`,
    `execute`, `dispose` are unchanged.
  - `1.100-13.S4` — `llm.mcp.addServer` in `src/extension.ts`: after the name prompt,
    add a `vscode.window.showQuickPick` ("stdio (command)" / "Streamable HTTP (url)");
    stdio keeps the existing command/args flow; HTTP prompts for the URL (validate
    non-empty, `http://`/`https://` prefix) and writes `servers[name] = { url }`; the
    success message mentions the transport.
  - `1.100-13.S5` — smoke-test guards in `scripts/smoke-test.js`:
    (a) `out/mcp.js` exports `McpHttpClient` and `parseSseMessages`;
    (b) `parseSseMessages` pure tests: two `data:` events → 2 messages; a `data:` line
    with invalid JSON is skipped; empty input → `[]`;
    (c) `parseMcpServers`: `{ url: "http://x" }` accepted; `{ command: "x", url:
    "http://y" }` dropped; `{}` dropped;
    (d) live HTTP transport test against a second mock `http.createServer` (separate
    port, e.g. 18100): (i) SSE-mode server — responds `text/event-stream` with
    `data: {initialize result}\n\n` / `data: {tools/list result}\n\n` and sets
    `Mcp-Session-Id: sess-1`; assert `McpHttpClient.start()` discovers tools and that
    the `tools/list` request carried the `Mcp-Session-Id: sess-1` header (echo check);
    (ii) JSON-mode server — responds `application/json` single body; assert `start()` +
    `callTool` work; (iii) `McpManager` with a `url` server: `ensureStarted` → running
    status, `getTools` returns namespaced tools, `execute("mcp__http__tool", …)`
    returns the tool text;
    (e) `package.json` description contains "Streamable HTTP"; `mcpManager.ts`
    references `McpHttpClient` and `McpClientLike`; `extension.ts` `addServer`
    references the transport quick-pick ("Streamable HTTP (url)");
    (f) raise the hard total-count gate (736 → new total).
- **First slice:** `1.100-13.S1`.
- **Acceptance:** compile + smoke pass; a server declared as `{ "url":
  "http://host:port/mcp" }` in `llm.mcp.servers` connects via Streamable HTTP (POST
  JSON-RPC, SSE or plain-JSON response, `Mcp-Session-Id` echoed), exposes its tools as
  `mcp__<server>__<tool>`, and executes them through the existing chat tool loop; stdio
  servers (`command`) behave exactly as before; `llm.mcp.addServer` can add both kinds.
- **Open questions:** (1) `Mcp-Session-Id` is optional per spec — only echoed when
  present; (2) SSE responses may interleave server→client notifications before the
  matching response — the client takes the first message with the matching `id` and
  ignores the rest (no persistent client→server push is needed for this minimal
  client); (3) protocol version `2025-03-26` is sent for HTTP while stdio keeps
  `2024-11-05` — acceptable, servers negotiate down.


## Status

- **Current item:** 1.100-13 (planned) — 1.100-12 complete
- **Next step:** dispatch `1.100-13.S1` (HTTP transport client + config shape in `src/mcp.ts`) to the Coder
- **Last updated:** 2026-10-23
- **Last commit:** (planner commit for the 1.100-13 plan)
- **Build state:** n/a (planner does not build)

## Plans delivered (recap)

Each item was split into slices of ≤3 files; plans themselves are pruned (see git history).

**1.98 (complete, tag `changelog-1.98`):** editable `run_command` approval card + "modified by user" badge (1); `notebook_edit` tool, 5 actions, `src/notebook.ts`, `.ipynb` rendered as cells (2); `#codebase` sweep (8); `#problems` (9); `#folder:<name>` (10); `llm.changeCompletionsModel` + `llm.completions.model` (12); image attachments + `llm.chat.vision.enabled` (14); status-bar overview `llm.showStatusOverview` + `llm.statusBar.enabled` (15). Already built: 3, 4, 6. Smoke ends ~371.

**1.99 (complete, tag `changelog-1.99`):** MCP client over stdio `src/mcp.ts` + `src/mcpManager.ts` (2); `think` tool (3); `fetch_url` + `#fetch` `src/fetchTool.ts` (4); `find_usages` + `#usages` `src/usages.ts` (5); `#newWorkspace` scaffolds `src/workspaceScaffold.ts` (6); tool approvals with session/workspace/global scope `ApprovalStore` (8); Ask/Agent/Edit mode picker (10); reusable prompt files `llm.usePrompt` `src/prompts.ts` (12); URL/bmp images (13); completions status + `llm.toggleCompletions` (16); `#searchResults` (19); explicit save on keep (23); nbformat 4.5 cell ids (27); `new_notebook` tool + `/newNotebook` (28); cell outputs to chat `llm.addCellOutput` (29). Already built: 1, 24. Smoke ends ~584.

**1.100 (in progress, tag `changelog-1.100`):** done so far: instructions files `.instructions.md` with `applyTo` auto-attach, `src/instructions.ts` (1); prompt-file front matter `mode`/`tools`, `llm.runPrompt` + Play button, languages `llm.prompt`/`llm.instructions` (2); `apply_patch` tool `src/patch.ts` (3); `#fetch` as Markdown with `llm.chat.fetch.maxTokens` token trim (7). Chat input pills: `ContextPill` + `parsePillRefs`/`dedupePills` in `src/context.ts`, pill strip UI in `src/chat/webview.ts`, `postContextPills()`/`remove_pill` in `src/chat/ChatViewProvider.ts`, grouped `llm.addContext` quick-pick in `src/extension.ts` (8). Smoke 690.
