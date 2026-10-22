# Orchestrator — Progress Memory

> **This file is the agent's persistent memory.** The `Orchestrator` agent
> (`.github/agents/orchestrator.agent.md`) MUST read this at session start and update it at
> session end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Coordinate the team (Planner → Coder → Tester) to implement the `llm` VS Code extension
features from the VS Code release notes archive at `https://code.visualstudio.com/updates/archive`,
**oldest to newest** within the active window. The orchestrator never writes code — it
dispatches, verifies each stage, records, and commits.

## Status

- **Current item:** **1.98-12** — Change Completions Model command (VS Code 1.98)
- **Current slice:** **1.98-12.S3** — `src/extension.ts`: `llm.changeCompletionsModel` QuickPick command
- **Retry state:** **none** (sub-agent, attempts used / 5) — set when a sub-agent errors and
  is being retried with the same prompt; clear on success or when the budget is exhausted
- **Next step:** dispatch Coder for slice 1.98-12.S3, then Tester
- **Last updated:** 2026-10-22
- **Last commit:** `3c03b59` — feat(llm): Change Completions Model — completionsModel setting + inline provider wiring (1.98-12.S2)
- **Build state:** compiles clean; smoke test passes (332 assertions); 1.98-12.S1–S2 verified

## Team

| Agent | File | Memory file |
| ----- | ---- | ----------- |
| Planner | `.github/agents/planner.agent.md` | `.github/agents/planner/PROGRESS.md` |
| Coder | `.github/agents/coder.agent.md` | `.github/agents/coder/PROGRESS.md` |
| Tester | `.github/agents/tester.agent.md` | `.github/agents/tester/PROGRESS.md` |
| Changelog Researcher | `.github/agents/changelog-researcher.agent.md` | `.github/agents/changelog-researcher/PROGRESS.md` |

## Backlog pointer

The ordered backlog (oldest → newest) lives in
`.github/agents/changelog-researcher/PROGRESS.md`. The orchestrator always picks the **first
pending item** (the oldest).

## Done

- **1.98-1.S1** (2026-10-22) — webview `command_approval` card: editable textarea (value-set, no innerHTML), Run/Cancel, Ctrl+Enter, double-decide guard, CSS. Tester PASS (compile + smoke + 6 static checks).
- **1.98-1.S2** (2026-10-22) — host `commandApproval` message case + `pendingCommandApproval` field + `waitForCommandApproval(signal)` (abort-safe, mirrors `waitForApproval`). Pure additions (+37/−0). Tester PASS.
- **1.98-1.S3** (2026-10-22) — host routes `run_command` through the editable gate: `command_approval` post, edited-command rewrite of tool-call args, "user modified" note to model + `modified: true` on `tool_result`; existing file-tool approval path unchanged (else branch); setting off → immediate run. Tester PASS (9 static checks).
- **1.98-1.S4** (2026-10-22) — webview "modified by user" badge (`.tool-modified`) on the tool card in both found-card and fallback branches + CSS. Pure additions (+17/−0). Tester PASS.
- **1.98-1.S5** (2026-10-22) — `llm.tools.requireApproval` description updated; 3 new `cmd-approval:` smoke-test assertions; planner PROGRESS.md marks 1.98-1 Done. Tester PASS. **Item 1.98-1 complete — tagged `changelog-1.98` (commit `ba127fd`).**
- **1.98-2 plan** (2026-10-22) — Planner produced 6-slice plan: single `notebook_edit` tool (5 actions) + pure `src/notebook.ts` module + ToolExecutor case + `.ipynb` context rendering + settings/smoke/PROGRESS. No host/webview changes (approval gate inherited via `isMutatingTool`). Plan recorded in planner PROGRESS.md.
- **1.98-2.S1** (2026-10-22) — `notebook_edit` tool schema in `CODE_TOOLS` (11 tools) + `isMutatingTool` flag + 5 smoke assertions (also fixed pre-existing hardcoded tool count 10→11). Tester PASS.
- **1.98-2.S2** (2026-10-22) — new pure module `src/notebook.ts`: `parseNotebook` / `formatNotebookForContext` / `createNotebook` (+`CELL_MARKER`), 17 smoke assertions. Tester PASS.
- **1.98-2.S3** (2026-10-22) — `applyNotebookEdit` (5 actions) in `src/notebook.ts` on private `parseNotebookRaw` (full-doc preservation), 24 smoke assertions. First Coder attempt truncated mid-edit (kept its consistent `parseNotebookRaw` refactor; also reverted its out-of-scope edits to `.github/agents/*.agent.md` + researcher PROGRESS.md); retry 2 completed the slice. Tester PASS.
- **1.98-2.S4** (2026-10-22) — ToolExecutor `notebook_edit` case + private `notebookEdit` (resolveSafe, snapshot/recordChange, plain-text summary, no JSON diff), 16 `nb-exec:` smoke assertions. Tester PASS.
- **1.98-2.S5** (2026-10-22) — `src/context.ts`: tagged `.ipynb` files render via `formatNotebookForContext` (cell-by-cell view) instead of raw JSON; non-.ipynb unchanged, 5 smoke assertions. Tester PASS.
- **1.98-2.S6** (2026-10-22) — `llm.tools.requireApproval` description lists `notebook_edit`; 4 `nb-final:` smoke assertions; planner PROGRESS.md marks 1.98-2 Done. Tester PASS. **Item 1.98-2 complete** (no tag — `changelog-1.98` already exists from 1.98-1).
- **1.98-8.S1** (2026-10-22) — `src/context.ts`: `extractCodebaseQuery` (string | null, word-bounded, case-insensitive) + `CodebaseSweepData` + `formatCodebaseSweep` (3-section block, placeholders, 12,000-char cap); 12 smoke assertions. Tester PASS.
- **1.98-8.S2** (2026-10-22) — `src/tools/ToolExecutor.ts`: shared private `searchMatches(pattern, rootAbs, cap)` extracted from `searchFiles` (cap 50 preserved); public `codebaseSweep(query)` — structure walk (depth ≤ 3, cap 100), git status (cap 50 lines, `git exited` → ""), search (cap 20); composes `formatCodebaseSweep`; 5 static smoke assertions. Tester PASS.
- **1.98-8.S3** (2026-10-22) — `ChatViewProvider.runStream`: after `buildContextBlock`, if `settings.codebaseSearchEnabled` and `#codebase` tag present, append `codebaseSweep(q)` result to context (`finalContextBlock` → `composeSystemPrompt`); `codebaseSearchEnabled` field added to `LlmSettings` (presets.ts) + `readSettings()` (config.ts, default true); 4 static smoke assertions. Tester PASS.
- **1.98-8.S4** (2026-10-22) — `package.json`: `llm.chat.codebaseSearch.enabled` (boolean, default true); 4 `codebase-s4:` smoke assertions; planner PROGRESS.md marks 1.98-8 Done. Tester PASS. **Item 1.98-8 complete** (no tag — `changelog-1.98` already exists from 1.98-1).
- **1.98-9.S1** (2026-10-22) — `src/context.ts`: `extractProblemsTag` (string | null, word-bounded, case-insensitive) + `ProblemsBlockData` + `PROBLEMS_BLOCK_MAX_CHARS = 8000` + `formatProblemsBlock` (scope header, clean placeholder, 8,000-char cap); 10 smoke assertions. Tester PASS.
- **1.98-9.S2** (2026-10-22) — `src/tools/ToolExecutor.ts`: `collectDiagnostics` shared helper (50-problem cap) extracted for `#problems` reuse; 4 smoke assertions. Tester PASS. Commit `bc7ed0d`.
- **1.98-9.S3** (2026-10-22) — `ChatViewProvider.runStream`: `#problems` wiring (detect tag, collect diagnostics, inject context; "Path not allowed" qualifier fallback); `problemsEnabled` field in `LlmSettings` + `readSettings()`; 5 smoke assertions. Tester PASS. Commit `0bc9279`.
- **1.98-9.S4** (2026-10-22) — `package.json`: `llm.chat.problems.enabled` (boolean, default true); 4 `problems-s4:` smoke assertions; planner PROGRESS.md marks 1.98-9 Done. Tester PASS. **Item 1.98-9 complete** (no tag — `changelog-1.98` already exists from 1.98-1). Commit `97a4676`.
- **1.98-10 plan** (2026-10-22) — Planner produced 4-slice plan: `#folder:<name>` tag (bare = workspace root) — pure `extractFolderTag`/`formatFolderBlock` in `src/context.ts`, `ToolExecutor.folderSweep` (resolveSafe guard + tree walk depth ≤ 3 / cap 100), ChatViewProvider wiring gated on `llm.chat.folderContext.enabled`, package.json + smoke. Plan recorded in planner PROGRESS.md. Commit `d721e94`.
- **1.98-10.S1** (2026-10-22) — `src/context.ts`: `extractFolderTag` (string | null; `#folder:<name>` / `#folder <name>`; bare → `""`) + `FolderBlockData` + `FOLDER_BLOCK_MAX_CHARS = 8000` + `formatFolderBlock` (header, notFound, 8,000-char cap); 12 smoke assertions. Approved deviation: plan's literal regex broken for space form — corrected alternation used. Tester PASS. Commit `c4a07b0`.
- **1.98-10.S2** (2026-10-22) — `src/tools/ToolExecutor.ts`: `folderSweep(folderName)` (resolveSafe guard chain + tree walk depth ≤ 3 / cap 100, mirrors `codebaseSweep`); 4 smoke assertions. Tester PASS. Commit `9311ae0`.
- **1.98-10.S3** (2026-10-22) — `ChatViewProvider.runStream`: `#folder:` wiring (after `#problems`, before `composeSystemPrompt`); `folderContextEnabled` field in `LlmSettings` + `readSettings()`; 5 smoke assertions. Tester PASS. Commit `95ffaaf`.
- **1.98-10.S4** (2026-10-22) — `package.json`: `llm.chat.folderContext.enabled` (boolean, default true); 4 `folder-s4:` parsed-JSON smoke assertions; planner PROGRESS.md marks 1.98-10 Done; researcher backlog updated. Tester PASS. **Item 1.98-10 complete** (no tag — `changelog-1.98` already exists from 1.98-1). Commit `8192065`.
- **1.98-12 plan** (2026-10-22) — Planner produced 4-slice plan: Change Completions Model command — pure `buildCompletionsModelList` in `src/presets.ts`, `completionsModel` setting (`llm.completions.model`, empty → chat model fallback) + InlineCompletionProvider wiring, `llm.changeCompletionsModel` QuickPick command in `extension.ts` (workspace-scope write), package.json contributions + smoke. Plan recorded in planner PROGRESS.md. Commit `5d2517d`.
- **1.98-12.S1** (2026-10-22) — `src/presets.ts`: `CompletionsModelOption` + pure `buildCompletionsModelList` (default entry first, dedup by value, `picked` on active); 8 `compm-s1:` smoke assertions. Tester PASS. Commit `f33c3a4`.
- **1.98-12.S2** (2026-10-22) — `src/presets.ts` + `src/config.ts` + `src/inline/InlineCompletionProvider.ts`: `completionsModel` field (`llm.completions.model`, default `""`) + conditional model override in the inline provider (empty → keeps `llm.model`); 5 `compm-s2:` smoke assertions. Fallback bug (unconditional override) found by orchestrator, fixed by Coder before verification. Tester PASS. Commit `3c03b59`.

## Tags (changelog-version tags on completed items)

> When the last slice of a changelog item is committed, a lightweight tag `changelog-<version>`
> is created on that commit. Record each tag here as items complete.

| Item | Changelog version | Tag | Commit | Date |
| ---- | ----------------- | --- | ------ | ---- |
| _(none yet)_ | | | | |

## Todo

- [ ] Dispatch the Changelog Researcher to study the changelog and build the backlog.
- [ ] For each backlog item (oldest → newest): dispatch Planner (first slice only) → Coder
      (one slice) → Tester, verify, record, commit. Repeat one slice per session until the
      item is complete, then move to the next item.

## Notes / decisions

- The orchestrator does NOT write code. Only the Coder writes code.
- Always implement oldest → newest. Never skip ahead.
- If the Tester reports a failure, re-dispatch the Coder with the failure details, then
  re-test, until it passes.
- **Local LLM filter:** the engine is free — tokens are not paid for. Never dispatch
  cost/money-driven features (token-spend guards, dollar budgets, paid-API rate limits). Only
  `pending` items with `Relevance: keep (capability/context)` are implemented. See the full
  filter in `.github/agents/changelog-researcher.agent.md`.
- **One slice per session:** a feature is broken into tiny slices (one file / one concern
  each). The orchestrator dispatches ONE slice per session through Planner → Coder → Tester.
  This keeps each session's token consumption low. A slice touching >3 files is too big —
  split it further.
- **Retry on error: 5× same prompt.** If a sub-agent errors out (crash / timeout / no usable
  report), re-dispatch it up to 5 times with the EXACT SAME prompt before changing approach.
  Track the count in **Retry state**. Only after 5 identical retries fail, change approach
  (split the slice, simplify the prompt, or report the blocker). A genuine Tester failure
  (build error / failed acceptance) is NOT an error — fix it via the Coder instead of
  burning the retry budget.
- **Tag on item completion.** When the last slice of a changelog item is committed, create a
  lightweight tag `changelog-<version>` on that commit (e.g. `changelog-1.100.0`). Only the
  final slice is tagged — intermediate slices are not. Record the tag in the **Tags** table
  above. Never tag a commit that does not compile or has a failing test. If the tag already
  exists, leave it (do not force-recreate).
