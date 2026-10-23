# Coder — Progress Memory

> **This file is the agent's persistent memory.** The `Coder` agent
> (`.github/agents/coder.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Implement the plans produced by the Planner agent for the `llm` VS Code extension. The Coder
is the **ONLY agent that writes code**. It keeps the build green at every step and commits
after each compiling step.

## Status

- **Current item:** **1.100-10** — Autofix diagnostics from agent mode edits (4 slices)
- **Current slice:** 1.100-10.S3 DONE (bug fixed: before-snapshot now taken pre-batch)
- **Next step:** 1.100-10.S4 — smoke-test regression guards in `scripts/smoke-test.js`
- **Last updated:** 2026-10-23
- **Last commit:** fix(llm): take autofix before-snapshot pre-batch (1.100-10.S3)
- **Build state:** compiles clean; smoke 690 PASS

## Plan pointer

The current plan lives in `.github/agents/planner/PROGRESS.md`. The Coder implements it step
by step, one step per session.

## Done

Recap per version (slice detail pruned; see `git log`). Each slice compiled and passed smoke before commit.

**1.98 (complete, tag `changelog-1.98`):** editable `run_command` approval card + "modified by user" badge (1); `notebook_edit` tool, 5 actions, `src/notebook.ts`, `.ipynb` rendered as cells (2); `#codebase` sweep (8); `#problems` (9); `#folder:<name>` (10); `llm.changeCompletionsModel` + `llm.completions.model` (12); image attachments + `llm.chat.vision.enabled` (14); status-bar overview `llm.showStatusOverview` + `llm.statusBar.enabled` (15). Already built: 3, 4, 6. Smoke ends ~371.

**1.99 (complete, tag `changelog-1.99`):** MCP client over stdio `src/mcp.ts` + `src/mcpManager.ts` (2); `think` tool (3); `fetch_url` + `#fetch` `src/fetchTool.ts` (4); `find_usages` + `#usages` `src/usages.ts` (5); `#newWorkspace` scaffolds `src/workspaceScaffold.ts` (6); tool approvals with session/workspace/global scope `ApprovalStore` (8); Ask/Agent/Edit mode picker (10); reusable prompt files `llm.usePrompt` `src/prompts.ts` (12); URL/bmp images (13); completions status + `llm.toggleCompletions` (16); `#searchResults` (19); explicit save on keep (23); nbformat 4.5 cell ids (27); `new_notebook` tool + `/newNotebook` (28); cell outputs to chat `llm.addCellOutput` (29). Already built: 1, 24. Smoke ends ~584.

**1.100 (in progress, tag `changelog-1.100`):** done so far: instructions files `.instructions.md` with `applyTo` auto-attach, `src/instructions.ts` (1); prompt-file front matter `mode`/`tools`, `llm.runPrompt` + Play button, languages `llm.prompt`/`llm.instructions` (2); `apply_patch` tool `src/patch.ts` (3); `#fetch` as Markdown with `llm.chat.fetch.maxTokens` token trim (7); **1.100-8.S1:** `ContextPill` interface + pure `parsePillRefs`/`dedupePills` in `src/context.ts` (reuses `@`-tag and `#folder` regexes); **1.100-8.S2:** pill strip UI in `src/chat/webview.ts` — `.pill-strip`/`.pill`/`.pill-remove` CSS, `#pill-strip` above input, local `ContextPill` mirror (webview is a self-contained bundle), `renderPillStrip()`, `context_pills` host msg, `remove_pill` postMessage, pills cleared on `clear`. **1.100-8.S3:** host pill consumption in `src/chat/ChatViewProvider.ts` — `pendingPills` state, `postContextPills()` (posts `context_pills`), `removePill()` for `remove_pill` msgs, pills parsed from `send` text via `parsePillRefs`/`dedupePills`, consumed in `runStream` (file pills → `ctxInput.taggedFiles`, folder pills → `folderSweep`), cleared on new chat/switch/ready. **1.100-8.S4:** `llm.addContext` command in `src/extension.ts` — two-step quick pick (category → item) with groups Files (findFiles, cap 20) / Folders (workspace folders, cap 20) / Selection (active editor) / Problems (getDiagnostics, cap 10); inserts refs via a new `context_inject` webview message (webview.ts case added; the 1.100-2.S5 smoke guard forbids the literal `prompt_inject` in extension.ts) — files → `@<rel path>`, folders → `#folder:<name>`, selection → `@<rel path>`, problems → `#problems`; `package.json` command contribution "LLM: Add Context to Chat" (no keybinding); **1.100-8.S5:** smoke regression guards in `scripts/smoke-test.js` — no Done button in input row / no `#done` element, Enter (no Shift) → `doSend()`, New Chat only (`#new-chat` + `#quick-new-chat` exist, no session-reset control in input row), pure-function tests of `parsePillRefs`/`dedupePills` from `out/context.js`, pill pipeline presence (`context_pills` case + `remove_pill` + `renderPillStrip` in webview, `postContextPills` + `remove_pill` case in `ChatViewProvider.ts`, `llm.addContext` registered + contributed). Smoke 690. **Item 1.100-8 COMPLETE.** **1.100-10.S1:** `llm.agent.autoFix` setting (default true) — `LlmSettings.agentAutoFix` in `presets.ts`, read in `config.ts` `readSettings()`, `package.json` schema entry.

## Todo

- [x] 1.100-8.S2 — pill strip UI in `src/chat/webview.ts`
- [x] 1.100-8.S3 — host consumes `send.pills` into `ctxInput` + `postContextPills()` in `src/chat/ChatViewProvider.ts`
- [x] 1.100-8.S4 — `llm.addContext` grouped quick-pick in `src/extension.ts` + `package.json`
- [x] 1.100-8.S5 — smoke-test regression guards in `scripts/smoke-test.js`
- [x] 1.100-10.S1 — `llm.agent.autoFix` setting (default true): `presets.ts` `LlmSettings.agentAutoFix`, `config.ts` read, `package.json` schema
- [x] 1.100-10.S2 — pure exported `newDiagnostics(before, after)` + `DiagnosticLike` in `src/tools/ToolExecutor.ts` (key `severity|startLine|startChar|message`; vscode-independent; importable via `out/tools/ToolExecutor.js` under the existing `Module._load` vscode stub)
- [x] 1.100-10.S3 — agent-loop autofix hook in `src/chat/ChatViewProvider.ts` (cap 2 rounds): `MAX_AUTOFIX_ROUNDS = 2`, `autoFixRounds` reset next to `clearChangeSummary()`, post-batch hook in the `for(;;)` loop — `autofixEditedPaths(toolCalls)` (write_file/edit_file/apply_patch/notebook_edit `path` args, deduped), `autofixSnapshot(relPaths)` (vscode.languages.getDiagnostics per file URI, `DiagnosticLike` shape), 500 ms settle, `newDiagnostics(before, after)` diff; new problems + `settings.agentAutoFix` + rounds < 2 → injected system message ("New problems appeared in <files>: <text> Fix them.") + `[auto-fix n/2]` delta note + loop continues; past cap → `[new problems remain]` delta only. Helpers `autofixEditedPaths`/`autofixSnapshot`/`formatNewDiagnostics` (10-entry cap) at file bottom. **Fix (Tester-found bug):** the `before` snapshot was originally taken AFTER the batch loop, so the diff only caught diagnostics appearing in the 500 ms post-batch window and missed problems the edits themselves introduced. Now `editedPaths` + `before` snapshot are computed BEFORE the `for (const call of toolCalls)` batch loop; the settle + `after` snapshot + diff + system-message/delta logic stays post-batch.
- [ ] 1.100-10.S4 — smoke-test regression guards in `scripts/smoke-test.js`

## Notes / decisions

- The Coder is the ONLY agent that writes code.
- One step per session. Each step independently compiles and commits.
- No runtime npm dependencies. No bundler. Stay minimal.
- Always update this file in the same commit as the code it describes.
