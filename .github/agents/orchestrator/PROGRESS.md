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

- **Current item:** **1.100-2** — Prompt files improvements (front matter `mode`/`tools`, play button, run semantics) — **IN PROGRESS** (6 slices S1–S6; S1 done)
- **Current slice:** 1.100-2.S1 DONE
- **Retry state:** **none** (sub-agent, attempts used / 5) — set when a sub-agent errors and
  is being retried with the same prompt; clear on success or when the budget is exhausted
- **Next step:** dispatch Coder for 1.100-2.S2 (`src/request.ts`: `promptTools` filter)
- **Last updated:** 2026-10-23
- **Last commit:** 5e5f603 (1.100-2.S1); tester memory 9682a76
- **Build state:** compiles clean; smoke 620/620 PASS (verified 2026-10-23)
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
- **1.100-2 plan** (2026-10-23) — Planner produced 6-slice plan: prompt front-matter parser in `src/prompts.ts` (S1) + `RequestConfig.promptTools` filter in `src/request.ts` (S2) + `ChatViewProvider.runPrompt` + `pendingPromptTools` wiring (S3) + webview `prompt_run` handler (S4) + `llm.runPrompt` command rename w/ deprecated `llm.usePrompt` alias (S5) + package.json (Play button `editor/title` menu, language IDs `llm.prompt`/`llm.instructions`) (S6). Deviations: D1 old command kept as alias, D5 slash-command `/prompt-name` deferred to follow-up. Smoke 610 → 637. Plan commit 7783a12.
- **1.100-2.S1** (2026-10-23) — `src/prompts.ts`: `PromptFileMeta` + `parsePromptFrontMatter` (BOM trim, `---`/`...` delimiters, case-insensitive keys, quote stripping, mode validated ask/agent/edit, tools comma-split), `promptTitle` prefers fm title, `PROMPT_TEMPLATE` front-matter example; 10 `prompt2-s1:` smoke assertions. Tester PASS (620 assertions). Commit 5e5f603.

- **1.99-2** (2026-10-22) — MCP server support, 6 slices S1–S6: `src/mcp.ts` (pure JSON-RPC stdio client), `src/mcpManager.ts` (lazy lifecycle + registry), `mcpTools` in request body, chat tool-loop wiring (approval gate + MCP routing), commands + manifest. Commits c8222cb, 94a7965, 851b1b2, ffee7e4, 9783237, 1adefb6. **Item complete — tagged `changelog-1.99` (commit `1adefb6`).**
- **1.99-3 plan** (2026-10-22) — Planner produced 3-slice plan: `think` tool schema in `CODE_TOOLS` (S1) + ToolExecutor echo handler (S2) + request-body/loop verification assertions (S3). No request.ts/webview changes needed (wiring automatic). Commit de1a302.
- **1.99-3.S1** (2026-10-22) — `think` tool schema in `CODE_TOOLS` (12 tools) + 3 `think-s1:` smoke assertions + 3 regression-guard bumps (11→12). Tester PASS (404 assertions).
- **1.99-3.S2** (2026-10-22) — ToolExecutor `case "think"` + private `think` echo handler (`Thought recorded[: <text>]`), 3 `think-s2:` smoke assertions. Tester PASS (407 assertions).
- **1.99-3.S3 (FINAL)** (2026-10-22) — 4 `think-s3:` verification assertions (request body tools incl. think + tool_choice auto; tools off → undefined; ChatViewProvider routes via toolExecutor.execute; no special-casing). Tester PASS (411 assertions). **Item 1.99-3 complete — no tag (changelog-1.99 already exists).**
- **1.99-4 plan** (2026-10-22) — Planner produced 4-slice plan: pure `src/fetchTool.ts` module (S1) + `fetch_url` schema/executor (S2) + `extractFetchTag`/`formatFetchBlock` in `src/context.ts` (S3) + `#fetch` tag wiring + `llm.chat.fetch.enabled` setting (S4). Commit 62d0036.
- **1.99-4.S1** (2026-10-22) — `src/fetchTool.ts` pure module (fetch + HTML→text + cache + truncation, never throws) + 8 `fetch-s1:` smoke assertions. Tester PASS (419 assertions). Commit e6017e9.
- **1.99-4.S2** (2026-10-22) — 13th `CODE_TOOLS` entry `fetch_url` + ToolExecutor `case "fetch_url"` + public `fetchUrl` wrapper + 3 `fetch-s2:` smoke assertions + 5 count-guard bumps (12→13). Tester PASS (422 assertions). Commit 23e40d4.
- **1.99-4.S3** (2026-10-22) — `extractFetchTag` + `formatFetchBlock` (pure, `src/context.ts`) + 3 `fetch-s3:` smoke assertions. Tester PASS (425 assertions). Commit 03d6da3.
- **1.99-4.S4 (FINAL)** (2026-10-22) — `#fetch` tag wiring in ChatViewProvider (after `#folder:` block, gated on `settings.fetchEnabled`) + `fetchEnabled` in presets/config + `llm.chat.fetch.enabled` setting (default true) + 1 `fetch-s4:` static assertion. Tester PASS (426 assertions). **Item 1.99-4 complete — no tag (changelog-1.99 already exists).**
- **1.99-5 plan** (2026-10-22) — Planner produced 4-slice plan: pure `src/usages.ts` helpers (S1) + `find_usages` tool schema/executor (S2) + `extractUsagesTag`/`formatUsagesTagBlock` in `src/context.ts` (S3) + `#usages` tag wiring + `llm.chat.usages.enabled` setting (S4). Grep-based whole-word usages search (no language service); read-only tool; smoke 426 → 439.
- **1.99-6** (2026-10-22) — Create a new workspace with agent mode, 4 slices S1–S4: `src/workspaceScaffold.ts` (pure templates + `buildScaffoldPrompt`; extension/mcp-server/dev-env/generic), `extractNewWorkspaceTag`/`formatWorkspaceBlock` in `src/context.ts`, `#newWorkspace` tag wiring in ChatViewProvider + `llm.chat.newWorkspace.enabled` setting, final smoke. Commits d405e15, 06430f7, 2d0a5df + S4 commit. Smoke 446 → 453. **Item complete — no tag (changelog-1.99 already exists).**
- **1.99-8** (2026-10-22) — Agent mode tool approvals, 4 slices S1–S4: pure `ApprovalStore` in `src/presets.ts` (session/workspace/global remembered approvals via MementoLike); host wiring + `llm.tools.autoApprove` setting (gate: `requireApproval && isMutating && !autoApprove && !isApproved`); webview scope dropdown on both approval cards; `package.json` setting + final smoke. Commits b498510, aabc2d3, 0c9bfbf + S4 commit. Smoke 458 → 466. **Item complete — no tag (changelog-1.99 already exists).**
- **1.99-10** (2026-10-22) — Unified Chat view (mode picker + history), 4 slices S1–S4: ChatMode/normalizeChatMode/modeAddendum in presets, buildRequestBody ask→no tools + tool_choice none, host wiring (ToolbarState.mode, setMode, modeAddendum in system prompt), webview Mode picker (Ask/Agent/Edit, default Agent). Commits 0fbd12e, e281b7f, efbab3c + S4 commit. Smoke 472 → 479. **Item complete — no tag (changelog-1.99 already exists).**
- **1.99-12** (2026-10-22) — Reusable prompt files, 5 slices S1–S5: pure helpers in src/prompts.ts (promptTitle/stripPromptComments/promptBlock/PROMPT_TEMPLATE, MAX_PROMPT_CHARS 32k), promptFiles setting (llm.promptFiles.locations, default .prompts/**/*.prompt.md + .github/copilot-instructions.md), llm.usePrompt command (QuickPick of discovered prompts + New Prompt File… from template, no overwrite), prompt_inject webview handler (prepend to chat input, draft preserved, focus), package.json contributions. S3 split into S3a/S3b (Coder session truncation); GlobPattern deviation (per-glob findFiles loop + Set dedup). Smoke 484 → 497. Commits b54baa0, 3b59647, 3a1ddf7, 5e9a402 + S5 commit. **Item complete — no tag (changelog-1.99 already exists).**
- **1.99-13** (2026-10-22) — Improved vision support (Preview), 3 slices S1–S3: URL-image helpers in src/request.ts (IMAGE_URL_EXTENSIONS, isImageUrl, mimeFromImageUrl), webview .bmp support (IMAGE_TYPES, accept attr, attach title) + addImageUrl (fetch → blob → FileReader → data URL) + drop handler reading text/uri-list items with inline extension regex, host sanitize regex accepts bmp data URLs, llm.chat.vision.enabled description updated. Smoke 497 → 507. Commits 7971ca4, 6d69548 + S3 commit. **Item complete — no tag (changelog-1.99 already exists).**
- **1.99-16** (2026-10-22) — Copilot status menu, 3 slices S1–S3: `completionsStatusLabel` pure helper (pass-filled / pass-filled~strikethrough icon), `statusOverviewItems` 5th Completions row + `STATUS_COMMANDS` Toggle Completions entry, host status-bar indicator (refresh on `onDidChangeActiveTextEditor`) + `llm.toggleCompletions` QuickPick command writing `llm.inline.enabled` (workspace/global target, reload required), package.json contributions (command + top-level activation event + setting description). Deviations: workspace index status (GitHub-service) and NES skipped; activation event at top-level `activationEvents` (package style). Smoke 507 → 518. Commits 4886fc4, 6ca092a + S3 commit. **Item complete — no tag (changelog-1.99 already exists).**


- **1.99-19** (2026-10-22) — `#searchResults` tag (text-search fallback for the VS Code 1.99 `#searchResults` tool), 4 slices S1–S4: `extractSearchResultsTag`/`formatSearchResultsBlock` pure helpers in src/context.ts (8000-char cap + truncation suffix), `ToolExecutor.searchResults` (searchMatches, 50-match cap) + `llm.chat.searchResults.enabled` setting (default true), ChatViewProvider.runStream gated block (between #usages and #newWorkspace), package.json setting. Deviations: AI semantic Search view (Ctrl+I) and reading actual Search view state skipped (VS Code core / no public API) — text-search fallback. Smoke 518 → 531. Commits 3076650, 5bb42bf, ab28dcd + S4 commit. **Item complete — no tag (changelog-1.99 already exists).**- **1.99-23** (2026-10-22) — AI edits improvements (explicit save on keep), 2 slices S1–S2: `ToolExecutor.saveDocument` helper (openTextDocument + doc.save, never throws), `keepFile` async with `(saved)` suffix, new `keepAll()` (clears maps + saves each file), ChatViewProvider `handleKeepAll` + `keepChanges` reroute (no direct clearChangeSummary on keep). Deviations: diagnostics muting skipped (VS Code core, no public API; extension has no onDidChangeDiagnostics listener); no WorkspaceEdit migration (fs.promises.writeFile kept for Node testability). Smoke 531 → 538. Commits 086cfd1 + S2 commit. **Item complete — no tag (changelog-1.99 already exists).**- **1.99-27** (2026-10-22) — Minimal nbformat 4.5 (cell `id` fields), 1 slice S1: `nextCellId` helper (first free `cell-N`, no collisions), `createNotebook` cells carry `id: cell-<index>` (nbformat 4/minor 5 already set), `insert_cell` assigns `nextCellId(cells)`. Deviations: `id` not surfaced in context format / `NbCell` interface (model-facing format stable). Smoke 538 → 546. Commits c32d0fd (plan) + S1 commit. **Item complete — no tag (changelog-1.99 already exists).**- **1.99-28** (2026-10-22) — AI notebook editing improvements — new notebook tool, 5 slices S1–S5: typed cell markers (`<<<CELL:markdown>>>`/`<<<CELL:code>>>`), `planNewNotebook` (3-cell skeleton), `notebookNameFromQuery` (slug), `new_notebook` agent tool (schema + `createNewNotebook` executor), `llm.chat.newNotebook.enabled` setting, `/newNotebook` chat command (host-side, ask-mode safe) + `notebook_created` webview notice, `package.json` schema. Smoke 546 → 568. Commits ce503ea (plan), 13cf638 (S1), 84a4612 (S2), 178a1e9 (S3), b619b69 (S4) + S5 commit. **Item complete — no tag (changelog-1.99 already exists).**- **1.99-29** (2026-10-23) — Cell output to chat (text/image), 4 slices S1–S4: `extractCellOutputs` pure extraction (stream/error/text-plain fenced blocks, 20k cap, ≤4 image data URLs ≤10MB), webview `cell_output_inject` handler (text prepend + image attachments via existing pendingImages/renderAttachStrip), `llm.addCellOutput` command (last code cell with outputs, vision gate, info messages on all no-op paths), `package.json` command + `llm.chat.addCellOutput.enabled` setting. Smoke 568 → 584. Commits 212572f (plan), ad35ef1 (S1), 14dde26 (S2), 1d51aee (S3) + S4 commit. **Item complete — no tag (changelog-1.99 already exists). v1.99 backlog now exhausted.**
- **1.100-1** (2026-10-23) — Instructions files (`.instructions.md`): 6 slices S1–S6. S1 pure core (front-matter parser, hand-rolled globToRegExp, applyToMatches, pickAutoAttachFiles, template, filename helper; 594); S2 settings `llm.instructionsFiles.enabled`/`locations` (597); S3 applyTo auto-attach in ChatViewProvider `loadInstructionsFiles` + indicator (600); S4 webview `instructions_inject` (602); S5 commands `llm.attachInstructions` + `llm.newInstructionsFile` (606); S6 package.json schema (610). Smoke 584 → 610.
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
| 1.100-1 | 1.100 | `changelog-1.100` | e63ed62 | 2026-10-23 |

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
