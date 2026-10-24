# Planner — Progress Memory

> **This file is the agent's persistent memory.** The `Planner` agent
> (`.github/agents/planner.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Turn each changelog feature (from the Changelog Researcher's backlog) into a concrete,
step-by-step implementation plan for the `llm` VS Code extension. The planner does NOT write
code — only the Coder writes code.

## Active plan — 1.101-1 · Chat tool sets (VS Code 1.101)

- **Status:** Planned — 2026-10-24
- **Changelog:** VS Code 1.101 — define **tool sets** (grouped tool collections) via a JSON config file; reference a set in chat by `#toolset-name` or the tool picker; enable/disable whole groups in agent mode. Screenshot: `#gh-news` set highlighted in chat + JSON config. Relevance: keep (capability/context) — tool management.
- **Approach:** New pure module `src/toolsets.ts` parses `.vscode/toolsets.json`; `#toolset:<name>` tag + toolbar "Tools" select both feed the EXISTING `RequestConfig.promptTools` filter in `buildRequestBody` — no request-shape change. Precedence: `#toolset:` tag > toolbar picker > prompt-file `pendingPromptTools`. Command `llm.toolsets.createFile` scaffolds the file. Setting `llm.toolsets.enabled` (default true) gates tag + picker.
- **Files to touch:** `src/toolsets.ts` (new), `src/context.ts`, `src/presets.ts`, `src/config.ts`, `src/chat/ChatViewProvider.ts`, `src/chat/webview.ts`, `package.json`, `src/extension.ts`, `scripts/smoke-test.js`.
- **Slices:**
  - **S-001** — `src/toolsets.ts` (1 file, new, pure): `Toolset`/`ToolsetsFile` interfaces; `parseToolsetsJson(text) → { toolsets, errors }`; `resolveToolset(toolsets, name) → string[] | null` (case-insensitive); `buildToolsetsExample()`. No `vscode` import.
  - **S-002** — `src/context.ts` (1 file): `extractToolsetTag(text) → string | null`; `ContextPill.kind` += `"toolset"`; `parsePillRefs` recognizes `#toolset:`.
  - **S-003** — `src/presets.ts` + `src/config.ts` (2 files): `toolsetsEnabled: boolean` in `LlmSettings` (default `true`); read `llm.toolsets.enabled`.
  - **S-004** — `src/chat/ChatViewProvider.ts` (1 file): `#toolset:` tag → `promptTools`; `pendingToolset` from toolbar; unknown/empty set → error.
  - **S-005** — `src/chat/webview.ts` (1 file): "Tools" `<select>` in toolbar; `toolsets` host message; `postToolbar()` includes `toolset`; `#toolset:` pills.
  - **S-006** — `package.json` (1 file): `llm.toolsets.enabled` + command `llm.toolsets.createFile`.
  - **S-007** — `src/extension.ts` (1 file): register `llm.toolsets.createFile`.
  - **S-008** — `scripts/smoke-test.js` (1 file): assertions; gate **806 → 813** (gate moved 805→806 by the S-005 webview script-parse check).
- **Acceptance criteria (whole item):** compile passes; smoke 813/813; `#toolset:<name>` and toolbar picker restrict `body.tools` via `promptTools`; tag > picker > prompt-file; unknown/empty set → error; `llm.toolsets.createFile` scaffolds; `llm.toolsets.enabled: false` disables; no new deps.
- **Risks:** Empty `tools` array → error; no file watcher (re-read per send); MCP tool names filterable via sets.
- **Next item:** (none recorded).

## Status

- **Current item:** 1.101-1 (planned: 8 slices)
- **Next step:** dispatch the Coder for 1.101-1 S-001
- **Last updated:** 2026-10-24
- **Last commit:** (planner commit for the 1.101-1 plan)
- **Build state:** n/a (planner does not build)

## Plans delivered (recap)

Each item was split into slices of ≤3 files; plans themselves are pruned (see git history).

**1.98 (complete, tag `changelog-1.98`):** editable `run_command` approval card + "modified by user" badge (1); `notebook_edit` tool, 5 actions, `src/notebook.ts`, `.ipynb` rendered as cells (2); `#codebase` sweep (8); `#problems` (9); `#folder:<name>` (10); `llm.changeCompletionsModel` + `llm.completions.model` (12); image attachments + `llm.chat.vision.enabled` (14); status-bar overview `llm.showStatusOverview` + `llm.statusBar.enabled` (15). Already built: 3, 4, 6. Smoke ends ~371.

**1.99 (complete, tag `changelog-1.99`):** MCP client over stdio `src/mcp.ts` + `src/mcpManager.ts` (2); `think` tool (3); `fetch_url` + `#fetch` `src/fetchTool.ts` (4); `find_usages` + `#usages` `src/usages.ts` (5); `#newWorkspace` scaffolds `src/workspaceScaffold.ts` (6); tool approvals with session/workspace/global scope `ApprovalStore` (8); Ask/Agent/Edit mode picker (10); reusable prompt files `llm.usePrompt` `src/prompts.ts` (12); URL/bmp images (13); completions status + `llm.toggleCompletions` (16); `#searchResults` (19); explicit save on keep (23); nbformat 4.5 cell ids (27); `new_notebook` tool + `/newNotebook` (28); cell outputs to chat `llm.addCellOutput` (29). Already built: 1, 24. Smoke ends ~584.

**1.100-38 (planned, built):** MCP tool annotations — `McpToolAnnotations` + `mcpToolDisplayName` in `src/mcp.ts`, `McpManager.getToolAnnotations`, approval-gate bypass for `readOnlyHint: true` MCP tools, `displayName` on tool cards (5 slices: S-001 `src/mcp.ts`, S-002 `src/mcpManager.ts`, S-003 `ChatViewProvider.ts`, S-004 `webview.ts`, S-005 smoke 798→805).

**1.100-31 (planned, built):** notebook tools for agent mode — `run_notebook_cell`/`get_kernel_state`/`list_packages`/`install_package` + in-memory kernel state in `ToolExecutor`, pure helpers in `src/notebook.ts`, gated by `llm.chat.notebookTools.enabled` (5 slices: S-001 `src/notebook.ts`, S-002 `src/tools.ts`, S-003 `src/tools/ToolExecutor.ts`, S-004 config/presets/request/package.json, S-005 smoke 791→798).

**1.100-29 (planned, built):** generate alt text code action — pure helpers in `src/codeaction.ts` + QuickFix "Generate alt text" with one-shot vision `chatStream` resolve + `llm.codeAction.altText.enabled` (3 slices: S-001 `src/codeaction.ts`, S-002 provider + `package.json`, S-003 smoke 780→787).

**1.100-19 (planned, built):** create/launch tasks after `#newWorkspace` — `launchTask` per template + `buildTasksJson` + scaffold-prompt steps (3 slices: S-001/S-002 in `src/workspaceScaffold.ts`, S-003 smoke).

**1.100 (in progress, tag `changelog-1.100`):** done so far: instructions files `.instructions.md` with `applyTo` auto-attach, `src/instructions.ts` (1); prompt-file front matter `mode`/`tools`, `llm.runPrompt` + Play button, languages `llm.prompt`/`llm.instructions` (2); `apply_patch` tool `src/patch.ts` (3); `#fetch` as Markdown with `llm.chat.fetch.maxTokens` token trim (7). Chat input pills: `ContextPill` + `parsePillRefs`/`dedupePills` in `src/context.ts`, pill strip UI in `src/chat/webview.ts`, `postContextPills()`/`remove_pill` in `src/chat/ChatViewProvider.ts`, grouped `llm.addContext` quick-pick in `src/extension.ts` (8). Smoke 690.
