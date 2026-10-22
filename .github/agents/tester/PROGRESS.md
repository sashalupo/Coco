# Tester — Progress Memory

> **This file is the agent's persistent memory.** The `Tester` agent
> (`.github/agents/tester.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Verify that the Coder's implementation of each changelog feature compiles cleanly and behaves
correctly. The tester does NOT write code — it runs the build, the smoke test, and the
acceptance checks, and reports a clear pass/fail.

## Status

- **Current item:** 1.98-12 (completions model quick pick) — S3 verified
- **Next step:** verify 1.98-12 S4
- **Last updated:** 2026-10-22
- **Last commit:** — (no tester commits yet)
- **Build state:** 332/332 PASS (`npm run compile` exit 0; smoke test ALL PASSED)

## Verification commands

- **Compile:** `npm run compile` (must exit 0, no errors)
- **Smoke test:** `node scripts/smoke-test.js` (must pass all assertions)
- **Lint (optional):** `npm run lint`

## Verifications

### 1.98-1.S1 — webview `command_approval` card (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED (13 assertions shown in tail; full suite green).
- **Static checks in `src/chat/webview.ts`:**
  - (a) `case 'command_approval':` present in host-message handler (line 1977). PASS
  - (b) textarea value set via `cmdInput.value = msg.command || ''` (line 1990); card HTML string contains an empty `<textarea class="cmd-input">` — command NOT interpolated into innerHTML. PASS
  - (c) `vscode.postMessage({ type: 'commandApproval', id: msg.id, approved: approved, command: cmdInput.value })` (line 2003) — includes `id`, `approved`, `command`. PASS
  - (d) keydown handler: `if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); decideCmd(true); }` (lines 2007-2012). PASS
  - (e) double-decide guard: `var decided = false;` + `if (decided) { return; } decided = true;` in `decideCmd` (lines 1994-1997). PASS
  - (f) CSS rules present: `.message.command-approval .cmd-input` (line 327), `.cmd-run` (line 348), `.cmd-cancel` (line 352), plus `.status`. PASS
- **Scope check:** `git status --short` / `git diff --stat` → only `src/chat/webview.ts` (+83) among source files; also `.github/agents/coder/PROGRESS.md` and `.github/agents/planner/PROGRESS.md` (memory updates, expected). `ninfer` shows a submodule dirty marker (`m`), not a source-file change. PASS
- **Note:** host-side `commandApproval` handling intentionally absent (slice S2) — expected, not a failure.


### 1.98-1.S2 — host-side `commandApproval` plumbing (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED (23 assertions in tail; full suite green).
- **Static checks in `src/chat/ChatViewProvider.ts`:**
  - (a) `private pendingCommandApproval: ((approved: boolean, command: string) => void) | null = null;` present next to `pendingApproval`. PASS
  - (b) `case "commandApproval":` in `onMessage` switch calls `this.pendingCommandApproval?.(msg.approved === true, String(msg.command ?? ""))`. PASS
  - (c) `waitForCommandApproval(signal: AbortSignal): Promise<{ approved: boolean; command: string }>` present: resolves `{approved:false, command:""}` when already aborted; abort listener (`{ once: true }`) resolves `{approved:false, command:""}` and clears `pendingCommandApproval`; normal resolver removes the abort listener and clears `pendingCommandApproval` before resolving. PASS
  - (d) `git diff src/chat/ChatViewProvider.ts` → 3 hunks, additions only (+37 lines, 0 deletions); existing `waitForApproval` / `toolApproval` logic untouched. PASS
- **Scope check:** `git status --short` / `git diff --stat` → only `src/chat/ChatViewProvider.ts` (+37) among source files; also `.github/agents/coder/PROGRESS.md` (memory update, expected) and `ninfer` submodule dirty marker (not a source change). PASS
- **Note:** behaviorally a no-op by design — nothing posts `command_approval` yet (that is slice S3). Expected, not a failure.

### 1.98-1.S3 — host: route `run_command` through editable approval gate (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED (full suite green).
- **Static checks in `src/chat/ChatViewProvider.ts`:**
  - (a) `if (call.function.name === "run_command")` branch exists inside `settings.requireApproval && isMutating` block. PASS
  - (b) `command_approval` postMessage includes `id: call.id`, `tool: "run_command"`, `command`. PASS
  - (c) `await this.waitForCommandApproval(signal)` present in `run_command` path. PASS
  - (d) Rejection path pushes "User rejected…" `toolResultMessage` and `continue`s. PASS
  - (e) On approval with non-empty edited command differing from original: `call.function.arguments = JSON.stringify({...parsed, command: edited})` and `commandModified = true`. PASS
  - (f) Empty edited command (`edited.trim() === ""`) does NOT modify arguments (guarded by `edited.trim() !== ""`). PASS
  - (g) After `toolExecutor.execute`, if `commandModified`: model-facing content prefixed with `"Note: the user modified the command before running it.\n"`; `tool_result` postMessage gains `modified: true`. PASS
  - (h) `git diff` confirms old `approval_request`/`waitForApproval` logic moved verbatim into `else` branch (unchanged for `write_file`/`edit_file`). PASS
  - (i) When `requireApproval` is false, the entire `if (settings.requireApproval && isMutating)` block is skipped — no `command_approval` post, no `waitForCommandApproval` call. PASS
- **Scope check:** `git status --short` / `git diff --stat` → only `src/chat/ChatViewProvider.ts` (+81/-21) among source files; also `.github/agents/coder/PROGRESS.md` (memory update, expected) and `ninfer` submodule dirty marker (not a source change). PASS


### 1.98-1.S4 — webview "modified by user" badge on tool card (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED (full suite green; tail showed 13 PASS lines ending in diffStats).
- **Static checks in `src/chat/webview.ts` (via `git diff`):**
  - (a) `if (msg.modified === true)` present in BOTH the found-card branch (appends badge to `details.querySelector('summary')`) and the fallback-card branch (appends badge to `tcSummary` after `tcName`). PASS
  - (b) Badge element: `badge.className = 'tool-modified'`, `badge.textContent = 'modified by user'` (and `tcBadge` equivalents). PASS
  - (c) CSS rule `.tool-modified { font-size: 10px; font-weight: 600; color: var(--vscode-descriptionForeground, #9d9d9d); }` added in the existing style block. PASS
  - (d) `git diff src/chat/webview.ts` → exactly 3 hunks, all additions (+17/-0): CSS rule + 2 badge blocks. No other behavior in the `tool_result` handler changed. PASS
- **Scope check:** `git status --short` / `git diff --stat` → only `src/chat/webview.ts` (+17) among source files; also `.github/agents/coder/PROGRESS.md` (memory update, expected) and `ninfer` submodule dirty marker (not a source change). PASS

### 1.98-2.S1 — `notebook_edit` tool schema + mutating flag (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED (exit 0). New assertions confirmed in output: `tools: CODE_TOOLS has 11 tools`, `tools: tool names in order` (ends `...,manage_todos,notebook_edit`), `tools: notebook_edit required=[path,action]`, `tools: notebook_edit action enum has 5 values`, `approval: notebook_edit is mutating`.
- **Static checks in `src/tools.ts` (via `git diff`):**
  - (a) `notebook_edit` appended to `CODE_TOOLS` after `manage_todos` (now 11 tools); `required: ["path", "action"]`; `action` enum exactly 5 values: create, modify_cell, insert_cell, delete_cell, change_cell_type; `path` string, `cell_index` number, `cell_type` enum code|markdown, `source` string. PASS
  - (b) `isMutatingTool` extended: `name === "notebook_edit"` added to the OR chain (existing three tools unchanged). PASS
  - (c) `git diff src/tools.ts` → exactly 2 hunks, additions only (+58/-1): new tool entry + `isMutatingTool` extension. No other tool schemas touched. PASS
- **Scope check:** `git status --short` / `git diff --stat` → only `src/tools.ts` (+58/-1) and `scripts/smoke-test.js` (+17/-4) among source files; also `.github/agents/coder/PROGRESS.md` (memory update, expected) and `ninfer` submodule dirty marker (not a source change). PASS
- **Smoke-test diff note:** pre-existing hardcoded `toolBody.tools.length === 10` correctly updated to `11`; tool-name order assertion extended with `notebook_edit`.


### 1.98-9.S2 — `ToolExecutor.collectDiagnostics` shared helper (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **284 assertions** (280 prior + 4 new `problems-s2:` in subsection 13b).
- **Static checks in `src/tools/ToolExecutor.ts` (via `git diff`):**
  - (a) `public async collectDiagnostics(relPath?: string): Promise<string>` present; extracted body keeps the same workspace-folder guard string, path-safety string, per-file format (`rel:` header + `  sev line:col — message [source]`), and empty-result strings ("No diagnostics in open files (clean)." / "No diagnostics in <relPath> (clean)."). PASS
  - (b) New 50-problem cap: `shown` counter, `continue`/`break` at 50, suffix `… (showing first 50 of ${total})` appended only when `total > 50`. PASS
  - (c) `getDiagnostics` is now a thin async wrapper (`const text = await this.collectDiagnostics(relPath); return this.result(call, text);`); `case "get_diagnostics":` in `execute()` intact and still calls it. PASS
  - (d) Diff is a pure extraction: single logical change, old body re-added as `collectDiagnostics` modulo `this.result(call, X)` → `return X` and the cap logic. No other tool/method touched. PASS
- **Scope check:** `git status --short` → only `src/tools/ToolExecutor.ts` (+38/-14), `scripts/smoke-test.js` (+19), `.github/agents/coder/PROGRESS.md`; `ninfer` submodule dirty marker (not a source change). PASS
- **New smoke assertions (4, subsection 13b):** genuine source-content checks on `toolExecSrc` — `collectDiagnostics(` present, occurrence count ≥ 2 (definition + call site), `getDiagnostics` still present, `showing first 50` cap note present. Not tautologies. PASS

### 1.98-9.S3 — `problemsEnabled` field + `#problems` wiring (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED (**290 assertions**; 6 new `problems-s3:` green in subsection `// 13c) problems tag (1.98-9.S3)`).
- `src/presets.ts`: `LlmSettings` gains `problemsEnabled: boolean;` (single additive line + doc comment). PASS
- `src/config.ts`: `readSettings()` returns `problemsEnabled: c.get<boolean>("chat.problems.enabled", true)` (single additive line). PASS
- `src/chat/ChatViewProvider.ts` (git diff = 2 hunks, +31/-0): (a) `extractProblemsTag` + `formatProblemsBlock` added to the `../context` import. (b) In `runStream`, immediately after the `#codebase` block and before `composeSystemPrompt`: gated on `settings.problemsEnabled && lastUser && this.toolExecutor`; `extractProblemsTag(lastUser.content)` → `await this.toolExecutor.collectDiagnostics(p || undefined)`; qualifier fallback — if `p` non-empty and text starts with `"Path not allowed"`, re-call `collectDiagnostics()` with no arg and reset scope to default; `formatProblemsBlock({ text: problemsText }, problemsScope)`; non-empty block appended to `finalContextBlock` with the same `\n\n` join pattern as `#codebase`. (c) `#codebase` wiring and all other methods untouched (diff review). (d) `composeSystemPrompt` still receives `finalContextBlock`. All PASS.
- 6 new smoke assertions genuine: source-content checks on `chatViewSrc` (`extractProblemsTag`, `formatProblemsBlock`, `collectDiagnostics(`, `problemsEnabled`), `configSrc` (`chat.problems.enabled`), `presetsSrc` (`problemsEnabled`). Not tautologies. PASS
- Scope: only `src/chat/ChatViewProvider.ts`, `src/config.ts`, `src/presets.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md` (+ ninfer submodule marker). PASS

### 1.98-9.S4 — `package.json`: `llm.chat.problems.enabled` + final smoke assertions (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED (**294 assertions**; 4 new `problems-s4:` green in subsection `// 13d) problems tag (1.98-9.S4)`).
- `package.json`: valid JSON; single additive hunk (+5/-0) adding `llm.chat.problems.enabled` (`type: "boolean"`, `default: true`, description mentions `#problems` and the `#problems <path>` qualifier). Existing `llm.chat.codebaseSearch.enabled` entry untouched (context lines only in diff). PASS
- 4 new smoke assertions genuine: parsed-JSON checks on `pkg.contributes.configuration.properties["llm.chat.problems.enabled"]` — entry exists, `type === "boolean"`, `default === true`, non-empty description containing `#problems`. Not tautologies. PASS
- Scope: `git status --short` → only `package.json`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md`, `.github/agents/planner/PROGRESS.md` (+ ninfer submodule marker). PASS
- Planner PROGRESS.md: 1.98-9 marked **Done** (S1–S4 complete); Next step → 1.98-10 (`#folder:` tag). PASS
- **Item 1.98-9 fully verified (S1–S4 all PASS).**

### 1.98-10.S1 — `src/context.ts`: `extractFolderTag` + `formatFolderBlock` + `FOLDER_BLOCK_MAX_CHARS` (pure) (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED (**306 assertions**; 12 new `folder-s1:` green in subsection `// 14a) folder tag (1.98-10.S1)`).
- `src/context.ts` (pure — no `vscode` import added; grep matches only comments): (a) `extractFolderTag(text): string | null` uses the approved corrected alternation `/#folder(?::(\S*)|[ \t]+(\S*)|(?=\n|$))/i` returning `(m[1] ?? m[2] ?? "").trim()` (the plan's literal lookahead regex was broken for the space form — KNOWN approved deviation). (b) `FolderBlockData { tree: string; notFound?: boolean; }`. (c) `FOLDER_BLOCK_MAX_CHARS = 8000`. (d) `formatFolderBlock(data, folder?)` — header `Folder: <name>` / `Folder: (workspace root)` when empty/absent; body `(folder not found: <name>)` when `notFound` else `data.tree || "(empty folder)"`; truncation at 8,000 + `… (truncated)`; never returns `""`. All PASS.
- Behavior contract verified at runtime against compiled `out/context.js` via `node -e`: `#folder:src`→`"src"`, `#folder src`→`"src"`, bare `#folder`→`""`, absent→`null`, `#folderfoo`→`null`, `#Folder:src`→`"src"` (case-insensitive), `#folder:src\nline2`→`"src"` (same-line), first-occurrence-only, `#folder:src more`→`"src"` (stops at whitespace), `#folder:`→`""`. All PASS.
- `git diff src/context.ts` = single additive hunk (+69/-0) appended after `formatProblemsBlock`; `#codebase`/`#problems` sections untouched. PASS
- 12 new smoke assertions genuine: concrete-input behavior checks on the real compiled `extractFolderTag`/`formatFolderBlock`/`FOLDER_BLOCK_MAX_CHARS`. Not tautologies. PASS
- Scope: `git status --short` → only `src/context.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md` (+ ninfer submodule marker). PASS

### 1.98-10.S2 — `ToolExecutor.folderSweep(folderName)` (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **310 assertions** (306 prior + 4 new `folder-s2:` in subsection 14b).
- **Static checks in `src/tools/ToolExecutor.ts` (via `git diff`):**
  - (a) `public async folderSweep(folderName: string): Promise<string>` present immediately after `codebaseSweep`. PASS
  - (b) Guard chain: `resolveSafe(".")` null → notFound block with `folderName || "(workspace root)"`; empty `folderName` → `target = rootAbs`; non-empty → `resolveSafe(folderName)`, null → notFound; `fs.promises.stat` catch → notFound; `!stat.isDirectory()` → notFound. PASS
  - (c) Walk mirrors `codebaseSweep` inner walk verbatim: depth ≤ 3, cap 100, `SKIP_DIRS` skip, `"  ".repeat(depth - 1)` indent, `… (truncated at 100 entries)` suffix; file tree only (no git/search). PASS
  - (d) Returns `formatFolderBlock({ tree: structure }, folderName)`; `formatFolderBlock` imported from `../context` (line 17). PASS
  - (e) `git diff` → exactly 2 hunks (import + new method, +71/−1); `codebaseSweep`, `collectDiagnostics`, `searchMatches`, `resolveSafe` untouched. PASS
- **Scope check:** `git status --short` → only `src/tools/ToolExecutor.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md` (+ `ninfer` submodule marker, ignored). PASS
- **Behavior spot-check:** `node -e` against `out/context.js` — `formatFolderBlock({tree:"",notFound:true},"nope")` → `"Folder: nope\n(folder not found: nope)"`; empty name → `Folder: (workspace root)` header. fs-dependent path verified by static review. PASS

### 1.98-10.S3 — `folderContextEnabled` field + `#folder:` chat wiring (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **315 assertions** (310 prior + 5 new `folder-s3:` in subsection 14c; 0 FAIL).
- **Wiring in `src/chat/ChatViewProvider.ts` (via `git diff` — exactly 2 hunks, +18/−0):**
  - (a) `extractFolderTag` added to the `../context` import (line 30). PASS
  - (b) In `runStream`, the `#folder:` block sits immediately after the `#problems` block (line 982) and before `composeSystemPrompt` (line 998). PASS
  - (c) Gated on `settings.folderContextEnabled && lastUser && this.toolExecutor`; calls `extractFolderTag(lastUser.content)`; on non-null `f` calls `await this.toolExecutor.folderSweep(f)`; non-empty result appended to `finalContextBlock` with `\n\n` join (assigns directly when empty). PASS
  - (d) `#codebase` (line 937) and `#problems` (line 953) wiring blocks UNCHANGED — diff contains only the import extension and the new `#folder:` block. PASS
- **Settings field:** `src/presets.ts` line 96 `folderContextEnabled: boolean;` (immediately after `problemsEnabled` at line 94). `src/config.ts` line 73 `folderContextEnabled: c.get<boolean>("chat.folderContext.enabled", true)`. PASS
- **Smoke 14c:** 5 genuine static checks labeled `folder-s3:` — `ChatViewProvider.ts` contains `extractFolderTag`, `folderSweep(`, `folderContextEnabled`; `config.ts` contains `chat.folderContext.enabled`; `presets.ts` contains `folderContextEnabled`. Not tautologies. PASS
- **Scope check:** `git status --short` → only `src/chat/ChatViewProvider.ts`, `src/config.ts`, `src/presets.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md` (+ `ninfer` submodule marker, ignored). PASS

### 1.98-10.S3 — `folderContextEnabled` field + `#folder:` chat wiring (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **315 assertions** (310 prior + 5 new `folder-s3:` in subsection 14c).
- **Wiring in `src/chat/ChatViewProvider.ts`:** `extractFolderTag` imported from `../context` (line 30); `#folder:` block at L982 — after `#problems` (L953), before `composeSystemPrompt` (L998); gated on `settings.folderContextEnabled && lastUser && this.toolExecutor`; `git diff` = exactly 2 hunks (+18/−0): import extension + new block only; `#codebase`/`#problems` unchanged. PASS
- **Settings field:** `src/presets.ts:96` `folderContextEnabled: boolean;` (after `problemsEnabled`); `src/config.ts:73` `folderContextEnabled: c.get<boolean>("chat.folderContext.enabled", true)`. PASS
- **Smoke 14c:** 5 genuine static checks (`folder-s3:`). PASS
- **Scope check:** only the 5 in-scope files (+ `ninfer` marker, ignored). PASS

### 1.98-10.S4 — `package.json`: `llm.chat.folderContext.enabled` + smoke 14d + planner memory (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **319 assertions** (315 prior + 4 new `folder-s4:` in subsection 14d; 0 FAIL).
- **`package.json`:** valid JSON (`node -e JSON.parse` OK). `llm.chat.folderContext.enabled` present with `type: "boolean"`, `default: true`, non-empty description containing `#folder`. `git diff package.json` = single additive hunk (+5/−0) placed immediately after `llm.chat.problems.enabled`; no other change. PASS
- **Smoke 14d:** 4 genuine parsed-JSON checks on `pkg.contributes.configuration.properties["llm.chat.folderContext.enabled"]` (NOT string-contains on raw file): entry exists, `type === "boolean"`, `default === true`, description non-empty and contains `#folder`. Not tautologies. PASS
- **Planner memory:** `.github/agents/planner/PROGRESS.md` marks 1.98-10 **Done** (2026-10-22, slices S1–S4); each slice S1–S4 annotated Done. PASS
- **Scope check:** `git status --short` (ignoring `ninfer` submodule marker) → only `package.json`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md`, `.github/agents/planner/PROGRESS.md`. PASS
- **Item 1.98-10 fully verified (S1–S4 all PASS).**

### 1.98-10.S4 — `package.json`: `llm.chat.folderContext.enabled` + smoke 14d + planner memory (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **319 assertions** (315 prior + 4 new `folder-s4:` in subsection 14d).
- **`package.json`:** valid JSON; `llm.chat.folderContext.enabled` present with `type: "boolean"`, `default: true`, non-empty description containing `#folder`; `git diff` = single additive hunk (+5/−0) immediately after `llm.chat.problems.enabled`. PASS
- **Smoke 14d:** 4 genuine parsed-JSON checks (`folder-s4:`) — entry exists, `type === "boolean"`, `default === true`, description non-empty + contains `#folder`. PASS
- **Planner memory:** item 1.98-10 marked Done (2026-10-22, slices S1–S4), each slice annotated done. PASS
- **Scope check:** only the 4 in-scope files (+ `ninfer` marker, ignored). PASS
- **Item 1.98-10 fully verified (S1–S4 all PASS).**

### 1.98-12.S1 — pure `buildCompletionsModelList` in `src/presets.ts` (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **327 assertions** (319 prior + 8 new `compm-s1:`; 0 FAIL).
- **Static checks in `src/presets.ts`:** (a) `CompletionsModelOption` interface exported with `value: string`, `label: string`, `picked: boolean`. PASS (b) `buildCompletionsModelList(current, chatModel, engineModels)` exported, pure. PASS (c) No `import ... from "vscode"` anywhere in the file (grep exit 1). PASS
- **Behavior contract** — `node -e` spot checks against compiled `out/presets.js`:
  - `("", "", [])` → exactly 1 entry `{value:"", label:"Use chat model (default)", picked:true}`. PASS
  - `("m-a","m-b",["m-c"])` → values `["","m-a","m-b","m-c"]`; `picked:true` only on `m-a`. PASS
  - `("m-b","m-b",["m-c"])` → values `["","m-b","m-c"]`; `picked:true` on `m-b` (dedup current===chat). PASS
  - `("","m-b",["m-b","m-c"])` → values `["","m-b","m-c"]` (engine model == chat model not duplicated). NOTE: `picked:true` lands on the default entry (value "") because `current === ""` — matches the documented contract ("`picked` is true on the entry matching `current` ("" → the default entry)"); the criterion's "no picked anywhere" wording is subsumed by this. PASS
  - `("m-c","",["m-a","m-c"])` → values `["","m-c","m-a"]` (current first among candidates, deduped against engine list); `picked` on `m-c`. PASS
- **Smoke 15a:** 8 genuine `compm-s1:` assertions (lines 2169–2206 of `scripts/smoke-test.js`) exercising the compiled function: default entry shape, picked-on-default, ordering, single picked, current===chat dedup, engine dedup, empty-inputs single entry, picked-false on non-active. Not tautologies. PASS
- **Scope check:** `git status --short` (ignoring `ninfer` submodule marker) → only `src/presets.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md`. PASS


### 1.98-12.S1 — pure `buildCompletionsModelList` in `src/presets.ts` (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **327 assertions** (319 prior + 8 new `compm-s1:` in section 15a).
- **Static:** `CompletionsModelOption` interface (value/label/picked) + `buildCompletionsModelList` exported; `src/presets.ts` remains vscode-free. PASS
- **Behavior spot-checks** (`node -e` on `out/presets.js`): empty inputs → single default entry (picked); `("m-a","m-b",["m-c"])` → `["","m-a","m-b","m-c"]` picked on `m-a`; `current === chatModel` dedup → single picked entry; engine-model/chat-model dedup; current-first ordering with engine dedup. All match documented contract. PASS
- **Smoke 15a:** 8 genuine assertions (not tautologies). PASS
- **Scope check:** only `src/presets.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md` (+ `ninfer` marker, ignored). PASS

### 1.98-12.S2 — `completionsModel` field + InlineCompletionProvider wiring (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **332 assertions** (327 prior + 5 new `compm-s2:` in subsection 15b).
- **Settings field:** `src/presets.ts` `completionsModel: string;` after `folderContextEnabled`; `src/config.ts` `completionsModel: c.get<string>("completions.model", "")`. PASS
- **Provider wiring:** conditional override `const settings = base.completionsModel ? { ...base, model: base.completionsModel } : base;` — buggy unconditional form NOT present; `toolbar`/`buildRequestBody` unchanged; `git diff src/request.ts` empty. PASS
- **Smoke 15b:** 5 genuine static checks (`compm-s2:`), incl. `base.completionsModel` fallback-guard check. PASS
- **Scope check:** only the 5 in-scope files (+ `ninfer` marker, ignored). PASS
- **Note:** fallback bug (unconditional override → empty `model` omitted from request body) found by orchestrator, fixed by Coder before verification.

### 1.98-12.S3 — `llm.changeCompletionsModel` QuickPick command in `src/extension.ts` (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **337 assertions** (332 prior + 5 new `compm-s3:` in subsection 15c; 0 FAIL).
- **Command registration:** `src/extension.ts:124` `vscode.commands.registerCommand("llm.changeCompletionsModel", async () => {` — inside the `context.subscriptions.push(...)` block, immediately after the `llm.commitChanges` registration (line 121). PASS
- **QuickPick list:** `buildCompletionsModelList` imported from `./presets` (line 10); items built at line 136 via `buildCompletionsModelList(current, chatModel, engineModels).map(...)`; default entry (`o.value === ""`) → `label: "$(symbol-inherit) Use chat model (default)"`; `description: o.picked ? "active" : undefined`. PASS
- **Engine-unreachable fallback:** `client.listModels()` wrapped in try/catch (lines 129–135); on failure `showWarningMessage("LLM engine unreachable — showing configured models only.")` and list built from empty `engineModels` (initialized `[]`). PASS
- **Setting write:** `if (!picked) { return; }` cancel no-op (no write, no info message); `target = workspaceFolders ? ConfigurationTarget.Workspace : ConfigurationTarget.Global`; `await cfg.update("completions.model", picked.value, target)`. PASS
- **Smoke 15c:** 5 genuine static assertions (`compm-s3:`, lines 2234–2260) on `src/extension.ts` source: contains `llm.changeCompletionsModel`, `buildCompletionsModelList`, `showQuickPick`, `completions.model`, `ConfigurationTarget.Workspace`. Not tautologies. PASS
- **Scope check:** `git status --short` (ignoring `ninfer` submodule marker) → only `src/extension.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md`. PASS

## Done

- [x] **1.98-1.S1** — webview `command_approval` card — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-1.S2** — host-side `commandApproval` plumbing — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-1.S3** — host: route `run_command` through editable approval gate — **PASS** (2026-10-22, see Verifications)

## Todo

- [x] **1.98-12.S1** — pure `buildCompletionsModelList` — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-12.S2** — `completionsModel` field + provider wiring (fallback fix) — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-12.S3** — `llm.changeCompletionsModel` QuickPick command — **PASS** (2026-10-22, see Verifications)
- [ ] **1.98-12.S2** — next slice of 1.98-12 (completions model quick pick)
- [x] **1.98-1.S4** — webview "modified by user" badge on tool card — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-1.S5** — settings description + smoke test + planner PROGRESS.md — **PASS** (2026-10-22)
- [x] **1.98-1** — fully verified (all slices S1–S5 PASS)
- [x] **1.98-2.S1** — `notebook_edit` tool schema + mutating flag — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-2.S2** — `src/notebook.ts` pure parse/format/create helpers — **PASS** (2026-10-22)
- [x] **1.98-2.S3** — `applyNotebookEdit` (the 5 actions) — **PASS** (2026-10-22)
- [x] **1.98-2.S4** — ToolExecutor: execute `notebook_edit` — **PASS** (2026-10-22)
- [x] **1.98-2.S5** — context: render tagged .ipynb files as cells in `src/context.ts` — **PASS** (2026-10-22)
- [x] **1.98-2.S6** — package.json descriptions + final smoke assertions + PROGRESS.md — **PASS** (2026-10-22)
- [x] **1.98-2** — fully verified (all slices S1–S6 PASS)
- [x] **1.98-8.S1** — `src/context.ts`: `extractCodebaseQuery` + `formatCodebaseSweep` (pure) — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-8.S2** — `src/tools/ToolExecutor.ts`: `codebaseSweep(query)` public method — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-8.S3** — ChatViewProvider: detect `#codebase`, run sweep, inject context — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-8.S4** — package.json settings schema + final smoke assertions + PROGRESS.md — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-8** — fully verified (all slices S1–S4 PASS)
- [x] **1.98-9.S1** — `src/context.ts`: `extractProblemsTag` + `formatProblemsBlock` (pure) — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-9.S2** — `ToolExecutor.collectDiagnostics` shared helper — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-9.S3** — `problemsEnabled` field + `#problems` wiring — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-9.S4** — `package.json`: `llm.chat.problems.enabled` + final smoke assertions — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-9** — fully verified (all slices S1–S4 PASS)
- [x] **1.98-10.S1** — `src/context.ts`: `extractFolderTag` + `formatFolderBlock` + `FOLDER_BLOCK_MAX_CHARS` (pure) — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-10.S2** — `ToolExecutor.folderSweep(folderName)` — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-10.S3** — `folderContextEnabled` field + `#folder:` chat wiring — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-10.S4** — `package.json` settings schema + smoke 14d + planner memory — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-10** — `#folder:` tag — **fully verified** (all slices S1–S4 PASS, 2026-10-22)
- [x] **1.98-12.S1** — pure `buildCompletionsModelList` — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-12.S2** — `completionsModel` field + provider wiring (fallback fix) — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-12.S3** — `llm.changeCompletionsModel` QuickPick command — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-10.S4** — `package.json`: `llm.chat.folderContext.enabled` + smoke 14d + planner memory — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-10** — fully verified (all slices S1–S4 PASS)
- [ ] For each item: run build, run smoke test, exercise acceptance checks, record verdict.

## Notes / decisions

- The tester does NOT write code. If a bug is found, report it (exact error, file, line) so
  the Coder can fix it.
- Always run the build first. If it fails, report fail immediately.
- Always run the smoke test. Record the assertion count.
- Report, don't fix.

### 1.98-2.S2 — `src/notebook.ts` pure parse/format/create helpers (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED (196 assertions; 17 new `notebook:` green). Static checks a–d PASS (pure module, null on bad JSON/missing cells, string[] join, nbformat-4 re-parse, `<<<CELL>>>` split, fence switching). Scope: only `src/notebook.ts` (new) + `scripts/smoke-test.js` (+88).

### 1.98-2.S3 — `applyNotebookEdit` (the 5 actions) (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED (24 new `notebook-edit:` assertions green, incl. 4 error cases). Static checks a–d PASS: 5 actions + unknown→ok:false; cellIndex integer in [0,cells.length) for modify/delete/change, clamped [0,cells.length] for insert (undefined→append), range in error messages; mutations re-serialize raw doc via `parseNotebookRaw` + `JSON.stringify(raw, null, 1)` (non-`cells` fields preserved); `modify_cell` requires source, `change_cell_type` requires valid cellType. Scope: only `src/notebook.ts` (+166) + `scripts/smoke-test.js` (+185) among source files.

### 1.98-2.S4 — ToolExecutor: execute `notebook_edit` (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED; 16 `nb-exec:` assertions green. Static checks a–d PASS: case in execute() with coerced args; resolveSafe + snapshot system (lastSnapshot/recordSnapshot/recordChange); ok:false returns before any snapshot/write; git diff = 3 additive hunks (+61/-0). Scope: only ToolExecutor.ts (+61) + smoke-test.js (+172).

### 1.98-2.S5 — context: render tagged .ipynb files as cells (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED (241 assertions); 5 new `context:` notebook assertions green. Static checks a–b PASS: `formatNotebookForContext` imported from ./notebook, used only for case-insensitive `.ipynb` in taggedFiles loop; non-.ipynb raw fenced block unchanged (+9/-1). Scope: only context.ts + smoke-test.js (+54).

### 1.98-2.S6 — package.json descriptions + final smoke assertions + PROGRESS.md (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED (245 assertions; 4 new `nb-final:` green). Static checks 3–6 PASS: package.json single 1-line hunk (requireApproval lists notebook_edit); 4 new assertions are genuine feature references; planner PROGRESS.md marks 1.98-2 Done, next → 1.98-8; scope = package.json (±1) + smoke-test.js (+33) + memory files only.
- **Item 1.98-2 fully verified (S1–S6 all PASS).**

### 1.98-8.S1 — `src/context.ts`: `extractCodebaseQuery` + `formatCodebaseSweep` (pure) (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED (**257 assertions**; 12 new `codebase:` green in section `// 12) codebase sweep (1.98-8)`).
- Static checks in `src/context.ts`: (a) `extractCodebaseQuery(text: string): string | null` — regex `/#codebase(?!\w)/i` (case-insensitive, word-bounded; `#codebasefoo` no match); null when absent, "" for bare tag, trimmed same-line remainder. (b) `CodebaseSweepData` interface with `structure`, `gitStatus`, `search`. (c) `formatCodebaseSweep(data, query?)` — header `Codebase sweep (query: <q|none>)`; three `###` headers in order; placeholders `(clean or not a git repo)` / `(no matches)`; 12,000-char cap with `… (truncated)`; `""` only when all-empty AND no query. (d) Purity: no `vscode` import. All PASS.
- Scope: only `src/context.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md` (+ ninfer marker). PASS

### 1.98-8.S2 — `src/tools/ToolExecutor.ts`: `codebaseSweep(query)` public method (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED (**262 assertions**; 5 new `codebase-s2:` green in subsection `// 12b) codebase sweep (1.98-8.S2)`).
- Static checks: (a) `private async searchMatches(pattern, rootAbs, cap): Promise<string[]>` — shared recursive walk, SKIP_DIRS, regex with literal fallback, `relPath:line: text` lines, stops at cap. (b) `searchFiles` delegates to `searchMatches(pattern, rootAbs, MAX_SEARCH_MATCHES)`; cap 50 + truncation suffix preserved; diff confirms pure extraction. (c) `public async codebaseSweep(query)` — structure walk depth ≤ 3, SKIP_DIRS, `name/` dirs / `name` files, 2-space indent, 100-entry cap + `… (truncated at 100 entries)`, `"(no workspace folder)"` fallback; git status via `gitStatusText()` with `git exited` → `""` and 50-line cap; search via `searchMatches(query, rootAbs, 20)` only when non-blank; composes `formatCodebaseSweep` from `../context`. All PASS.
- Scope: only `src/tools/ToolExecutor.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md` (+ ninfer marker). PASS

### 1.98-8.S3 — `src/chat/ChatViewProvider.ts`: detect `#codebase`, run sweep, inject context (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED (**266 assertions**; 4 new `codebase-s3:` in subsection `// 12c) codebase sweep (1.98-8.S3)`).
- ChatViewProvider (git diff +20/-1, 3 hunks): (a) `extractCodebaseQuery` added to `../context` import. (b) In `runStream` after `buildContextBlock(ctxInput)`: guarded by `settings.codebaseSearchEnabled && lastUser && this.toolExecutor`; `extractCodebaseQuery(lastUser.content) !== null` → `await this.toolExecutor.codebaseSweep(q)`; non-empty result appended with `"\n\n"` separator into `finalContextBlock`. (c) `composeSystemPrompt` receives `finalContextBlock`; `buildContextBlock` section order untouched. (d) `this.toolExecutor` in guard — no crash path. All PASS.
- `src/presets.ts`: `LlmSettings` gains `codebaseSearchEnabled: boolean;`. PASS
- `src/config.ts`: `readSettings()` returns `codebaseSearchEnabled: c.get<boolean>("chat.codebaseSearch.enabled", true)`. PASS
- No regression: `@file` tagged-file path and rest of `runStream` untouched. PASS
- Scope: only `src/chat/ChatViewProvider.ts`, `src/config.ts`, `src/presets.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md` (+ ninfer marker). PASS

### 1.98-8.S4 — package.json settings schema + final smoke assertions + PROGRESS.md (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED (**270 assertions**; 4 new `codebase-s4:` in subsection `// 12d) codebase sweep (1.98-8.S4)`).
- package.json: single additive hunk (+5/-0) adding `llm.chat.codebaseSearch.enabled` (`type: "boolean"`, `default: true`, description mentions `#codebase`); no other settings changed.
- 4 new smoke assertions genuine: parsed package.json type/default checks + source-content checks on `src/config.ts` and `src/chat/ChatViewProvider.ts`.
- Planner PROGRESS.md: `# Plan: 1.98-8` marked Done (S1–S4 annotated); Next step → 1.98-9 (`#problems`).
- Spot-check: `runStream` gates on `settings.codebaseSearchEnabled && lastUser && this.toolExecutor`; `extractCodebaseQuery(lastUser.content) !== null` → `codebaseSweep(q)` appended after `buildContextBlock` output; setting false → tag inert. PASS.
- Scope: only `package.json`, `scripts/smoke-test.js`, coder + planner PROGRESS.md (+ ninfer marker). PASS
- **Item 1.98-8 fully verified (S1–S4 all PASS).**

### 1.98-9.S1 — `src/context.ts`: `extractProblemsTag` + `formatProblemsBlock` (pure) (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED (**280 assertions**; 10 new `problems:` green in section `// 13) problems tag (1.98-9)` / subsection `13a`).
- Static checks: (a) `extractProblemsTag(text: string): string | null` — regex `/#problems(?!\w)/i` (case-insensitive, word-bounded); first match; trimmed same-line remainder; `""` bare tag; null absent. (b) `ProblemsBlockData` interface with `text: string`. (c) `export const PROBLEMS_BLOCK_MAX_CHARS = 8000`. (d) `formatProblemsBlock(data, scope?)` — header `Problems (scope: workspace)` default / `Problems (scope: <scope>)`; body text or `(no problems — clean)`; 8,000-char truncation + `… (truncated)`; `""` only when text empty AND default scope. (e) Purity: no `vscode` import. All PASS.
- Scope: only `src/context.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md` (+ ninfer marker). PASS

### 1.98-12.S2 — `completionsModel` setting field + InlineCompletionProvider wiring (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **332 assertions** (327 prior + 5 new `compm-s2:`; 0 FAIL).
- **Settings field:** `src/presets.ts` `LlmSettings` gains `completionsModel: string;` immediately after `folderContextEnabled` (+ doc comment). `src/config.ts` `readSettings()` returns `completionsModel: c.get<string>("completions.model", "")` (single additive line). PASS
- **Provider wiring (`src/inline/InlineCompletionProvider.ts`, git diff = 1 hunk, +6/−1):** (a) override is CONDITIONAL — `const base = readSettings(); const settings = base.completionsModel ? { ...base, model: base.completionsModel } : base;` — the buggy unconditional `{ ...base, model: base.completionsModel }` is NOT present (empty `llm.completions.model` keeps `llm.model` fallback). PASS (b) `const toolbar = { ...this.toolbarStore.get(), thinking: "off" as const };` and `buildRequestBody({ settings, toolbar }, [...])` unchanged (context lines in diff). PASS (c) `git diff src/request.ts` → empty (0 lines). PASS
- **Smoke 15b:** 5 genuine static checks labeled `compm-s2:` — `presetsSrc` contains `completionsModel`; `configSrc` contains `completions.model`; `inlineSrc` contains `completionsModel`; `inlineSrc` contains `buildRequestBody(`; `inlineSrc` contains `base.completionsModel` (fallback guard). Not tautologies. PASS
- **Scope check:** `git status --short` (ignoring `ninfer` submodule marker) → only `src/presets.ts` (+2), `src/config.ts` (+1), `src/inline/InlineCompletionProvider.ts` (+6/−1), `scripts/smoke-test.js` (+26), `.github/agents/coder/PROGRESS.md`. PASS
- **Note:** the fallback bug (unconditional `model: base.completionsModel` → empty string omits `model` from the request body, breaking the `llm.model` fallback) was found by the orchestrator and fixed by the Coder (conditional override) BEFORE this verification. Verified state is the FIXED one.
