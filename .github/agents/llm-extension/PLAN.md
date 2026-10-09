# LLM Extension — Harness Roadmap (Phase 6+)

> **What this file is.** A forward-looking feature plan that turns the chat client into an
> autonomous **coding-agent harness**: the model can read, **edit**, run, and verify code in
> the workspace, with a safe review/approval layer.
>
> **How the agent uses it.** `PROGRESS.md` is still the single source of truth for *what to do
> next* — its **Next step** pointer points into this roadmap. This file defines the *steps*.
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
  - *Acceptance:* compiles; `edit_file` present in `CODE_TOOLS`; `request.ts` picks it up
    automatically (it already spreads `CODE_TOOLS`).
- **6.2 — `edit_file` execution.** Implement in `src/tools/ToolExecutor.ts`.
  - Read the file (reuse `resolveSafe` + size cap). Count occurrences of `old_string`.
    - `0` → error: "old_string not found — re-read the file and copy the exact text."
    - `>1` and `!replace_all` → error: "old_string is not unique (N matches) — add more
      surrounding context, or set replace_all=true."
    - else replace (first occurrence, or all when `replace_all`).
  - Write back; return a summary: `Replaced 1 occurrence in <path> (A chars → B chars)`.
  - *Acceptance:* manual test (unique match, no-match, ambiguous-match, replace_all) behaves
    as specified; compiles clean.
- **6.3 — `read_file` line range.** Extend the existing `read_file` tool with optional
  `start_line` / `end_line` (1-based, inclusive) so the harness can read large files in chunks
  without blowing the context budget. Omitting them reads the whole file (current behavior).
  - *Acceptance:* `read_file(path, start_line, end_line)` returns only that range; compiles.
- **6.4 — End-to-end verify + record.** Enable `llm.tools.enabled`, ask the model to make a
  small edit to a real file, and confirm the on-disk file changes correctly and the agentic
  loop feeds the result back. Update `PROGRESS.md` (mark 6.1–6.4 Done, set Next step to 7.1).
  - *Acceptance:* a real edit round-trips through the loop; `PROGRESS.md` in sync; committed.

## Phase 7 — Safe writes & review (human in the loop)

Goal: mutations are visible and, optionally, require approval before they touch disk.

- **7.1 — Diff preview.** When a mutating tool (`write_file`, `edit_file`) runs, compute a
  unified diff (old vs new) and include it in the tool result / post it to the webview as a
  tool card. No new deps — a small hand-rolled line diff is fine.
  - *Acceptance:* a diff is produced and shown for an edit; compiles.
- **7.2 — Approval gate.** New setting `llm.tools.requireApproval` (bool, default `false`).
  When `true`, mutating tools are **held**: the loop posts a pending card with Approve/Reject
  and awaits the user's decision (a webview→host message round-trip) before applying. Reject
  feeds a "user rejected" tool result back to the model.
  - *Acceptance:* with the flag on, an edit is not written until approved; compiles.
- **7.3 — Undo last edit.** Snapshot the file before each mutation; a "Revert last change"
  action restores the previous content.
  - *Acceptance:* revert restores the pre-edit content; compiles.

## Phase 8 — Run & verify (close the loop)

Goal: the model can run commands and read diagnostics to confirm its edits work.

- **8.1 — `run_command` tool.** Run a shell command in the workspace root, capture
  stdout+stderr, enforce a timeout (e.g. 60s) and an output cap. Return exit code + output.
  - *Acceptance:* a command runs and its output is returned to the model; compiles.
- **8.2 — `get_diagnostics` tool.** Return workspace diagnostics (errors/warnings) for a given
  file (or all open files) so the model can verify its edits compile.
  - *Acceptance:* diagnostics for a file are returned; compiles.
- **8.3 — Show output in the webview.** Render command output + diagnostics in the tool card
  (collapsible, themed).
  - *Acceptance:* output is visible in the panel; compiles.

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

## Constraints (all phases)

- **No runtime npm dependencies** (Node 18+ `fetch`, hand-rolled helpers).
- **All file/command ops stay inside the workspace** (`resolveSafe` / workspace root).
- **Never commit secrets** (the API key stays in settings).
- **One step per session**; each step independently compiles and commits.

## Step index (for the `Next step` pointer)

| Step | One line |
| ---- | -------- |
| 6.1  | `edit_file` tool schema in `tools.ts` |
| 6.2  | `edit_file` execution in `ToolExecutor.ts` |
| 6.3  | `read_file` line-range support |
| 6.4  | End-to-end edit verify + `PROGRESS.md` sync |
| 7.1  | Diff preview for mutations |
| 7.2  | `llm.tools.requireApproval` approval gate |
| 7.3  | Undo last edit |
| 8.1  | `run_command` tool |
| 8.2  | `get_diagnostics` tool |
| 8.3  | Show command/diagnostic output in webview |
| 9.1  | Tool-call cards in the chat |
| 9.2  | Step/iteration budget + stop |
| 9.3  | Change summary |
| 10.1 | `git_status` + `git_diff` tools |
| 10.2 | "Commit changes" command |
