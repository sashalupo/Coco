# Planner — Progress Memory

> **This file is the agent's persistent memory.** The `Planner` agent
> (`.github/agents/planner.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Turn each changelog feature (from the Changelog Researcher's backlog) into a concrete,
step-by-step implementation plan for the `llm` VS Code extension. The planner does NOT write
code — only the Coder writes code.

## Active plan — 1.100-31 · Notebook tools for agent mode (VS Code 1.100)

- **Status:** Planned — 2026-10-23
- **Changelog:** New LLM tools for agent mode: **Run cell** (agent runs notebook cells and reacts to results), **Get kernel state** (which cells executed, active variables), **List/Install packages** (delegated to pip). No screenshots (release notes reference a video of the agent running a cell). Tooling item, no UI.
- **Approach:** 4 new tools (`run_notebook_cell`, `get_kernel_state`, `list_packages`, `install_package`) + in-memory kernel state in `ToolExecutor`. Pure helpers in `src/notebook.ts`. Gated by `llm.chat.notebookTools.enabled`.
- **Grounding (verified):**
  - `src/notebook.ts` is a **pure module** (no `vscode` import) with `parseNotebook`, `formatNotebookForContext`, `applyNotebookEdit` — the right home for new pure helpers.
  - `src/tools.ts`: `CODE_TOOLS` array (line 48) ends with `find_usages`; `isMutatingTool` (line ~525) lists `notebook_edit`/`new_notebook`.
  - `src/tools/ToolExecutor.ts`: `execute()` switch (line ~336) has `notebook_edit`/`new_notebook` cases; `runCommand` (line 766) already uses `spawn` from `child_process` with a timeout — the pattern to reuse.
  - `src/request.ts` (line ~410): tools are sent when `settings.toolsEnabled`; per-tool gating happens here.
  - `src/config.ts:85` / `src/presets.ts:118`: `newNotebookEnabled` pattern to copy.
  - Smoke gate: `scripts/smoke-test.js:6535-6539` at **791**; tool-name list asserted at lines 482 and 4318.
- **Files to touch:** `src/notebook.ts`, `src/tools.ts`, `src/tools/ToolExecutor.ts`, `src/config.ts`, `src/presets.ts`, `src/request.ts`, `package.json`, `scripts/smoke-test.js`.
- **Slices:**
  - **S-001** — `src/notebook.ts` (1 file, pure): add `extractVariableNames(source: string): string[]` (regex over `import x`/`from m import a as b`/`x = ...`/`def x`/`class X`, deduped, order-preserving) and `formatKernelState(path: string, executed: number[], variables: string[]): string` (one-line-per-cell executed summary + variable list, or "no cells executed yet"). No `vscode` import.
    - *Acceptance:* `npm run compile` passes; `src/notebook.ts` still has no `vscode` import; helpers unit-testable from the smoke test against `out/notebook.js`.
  - **S-002** — `src/tools.ts` (1 file): add 4 schemas to `CODE_TOOLS` — `run_notebook_cell` (`path`, `cell_index`; required both), `get_kernel_state` (`path`), `list_packages` (no params), `install_package` (`package`, optional `version`). Add `run_notebook_cell` and `install_package` to `isMutatingTool` (they mutate kernel state / the environment); `get_kernel_state` and `list_packages` are read-only.
    - *Acceptance:* `npm run compile` passes; all 4 names present in `CODE_TOOLS`; `isMutatingTool("run_notebook_cell")` and `isMutatingTool("install_package")` true; the two read-only ones false.
  - **S-003** — `src/tools/ToolExecutor.ts` (1 file): add 4 cases to the `execute()` switch + private methods. In-memory kernel state: `private kernelState = new Map<string, { executed: number[]; variables: string[] }>()` keyed by workspace-relative path. `runNotebookCell`: resolve path via `resolveSafe`, read `.ipynb`, `parseNotebook`, validate `cell_index` is a code cell; execute via `spawn("jupyter", ["execute", "--to", "stdout", path])` — on ENOENT fall back to `spawn("python3", ["-c", <cell source>])` (then `python`); capture stdout+stderr truncated to ~8000 chars; on success record the cell index in `executed` and merge `extractVariableNames(source)` into `variables`; return the output. `getKernelState`: return `formatKernelState(...)` from the map (empty → "no cells executed yet"). `listPackages`: `spawn("pip", ["list"])` (fallback `pip3`), truncate. `installPackage`: `spawn("pip", ["install", pkg])` with timeout, capture output. Reuse the existing `spawn` + timeout pattern from `runCommand`.
    - *Acceptance:* `npm run compile` passes; all 4 cases route; mutating tools go through the existing approval gate (they're in `isMutatingTool`).
  - **S-004** — `src/config.ts` + `src/presets.ts` + `src/request.ts` + `package.json` (4 files): new setting `llm.chat.notebookTools.enabled` (boolean, default `true`) in `package.json` (next to `llm.chat.newNotebook.enabled`); `notebookToolsEnabled` in `Settings` (`presets.ts`) + `readSettings` (`config.ts`); in `request.ts` where `body.tools` is built, filter out the 4 notebook-execution tools (`run_notebook_cell`, `get_kernel_state`, `list_packages`, `install_package`) when the gate is off (leave `notebook_edit`/`new_notebook` untouched — they have their own gate).
    - *Acceptance:* `npm run compile` passes; setting present with default `true`; with the gate off the 4 tools are absent from `body.tools` while `notebook_edit` remains.
  - **S-005** — `scripts/smoke-test.js` (1 file): new assertions — (1) tool-name list now includes the 4 new names (update the two existing list assertions at lines 482 and 4318); (2) `run_notebook_cell` required = `[path,cell_index]`; (3) `isMutatingTool` true for `run_notebook_cell`/`install_package`, false for `get_kernel_state`/`list_packages`; (4) `notebook.ts` exports `extractVariableNames` + `formatKernelState` (unit-test `extractVariableNames` on a sample cell); (5) `ToolExecutor.ts` includes `kernelState` + `jupyter`; (6) `package.json` has `llm.chat.notebookTools.enabled` (boolean, default `true`); (7) `request.ts` filters the 4 tools on the gate. Bump hard gate **791 → 798** (count check + PASS message).
    - *Acceptance:* `node scripts/smoke-test.js` passes at 798/798.
- **Acceptance criteria (whole item):** compile passes; smoke 798/798; the 4 tools appear in agent/edit mode when `llm.tools.enabled` + `llm.chat.notebookTools.enabled` are on; `run_notebook_cell` and `install_package` require approval when `llm.tools.requireApproval` is on; `get_kernel_state`/`list_packages` are read-only; no new runtime npm deps; no webview changes.
- **Risks / open questions:**
  - `jupyter` CLI may not be installed → ENOENT fallback to `python3`/`python` (safe failure: clear error message to the engine).
  - Kernel state is in-memory only (lost on extension reload) — acceptable for this item; 1.101-15 extends it later.
  - `pip` vs `pip3` vs `python -m pip` — try `pip`, fall back to `pip3`; document in the tool description.
- **Next item:** 1.100-38 · MCP Tool Annotations.

## Status

- **Current item:** 1.100-31 (planned: 5 slices — S-001 `src/notebook.ts`, S-002 `src/tools.ts`, S-003 `src/tools/ToolExecutor.ts`, S-004 config/presets/request/package.json, S-005 smoke 791→798)
- **Next step:** dispatch the Coder for 1.100-31 S-001
- **Last updated:** 2026-10-23
- **Last commit:** (planner commit for the 1.100-31 plan)
- **Build state:** n/a (planner does not build)

## Plans delivered (recap)

Each item was split into slices of ≤3 files; plans themselves are pruned (see git history).

**1.98 (complete, tag `changelog-1.98`):** editable `run_command` approval card + "modified by user" badge (1); `notebook_edit` tool, 5 actions, `src/notebook.ts`, `.ipynb` rendered as cells (2); `#codebase` sweep (8); `#problems` (9); `#folder:<name>` (10); `llm.changeCompletionsModel` + `llm.completions.model` (12); image attachments + `llm.chat.vision.enabled` (14); status-bar overview `llm.showStatusOverview` + `llm.statusBar.enabled` (15). Already built: 3, 4, 6. Smoke ends ~371.

**1.99 (complete, tag `changelog-1.99`):** MCP client over stdio `src/mcp.ts` + `src/mcpManager.ts` (2); `think` tool (3); `fetch_url` + `#fetch` `src/fetchTool.ts` (4); `find_usages` + `#usages` `src/usages.ts` (5); `#newWorkspace` scaffolds `src/workspaceScaffold.ts` (6); tool approvals with session/workspace/global scope `ApprovalStore` (8); Ask/Agent/Edit mode picker (10); reusable prompt files `llm.usePrompt` `src/prompts.ts` (12); URL/bmp images (13); completions status + `llm.toggleCompletions` (16); `#searchResults` (19); explicit save on keep (23); nbformat 4.5 cell ids (27); `new_notebook` tool + `/newNotebook` (28); cell outputs to chat `llm.addCellOutput` (29). Already built: 1, 24. Smoke ends ~584.

**1.100-29 (planned, built):** generate alt text code action — pure helpers in `src/codeaction.ts` + QuickFix "Generate alt text" with one-shot vision `chatStream` resolve + `llm.codeAction.altText.enabled` (3 slices: S-001 `src/codeaction.ts`, S-002 provider + `package.json`, S-003 smoke 780→787).

**1.100-19 (planned, built):** create/launch tasks after `#newWorkspace` — `launchTask` per template + `buildTasksJson` + scaffold-prompt steps (3 slices: S-001/S-002 in `src/workspaceScaffold.ts`, S-003 smoke).

**1.100 (in progress, tag `changelog-1.100`):** done so far: instructions files `.instructions.md` with `applyTo` auto-attach, `src/instructions.ts` (1); prompt-file front matter `mode`/`tools`, `llm.runPrompt` + Play button, languages `llm.prompt`/`llm.instructions` (2); `apply_patch` tool `src/patch.ts` (3); `#fetch` as Markdown with `llm.chat.fetch.maxTokens` token trim (7). Chat input pills: `ContextPill` + `parsePillRefs`/`dedupePills` in `src/context.ts`, pill strip UI in `src/chat/webview.ts`, `postContextPills()`/`remove_pill` in `src/chat/ChatViewProvider.ts`, grouped `llm.addContext` quick-pick in `src/extension.ts` (8). Smoke 690.
