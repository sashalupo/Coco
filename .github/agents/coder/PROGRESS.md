# Coder — Progress Memory

> **This file is the agent's persistent memory.** The `Coder` agent
> (`.github/agents/coder.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Implement the plans produced by the Planner agent for the `llm` VS Code extension. The Coder
is the **ONLY agent that writes code**. It keeps the build green at every step and commits
after each compiling step.

## Status

- **Current item:** 1.100-31 · Notebook tools for agent mode — COMPLETE (S-001..S-005 done)
- **Current slice:** 1.100-31.S-005 DONE (1 file: `scripts/smoke-test.js` — new section 29 `nbtools-s1..s6`: `run_notebook_cell` schema required `["path","cell_index"]` from `out/tools.js`; `isMutatingTool` true for `run_notebook_cell`/`install_package`, false for `get_kernel_state`/`list_packages`; `out/notebook.js` exports `extractVariableNames`+`formatKernelState` and `extractVariableNames` unit test → `["np","x","foo","Bar"]`; `src/tools/ToolExecutor.ts` source contains `kernelState`+`jupyter`; `package.json` has `llm.chat.notebookTools.enabled` (boolean, default true); `src/request.ts` contains `notebookToolsEnabled`+`run_notebook_cell` gate. Count gate bumped 791→798. Verified: tsc exit 0; smoke 798/798 PASS). Not committed — orchestrator commits.
- **Next step:** Tester verification of item 1.100-31
- **Last updated:** 2026-10-24
- **Last commit:** 504abbf (1.100-31 S-001, verified PASS)
- **Build state:** compiles clean (tsc exit 0, verified 2026-10-24); smoke 798/798 (verified 2026-10-24, S-005)

## Plan pointer

The current plan lives in `.github/agents/planner/PROGRESS.md`. The Coder implements it step
by step, one step per session.

## Done

Recap per version (slice detail pruned; see `git log`). Each slice compiled and passed smoke before commit.

**1.98 (complete, tag `changelog-1.98`):** editable `run_command` approval card + "modified by user" badge (1); `notebook_edit` tool, 5 actions, `src/notebook.ts`, `.ipynb` rendered as cells (2); `#codebase` sweep (8); `#problems` (9); `#folder:<name>` (10); `llm.changeCompletionsModel` + `llm.completions.model` (12); image attachments + `llm.chat.vision.enabled` (14); status-bar overview `llm.showStatusOverview` + `llm.statusBar.enabled` (15). Already built: 3, 4, 6. Smoke ends ~371.

**1.99 (complete, tag `changelog-1.99`):** MCP client over stdio `src/mcp.ts` + `src/mcpManager.ts` (2); `think` tool (3); `fetch_url` + `#fetch` `src/fetchTool.ts` (4); `find_usages` + `#usages` `src/usages.ts` (5); `#newWorkspace` scaffolds `src/workspaceScaffold.ts` (6); tool approvals with session/workspace/global scope `ApprovalStore` (8); Ask/Agent/Edit mode picker (10); reusable prompt files `llm.usePrompt` `src/prompts.ts` (12); URL/bmp images (13); completions status + `llm.toggleCompletions` (16); `#searchResults` (19); explicit save on keep (23); nbformat 4.5 cell ids (27); `new_notebook` tool + `/newNotebook` (28); cell outputs to chat `llm.addCellOutput` (29). Already built: 1, 24. Smoke ends ~584.

**1.100 (in progress, tag `changelog-1.100`):** done so far: instructions files `.instructions.md` with `applyTo` auto-attach, `src/instructions.ts` (1); prompt-file front matter `mode`/`tools`, `llm.runPrompt` + Play button, languages `llm.prompt`/`llm.instructions` (2); `apply_patch` tool `src/patch.ts` (3); `#fetch` as Markdown with `llm.chat.fetch.maxTokens` token trim (7); **1.100-8.S1:** `ContextPill` interface + pure `parsePillRefs`/`dedupePills` in `src/context.ts` (reuses `@`-tag and `#folder` regexes); **1.100-8.S2:** pill strip UI in `src/chat/webview.ts` — `.pill-strip`/`.pill`/`.pill-remove` CSS, `#pill-strip` above input, local `ContextPill` mirror (webview is a self-contained bundle), `renderPillStrip()`, `context_pills` host msg, `remove_pill` postMessage, pills cleared on `clear`. **1.100-8.S3:** host pill consumption in `src/chat/ChatViewProvider.ts` — `pendingPills` state, `postContextPills()` (posts `context_pills`), `removePill()` for `remove_pill` msgs, pills parsed from `send` text via `parsePillRefs`/`dedupePills`, consumed in `runStream` (file pills → `ctxInput.taggedFiles`, folder pills → `folderSweep`), cleared on new chat/switch/ready. **1.100-8.S4:** `llm.addContext` command in `src/extension.ts` — two-step quick pick (category → item) with groups Files (findFiles, cap 20) / Folders (workspace folders, cap 20) / Selection (active editor) / Problems (getDiagnostics, cap 10); inserts refs via a new `context_inject` webview message (webview.ts case added; the 1.100-2.S5 smoke guard forbids the literal `prompt_inject` in extension.ts) — files → `@<rel path>`, folders → `#folder:<name>`, selection → `@<rel path>`, problems → `#problems`; `package.json` command contribution "LLM: Add Context to Chat" (no keybinding); **1.100-8.S5:** smoke regression guards in `scripts/smoke-test.js` — no Done button in input row / no `#done` element, Enter (no Shift) → `doSend()`, New Chat only (`#new-chat` + `#quick-new-chat` exist, no session-reset control in input row), pure-function tests of `parsePillRefs`/`dedupePills` from `out/context.js`, pill pipeline presence (`context_pills` case + `remove_pill` + `renderPillStrip` in webview, `postContextPills` + `remove_pill` case in `ChatViewProvider.ts`, `llm.addContext` registered + contributed). Smoke 690. **Item 1.100-8 COMPLETE.** **1.100-10.S1:** `llm.agent.autoFix` setting (default true) — `LlmSettings.agentAutoFix` in `presets.ts`, read in `config.ts` `readSettings()`, `package.json` schema entry.

## Todo

Slice detail pruned (see `git log` for full history). Recent items:
- 1.100-31 complete (smoke 798): notebook tools for agent mode — S-001 `extractVariableNames` + `formatKernelState` in `src/notebook.ts` (pure, no vscode import); S-002 `src/tools.ts` — 4 new `CODE_TOOLS` schemas (`run_notebook_cell` {path, cell_index}, `get_kernel_state` {path}, `list_packages` {}, `install_package` {package, version?}); `isMutatingTool` true only for `run_notebook_cell`+`install_package`; S-003 `src/tools/ToolExecutor.ts` — 4 switch cases + private methods (`runNotebookCell` jupyter→python3→python fallback + kernel-state recording, `getKernelState`, `listPackages`/`installPackage` pip→pip3, `spawnToolCommand` helper, `kernelState` Map); S-004 `package.json`+`src/presets.ts`+`src/config.ts`+`src/request.ts` — `llm.chat.notebookTools.enabled` (boolean, default `true`) + `body.tools` filter dropping the 4 execution tools when explicitly `false` (`notebook_edit`/`new_notebook` untouched); S-005 `scripts/smoke-test.js` — `nbtools-s1..s6` guards + count gate 791→798.
- 1.100-30 complete (smoke 791): drag and drop cell outputs to chat — S-001 `extractNotebookCellOutput` + `NotebookCellOutputLike` in `src/notebook.ts` (pure, no vscode import; affc774); S-002 `registerDragAndDropController` (viewContainerId `llm`, mime `notebook.cellOutput`) in `src/extension.ts` — Alt rule for text-only drops, vision gate, per-item try/catch, reuses `cell_output_inject`; `llm.chat.cellOutputDrop.enabled` setting; local `declare module "vscode"` shim (pinned @types/vscode 1.140.0 predates the API; 26efb84); S-003 smoke guards `drop-s1..s4` in `scripts/smoke-test.js` (controller + viewContainerId, mime + Alt rule, `extractNotebookCellOutput`, setting boolean default true), gate 787→791.
- 1.100-29 complete (smoke 787): alt-text code action (S-001 `src/codeaction.ts`, S-002 `CodeActionProvider.ts`+`package.json`, S-003 smoke).
- 1.100-19 complete (smoke 780): workspace tasks.json scaffold.
- 1.100-16 complete (smoke 774): MCP server inputs/secret detection.
- 1.100-15 complete (smoke 766): MCP progress notifications.
- 1.100-14 complete (smoke 758): MCP image results.
- 1.100-13 complete (smoke 750): MCP Streamable HTTP transport.
- 1.100-12 complete (smoke 736): conversation summarization.
- 1.100-11 complete (smoke 714): manual-edit tracking.
- 1.100-10 complete (smoke 701): agent auto-fix.
- 1.100-8 complete: context pills + `llm.addContext`.

## Notes / decisions

- The Coder is the ONLY agent that writes code.
- One step per session. Each step independently compiles and commits.
- No runtime npm dependencies. No bundler. Stay minimal.
- Always update this file in the same commit as the code it describes.
