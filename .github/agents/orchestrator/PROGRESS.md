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

- **Current item:** **1.99-2 DONE** (2026-10-22, 6 slices S1–S6, tag `changelog-1.99`); next: **1.99-3** — Thinking tool
- **Current slice:** 1.99-2.S6 (FINAL) — **DONE** (PASS, 401 assertions); item 1.99-2 complete
- **Retry state:** **none** (sub-agent, attempts used / 5) — set when a sub-agent errors and
  is being retried with the same prompt; clear on success or when the budget is exhausted
- **Next step:** dispatch Planner for item **1.99-3** (Thinking tool), record plan, commit,
  then run the slice pipeline
- **Last updated:** 2026-10-22
- **Last commit:** `9783237` — feat(llm): MCP server support — wire MCP into the chat tool loop (1.99-2.S5)
- **Build state:** compiles clean; smoke test passes (401 assertions); 1.99-2 fully verified (S1–S6)
- **Note (2026-10-22):** v1.99 changelog researched **inline** (researcher sub-agent failed
  with `context_length_exceeded` — deterministic, do not retry). Backlog recorded in the
  researcher PROGRESS.md: 15 pending keep-items (1.99-2 … 1.99-29), 10 skipped, 2
  done-already-built (1.99-1, 1.99-24).

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
- **1.98-12.S3** (2026-10-22) — `src/extension.ts`: `llm.changeCompletionsModel` QuickPick command (registered after `llm.commitChanges`; list via `buildCompletionsModelList`; engine-unreachable → warning + configured-only list; cancel = no-op; write to `ConfigurationTarget.Workspace`/`Global`); 5 `compm-s3:` smoke assertions. Tester PASS. Commit pending.
- **1.98-12.S4** (2026-10-22) — `package.json`: `llm.completions.model` setting (string, default `""`) + `llm.changeCompletionsModel` command contribution; 5 `compm-s4:` parsed-JSON smoke assertions; planner PROGRESS.md marks 1.98-12 Done. Tester PASS. **Item 1.98-12 complete** (no tag — `changelog-1.98` already exists from 1.98-1). Commit `486dde2`.
- **1.98-14 plan** (2026-10-22) — Planner produced 5-slice plan: Copilot Vision image attachments — S1 `src/request.ts` multimodal (`ChatMessage.images`, `toContentParts`, body mapping, +1000 tokens/image), S2 `src/presets.ts` `isVisionCapableModel` (static marker list), S3 `src/chat/webview.ts` attachment UI (📎/paste/drag-drop, thumbnail strip, inline render + hover zoom, `vision_warning` notice), S4 `src/chat/ChatViewProvider.ts` send flow + validation + non-blocking warning, S5 `package.json` `llm.chat.vision.enabled` + 15 `vision-sN:` smoke assertions (342 → 357). Plan recorded in planner PROGRESS.md. Commit `ad2b295`.
- **1.98-14.S1** (2026-10-22) — `src/request.ts`: `ChatMessage.images?: string[]`, `ContentPart` + pure `toContentParts` (plain string when no images; text part first + one `image_url` part per data URL), `RequestMessage` type widening (`content: string | ContentPart[]`), `buildRequestBody` maps image messages after `trimHistory` (text-only byte-identical), `estimateMessageTokens` +1000/image; 4 `vision-s1:` behavior smoke assertions. Tester PASS. Commit `9d847c1`.
- **1.98-14.S2** (2026-10-22) — `src/presets.ts`: `VISION_MODEL_MARKERS` (16 family markers) + pure `isVisionCapableModel` (empty → false; case-insensitive substring match); 3 `vision-s2:` behavior smoke assertions. Tester PASS. Commit `2d0497b`.
- **1.98-14.S3** (2026-10-22) — `src/chat/webview.ts`: attachment UI — paperclip button + hidden file input (jpeg/png/gif/webp, multiple), `pendingImages` state, `addImageFiles` (4 mimes, 4-image / 10 MB caps, `readAsDataURL`), `renderAttachStrip` (48px thumbs + × remove), paste (`clipboardData.items`) + drag-drop wiring, `doSend` posts `images` data URLs (captured before reset), `addUserMessage(text, images)` renders `.msg-images`/`.msg-img` (hover zoom 1.6), `stream_start`/`restore` pass images, `case 'vision_warning'` amber notice (8 s auto-hide); 5 `vision-s3:` static smoke assertions. Tester PASS. Commit `4bd7775`.
- **1.98-14.S4** (2026-10-22) — `src/chat/ChatViewProvider.ts`: host send flow — `case "send"` passes `msg.images` through; `handleSend(text, images)` reads `chat.vision.enabled` gate (default true), sanitizes (data-URL regex, ~14 MB cap, max 4; gate off → drop silently), pushes `images` into history, non-blocking `vision_warning` post when `!isVisionCapableModel(this.toolbarStore.get().model ?? settings.model)`; 3 `vision-s4:` static smoke assertions. Tester PASS. Commit `3d169f6`.
- **1.98-14.S5** (2026-10-22, FINAL) — `package.json`: `llm.chat.vision.enabled` (boolean, default true) setting contribution; planner PROGRESS.md marks 1.98-14 Done (Status + 5 slice annotations + Todo checked). No new smoke assertions (total stays 357). Tester PASS. Commit `4e5e56b`.
- **1.98-15.S1** (2026-10-22) — `src/presets.ts`: pure status helpers (`EngineStatus`, `statusLabel`, `statusTooltip`, `StatusOverviewItem`/`statusOverviewItems`, `STATUS_COMMANDS`); 4 `status-s1:` smoke assertions (357 → 361). Tester PASS.
- **1.98-15.S2** (2026-10-22) — `src/extension.ts`: `statusBar.enabled` gate (default true), status-bar block wrapped in `if (statusBarEnabled)`, `updateHealth` uses `statusLabel`/`statusTooltip` pure helpers, `onDidChangeWindowState` focus refresh; 3 `status-s2:` smoke assertions (361 → 364). Tester PASS.
- **1.98-15.S3** (2026-10-22) — `src/extension.ts`: `llm.showStatusOverview` QuickPick (fresh `client.health()`, `statusOverviewItems` info rows + `Useful commands` separator + `STATUS_COMMANDS` mapped to `{label, detail, command}`, `executeCommand` on pick); `status.command` repointed to `llm.showStatusOverview`; tooltip suffix `(click for status overview)`; 3 `status-s3:` smoke assertions (364 → 367). Tester PASS.
- **1.98-15.S4** (2026-10-22, FINAL) — `package.json`: `llm.showStatusOverview` command + `onCommand:llm.showStatusOverview` activation event + `llm.statusBar.enabled` setting (boolean, default true); 4 `status-s4:` parsed-JSON smoke assertions (367 → 371); planner PROGRESS.md marks 1.98-15 Done. Tester PASS.
- **1.98-15** — Engine status indicator (status-bar overview) — **COMPLETE** (all slices S1–S4 PASS, 2026-10-22; commits `55cc673`, `048b248`, `2f22531` + S4). No tag — `changelog-1.98` already exists. **v1.98 window complete — all keep-items done, all skip-items documented.**
- **1.98-14** — Copilot Vision (image attachments) — **COMPLETE** (all slices S1–S5 PASS, 2026-10-22; commits `9d847c1`, `2d0497b`, `4bd7775`, `3d169f6` + S5). No tag — `changelog-1.98` already exists.

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
