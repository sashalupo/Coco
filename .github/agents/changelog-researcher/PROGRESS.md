# Changelog Researcher — Progress Memory

> **This file is the agent's persistent memory.** The `Changelog Researcher` agent
> (`.github/agents/changelog-researcher.agent.md`) MUST read this at session start and update
> it at session end. Keep it accurate and current. Commit it together with the work it
> describes.

## Mission

Study the VS Code Copilot changelog (text **and images**) and maintain the **ordered backlog**
(oldest → newest) of features the team will implement for the `llm` VS Code extension. The
researcher does NOT write code — it builds and maintains the backlog.

## Source

- **Changelog:** `https://github.com/microsoft/vscode/blob/main/extensions/copilot/CHANGELOG.md`
- **Raw (for fetching):** `https://raw.githubusercontent.com/microsoft/vscode/main/extensions/copilot/CHANGELOG.md`
- **Release notes (used for v1.98):** `https://code.visualstudio.com/updates/v1_98` (GitHub Copilot section)
- The changelog is ordered **newest first**. The backlog below is **oldest first** (reversed).

## Status

- **Last processed version:** **1.98** (February 2025) — GitHub Copilot section fully studied
- **Next step:** the v1.98 Copilot backlog is complete. Next session: study the **next
  (newer) release** (1.99, March 2025) GitHub Copilot section at
  `https://code.visualstudio.com/updates/v1_99`, reverse into oldest→newest, and append to the
  backlog. Do NOT re-study v1.98.
- **Last updated:** 2026-10-22
- **Last commit:** — (no researcher commits yet)

## Backlog (oldest → newest)

> Each entry: **ID** · **version/date** · **title** · **description** · **image notes** ·
> **relevance** (`keep (capability/context)` | `skip (cost/money)` | `skip (GitHub-service)` |
> `skip (VS Code core)`) · **status** (`pending` | `in-progress` | `done` |
> `done (already built)` | `skipped (not relevant: local LLM)` |
> `skipped (not relevant: VS Code core)`) · **implemented in**.
>
> The orchestrator always picks the **first `pending` item** (the oldest). Skipped items are
> recorded for the decision trail and never picked up.

### VS Code 1.98 — February 2025 (GitHub Copilot section)

#### 1.98-1 · Agent mode improvements (Experimental)
- **Description:** Terminal commands shown inline + editable before running; `Ctrl+Enter`
  confirms a command; expandable list of search results the agent ran; undo/redo of the last
  file edit (not the whole response); agent can run build tasks
  (`github.copilot.chat.agent.runTasks`).
- **Image notes:** `agent-mode-search-results.png` — Copilot Edits chat view showing an
  **expandable/collapsible list of search results** inside an agent message (the searches the
  agent performed to gather context); the message expands to reveal each search + its results.
- **Relevance:** `keep (capability/context)` — agentic capability, not cost.
- **Status:** `pending`
- **Gap vs existing:** existing agent loop already has `run_command` + approval gate,
  streaming tool-call progress cards, checkpoints, keep/undo. **Not built:** the *editable*
  terminal command (edit the suggested command in the chat response before it runs) and the
  `Ctrl+Enter` confirm shortcut. Expandable search-results list is a refinement of the
  existing progress cards.
- **Implemented in:** —

#### 1.98-2 · Notebook support in Copilot Edits (Preview)
- **Description:** Edit notebook files from chat: create notebooks, modify content across
  multiple cells, insert/delete cells, change cell types.
- **Image notes:** None (release notes reference a video, no still screenshot).
- **Relevance:** `keep (capability/context)` — editing capability, not cost.
- **Status:** `pending`
- **Gap vs existing:** existing state has no notebook-cell editing tools (write_file/edit_file
  are text-file oriented). Needs notebook-aware tools (cell insert/delete/modify, cell-type
  change) or a `.ipynb` JSON edit path.
- **Implemented in:** —

#### 1.98-3 · Refined editor integration (Keep/Undo naming, no scroll, auto-reveal next file)
- **Description:** No scrolling while changes apply (viewport stays put); "Accept"→"Keep" and
  "Discard"→"Undo" rename; after keeping/undoing a file the next file is auto-revealed.
- **Image notes:** None (release notes reference a video).
- **Relevance:** `keep (capability/context)` — UX of the diff/review flow.
- **Status:** `done (already built)`
- **Note:** existing state already has keep/undo in diff, change toolbox footer bar with
  Keep/Undo, and a multi-file diff view. Minor polish (no-scroll, auto-reveal next file) can
  be folded into the diff-view work if not already present.
- **Implemented in:** existing (diff preview + multi-file diff view, keep/undo)

#### 1.98-4 · Refreshed UI (attachments as chat attachments, changed files list, related files)
- **Description:** Attached-not-yet-sent files render as regular chat attachments; only
  AI-modified files appear in the changed-files list above the chat input;
  `chat.renderRelatedFiles` enables related-file suggestions rendered below attachments.
- **Image notes:** `copilot_edits_ui.png` — updated Copilot Edits view: **attachments shown as
  chat attachment chips**, and a **changed-files list positioned above the chat input** box.
- **Relevance:** `keep (capability/context)` — chat UX.
- **Status:** `done (already built)`
- **Note:** existing state has `@filename` tagged files (attachments) and the change toolbox
  footer. Related-file suggestions (`chat.renderRelatedFiles`) is a small optional follow-up.
- **Implemented in:** existing (@filename tagged files, change toolbox)

#### 1.98-5 · Removed Copilot Edits limits
- **Description:** Removed the 10-file attach limit and the client-side rate limit of 14
  interactions / 10 minutes (service-side limits still apply).
- **Image notes:** None.
- **Relevance:** `skip (cost/money)` — these limits exist to meter a **paid** service; a free
  local engine has no such billing limits.
- **Status:** `skipped (not relevant: local LLM)`
- **Implemented in:** —

#### 1.98-6 · Custom instructions generally available
- **Description:** `.github/copilot-instructions.md` in the workspace tailors chat + code
  suggestions; enabled via `github.copilot.chat.codeGeneration.useInstructionFiles`.
- **Image notes:** None.
- **Relevance:** `keep (capability/context)` — context injection.
- **Status:** `done (already built)`
- **Note:** existing state loads `AGENTS.md` + `.github/copilot-instructions.md` via
  `llm.instructions.enabled` / `llm.instructions.files`.
- **Implemented in:** existing (custom instructions)

#### 1.98-7 · Smoother authentication flows in chat
- **Description:** In-chat confirmation for GitHub repo permission with three options —
  **Grant** (regular auth modal), **Not Now** (remember until next window session),
  **Never Ask Again** (persist via `github.copilot.advanced.authPermissions`).
- **Image notes:** `confirmation-auth-dialog.png` — an **in-chat (non-modal) confirmation
  dialog** with three buttons/options to continue: Grant, Not Now, Never Ask Again.
- **Relevance:** `skip (GitHub-service)` — authenticating to **GitHub** repos for `@github` /
  `#codebase`-on-GitHub; a local extension has no GitHub service to authorize.
- **Status:** `skipped (not relevant: local LLM)`
- **Implemented in:** —

#### 1.98-8 · More advanced codebase search in Copilot Chat (`#codebase`)
- **Description:** `#codebase` runs tools to pull workspace context: embeddings-based semantic
  search, text search, file search, git modified files, project structure, read file, read
  directory, workspace symbol search. Enabled via `github.copilot.chat.codesearch.enabled`.
- **Image notes:** None.
- **Relevance:** `keep (capability/context)` — context gathering. **Note:** the
  *embeddings-based semantic search* sub-item requires a paid embedding service → drop that
  sub-item; the local tools (text/file search, project structure, read file/dir, git modified,
  workspace symbols) are all local and in scope.
- **Status:** `done` (2026-10-22, slices S1–S4)
- **Gap vs existing:** existing agent has `search_files`, `list_dir`, `read_file`,
  `get_diagnostics`, but there is **no `#codebase` chat tag** that triggers a workspace-context
  sweep. Build the `#codebase` tag that fans out the local search tools and injects results as
  context.
- **Implemented in:** `src/context.ts` (extractCodebaseQuery/formatCodebaseSweep),
  `src/tools/ToolExecutor.ts` (codebaseSweep), `src/chat/ChatViewProvider.ts` (wiring),
  `llm.chat.codebaseSearch.enabled` setting

#### 1.98-9 · Attach problems as chat context (`#problems`)
- **Description:** Attach problems from the Problems panel as chat context — drag an item onto
  the Chat view, type `#problems`, or use the paperclip 📎. Can attach specific problems, all
  problems in a file, or all files in the codebase.
- **Image notes:** None.
- **Relevance:** `keep (capability/context)` — context injection.
- **Status:** `done` (2026-10-22, slices S1–S4)
- **Gap vs existing:** no `#problems` tag / Problems-panel attachment exists yet.
- **Implemented in:** `src/context.ts` (extractProblemsTag/formatProblemsBlock),
  `src/tools/ToolExecutor.ts` (collectDiagnostics), `src/chat/ChatViewProvider.ts` (wiring),
  `llm.chat.problems.enabled` setting

#### 1.98-10 · Attach folders as context (`#folder:<name>`)
- **Description:** Attach a folder as context via the paperclip 📎 or by typing `#folder:`
  followed by the folder name (previously only drag-and-drop from Explorer).
- **Image notes:** None.
- **Relevance:** `keep (capability/context)` — context injection.
- **Status:** `pending`
- **Gap vs existing:** no `#folder:` tag exists yet (only `@filename` single-file tags).
- **Implemented in:** —

#### 1.98-11 · Collapsed mode for Next Edit Suggestions (Preview)
- **Description:** Collapsed NES mode shows only the suggestion indicator in the left margin;
  the suggestion is revealed on `Tab`. Toggled via
  `editor.inlineSuggest.edits.showCollapsed` or the NES gutter menu.
- **Image notes:** `NESgutterMenu.png` — the **NES context menu in the editor left margin**
  with the **"Show Collapsed"** option highlighted.
- **Relevance:** `skip (VS Code core)` — NES collapsed mode is a **VS Code core editor**
  feature (`editor.inlineSuggest.edits.*`), not part of this extension's inline-completion
  provider.
- **Status:** `skipped (not relevant: VS Code core)`
- **Implemented in:** —

#### 1.98-12 · Change completions model
- **Description:** Change the model used for inline code completions via the **Change
  Completions Model** command in the Command Palette (or "Configure Code Completions" in the
  Copilot title-bar menu).
- **Image notes:** None.
- **Relevance:** `keep (capability/context)` — selecting which local engine/model serves
  completions is a capability control.
- **Status:** `pending`
- **Gap vs existing:** no "Change Completions Model" command exists yet to switch the model
  backing inline completions.
- **Implemented in:** —

#### 1.98-13 · Model availability (GPT 4.5, Claude 3.7 Sonnet)
- **Description:** New models in the picker: GPT 4.5 (Preview, Enterprise) and Claude 3.7
  Sonnet (Preview, paid plans).
- **Image notes:** None.
- **Relevance:** `skip (cost/money)` — these are **paid-plan cloud models**; a local extension
  uses whatever local engine is configured, not GitHub's model catalog.
- **Status:** `skipped (not relevant: local LLM)`
- **Implemented in:** —

#### 1.98-14 · Copilot Vision (Preview) — image attachments
- **Description:** Attach images to chat prompts (drag/drop from OS or Explorer, paste from
  clipboard, or paperclip 📎 > Screenshot Window). Supported types: JPEG/JPG, PNG, GIF, WEBP.
  Warning shown if the model can't handle the file type.
- **Image notes:** `image-attachments.gif` (from 1_97 assets) — an **attached image rendered
  inline in a Copilot Chat prompt**; hovering the image shows a **preview** of it.
- **Relevance:** `keep (capability/context)` — multimodal context input (works with local
  vision-capable engines).
- **Status:** `pending`
- **Gap vs existing:** no image-attachment / vision support exists yet.
- **Implemented in:** —

#### 1.98-15 · Copilot status overview (Experimental)
- **Description:** Centralized status overview via the Copilot status-bar icon: quota info
  (Free users), editor settings (e.g. Code Completions), useful keyboard shortcuts. Enabled
  via `chat.experimental.statusIndicator.enabled`.
- **Image notes:** `copilot-status.png` — the **Copilot status overview panel opened from the
  status-bar icon**, listing status + key editor settings + shortcuts.
- **Relevance:** `keep (capability/context)` — **reframe** as an **engine status indicator**:
  show local-engine connection state (running/stopped, endpoint, active model, context
  window), NOT quota/cost. Drop the quota-info sub-item.
- **Status:** `pending`
- **Gap vs existing:** no status-bar engine-status overview exists yet.
- **Implemented in:** —

#### 1.98-16 · TypeScript context for inline completions (Experimental)
- **Description:** Enhanced context for inline completions and `/fix` on TypeScript files;
  Insider-scoped, enabled via `chat.languageContext.typescript.enabled`.
- **Image notes:** None.
- **Relevance:** `skip (VS Code core)` — this is a **VS Code core Copilot** language-context
  experiment (`chat.languageContext.*`), not part of this extension's completion provider.
- **Status:** `skipped (not relevant: VS Code core)`
- **Implemented in:** —

#### 1.98-17 · Custom instructions for pull request title/description
- **Description:** Custom instructions for PR title/description generation via
  `github.copilot.chat.pullRequestDescriptionGeneration.instructions` (file or inline).
  Requires the GitHub Pull Requests extension.
- **Image notes:** None.
- **Relevance:** `skip (GitHub-service)` — depends on the **GitHub Pull Requests** extension
  and GitHub PR generation; not applicable to a local extension.
- **Status:** `skipped (not relevant: local LLM)`
- **Implemented in:** —

## Done

- 1.98-3 Refined editor integration — `done (already built)` (keep/undo, multi-file diff view)
- 1.98-4 Refreshed UI — `done (already built)` (@filename attachments, change toolbox)
- 1.98-6 Custom instructions GA — `done (already built)` (loads `.github/copilot-instructions.md`)
- 1.98-8 `#codebase` tag — `done` (2026-10-22, local workspace-context sweep)
- 1.98-9 `#problems` tag — `done` (2026-10-22, attach Problems-panel items as context)

## Skipped (decision trail)

- 1.98-5 Removed Copilot Edits limits — cost/money (paid-service rate limits)
- 1.98-7 Smoother authentication flows — GitHub-service (GitHub repo auth)
- 1.98-11 NES collapsed mode — VS Code core
- 1.98-13 Model availability — cost/money (paid-plan cloud models)
- 1.98-16 TypeScript language context — VS Code core
- 1.98-17 PR title/description instructions — GitHub-service

## Pending (oldest → newest — orchestrator picks the first)

1. **1.98-10** `#folder:<name>` tag (attach a folder as context)
2. **1.98-12** Change Completions Model command (switch model for inline completions)
3. **1.98-14** Copilot Vision — image attachments (JPEG/PNG/GIF/WEBP)
4. **1.98-15** Engine status indicator (status-bar overview, reframed from Copilot status)

## Todo

- [x] Fetch the v1.98 release notes (GitHub Copilot section).
- [x] Study the Copilot entries oldest→newest (order given by the release notes).
- [x] For each entry: extract + note images (alt-text from release notes; image pixels not
      directly readable via fetch — notes derived from descriptive alt-text).
- [x] Append entries to the backlog (oldest → newest), set status.
- [x] Deduplicate against existing `llm` extension state (mark already-built items
      `done (already built)`).
- [x] Apply the local-LLM relevance filter (cost/money, GitHub-service, VS Code core →
      skipped).
- [ ] **Next session:** study VS Code **1.99** (March 2025) GitHub Copilot section and append.

## Notes / decisions

- The researcher does NOT write code. Only the Coder writes code.
- **Images:** the `fetch_webpage` tool returns image references, not pixel content, so image
  notes are derived from the **descriptive alt-text** in the release notes (layout, controls,
  labels, states). This is recorded per entry.
- Always keep the backlog in chronological order (oldest → newest). New (newest) entries are
  appended to the end.
- Never reorder the backlog out of chronological order.
- **Local LLM filter:** the engine is free — tokens are not paid for. Cost/money-driven
  features (token-spend guards, dollar budgets, paid-API rate limits, paid-plan model
  catalogs) are recorded as `skipped (not relevant: local LLM)`. GitHub-service-dependent
  features (GitHub repo auth, `@github`, PR generation) are `skipped (not relevant: local
  LLM)`. VS Code core features (NES collapsed mode, `chat.languageContext.*`) are
  `skipped (not relevant: VS Code core)`. Capability/context-driven features are kept.
- **Reframing:** the Copilot status overview is kept but reframed as a **local-engine status
  indicator** (connection state, endpoint, active model, context window) — quota info dropped.
