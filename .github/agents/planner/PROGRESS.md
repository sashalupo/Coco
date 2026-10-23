# Planner — Progress Memory

> **This file is the agent's persistent memory.** The `Planner` agent
> (`.github/agents/planner.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Turn each changelog feature (from the Changelog Researcher's backlog) into a concrete,
step-by-step implementation plan for the `llm` VS Code extension. The planner does NOT write
code — only the Coder writes code.

## Active plan — 1.100-38 · MCP Tool Annotations (human-readable names, `readOnlyHint` auto-approve) (VS Code 1.100)

- **Status:** Planned — 2026-10-24
- **Changelog:** VS Code displays human-readable names from MCP **tool annotations**; tools marked `readOnlyHint: true` run **without user confirmation**. No screenshots. Relevance: keep (capability/context) — read-only MCP tools should not need the approval gate.
- **Approach:** Read `annotations` (`title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) from `tools/list` into `McpTool`; pure `mcpToolDisplayName()` helper; `McpManager.getToolAnnotations()`; agent loop bypasses the approval gate for `readOnlyHint: true` MCP tools (still gated otherwise); human-readable name passed via `tool_start`/`tool_result` and rendered in the webview tool card.
- **Grounding (verified):**
  - `src/mcp.ts`: `McpTool` (line ~33) has no `annotations` field; `McpClient.start()`/`McpHttpClient.start()` assign `this.tools` from the raw `tools/list` result (annotations flow through once the type is extended); `parseMcpToolName` (line 690), `isMcpToolName` (~717), `mcpToolsToOpenAITools` (line 720).
  - `src/mcpManager.ts`: `McpClientLike` (line ~24); `getServerTools(name)` (line ~215) is the pattern to copy; `execute()` (line ~240).
  - `src/chat/ChatViewProvider.ts`: approval gate lines 1668–1765 — `isMutating = isMutatingTool(name) || isMcpToolName(name)` (~1674); gate condition `settings.requireApproval && isMutating && !settings.autoApprove && !approvalStore.isApproved(...)` (~1681); `tool_start` posted ~1769 with `{ id, tool, args }`; `tool_result` posted after execution.
  - `src/chat/webview.ts`: `tool_start` case (line 2517) renders `msg.tool` into `.tool-name`; `tool_result` fallback card (line 2554) does the same.
  - Smoke gate: `scripts/smoke-test.js:6597-6601` at **798**; MCP assertions around lines 2516–2866 and 6074–6170.
- **Files to touch:** `src/mcp.ts`, `src/mcpManager.ts`, `src/chat/ChatViewProvider.ts`, `src/chat/webview.ts`, `scripts/smoke-test.js`.
- **Slices:**
  - **S-001** — `src/mcp.ts` (1 file, pure): add `McpToolAnnotations` interface (`title?: string`, `readOnlyHint?`, `destructiveHint?`, `idempotentHint?`, `openWorldHint?` — optional booleans); add `annotations?: McpToolAnnotations` to `McpTool`; add pure `mcpToolDisplayName(tool: McpTool): string` (non-empty `annotations.title`, else `tool.name`). No `vscode` import.
    - *Acceptance:* `npm run compile` passes; `mcpToolDisplayName({name:"read"})` → `"read"`; with `annotations:{title:"Read File"}` → `"Read File"`; empty-string title falls back to name.
  - **S-002** — `src/mcpManager.ts` (1 file): add `getToolAnnotations(openaiName: string): McpToolAnnotations | null` — `parseMcpToolName` → `getServerTools(server)` → find tool by `name` → `tool.annotations ?? null`; null for non-MCP names or unknown server/tool. Import `McpToolAnnotations` from `./mcp`.
    - *Acceptance:* `npm run compile` passes; returns annotations for a running server's tool; `null` for `read_file` / unknown server / unknown tool.
  - **S-003** — `src/chat/ChatViewProvider.ts` (1 file): in the tool-call loop compute `const mcpAnnotations = isMcpToolName(call.function.name) ? this.mcpManager.getToolAnnotations(call.function.name) : null;` and `const displayName = mcpAnnotations?.title || call.function.name;`. Gate condition gains `&& !(mcpAnnotations?.readOnlyHint === true)` so read-only MCP tools skip approval (non-read-only MCP tools and built-in mutating tools unchanged). Add `displayName` to the `tool_start` and `tool_result` postMessage payloads.
    - *Acceptance:* `npm run compile` passes; `readOnlyHint: true` MCP tool runs with no approval card when `llm.tools.requireApproval` is on; non-read-only MCP tool still shows the card; built-in mutating tools unchanged.
  - **S-004** — `src/chat/webview.ts` (1 file): in the `tool_start` case (line ~2517) and the `tool_result` fallback card (line ~2554), render `msg.displayName || msg.tool || 'tool'` into `.tool-name`.
    - *Acceptance:* `npm run compile` passes; tool card shows the annotation `title` when present, else the raw name.
  - **S-005** — `scripts/smoke-test.js` (1 file): new assertions — (1) `mcpToolDisplayName` fallback + title cases; (2) `McpTool` accepts `annotations` (sample object through `mcpToolsToOpenAITools`); (3) `McpManager.getToolAnnotations` returns annotations for a running mock server's tool and `null` for non-MCP/unknown names; (4) static refs: `ChatViewProvider.ts` contains `getToolAnnotations` + `readOnlyHint` + `displayName`; (5) static refs: `webview.ts` contains `msg.displayName`. Bump hard gate **798 → 805** (count check + PASS message at lines 6597–6601).
    - *Acceptance:* `node scripts/smoke-test.js` passes at 805/805.
- **Acceptance criteria (whole item):** compile passes; smoke 805/805; MCP tools with `readOnlyHint: true` execute without the approval gate while `llm.tools.requireApproval` still gates non-read-only MCP tools and all built-in mutating tools; tool progress cards show the annotation `title` when present; no new runtime npm deps; no changes to the `tools/list` request shape.
- **Risks / open questions:**
  - `readOnlyHint` is advisory per the MCP spec — we treat `true` as a hard bypass; tools omitting annotations keep today's always-gated behavior.
  - `destructiveHint`/`idempotentHint`/`openWorldHint` are parsed and stored but not acted on (no UI surface specified); available for future items.
  - `displayName` is computed per call from the live manager; if a server restarts mid-session and drops annotations, the card falls back to the raw name (safe degradation).
- **Next item:** (none recorded — next backlog item to be assigned by the orchestrator).

## Status

- **Current item:** 1.100-38 (planned: 5 slices — S-001 `src/mcp.ts`, S-002 `src/mcpManager.ts`, S-003 `src/chat/ChatViewProvider.ts`, S-004 `src/chat/webview.ts`, S-005 smoke 798→805)
- **Next step:** dispatch the Coder for 1.100-38 S-001
- **Last updated:** 2026-10-24
- **Last commit:** (planner commit for the 1.100-38 plan)
- **Build state:** n/a (planner does not build)

## Plans delivered (recap)

Each item was split into slices of ≤3 files; plans themselves are pruned (see git history).

**1.98 (complete, tag `changelog-1.98`):** editable `run_command` approval card + "modified by user" badge (1); `notebook_edit` tool, 5 actions, `src/notebook.ts`, `.ipynb` rendered as cells (2); `#codebase` sweep (8); `#problems` (9); `#folder:<name>` (10); `llm.changeCompletionsModel` + `llm.completions.model` (12); image attachments + `llm.chat.vision.enabled` (14); status-bar overview `llm.showStatusOverview` + `llm.statusBar.enabled` (15). Already built: 3, 4, 6. Smoke ends ~371.

**1.99 (complete, tag `changelog-1.99`):** MCP client over stdio `src/mcp.ts` + `src/mcpManager.ts` (2); `think` tool (3); `fetch_url` + `#fetch` `src/fetchTool.ts` (4); `find_usages` + `#usages` `src/usages.ts` (5); `#newWorkspace` scaffolds `src/workspaceScaffold.ts` (6); tool approvals with session/workspace/global scope `ApprovalStore` (8); Ask/Agent/Edit mode picker (10); reusable prompt files `llm.usePrompt` `src/prompts.ts` (12); URL/bmp images (13); completions status + `llm.toggleCompletions` (16); `#searchResults` (19); explicit save on keep (23); nbformat 4.5 cell ids (27); `new_notebook` tool + `/newNotebook` (28); cell outputs to chat `llm.addCellOutput` (29). Already built: 1, 24. Smoke ends ~584.

**1.100-31 (planned, built):** notebook tools for agent mode — `run_notebook_cell`/`get_kernel_state`/`list_packages`/`install_package` + in-memory kernel state in `ToolExecutor`, pure helpers in `src/notebook.ts`, gated by `llm.chat.notebookTools.enabled` (5 slices: S-001 `src/notebook.ts`, S-002 `src/tools.ts`, S-003 `src/tools/ToolExecutor.ts`, S-004 config/presets/request/package.json, S-005 smoke 791→798).

**1.100-29 (planned, built):** generate alt text code action — pure helpers in `src/codeaction.ts` + QuickFix "Generate alt text" with one-shot vision `chatStream` resolve + `llm.codeAction.altText.enabled` (3 slices: S-001 `src/codeaction.ts`, S-002 provider + `package.json`, S-003 smoke 780→787).

**1.100-19 (planned, built):** create/launch tasks after `#newWorkspace` — `launchTask` per template + `buildTasksJson` + scaffold-prompt steps (3 slices: S-001/S-002 in `src/workspaceScaffold.ts`, S-003 smoke).

**1.100 (in progress, tag `changelog-1.100`):** done so far: instructions files `.instructions.md` with `applyTo` auto-attach, `src/instructions.ts` (1); prompt-file front matter `mode`/`tools`, `llm.runPrompt` + Play button, languages `llm.prompt`/`llm.instructions` (2); `apply_patch` tool `src/patch.ts` (3); `#fetch` as Markdown with `llm.chat.fetch.maxTokens` token trim (7). Chat input pills: `ContextPill` + `parsePillRefs`/`dedupePills` in `src/context.ts`, pill strip UI in `src/chat/webview.ts`, `postContextPills()`/`remove_pill` in `src/chat/ChatViewProvider.ts`, grouped `llm.addContext` quick-pick in `src/extension.ts` (8). Smoke 690.
