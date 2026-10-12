# LLM Extension — Harness Roadmap (Phase 6+)

> **What this file is.** A forward-looking feature plan that turns the chat client into an
> autonomous **coding-agent harness**: the model can read, **edit**, run, and verify code in
> the workspace, with a safe review/approval layer.
>
> **How the agent uses it.** `PROGRESS.md` is still the single source of truth for _what to do
> next_ — its **Next step** pointer points into this roadmap. This file defines the _steps_.
> The `LLM Extension Developer` agent does **one step per session** (see the agent's context
> budget discipline), commits it, and updates `PROGRESS.md`.
>
> **Baseline (already built, Phases 1–5):** chat + runtime toolbar, context injection, inline
> completion, code actions, and a tool-calling agentic loop with `read_file`, `write_file`
> (full overwrite), `list_dir`, `search_files`. Tools are gated by `llm.tools.enabled`.

## Guiding principle

A harness is a closed loop: **read → plan → edit → run → verify → repeat**, with a human in
the loop for anything that mutates state. Every new capability must (a) stay inside the
workspace, (b) add **zero runtime npm dependencies**, and (c) be independently compilable and
committable.

## Phase 6 — Targeted file editing (headline feature)

Goal: the model makes **surgical edits** instead of rewriting whole files. This is the core
"harness" capability the user asked for.

- **6.1 — `edit_file` tool schema.** Add an `edit_file` tool to `CODE_TOOLS` in `src/tools.ts`.
  - Params: `path` (workspace-relative), `old_string` (exact text, incl. whitespace/indent),
    `new_string` (replacement), `replace_all` (bool, default `false`).
  - Description must tell the model: `old_string` must match **exactly** and be **unique** in
    the file unless `replace_all` is true; include surrounding context to disambiguate.
  - _Acceptance:_ compiles; `edit_file` present in `CODE_TOOLS`; `request.ts` picks it up
    automatically (it already spreads `CODE_TOOLS`).
- **6.2 — `edit_file` execution.** Implement in `src/tools/ToolExecutor.ts`.
  - Read the file (reuse `resolveSafe` + size cap). Count occurrences of `old_string`.
    - `0` → error: "old_string not found — re-read the file and copy the exact text."
    - `>1` and `!replace_all` → error: "old_string is not unique (N matches) — add more
      surrounding context, or set replace_all=true."
    - else replace (first occurrence, or all when `replace_all`).
  - Write back; return a summary: `Replaced 1 occurrence in <path> (A chars → B chars)`.
  - _Acceptance:_ manual test (unique match, no-match, ambiguous-match, replace_all) behaves
    as specified; compiles clean.
- **6.3 — `read_file` line range.** Extend the existing `read_file` tool with optional
  `start_line` / `end_line` (1-based, inclusive) so the harness can read large files in chunks
  without blowing the context budget. Omitting them reads the whole file (current behavior).
  - _Acceptance:_ `read_file(path, start_line, end_line)` returns only that range; compiles.
- **6.4 — End-to-end verify + record.** Enable `llm.tools.enabled`, ask the model to make a
  small edit to a real file, and confirm the on-disk file changes correctly and the agentic
  loop feeds the result back. Update `PROGRESS.md` (mark 6.1–6.4 Done, set Next step to 7.1).
  - _Acceptance:_ a real edit round-trips through the loop; `PROGRESS.md` in sync; committed.

## Phase 7 — Safe writes & review (human in the loop)

Goal: mutations are visible and, optionally, require approval before they touch disk.

- **7.1 — Diff preview.** When a mutating tool (`write_file`, `edit_file`) runs, compute a
  unified diff (old vs new) and include it in the tool result / post it to the webview as a
  tool card. No new deps — a small hand-rolled line diff is fine.
  - _Acceptance:_ a diff is produced and shown for an edit; compiles.
- **7.2 — Approval gate.** New setting `llm.tools.requireApproval` (bool, default `false`).
  When `true`, mutating tools are **held**: the loop posts a pending card with Approve/Reject
  and awaits the user's decision (a webview→host message round-trip) before applying. Reject
  feeds a "user rejected" tool result back to the model.
  - _Acceptance:_ with the flag on, an edit is not written until approved; compiles.
- **7.3 — Undo last edit.** Snapshot the file before each mutation; a "Revert last change"
  action restores the previous content.
  - _Acceptance:_ revert restores the pre-edit content; compiles.

## Phase 8 — Run & verify (close the loop)

Goal: the model can run commands and read diagnostics to confirm its edits work.

- **8.1 — `run_command` tool.** Run a shell command in the workspace root, capture
  stdout+stderr, enforce a timeout (e.g. 60s) and an output cap. Return exit code + output.
  - _Acceptance:_ a command runs and its output is returned to the model; compiles.
- **8.2 — `get_diagnostics` tool.** Return workspace diagnostics (errors/warnings) for a given
  file (or all open files) so the model can verify its edits compile.
  - _Acceptance:_ diagnostics for a file are returned; compiles.
- **8.3 — Show output in the webview.** Render command output + diagnostics in the tool card
  (collapsible, themed).
  - _Acceptance:_ output is visible in the panel; compiles.

## Phase 9 — Harness UX

Goal: make the agentic run legible and controllable.

- **9.1 — Tool-call cards.** Render each tool call (name + args) and its result as a
  collapsible card in the chat, visually distinct from assistant text.
- **9.2 — Step/iteration budget.** Show "step i/N" during the loop and allow stopping it.
- **9.3 — Change summary.** At the end of a run, summarize files changed (path + +/- lines).

## Phase 10 — Git integration

Goal: the harness can inspect and commit its own changes.

- **10.1 — `git_status` + `git_diff` tools** (read-only).
- **10.2 — "Commit changes" command:** stage + commit with a model-generated message, gated by
  approval. Secrets are never committed.

## Phase 11 — Sessions side panel (conversation management)

Goal: move the conversation-management controls (**New Chat**, **Export**, **Delete**,
**Rename**) out of the main toolbar and into a **collapsible "Sessions" side panel** that
mirrors the reference UI (a "Sessions" header with a toggle, a "New Session" button, and a
grouped list of conversations). A compact **quick "new conversation" button** stays in the
toolbar so the user can start a fresh chat while the panel is collapsed.

- **11.1 — Side panel shell + toggle.** Add a collapsible left column (`.side-panel`) to the
  webview with a "Sessions" header and a toggle button in the main toolbar to open/close it.
  Default state: **collapsed** (hidden). The panel body is an empty placeholder for now.
  - _Acceptance:_ the toggle shows/hides the panel; the chat area reflows; compiles.
- **11.2 — Conversation list in the panel.** Replace the `#conv-select` dropdown with a
  grouped list of conversations rendered inside the panel (reference UI: a group header such
  as "Today" + a count, then one row per conversation showing its title). Selecting a row
  makes it active and posts `switchConversation`. Per-row stats (line deltas / a "failed"
  badge) are **optional** — render them only if the data is available; the current
  `Conversation` model only carries `{id, title, messages}`.
  - _Acceptance:_ the list is populated from the `restore`/`pushHistory` payload; clicking a
    row switches the active conversation; compiles.
- **11.3 — Move New Chat / Export / Delete / Rename into the panel.** Remove the `#new-chat`,
  `#export`, `#conv-delete`, and `#conv-rename` buttons from the main toolbar. Place a
  "New Session" button at the top of the panel (→ `newChat`) and Export / Delete / Rename
  actions for the selected conversation (→ `export`, `deleteConversation`,
  `renameConversation`). Reuse the existing message handlers in `ChatViewProvider` unchanged.
  - _Acceptance:_ all four actions work from the panel; the old toolbar buttons are removed;
    compiles.
- **11.4 — Quick "new conversation" button when collapsed.** Add a compact "new conversation"
  button to the main toolbar that is visible **only while the side panel is collapsed**.
  Clicking it starts a new conversation (posts `newChat`). It is hidden whenever the panel is
  open.
  - _Acceptance:_ the quick button is visible when collapsed and hidden when the panel is
    open; it starts a new conversation; compiles.
- **11.5 — Polish + verify + record.** Match the reference UI styling (header row with the
  toggle, "New Session" button, grouped list, muted metadata), keep the panel usable at the
  webview's narrow width, run the smoke test, and update `PROGRESS.md` (mark 11.1–11.5 Done,
  set Next step).
  - _Acceptance:_ the panel matches the reference layout; smoke test green; `PROGRESS.md` in
    sync; committed.

## Phase 12 — Change toolbox footer bar

Goal: replace the inline change-summary message (Phase 9.3) with a **persistent,
interactive footer bar** that sits above the input box and shows every file changed
during the current agentic run. The bar is expandable (file list with per-file
`+added -removed` counts) and carries **Keep** (accept / dismiss) and **Undo**
(revert all changed files) actions. Only model-made changes (`write_file` /
`edit_file`) are tracked; user-edited files are out of scope.

Reference UI (from screenshots):

- Collapsed: `▾ 1 file changed  +21 -1` with **Keep** and **Undo** buttons on the right.
- Expanded: the same header row plus one row per file (`example.py  +21 -1`).
- The bar is a sticky footer between the message list and the input row; it is
  hidden when there are no pending changes.

- **12.1 — Multi-file snapshot in `ToolExecutor`.**
  Extend `ToolExecutor` to store a snapshot for **every** file mutated in the
  current run, not just the last one.
  - Add `runSnapshots: Map<string, { relPath: string; oldContent: string; existed: boolean }>`
    alongside the existing `runChanges`.
  - In `recordChange()` (or wherever mutations are recorded), also store the
    pre-mutation content in `runSnapshots`.
  - Clear `runSnapshots` in `clearChangeSummary()`.
  - Add `revertAll(): Promise<string>` that iterates `runSnapshots` and restores
    each file (or deletes it if `existed === false`). Returns a summary string
    like `"Reverted 2 files: example.py, utils.py"`.
  - Keep the existing single-file `lastSnapshot` / `revertLast()` for backward
    compatibility (the toolbar "Revert" button still works).
  - _Acceptance:_ `revertAll()` restores all snapshotted files; compiles.

- **12.2 — Footer bar DOM + CSS in `webview.ts`.**
  Add a `.change-footer` element between the message list (`#messages`) and the
  input row (`.input-row`). Hidden by default (`display: none`).
  - **Collapsed state:** a single row with a chevron (`▾`/`▸`), the summary text
    (`N file(s) changed  +X -Y`), and **Keep** / **Undo** buttons right-aligned.
  - **Expanded state:** the same header row plus a `.cf-file-list` container with
    one `.cf-file-row` per file (monospace path + `+added` in green, `-removed`
    in red).
  - Styling: match the reference (dark background, subtle border-top, green/red
    accent colors, monospace file paths, small font). Reuse existing CSS
    variables (`--vscode-testingIcon-passed`, `--vscode-errorForeground`, etc.).
  - Toggle expand/collapse on chevron click.
  - _Acceptance:_ the bar renders with correct counts and file list; compiles.

- **12.3 — Host→webview: `change_footer` message.**
  Replace the existing `change_summary` post in `ChatViewProvider` with a new
  `change_footer` message:

  ```ts
  this.postMessage({
    type: "change_footer",
    files: changes, // [{ path, added, removed }]
    totalAdded: sum(added),
    totalRemoved: sum(removed),
  });
  ```
  - The webview shows the footer bar when `change_footer` arrives and hides it
    when a new run starts (on `send`) or when Keep is clicked.
  - _Acceptance:_ the bar appears after a run with file mutations; compiles.

- **12.4 — Webview→host: `keepChanges` and `undoChanges`.**
  Wire the Keep and Undo buttons in the footer bar:
  - **Keep** → posts `{ type: "keepChanges" }`. Host clears `runSnapshots` (and
    `runChanges`). Webview hides the bar.
  - **Undo** → posts `{ type: "undoChanges" }`. Host calls
    `toolExecutor.revertAll()`, posts a `revert_result` message with the summary,
    and clears the snapshots. Webview hides the bar.
  - Add both cases to the `onMessage` switch in `ChatViewProvider`.
  - _Acceptance:_ Keep dismisses the bar; Undo reverts all files and shows a
    confirmation; compiles.

- **12.5 — Clickable file rows + change highlighting in the editor.**
  Make each file row in the expanded footer bar a clickable link that opens the
  file in the editor and highlights the lines the agent changed/created.
  - **Webview:** render each `.cf-file-row` path as a clickable element
    (`cursor: pointer`, hover underline). Clicking posts
    `{ type: "openFile", path: <workspace-relative path> }` to the host.
  - **Host:** add an `openFile` case to `onMessage` in `ChatViewProvider`:
    - Resolve the path safely (reuse `resolveSafe` / workspace-root guard).
    - `vscode.workspace.openTextDocument(uri)` then
      `vscode.window.showTextDocument(doc, { preview: true })`.
    - **Highlight the changes:** compute the changed line ranges from the
      snapshot stored in 12.1.
      - For an **edited** file: run `unifiedDiff(oldContent, newContent)` (or
        reuse the `diffLines` op list) to find the line numbers (in the _new_
        file) that were inserted or modified.
      - For a **created** file (`existed === false`): highlight the whole file.
    - Apply the highlight with a **decorations provider** (or a one-shot
      `TextEditor.setDecorations`) using a themed class
      (e.g. `--vscode-editorWidget-background` / a subtle green tint for
      additions, red tint for deletions). Decorations are cleared when the
      document is closed or a new `openFile` is issued.
    - _No new deps_ — use the built-in `vscode.window.createTextEditorDecorationType`.
  - _Acceptance:_ clicking a file row opens it and the changed/created lines are
    visually highlighted; compiles.

- **12.6 — Remove old inline change summary.**
  - Remove the `change_summary` case from the webview's message handler and the
    `.change-summary-card` / `.cs-*` CSS rules (replaced by the footer bar).
  - Remove the `change_summary` post from `ChatViewProvider` (replaced by
    `change_footer` in 12.3).
  - _Acceptance:_ no duplicate change display; compiles.

- **12.7 — Polish + verify + record.**
  Match the reference UI styling (dark theme, green/red +/- colors, monospace
  file paths, chevron expand/collapse, button styling, clickable-row hover).
  Run the smoke test. Update `PROGRESS.md` (mark 12.1–12.7 Done, set Next step).
  - _Acceptance:_ the footer bar matches the reference layout; clicking a file
    opens it with highlighted changes; smoke test green; `PROGRESS.md` in sync;
    committed.

## Constraints (all phases)

- **No runtime npm dependencies** (Node 18+ `fetch`, hand-rolled helpers).
- **All file/command ops stay inside the workspace** (`resolveSafe` / workspace root).
- **Never commit secrets** (the API key stays in settings).
- **One step per session**; each step independently compiles and commits.

## Step index (for the `Next step` pointer)

| Step | One line                                      |
| ---- | --------------------------------------------- |
| 6.1  | `edit_file` tool schema in `tools.ts`         |
| 6.2  | `edit_file` execution in `ToolExecutor.ts`    |
| 6.3  | `read_file` line-range support                |
| 6.4  | End-to-end edit verify + `PROGRESS.md` sync   |
| 7.1  | Diff preview for mutations                    |
| 7.2  | `llm.tools.requireApproval` approval gate     |
| 7.3  | Undo last edit                                |
| 8.1  | `run_command` tool                            |
| 8.2  | `get_diagnostics` tool                        |
| 8.3  | Show command/diagnostic output in webview     |
| 9.1  | Tool-call cards in the chat                   |
| 9.2  | Step/iteration budget + stop                  |
| 9.3  | Change summary                                |
| 10.1 | `git_status` + `git_diff` tools               |
| 10.2 | "Commit changes" command                      |
| 11.1 | Sessions side-panel shell + toggle            |
| 11.2 | Conversation list in the panel                |
| 11.3 | Move New/Export/Delete/Rename into the panel  |
| 11.4 | Quick "new conversation" button (collapsed)   |
| 11.5 | Polish + verify + `PROGRESS.md` sync          |
| 12.1 | Multi-file snapshot + `revertAll()`           |
| 12.2 | Change toolbox footer bar (DOM + CSS)         |
| 12.3 | `change_footer` host→webview message          |
| 12.4 | `keepChanges` / `undoChanges` webview→host    |
| 12.5 | Clickable file rows + editor change highlight |
| 12.6 | Remove old inline change summary              |
| 12.7 | Polish + verify + `PROGRESS.md` sync          |
