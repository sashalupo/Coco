# Planner — Progress Memory

> **This file is the agent's persistent memory.** The `Planner` agent
> (`.github/agents/planner.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Turn each changelog feature (from the Changelog Researcher's backlog) into a concrete,
step-by-step implementation plan for the `llm` VS Code extension. The planner does NOT write
code — only the Coder writes code.

## Active plan — 1.100-15 · Enhanced MCP input/output/progress UI

- **Status:** Planned (2026-10-23)
- **Changelog:** VS Code 1.100 (Apr 2025) — enhanced UI for MCP tool **input/output**
  display plus MCP **progress messages** (`notifications/progress`) streamed while a
  tool runs. No screenshots — no UI-fidelity requirement beyond the existing tool card.
- **Grounding notes:** `src/mcp.ts` — `McpJsonRpc.handleLine` drops every message whose
  `id` isn't a pending request, so stdio `notifications/progress` lines are silently
  ignored; `McpHttpClient.post` reads the full SSE body via `parseSseMessages` and picks
  only the message with `m.id === msg.id`, so SSE progress notifications are dropped too.
  Both are the natural hook points. `src/mcpManager.ts` — `McpClientLike` (line ~24) is
  the structural interface both transports satisfy; `execute` (line ~185) is the single
  call site the chat loop uses. `src/chat/ChatViewProvider.ts` — MCP branch (~line
  1770–1810) posts `tool_start` (with `id`, `tool`, `args`) before
  `mcpManager.execute`, then `tool_result` after; the `tool_start` id is the
  correlation key. `src/chat/webview.ts` — `tool_start` case (~line 2480) builds the
  running card with `div.tool-args` (raw `msg.args`) + `div.tool-running` spinner;
  `tool_result` case (~line 2504) removes `.tool-running` and appends `pre.tool-output`
  (raw text) in both found-card and fallback branches; no `tool_progress` case exists.
  Smoke test: `mcp-http-s5` block with live mock servers on ports 18100 (SSE) / 18101
  (JSON) (~line 5863); hard gate `assertCount !== 758` at line 6138.
- **Spec (minimal, engine-agnostic):** (1) Progress: `notifications/progress` is a
  JSON-RPC notification with params `{ progressToken, progress, total?, message? }` —
  stdio: a line on stdout; HTTP: an SSE `data:` message without a matching `id`. Both
  transports get an optional progress callback; the manager threads it through
  `execute`; the chat layer posts a `tool_progress` message; the webview renders a
  progress bar/line in the running tool card. (2) Pretty-print: when tool input (`args`)
  or output is a string that parses as JSON, render it as 2-space-indented JSON in the
  existing `pre`/`div` elements; non-JSON text renders exactly as before.
- **Files to touch:** `src/mcp.ts`, `src/mcpManager.ts`, `src/chat/ChatViewProvider.ts`,
  `src/chat/webview.ts`, `scripts/smoke-test.js`.
- **Slices (in order):**
  - `1.100-15.S1` — progress notification type + stdio capture hook in `src/mcp.ts`:
    (a) `export interface McpProgressNotification { progressToken?: unknown; progress:
    number; total?: number; message?: string; }` + `export type McpProgressCallback =
    (p: McpProgressNotification) => void;`; (b) `McpJsonRpc` constructor takes an
    optional 3rd arg `onNotification?: (method: string, params: unknown) => void`; in
    `handleLine`, when the message is not a pending response, if `msg.method` is a
    string and `onNotification` is set, invoke it (then return as before); (c)
    `McpClient.setProgressCallback(cb: McpProgressCallback | undefined): void` wires
    `rpc.onNotification` to forward only `notifications/progress` with plain-object
    params.
  - `1.100-15.S2` — HTTP transport progress capture in `src/mcp.ts`:
    `McpHttpClient.setProgressCallback(cb: McpProgressCallback | undefined): void`
    stores the callback; in `post`, when the response is SSE, iterate
    `parseSseMessages(body)` and for every plain-object message with
    `method === "notifications/progress"` and plain-object `params`, invoke the
    callback (while still resolving the matching `id` response). JSON-body responses
    unchanged.
  - `1.100-15.S3` — `src/mcpManager.ts`: widen `McpClientLike.callTool` to
    `callTool(name: string, args: Record<string, unknown>, onProgress?:
    McpProgressCallback): Promise<McpToolResult>` (optional param — existing call sites
    still compile); `McpManager.execute(name, args, onProgress?)` passes `onProgress`
    through to `client.callTool`. Return type and error paths unchanged.
  - `1.100-15.S4` — `src/chat/ChatViewProvider.ts`: in the MCP branch pass a progress
    callback to `this.mcpManager.execute(call.function.name, mcpArgs, (p) =>
    this.postMessage({ type: "tool_progress", id: call.id, tool: call.function.name,
    progress: p.progress, ...(typeof p.total === "number" ? { total: p.total } : {}),
    ...(typeof p.message === "string" ? { message: p.message } : {}) }))`. Non-MCP path
    unchanged.
  - `1.100-15.S5` — `src/chat/webview.ts`: (a) pure helper `prettyJson(s)` — JSON-parse
    the string, return `JSON.stringify(v, null, 2)` on success (bare JSON strings
    return the raw input), return the input unchanged on failure/empty; (b) `tool_start`
    case: `args.textContent = prettyJson(msg.args || '')`; (c) `tool_result` case: in
    **both** found-card and fallback branches `out.textContent = prettyJson(msg.output
    || '')`; (d) new `case 'tool_progress':` — find `[data-tool-id="msg.id"]`; if
    found, locate/create a `div.tool-progress` in the card: `span.tool-progress-bar`
    (width = `progress/total*100%` when `total` is a number > 0, else hidden) +
    `span.tool-progress-text` with `message` or `progress` (+ `/total` when present);
    if no card found, ignore; (e) CSS near the existing `.tool-output`/`.tool-running`
    rules: `.tool-progress` (flex, gap, margin-top, font-size), `.tool-progress-bar`
    (height ~6px, rounded, accent background, `transition: width .2s`),
    `.tool-progress-text` (muted color).
  - `1.100-15.S6` — smoke-test guards in `scripts/smoke-test.js`:
    (a) stdio: extend the existing stdio mock-server block — the mock emits a
    `notifications/progress` line (`params: { progressToken: "t", progress: 50, total:
    100, message: "halfway" }`) before the `tools/call` response; assert
    `McpClient.setProgressCallback` fires with `progress === 50` and `callTool` still
    resolves; (b) HTTP: extend the SSE mock server (port 18100) so the `tools/call` SSE
    body includes a `notifications/progress` event before the response event; assert
    `McpHttpClient.setProgressCallback` fires and the result is still returned;
    (c) manager threading: `McpManager.execute` with a stub client records the
    `onProgress` callback (assert same function identity); (d) static:
    `out/chat/ChatViewProvider.js` posts `tool_progress`; `src/chat/webview.ts`
    references `tool_progress`, `prettyJson`, and `tool-progress`; (e) raise the hard
    total-count gate (758 → 766, 8 new assertions).
- **First slice:** `1.100-15.S1`.
- **Acceptance:** compile + smoke pass (766); an MCP tool call on **both** stdio and
  HTTP transports surfaces `notifications/progress` as a `tool_progress` message
  correlated by tool-call id and rendered as a progress bar/line in the running tool
  card; tool input and output that are valid JSON render as 2-space-indented JSON in
  the card; non-JSON I/O and no-progress behavior are byte-identical to before.
- **Open questions:** (1) `progressToken` is captured but not used for correlation
  (one tool call in flight per card; the `id` correlation is sufficient); (2) HTTP
  progress lands when the response body completes (the current `post` reads the full
  body — true streaming would require a rewrite of `post`, out of scope); (3)
  pretty-print applies to any JSON-parseable string; the `typeof v === "string"` guard
  keeps bare JSON strings on the raw path.


## Status

- **Current item:** 1.100-15 (planned) — 1.100-14 planned
- **Next step:** dispatch `1.100-15.S1` (progress notification type + stdio capture hook in `src/mcp.ts`) to the Coder
- **Last updated:** 2026-10-23
- **Last commit:** (planner commit for the 1.100-15 plan)
- **Build state:** n/a (planner does not build)

## Plans delivered (recap)

Each item was split into slices of ≤3 files; plans themselves are pruned (see git history).

**1.98 (complete, tag `changelog-1.98`):** editable `run_command` approval card + "modified by user" badge (1); `notebook_edit` tool, 5 actions, `src/notebook.ts`, `.ipynb` rendered as cells (2); `#codebase` sweep (8); `#problems` (9); `#folder:<name>` (10); `llm.changeCompletionsModel` + `llm.completions.model` (12); image attachments + `llm.chat.vision.enabled` (14); status-bar overview `llm.showStatusOverview` + `llm.statusBar.enabled` (15). Already built: 3, 4, 6. Smoke ends ~371.

**1.99 (complete, tag `changelog-1.99`):** MCP client over stdio `src/mcp.ts` + `src/mcpManager.ts` (2); `think` tool (3); `fetch_url` + `#fetch` `src/fetchTool.ts` (4); `find_usages` + `#usages` `src/usages.ts` (5); `#newWorkspace` scaffolds `src/workspaceScaffold.ts` (6); tool approvals with session/workspace/global scope `ApprovalStore` (8); Ask/Agent/Edit mode picker (10); reusable prompt files `llm.usePrompt` `src/prompts.ts` (12); URL/bmp images (13); completions status + `llm.toggleCompletions` (16); `#searchResults` (19); explicit save on keep (23); nbformat 4.5 cell ids (27); `new_notebook` tool + `/newNotebook` (28); cell outputs to chat `llm.addCellOutput` (29). Already built: 1, 24. Smoke ends ~584.

**1.100 (in progress, tag `changelog-1.100`):** done so far: instructions files `.instructions.md` with `applyTo` auto-attach, `src/instructions.ts` (1); prompt-file front matter `mode`/`tools`, `llm.runPrompt` + Play button, languages `llm.prompt`/`llm.instructions` (2); `apply_patch` tool `src/patch.ts` (3); `#fetch` as Markdown with `llm.chat.fetch.maxTokens` token trim (7). Chat input pills: `ContextPill` + `parsePillRefs`/`dedupePills` in `src/context.ts`, pill strip UI in `src/chat/webview.ts`, `postContextPills()`/`remove_pill` in `src/chat/ChatViewProvider.ts`, grouped `llm.addContext` quick-pick in `src/extension.ts` (8). Smoke 690.
