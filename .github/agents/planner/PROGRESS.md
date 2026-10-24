# Planner — Progress Memory

> **This file is the agent's persistent memory.** The `Planner` agent
> (`.github/agents/planner.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Turn each changelog feature (from the Changelog Researcher's backlog) into a concrete,
step-by-step implementation plan for the `llm` VS Code extension. The planner does NOT write
code — only the Coder writes code.

## Active plan — 1.101-2 · MCP support for prompts (VS Code 1.101)

- **Status:** Planned — 2026-10-24
- **Changelog:** VS Code 1.101 — MCP servers can define **prompts** (reusable snippets/tasks); accessible as slash commands in chat: `/mcp.servername.promptname`; supports prompt variables and completions. Relevance: keep (capability/context) — MCP capability.
- **Approach:** Extend the existing MCP client (1.99-2) with the `prompts/list` + `prompts/get` JSON-RPC methods; `McpManager` exposes prompts and a `getPrompt` that resolves a prompt to text; `ChatViewProvider.handleSend` intercepts `/mcp.<server>.<prompt> [text]` (mirroring the `/newNotebook` intercept) and pushes the resolved prompt text as the user message; the webview input shows a slash-command dropdown (built-in `/newNotebook` + one entry per running server's prompt) fed by a new `mcp_prompts` host message. Prompt variables: trailing text after the command is passed as the first prompt argument's value (single-value substitution); the dropdown provides completions. No new deps, no request-shape change.
- **Files to touch:** `src/mcp.ts`, `src/mcpManager.ts`, `src/chat/ChatViewProvider.ts`, `src/chat/webview.ts`, `scripts/smoke-test.js`.
- **Slices:**
  - **S-001** — `src/mcp.ts` (1 file, pure): `McpPrompt` interface (`name`, `description?`, `arguments?: { name, description?, required? }[]`); `McpPromptResult` (`messages?: { role: string; content: { type: string; text?: string }[] | string }[]`, `description?`); `parseMcpPromptCommand(text) → { server, prompt, variableText } | null` (regex `^/mcp\.([^.]+)\.([^\s]+)(?:[ \t]+([\s\S]+))?$`, case-sensitive, empty parts → null); `mcpPromptToText(result) → string` (join message texts with `\n`, handles string and array content, skips non-text parts). No `vscode` import.
  - **S-002** — `src/mcp.ts` (1 file): `McpClient` + `McpHttpClient` — `public prompts: McpPrompt[] = []`; in `start()` after `tools/list`, best-effort `prompts/list` (try/catch → `[]` on failure or missing capability); `getPrompt(name, args?)` → `prompts/get` request returning `McpPromptResult`.
  - **S-003** — `src/mcpManager.ts` (1 file): `McpClientLike` += `prompts: McpPrompt[]` + `getPrompt(name, args?)`; `getServerPrompts(name) → McpPrompt[]` (empty when not running, mirrors `getServerTools`); `getPrompt(server, prompt, variableText?) → { content: string }` (never throws; unknown server / start failure / JSON-RPC error → `Error: ...`; maps `variableText` to the first declared prompt argument, else passes no args).
  - **S-004** — `src/chat/ChatViewProvider.ts` (1 file): in `handleSend`, after the `/newNotebook` intercept, `parseMcpPromptCommand(text)` → on match: `mcpManager.getPrompt(server, prompt, variableText)`; error → `postMessage({ type: "error", ... })` and return; success → push `{ role: "user", content: text }` to history (the raw command stays visible) and `runStream` as usual. New `listMcpPrompts() → { server, name, description }[]` over running servers; post `{ type: "mcp_prompts", prompts }` after each `runStream` completes (and once on webview ready) so the dropdown tracks server state.
  - **S-005** — `src/chat/webview.ts` (1 file): slash-command dropdown above the input row — shown when `inputEl.value` starts with `/` and has no newline; entries = built-in `/newNotebook` + `mcp_prompts` entries rendered as `/mcp.<server>.<prompt>` with the description as tooltip; filtered by prefix; click/Enter inserts the command + trailing space and focuses the input; hidden on blur/Escape/send. CSS reuses existing input/toolbar variables.
  - **S-006** — `scripts/smoke-test.js` (1 file): new assertions — `parseMcpPromptCommand` (valid, variable text, no match, empty parts); `mcpPromptToText` (string + array content, non-text skipped); `McpClient` handshake issues `prompts/list` and tolerates its failure (PassThrough fake server); `McpManager.getServerPrompts`/`getPrompt` (unknown server error, variable mapped to first argument); static source checks: `ChatViewProvider` intercepts `/mcp.` via `parseMcpPromptCommand` and posts `mcp_prompts`; `webview.ts` contains the slash dropdown + `mcp_prompts` handler. Gate **813 → 828** (+15).
- **Acceptance criteria (whole item):** compile passes; smoke 828/828; `/mcp.<server>.<prompt>` resolves via `prompts/get` and sends the prompt text as the user message; trailing text fills the first prompt argument; unknown server / not running / JSON-RPC error → error posted in the panel, no model round-trip; servers without prompt support start fine with zero prompts; dropdown lists `/newNotebook` + running servers' prompts and filters by prefix; no new deps.
- **Risks:** `prompts/list` unsupported by some servers → must be best-effort (never fail the handshake); prompt `arguments` beyond the first are not filled (documented limitation); prompts are fetched fresh per invocation (no cache); server/prompt names containing `.` are unsupported by the command grammar (same class of limitation as `mcp__` names).
- **Next item:** (none recorded).

## Status

- **Current item:** 1.101-2 (planned: 6 slices)
- **Next step:** dispatch the Coder for 1.101-2 S-001
- **Last updated:** 2026-10-24
- **Last commit:** (planner commit for the 1.101-2 plan)
- **Build state:** n/a (planner does not build)

## Plans delivered (recap)

Each item was split into slices of ≤3 files; plans themselves are pruned (see git history).

**1.101-1 (planned, built):** chat tool sets — `src/toolsets.ts` parses `.vscode/toolsets.json`, `#toolset:<name>` tag + toolbar "Tools" select feed the existing `promptTools` filter (tag > picker > prompt-file), `llm.toolsets.createFile` scaffold command, `llm.toolsets.enabled` gate (8 slices: S-001 `src/toolsets.ts`, S-002 `src/context.ts`, S-003 presets/config, S-004 `ChatViewProvider.ts`, S-005 `webview.ts`, S-006 `package.json`, S-007 `extension.ts`, S-008 smoke 806→813).

**1.98 (complete, tag `changelog-1.98`):** editable `run_command` approval card + "modified by user" badge (1); `notebook_edit` tool, 5 actions, `src/notebook.ts`, `.ipynb` rendered as cells (2); `#codebase` sweep (8); `#problems` (9); `#folder:<name>` (10); `llm.changeCompletionsModel` + `llm.completions.model` (12); image attachments + `llm.chat.vision.enabled` (14); status-bar overview `llm.showStatusOverview` + `llm.statusBar.enabled` (15). Already built: 3, 4, 6. Smoke ends ~371.

**1.99 (complete, tag `changelog-1.99`):** MCP client over stdio `src/mcp.ts` + `src/mcpManager.ts` (2); `think` tool (3); `fetch_url` + `#fetch` `src/fetchTool.ts` (4); `find_usages` + `#usages` `src/usages.ts` (5); `#newWorkspace` scaffolds `src/workspaceScaffold.ts` (6); tool approvals with session/workspace/global scope `ApprovalStore` (8); Ask/Agent/Edit mode picker (10); reusable prompt files `llm.usePrompt` `src/prompts.ts` (12); URL/bmp images (13); completions status + `llm.toggleCompletions` (16); `#searchResults` (19); explicit save on keep (23); nbformat 4.5 cell ids (27); `new_notebook` tool + `/newNotebook` (28); cell outputs to chat `llm.addCellOutput` (29). Already built: 1, 24. Smoke ends ~584.

**1.100-38 (planned, built):** MCP tool annotations — `McpToolAnnotations` + `mcpToolDisplayName` in `src/mcp.ts`, `McpManager.getToolAnnotations`, approval-gate bypass for `readOnlyHint: true` MCP tools, `displayName` on tool cards (5 slices: S-001 `src/mcp.ts`, S-002 `src/mcpManager.ts`, S-003 `ChatViewProvider.ts`, S-004 `webview.ts`, S-005 smoke 798→805).

**1.100-31 (planned, built):** notebook tools for agent mode — `run_notebook_cell`/`get_kernel_state`/`list_packages`/`install_package` + in-memory kernel state in `ToolExecutor`, pure helpers in `src/notebook.ts`, gated by `llm.chat.notebookTools.enabled` (5 slices: S-001 `src/notebook.ts`, S-002 `src/tools.ts`, S-003 `src/tools/ToolExecutor.ts`, S-004 config/presets/request/package.json, S-005 smoke 791→798).

**1.100-29 (planned, built):** generate alt text code action — pure helpers in `src/codeaction.ts` + QuickFix "Generate alt text" with one-shot vision `chatStream` resolve + `llm.codeAction.altText.enabled` (3 slices: S-001 `src/codeaction.ts`, S-002 provider + `package.json`, S-003 smoke 780→787).

**1.100-19 (planned, built):** create/launch tasks after `#newWorkspace` — `launchTask` per template + `buildTasksJson` + scaffold-prompt steps (3 slices: S-001/S-002 in `src/workspaceScaffold.ts`, S-003 smoke).

**1.100 (in progress, tag `changelog-1.100`):** done so far: instructions files `.instructions.md` with `applyTo` auto-attach, `src/instructions.ts` (1); prompt-file front matter `mode`/`tools`, `llm.runPrompt` + Play button, languages `llm.prompt`/`llm.instructions` (2); `apply_patch` tool `src/patch.ts` (3); `#fetch` as Markdown with `llm.chat.fetch.maxTokens` token trim (7). Chat input pills: `ContextPill` + `parsePillRefs`/`dedupePills` in `src/context.ts`, pill strip UI in `src/chat/webview.ts`, `postContextPills()`/`remove_pill` in `src/chat/ChatViewProvider.ts`, grouped `llm.addContext` quick-pick in `src/extension.ts` (8). Smoke 690.
