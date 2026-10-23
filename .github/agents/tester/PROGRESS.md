# Tester — Progress Memory

> **This file is the agent's persistent memory.** The `Tester` agent
> (`.github/agents/tester.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Verify that the Coder's implementation of each changelog feature compiles cleanly and behaves
correctly. The tester does NOT write code — it runs the build, the smoke test, and the
acceptance checks, and reports a clear pass/fail.

## Status

- **Current item:** 1.100-10 (complete) — S1, S2, S3, S4 all verified PASS
- **Next step:** item 1.100-10 done; next changelog item per backlog (oldest to newest)
- **Last updated:** 2026-10-23
- **Last commit:** ede4d2c (1.100-10.S4 smoke guards, verified PASS)
- **Build state:** compiles clean; smoke 701/701 PASS (verified 2026-10-23)

## Verified (recap)

All slices PASS (build exit 0 + full smoke, scope check via `git status`). Detail pruned.

**1.98 (complete, tag `changelog-1.98`):** editable `run_command` approval card + "modified by user" badge (1); `notebook_edit` tool, 5 actions, `src/notebook.ts`, `.ipynb` rendered as cells (2); `#codebase` sweep (8); `#problems` (9); `#folder:<name>` (10); `llm.changeCompletionsModel` + `llm.completions.model` (12); image attachments + `llm.chat.vision.enabled` (14); status-bar overview `llm.showStatusOverview` + `llm.statusBar.enabled` (15). Already built: 3, 4, 6. Smoke ends ~371.

**1.99 (complete, tag `changelog-1.99`):** MCP client over stdio `src/mcp.ts` + `src/mcpManager.ts` (2); `think` tool (3); `fetch_url` + `#fetch` `src/fetchTool.ts` (4); `find_usages` + `#usages` `src/usages.ts` (5); `#newWorkspace` scaffolds `src/workspaceScaffold.ts` (6); tool approvals with session/workspace/global scope `ApprovalStore` (8); Ask/Agent/Edit mode picker (10); reusable prompt files `llm.usePrompt` `src/prompts.ts` (12); URL/bmp images (13); completions status + `llm.toggleCompletions` (16); `#searchResults` (19); explicit save on keep (23); nbformat 4.5 cell ids (27); `new_notebook` tool + `/newNotebook` (28); cell outputs to chat `llm.addCellOutput` (29). Already built: 1, 24. Smoke ends ~584.

**1.100-8.S1** (2026-10-23) — PASS. `ContextPill` model + `parsePillRefs`/`dedupePills` pure helpers in `src/context.ts` (no `vscode` import in file). Behavior verified via `node -e` on `out/context.js`: `@src/a.ts` → file pill, `#folder:src` → folder pill; dedupe keeps existing-first order, drops by kind+path. Build exit 0; smoke 675/675.

**1.100-8.S2** (2026-10-23) — PASS. Pill strip UI in `src/chat/webview.ts` (commit 1131053): `#pill-strip` container above input; `renderPillStrip(pills)` renders icon+label+× remove button, hides strip when empty; `context_pills` host msg stores pills + re-renders; × posts `remove_pill` with pill id; pills cleared on `clear`; CSS uses existing theme vars (`--input-bg`, `--fg`, `--border`, `--muted`, `--think-bg`). Scope clean: commit touches only `src/chat/webview.ts` + coder memory. Build exit 0; smoke 675/675.

**1.100-8.S3** (2026-10-23) — PASS. Host-side pill consumption in `src/chat/ChatViewProvider.ts` (commit 120a210): `pendingPills: ContextPill[]` host state; `postContextPills()` posts `{ type: 'context_pills', pills }` and is called on webview ready, `send`, `remove_pill`, new chat/clear, and conversation switch; `remove_pill` handled via `removePill(id)` (filter by id, re-post, no-op on unknown id); on `send` input parsed via `parsePillRefs`/`dedupePills` (imported from `src/context.ts`), file pills read into `ctxInput.taggedFiles` (via `resolveSafe` + `readFile`), folder pills swept via `toolExecutor.folderSweep` gated on `settings.folderContextEnabled`; pill list cleared + re-posted after send. Scope clean: commit touches only `src/chat/ChatViewProvider.ts` + coder memory. Build exit 0; smoke 675/675.

**1.100-8.S4** (2026-10-23) — PASS. `llm.addContext` grouped context quick-pick in `src/extension.ts` (commit 0f5f441): two-step quick pick (category → item); groups Files (`findFiles` cap 20), Folders (workspace folders cap 20), Selection (active editor non-empty selection), Problems (diagnostics cap 10); empty groups omitted; refs injected via new `context_inject` webview msg (files/selection → `@<rel path>`, folders → `#folder:<name>`, problems → `#problems`) — coder correctly avoided `prompt_inject` in extension.ts (smoke guard line 3748 forbids it); `src/chat/webview.ts` handles `context_inject` by prepending to input + focus; `package.json` contributes `llm.addContext` "LLM: Add Context to Chat" with `$(add)` icon. Scope clean: commit touches only `src/extension.ts`, `src/chat/webview.ts`, `package.json` + coder memory; no `scripts/smoke-test.js` changes. Build exit 0; smoke 675/675.

**1.100-8.S5** (2026-10-23) — PASS. Smoke-test regression guards in `scripts/smoke-test.js` (commit 08f2625): 15 new `pill-s5` assertions — no Done button in input row / no `#done` element; Enter (no Shift) → `doSend()`; New Chat only via `#new-chat`/`#quick-new-chat` (input row has no other session-reset control); pure-function tests of `parsePillRefs`/`dedupePills` against compiled `out/context.js` (parse + within-message dedupe; existing-order merge + id drop); pill pipeline present (`context_pills`/`remove_pill`/`renderPillStrip` in webview, `postContextPills` + `remove_pill` case in ChatViewProvider, `llm.addContext` registered + contributed). Assertions are genuine (string/behavior checks that fail if the feature is removed). Scope clean: commit touches only `scripts/smoke-test.js` + coder memory. Build exit 0; smoke 690/690. **Item 1.100-8 complete (S1–S5 all PASS).**


**1.100-10.S4** (2026-10-23) — **PASS**. Smoke-test regression guards in `scripts/smoke-test.js` (commit ede4d2c). Build exit 0; smoke 701/701 (690 + 11 new `autofix-s4` assertions). Scope clean: commit touches only `scripts/smoke-test.js` + coder memory; `ninfer` submodule NOT committed (only ` m ninfer` in working tree). Guards verified genuine: `llm.agent.autoFix` schema (boolean, default true) read from `package.json`; `src/config.ts` reads `c.get<boolean>("agent.autoFix", true)`; `src/presets.ts` has `agentAutoFix: boolean;`; `src/tools/ToolExecutor.ts` exports `newDiagnostics` + `DiagnosticLike`; `src/chat/ChatViewProvider.ts` references `settings.agentAutoFix` gate, `const MAX_AUTOFIX_ROUNDS = 2;`, pre-batch snapshot ordering (`autofixSnapshot(editedPaths)` index < `for (const call of toolCalls)` index), and `setTimeout(r, 500)` settle. Pure-function tests of compiled `out/tools/ToolExecutor.js` `newDiagnostics` (vscode stubbed via `Module._load`): only-new entries, after-order preserved, identical → []. Count gate updated 690 → 701 and matches. Item-level acceptance (1.100-10): setting defaults on (S1); off disables loop via `settings.agentAutoFix` gate (line 1674); new errors trigger at most 2 auto follow-up turns (`autoFixRounds < MAX_AUTOFIX_ROUNDS`, line 1675, cap 2); no new errors → `newDiagnostics` empty → no message (S2 + S3); loop always terminates (cap 2 + `MAX_TOOL_ITERATIONS = 8`, line 83/1494). **Item 1.100-10 complete (S1–S4 all PASS).**

**1.100-10.S3** (2026-10-23) — **PASS** (re-verified after fix commit 308e856; original b0de672 FAILED). Agent-loop autofix hook in `src/chat/ChatViewProvider.ts`. Build exit 0; smoke 690/690. Scope clean: 308e856 touches only `src/chat/ChatViewProvider.ts` + coder memory; `ninfer` submodule NOT committed (only ` m ninfer` in working tree). Verified: `before` snapshot now taken BEFORE the batch loop — `editedPaths` computed from `toolCalls` at line 1506, `before = autofixSnapshot(editedPaths)` at line 1508, batch loop `for (const call of toolCalls)` follows; post-batch hook (lines 1666-1694): 500 ms settle → `after` snapshot (1669) → `newDiagnostics(before, after)` (1670) → if fresh + `settings.agentAutoFix` + `autoFixRounds < MAX_AUTOFIX_ROUNDS`: system message "New problems appeared in … Fix them." + delta note + counter increment + loop continues; past cap: delta note only. `MAX_AUTOFIX_ROUNDS = 2` (line 86); `autoFixRounds` reset at run start right after `clearChangeSummary()` (line 1453). No duplicate `editedPaths`/`before` computation (single `editedPaths` at 1506; exactly two `autofixSnapshot` calls: 1508 pre-batch, 1669 post-batch). Original ordering bug (pre-batch snapshot taken post-batch) is fixed.

**1.100-10.S3 (original FAIL)** (2026-10-23) — **FAIL** (commit b0de672). Agent-loop autofix hook in `src/chat/ChatViewProvider.ts`. Build exit 0; smoke 690/690. Scope clean (commit touches only `src/chat/ChatViewProvider.ts` + coder memory; `ninfer` submodule NOT committed — only ` m ninfer` in working tree). Passing criteria: `newDiagnostics` imported from `src/tools/ToolExecutor.ts` (line 56); `MAX_AUTOFIX_ROUNDS = 2` named constant (line 86); new diags + `settings.agentAutoFix` + `autoFixRounds < MAX_AUTOFIX_ROUNDS` → system message "New problems appeared in … Fix them." + delta note + counter increment + loop continues (lines 1663-1678); past cap → delta note only, loop proceeds (else branch); `autoFixRounds` reset at run start right after `clearChangeSummary()` (line 1453); loop terminates (cap 2 + outer `MAX_TOOL_ITERATIONS = 8`). **BUG:** the "before" diagnostics snapshot is taken AFTER the tool batch executes, not before. Batch runs at line 1505 (`for (const call of toolCalls)`); `const before = this.autofixSnapshot(editedPaths)` is at line 1659, then 500 ms settle, then `after` at line 1662. Only two `autofixSnapshot` calls exist (1659, 1662). Consequence: the diff misses diagnostics introduced by the edits themselves — it only catches ones appearing in the 500 ms window after the post-batch snapshot, so the autofix hook effectively never fires for the intended case. **Fix for Coder:** move the `before` snapshot to before the batch loop (i.e. before line 1505, after `editedPaths` is computed from `toolCalls`), keep the 500 ms settle + `after` snapshot where they are.

**1.100-10.S2** (2026-10-23) — PASS. Pure exported `newDiagnostics(before, after)` helper in `src/tools/ToolExecutor.ts` (commit 6a0fa00): `DiagnosticLike` interface (severity/range.start/message, vscode-independent); key = `severity|startLine|startChar|message`; returns `after` entries whose key is absent from `before`, preserving `after` order. Behavior verified via `node -e` on `out/tools/ToolExecutor.js` with vscode stub: mixed before/after → only new entry returned; empty before → all after in order; identical lists → 0. Scope clean: commit touches only `src/tools/ToolExecutor.ts` + coder memory — no changes to `src/chat/ChatViewProvider.ts` or `scripts/smoke-test.js`. Build exit 0; smoke 690/690.

**1.100-10.S1** (2026-10-23) — PASS. `llm.agent.autoFix` setting (commit ee2a9bb): `src/presets.ts` `LlmSettings.agentAutoFix: boolean` (line 122, with doc comment); `src/config.ts` `readSettings()` reads `c.get<boolean>("agent.autoFix", true)` (line 87, default true); `package.json` contributes `llm.agent.autoFix` (boolean, default true, description mentions auto-fixing new errors after agent edits, up to 2 rounds). Scope clean: commit touches only `src/presets.ts`, `src/config.ts`, `package.json` + coder memory — no changes to `src/tools/ToolExecutor.ts`, `src/chat/ChatViewProvider.ts`, or `scripts/smoke-test.js`. Build exit 0; smoke 690/690.

**1.100 (in progress, tag `changelog-1.100`):** done so far: instructions files `.instructions.md` with `applyTo` auto-attach, `src/instructions.ts` (1); prompt-file front matter `mode`/`tools`, `llm.runPrompt` + Play button, languages `llm.prompt`/`llm.instructions` (2); `apply_patch` tool `src/patch.ts` (3); `#fetch` as Markdown with `llm.chat.fetch.maxTokens` token trim (7). Smoke 675.

## Verification commands

- **Compile:** `npm run compile` (must exit 0, no errors)
- **Smoke test:** `node scripts/smoke-test.js` (must pass all assertions)
- **Lint (optional):** `npm run lint`

## Notes / decisions

- The tester does NOT write code. If a bug is found, report it (exact error, file, line) so
  the Coder can fix it.
- Always run the build first. If it fails, report fail immediately.
- Always run the smoke test. Record the assertion count.
- Report, don't fix.
