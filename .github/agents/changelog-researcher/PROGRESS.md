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

- **Last processed version:** **1.99** (March 2025) — GitHub Copilot section fully studied
- **Next step:** the v1.99 backlog is built (14 pending keep-items, oldest first). The
  orchestrator dispatches the Planner for the first pending item (**1.99-2** MCP server
  support). Do NOT re-study v1.98/v1.99.
- **Last updated:** 2026-10-22
- **Last commit:** — (no researcher commits yet)
- **Note (2026-10-22):** the v1.99 research was done **inline by the orchestrator** — the
  researcher sub-agent dispatch failed with `context_length_exceeded` (~145k tokens needed vs
  131k budget; deterministic, its memory file is too large). Source:
  `https://code.visualstudio.com/updates/v1_99` (GitHub Copilot sections).

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
- **Status:** `done` (2026-10-22, slices S1–S4)
- **Gap vs existing:** no `#folder:` tag exists yet (only `@filename` single-file tags).
- **Implemented in:** `#folder:<name>` / `#folder <name>` chat tag (bare `#folder` = workspace root): `extractFolderTag` + `formatFolderBlock` in `src/context.ts`, `ToolExecutor.folderSweep` (resolveSafe guard + tree walk depth ≤ 3 / cap 100), ChatViewProvider wiring gated on `llm.chat.folderContext.enabled` (default true).

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
- **Status:** `done` (2026-10-22, slices S1–S4)
- **Gap vs existing:** no "Change Completions Model" command exists yet to switch the model
  backing inline completions.
- **Implemented in:** `llm.changeCompletionsModel` QuickPick command (`src/extension.ts`), `buildCompletionsModelList` (`src/presets.ts`), `llm.completions.model` setting (empty → chat model fallback), inline provider wiring (`src/inline/InlineCompletionProvider.ts`), package.json contributions. Commits `f33c3a4`, `3c03b59`, `bd60c26` + S4.

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
- **Status:** `done` (2026-10-22, slices S1–S5)
- **Gap vs existing:** no image-attachment / vision support exists yet.
- **Implemented in:** `9d847c1` (S1 request.ts multimodal), `2d0497b` (S2 isVisionCapableModel), `4bd7775` (S3 webview attachment UI), `3d169f6` (S4 host send flow + vision warning) + S5 (`package.json` `llm.chat.vision.enabled`)

#### 1.98-15 · Copilot status overview (Experimental)
- **Description:** Centralized status overview via the Copilot status-bar icon: quota info
  (Free users), editor settings (e.g. Code Completions), useful keyboard shortcuts. Enabled
  via `chat.experimental.statusIndicator.enabled`.
- **Image notes:** `copilot-status.png` — the **Copilot status overview panel opened from the
  status-bar icon**, listing status + key editor settings + shortcuts.
- **Relevance:** `keep (capability/context)` — **reframe** as an **engine status indicator**:
  show local-engine connection state (running/stopped, endpoint, active model, context
  window), NOT quota/cost. Drop the quota-info sub-item.
- **Status:** `done` (2026-10-22, slices S1–S4)
- **Gap vs existing:** no status-bar engine-status overview exists yet.
- **Implemented in:** `55cc673` (S1 pure helpers), `048b248` (S2 gate + focus refresh), `2f22531` (S3 QuickPick overview) + S4 (`package.json` contributions, `llm.statusBar.enabled`)

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

### VS Code 1.99 — March 2025 (GitHub Copilot section)

#### 1.99-1 · Agent mode available in VS Code Stable
- **Description:** Agent mode GA in Stable (`chat.agent.enabled`); mode picker in the Chat view.
- **Relevance:** keep (capability/context)
- **Status:** done (already built) — the extension's chat is already agent-capable (tool loop
  via `ToolExecutor`, agent mode in the chat panel).
- **Gap vs existing:** none.

#### 1.99-2 · Model Context Protocol (MCP) server support
- **Description:** MCP servers in agent mode — standardized external tools. Config under an
  `mcp` settings section or `.vscode/mcp.json` (stdio command servers; input variables like
  `${env:API_KEY}`); `MCP: Add Server` / `MCP: List Servers` commands; refresh action to start
  a server and discover its tools; servers started on-demand; Select Tools button to pick
  which MCP tools are available in chat.
- **Image notes:** `copilot-edits-agent-mode.png` (mode picker), MCP docs screenshots.
- **Relevance:** keep (capability/context)
- **Status:** **done** (2026-10-22, 6 slices S1–S6; commits c8222cb, 94a7965, 851b1b2, ffee7e4, 9783237 + S6 commit; tag `changelog-1.99`)
- **Gap vs existing:** none — new subsystem. Local reframe: `llm.mcp.servers` setting
  (name → {command, args, env}), spawn stdio child process, JSON-RPC over stdio
  (initialize → tools/list → tools/call), expose discovered tools to the agent tool loop
  behind the existing approval gate, `llm.mcp.addServer` / `llm.mcp.listServers` commands.
  No runtime npm deps (hand-rolled JSON-RPC framing over stdio).

#### 1.99-3 · Agent mode tools — Thinking tool (Experimental)
- **Description:** A `think` tool that gives any model the opportunity to think between tool
  calls (Anthropic-inspired); improves agent performance on complex tasks.
- **Relevance:** keep (capability/context)
- **Status:** **done** (2026-10-22, 3 slices S1–S3; commits 576adfe, 469123c + S3 commit; no tag — `changelog-1.99` already exists)
- **Gap vs existing:** none — add a `think` tool to the agent tool loop (model calls it with
  its reasoning; result echoed back; no side effects).

#### 1.99-4 · Agent mode tools — Fetch tool (`#fetch`)
- **Description:** `#fetch` includes content from a publicly accessible webpage in the
  prompt; in agent mode picked up automatically, referenceable explicitly via `#fetch <url>`
  in other modes. VS Code renders the page in a headless browser and caches it.
- **Relevance:** keep (capability/context)
- **Status:** **done** (2026-10-22, 4 slices S1–S4; commits e6017e9, 23e40d4, 03d6da3 + S4 commit; no tag — `changelog-1.99` already exists)
- **Gap vs existing:** none. Local reframe (no headless browser available): plain HTTP
  `fetch` + HTML→text extraction (strip script/style/tags), size cap, cache per URL.

#### 1.99-5 · Agent mode tools — Usages tool (`#usages`)
- **Description:** `#usages` combines Find All References + Find Implementation + Go to
  Definition so chat can learn about a function/class/interface (sample implementations,
  refactor impact).
- **Relevance:** keep (capability/context)
- **Status:** done (2026-10-22, 4 slices S1–S4; commits 2c84ea8, 8539470, 84ecb31 + S4 commit; no tag — changelog-1.99 exists)
- **Gap vs existing:** none — add a `usages` tool: given a symbol name + file, grep-based
  reference search across the workspace (workspace has no LSP; text search is the
  established approach).

#### 1.99-6 · Create a new workspace with agent mode (Experimental)
- **Description:** Scaffold a new VS Code workspace in agent mode — initialize, configure,
  and launch new projects (extension, MCP server, dev environment) with dependencies and
  settings.
- **Relevance:** keep (capability/context)
- **Status:** done (2026-10-22 — `#newWorkspace` tag + scaffold templates + setting)
- **Gap vs existing:** none. Local reframe: a "new workspace" chat flow — agent mode with a
  scaffold prompt that creates files/dirs in a chosen folder via the existing file tools.

#### 1.99-7 · VS Code extension tools in agent mode
- **Description:** LM tools contributed by extensions (`toolReferenceName`,
  `canBeReferencedInPrompt`) are automatically available in agent mode.
- **Relevance:** skip (VS Code core)
- **Status:** skipped (not relevant: VS Code core) — the extension is a chat client, not a
  VS Code LM-tool provider.

#### 1.99-8 · Agent mode tool approvals
- **Description:** Remember tool approvals at session, workspace, or application level
  (Continue-button dropdown); experimental `chat.tools.autoApprove` auto-approves all tools.
- **Image notes:** `chat-tool-approval.png` (Continue button dropdown options).
- **Relevance:** keep (capability/context)
- **Status:** done (2026-10-22 — 4 slices S1–S4; ApprovalStore + autoApprove + scope dropdown; smoke 466)
- **Gap vs existing:** the extension has a single `llm.tools.requireApproval` boolean gate.
  Extend with remembered approvals: per-tool allow-list persisted at workspace
  (`.vscode/llm.json`-style) / global (storage) scope + an `llm.tools.autoApprove` setting.

#### 1.99-9 · Agent evaluation on SWE-bench
- **Description:** VS Code agent achieves 56.0% on `swebench-verified` (Claude 3.7 Sonnet).
- **Relevance:** skip (benchmark, not a feature)
- **Status:** skipped (not relevant: benchmark)

#### 1.99-10 · Unified Chat view
- **Description:** Merges the Chat and Copilot Edits views into one Chat view with a mode
  picker (Ask / Agent / Edit); switch modes mid-conversation; edit sessions in history
  (Show Chats restores past edit sessions); move chat to a new editor or window; multiple
  agent sessions at once.
- **Image notes:** `chat-modes.png` (mode picker dropdown).
- **Relevance:** keep (capability/context)
- **Status:** pending
- **Gap vs existing:** the extension has one chat panel with an agent tool loop but no
  explicit Ask/Agent/Edit mode picker, no per-mode behavior switch, and no session history
  restore. Local reframe: mode picker in the chat header (Ask = no tools, Agent = full tool
  loop, Edit = file-edit tools only), mode switchable mid-conversation, chat history list
  with restore.

#### 1.99-11 · Bring Your Own Key (BYOK) (Preview)
- **Description:** Use own API keys for Azure/Anthropic/Gemini/OpenAI/Ollama/OpenRouter via
  Manage Models in the model picker.
- **Relevance:** skip (not relevant: local LLM)
- **Status:** skipped (not relevant: local LLM) — the extension already points at a local
  engine via `llm.baseUrl`; no provider keys involved.

#### 1.99-12 · Reusable prompt files
- **Description:** `chat.promptFilesLocations` supports glob patterns; `.prompt.md` editing
  improvements (path autocompletion, broken-link diagnostics, edit/delete actions, folder
  references valid, markdown comments ignored); `.github/copilot-instructions.md` behaves
  like any `.prompt.md`; Create User Prompt (user-data-folder prompts).
- **Relevance:** keep (capability/context)
- **Status:** pending
- **Gap vs existing:** the extension has `llm.instructions` (custom instructions file).
  Extend: discover `.prompt.md` files via glob patterns from a
  `llm.promptFiles.locations` setting, list them in a `llm.usePrompt` command (pick →
  inject as context), treat `.github/copilot-instructions.md` as one of them.

#### 1.99-13 · Improved vision support (Preview)
- **Description:** Attach images from any browser via drag and drop; URL extensions
  `.jpg`, `.png`, `.gif`, `.webp`, `.bmp` accepted.
- **Relevance:** keep (capability/context)
- **Status:** pending
- **Gap vs existing:** 1.98-14 added image attachments (file picker + drag-drop of files).
  Extend: accept dropped image URLs (browser drag) and add `.bmp` to the accepted
  extensions; fetch URL images to base64 data URLs.

#### 1.99-14 · Unified chat experience (Configure the editor)
- **Description:** Duplicate of the Unified Chat view entry (Chat section).
- **Relevance:** skip (duplicate)
- **Status:** skipped (not relevant: duplicate of 1.99-10)

#### 1.99-15 · Faster workspace searches with instant indexing
- **Description:** Remote workspace indexes (GitHub-only) built automatically on first
  `#codebase`/`@workspace` question.
- **Relevance:** skip (GitHub-service)
- **Status:** skipped (not relevant: GitHub-service)

#### 1.99-16 · Copilot status menu
- **Description:** Status-bar menu: workspace index status; icon showing whether code
  completions are enabled for the active editor; enable/disable code completions and NES
  from the menu.
- **Image notes:** `copilot-workspace-index-remote.png`, `copilot-disabled-status.png`.
- **Relevance:** keep (capability/context)
- **Status:** pending
- **Gap vs existing:** 1.98-15 added the engine status indicator + overview QuickPick.
  Extend: completions-enabled indicator in the status bar (reflects
  `llm.completions.enabled` + active editor language) and a "Completions: on/off" toggle in
  the status overview QuickPick.

#### 1.99-17 · Out of the box Copilot setup (Experimental)
- **Description:** `chat.setupFromDialog` — first chat request guides sign-in/sign-up.
- **Relevance:** skip (GitHub-service)
- **Status:** skipped (not relevant: GitHub-service/auth)

#### 1.99-18 · Chat prerelease channel mismatch
- **Description:** Welcome screen when the prerelease Copilot Chat extension is installed in
  VS Code Stable.
- **Relevance:** skip (VS Code core)
- **Status:** skipped (not relevant: VS Code core)

#### 1.99-19 · Semantic text search improvements (Experimental) — `#searchResults`
- **Description:** AI semantic search in the Search view (Ctrl+I); `#searchResults` tool
  references the current search results in a chat prompt.
- **Relevance:** keep (capability/context) — the `#searchResults` tool part only
- **Status:** pending
- **Gap vs existing:** none — add a `searchResults` context source: read the current Search
  view results (or run a workspace text search for the query) and attach them as chat
  context. The semantic Search-view AI part is VS Code core (skipped).

#### 1.99-20 · Settings editor search updates
- **Description:** Settings editor search uses the key-matching algorithm by default.
- **Relevance:** skip (VS Code core)
- **Status:** skipped (not relevant: VS Code core)

#### 1.99-21 · New setting for window controls (Linux, Windows)
- **Description:** `window.controlsStyle` — native/custom/hidden window controls.
- **Relevance:** skip (VS Code core)
- **Status:** skipped (not relevant: VS Code core)

#### 1.99-22 · Next Edit Suggestions general availability
- **Description:** NES GA (`github.copilot.nextEditSuggestions.enabled`), compact
  suggestions, updated gutter indicator.
- **Relevance:** skip (VS Code core)
- **Status:** skipped (not relevant: VS Code core) — consistent with the 1.98-11 NES skip.

#### 1.99-23 · AI edits improvements
- **Description:** Mute diagnostics events outside the editor while AI edits are applied
  (less Problems-panel flicker, no quick-fix requests); explicitly save the file when the
  user keeps the AI edits.
- **Relevance:** keep (capability/context)
- **Status:** pending
- **Gap vs existing:** the extension applies edits via `WorkspaceEdit` and saves; verify the
  keep-path explicitly saves (`document.save()`) and that no stray diagnostics-triggered
  work happens while an edit is pending. Small change.

#### 1.99-24 · Tool-based edit mode
- **Description:** Edit mode uses the same tool-calling approach as agent mode
  (`chat.edits2.enabled`).
- **Relevance:** keep (capability/context)
- **Status:** done (already built) — the extension's chat edits are already tool-based
  (`ToolExecutor` file-edit tools); there is no separate non-tool edit path.

#### 1.99-25 · Inline suggestion syntax highlighting
- **Description:** Syntax highlighting for inline (ghost) suggestions enabled by default.
- **Relevance:** skip (VS Code core)
- **Status:** skipped (not relevant: VS Code core)

#### 1.99-26 · Tree-Sitter based syntax highlighting (Preview)
- **Description:** Experimental Tree-Sitter highlighting for CSS and TS regexes.
- **Relevance:** skip (VS Code core)
- **Status:** skipped (not relevant: VS Code core)

#### 1.99-27 · Minimal nbformat version 4.5
- **Description:** New notebooks default to `nbformat` 4.5 — each cell gets an `id` field to
  help calculate diffs.
- **Relevance:** keep (capability/context)
- **Status:** pending
- **Gap vs existing:** `src/notebook.ts` `createNotebook` — set `nbformat: 4`,
  `nbformat_minor: 5` and stable cell `id` fields. Small change.

#### 1.99-28 · AI notebook editing improvements — new notebook tool
- **Description:** A dedicated tool that plans and creates a new Jupyter notebook from a
  chat query; `/newNotebook` in ask mode; notebook tool in agent/edit mode. (Navigate
  through AI edits / undo AI edits sub-features are VS Code core notebook UI — skipped.)
- **Relevance:** keep (capability/context)
- **Status:** pending
- **Gap vs existing:** `src/notebook.ts` exists (create/modify notebooks). Add a
  `new_notebook` agent tool + `/newNotebook` chat command that plans cells from the query
  and creates the notebook.

#### 1.99-29 · Text and image output support in chat (notebooks)
- **Description:** Add notebook cell outputs (text, errors, images) to chat as context via
  the "Add cell output to chat" action (triple-dot menu / right-click).
- **Relevance:** keep (capability/context)
- **Status:** pending
- **Gap vs existing:** image attachments exist (1.98-14). Add a command
  `llm.addCellOutput` that reads the active notebook cell's outputs (text/error → text
  context; image → base64 attachment) and injects them into the chat input.

## Done

- 1.98-3 Refined editor integration — `done (already built)` (keep/undo, multi-file diff view)
- 1.98-4 Refreshed UI — `done (already built)` (@filename attachments, change toolbox)
- 1.98-6 Custom instructions GA — `done (already built)` (loads `.github/copilot-instructions.md`)
- 1.98-8 `#codebase` tag — `done` (2026-10-22, local workspace-context sweep)
- 1.98-9 `#problems` tag — `done` (2026-10-22, attach Problems-panel items as context)
- 1.98-10 `#folder:<name>` tag — `done` (2026-10-22, attach a folder's file tree as context)
- 1.98-12 Change Completions Model command — `done` (2026-10-22, `llm.changeCompletionsModel` QuickPick + `llm.completions.model` setting)
- 1.98-14 Copilot Vision — image attachments — `done` (2026-10-22, paperclip/paste/drag-drop, `llm.chat.vision.enabled`, non-blocking vision warning)
- 1.98-15 Engine status indicator — `done` (2026-10-22, status-bar `$(check)/$(error) LLM` indicator, `llm.showStatusOverview` QuickPick, `llm.statusBar.enabled`)

## Skipped (decision trail)

- 1.98-5 Removed Copilot Edits limits — cost/money (paid-service rate limits)
- 1.98-7 Smoother authentication flows — GitHub-service (GitHub repo auth)
- 1.98-11 NES collapsed mode — VS Code core
- 1.98-13 Model availability — cost/money (paid-plan cloud models)
- 1.98-16 TypeScript language context — VS Code core
- 1.98-17 PR title/description instructions — GitHub-service

## Pending (oldest → newest — orchestrator picks the first)

- **1.99-10** Unified Chat view (mode picker + history)
- **1.99-12** Reusable prompt files
- **1.99-13** Improved vision support (URL images, `.bmp`)
- **1.99-16** Copilot status menu (completions indicator + toggle)
- **1.99-19** `#searchResults` tool
- **1.99-23** AI edits improvements (explicit save on keep)
- **1.99-27** Minimal nbformat 4.5 (cell `id` fields)
- **1.99-28** New notebook tool (`/newNotebook`)
- **1.99-29** Cell output to chat (text/image)

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
