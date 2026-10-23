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

- **Archive (source of truth):** `https://code.visualstudio.com/updates/archive`
- **Release notes:** `https://code.visualstudio.com/updates/v1_<N>` (GitHub Copilot sections)
- Window: 1.131 → 1.143 is the requested range; versions studied so far: 1.98–1.100. Backlog is **oldest first**.

## Status

- **Last processed version:** **1.107** (November 2025) — GitHub Copilot sections fully studied (1.101–1.107 added 2026-10-23)
- **Next step:** 1.100-8 is the next pending item (oldest). The orchestrator dispatches the Planner for it.
- **Last updated:** 2026-10-23
- **Last commit:** — (no researcher commits yet)
- **Note (2026-10-22):** the v1.99 research was done **inline by the orchestrator** — the
  researcher sub-agent dispatch failed with `context_length_exceeded` (~145k tokens needed vs
  131k budget; deterministic, its memory file is too large). Source:
  `https://code.visualstudio.com/updates/v1_99` (GitHub Copilot sections).
- **Note (2026-10-23):** the v1.100 research was done **inline by the orchestrator** (same
  context-budget reason). Source: `https://code.visualstudio.com/updates/v1_100` (GitHub
  Copilot sections: Chat, Accessibility, Editor Experience, Code Editing, Notebooks, Remote
  Development, Proposed APIs).

## Backlog (oldest → newest)

> Each entry: **ID** · **version/date** · **title** · **description** · **image notes** ·
> **relevance** (`keep (capability/context)` | `skip (cost/money)` | `skip (GitHub-service)` |
> `skip (VS Code core)`) · **status** (`pending` | `in-progress` | `done` |
> `done (already built)` | `skipped (not relevant: local LLM)` |
> `skipped (not relevant: VS Code core)`) · **implemented in**.
>
> The orchestrator always picks the **first `pending` item** (the oldest). Skipped items are
> recorded for the decision trail and never picked up.

### Completed versions (recap)

**1.98 (complete, tag `changelog-1.98`):** editable `run_command` approval card + "modified by user" badge (1); `notebook_edit` tool, 5 actions, `src/notebook.ts`, `.ipynb` rendered as cells (2); `#codebase` sweep (8); `#problems` (9); `#folder:<name>` (10); `llm.changeCompletionsModel` + `llm.completions.model` (12); image attachments + `llm.chat.vision.enabled` (14); status-bar overview `llm.showStatusOverview` + `llm.statusBar.enabled` (15). Already built: 3, 4, 6. Smoke ends ~371.

**1.99 (complete, tag `changelog-1.99`):** MCP client over stdio `src/mcp.ts` + `src/mcpManager.ts` (2); `think` tool (3); `fetch_url` + `#fetch` `src/fetchTool.ts` (4); `find_usages` + `#usages` `src/usages.ts` (5); `#newWorkspace` scaffolds `src/workspaceScaffold.ts` (6); tool approvals with session/workspace/global scope `ApprovalStore` (8); Ask/Agent/Edit mode picker (10); reusable prompt files `llm.usePrompt` `src/prompts.ts` (12); URL/bmp images (13); completions status + `llm.toggleCompletions` (16); `#searchResults` (19); explicit save on keep (23); nbformat 4.5 cell ids (27); `new_notebook` tool + `/newNotebook` (28); cell outputs to chat `llm.addCellOutput` (29). Already built: 1, 24. Smoke ends ~584.

Skipped items (cost/money, GitHub-service, VS Code core) are listed under **Skipped**.

### VS Code 1.100 — April 2025 (GitHub Copilot section)

> Source: `https://code.visualstudio.com/updates/v1_100`. Entries in release-notes order
> (Chat → Accessibility → Editor Experience → Code Editing → Notebooks → Source Control →
> Remote Development → Contributions to extensions → Proposed APIs).

#### 1.100-8 · Chat input improvements (attachment pills, streamlined picker, no Done button)
- **Description:** `#`-referenced context in the prompt text also appears as an **attachment
  pill**; streamlined context picker (files, folders, other attachment types); the "Done"
  button removed — a new session starts only via New Chat (Ctrl+N).
- **Image notes:** None.
- **Relevance:** keep (capability/context) — chat UX.
- **Status:** `pending`
- **Gap vs existing:** the webview renders `@file`/`#tag` references as text; add pill
  rendering for all context references, a simplified context picker, and confirm session
  semantics (no Done button; new chat only).
- **Implemented in:** —

#### 1.100-10 · Autofix diagnostics from agent mode edits
- **Description:** If a file edit in agent mode introduces new errors, agent mode detects
  them and **automatically proposes a follow-up edit** (no manual follow-up prompt needed).
  Disable via `github.copilot.chat.agent.autoFix`.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** the agent loop has `get_diagnostics` but no auto-fix loop. Add: after
  each file-edit tool call, collect new diagnostics on the edited file; if new errors
  appeared, auto-inject a follow-up agent turn ("these new errors appeared, fix them")
  behind an `llm.agent.autoFix` setting (default on).
- **Implemented in:** —

#### 1.100-11 · Handling of undo and manual edits in agent mode
- **Description:** Manual edits during an agent session no longer confuse the model: the
  agent is **prompted about the user's changes** and re-reads files when necessary before
  editing files that may have changed.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** the agent does not currently detect user edits between tool calls.
  Add: track file mtime/version between turns; if a file the agent edited (or is about to
  edit) changed externally, inject a note into the next turn ("user manually modified X")
  and have the agent re-read it before editing.
- **Implemented in:** —

#### 1.100-12 · Conversation summary (context-window management)
- **Description:** When the conversation gets long or the context very large, the agent
  compresses the conversation so far into a **"Summarized conversation history"** message
  (summary of important info + current task state) instead of keeping the whole FIFO —
  keeps the prompt prefix stable and responses fast.
- **Image notes:** `summarized-conversation.png` — a **"Summarized conversation history"
  system message in the Chat view** marking where the history was compressed.
- **Relevance:** keep (capability/context) — **core local-LLM feature**: local engines have
  hard, small context windows; summarization is how long agent sessions fit. (The prompt-
  caching half is cloud-specific and dropped; the summarization half is kept.)
- **Status:** `pending`
- **Gap vs existing:** no history compression exists; long sessions will eventually exceed
  the local model's window. Add: estimate conversation tokens (chars/3.5); when a threshold
  (e.g. 70% of the model's context window) is crossed, run a summarization pass (ask the
  model to summarize the older turns + current task state), replace the old turns with the
  summary, and show a "Summarized conversation history" marker in the chat.
- **Implemented in:** —

#### 1.100-13 · MCP support for Streamable HTTP
- **Description:** New **Streamable HTTP** transport for MCP servers (configured like SSE
  servers via `url`); backwards-compatible with SSE servers.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — MCP transport capability.
- **Status:** `pending`
- **Gap vs existing:** 1.99-2 built stdio MCP servers. Add HTTP transport: `url`-based
  server config, POST JSON-RPC to the endpoint (Streamable HTTP: single endpoint, SSE
  response stream), fall back to SSE for older servers.
- **Implemented in:** —

#### 1.100-14 · MCP support for image output
- **Description:** MCP servers can return **images** as part of tool output; rendered in
  chat (with a note that not all models can read images from tool output).
- **Image notes:** None.
- **Relevance:** keep (capability/context) — multimodal tool output.
- **Status:** `pending`
- **Gap vs existing:** MCP tool results are text-only. Extend the MCP client to accept
  image content blocks (base64) in tool results and render them in the chat progress card
  (vision-capable models can consume them as attachments).
- **Implemented in:** —

#### 1.100-15 · Enhanced MCP input/output/progress UI
- **Description:** Enhanced UI for MCP server tool **input and output** display, plus
  support for MCP's new **progress messages** (streaming progress while a tool runs).
- **Image notes:** None (release notes show a themed screenshot of the tool I/O UI).
- **Relevance:** keep (capability/context) — MCP UX.
- **Status:** `pending`
- **Gap vs existing:** MCP tool calls show a basic progress card. Extend: pretty-print tool
  input (JSON) and output, and handle `notifications/progress` JSON-RPC messages to update
  the progress card while a tool runs.
- **Implemented in:** —

#### 1.100-16 · MCP config generation uses `inputs` for secrets
- **Description:** AI-assisted MCP server configs generated by `MCP: Add Server` now
  generate `inputs` (variable references) for secrets instead of inlining them.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — config hygiene (secrets not inlined in
  `.vscode/mcp.json`); applies to local MCP servers too.
- **Status:** `pending`
- **Gap vs existing:** the `llm.mcp.addServer` flow (1.99-2) may inline env values. Extend
  the generated config to use `inputs` + `${input:...}` references for anything that looks
  like a secret (key/token/password).
- **Implemented in:** —

#### 1.100-18 · Select and attach UI elements to chat (Experimental)
- **Description:** In the built-in Simple Browser, a toolbar "Start" button lets you select
  any element of a locally-hosted page; attaches a **screenshot of the element + its HTML
  and CSS** to chat. Config: `chat.sendElementsToChat.enabled` / `.attachCSS` /
  `.attachImages`.
- **Image notes:** None (release notes reference a video of the element-selection toolbar).
- **Relevance:** keep (capability/context) — **reframe**: the extension can contribute the
  same element-picker to its own webview-based preview (or document the pattern); the
  Simple-Browser host part is VS Code core. Ambiguous — kept with the reframe note.
- **Status:** `pending`
- **Gap vs existing:** none. Local reframe: a "pick UI element" flow for web development —
  if the extension hosts a preview webview, inject a selection script that captures the
  element's HTML/CSS + screenshot and attaches them to the chat input. Low priority;
  depends on whether the extension ever hosts a preview.
- **Implemented in:** —

#### 1.100-19 · Create and launch tasks in agent mode (workspace creation follow-up)
- **Description:** At the end of the new-workspace creation flow, the user is prompted to
  **create and run a task** for launching the app/project (task reuse).
- **Image notes:** None.
- **Relevance:** keep (capability/context) — small extension of the 1.99-6 workspace
  scaffold flow.
- **Status:** `pending`
- **Gap vs existing:** 1.99-6 built `#newWorkspace` scaffolding. Extend: after scaffolding,
  offer to create a `.vscode/tasks.json` launch task (build/run command) and run it.
- **Implemented in:** —

#### 1.100-29 · Generate alt text in HTML or Markdown (AI code action)
- **Description:** Generate or update alt text for embedded images in HTML/Markdown via the
  lightbulb quick fix (Ctrl+.) on a line containing an image.
- **Image notes:** `generate-alt-text.png` — **lightbulb quick fix "Generate alt text" on an
  HTML `<img>` element**.
- **Relevance:** keep (capability/context) — **reframe** as a local-LLM code action: the
  extension already has a code-action provider; add an "Generate alt text" action that
  sends the image (vision) + surrounding context to the local model.
- **Status:** `pending`
- **Gap vs existing:** `src/codeaction/CodeActionProvider.ts` exists. Add an action for
  HTML/Markdown image lines: read the image file, send it (vision, 1.98-14) with the
  surrounding text, and offer the generated alt text as a quick fix.
- **Implemented in:** —

#### 1.100-30 · Drag and drop cell outputs to chat
- **Description:** Notebook cell outputs (image and text) can be **dragged into the Chat
  view** to attach them (text outputs require holding Alt to avoid clashing with text
  selection).
- **Image notes:** None (release notes reference a video of dragging a cell output into
  chat).
- **Relevance:** keep (capability/context) — UX extension of 1.99-29 (add cell output to
  chat).
- **Status:** `pending`
- **Gap vs existing:** 1.99-29 added the `llm.addCellOutput` command. Extend: support
  drag-and-drop of cell outputs onto the chat webview (image outputs directly; text
  outputs with an Alt modifier) and attach them the same way.
- **Implemented in:** —

#### 1.100-31 · Notebook tools for agent mode (run cell, kernel state, list/install packages)
- **Description:** New LLM tools: **Run cell** (agent runs notebook cells and reacts to
  results / does data exploration); **Get kernel state** (which cells executed, active
  variables); **List/Install packages** (Jupyter extension tools; delegated to Python
  Environments or pip).
- **Image notes:** None (release notes reference a video of the agent running a cell).
- **Relevance:** keep (capability/context) — agent capability for notebooks.
- **Status:** `pending`
- **Gap vs existing:** 1.99-28 added `new_notebook`; the extension has no cell-execution
  tools. Add: `run_notebook_cell` tool (execute a cell via the Jupyter API, capture
  outputs), `get_kernel_state` tool (executed cells + variable names), and
  `list_packages` / `install_package` tools (pip list / pip install in the kernel env).
  Gated on a Jupyter kernel being available.
- **Implemented in:** —

#### 1.100-38 · MCP Tool Annotations (human-readable names, `readOnlyHint` auto-approve)
- **Description:** VS Code displays human-readable names from MCP **tool annotations**;
  tools marked `readOnlyHint: true` run **without user confirmation**.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — MCP capability: read-only tools should not
  need the approval gate.
- **Status:** `pending`
- **Gap vs existing:** 1.99-2/1.99-8 built MCP tools + the approval gate. Extend: read
  `annotations` from `tools/list` results; show the human-readable name in the progress
  card; auto-approve tools with `readOnlyHint: true` (bypass the approval gate, still
  respect `llm.tools.requireApproval` for non-read-only tools).
- **Implemented in:** —

### VS Code 1.101 — May 2025 (GitHub Copilot section)

> Source: `https://code.visualstudio.com/updates/v1_101`. Entries in release-notes order
> (Chat → Accessibility → Editor Experience → Code Editing → Notebooks → Source Control →
> Contributions to extensions → Proposed APIs).

#### 1.101-1 · Chat tool sets
- **Description:** Define **tool sets** (grouped collections of tools) via a JSON config file
  (`Configure Tool Sets > Create new tool sets file`); reference a tool set in chat by
  `#toolset-name` or the tool picker; enable/disable whole groups in agent mode.
- **Image notes:** Screenshot of the Chat view using a `#gh-news` tool set highlighted in
  both the chat interface and the JSON config file.
- **Relevance:** keep (capability/context) — tool management.
- **Status:** `pending`
- **Gap vs existing:** the extension has individual tools but no grouping. Add: a tool-set
  config file (e.g. `.vscode/toolsets.json`), `#toolset` context reference, and tool-picker
  grouping.
- **Implemented in:** —

#### 1.101-2 · MCP support for prompts
- **Description:** MCP servers can define **prompts** (reusable snippets/tasks); accessible
  as slash commands in chat: `/mcp.servername.promptname`; supports prompt variables and
  completions.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — MCP capability.
- **Status:** `pending`
- **Gap vs existing:** the MCP client (1.99-2) handles tools only. Extend: `prompts/list` +
  `prompts/get` JSON-RPC methods; register slash commands per server prompt.
- **Implemented in:** —

#### 1.101-3 · MCP support for resources
- **Description:** MCP **resources** (including resource templates) are available: resources
  returned from tool calls can be saved in chat or dragged to Explorer; resources can be
  attached as context via Add Context; `MCP: Browse Resources` command.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — MCP capability.
- **Status:** `pending`
- **Gap vs existing:** no resource support. Extend: `resources/list`, `resources/templates/list`,
  `resources/read` JSON-RPC methods; context attachment for MCP resources.
- **Implemented in:** —

#### 1.101-4 · MCP support for sampling (Experimental)
- **Description:** MCP servers can make **sampling requests** back to the model (the server
  asks the LLM to generate text); confirmation on first use; configurable model access per
  server; request log.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — MCP capability.
- **Status:** `pending`
- **Gap vs existing:** no sampling support. Extend: handle `sampling/createMessage` JSON-RPC
  requests from the server; forward to the local model; return the result.
- **Implemented in:** —

#### 1.101-5 · MCP development mode
- **Description:** Add a `dev` key to the MCP server config: `watch` (file glob to restart
  the server on change) and `debug` (attach a debugger; Node.js and Python).
- **Image notes:** None.
- **Relevance:** keep (capability/context) — MCP dev UX.
- **Status:** `pending`
- **Gap vs existing:** no dev mode. Extend: parse `dev.watch` glob, watch for changes, restart
  the server process; `dev.debug` launches with `--inspect` (node) or `debugpy` (python).
- **Implemented in:** —

#### 1.101-6 · Chat UX improvements (distinct user messages, visible undo, navigable attachments)
- **Description:** User messages visually distinct from AI responses; undoing a request is
  visible (hover X button or ⌘Backspace); attachments from the input box are more navigable.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — chat UX.
- **Status:** `pending`
- **Gap vs existing:** the webview renders messages but user/AI distinction and per-request
  undo are not implemented. Add: distinct styling for user messages, a hover X to undo a
  request (and all following), and a navigable attachment list.
- **Implemented in:** —

#### 1.101-7 · Apply edits more efficiently (conditional auto-save/squiggles, aligned keybindings)
- **Description:** When the agent rewrites a file top-to-bottom, auto-save and squiggles are
  conditionally disabled; Keep/Undo keybindings aligned (⌘Y/⌘N per change, ⇧⌘Y/⇧⌘N for all).
- **Image notes:** None.
- **Relevance:** keep (capability/context) — edit UX.
- **Status:** `pending`
- **Gap vs existing:** the extension applies edits but does not conditionally disable
  auto-save or provide aligned keep/undo keybindings. Add: detect full-file rewrites,
  temporarily disable auto-save; register keep/undo keybindings.
- **Implemented in:** —

#### 1.101-8 · Custom chat modes (Preview)
- **Description:** Define **custom chat modes** via `*.chatprompt.md` files (front matter:
  `description`, `tools`); select the mode from the chat mode dropdown; each mode has its own
  instructions and tool set.
- **Image notes:** Screenshot of a custom chat mode selected in the Chat view.
- **Relevance:** keep (capability/context) — core chat capability.
- **Status:** `pending`
- **Gap vs existing:** the extension has Ask/Agent/Edit modes (1.99-10) but no custom modes.
  Add: `*.chatprompt.md` file discovery, front-matter parsing, mode dropdown entry, and
  per-mode instruction + tool filtering.
- **Implemented in:** —

#### 1.101-9 · Task diagnostic awareness
- **Description:** When the agent runs a task, it is aware of errors/warnings from problem
  matchers; the diagnostic context lets the agent respond to issues as they arise.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** the agent has `get_diagnostics` but does not automatically collect
  task-specific diagnostics after a task run. Add: after a task/terminal run, collect
  diagnostics from problem matchers and inject them into the agent context.
- **Implemented in:** —

#### 1.101-10 · Terminal cwd context
- **Description:** When agent mode has opened a terminal and shell integration is active,
  the agent is aware of the current working directory (cwd) for more accurate command support.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** the agent does not track terminal cwd. Add: after each terminal
  command, capture the cwd (via shell integration or `pwd`) and include it in the agent
  context for subsequent commands.
- **Implemented in:** —

#### 1.101-11 · Fetch tool confirmation (prompt-injection warning)
- **Description:** The fetch tool confirmation now shows a **warning about potential prompt
  injection** when fetching web content.
- **Image notes:** Screenshot of the fetch tool with a warning about prompt injection.
- **Relevance:** keep (capability/context) — safety UX.
- **Status:** `pending`
- **Gap vs existing:** the fetch tool (1.99-4) has a confirmation but no injection warning.
  Add: a warning line in the confirmation card: "Fetched content may contain instructions
  that could manipulate the model. Review before use."
- **Implemented in:** —

#### 1.101-12 · Customize more built-in tools
- **Description:** Enable/disable **all** built-in tools in agent mode or custom modes via
  the Configure Tools button (tool picker); some entries are tool sets grouping multiple tools.
- **Image notes:** Screenshot of the tool picker showing the "editFiles" tool set item cleared.
- **Relevance:** keep (capability/context) — tool management.
- **Status:** `pending`
- **Gap vs existing:** the extension has a tool list but no per-tool enable/disable UI. Add:
  a tool picker (quick pick or webview panel) listing all tools with checkboxes; persist
  per-mode tool enablement in settings.
- **Implemented in:** —

#### 1.101-13 · Send elements to chat — Live Preview (Experimental)
- **Description:** Extend the element-selection feature (1.100-18) to the **Live Preview**
  extension: select web elements in a live server preview and attach them to chat.
- **Image notes:** Screenshot showing the Live Preview extension with overlay controls to
  select web elements.
- **Relevance:** keep (capability/context) — reframe of 1.100-18; low priority.
- **Status:** `pending`
- **Gap vs existing:** none. Same as 1.100-18 but for Live Preview. Low priority.
- **Implemented in:** —

#### 1.101-14 · Follow mode for agent cell execution
- **Description:** Setting `llm.chat.notebook.followCellExecution.enabled`: the Notebook view
  auto-scrolls to the cell currently being executed by the agent; a pin icon in the toolbar
  toggles follow mode mid-response.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — notebook UX.
- **Status:** `pending`
- **Gap vs existing:** the extension has notebook tools (1.99-2, 1.99-28) but no follow mode.
  Add: when the agent runs a cell, reveal and scroll to that cell; a toolbar pin icon to
  toggle follow.
- **Implemented in:** —

#### 1.101-15 · Notebook tools for agent mode (configure kernel, summary, cell preview)
- **Description:** Jupyter extension contributes a **Configure Notebook** tool (select/create
  kernel); an internal **Notebook Summary** tool keeps the agent on track; **cell preview**
  in run confirmation shows a code snippet; cell links navigate to the notebook.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — agent capability for notebooks.
- **Status:** `pending`
- **Gap vs existing:** 1.100-31 added run/get-kernel-state/list-packages tools. Extend:
  `configure_notebook` tool (select kernel), notebook summary injection, cell code preview
  in the run confirmation card, and cell-link navigation.
- **Implemented in:** —

### VS Code 1.102 — June 2025 (GitHub Copilot section)

> Source: `https://code.visualstudio.com/updates/v1_102`. Entries in release-notes order
> (Chat → MCP → Accessibility → Code Editing → Editor Experience → Tasks → Terminal).

#### 1.102-1 · Chat mode improvements (model per mode, editing support, gear menu, vscode link import)
- **Description:** Custom chat modes can specify a **model** in front matter; the editor for
  modes/prompts/instructions supports completions, validation, hovers; a **gear menu** in the
  Chat view manages modes, instructions, prompts, tool sets; **vscode link** imports modes/
  prompts/instructions from URLs (e.g. gists).
- **Image notes:** Screenshots of IntelliSense for model metadata, hover for tools, model
  diagnostics, Configure Chat menu.
- **Relevance:** keep (capability/context) — chat mode UX.
- **Status:** `pending`
- **Gap vs existing:** 1.101-8 adds custom modes. Extend: `model` front-matter property,
  language features (completions/validation/hovers) for `.chatprompt.md`, a gear menu in the
  chat toolbar, and a `vscode://` link handler to import mode/prompt/instruction files.
- **Implemented in:** —

#### 1.102-2 · Generate custom instructions
- **Description:** `Chat: Generate Instructions` command: agent mode analyzes the codebase
  and generates a `copilot-instructions.md` file (or improves existing instruction files).
- **Image notes:** None.
- **Relevance:** keep (capability/context) — instructions capability.
- **Status:** `pending`
- **Gap vs existing:** the extension has instruction files (1.100-1) but no generation. Add:
  a command that runs the agent with a meta-prompt ("analyze this codebase and write
  instructions"), saves the result to `.github/copilot-instructions.md`.
- **Implemented in:** —

#### 1.102-3 · Load instruction files on demand
- **Description:** Each request gets a **list of all instruction files** (with glob pattern
  and description); the LLM can load an instruction file on demand by reading it, rather than
  having it auto-attached.
- **Image notes:** Screenshot showing the LLM loading instruction files on demand.
- **Relevance:** keep (capability/context) — instructions capability.
- **Status:** `pending`
- **Gap vs existing:** 1.100-1 auto-attaches instructions via `applyTo`. Extend: include a
  manifest of all instruction files (path, glob, description) in the system prompt; the
  agent can `read_file` them on demand.
- **Implemented in:** —

#### 1.102-4 · Edit previous requests (Experimental)
- **Description:** Click a previous request to modify text, attached context, mode, and model;
  submitting removes all subsequent requests, undoes edits, and resends. Setting
  `chat.editRequests` controls the entry point (inline / hover / input).
- **Image notes:** None.
- **Relevance:** keep (capability/context) — chat UX.
- **Status:** `pending`
- **Gap vs existing:** no request editing. Add: click a user message to enter edit mode
  (text + context + mode + model); on submit, truncate history after that message, revert
  file edits made after it, and resend.
- **Implemented in:** —

#### 1.102-5 · Terminal auto approval (Experimental)
- **Description:** Allow/deny lists for terminal commands (prefixes or regex); chained
  commands require all sub-commands to be approved; deny list overrides allow list. Settings:
  `llm.agent.terminal.allowList` / `llm.agent.terminal.denyList`.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — agent safety.
- **Status:** `pending`
- **Gap vs existing:** the approval gate (1.99-8) is per-command. Add: allow/deny list
  matching (prefix + regex), sub-command decomposition for `&&`/`|`/`;` chains, and
  auto-approval when all sub-commands match the allow list and none match the deny list.
- **Implemented in:** —

#### 1.102-6 · Terminal command simplification
- **Description:** Detect `cd <dir> && <cmd>` where `<dir>` matches the current cwd and
  simplify to just `<cmd>`.
- **Image notes:** Screenshot of the terminal asking to run only the simplified command.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** no command simplification. Add: before running a terminal command,
  detect a leading `cd <path> &&` where `<path>` equals the terminal cwd; strip it.
- **Implemented in:** —

#### 1.102-7 · Agent awareness of tasks and terminals (GetTaskOutput tool)
- **Description:** The agent knows which background terminals it created and which tasks are
  running; a new **GetTaskOutput** tool reads task output to prevent duplicate tasks.
- **Image notes:** Screenshot of two build tasks running; the agent summarizes their output.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** no task/terminal tracking. Add: track terminals created by the agent;
  a `get_task_output` tool that returns the output of a running/completed task or terminal.
- **Implemented in:** —

#### 1.102-8 · Agent mode badge indicator
- **Description:** A badge over the application icon (dock) when the window is unfocused and
  the agent needs user confirmation. Setting `chat.notifyWindowOnConfirmation`.
- **Image notes:** Screenshot of the VS Code dock icon showing an agent confirmation badge.
- **Relevance:** keep (capability/context) — UX.
- **Status:** `pending`
- **Gap vs existing:** no OS-level notification. Add: when a confirmation is pending and the
  window is unfocused, show a notification (VS Code `window.withValidation` or OS notification
  via `vscode.window.showInformationMessage` with a modal flag).
- **Implemented in:** —

#### 1.102-9 · Start chat from the command line
- **Description:** `code chat [options] [prompt]` CLI subcommand: `-m/--mode`, `-a/--add-file`,
  `--maximize`, `-r/--reuse-window`, `-n/--new-window`; reads from stdin with `-`.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — CLI capability.
- **Status:** `pending`
- **Gap vs existing:** no CLI entry point. Add: a `chat` subcommand handler in the extension
  that opens the chat view, sets the mode, attaches files, and sends the prompt.
- **Implemented in:** —

#### 1.102-10 · Fetch tool supports non-HTTP URLs
- **Description:** The fetch tool now supports `file://` URLs (and other non-HTTP schemes);
  returns the content of the file/resource; images are also supported.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — tool capability.
- **Status:** `pending`
- **Gap vs existing:** the fetch tool (1.99-4) handles HTTP/HTTPS only. Extend: handle
  `file://` URLs by reading the local file; return content as text or base64 (images).
- **Implemented in:** —

#### 1.102-11 · Reading chat requests (debug view)
- **Description:** `Show Chat Debug View` command: a tree view showing every request (full
  prompt, tools enabled, response, tool calls); exportable via right-click "Export As...".
- **Image notes:** None.
- **Relevance:** keep (capability/context) — debugging.
- **Status:** `pending`
- **Gap vs existing:** no request log. Add: an in-memory ring buffer of requests (prompt,
  tools, response, tool calls); a `TreeDataProvider` view; an export command (JSON/Markdown).
- **Implemented in:** —

#### 1.102-12 · Edit Tool Improvements
- **Description:** Improved predictability and reliability of the edit tools (apply_patch,
  replace_string) for different model families.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — tool reliability.
- **Status:** `pending`
- **Gap vs existing:** the edit tools (1.100-3) exist but may be unreliable with some models.
  Add: model-specific tool descriptions, fallback logic (if apply_patch fails, try
  replace_string), and clearer error messages.
- **Implemented in:** —

#### 1.102-13 · MCP support for elicitations
- **Description:** MCP servers can request **input from the user** (elicitation) via the
  latest MCP spec; VS Code shows an input dialog for the requested fields.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — MCP capability.
- **Status:** `pending`
- **Gap vs existing:** no elicitation support. Extend: handle `elicitation/create` JSON-RPC
  requests; show a quick pick or input box for each requested field; return the values.
- **Implemented in:** —

### VS Code 1.103 — July 2025 (GitHub Copilot section)

> Source: `https://code.visualstudio.com/updates/v1_103`. Entries in release-notes order
> (Chat → MCP → Accessibility → Editor Experience → Notebooks → Source Control → Terminal).

#### 1.103-1 · Chat checkpoints
- **Description:** **Checkpoints** let you restore different states of a chat conversation:
  revert workspace changes and chat history to a checkpoint; redo is supported. Setting
  `chat.checkpoints.enabled` (default on).
- **Image notes:** None.
- **Relevance:** keep (capability/context) — core chat capability.
- **Status:** `pending`
- **Gap vs existing:** no checkpoints. Add: snapshot file state (via VS Code's undo stack or
  a copy) before each agent edit; a checkpoint list in the chat; restore reverts files +
  truncates history; redo re-applies.
- **Implemented in:** —

#### 1.103-2 · Tool picker improvements (Quick Tree)
- **Description:** The tool picker is revamped with a **Quick Tree** component: expand/collapse
  nodes, configuration options in the title bar, sticky scrolling, icon rendering.
- **Image notes:** Screenshot of the new tool picker using a quick tree.
- **Relevance:** keep (capability/context) — tool UX.
- **Status:** `pending`
- **Gap vs existing:** 1.101-12 adds a basic tool picker. Extend: tree view with expandable
  tool-set nodes, icons, and a configuration button in the title bar.
- **Implemented in:** —

#### 1.103-3 · Tool grouping (Experimental)
- **Description:** When the number of tools exceeds a threshold (default 128), tools are
  **automatically grouped** and the model can activate/call groups of tools. Setting
  `llm.chat.virtualTools.threshold`.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — tool management.
- **Status:** `pending`
- **Gap vs existing:** no tool grouping. Add: when tool count > threshold, group tools by
  category; expose a `select_tool_group` meta-tool; the model activates a group to get its
  tools.
- **Implemented in:** —

#### 1.103-4 · Terminal auto-approve improvements
- **Description:** Merged allow/deny into `chat.tools.terminal.autoApprove`; regex flags
  supported; `matchCommandLine` option; auto-approve reasoning logged to Terminal Output.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — agent safety.
- **Status:** `pending`
- **Gap vs existing:** 1.102-5 adds allow/deny lists. Extend: merge into a single setting,
  support regex flags (`i`, `m`), `matchCommandLine` per-rule option, and log the matching
  rule to the output channel.
- **Implemented in:** —

#### 1.103-5 · Input request detection for terminals and tasks
- **Description:** When a task/terminal command requests user input, the agent detects it and
  prompts in chat (default/first option as primary action, others in a dropdown); works for
  multiple confirmations, all shells, foreground and background.
- **Image notes:** Screenshot of input being detected and responded to.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** no input detection. Add: monitor terminal output for prompt patterns
  (Y/N, select, input); when detected, show a chat confirmation with the options; send the
  selection to the terminal.
- **Implemented in:** —

#### 1.103-6 · Improved error detection for tasks with problem matchers
- **Description:** For tasks with problem matchers, the agent collects errors from the matcher
  results (not LLM evaluation); problems are presented in a dropdown in the chat progress
  message with navigation to the problem location.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** 1.101-9 adds diagnostic awareness. Extend: after a task run, parse
  problem-matcher output into diagnostics; show them in a dropdown in the progress card;
  clicking navigates to the file/line.
- **Implemented in:** —

#### 1.103-7 · Compound task support in agent mode
- **Description:** The agent can run **compound tasks** (tasks with dependencies); progress
  and output are shown for each dependent task, including input prompts.
- **Image notes:** Screenshot of the agent running a compound build task.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** no compound task support. Add: when the agent runs a task that has
  dependencies, run each dependency and show per-task progress; surface errors from any
  sub-task.
- **Implemented in:** —

#### 1.103-8 · Track progress with task lists (Experimental)
- **Description:** A **todo list tool** lets the agent break down tasks and track progress;
  the list is shown at the top of the Chat view and updates as the agent works. Setting
  `chat.todoListTool.enabled`.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** no todo list tool. Add: a `todo_list` tool (add/update/complete items);
  a collapsible panel at the top of the chat showing the current list; the agent calls the
  tool to update progress.
- **Implemented in:** —

#### 1.103-9 · Improved reliability and performance of run-in-terminal and task tools
- **Description:** The run-in-terminal and task tools are migrated to core for access to
  lower-level APIs; fixes many terminal hanging issues.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — tool reliability.
- **Status:** `pending`
- **Gap vs existing:** the terminal tool may hang. Add: improve the terminal tool's process
  management (proper stdin/stdout piping, timeout handling, cleanup on cancel).
- **Implemented in:** —

#### 1.103-10 · Output polling for tasks and terminals
- **Description:** The agent waits for tasks/background terminals to complete via **output
  polling**; if a process takes >20s, the user is prompted to continue waiting or move on;
  monitoring up to 2 minutes with state summaries.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** no output polling. Add: after launching a background command, poll
  output every few seconds; if >20s, show a "continue waiting?" prompt; summarize state at
  2-minute intervals.
- **Implemented in:** —

#### 1.103-11 · Task awareness improvement (completed tasks)
- **Description:** The agent can track and analyze output of **both active and completed**
  tasks, including failed ones.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** 1.102-7 tracks active tasks. Extend: keep a history of completed tasks
  (output, exit code, duration); the `get_task_output` tool accepts a task ID from history.
- **Implemented in:** —

#### 1.103-12 · Agent awareness of user-created terminals
- **Description:** The agent maintains awareness of **all user-created terminals** in the
  workspace: recent commands and terminal output for context and troubleshooting.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** no user-terminal awareness. Add: a `list_terminals` tool that returns
  all terminals (name, cwd, recent output); the agent can reference them in its context.
- **Implemented in:** —

#### 1.103-13 · Improved test runner tool
- **Description:** The test runner tool shows **progress inline** within chat; numerous bugs
  fixed.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — tool capability.
- **Status:** `pending`
- **Gap vs existing:** no test runner tool. Add: a `run_tests` tool that runs the project's
  test suite, streams progress (pass/fail per test) into the chat progress card, and returns
  a summary.
- **Implemented in:** —

#### 1.103-14 · Edit previous requests (GA, inline default)
- **Description:** Inline edits are the **default** behavior: click a request bubble to edit
  text, attachments, mode, model; resend with modifications. Setting `chat.editRequests`
  controls the behavior.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — chat UX.
- **Status:** `pending`
- **Gap vs existing:** 1.102-4 adds experimental edit. Extend: make inline edit the default
  (click bubble → edit in place); support editing attachments, mode, model.
- **Implemented in:** —

#### 1.103-15 · Pending chat confirmation (exit guard)
- **Description:** A dialog is shown when trying to quit VS Code or close the window while a
  chat response is in progress, to prevent losing work.
- **Image notes:** Screenshot of a confirmation to exit with running chat.
- **Relevance:** keep (capability/context) — UX.
- **Status:** `pending`
- **Gap vs existing:** no exit guard. Add: register a `window.state` handler; if a request is
  in progress, show a modal "A chat response is in progress. Are you sure you want to quit?"
- **Implemented in:** —

#### 1.103-16 · OS notification on user action
- **Description:** OS native notification (toast) when user confirmation is needed in a chat
  session; selecting the toast focuses the window. Setting `chat.notifyWindowOnConfirmation`.
- **Image notes:** Screenshot of a toast for confirmation of a chat agent.
- **Relevance:** keep (capability/context) — UX.
- **Status:** `pending`
- **Gap vs existing:** 1.102-8 adds a badge. Extend: use `vscode.window.registerFileSystemProvider`
  or OS notification APIs to show a native toast; clicking focuses the window.
- **Implemented in:** —

#### 1.103-17 · Math support in chat (Preview)
- **Description:** Render **mathematical equations** in chat responses using KaTeX; inline
  (`$...$`) and block (`$$...$$`) math. Setting `chat.math.enabled` (default off).
- **Image notes:** Screenshot of the Chat view showing inline and block equations.
- **Relevance:** keep (capability/context) — chat rendering.
- **Status:** `pending`
- **Gap vs existing:** no math rendering. Add: a KaTeX-based renderer in the webview; detect
  `$...$` and `$$...$$` in markdown; render with KaTeX CSS/JS.
- **Implemented in:** —

#### 1.103-18 · MCP server autostart and trust
- **Description:** Configure **auto-start** behavior for MCP servers (`chat.mcp.autostart`);
  the first time a server is started after a config change, a **trust dialog** is shown.
- **Image notes:** Screenshot of the hover on the refresh MCP server icon.
- **Relevance:** keep (capability/context) — MCP capability.
- **Status:** `pending`
- **Gap vs existing:** MCP servers (1.99-2) require manual refresh. Add: an autostart setting
  (always / on-change / manual); a trust dialog on first start after config change.
- **Implemented in:** —

#### 1.103-19 · MCP support for resource_link and structured output
- **Description:** Full support for MCP spec 2025-06-18: **resource_links** and **structured
  output** in tool results.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — MCP capability.
- **Status:** `pending`
- **Gap vs existing:** 1.101-3 adds basic resources. Extend: handle `resource_link` content
  blocks in tool results (render as clickable links); support structured output (JSON schema
  validation of tool results).
- **Implemented in:** —

#### 1.103-20 · Notebook inline chat with agent tools
- **Description:** The notebook inline chat control can use the full suite of **notebook agent
  tools** (run cells, install packages). Setting `inlineChat.notebookAgent` (experimental).
- **Image notes:** None.
- **Relevance:** keep (capability/context) — notebook capability.
- **Status:** `pending`
- **Gap vs existing:** inline chat (existing) does not have notebook tools. Add: when inline
  chat is in a notebook cell, enable the notebook tools (run_cell, get_kernel_state, etc.).
- **Implemented in:** —

### VS Code 1.104 — August 2025 (GitHub Copilot section)

> Source: `https://code.visualstudio.com/updates/v1_104`. Entries in release-notes order
> (Chat → MCP → Accessibility → Code Editing → Editor Experience → Notebooks → Source Control).

#### 1.104-1 · Confirm edits to sensitive files
- **Description:** The agent asks for **confirmation before editing sensitive files**
  (config files, dotfiles, files outside the workspace). Setting `chat.tools.edits.autoApprove`
  configures file patterns requiring confirmation.
- **Image notes:** Screenshot of a confirmation dialog for sensitive file edits.
- **Relevance:** keep (capability/context) — agent safety.
- **Status:** `pending`
- **Gap vs existing:** the approval gate (1.99-8) is per-tool, not per-file. Add: a file
  pattern list (default: dotfiles, config files, outside-workspace); before applying an edit,
  check the target file against the list; if sensitive, show a confirmation.
- **Implemented in:** —

#### 1.104-2 · Support for AGENTS.md files (Experimental)
- **Description:** An `AGENTS.md` file in the workspace root is **automatically picked up**
  as context for chat requests. Setting `chat.useAgentsMdFile` (default on).
- **Image notes:** None.
- **Relevance:** keep (capability/context) — instructions capability.
- **Status:** `pending`
- **Gap vs existing:** 1.100-1 supports `.instructions.md`. Extend: also detect `AGENTS.md`
  (and `agents.md`) in workspace roots; attach as context automatically.
- **Implemented in:** —

#### 1.104-3 · Improved changed files experience
- **Description:** The changed files list is **collapsed by default** (showing count + lines
  added/removed); keeping/accepting a change removes the file from the list; staging/committing
  auto-accepts; per-file line counts are shown.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — edit UX.
- **Status:** `pending`
- **Gap vs existing:** the changed files list exists but is always expanded. Add: collapse by
  default, show +/- counts, remove on accept, auto-accept on git stage/commit.
- **Implemented in:** —

#### 1.104-4 · Use custom chat modes in prompt files
- **Description:** Prompt files can reference **custom chat modes** (not just built-in
  ask/edit/agent) in their front matter `mode` field.
- **Image notes:** Screenshot showing IntelliSense for custom chat modes in prompt files.
- **Relevance:** keep (capability/context) — prompt capability.
- **Status:** `pending`
- **Gap vs existing:** 1.100-2 adds `mode` front matter with built-in modes. Extend: accept
  custom mode names (from `.chatprompt.md` files) in the `mode` field.
- **Implemented in:** —

#### 1.104-5 · Configure prompt file suggestions (Experimental)
- **Description:** Setting `chat.promptFilesRecommendations` controls which prompt files
  appear as suggestions in the Chat welcome view; supports boolean values and when-clause
  expressions for context-aware suggestions.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — prompt UX.
- **Status:** `pending`
- **Gap vs existing:** no prompt suggestions. Add: a setting mapping prompt file names to
  boolean/when-clause; show matching prompts in the welcome view.
- **Implemented in:** —

#### 1.104-6 · Select tools in tool sets
- **Description:** The tools picker shows which tools are part of each tool set and allows
  **individually enabling/disabling** each tool within a set.
- **Image notes:** Screenshot of the tools picker with an expanded edit tool set.
- **Relevance:** keep (capability/context) — tool management.
- **Status:** `pending`
- **Gap vs existing:** 1.101-1 adds tool sets. Extend: in the tool picker, expand a tool set
  to show its individual tools with checkboxes.
- **Implemented in:** —

#### 1.104-7 · Configure font used in chat
- **Description:** Settings `chat.fontFamily` and `chat.fontSize` control the font of chat
  messages.
- **Image notes:** Screenshot of the Chat view with a custom font and size.
- **Relevance:** keep (capability/context) — chat UX.
- **Status:** `pending`
- **Gap vs existing:** no font settings. Add: two settings; apply them as CSS variables in
  the webview.
- **Implemented in:** —

#### 1.104-8 · Terminal auto approve (GA improvements)
- **Description:** Enable/disable via `chat.tools.terminal.enableAutoApprove`; explicit opt-in
  via a dropdown in the Chat view; add rules from the Chat view; show which rule was applied;
  improved defaults; path-like rules; curl/wget warning.
- **Image notes:** Screenshots of the Enable Auto Approve dropdown, rule options, and rule
  links under a tool call.
- **Relevance:** keep (capability/context) — agent safety.
- **Status:** `pending`
- **Gap vs existing:** 1.103-4 improves the settings. Extend: an opt-in dropdown in the chat
  input; a "add rule" action on each terminal command; show the matched rule under the tool
  call; warn on curl/wget.
- **Implemented in:** —

#### 1.104-9 · Global auto approve (scary warning + setting rename)
- **Description:** A **warning dialog** appears the first time global auto approve is used;
  the setting is renamed to `chat.tools.global.autoApprove` (no migration).
- **Image notes:** Screenshot of the warning dialog.
- **Relevance:** keep (capability/context) — agent safety.
- **Status:** `pending`
- **Gap vs existing:** no global auto-approve. Add: a `llm.tools.global.autoApprove` setting
  (default false); when first enabled, show a modal warning about the risks.
- **Implemented in:** —

#### 1.104-10 · Math rendering enabled by default
- **Description:** Math rendering (1.103-17) is now **GA and enabled by default**; disable via
  `chat.math.enabled`.
- **Image notes:** Screenshot of the Chat view with math equations.
- **Relevance:** keep (capability/context) — chat rendering.
- **Status:** `pending`
- **Gap vs existing:** 1.103-17 adds math with default off. Extend: change the default to on.
- **Implemented in:** —

#### 1.104-11 · Improved task support (input detection, error detection, compound tasks)
- **Description:** Reiteration of 1.103-5/6/7: input request detection, error detection for
  problem matchers, compound task support — now GA.
- **Image notes:** Screenshot of the agent running a compound build task.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** same as 1.103-5/6/7. Mark as GA (remove experimental flag).
- **Implemented in:** —

#### 1.104-12 · Improved terminal support (shell integration timeout, prevent cmd.exe)
- **Description:** Configurable shell integration timeout
  (`chat.tools.terminal.shellIntegrationTimeout`); prevent Command Prompt usage (use
  PowerShell instead).
- **Image notes:** None.
- **Relevance:** keep (capability/context) — tool reliability.
- **Status:** `pending`
- **Gap vs existing:** no timeout setting. Add: a `llm.tools.terminal.shellIntegrationTimeout`
  setting (default 5000ms); on Windows, prefer PowerShell over cmd.exe.
- **Implemented in:** —

#### 1.104-13 · Todo List tool (GA)
- **Description:** The todo list tool (1.103-8) is now **enabled by default**; progress is
  displayed in the Todo control at the top of the Chat view, auto-collapsing as items complete.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** 1.103-8 adds the tool with default off. Extend: change default to on;
  auto-collapse completed items.
- **Implemented in:** —

#### 1.104-14 · Skip tool calls
- **Description:** When the agent requests confirmation for a tool call, the user can choose
  to **skip** the tool call and let the agent continue (instead of approve or cancel).
- **Image notes:** None.
- **Relevance:** keep (capability/context) — agent UX.
- **Status:** `pending`
- **Gap vs existing:** the approval gate has approve/cancel. Add: a "Skip" button that
  returns a "skipped by user" result to the model without executing the tool.
- **Implemented in:** —

#### 1.104-15 · Hide and disable AI features
- **Description:** Setting `chat.disableAIFeatures` disables and hides built-in AI features
  (chat, completions, NES); syncs across devices; per-profile/workspace.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — configuration.
- **Status:** `pending`
- **Gap vs existing:** no global disable. Add: a `llm.disableAll` setting that deactivates
  all providers (chat, completions, code actions) when true.
- **Implemented in:** —

#### 1.104-16 · MCP support for server instructions
- **Description:** VS Code reads **MCP server instructions** (from the server's `instructions`
  field) and includes them in the base prompt.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — MCP capability.
- **Status:** `pending`
- **Gap vs existing:** no server instructions. Extend: read the `instructions` field from
  `initialize` response; append to the system prompt.
- **Implemented in:** —

#### 1.104-17 · Enable MCP (access setting)
- **Description:** `chat.mcp.enabled` is migrated to `chat.mcp.access` with options: `all`
  (allow all servers) or `none` (disable MCP entirely).
- **Image notes:** None.
- **Relevance:** keep (capability/context) — MCP configuration.
- **Status:** `pending`
- **Gap vs existing:** no MCP access setting. Add: a `llm.mcp.access` setting (`all`/`none`);
  when `none`, skip all MCP server initialization.
- **Implemented in:** —

### VS Code 1.105 — September 2025 (GitHub Copilot section)

> Source: `https://code.visualstudio.com/updates/v1_105`. Entries in release-notes order
> (VS Code at GitHub Universe → Chat → MCP → Accessibility → Editor Experience → Source
> Control → Testing → Tasks → Terminal).

#### 1.105-1 · Plan agent
- **Description:** A built-in **Plan agent** analyzes tasks, breaks them into steps, and
  generates implementation plans before development; select "Plan" from the agents dropdown;
  uses the handoff feature to transition to implementation.
- **Image notes:** Screenshot of the Chat view with the Plan agent selected.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** no plan agent. Add: a "Plan" mode/agent with read-only tools
  (search, fetch, read_file) and instructions to produce a structured plan; a handoff button
  to switch to Agent mode with the plan as context.
- **Implemented in:** —

#### 1.105-2 · Handoffs
- **Description:** **Handoffs** let custom chat modes define guided transitions to other modes
  with a pre-filled prompt; specified in front matter `handoffs` array (label, agent, prompt,
  send).
- **Image notes:** None.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** no handoffs. Add: parse `handoffs` from `.chatprompt.md` front matter;
  after a response completes, show handoff buttons; clicking switches mode and pre-fills
  the prompt.
- **Implemented in:** —

#### 1.105-3 · Isolated subagents
- **Description:** **Subagents** delegate tasks to autonomous agents with their own context
  window; reference `#runSubagent` in prompts or custom modes; results return to the main
  session.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** no subagents. Add: a `run_subagent` tool that spawns a separate agent
  loop with its own context; the subagent runs autonomously and returns a final report.
- **Implemented in:** —

#### 1.105-4 · Fully qualified tool names
- **Description:** Tool names in prompt files and chat modes are **qualified by server/
  extension/tool set** (e.g. `search/codebase`, `github/mcp-server/list_issues`); a code
  action migrates unqualified names.
- **Image notes:** Screenshot of a code action to update an unqualified tool name.
- **Relevance:** keep (capability/context) — tool management.
- **Status:** `pending`
- **Gap vs existing:** tool names are unqualified. Add: a `server/toolname` format; parse
  qualified names in front matter; a code action to add the prefix.
- **Implemented in:** —

#### 1.105-5 · Improved edit tools for custom models
- **Description:** Improved edit tools for BYOK custom models; a 'learning' mechanism selects
  the optimal tool set; `github.copilot.chat.customOAIModels` setting for explicit tool lists.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — tool capability.
- **Status:** `pending`
- **Gap vs existing:** edit tools are model-agnostic. Add: a `llm.customModels` setting for
  per-model tool lists; a heuristic to select the best edit tool for the active model.
- **Implemented in:** —

#### 1.105-6 · Support for nested AGENTS.md files (Experimental)
- **Description:** Nested `AGENTS.md` files in subfolders provide **more specific context**
  for different parts of the codebase. Setting `chat.useNestedAgentsMdFiles` (experimental).
- **Image notes:** None.
- **Relevance:** keep (capability/context) — instructions capability.
- **Status:** `pending`
- **Gap vs existing:** 1.104-2 adds root AGENTS.md. Extend: scan subfolders for `AGENTS.md`;
  attach the most specific one based on the files in context.
- **Implemented in:** —

#### 1.105-7 · OS notifications for chat responses
- **Description:** OS badge and notification toast when a **chat response is received**
  (not just confirmation); includes a preview; selecting focuses the chat input. Setting
  `chat.notifyWindowOnResponseReceived`.
- **Image notes:** Screenshot of an OS notification while the window is unfocused.
- **Relevance:** keep (capability/context) — UX.
- **Status:** `pending`
- **Gap vs existing:** 1.103-16 adds confirmation notifications. Extend: also notify when a
  response completes; include a text preview.
- **Implemented in:** —

#### 1.105-8 · Chain of thought (Experimental)
- **Description:** Show the model's **reasoning/thinking tokens** as expandable sections in
  the response. Setting `chat.agent.thinkingStyle`.
- **Image notes:** Screenshot of thinking tokens as expandable sections.
- **Relevance:** keep (capability/context) — chat UX.
- **Status:** `pending`
- **Gap vs existing:** no thinking display. Add: detect thinking/reasoning tokens in the
  response (model-specific); render as collapsible `<details>` sections in the webview.
- **Implemented in:** —

#### 1.105-9 · Show recent chat sessions (Experimental)
- **Description:** Show **recent local chat conversations** in the empty chat state for quick
  pickup. Setting `chat.emptyState.history.enabled` (default off).
- **Image notes:** Screenshot of recent conversations in the Chat view.
- **Relevance:** keep (capability/context) — chat UX.
- **Status:** `pending`
- **Gap vs existing:** no session history. Add: persist recent sessions (title, timestamp,
  first message); show them in the welcome view; clicking restores the session.
- **Implemented in:** —

#### 1.105-10 · Keep or undo changes during an agent loop
- **Description:** Keep or undo file edits **while the agent is still processing** (previously
  only after completion).
- **Image notes:** None.
- **Relevance:** keep (capability/context) — edit UX.
- **Status:** `pending`
- **Gap vs existing:** keep/undo is disabled during an active request. Add: enable the
  keep/undo buttons while the agent loop is running; apply/revert immediately.
- **Implemented in:** —

#### 1.105-11 · Keyboard shortcuts for navigating user chat messages
- **Description:** Navigate up/down through previous chat prompts: ⌥⌘↑ / ⌥⌘↓ (Ctrl+Alt+Up/Down).
- **Image notes:** None.
- **Relevance:** keep (capability/context) — chat UX.
- **Status:** `pending`
- **Gap vs existing:** no message navigation. Add: two keybindings that scroll the chat view
  to the previous/next user message.
- **Implemented in:** —

#### 1.105-12 · Chat terminal profiles
- **Description:** Platform-specific settings (`chat.tools.terminal.terminalProfile.windows/osx/linux`)
  configure the shell launched by the run-in-terminal tool (path, args, env).
- **Image notes:** None.
- **Relevance:** keep (capability/context) — tool configuration.
- **Status:** `pending`
- **Gap vs existing:** no terminal profile. Add: three settings (one per platform) with
  `{path, args, env}`; use them when creating the agent's terminal.
- **Implemented in:** —

#### 1.105-13 · Auto-reply to terminal prompts (Experimental)
- **Description:** Setting `chat.tools.terminal.autoReplyToPrompts` enables the agent to
  **automatically respond** to terminal input prompts (e.g. "Confirm? y/n").
- **Image notes:** None.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** 1.103-5 detects prompts and asks the user. Extend: when this setting
  is on, auto-select the default/first option without user interaction.
- **Implemented in:** —

#### 1.105-14 · Terminal free-form input request detection
- **Description:** When the terminal requires **free-form input** (not just Y/N), a
  confirmation prompt is shown in chat.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** 1.103-5 handles option-based prompts. Extend: detect free-form input
  prompts (e.g. "Enter name:"); show a text input in chat; send the value to the terminal.
- **Implemented in:** —

#### 1.105-15 · Autostart MCP servers (GA)
- **Description:** New/outdated MCP servers are **started automatically** when a chat message
  is sent; no dialogs during autostart — an indicator in chat shows when a server needs
  attention.
- **Image notes:** Screenshot of a notification that a server requires restarting.
- **Relevance:** keep (capability/context) — MCP capability.
- **Status:** `pending`
- **Gap vs existing:** 1.103-18 adds autostart with a trust dialog. Extend: make autostart
  the default; suppress dialogs; show a chat indicator for servers needing restart.
- **Implemented in:** —

#### 1.105-16 · Improved representation of MCP resources returned from tools
- **Description:** Tool results containing resources include a **preview of the resource
  content** and instructions to retrieve the complete contents.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — MCP capability.
- **Status:** `pending`
- **Gap vs existing:** 1.103-19 adds resource_links. Extend: when a tool result contains a
  resource, include a content preview (first N chars) + a "read full resource" instruction.
- **Implemented in:** —

#### 1.105-17 · MCP specification updates (icons, elicitation defaults)
- **Description:** SEP-973: MCP servers can specify **icons** for servers, resources, tools.
  SEP-1034: MCP servers can provide **default values** for elicitation fields.
- **Image notes:** Screenshot of the tools picker with a custom MCP server icon.
- **Relevance:** keep (capability/context) — MCP capability.
- **Status:** `pending`
- **Gap vs existing:** no icon support. Extend: read `icon` fields from MCP metadata; render
  in the tool picker and progress cards; use elicitation defaults in input dialogs.
- **Implemented in:** —

### VS Code 1.106 — October 2025 (GitHub Copilot section)

> Source: `https://code.visualstudio.com/updates/v1_106`. Entries in release-notes order
> (Agents → Code Editing → Editor Experience → Chat → MCP → Accessibility → Notebooks →
> Source Control).

#### 1.106-1 · Plan agent (GA, clarifying questions, custom plan agent)
- **Description:** The Plan agent (1.105-1) is GA: prompts with **clarifying questions**,
  generates a detailed plan for approval; a **custom plan agent** can be created via
  "Configure Custom Agent" menu.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** 1.105-1 adds the plan agent. Extend: add a clarifying-questions phase
  before plan generation; a "Copy as Custom Agent" action in the agent config menu.
- **Implemented in:** —

#### 1.106-2 · Chat modes renamed to custom agents
- **Description:** Chat modes are renamed to **custom agents**; definition files move to
  `.github/agents/` with `.agent.md` suffix; `Chat: New Custom Agent...` and
  `Chat: Configure Custom Agents...` commands; existing `.chatmode.md` files still work.
- **Image notes:** Screenshot of the agent picker control.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** 1.101-8 adds custom modes in `.chatprompt.md`. Extend: support
  `.github/agents/*.agent.md` files; rename UI terminology; migration code action for
  `.chatmode.md` → `.agent.md`.
- **Implemented in:** —

#### 1.106-3 · Custom agent metadata
- **Description:** `.agent.md` files accept additional front matter: `target` (vscode /
  github-copilot), `name` (override label), `argument-hint` (input guidance), `handoffs`
  (transitions). Editor provides validation, completions, hovers, code actions.
- **Image notes:** GIF of validation while editing custom agent files.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** 1.106-2 adds agent files. Extend: parse `target`, `name`,
  `argument-hint`, `handoffs`; add language features (validation, completions, hovers).
- **Implemented in:** —

#### 1.106-4 · Embeddings-based tool selection
- **Description:** Improved **tool filtering and grouping** for users with >100 tools;
  reduced "Optimizing tool selection..." loading; lower probability of agent confusion.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — tool management.
- **Status:** `pending`
- **Gap vs existing:** 1.103-3 adds tool grouping. Extend: use a simple relevance heuristic
  (keyword match between the prompt and tool descriptions) to filter tools before sending
  to the model.
- **Implemented in:** —

#### 1.106-5 · Tool approvals and trust (post-approval, trust-all, status moved)
- **Description:** **Post-approval** for external data (fetch, MCP tools with `openWorldHint`):
  review data before use. **Trust all tools** for a server/extension via the Allow dropdown.
  Auto-approval status moved to the tool call tick icon.
- **Image notes:** Screenshot of the Manage Tool Approval command.
- **Relevance:** keep (capability/context) — agent safety.
- **Status:** `pending`
- **Gap vs existing:** the approval gate (1.99-8) is pre-approval only. Add: a post-approval
  step for fetch/MCP results (show content, "Use" / "Discard"); a "Trust all from server X"
  option; move the auto-approve indicator to the tick icon.
- **Implemented in:** —

#### 1.106-6 · Terminal auto approve parser improvements
- **Description:** Integrated a **bash/PowerShell grammar parser** for sub-command detection
  (handles pipes in strings, `$()`, backticks, etc.); more reliable than naive splitting.
- **Image notes:** Screenshot of detecting `$()` inside echo calls.
- **Relevance:** keep (capability/context) — agent safety.
- **Status:** `pending`
- **Gap vs existing:** 1.102-5 uses naive splitting. Extend: use a proper shell parser
  (e.g. `shell-quote` or a hand-rolled tokenizer) to extract sub-commands.
- **Implemented in:** —

#### 1.106-7 · File write/redirection detection (Experimental)
- **Description:** The parser extracts **files being written** via redirection; setting
  `chat.tools.terminal.blockDetectedFileWrites` prevents auto-approval when a file write is
  detected (especially outside the workspace).
- **Image notes:** Screenshot of writing outside the workspace blocking auto approval.
- **Relevance:** keep (capability/context) — agent safety.
- **Status:** `pending`
- **Gap vs existing:** no file-write detection. Add: from the parsed command, extract
  redirection targets (`>`, `>>`); if the target is outside the workspace, block auto-approve.
- **Implemented in:** —

#### 1.106-8 · Disable default auto approve rules (Experimental)
- **Description:** Setting `chat.tools.terminal.ignoreDefaultAutoApproveRules` disables the
  default allow/deny rules for full user control.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — agent safety.
- **Status:** `pending`
- **Gap vs existing:** default rules are always active. Add: a boolean setting; when true,
  skip the built-in defaults and use only user-defined rules.
- **Implemented in:** —

#### 1.106-9 · Shell specific prompts and command rewriting
- **Description:** Shell-specific descriptions for PowerShell, bash, zsh, fish; PowerShell
  `&&` → `;` rewriting (Windows PowerShell v5).
- **Image notes:** None.
- **Relevance:** keep (capability/context) — tool capability.
- **Status:** `pending`
- **Gap vs existing:** no shell-specific handling. Add: detect the active shell; include
  shell-specific hints in the tool description; rewrite `&&` to `;` for PowerShell.
- **Implemented in:** —

#### 1.106-10 · Attach terminal commands to chat
- **Description:** Attach a **terminal command** to chat as context from the command
  decoration's context menu; shares command line, captured output, and exit code.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — context capability.
- **Status:** `pending`
- **Gap vs existing:** no terminal command attachment. Add: a context menu action on terminal
  command decorations; attach the command + output + exit code as a context item.
- **Implemented in:** —

#### 1.106-11 · View terminal output inside chat (Experimental)
- **Description:** Setting `chat.tools.terminal.outputLocation` controls where output is
  displayed; "Show Terminal" and "Show Output" actions on the progress element; output view
  expands on non-zero exit.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — tool UX.
- **Status:** `pending`
- **Gap vs existing:** terminal output is shown in the panel. Add: an `outputLocation`
  setting (`panel` / `chat` / `none`); when `chat`, render output inline in the progress
  card; auto-expand on error.
- **Implemented in:** —

#### 1.106-12 · Discover hidden chat terminals (Experimental)
- **Description:** When `outputLocation: none`, a "X hidden terminal(s)" button appears in
  the terminal tabs view; opens a quick pick listing each chat terminal with its session.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — tool UX.
- **Status:** `pending`
- **Gap vs existing:** no hidden terminal discovery. Add: track chat-created terminals; when
  hidden, show a button in the terminal panel; quick pick to reveal/focus.
- **Implemented in:** —

#### 1.106-13 · Save conversation as prompt
- **Description:** `/savePrompt` command: generates a **prompt file** from the current
  conversation (generalized prompt); a blue button saves it to user or workspace level.
- **Image notes:** Screenshot of the Save prompt button in the editor.
- **Relevance:** keep (capability/context) — prompt capability.
- **Status:** `pending`
- **Gap vs existing:** no save-as-prompt. Add: a `/savePrompt` slash command; ask the model
  to generalize the conversation into a reusable prompt; show it in an editor with a save
  button (user/workspace location picker).
- **Implemented in:** —

#### 1.106-14 · Edit welcome prompts
- **Description:** Right-click a suggested prompt in the Chat welcome view → "Edit Prompt
  File" opens the corresponding prompt file in the editor.
- **Image notes:** Screenshot of the context menu for a suggested prompt.
- **Relevance:** keep (capability/context) — prompt UX.
- **Status:** `pending`
- **Gap vs existing:** no edit action on welcome prompts. Add: a context menu on welcome
  prompt items; "Edit Prompt File" opens the `.prompt.md` file.
- **Implemented in:** —

#### 1.106-15 · Automatically open edited files (opt-in)
- **Description:** The agent **no longer auto-opens** edited files by default; setting
  `accessibility.openChatEditedFiles` re-enables the previous behavior.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — edit UX.
- **Status:** `pending`
- **Gap vs existing:** edited files are auto-opened. Add: a `llm.openEditedFiles` setting
  (default false); only open the file in the editor when true.
- **Implemented in:** —

#### 1.106-16 · Reasoning (Experimental, expanded)
- **Description:** Thinking tokens (1.105-8) are available in more models; `thinkingStyle`
  adjusted to three styles (default `fixedScrolling`); new setting
  `chat.agent.thinking.collapsedTools` adds tool calls into the collapsible thinking UI.
- **Image notes:** Screenshot of reasoning tokens with interleaved tool calls.
- **Relevance:** keep (capability/context) — chat UX.
- **Status:** `pending`
- **Gap vs existing:** 1.105-8 adds basic thinking display. Extend: three style options
  (show/hide/fixedScrolling); a `collapsedTools` setting to include tool calls in the
  thinking section.
- **Implemented in:** —

#### 1.106-17 · Inline chat v2 (Preview)
- **Description:** Inline chat is modernized: **single prompt, single file, code changes
  only**; lighter UI; tasks it cannot handle are upgraded to the Chat view. Setting
  `inlineChat.enableV2`.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — inline chat capability.
- **Status:** `pending`
- **Gap vs existing:** inline chat (existing) is multi-purpose. Add: a v2 mode that restricts
  inline chat to single-file code edits; if the model attempts a non-edit action, upgrade
  to the Chat view.
- **Implemented in:** —

#### 1.106-18 · Chat view UX improvements
- **Description:** New Chat action is a **dropdown** (editor / new window); tools and MCP
  actions moved next to the model picker; configuration dropdown cleaned up; copy math
  source via right-click.
- **Image notes:** Screenshot of the new chat dropdown menu.
- **Relevance:** keep (capability/context) — chat UX.
- **Status:** `pending`
- **Gap vs existing:** the chat toolbar is basic. Add: a dropdown for new chat (panel /
  editor / window); reorganize toolbar buttons; a "Copy Math Source" context menu on math
  expressions.
- **Implemented in:** —

#### 1.106-19 · Install MCP servers to workspace configuration
- **Description:** When installing an MCP server, choose **global or workspace** scope;
  workspace installs add to `.vscode/mcp.json`.
- **Image notes:** Screenshot of the context menu with "Install (Workspace)".
- **Relevance:** keep (capability/context) — MCP configuration.
- **Status:** `pending`
- **Gap vs existing:** MCP servers (1.99-2) are user-scoped only. Add: a scope picker
  (user / workspace) in the add-server flow; workspace scope writes to `.vscode/mcp.json`.
- **Implemented in:** —

### VS Code 1.107 — November 2025 (GitHub Copilot section)

> Source: `https://code.visualstudio.com/updates/v1_107`. Entries in release-notes order
> (Agents → Chat → MCP → Accessibility → Editor Experience → Code Editing → Source Control →
> Debugging → Terminal → Authentication → Languages → Remote Development).

#### 1.107-1 · Integrating agent sessions and chat
- **Description:** Agent sessions are **integrated into the Chat view**: a sessions list shows
  status, progress, file change stats; archive/unarchive; workspace-scoped list; open in
  Side Bar / editor / new window. Settings: `chat.viewSessions.enabled`,
  `chat.viewSessions.orientation` (auto/stacked/sideBySide).
- **Image notes:** Screenshots of the sessions list, context menu, compact view, side-by-side
  view.
- **Relevance:** keep (capability/context) — chat UX.
- **Status:** `pending`
- **Gap vs existing:** no sessions list. Add: a sessions panel in the chat view (list of
  active/recent sessions with status); archive/unarchive; open in panel/editor/window;
  orientation setting.
- **Implemented in:** —

#### 1.107-2 · Local agent sessions remain active when closed
- **Description:** Closing a local chat session **does not cancel** a running agent request;
  the agent continues in the background; status is visible in the sessions list.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** closing the chat view cancels the request. Add: decouple the agent
  loop from the webview lifecycle; the loop continues in the extension host; the webview
  reconnects when reopened.
- **Implemented in:** —

#### 1.107-3 · Use custom agents with background agents (Experimental)
- **Description:** Custom agents from `.github/agents` appear in the **background agent**
  list. Setting `github.copilot.chat.cli.customAgents.enabled`.
- **Image notes:** Screenshot of a background agent session with a custom Planner agent.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** 1.106-2 adds custom agents for chat. Extend: also list them in the
  background/CLI agent picker.
- **Implemented in:** —

#### 1.107-4 · Agent tooling reorganization
- **Description:** Tool references and toolset names are **renamed** for compatibility with
  GitHub custom agents; existing references still work but a **code action** suggests the
  new format.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — tool management.
- **Status:** `pending`
- **Gap vs existing:** tool names are stable. Add: a mapping of old → new tool names; a code
  action in agent files to update references.
- **Implemented in:** —

#### 1.107-5 · Run agents as subagents (Experimental)
- **Description:** Custom agents can be used as **subagents** (1.105-3); the model selects
  the subagent based on its description; `infer: false` in front matter prevents auto-use.
  Setting `chat.customAgentInSubagent.enabled`.
- **Image notes:** Screenshot of a chat conversation using a custom agent as subagent.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** 1.105-3 adds subagents. Extend: list custom agents as available
  subagents; the model picks one based on description; `infer: false` excludes from auto-
  selection.
- **Implemented in:** —

#### 1.107-6 · Reuse Claude skills (Experimental)
- **Description:** VS Code can discover and use **Claude skills** (`SKILL.md` files in
  `~/.claude/skills/` or `${workspaceFolder}/.claude/skills/`); the agent reads the skill
  description and loads full instructions on demand. Setting `chat.useClaudeSkills`.
- **Image notes:** Screenshot of reusing Claude skills in chat.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** no skill support. Add: scan for `SKILL.md` files; include a manifest
  (name, description) in the system prompt; the agent can `read_file` the full skill on
  demand.
- **Implemented in:** —

#### 1.107-7 · Inline chat UX (GA, upgrade to Chat view)
- **Description:** Inline chat (1.106-17) is GA: optimized for **single-file code changes**;
  tasks it cannot handle are **automatically upgraded** to the Chat view (same model, same
  context, prompt replayed).
- **Image notes:** None.
- **Relevance:** keep (capability/context) — inline chat capability.
- **Status:** `pending`
- **Gap vs existing:** 1.106-17 adds v2 preview. Extend: make v2 the default; implement the
  upgrade-to-chat flow (detect non-edit intent, open Chat view, replay prompt + context).
- **Implemented in:** —

#### 1.107-8 · Language Models editor
- **Description:** A **Language Models editor** (`Chat: Manage Language Models`) lists all
  available models (capabilities, context size, billing, visibility); search/filter by
  provider, capability, visibility; toggle model visibility; add models from installed
  providers.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — model management.
- **Status:** `pending`
- **Gap vs existing:** the model picker is a simple dropdown. Add: a webview editor listing
  all models with metadata; visibility toggles; a search/filter bar; an "Add Models" action.
- **Implemented in:** —

#### 1.107-9 · URL and domain auto approval (two-step fetch)
- **Description:** Two-step approval for fetch: (1) approve the URL/domain (one-time or
  auto-approve future requests to that domain); (2) approve using the fetched content in
  chat (post-approval). Respects "Trusted Domains".
- **Image notes:** Screenshot of the confirmation to approve a fetch request.
- **Relevance:** keep (capability/context) — agent safety.
- **Status:** `pending`
- **Gap vs existing:** 1.101-11 adds a warning. Extend: a two-step flow: first approve the
  domain (with "always trust this domain" option), then review the content before use.
- **Implemented in:** —

#### 1.107-10 · More robust fetch tool (dynamic content)
- **Description:** The fetch tool handles **dynamic web content** (SPAs, JS-rendered pages):
  waits for JavaScript to execute before retrieving the page.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — tool capability.
- **Status:** `pending`
- **Gap vs existing:** the fetch tool (1.99-4) retrieves static HTML. Extend: use a headless
  browser (or a JS-rendering service) for URLs that appear to be SPAs; wait for network idle
  before capturing the DOM.
- **Implemented in:** —

#### 1.107-11 · Text Search tool can search ignored files
- **Description:** The `#textSearch` tool supports searching in **ignored files/folders**
  (`.gitignore`, `files.exclude`, `search.exclude`); returns hints about ignored locations
  when there are no results.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — tool capability.
- **Status:** `pending`
- **Gap vs existing:** the search tool respects ignore rules. Add: an `includeIgnored`
  parameter on the search tool; when no results, return a hint listing the ignored
  directories that were skipped.
- **Implemented in:** —

#### 1.107-12 · Rich terminal output in chat
- **Description:** "Toggle Output" on a Run in Terminal response renders output in a
  **full read-only xterm.js terminal** inside chat; preserves output after the terminal
  exits; adopts the integrated terminal's color theme.
- **Image notes:** None.
- **Relevance:** keep (capability/context) — tool UX.
- **Status:** `pending`
- **Gap vs existing:** 1.106-11 adds inline output. Extend: render output in an embedded
  xterm.js instance (read-only) with ANSI colors; persist the output buffer for re-opening.
- **Implemented in:** —

#### 1.107-13 · Command status details in chat terminals
- **Description:** Chat terminal messages display **command start time, duration, and exit
  code** on hover of the command decoration.
- **Image notes:** Screenshot of the command decoration hover.
- **Relevance:** keep (capability/context) — tool UX.
- **Status:** `pending`
- **Gap vs existing:** no status details. Add: track start time, duration, exit code for
  each terminal command; show them in a hover tooltip on the command decoration.
- **Implemented in:** —

#### 1.107-14 · Allow all terminal commands in this session
- **Description:** A new auto-approve option: **"Allow All Commands in this Session"** —
  all future terminal commands in the current session are auto-approved.
- **Image notes:** Screenshot of the "Allow All Commands in this Session" option.
- **Relevance:** keep (capability/context) — agent safety.
- **Status:** `pending`
- **Gap vs existing:** approval is per-command or per-rule. Add: a "Allow All in Session"
  button on the approval card; sets a session-scoped flag that bypasses all terminal
  approvals for the current chat session.
- **Implemented in:** —

#### 1.107-15 · Keyboard shortcuts for chat terminal actions
- **Description:** Focus the most recent chat terminal or toggle its expansion:
  ⇧⌥⌘O (Ctrl+Shift+Alt+O).
- **Image notes:** None.
- **Relevance:** keep (capability/context) — tool UX.
- **Status:** `pending`
- **Gap vs existing:** no terminal focus shortcut. Add: a keybinding that focuses the most
  recent chat-created terminal or toggles its output expansion.
- **Implemented in:** —

#### 1.107-16 · Keyboard shortcuts for custom agents
- **Description:** Each custom agent has a **separate command** (`Chat: Open Chat (Agent
  Name)`) that can be bound to a keyboard shortcut.
- **Image notes:** Screenshot of custom agent commands in the Command Palette.
- **Relevance:** keep (capability/context) — agent capability.
- **Status:** `pending`
- **Gap vs existing:** no per-agent commands. Add: register a command per custom agent
  (`llm.openChat.<agentName>`) that opens the chat view with that agent selected.
- **Implemented in:** —

#### 1.107-17 · Chat view appearance improvements
- **Description:** Chat **title control** at the top (with "back to empty chat"); setting
  `chat.viewWelcome.enabled` hides the welcome banner; **restore previous session** by
  default after restart (`chat.viewRestorePreviousSession`).
- **Image notes:** Screenshot of the empty chat view with welcome hidden.
- **Relevance:** keep (capability/context) — chat UX.
- **Status:** `pending`
- **Gap vs existing:** no title control or session restore. Add: a title bar in the chat
  view showing the session title + a "new chat" button; a welcome-hidden setting; auto-
  restore the last session on activation.
- **Implemented in:** —

#### 1.107-18 · Diffs for edits to sensitive files
- **Description:** When editing sensitive files (1.104-1), show a **diff** of the proposed
  changes (instead of the raw edit) for easier review.
- **Image notes:** Screenshot of a diff of proposed changes to settings.json.
- **Relevance:** keep (capability/context) — agent safety.
- **Status:** `pending`
- **Gap vs existing:** 1.104-1 shows a confirmation but not a diff. Extend: when the target
  file is sensitive, compute a unified diff and render it in the confirmation card.
- **Implemented in:** —

#### 1.107-19 · Collapsible reasoning and tools output (Experimental)
- **Description:** Successive tool calls are **collapsed by default** to reduce visual noise;
  collapsible items are summarized with an **AI-generated title**. Settings:
  `chat.agent.thinkingStyle`, `chat.agent.thinking.collapsedTools`.
- **Image notes:** Screenshot of multiple tool calls collapsed in a section.
- **Relevance:** keep (capability/context) — chat UX.
- **Status:** `pending`
- **Gap vs existing:** 1.106-16 adds thinking collapse. Extend: also collapse successive
  tool calls into a single section; ask the model to generate a short title for the section.
- **Implemented in:** —

#### 1.107-20 · Support for the latest MCP specification (2025-11-25)
- **Description:** MCP spec 2025-11-25: **URL mode elicitation**, **tasks** for long-running
  tool calls, **enum choices** in elicitation; plus draft features (WWW-Authenticate scope
  consent, CIMD auth, icons).
- **Image notes:** None.
- **Relevance:** keep (capability/context) — MCP capability.
- **Status:** `pending`
- **Gap vs existing:** 1.105-17 adds icons + elicitation defaults. Extend: handle URL-mode
  elicitation (server provides a URL for the user to complete); support `tasks` (long-
  running tool calls with progress); enum choices in elicitation fields.
- **Implemented in:** —


## Done

Recap: see **Completed versions** in the Backlog section (1.98 and 1.99 complete; 1.100 items 1, 2, 3, 7 done).

## Skipped (decision trail)

- **1.98:** 5 (limits), 13 (cloud models) = cost; 7 (auth), 17 (PR text) = GitHub-service; 11 (NES), 16 (TS context) = VS Code core.
- **1.99:** skipped items recorded in the per-version recap; none are pending.
- **1.100:** 4 (base model) = cost; 5 (`#githubRepo`), 35 (PR/Issues) = GitHub-service; 6, 9, 17, 20–28, 32–37 = VS Code core.
- **1.101:** 7 (Fix task config errors) = GitHub-service; 16 (Floating window) = VS Code core; 20 (Python chat tools) = extension-specific; 21 (SC history item to chat) = GitHub-service.
- **1.102:** 1 (open source announcement) = not a feature; 9 (maximized chat view) = VS Code core; 10 (LM access management) = account; 14 (MCP GA) = not a feature; 15 (MCP discovery/install) = service; 16 (MCP management view) = VS Code core; 17 (MCP first-class resources) = VS Code core; 18 (MCP auth quick mgmt) = account.
- **1.103:** 1–2 (GPT-5/mini availability) = cost; 9 (model mgmt API) = provider; 10 (Azure DevOps index) = service; 14 (terminal inline chat) = minor; 16 (open chat maximized) = VS Code core; 19 (Context7) = third-party; 21 (client credentials flow) = auth; 22 (remove dynamic auth) = auth.
- **1.104:** 1 (auto model selection) = cost; 9 (collaborate with coding agents) = GitHub-service; 10 (social sign in) = account; 11 (chat view default visibility) = VS Code core; 14 (semantic search upgrade) = model; 18 (MCP auto discovery) = minor.
- **1.105:** 4 (OpenAI Codex integration) = third-party; 5 (Copilot CLI integration) = GitHub-service; 12 (agent sessions view) = GitHub-service; 13 (delegating to remote agents) = GitHub-service; 15 (sign in with Apple) = account; 16 (model availability) = cost; 18 (MCP marketplace) = service.
- **1.106:** 1 (Agent Sessions view) = GitHub-service; 2 (cloud agents) = GitHub-service; 3 (CLI agents) = GitHub-service; 4 (agent delegation) = GitHub-service; 5 (CLI agent edit tracking) = GitHub-service; 20 (MCP org access) = service; 21 (CIMD auth) = auth; 22 (WWW-Authenticate scope) = auth.
- **1.107:** 2 (continue in background/cloud) = GitHub-service; 3 (git worktrees) = GitHub-service; 4 (context to background agents) = GitHub-service; 5 (share agents across org) = GitHub-service; 7 (Azure Entra ID) = service; 8 (Anthropic extended thinking) = model-specific; 21 (GitHub MCP Server) = GitHub-service.

## Pending (oldest → newest — orchestrator picks the first)

1. **1.100-8** Chat input improvements — attachment pills, streamlined picker, no Done button
2. **1.100-10** Autofix diagnostics from agent mode edits — auto follow-up edit on new errors
3. **1.100-11** Handling of undo and manual edits in agent mode — detect user edits, re-read files
4. **1.100-12** Conversation summary — compress long history to fit the local model's context window
5. **1.100-13** MCP support for Streamable HTTP — `url`-based servers, SSE fallback
6. **1.100-14** MCP support for image output — image content blocks in tool results
7. **1.100-15** Enhanced MCP input/output/progress UI — pretty I/O + progress notifications
8. **1.100-16** MCP config generation uses `inputs` for secrets
9. **1.100-18** Select and attach UI elements to chat (reframed; low priority)
10. **1.100-19** Create and launch tasks in agent mode (workspace-creation follow-up)
11. **1.100-29** Generate alt text in HTML/Markdown (AI code action, vision)
12. **1.100-30** Drag and drop cell outputs to chat
13. **1.100-31** Notebook tools for agent mode — run cell, kernel state, list/install packages
14. **1.100-38** MCP Tool Annotations — human-readable names + `readOnlyHint` auto-approve
15. **1.101-1** Chat tool sets — grouped tool collections, `#toolset` reference
16. **1.101-2** MCP support for prompts — `/mcp.server.prompt` slash commands
17. **1.101-3** MCP support for resources — `resources/list`, `resources/read`, context attach
18. **1.101-4** MCP support for sampling — server requests model generation
19. **1.101-5** MCP development mode — `dev.watch` + `dev.debug`
20. **1.101-6** Chat UX improvements — distinct user messages, visible undo, navigable attachments
21. **1.101-7** Apply edits more efficiently — conditional auto-save, aligned keybindings
22. **1.101-8** Custom chat modes — `*.chatprompt.md` files with front matter
23. **1.101-9** Task diagnostic awareness — auto-collect problem-matcher diagnostics
24. **1.101-10** Terminal cwd context — agent aware of terminal working directory
25. **1.101-11** Fetch tool confirmation — prompt-injection warning
26. **1.101-12** Customize more built-in tools — per-tool enable/disable picker
27. **1.101-13** Send elements to chat — Live Preview (low priority)
28. **1.101-14** Follow mode for agent cell execution — auto-scroll to running cell
29. **1.101-15** Notebook tools — configure kernel, summary, cell preview
30. **1.102-1** Chat mode improvements — model per mode, editing support, gear menu, link import
31. **1.102-2** Generate custom instructions — `Chat: Generate Instructions` command
32. **1.102-3** Load instruction files on demand — manifest in system prompt
33. **1.102-4** Edit previous requests — click to modify, truncate, resend
34. **1.102-5** Terminal auto approval — allow/deny lists, sub-command decomposition
35. **1.102-6** Terminal command simplification — strip redundant `cd`
36. **1.102-7** Agent awareness of tasks and terminals — `get_task_output` tool
37. **1.102-8** Agent mode badge indicator — OS notification on confirmation
38. **1.102-9** Start chat from the command line — `code chat` subcommand
39. **1.102-10** Fetch tool supports non-HTTP URLs — `file://` scheme
40. **1.102-11** Reading chat requests — debug tree view + export
41. **1.102-12** Edit Tool Improvements — model-specific reliability
42. **1.102-13** MCP support for elicitations — server requests user input
43. **1.103-1** Chat checkpoints — restore conversation + file state
44. **1.103-2** Tool picker improvements — Quick Tree component
45. **1.103-3** Tool grouping — auto-group when >128 tools
46. **1.103-4** Terminal auto-approve improvements — merged setting, regex flags
47. **1.103-5** Input request detection — detect terminal prompts, respond in chat
48. **1.103-6** Improved error detection — problem-matcher diagnostics in dropdown
49. **1.103-7** Compound task support — run tasks with dependencies
50. **1.103-8** Track progress with task lists — `todo_list` tool + chat panel
51. **1.103-9** Improved terminal tool reliability — process management fixes
52. **1.103-10** Output polling — wait for background commands, prompt at 20s
53. **1.103-11** Task awareness — track completed/failed tasks
54. **1.103-12** Agent awareness of user-created terminals — `list_terminals` tool
55. **1.103-13** Improved test runner tool — inline progress in chat
56. **1.103-14** Edit previous requests (GA) — inline edit default
57. **1.103-15** Pending chat confirmation — exit guard dialog
58. **1.103-16** OS notification on user action — native toast
59. **1.103-17** Math support in chat — KaTeX rendering
60. **1.103-18** MCP server autostart and trust — autostart setting + trust dialog
61. **1.103-19** MCP resource_link and structured output — spec 2025-06-18
62. **1.103-20** Notebook inline chat with agent tools
63. **1.104-1** Confirm edits to sensitive files — file pattern gate
64. **1.104-2** Support for AGENTS.md files — auto-attach root AGENTS.md
65. **1.104-3** Improved changed files experience — collapsed, counts, auto-accept
66. **1.104-4** Use custom chat modes in prompt files
67. **1.104-5** Configure prompt file suggestions — when-clause recommendations
68. **1.104-6** Select tools in tool sets — per-tool checkboxes
69. **1.104-7** Configure font used in chat — `chat.fontFamily` / `chat.fontSize`
70. **1.104-8** Terminal auto approve (GA) — opt-in dropdown, rule links, curl warning
71. **1.104-9** Global auto approve — scary warning + setting rename
72. **1.104-10** Math rendering enabled by default
73. **1.104-11** Improved task support (GA) — input/error/compound
74. **1.104-12** Improved terminal support — shell integration timeout
75. **1.104-13** Todo List tool (GA) — enabled by default
76. **1.104-14** Skip tool calls — "Skip" button on approval
77. **1.104-15** Hide and disable AI features — `chat.disableAIFeatures`
78. **1.104-16** MCP support for server instructions — `instructions` in system prompt
79. **1.104-17** Enable MCP — `chat.mcp.access` setting
80. **1.105-1** Plan agent — read-only planning mode + handoff
81. **1.105-2** Handoffs — front-matter guided mode transitions
82. **1.105-3** Isolated subagents — `run_subagent` tool
83. **1.105-4** Fully qualified tool names — `server/toolname` format
84. **1.105-5** Improved edit tools for custom models — per-model tool lists
85. **1.105-6** Nested AGENTS.md files — subfolder-specific instructions
86. **1.105-7** OS notifications for chat responses — response-complete toast
87. **1.105-8** Chain of thought — thinking tokens as expandable sections
88. **1.105-9** Show recent chat sessions — history in empty state
89. **1.105-10** Keep or undo changes during an agent loop
90. **1.105-11** Keyboard shortcuts for navigating chat messages
91. **1.105-12** Chat terminal profiles — per-platform shell config
92. **1.105-13** Auto-reply to terminal prompts — auto-select default option
93. **1.105-14** Terminal free-form input detection — text input in chat
94. **1.105-15** Autostart MCP servers (GA) — auto-start on message
95. **1.105-16** Improved MCP resource representation — content preview
96. **1.105-17** MCP spec updates — icons (SEP-973), elicitation defaults (SEP-1034)
97. **1.106-1** Plan agent (GA) — clarifying questions, custom plan agent
98. **1.106-2** Chat modes renamed to custom agents — `.github/agents/*.agent.md`
99. **1.106-3** Custom agent metadata — `target`, `name`, `argument-hint`, `handoffs`
100. **1.106-4** Embeddings-based tool selection — relevance filtering
101. **1.106-5** Tool approvals and trust — post-approval, trust-all, status moved
102. **1.106-6** Terminal auto approve parser — bash/PowerShell grammar
103. **1.106-7** File write/redirection detection — block auto-approve on writes
104. **1.106-8** Disable default auto approve rules — `ignoreDefaultAutoApproveRules`
105. **1.106-9** Shell specific prompts and command rewriting
106. **1.106-10** Attach terminal commands to chat — context menu action
107. **1.106-11** View terminal output inside chat — `outputLocation` setting
108. **1.106-12** Discover hidden chat terminals — quick pick
109. **1.106-13** Save conversation as prompt — `/savePrompt` command
110. **1.106-14** Edit welcome prompts — right-click "Edit Prompt File"
111. **1.106-15** Automatically open edited files (opt-in)
112. **1.106-16** Reasoning (expanded) — three styles, `collapsedTools`
113. **1.106-17** Inline chat v2 (Preview) — single-file code edits only
114. **1.106-18** Chat view UX improvements — dropdown, toolbar, copy math
115. **1.106-19** Install MCP servers to workspace — `.vscode/mcp.json` scope
116. **1.107-1** Integrating agent sessions and chat — sessions list in chat view
117. **1.107-2** Local agent sessions remain active when closed
118. **1.107-3** Use custom agents with background agents
119. **1.107-4** Agent tooling reorganization — renamed tool references + code action
120. **1.107-5** Run agents as subagents — custom agents as subagents
121. **1.107-6** Reuse Claude skills — `SKILL.md` discovery
122. **1.107-7** Inline chat UX (GA) — upgrade to Chat view
123. **1.107-8** Language Models editor — manage models, visibility, search
124. **1.107-9** URL and domain auto approval — two-step fetch approval
125. **1.107-10** More robust fetch tool — dynamic/JS-rendered content
126. **1.107-11** Text Search tool can search ignored files
127. **1.107-12** Rich terminal output in chat — xterm.js rendering
128. **1.107-13** Command status details — start time, duration, exit code
129. **1.107-14** Allow all terminal commands in this session
130. **1.107-15** Keyboard shortcuts for chat terminal actions
131. **1.107-16** Keyboard shortcuts for custom agents — per-agent commands
132. **1.107-17** Chat view appearance — title control, welcome hide, session restore
133. **1.107-18** Diffs for edits to sensitive files
134. **1.107-19** Collapsible reasoning and tools output — AI-generated titles
135. **1.107-20** MCP spec 2025-11-25 — URL elicitation, tasks, enum choices

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
- [x] **Next session:** study VS Code **1.99** (March 2025) GitHub Copilot section and append.
- [x] Study VS Code **1.100** (April 2025) GitHub Copilot section and append (2026-10-23).
- [x] Study VS Code **1.101** (May 2025) GitHub Copilot section and append (2026-10-23).
- [x] Study VS Code **1.102** (June 2025) GitHub Copilot section and append (2026-10-23).
- [x] Study VS Code **1.103** (July 2025) GitHub Copilot section and append (2026-10-23).
- [x] Study VS Code **1.104** (August 2025) GitHub Copilot section and append (2026-10-23).
- [x] Study VS Code **1.105** (September 2025) GitHub Copilot section and append (2026-10-23).
- [x] Study VS Code **1.106** (October 2025) GitHub Copilot section and append (2026-10-23).
- [x] Study VS Code **1.107** (November 2025) GitHub Copilot section and append (2026-10-23).

## Notes / decisions

- **Scope:** study only the GitHub Copilot / AI-chat features of each release page; ignore and
  do not record all other VS Code features (editor, terminal, debug, themes, remote, ...).

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
