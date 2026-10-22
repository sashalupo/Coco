# Planner — Progress Memory

> **This file is the agent's persistent memory.** The `Planner` agent
> (`.github/agents/planner.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Turn each changelog feature (from the Changelog Researcher's backlog) into a concrete,
step-by-step implementation plan for the `llm` VS Code extension. The planner does NOT write
code — only the Coder writes code.

## Status

- **Current item:** 1.98-12 (Change completions model) — **Planned** (2026-10-22, slices S1–S4)
- **Next step:** dispatch Coder for slice 1.98-12.S1
- **Last updated:** 2026-10-22
- **Last commit:** — (no planner commits yet)
- **Build state:** n/a (planner does not build)

## Backlog pointer

The ordered backlog (oldest → newest) lives in
`.github/agents/changelog-researcher/PROGRESS.md`. The planner plans the **first pending
item** (the oldest) that the orchestrator dispatches.

## Plans

### Item 1.98-1 — Editable terminal command approval in chat (planned 2026-10-22) — **Done** (2026-10-22, slices S1–S5 complete)

**Changelog reference:** VS Code 1.98, "Agent mode improvements" — terminal commands shown
inline in the chat response; user can edit the suggested command before running; Ctrl+Enter
confirms.

**Design decisions (justified):**
1. **Reuse `llm.tools.requireApproval`** (no new setting). `run_command` is already classified
   as mutating by `isMutatingTool()` (src/tools.ts ~line 328), so it already flows through the
   approval gate when the setting is on. Setting off → `run_command` runs immediately (no
   behavior change).
2. **New message pair** `command_approval` (host→webview) / `commandApproval` (webview→host)
   instead of reusing `approval_request`/`toolApproval`, because the command card needs an
   **editable input** and must return the (possibly edited) command string. Existing pair
   untouched → `write_file`/`edit_file` approval unaffected.
3. **Host-side command substitution:** on approval the host rewrites
   `call.function.arguments` with the edited command before `toolExecutor.execute(call)`. If
   edited, the tool result content is prefixed with a note and the `tool_result` postMessage
   carries `modified: true` so the webview can badge the card.
4. **Ctrl+Enter** handled in the webview only (keydown on the input); no VS Code keybinding.

**Slices:**

- **1.98-1.S1 — Webview: `command_approval` card (editable input, Run/Cancel, Ctrl+Enter).**
  File: `src/chat/webview.ts`. In `handleHostMessage`, add `case 'command_approval':` sibling
  to `approval_request` (~line 1906). Build a `.message.command-approval` card: role line
  "Run command?", a `<textarea class="cmd-input">` (rows≈2, monospace) pre-filled with
  `msg.command` (set via `.value`, never innerHTML), actions row with `Run` (`.cmd-run`) and
  `Cancel` (`.cmd-cancel`) buttons + a hidden `.status` div. `decide(approved)`: guard
  double-decide, disable both buttons, set status text, then
  `vscode.postMessage({ type: 'commandApproval', id: msg.id, approved, command: inputEl.value })`.
  Wire `click` on both buttons and `keydown` on the input: `e.key === 'Enter' && e.ctrlKey`
  → `e.preventDefault(); decide(true)`. Focus the input and select the text on render. Add
  minimal CSS for `.command-approval .cmd-input` (monospace, full width) and
  `.cmd-run`/`.cmd-cancel` reusing existing `.approve`/`.reject` styles.
  Acceptance: `npm run compile` passes; card renders with editable command; Ctrl+Enter and
  Run post `commandApproval` with the (edited) command; Cancel posts `approved: false`;
  buttons disable after deciding.

- **1.98-1.S2 — Host: `commandApproval` message handler + `waitForCommandApproval`.**
  File: `src/chat/ChatViewProvider.ts`. (a) In `onMessage` switch (~line 176) add
  `case "commandApproval": this.pendingCommandApproval?.(msg.approved === true, String(msg.command ?? "")); break;`.
  (b) Add field `private pendingCommandApproval: ((approved: boolean, command: string) => void) | null = null;`
  next to `pendingApproval` (~line 85). (c) Add
  `private waitForCommandApproval(signal: AbortSignal): Promise<{ approved: boolean; command: string }>`
  mirroring `waitForApproval` (~line 640): resolves `{approved:false, command:""}` on abort;
  stores the resolver in `pendingCommandApproval`.
  Acceptance: `npm run compile` passes; no behavior change yet.

- **1.98-1.S3 — Host: route `run_command` through the editable approval gate.**
  File: `src/chat/ChatViewProvider.ts`. In the agentic loop's tool-call `for` (~line 988–1008):
  when `settings.requireApproval && isMutating`, branch on
  `call.function.name === "run_command"`: parse `call.function.arguments` JSON, extract
  `command`; post `{ type: "command_approval", id: call.id, tool: "run_command", command }`;
  `const { approved, command: edited } = await this.waitForCommandApproval(signal);`.
  Rejected → push the existing "User rejected…" `toolResultMessage` and `continue`. Approved →
  if `edited.trim()` differs from the original command, set
  `call.function.arguments = JSON.stringify({ ...parsed, command: edited })` and remember
  `commandModified = true`. Non-`run_command` mutating tools keep the existing
  `approval_request` path unchanged. After `toolExecutor.execute(call)`, if `commandModified`,
  prefix `result.content` with `"Note: the user modified the command before running it.\n"`
  and include `modified: true` in the `tool_result` postMessage.
  Acceptance: `npm run compile` passes; setting on → editable card, edited command executes
  (visible in `$ <cmd>` output line), model told of modification; Cancel rejects;
  `write_file`/`edit_file` unchanged; setting off → immediate run, no card.

- **1.98-1.S4 — Webview: "modified by user" badge on the tool card.**
  File: `src/chat/webview.ts`. In `case 'tool_result':` (~line 1979), when
  `msg.modified === true`, append `<span class="tool-modified">modified by user</span>` next
  to the tool name in the card's summary (both found-card and fallback-card branches). Add a
  one-line CSS rule for `.tool-modified` (muted accent color, small font).
  Acceptance: `npm run compile` passes; modified `run_command` card shows the badge;
  unmodified cards do not.

- **1.98-1.S5 — Settings description + smoke test + PROGRESS.md.**
  Files: `package.json`, `scripts/smoke-test.js`, `.github/agents/planner/PROGRESS.md`.
  (a) `package.json`: update the `llm.tools.requireApproval` description to "Require user
  approval before mutating tools (write_file, edit_file, run_command) are applied.
  run_command shows an editable command card (Ctrl+Enter to run)." (b) `smoke-test.js`: add
  assertions that the webview HTML contains `command_approval` handling and the
  `commandApproval` postMessage type, and that `ChatViewProvider` source contains
  `waitForCommandApproval`. (c) `PROGRESS.md`: mark 1.98-1 Done, update Status/Next step.
  Acceptance: `npm run compile` + `node scripts/smoke-test.js` pass; PROGRESS.md in sync.

**Overall acceptance (Tester):** with `llm.tools.requireApproval: true`, a `run_command` tool
call renders an inline card with the command in an editable input; Run / Ctrl+Enter executes
the (possibly edited) command and the tool output shows the executed command; if edited, the
model is told and the card is badged; Cancel rejects and the model is told; with the setting
`false`, `run_command` runs immediately with no card; `write_file`/`edit_file` approval
unchanged; `npm run compile` clean.

**Risks:** multi-line commands OK (textarea + `shell: true`); empty edited command →
`ToolExecutor.runCommand` already returns an "empty command" error; abort while pending →
`waitForCommandApproval` resolves rejected (matches `waitForApproval`).


## Done

- **1.98-10** (2026-10-22) — `#folder:` tag: attach a folder's file tree as chat context. All slices S1–S4
  implemented (`extractFolderTag`/`formatFolderBlock` pure helpers in `src/context.ts`; `ToolExecutor.folderSweep`
  file-tree sweep (depth ≤ 3, cap 100 entries, no contents); `ChatViewProvider.runStream` injects the folder block
  after the `#problems` block, gated on `llm.chat.folderContext.enabled` (default true); `package.json` settings
  schema entry; final smoke assertions). Key decisions:
  1. **Tag-only scope** — no paperclip/drag-and-drop (single webview, no attachment UI).
  2. **File tree only** — no file contents (that's `read_file`'s job); mirrors `codebaseSweep`'s structure walk.
  3. **Bounded output** — 100 entries (sweep) + 8,000 chars (formatting, `… (truncated)` suffix).
  4. **No fallback for bad folder names** — renders `(folder not found: <name>)` so the model sees the error;
     bare `#folder` sweeps the workspace root (never a silent no-op).
  5. **`folderContextEnabled` config field pulled into S3** so that slice compiles standalone; S4 only added the
     `package.json` schema entry + final smoke assertions.
- **1.98-9** (2026-10-22) — `#problems` tag: attach compiler/linter problems as chat context. All slices S1–S4
  implemented (`extractProblemsTag`/`formatProblemsBlock` pure helpers in `src/context.ts`; `ToolExecutor.collectDiagnostics`
  extracted from `getDiagnostics` with a 50-problem cap; `ChatViewProvider.runStream` injects the problems block after the
  `#codebase` block, gated on `llm.chat.problems.enabled` (default true), with qualifier path-rejection → workspace fallback;
  `package.json` settings schema entry; final smoke assertions). Key decisions:
  1. **Tag-only scope** — no paperclip/drag-and-drop (single webview, no attachment UI).
  2. **Reuses diagnostics collection** — `collectDiagnostics` is the extracted `getDiagnostics` core; the `get_diagnostics`
     tool output is unchanged (thin wrapper).
  3. **Bounded output** — 50 problems (collection) + 8,000 chars (formatting, `… (truncated)` suffix).
  4. **`problemsEnabled` config field pulled into S3** so that slice compiles standalone; S4 only added the `package.json`
     schema entry + final smoke assertions.
- **1.98-1** (2026-10-22) — Editable terminal command approval in chat. All slices S1–S5
  implemented and committed (webview `command_approval` card with editable command +
  Ctrl+Enter; host `commandApproval` handler + `waitForCommandApproval`; agentic loop routes
  `run_command` through the editable gate with edited-command rewrite + "modified by user"
  badge; settings description updated; smoke-test source assertions added).
- **1.98-8** (2026-10-22) — `#codebase` tag: advanced codebase search in chat. All slices S1–S4
  implemented (`extractCodebaseQuery`/`formatCodebaseSweep` pure helpers in `src/context.ts`;
  `ToolExecutor.codebaseSweep` gathering project structure + git status + text search via shared
  `searchMatches`; `ChatViewProvider.runStream` injects the sweep after the `@file` block, gated on
  `llm.chat.codebaseSearch.enabled` (default true); `package.json` settings schema entry; final smoke
  assertions). Key decisions:
  1. **No embeddings/semantic search** — the paid-service sub-item was dropped; the sweep reuses
     existing ToolExecutor logic (structure walk, `gitStatusText`, `searchMatches`).
  2. **Sweep runs regardless of `llm.tools.enabled`** — it is context injection, not tool calling;
     the only gate is the new setting.
  3. **`codebaseSearchEnabled` config field pulled into S3** so that slice compiles standalone; S4
     only added the `package.json` schema entry + final smoke assertions.
- **1.98-2** (2026-10-22) — Notebook support in chat. All slices S1–S6 implemented
  (`notebook_edit` tool with 5 actions; pure `src/notebook.ts` parse/format/create/apply
  module; `ToolExecutor` executes it with snapshot/revert; tagged `.ipynb` files render
  cell-by-cell in context; `requireApproval` description updated; final smoke assertions
  added). Key decisions:
  1. **Single `notebook_edit` tool with 5 actions** (`create`, `modify_cell`, `insert_cell`,
     `delete_cell`, `change_cell_type`) instead of one tool per action — keeps the tool list
     small for weaker local engines; multi-cell `create` uses the `<<<CELL>>>` text marker.
  2. **Plain-text cell-change summary** (e.g. `Modified cell 2 (code): 42 chars of source.`)
     as the tool result instead of a JSON line diff — a diff on raw `.ipynb` JSON is noisy
     and unhelpful to the model.
  3. **No host/webview changes** — `isMutatingTool("notebook_edit")` is `true`, so the
     existing generic `approval_request` gate in `ChatViewProvider.ts` picks the tool up
     with zero new host or webview code (verified by a final smoke assertion).

## Todo

- [x] Wait for the Changelog Researcher to populate the backlog.
- [x] Plan backlog item 1.98-1 (editable terminal command approval) — planned 2026-10-22.
- [x] Dispatch slices 1.98-1.S1 → S5 (one per session).
- [x] Plan backlog item 1.98-2 (notebook support in chat) — planned 2026-10-22; slices S1–S6 dispatched and done.
- [x] Plan backlog item 1.98-8 (`#codebase` tag — advanced codebase search; drop the embeddings sub-item) — planned 2026-10-22; slices S1–S4 dispatched and done.
- [x] Plan backlog item 1.98-9 (`#problems` tag) — planned 2026-10-22; slices S1–S4 dispatched and done.
- [x] Plan backlog item 1.98-10 (`#folder:` tag) — planned 2026-10-22; slices S1–S4 dispatched and done.
- [x] Plan backlog item 1.98-12 (Change completions model) — planned 2026-10-22; slices S1–S4 ready for dispatch.
- [ ] For each dispatched item: study the changelog entry (text + images), ground the plan in
      the real codebase, break it into tiny slices (one file / one concern each), write the
      plan, record it here.

## Notes / decisions

- The planner does NOT write code. Only the Coder writes code.
- Every plan must reference real file paths and existing patterns (read the relevant source
  files read-only first).
- Every slice must touch **at most one file and one concern** and be independently compilable
  (`npm run compile`) and committable. The orchestrator dispatches ONE slice per session, so
  keep slices tiny to limit token consumption.
- Always plan oldest → newest. Never skip ahead.

---

# Plan: 1.98-2 — Notebook support in chat — **Done** (2026-10-22, slices S1–S6 complete)

**Changelog reference:** VS Code 1.98 — "Notebook support in Copilot Edits (Preview): edit notebook files from chat — create notebooks, modify content across multiple cells, insert/delete cells, change cell types."

## Approach

Notebooks are plain JSON (`.ipynb`, nbformat 4), so with zero dependencies we add **one mutating tool, `notebook_edit`**, with an `action` parameter (`create` | `modify_cell` | `insert_cell` | `delete_cell` | `change_cell_type`) that parses the `.ipynb` JSON, mutates the `cells` array, and writes it back. All pure parse/format/mutate logic lives in a new dependency-free module `src/notebook.ts` (independently testable from `scripts/smoke-test.js` against compiled `out/`), while `ToolExecutor` handles the vscode-specific parts (path safety, snapshot/revert, write). Because `isMutatingTool("notebook_edit")` returns `true`, the existing boolean `approval_request` gate in `ChatViewProvider.ts` picks it up **with zero changes to the host or webview** — the generic approval card already renders tool name + args. Context: when a `.ipynb` is tagged via `@filename`, `buildContextBlock` renders a cell-by-cell text view (source + output summary) instead of raw JSON. The tool result includes a plain-text summary of the cell change (the existing line diff on raw JSON is noisy, so a summary is the primary feedback, per the design direction).

## Slices

### S1 — `notebook_edit` tool schema + mutating flag
- **File:** `src/tools.ts`
- **What:** Add a `notebook_edit` entry to `CODE_TOOLS` (after `manage_todos`):
  - `description`: "Edit a Jupyter notebook (.ipynb) file. Actions: `create` (create a new notebook with the given cells), `modify_cell` (replace a cell's source), `insert_cell` (insert a new cell at cell_index), `delete_cell` (remove a cell), `change_cell_type` (switch a cell between `code` and `markdown`). Cell indices are 0-based. Use this instead of write_file/edit_file for .ipynb files."
  - `parameters.properties`: `path` (string, workspace-relative `.ipynb` path), `action` (string, enum of the 5 actions), `cell_index` (number, 0-based; required for modify/delete/change_cell_type; for insert_cell the new cell takes this index), `cell_type` (string, enum `code`|`markdown`, for create/insert/change_cell_type), `source` (string, cell source text; for create, multiple cells are separated by a documented marker — use `\n<<<CELL>>>\n` between cells).
  - `required: ["path", "action"]`.
  - Extend `isMutatingTool()`: `name === "notebook_edit"`.
- **Acceptance:** `npm run compile` passes. Smoke test (extend section 5 + 7b): `CODE_TOOLS.length === 11`; tool-name order string ends with `...,manage_todos,notebook_edit`; `byName.notebook_edit.function.parameters.required.join(",") === "path,action"`; `action` enum has 5 values; `isMutatingTool("notebook_edit")` is true.

### S2 — `src/notebook.ts`: pure parse / format / create helpers
- **File:** `src/notebook.ts` (new)
- **What:** Pure module, no `vscode` import, no deps:
  - `interface NbCell { cell_type: "code" | "markdown"; source: string; outputs?: unknown[]; }` and `interface NbDoc { cells: NbCell[]; }` (source normalized to a single string — join `string[]` sources).
  - `parseNotebook(text: string): NbDoc | null` — JSON.parse, validate `cells` is an array, normalize each cell's `source` (string | string[]) to a string; return `null` on any failure.
  - `formatNotebookForContext(text: string): string` — human-readable rendering: per cell `### Cell N (code|markdown)` + source in a fenced block + one-line output summary (e.g. `outputs: 2 (stream, error)` or `outputs: none`); returns a clear error string when `parseNotebook` fails.
  - `createNotebook(source: string): string` — build a minimal valid nbformat-4 `.ipynb` JSON string (nbformat 4, nbformat_minor 5, empty metadata, `language_info` for code cells); splits `source` on the `<<<CELL>>>` marker into cells.
- **Acceptance:** `npm run compile` passes. Smoke test (new section, e.g. `// 10) notebook helpers (1.98-2)`): `parseNotebook` round-trips a 2-cell doc (string and string[] sources); `parseNotebook("not json") === null`; `formatNotebookForContext` output contains `Cell 0 (code)`, the source text, and an `outputs:` line; `createNotebook` output parses via `parseNotebook` with the expected cell count/types.

### S3 — `src/notebook.ts`: `applyNotebookEdit` (the 5 actions)
- **File:** `src/notebook.ts`
- **What:** Add `applyNotebookEdit(text: string, edit: { action: string; cellIndex?: number; cellType?: "code" | "markdown"; source?: string }): { ok: boolean; message: string; newContent?: string }`:
  - `create`: ignore `text`; `newContent = createNotebook(source ?? "")`; message `Created notebook with N cell(s).`
  - `modify_cell` / `delete_cell` / `change_cell_type`: parse existing (error message if invalid JSON or not a notebook), validate `cellIndex` is an integer in `[0, cells.length)` (error message includes valid range), mutate, `newContent = JSON.stringify(doc, null, 1)`.
  - `insert_cell`: parse existing; `cellIndex` clamped to `[0, cells.length]`; splice in a new cell (`outputs: []` for code); message states new index + total.
  - Messages are plain-text summaries of the cell change (e.g. `Modified cell 2 (code): 42 chars of source.`) — this is what the engine and the approval card see.
- **Acceptance:** `npm run compile` passes. Smoke test: each of the 5 actions succeeds on a fixture doc (assert resulting `parseNotebook` cell count/types/source); error cases return `ok: false` with a message: bad JSON, out-of-range `cell_index`, missing `source` for `modify_cell`, unknown action.

### S4 — `ToolExecutor`: execute `notebook_edit`
- **File:** `src/tools/ToolExecutor.ts`
- **What:**
  - Import `applyNotebookEdit` from `../notebook`.
  - Add `case "notebook_edit":` in `execute()` → `this.notebookEdit(call, String(args.path ?? ""), String(args.action ?? ""), typeof args.cell_index === "number" ? args.cell_index : undefined, args.cell_type === "code" || args.cell_type === "markdown" ? args.cell_type : undefined, typeof args.source === "string" ? args.source : undefined)`.
  - New private `notebookEdit(...)`: `resolveSafe` (reject outside-workspace); read old content if the file exists (empty + `existed=false` otherwise); call `applyNotebookEdit`; on `ok: false` return the error as the `ToolResult` (no write, no snapshot); on success set `this.lastSnapshot` + `recordSnapshot(relPath, oldContent, existed)`, `mkdir` parent, write `newContent`, `recordChange`, and return `Wrote ${relPath} — ${message}` (plain-text summary; skip `unifiedDiff` on raw JSON — it's noisy, per design direction).
- **Acceptance:** `npm run compile` passes. Smoke test (new section, mirroring the `write_file`/`edit_file` executor tests): in a temp workspace, `notebook_edit` `create` writes a valid `.ipynb` (file exists, `parseNotebook` OK); `modify_cell` + `insert_cell` + `delete_cell` + `change_cell_type` mutate it correctly; out-of-range index leaves the file untouched; `revertLast()` restores pre-mutation content; `getChangeSummary()` includes the `.ipynb` path.

### S5 — Context: render tagged `.ipynb` files as cells
- **File:** `src/context.ts`
- **What:** Import `formatNotebookForContext` from `./notebook`. In `buildContextBlock`, in the `taggedFiles` loop: when `tf.path.toLowerCase().endsWith(".ipynb")`, emit the header + `formatNotebookForContext(tf.content)` instead of the raw-JSON fenced block. (The `ChatViewProvider` tagged-file reader already reads any file as utf8 — no host change needed.)
- **Acceptance:** `npm run compile` passes. Smoke test (extend section 3b): `buildContextBlock({ taggedFiles: [{ path: "nb.ipynb", content: <fixture json> }] })` contains `Tagged file: nb.ipynb`, `Cell 0 (code)`, and does **not** contain the raw `"cells":` JSON key; a non-`.ipynb` tagged file still renders the raw fenced block.

### S6 — package.json descriptions + final smoke assertions + PROGRESS.md
- **Files:** `package.json`, `scripts/smoke-test.js`, `.github/agents/planner/PROGRESS.md`
- **What:**
  - `package.json`: update `llm.tools.requireApproval` description to list `notebook_edit` alongside `write_file, edit_file, run_command`; optionally extend the top-level extension `description` with "edit Jupyter notebooks from chat".
  - `scripts/smoke-test.js`: add a final static section (mirroring the 1.98-1 section 9) asserting `package.json` contains `notebook_edit` in the `requireApproval` description, and that `ChatViewProvider.ts` still routes mutating tools through `approval_request` (i.e. `isMutatingTool` is the single gate — no notebook-specific host code was added).
  - `PROGRESS.md`: mark 1.98-2 Planned→(after slices land) Done; record decisions (single `notebook_edit` tool, plain-text summary instead of JSON diff, no host/webview changes).
- **Acceptance:** `npm run compile` passes; `node scripts/smoke-test.js` prints `ALL SMOKE TESTS PASSED` including all new notebook assertions.

## Overall acceptance criteria (Tester)

1. `npm run compile` clean; `node scripts/smoke-test.js` fully green.
2. In a live session with `llm.tools.requireApproval` on: asking the model to create/modify a notebook posts a generic `approval_request` card showing `notebook_edit` + args; Approve applies the change, Reject feeds the standard "user rejected" tool result.
3. `@notebook.ipynb` in a chat message injects a cell-by-cell text view (not raw JSON) into the system prompt.
4. Notebook mutations participate in the existing per-run snapshot system: revert-last, revert-all, and the change-summary footer all work on `.ipynb` files.

## Risks / open questions

- **`read_file` on `.ipynb`** still returns raw JSON. Acceptable for this item (the model is told to use `notebook_edit`); a follow-up could make `read_file` auto-format notebooks.
- **Multi-cell `create`/`insert`** uses a `<<<CELL>>>` text marker rather than a JSON array, to keep the schema simple for weaker local engines; if engines struggle, a follow-up could add an optional `cells` array param.
- **Diff preview:** the existing line diff on raw JSON is intentionally skipped in favor of a plain-text cell-change summary (permitted by the design direction). The webview's tool-result rendering is unchanged.
- **Cell metadata/metadata preservation:** `applyNotebookEdit` preserves all existing notebook fields (it only touches `cells`); new cells get minimal metadata. No nbformat validation beyond `cells` array shape — engines produce valid-enough output for VS Code's notebook renderer.

**Slice count:** 6 (S1–S6), each ≤1 source file + its smoke-test additions, independently compilable/committable. No host (`ChatViewProvider.ts`) or webview changes required — the approval gate is inherited via `isMutatingTool`.

# Plan: 1.98-8 — `#codebase` tag: advanced codebase search in chat (Planned 2026-10-22) — **Done** (2026-10-22, slices S1–S4 complete)

**Changelog:** VS Code 1.98 — "More advanced codebase search in Copilot Chat (`#codebase`)". Embeddings-based semantic search sub-item DROPPED (paid service).

## Decisions
1. Setting: `llm.chat.codebaseSearch.enabled` (boolean, default `true`); read as `codebaseSearchEnabled`. When false, `#codebase` is inert.
2. Sweep REUSES existing ToolExecutor logic via new public `codebaseSweep(query: string): Promise<string>`: project structure (SKIP_DIRS, depth ≤ 3, cap 100 entries), git status (reuse `gitStatusText()`, cap 50 lines, `git exited…` → ""), text search (shared private `searchMatches(pattern, rootAbs, cap)` extracted from `searchFiles`; sweep cap 20, tool keeps 50). Total block cap 12,000 chars with `… (truncated)` suffix.
3. Workspace symbol search DROPPED (no symbol provider; model has search tools in the loop).
4. `extractCodebaseQuery(text): string | null` — null = tag absent; "" = tag with no query; else trimmed same-line remainder. Case-insensitive, word-bounded (`#codebasefoo` no match).
5. Sweep runs regardless of `llm.tools.enabled` (context injection, not tool calling); only gate is the new setting.
6. Injection in `ChatViewProvider.runStream` after the `@file` block: append `Codebase sweep:` section after `buildContextBlock` output.
7. Pure formatting in `src/context.ts` (`formatCodebaseSweep`); ToolExecutor only gathers raw data.

## Slices
- **S1** `src/context.ts`: `extractCodebaseQuery` (string | null) + `CodebaseSweepData` interface + `formatCodebaseSweep(data, query?)` — stable block with `### Project structure` / `### Git status (modified files)` / `### Search: <query>` headers, placeholders for empty fields, 12,000-char truncation, `""` when all empty. Smoke section `// 12) codebase sweep (1.98-8)`. — Done (2026-10-22)
- **S2** `src/tools/ToolExecutor.ts`: public `codebaseSweep(query)` — structure walk (depth ≤ 3, cap 100), `gitStatusText()` (cap 50 lines, `git exited` → ""), search via new private `searchMatches` (cap 20; `searchFiles` refactored to use it, cap 50); composes `formatCodebaseSweep`. Static smoke: source contains `codebaseSweep(`, `formatCodebaseSweep`, `gitStatusText`; `searchMatches(` ≥ 2 occurrences. — Done (2026-10-22)
- **S3** `src/chat/ChatViewProvider.ts`: in `runStream` after `@file` block — if `settings.codebaseSearchEnabled` and tag present, `codebaseBlock = await this.toolExecutor.codebaseSweep(q)`; append to contextBlock. Import `extractCodebaseQuery`. Static smoke: source contains `extractCodebaseQuery` and `codebaseSweep(`. — Done (2026-10-22; `codebaseSearchEnabled` in `readSettings()`/`LlmSettings` pulled into S3 so the slice compiles standalone)
- **S4** `package.json` + `src/config.ts` + `src/presets.ts` + `scripts/smoke-test.js` + planner PROGRESS.md: add `llm.chat.codebaseSearch.enabled` (default true), `codebaseSearchEnabled` in `readSettings()` + `LlmSettings` (presets.ts), final static smoke assertions, mark 1.98-8 Done. — Done (2026-10-22; config/presets parts already landed in S3, so S4 = `package.json` schema entry + final smoke assertions + memory)

## Overall acceptance
1. compile clean + smoke fully green. 2. `#codebase <q>` → `Codebase sweep` section (structure, git status when dirty, search matches), ≤12,000 chars. 3. setting false → inert. 4. `#codebase` no query → structure + git status, search placeholder. 5. `@file` tagging, section order, 11 tools unaffected.

# Plan: 1.98-9 — Attach problems as chat context (`#problems`) (Planned 2026-10-22) — **Done** (2026-10-22, slices S1–S4 complete)

**Changelog:** VS Code 1.98 — "Attach problems from the Problems panel as chat context — type `#problems` (or paperclip / drag). Specific problems, all problems in a file, or all files in the codebase."

## Decisions
1. Tag-only scope — no paperclip/drag-and-drop (single webview, no attachment UI).
2. Follow the `#codebase` pattern exactly: pure extraction + formatting in `src/context.ts`, vscode collection in ToolExecutor, wiring in `runStream` appended after the codebase block.
3. Tag grammar: `extractProblemsTag(text): string | null` — `/#problems(?!\w)/i`, first match, trimmed same-line remainder as qualifier: `""` = bare tag = all workspace problems; non-empty = workspace-relative file path; `null` = absent.
4. REUSE diagnostics collection: extract `getDiagnostics` body into `public async collectDiagnostics(relPath?: string): Promise<string>` (same guards/formatting/empty strings); `getDiagnostics` becomes a thin wrapper. New cap: 50 problems + `… (showing first 50 of N)` note.
5. Bounded output: 50 problems (in collectDiagnostics) + 8,000 chars (in pure `formatProblemsBlock`, `… (truncated)` suffix).
6. New setting `llm.chat.problems.enabled` (default true) — mirrors `llm.chat.codebaseSearch.enabled`.
7. `formatProblemsBlock(data: { text: string }, scope?: string): string` — header `Problems (scope: workspace|<path>)`, body = text or `(no problems — clean)`, 8,000-char cap, `""` when text empty AND scope is workspace.
8. No webview changes.
9. Qualifier fallback (S3): if the qualifier is non-empty and path resolution rejects it, fall back to workspace scope (avoids rendering "Path not allowed" as body).

## Slices
- **S1** `src/context.ts` (+ smoke): `extractProblemsTag` + `ProblemsBlockData` + `PROBLEMS_BLOCK_MAX_CHARS = 8000` + `formatProblemsBlock`. Smoke section 13a (~10 assertions). — Done (2026-10-22)
- **S2** `src/tools/ToolExecutor.ts` (+ smoke): `public async collectDiagnostics(relPath?)` extracted from `getDiagnostics` (thin wrapper, tool behavior byte-identical); 50-problem cap. Smoke 13b static: `collectDiagnostics(` ≥ 2, `getDiagnostics` intact, `showing first 50`. — Done (2026-10-22)
- **S3** `src/chat/ChatViewProvider.ts` + `src/config.ts` + `src/presets.ts` (+ smoke): `problemsEnabled` field (presets + config, default true); in `runStream` after the `#codebase` block: if `settings.problemsEnabled` and tag present, `collectDiagnostics(p || undefined)` → `formatProblemsBlock` → append to `finalContextBlock`; qualifier path-rejection → workspace fallback. Smoke 13c static (5 checks). — Done (2026-10-22; `problemsEnabled` in `readSettings()`/`LlmSettings` landed in S3 so the slice compiles standalone)
- **S4** `package.json` + `scripts/smoke-test.js` + planner PROGRESS.md: `llm.chat.problems.enabled` (boolean, default true); smoke 13d; mark 1.98-9 Done. — Done (2026-10-22; config/presets parts already landed in S3, so S4 = `package.json` schema entry + final smoke assertions + memory)

## Overall acceptance
1. compile clean + smoke all green (270 prior + section 13). 2. `#problems` → `Problems (scope: workspace)` block (≤50 problems / ≤8,000 chars); bare tag + no diagnostics → no block. 3. `#problems src/foo.ts` → file scope; outside-workspace path → not injected (workspace fallback). 4. setting false → tag inert. 5. `get_diagnostics` tool output unchanged. 6. No webview changes, no new deps.

# Plan: 1.98-10 — Attach folders as context (`#folder:<name>`) — **Done** (2026-10-22, slices S1–S4)

**Changelog reference:** VS Code 1.98 — attach a folder as context via the paperclip or by
typing `#folder:` followed by the folder name (previously only drag-and-drop from Explorer).
Relevance: `keep (capability/context)` — context injection. Gap: no `#folder:` tag exists
(only `@filename` single-file tags).

**Key decisions (final):**
1. **Tag syntax:** `#folder:<name>` (colon) AND `#folder <name>` (space) are both accepted,
   mirroring `#problems <path>`. Regex: `/#folder(?::|(?=\s|$))(\S*)/i` — word-bounded
   (`#folderfoo` does NOT match), case-insensitive (`#Folder` DOES). Only the FIRST
   occurrence counts; only the same-line remainder is read. Bare `#folder` (no name) →
   **workspace root** (sweep the whole first workspace folder, like `#codebase`'s structure
   walk) — NOT ignored, so the tag is never a silent no-op.
2. **Resolution:** folder name is workspace-root-relative, resolved via the existing
   `ToolExecutor.resolveSafe()` (first workspace root; `..` escape → rejected). If the
   resolved path does not exist or is not a directory → the block renders
   `(folder not found: <name>)` so the model knows. No fallback to root (unlike `#problems`
   path fallback) — a wrong folder name is user error the model should see.
3. **Sweep content:** file tree ONLY (no file contents — that's what `read_file` is for).
   Mirrors `codebaseSweep`'s structure walk: depth ≤ 3, cap 100 entries, `SKIP_DIRS`
   skipped, `… (truncated at 100 entries)` suffix. No git status, no search.
4. **Char cap:** `FOLDER_BLOCK_MAX_CHARS = 8000` (exported, like `PROBLEMS_BLOCK_MAX_CHARS`),
   `… (truncated)` suffix. Smaller than the 12,000 codebase cap — a folder tree is smaller
   and the block is additive context.
5. **Setting:** `llm.chat.folderContext.enabled` (boolean, default `true`); config field
   `folderContextEnabled`. Gated ONLY on this setting; runs regardless of
   `llm.tools.enabled` (same as `#codebase`/`#problems`).
6. **Tag-only scope:** no paperclip/drag-and-drop UI (single webview, no attachment UI —
   same decision as 1.98-9).

**Block format (S1):**
```
Folder: <name or (workspace root)>
<tree lines, or "(empty folder)", or "(folder not found: <name>)">
```
Header uses the raw tag name; `(workspace root)` when the name is empty.

## Slices

### 1.98-10.S1 — Pure helpers in `src/context.ts` — Done (2026-10-22)
File: `src/context.ts` (append a `#folder` section after the `#problems` section, mirroring
its style).
- `export function extractFolderTag(text: string): string | null` — regex
  `/#folder(?::|(?=\s|$))(\S*)/i`; returns the trimmed folder-name remainder (group 1,
  `""` for bare tag), `null` if absent. Same-line semantics: the `(\S*)` capture naturally
  stops at whitespace/newline.
- `export interface FolderBlockData { tree: string; notFound?: boolean; }`
- `export const FOLDER_BLOCK_MAX_CHARS = 8000;` + `const FOLDER_BLOCK_TRUNCATED_SUFFIX =
  "… (truncated)";`
- `export function formatFolderBlock(data: FolderBlockData, folder?: string): string` —
  header `Folder: ${folder && folder.trim() !== "" ? folder : "(workspace root)"}`; body:
  `data.notFound` → `(folder not found: ${folder})`; else `data.tree || "(empty folder)"`.
  Truncate to `FOLDER_BLOCK_MAX_CHARS` + suffix. Never returns `""` (the tag was explicit —
  always show the header so the model knows the folder was requested).
Smoke (new section **14a**, labels `folder-s1:`):
- `extractFolderTag("#folder:src") === "src"`; `extractFolderTag("#folder src") === "src"`;
  `extractFolderTag("#folder") === ""`; `extractFolderTag("no tag") === null`;
  `extractFolderTag("#folderfoo") === null`; `extractFolderTag("#Folder:src") === "src"`;
  `extractFolderTag("#folder:src\nline2") === "src"`.
- `formatFolderBlock({ tree: "a/\nb.ts" }, "src")` includes `Folder: src` and the tree;
  `formatFolderBlock({ tree: "" }, "src")` includes `(empty folder)`;
  `formatFolderBlock({ tree: "", notFound: true }, "nope")` includes
  `(folder not found: nope)`; `formatFolderBlock({ tree: "x".repeat(9000) })` truncated to
  cap + suffix; bare (no folder) header shows `(workspace root)`.
Acceptance: `npm run compile` passes; smoke green (existing 294 + new).

### 1.98-10.S2 — `ToolExecutor.folderSweep` in `src/tools/ToolExecutor.ts` — Done (2026-10-22)
File: `src/tools/ToolExecutor.ts` (add a public method next to `codebaseSweep`, ~line 856).
- `public async folderSweep(folderName: string): Promise<string>` — returns the formatted
  block (mirrors `codebaseSweep` which returns the formatted string, keeping the provider
  wiring identical to `#codebase`/`#problems`).
- Body: `const rootAbs = await this.resolveSafe(".");` if null →
  `formatFolderBlock({ tree: "", notFound: true }, folderName || "(workspace root)")`
  (no workspace). Else `const target = folderName.trim() === "" ? rootAbs :
  await this.resolveSafe(folderName);` if null → notFound block. `fs.promises.stat(target)`
  → on error or `!isDirectory()` → notFound block. Walk: same structure as `codebaseSweep`'s
  inner `walk` (depth ≤ 3, cap 100, `SKIP_DIRS`, indent `"  ".repeat(depth - 1)`,
  `… (truncated at 100 entries)`), starting at `walk(target, 1)`. Return
  `formatFolderBlock({ tree: structure }, folderName)`.
Smoke (new section **14b**, labels `folder-s2:`): static checks on `ToolExecutor.ts` source —
`folderSweep(` present; `formatFolderBlock` imported/used; `resolveSafe` still present;
`codebaseSweep(` still present (untouched).
Acceptance: `npm run compile` passes; smoke green.

### 1.98-10.S3 — Wiring in `src/chat/ChatViewProvider.ts` + `src/config.ts` + `src/presets.ts` — Done (2026-10-22)
Files: `src/chat/ChatViewProvider.ts`, `src/config.ts`, `src/presets.ts` (three files, one
concern — the wiring; same shape as 1.98-9.S3 which pulled the config field in so the slice
compiles standalone).
- `presets.ts`: add to `LlmSettings` after `problemsEnabled` (~line 94):
  `/** Enable the \`#folder:\` chat tag (folder tree injected as context). */
  folderContextEnabled: boolean;`
- `config.ts`: add after line 72:
  `folderContextEnabled: c.get<boolean>("chat.folderContext.enabled", true),`
- `ChatViewProvider.ts`: import `extractFolderTag` (line ~27–29 import block). In
  `runStream`, immediately AFTER the `#problems` block (~line 973), add:
  ```ts
  // 1.98-10.S3: `#folder:` tag — sweep the named folder (tree only) and append
  // the result to the context block. Gated only on settings.folderContextEnabled
  // (runs regardless of llm.tools.enabled, same as `#codebase`/`#problems`).
  if (settings.folderContextEnabled && lastUser && this.toolExecutor) {
    const f = extractFolderTag(lastUser.content);
    if (f !== null) {
      const folderBlock = await this.toolExecutor.folderSweep(f);
      if (folderBlock) {
        finalContextBlock = finalContextBlock
          ? finalContextBlock + "\n\n" + folderBlock
          : folderBlock;
      }
    }
  }
  ```
Smoke (new section **14c**, labels `folder-s3:`): static checks — `ChatViewProvider.ts`
contains `extractFolderTag`, `folderSweep(`, `folderContextEnabled`; `config.ts` contains
`chat.folderContext.enabled`; `presets.ts` contains `folderContextEnabled`.
Acceptance: `npm run compile` passes; smoke green.

### 1.98-10.S4 — `package.json` + final smoke + mark done — Done (2026-10-22)
Files: `package.json`, `scripts/smoke-test.js`, `.github/agents/planner/PROGRESS.md`.
- `package.json`: after `llm.chat.problems.enabled` (~line 215) add:
  ```json
  "llm.chat.folderContext.enabled": {
    "type": "boolean",
    "default": true,
    "description": "When the user types #folder:<name> (or '#folder <name>') in a chat message, attach the folder's file tree as context. Bare #folder attaches the workspace root."
  }
  ```
- `smoke-test.js`: new section **14d** (labels `folder-s4:`) — parsed-JSON checks:
  `llm.chat.folderContext.enabled` exists, `type === "boolean"`, `default === true`,
  description is a non-empty string containing `#folder`.
- `PROGRESS.md`: move 1.98-10 to Done, update Status/Next step.
Acceptance: `npm run compile` + `node scripts/smoke-test.js` pass (all prior 294 + new
assertions green); PROGRESS.md in sync.

## Overall acceptance (Tester)
Typing `#folder:src` (or `#folder src`) in a chat message injects a `Folder: src` block with
the folder's file tree (depth ≤ 3, ≤ 100 entries, no file contents) into the system prompt;
bare `#folder` injects the workspace-root tree; a nonexistent folder injects
`(folder not found: <name>)`; `#folderfoo` does not trigger; the block is truncated at
8,000 chars; with `llm.chat.folderContext.enabled: false` the tag is ignored; the tag works
regardless of `llm.tools.enabled`; `npm run compile` clean; smoke test fully green.

## Risks / open questions
- **Multi-root workspaces:** `resolveSafe` resolves against the FIRST workspace root only
  (existing behavior, shared with `@file` tags and `#codebase`). A folder name that exists
  only in another root → `(folder not found: <name>)`. Acceptable; consistent with the rest
  of the extension.
- **Folder names with spaces:** `(\S*)` captures only the first token, so `#folder:my
  folder` attaches `my`. Documented limitation (same as `#problems <path>`); acceptable.
- **Bare `#folder` = workspace root** overlaps with `#codebase`'s structure walk —
  intentional (root tree without git status/search); no conflict.

# Plan: 1.98-12 — Change completions model (Planned 2026-10-22)

**Changelog reference:** VS Code 1.98 — "Change the model used for inline code completions via the **Change Completions Model** command in the Command Palette (or 'Configure Code Completions' in the Copilot title-bar menu)." Relevance: `keep (capability/context)` — selecting which local engine/model serves completions is a capability control. Gap: no such command exists yet.

## Decisions
1. **Setting:** `llm.completions.model` (string, default `""`). Empty = "use the main chat model" (`llm.model`), which itself falls back to the engine default. Fallback chain: `llm.completions.model` → `llm.model` → engine default. Mirrors existing `llm.model` semantics.
2. **Config field:** `completionsModel: string` in `LlmSettings` (presets.ts) + `readSettings()` (config.ts). Pulled into **S2** (first slice that needs it to compile) — same pattern as 1.98-10.S3.
3. **Provider wiring (S2):** `InlineCompletionProvider` builds `settings = { ...readSettings(), model: readSettings().completionsModel }` before `buildRequestBody` — the completions model replaces the chat model for the request body; `buildRequestBody`'s existing `toolbar.model ?? settings.model` (request.ts ~line 180) does the rest with **zero changes to request.ts**. Toolbar override still wins (consistent with chat).
4. **Command:** `llm.changeCompletionsModel` ("LLM: Change Completions Model") in `extension.ts`. `vscode.window.showQuickPick` list built by pure `buildCompletionsModelList(current, chatModel, engineModels)` in `presets.ts`: first entry always "Use chat model (default)" (value `""`), then current completions model (if non-empty and ≠ chat model), then chat model (if non-empty), then engine models — deduped by value, `picked: true` on the active value. Engine models via `client.listModels()`; on failure a warning is shown and the list falls back to current + chat model only (command never hard-fails).
5. **Write target:** `ConfigurationTarget.Workspace` (or `Global` when no workspace folder). Justification: per-project capability choice (different projects may want a smaller/faster local model for ghost text); visible in `.vscode/settings.json`.
6. **No webview changes, no new dependencies.** The chat toolbar Model dropdown is NOT touched (it controls the chat model).

## Slices
- **S1** `src/presets.ts` (+ smoke): `CompletionsModelOption` interface + pure `buildCompletionsModelList(current, chatModel, engineModels)` (default entry first, dedup, `picked` on active). Smoke section **15a** (labels `compm-s1:`, ~8 assertions). — Pending
- **S2** `src/presets.ts` + `src/config.ts` + `src/inline/InlineCompletionProvider.ts` (+ smoke): `completionsModel` field in `LlmSettings` + `readSettings()` (`c.get<string>("completions.model", "")`); provider swaps `settings.model` for `completionsModel` before `buildRequestBody` (toolbar override still wins). Smoke **15b** (labels `compm-s2:`): static checks — `presets.ts` has `completionsModel`, `config.ts` has `completions.model`, `InlineCompletionProvider.ts` has `completionsModel` + `buildRequestBody(`. — Pending
- **S3** `src/extension.ts` (+ smoke): register `llm.changeCompletionsModel` — read `completions.model` + `model`, `client.listModels()` (failure → warning + configured-only list), `buildCompletionsModelList` → QuickPick (default entry `$(symbol-inherit) Use chat model (default)`, `description: "active"` on picked), write to `ConfigurationTarget.Workspace` (or `Global`), info message; cancel = no-op. Smoke **15c** (labels `compm-s3:`): static checks — `llm.changeCompletionsModel`, `buildCompletionsModelList`, `showQuickPick`, `completions.model`, `ConfigurationTarget.Workspace`. — Pending
- **S4** `package.json` + `scripts/smoke-test.js` + planner PROGRESS.md: `contributes.commands` entry `{ "command": "llm.changeCompletionsModel", "title": "LLM: Change Completions Model" }`; `contributes.configuration.properties["llm.completions.model"]` (string, default `""`, description mentions completions + the command). Smoke **15d** (labels `compm-s4:`): parsed-JSON checks (setting exists/type/default/description; command entry exists with title). Mark 1.98-12 Done. — Pending

## Overall acceptance (Tester)
1. `npm run compile` clean; `node scripts/smoke-test.js` fully green.
2. Command Palette → "LLM: Change Completions Model" shows a QuickPick: "Use chat model (default)" first, active model badged `active`, engine models listed; picking writes `llm.completions.model` (workspace scope in a workspace, global otherwise) + confirmation; cancel is a no-op.
3. With `llm.completions.model` set, inline completions send that model in the request body; with it empty, completions use `llm.model` / engine default (no behavior change).
4. Chat model selection (toolbar dropdown, `llm.model`) unaffected.

## Risks / open questions
- **Engine unreachable when the command runs:** QuickPick still works with configured models only (warning shown); the command never hard-fails.
- **Toolbar model override still wins over `llm.completions.model`** in the inline provider (reuses chat toolbar state) — consistent with chat; a per-feature toolbar override is out of scope.
- **Multi-root workspaces:** `ConfigurationTarget.Workspace` writes to the first workspace folder's settings (VS Code default); acceptable, consistent with the rest of the extension.
