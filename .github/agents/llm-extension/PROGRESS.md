# LLM Extension — Progress Memory

> **This file is the agent's persistent memory.** The `LLM Extension Developer` agent
> (`.github/agents/llm-extension.agent.md`) MUST read this at session start and update it at
> session end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Build a minimal, optimized, engine-agnostic VS Code extension that chats with any
OpenAI-compatible local engine (ninfer today). Aim: mirror Copilot for VS Code, eventually
managing code. Phase 1 = set provider + runtime parameters + chat.

## Status

- **Current phase:** Phases 1–5 complete; **Phase 6 (harness: targeted file editing) in progress**
- **Next step:** **6.4** — end-to-end verify + record: enable `llm.tools.enabled`, make a small
  edit to a real file, confirm the on-disk change + agentic loop round-trip; update `PROGRESS.md`
  (mark 6.1–6.4 Done, set Next step to 7.1) (see `.github/agents/llm-extension/PLAN.md`)
- **Last updated:** 2026-10-09
- **Last commit:** `32cb07b` — feat(llm): implement edit_file execution in ToolExecutor
- **Build state:** compiles clean (`npm run compile`); smoke test passes (84 assertions)

> **New roadmap — harness (Phase 6+):** the extension is now being turned into an autonomous
> coding-agent harness. The full step-by-step plan lives in
> `.github/agents/llm-extension/PLAN.md` (Phases 6–10: targeted `edit_file`, safe writes &
> review, run & verify, harness UX, git integration). The **Next step** pointer above points
> into that plan; do one step per session and keep this file in sync.

> **Bug fix — webview inline JS template-literal escaping (2026-10-09):**
>
> Symptom: after the Markdown-rendering work, the panel no longer loaded models and Send did
> nothing (the prompt stayed in the input box). Root cause: the inline `<script>` in
> `webview.ts` lives inside a **TypeScript template literal**, so every `\n`, `\d`, `\*`,
> `\x00`, … in the `renderMarkdown` regex literals / string escapes was processed as a JS
> escape and became a literal newline/char in the generated HTML. That produced a hard
> `SyntaxError: Invalid regular expression` that aborted the **entire IIFE** — so neither
> `sendBtn.addEventListener('click', doSend)` nor the final `vscode.postMessage({type:'ready'})`
> ever ran (→ no model load, prompt never cleared).
>
> Fix: doubled every backslash in the `renderMarkdown` regex literals and string escapes so the
> template literal emits the intended single backslashes into the generated HTML. Also fixed a
> latent second bug in the same function: the `fenceRe` string literal
> `'(\\w*)\\n([\\s\\S]*?)'` was being string-parsed by `new RegExp()` (collapsing `\w`→`w`,
> `\s`→`s`, `\S`→`S`), so fenced code blocks never matched — now `'\\\\w*\\\\n([\\\\s\\\\S]*?)'`
> so the generated HTML carries the correct `\\w`/`\\n`/`\\s`/`\\S`.
>
> Verified: `node --check` on the generated inline script passes; a functional `renderMarkdown`
> test (bold/italic/ul/ol/fenced-code/blockquote/link/inline-code) passes; full smoke test green.

> **Rename conversation:**
>
> - `config.ts`: `ConversationStore.rename(id, title)` — finds the conversation by id,
>   updates its title, persists. No-op (resolved promise) when the id is not found.
> - `ChatViewProvider`: new `renameConversation(id, title)` — trims the title, no-op when
>   empty, calls `conversationStore.rename` then `pushHistory()` to refresh the dropdown.
>   New `renameConversation` message handler.
> - `webview.ts`: new `#conv-rename` button in the toolbar (before Delete). Shown only when
>   a conversation is selected (toggled on both `change` and `restore`). Clicking prompts
>   `prompt('Rename conversation:', currentTitle)` and posts `{type:'renameConversation',
id, title}`. Cancel/empty is a no-op.

> **Regenerate last response:**
>
> - `ChatViewProvider`: extracted the request-build + streaming agentic loop out of
>   `handleSend` into `runStream(settings, toolbar, skipUser)`. `handleSend` pushes the user
>   message then calls `runStream(..., false)`. New `handleRegenerate()` finds the last user
>   message, truncates history to it (dropping the prior assistant/tool turns), and calls
>   `runStream(..., true)`. `stream_start` now carries a `skipUser` flag. New `regenerate`
>   message handler.
> - `webview.ts`: new `#retry` button in the input row (between Send and Stop). Visible only
>   when not streaming AND an assistant message exists (checked in `setStreaming`). Clicking
>   posts `{type:'regenerate'}`. On `stream_start` with `skipUser`, `removeLastAssistant()`
>   drops the previous assistant reply from the DOM before streaming the fresh one. `restore`
>   and `clear` call `setStreaming(false)` to refresh Retry visibility.

> **Export to Markdown:**
>
> - `ChatViewProvider`: new `export` message handler → `exportConversation()`. Guards on
>   empty history (info message). `buildMarkdown()` renders the history as a doc: `# title`,
>   an `_Exported <ISO timestamp>_` line, then `## You` / `## Assistant` sections (assistant
>   thinking wrapped in a `<details>` block). Tool/system turns are omitted for readability.
>   Filename is derived from the title (slugified); the user picks the location via
>   `showSaveDialog` (`.md` filter) and it is written with `workspace.fs.writeFile`. Success /
>   failure surface as info / error toasts.
> - `webview.ts`: new `#export` button in the toolbar (between Delete and New Chat). Clicking
>   posts `{type:'export'}` (disabled while streaming). Styled like the other toolbar buttons.

> **Delete conversation:**
>
> - `ChatViewProvider`: new `deleteConversation(id)` — calls `conversationStore.remove(id)`;
>   if the deleted id is the active one, resets to a fresh empty conversation and posts
>   `clear`; then `pushHistory()` refreshes the webview's dropdown. New `deleteConversation`
>   message handler.
> - `webview.ts`: new `#conv-delete` button next to the History dropdown (hidden unless a
>   conversation is selected — toggled on both `change` and `restore`). Clicking prompts a
>   `confirm()` and posts `{type:'deleteConversation', id}`. Styled muted, turns red on hover.

> **Copy button (webview, no deps):**
>
> - `webview.ts`: assistant message role row is now a flex row with a right-aligned
>   `.copy-btn` (hidden until the message is hovered). Clicking copies the message's
>   `textContent` (raw, not HTML) via `navigator.clipboard.writeText`, with a
>   `document.execCommand('copy')` textarea fallback for restricted contexts. On success
>   the button flashes "Copied" (green) for 1.2s.
> - CSS: `.message.assistant .role` becomes `display:flex; justify-content:space-between`;
>   `.copy-btn` is muted, fades in on hover, and turns green (`.copied`) on success.

> **Token/usage display:**
>
> - `ChatViewProvider`: `streamOneTurn` now captures `chunk.usage` (already parsed by
>   `client.chatStream`) and returns it. `handleSend` accumulates usage across the
>   (possibly multi-turn) agentic loop via `accumulateUsage(total, turn)` and attaches the
>   total to the `stream_end` message (both the normal and aborted paths).
> - `webview.ts`: each assistant message gets a hidden `.usage-badge` element. On
>   `stream_end`, if `msg.usage` is present the badge shows `⚡ N in · M out · T total`
>   (only the fields the engine reported). Badge is muted, 10px, below the content.
> - No new deps; usage comes from the engine's `stream_options.include_usage` (default on).

> **Markdown rendering (webview, no deps):**
>
> - `webview.ts`: new `renderMarkdown(src)` — a lightweight inline renderer. Extracts
>   fenced code blocks first (placeholder `\x00CODEBLOCKn\x00`), escapes HTML, then applies
>   inline code, bold, italic, links, headings (h1–h4), blockquotes, ordered/unordered
>   lists, and paragraph wrapping. Code-block backticks are built via
>   `String.fromCharCode(96)` so the regex never collides with the template literal.
> - Assistant content now accumulates raw text in `currentAssistant.rawContent` and is
>   re-rendered to HTML on every `delta` (and on `restore` for saved messages). User
>   messages stay plain text.
> - CSS: `.message.assistant .content` switches to `white-space: normal` with styles for
>   `pre`/`code`/headings/lists/links/blockquotes, themed via VS Code CSS variables.
> - Verified: fence + inline-code regexes tested in isolation (correct lang/code capture).

> **Stop generation (AbortController):**
>
> - `ChatViewProvider`: new `abortController` field (null when idle). `handleSend` creates
>   one per request and passes its `signal` into `streamOneTurn` → `client.chatStream(body,
signal)`. The agentic loop checks `signal.aborted` between turns. On abort the catch
>   block detects `signal.aborted` and posts `stream_end` (not an error); `finally` clears
>   the controller. New `stop` message handler calls `abortController?.abort()`.
> - `webview.ts`: new `#stop` button in the input row (hidden by default). `setStreaming`
>   toggles its visibility alongside the Send button's disabled state. Clicking posts
>   `{type:'stop'}` to the host.
> - Net effect: the user can cancel a streaming response mid-flight; the partial answer is
>   kept in history and the conversation is saved.

> **Multiple conversations (Memento):**
>
> - `config.ts`: `HistoryStore` (single `llm.history`) replaced by `ConversationStore`
>   (key `llm.conversations`, array of `{id, title, messages}`). API: `getAll` / `setAll` /
>   `upsert` (replace by id, else prepend newest-first) / `remove` / `clear`.
> - `ChatViewProvider`: tracks `currentConvId`; restores the most recent conversation on
>   construct; `saveCurrentConversation()` upserts after each turn (success + error paths);
>   `startNewConversation()` (New Chat) saves the current one then starts fresh;
>   `switchConversation(id)` saves current, loads the target. `pushHistory()` now also sends
>   the conversation list + active id so the webview can build its dropdown.
> - `webview.ts`: new `#conv-select` dropdown in the toolbar (right-aligned, before New Chat).
>   Populated from the `restore` message; selecting an id posts `{type:'switchConversation'}`.
>   Disabled while streaming.
> - Net effect: every chat is saved and retrievable via the History dropdown; New Chat
>   archives the current conversation instead of destroying it.

> **Chat history persistence (Memento):**
>
> - `config.ts`: new `HistoryStore` (Memento-backed, key `llm.history`) — `get()` / `set()` / `clear()`.
> - `ChatViewProvider`: loads history from Memento in the constructor; saves after each
>   completed turn (success AND error paths, so the user's message is never lost); clears
>   the store in `clear()`; pushes a `{type:'restore', messages}` message on `ready`.
> - `webview.ts`: handles `restore` by re-rendering saved `user`/`assistant` messages
>   (incl. collapsed thinking blocks) into the message list.
> - Net effect: the conversation survives a VS Code restart; "New Chat" wipes both the
>   panel and the persisted store.

> **RESOLVED (dev-container) — empty Model dropdown + no-send:**
> **Symptom:** Model dropdown empty; sending a prompt did nothing.
> **Root cause (confirmed in VS Code source):** the current VS Code webview preload
> (`src/vs/workbench/contrib/webview/browser/pre/index.html`, `getVsCodeApiScript`) defines
> `acquireVsCodeApi()` to return **exactly** `Object.freeze({ postMessage, setState, getState })`
> — NO `onDidReceiveMessage`. Host→webview messages are delivered as a **native DOM `message`
> event on `window`** (`contentWindow.postMessage(data.message, window.origin, …)`), NOT via
> `acquireVsCodeApi().onDidReceiveMessage`. So webview→host (`postMessage`) worked (host got
> `ready`/`send`/`toolbar`), but host→webview (`models`/`stream_start`/`delta`) arrived as
> `window` `message` events the webview never listened for → dropped.
> **Fix (webview.ts):** host→webview handler extracted into `handleHostMessage(msg)`; registered
> via `vscode.onDidReceiveMessage` when present (standard builds), ELSE via
> `window.addEventListener('message', e => handleHostMessage(e.data))` (this VS Code build).
> `handleHostMessage` guards on `msg && msg.type` so unrelated `message` events are ignored.
> Works on standard AND this VS Code build.
> **Verified by user:** diag showed `ready posted → recv: hello → recv: toolbar → recv: models →
models: 1 model(s)`; dropdown populated and send streamed.
> **Cleanup done:** removed all debug scaffolding (webview `diag` line + `window.onerror` +
> keys/origin dumps + `WEBVIEW_VERSION` badge; host `console.log` in ChatViewProvider/extension).
> The `window` `message` fallback (the actual fix) is retained.

> **How to use this file (agent):** each session does ONLY the step named in **Next step**,
> commits it, marks it Done, and sets **Next step** to the following step. One step per session.

## Architecture (agreed)

- **Endpoint:** `POST /v1/chat/completions` (SSE). `GET /health`, `GET /v1/models`.
- **Engine-agnostic.** Optional `llm.apiKey` → `Authorization: Bearer …` only when set.
- **Runtime toolbar (chat panel):** `Model` · `Thinking` · `Context`.
  - Model: dropdown from `/v1/models` + "manual…" entry.
  - Thinking: `off · low · medium · high · max` → `reasoning_effort` (`none/low/medium/high/xhigh`); `off` drops `enable_thinking`.
  - Context: `auto · 32k · 64k · 128k · 240k` → client-side budget (estimate `chars/3.5`, trim oldest history, show indicator).
- **Reasoning display:** `reasoning_content` → collapsed "thinking" block; `content` → answer.
- **Request builder:** `request.ts` merges `settings ← toolbar overrides`.
- **Zero runtime deps:** Node 18+ `fetch` + hand-rolled SSE parser. Lazy activation. One webview.

### Target file layout

```
src/
  extension.ts            # activate(): view provider, commands, status bar, health poll
  config.ts               # settings access + toolbar override state (Memento)
  client.ts               # LlmClient: health(), listModels(), chatStream()
  request.ts              # buildRequestBody(cfg, messages) + token estimator + history trim
  chat/
    ChatViewProvider.ts   # WebviewViewProvider (chat panel + toolbar)
    webview.ts            # buildWebviewHtml() — inline HTML/CSS/JS
```

### Settings (`llm.*`)

| Setting                                        | Default                             | Maps to                          |
| ---------------------------------------------- | ----------------------------------- | -------------------------------- |
| `llm.baseUrl`                                  | `http://localhost:8080`             | provider endpoint                |
| `llm.apiKey`                                   | _(empty)_                           | optional `Authorization: Bearer` |
| `llm.model`                                    | _(empty = first from `/v1/models`)_ | `model` fallback                 |
| `llm.systemPrompt`                             | _(empty)_                           | injected `system` message        |
| `llm.temperature`                              | `1.0`                               | `temperature`                    |
| `llm.topP` / `llm.topK` / `llm.minP`           | `1.0` / `20` / `0.0`                | sampling                         |
| `llm.presencePenalty` / `llm.frequencyPenalty` | `0`                                 | sampling                         |
| `llm.seed`                                     | _(empty = random)_                  | `seed`                           |
| `llm.stop`                                     | `[]`                                | `stop` (max 4)                   |
| `llm.maxCompletionTokens`                      | `4096`                              | `max_completion_tokens`          |
| `llm.preserveThinking`                         | `false`                             | `preserve_thinking`              |
| `llm.stream`                                   | `true`                              | `stream`                         |
| `llm.includeUsage`                             | `true`                              | `stream_options.include_usage`   |
| `llm.responseFormat`                           | `text`                              | `response_format`                |
| `llm.chatTemplateKwargs`                       | `{}`                                | `chat_template_kwargs`           |
| `llm.tools.enabled`                            | `false`                             | gates tool-calling phase         |

### `package.json` contributions

- `configuration`: all `llm.*` settings.
- `commands`: `llm.openChat`, `llm.testConnection`, `llm.refreshModels`, `llm.clearChat`.
- `viewsContainers.activitybar` + `views.activitybar.llm`: the `llm.chat` view.
- `activationEvents`: `onView:llm.chat`, `onCommand:llm.testConnection` (lazy).

## Roadmap

| Phase | Capability                                      | Status   |
| ----- | ----------------------------------------------- | -------- |
| 1     | Provider + parameters + chat                    | complete |
| 2     | Context-aware chat (file/selection/diagnostics) | complete |
| 3     | Inline completion (ghost text)                  | complete |
| 4     | Manage code via tools (agentic loop)            | complete |
| 5     | Code actions / refactors                        | complete |

## Done

- **S1 — `package.json` manifest** (2026-10-09): added all 19 `llm.*` settings, the 4 commands
  (`llm.openChat`, `llm.testConnection`, `llm.refreshModels`, `llm.clearChat`), the activity bar
  container `llm` + webview `llm.chat`, and lazy `activationEvents` (`onView:llm.chat`,
  `onCommand:llm.testConnection`). Added `media/llm.svg` activity bar icon. Replaced the sample
  `extension.helloWorld` command. `npm run compile` passes; manifest validated as well-formed JSON.
- **S2 — `src/config.ts`** (2026-10-09): `readSettings()` returns a typed `LlmSettings` for all 19
  `llm.*` settings (defaults mirror the manifest). `ToolbarStateStore` (Memento-backed) persists the
  Model/Thinking/Context overrides with typed getters/setters (`get`, `setModel`, `setThinking`,
  `setContext`, `reset`). Exported `ThinkingLevel`/`ContextLevel` types, `THINKING_TO_EFFORT`
  (`off→none … max→xhigh`), `CONTEXT_TO_TOKENS` (`auto→0 … 240k→240000`), and ordered preset lists.
  `npm run compile` passes; no runtime npm deps (only the host-provided `vscode` type import).
- **S3 — `src/request.ts` (+ `src/presets.ts`)** (2026-10-09): `buildRequestBody(cfg, messages)`
  merges `settings ← toolbar overrides` into a typed `ChatCompletionRequest` (model override wins,
  thinking→`reasoning_effort` + `enable_thinking` when on, context→budget, conditional
  `seed`/`stop`/`stream_options`/`response_format`/`chat_template_kwargs`). `estimateTokens`
  (`chars/3.5`), `estimateMessageTokens`, `estimateMessagesTokens`, and `trimHistory` (keeps leading
  system + latest turn, drops oldest first; `auto`/0 disables). **Split the pure presets/types into
  `src/presets.ts`** (no `vscode`) so `request.ts` stays a pure module; `config.ts` now re-exports
  them (S2 API preserved). Verified under plain Node: build, estimator, and trim edge cases all pass.
  `npm run compile` passes; `request.js` loads with no `vscode` dependency.
- **S4 — `src/client.ts` (part 1)** (2026-10-09): `LlmClient` takes a `SettingsProvider` (fresh
  `baseUrl`/`apiKey` per call). `health()` → `GET /health` resolves a typed `HealthResult` on every
  outcome (network failures resolve `ok:false` + `error`, never throw — safe for the status-bar poll).
  `listModels()` → `GET /v1/models` resolves a typed `ModelListResult` or throws on non-2xx. Adds
  `Authorization: Bearer …` only when `apiKey` is set. Uses Node 18+ global `fetch` (typed by
  `@types/node` 20 `web-globals/fetch.d.ts`); no runtime deps, no `vscode` import. Verified under
  plain Node with a stubbed `fetch`: health, models, no-key (no header), and failure paths all pass.
- **S5 — `src/client.ts` (part 2)** (2026-10-09): `chatStream(body, signal?)` — an `AsyncGenerator<StreamChunk>`
  that POSTs `/v1/chat/completions` with `stream: true` and hand-rolls the SSE parse. Reads the
  `ReadableStream` via `getReader()`, buffers bytes, splits on `\r?\n`, and parses each `data:` line
  (ignores comments/blank). Yields `{reasoning, content, done, usage}`: `reasoning_content` →
  `reasoning`, `content` → `content`, `[DONE]` → terminal `done:true` (a synthetic terminal chunk is
  emitted if the stream ends without it), and `usage` is surfaced on the final chunk. Throws on
  non-2xx / missing body. Added `StreamChunk` + `UsageInfo` types. Verified under plain Node with a
  stubbed streaming `fetch`: a line split across chunk boundaries reassembles correctly, reasoning vs
  content are separated, exactly one `done` chunk, `usage` surfaced, `stream:true` sent.
- **S6 — `src/chat/webview.ts`** (2026-10-09): `buildWebviewHtml(init?)` returns a single self-contained
  HTML document (inline CSS + JS, no external assets). Static shell: Model/Thinking/Context toolbar
  (dropdowns built from `THINKING_LEVELS`/`CONTEXT_LEVELS` + model list + `manual…` entry), message
  list, input box (Enter to send / Shift+Enter newline), collapsible `<details>` thinking block, and a
  hidden context-trimmed indicator. Exposes DOM/host hooks for later steps: `addUserMessage`,
  `addAssistantMessage` (returns content/thinking/thinkingBlock refs), `setContextTrimmed`,
  `setStreaming`, `getToolbar`/`setToolbar`, and posts `{type:'ready'}` on load. Uses VS Code theme
  CSS variables with fallbacks. Verified under plain Node: returns a string, all elements present,
  model options injected, no external assets.
- **S7 — `src/chat/ChatViewProvider.ts`** (2026-10-09): `ChatViewProvider` implements
  `vscode.WebviewViewProvider` (viewType `llm.chat`). `resolveWebviewView` stores the webview ref,
  sets `enableScripts`/`enableForms`, sets `html = buildWebviewHtml()`, and wires
  `onDidReceiveMessage`. Round-trip: webview posts `{type:'ready'}` on load (S6) → host replies
  `{type:'hello', message:'LLM chat panel ready'}` via `postMessage` (a stable seam for S9–S11 to
  push streaming deltas / toolbar updates). Exported `WebviewToHostMessage` / `HostToWebviewMessage`
  types. `npm run compile` passes; compiled output verified to contain the round-trip logic.
- **S8 — `src/extension.ts`** (2026-10-09): `activate()` registers the `ChatViewProvider` (view id
  `llm.chat`), the 4 commands (`llm.openChat` → `workbench.view.llm`, `llm.testConnection` →
  `client.health()` + info/error toast, `llm.refreshModels` → `client.listModels()` + push
  `{type:'models'}` to the webview, `llm.clearChat` → push `{type:'clear'}`), a status bar item
  (`$(check) LLM` / `$(error) LLM` + error background) driven by a 5s `GET /health` poll (timer
  disposed on deactivate). Made `ChatViewProvider.postMessage` public so the extension can push
  messages. Added a host→webview `onDidReceiveMessage` handler in `webview.ts` for `models`
  (rebuilds the model dropdown, preserving selection + manual entry) and `clear` (empties the
  message list + hides the context indicator). `npm run compile` passes; compiled output verified.
- **S9 — wire chat send** (2026-10-09): webview `doSend()` posts `{type:'send', text}` → host
  `ChatViewProvider.handleSend()` reads settings, prepends the system prompt, calls
  `buildRequestBody`, then `client.chatStream(body)`, streaming deltas back as `{type:'delta',
reasoning, content}` and `{type:'stream_start'}`/`{type:'stream_end'}`/`{type:'error'}`. The webview
  renders the user message, an assistant message (content + thinking block), and appends deltas
  live; errors render as a styled error message. History is kept in `ChatViewProvider.history`
  (assistant turns include `reasoning_content` when present). `clear()` resets history + webview.
  `extension.ts` now passes the `LlmClient` to the provider and `llm.clearChat` calls
  `provider.clear()`. S9 uses a default toolbar state; S10 feeds the live toolbar overrides.
  `npm run compile` passes; compiled output verified across all three files.
- **S10 — wire toolbar** (2026-10-09): webview dropdowns (Model/Thinking/Context) post
  `{type:'toolbar', model, thinking, context}` on change → host `applyToolbarMessage` persists to
  `ToolbarStateStore` (Memento-backed, survives reloads). On `ready`, the host pushes the persisted
  state back via `{type:'toolbar'}` so the dropdowns reflect the last-used values. `handleSend` now
  reads `toolbarStore.get()` (was a hardcoded default) and passes it to `buildRequestBody`, so
  changing a dropdown changes the next request body: model override → `model`, thinking →
  `reasoning_effort` + `enable_thinking`, context → token budget. `setToolbar` in the webview now
  handles the `__manual__` model case. Verified under plain Node: three toolbar states produce
  three distinct request bodies (model/effort/enable_thinking/budget all change correctly).
- **S11 — thinking + context UI** (2026-10-09): the assistant message's `<details>` thinking block
  now starts `hidden` (no empty blocks when thinking is `off`). `revealThinking` reveals + opens it
  the first time `reasoning_content` streams in (so the user sees the thinking happen); `collapseThinking`
  collapses it at rest on `stream_end`/`error` (collapsed by default, click to expand). The
  context-trimmed indicator is shown via `setContextTrimmed(!!msg.trimmed)` on `stream_start` (the
  `trimmed` flag comes from `buildRequestBody`'s history-trim) and hidden on `clear`. Verified in the
  compiled output: thinking block starts hidden, reveal/collapse wired to delta/stream_end/error,
  context indicator toggled on stream_start/clear.
- **S12 — smoke test** (2026-10-09): added `scripts/smoke-test.js`, a mock OpenAI-compatible HTTP
  server (port 18099) that exercises the REAL compiled `out/client.js` + `out/request.js` end-to-end.
  15 assertions, all passing: `health()` 200; `listModels()` returns 2 models; `buildRequestBody`
  sets model / `reasoning_effort` / `enable_thinking` / `stream` / context budget correctly;
  `chatStream` reassembles `reasoning_content` + `content` from SSE, emits one `done` chunk, surfaces
  `usage` (total_tokens=30), and handles the `[DONE]` sentinel; the engine receives `stream:true` +
  `reasoning_effort:high`. Docker/ninfer engine are unavailable in this environment, so the mock
  server stands in for the live engine — the only untested part is live VS Code webview rendering
  (needs the extension host). Phase 1 marked complete.
- **S13 — `src/context.ts`** (2026-10-09): new pure module (no imports at all). Types
  `ContextDiagnostic`, `ContextFile`, `ContextSelection`, `ContextInput` and
  `buildContextBlock(input): string` that formats gathered editor context into a readable text
  block in a stable order (file → selection → diagnostics), returning `""` when nothing is
  provided. File section shows `File: <path> (<language>)` (language optional) with a fenced code
  block; selection shows a `line L, col C-C` (single line) or `lines L:C–L:C` (multi-line) range
  with the selected text; diagnostics list as `- [severity] line:col — message`. Verified under
  plain Node: empty input → `""`, file with/without language, single/multi-line selection,
  diagnostics, and stable section ordering all pass.
- **S14 — gather + inject context** (2026-10-09): `ChatViewProvider` now gathers editor context and
  folds it into the request. New `gatherContext(): ContextInput` reads the active text editor —
  file (workspace-relative path via `asRelativePath`, `languageId`, full `getText()` contents),
  selection (1-based range + `doc.getText(sel)`, only when non-empty), and diagnostics
  (`vscode.languages.getDiagnostics`, mapped to `line:col — message` with a severity label via
  `severityLabel`). `composeSystemPrompt(systemPrompt, contextBlock)` joins the configured system
  prompt and the context block (either may be empty; empty only when both are). `handleSend` builds
  the block via `buildContextBlock(gatherContext())` and uses the composed prompt for the leading
  `system` message, so with an open file the request body carries the context block. No active
  editor → empty `ContextInput` → empty block → no system message (unchanged behavior). Compiles
  clean.
- **S15 — context settings + toggle** (2026-10-09): added three settings
  `llm.context.includeFile` / `includeSelection` / `includeDiagnostics` (all default `true`) to
  `package.json` (now 22 settings) and read them in `readSettings()` as a `context: ContextFlags`
  field on `LlmSettings`. New pure `ContextFlags` type + `DEFAULT_CONTEXT_FLAGS` in `presets.ts`.
  The runtime override lives in the toolbar: `ToolbarState.contextFlags` (persisted via a new
  `ToolbarStateStore.setContextFlags()`; `get()` backfills defaults for pre-S15 Memento state). The
  chat panel gained three checkboxes (`ctx-file` / `ctx-selection` / `ctx-diagnostics`) in the
  toolbar; `getToolbar`/`setToolbar`/`postToolbar` and the host `toolbar` message now carry
  `contextFlags`. `gatherContext(flags)` gates each section on its flag, and `handleSend` passes
  `toolbar.contextFlags`, so toggling a checkbox changes what is injected on the next request.
  Verified: compiles clean; smoke test still passes; compiled webview + provider contain all the
  flag wiring (checkboxes, gating, persistence).
- **S16 — context smoke test** (2026-10-09): extended `scripts/smoke-test.js` to import the real
  compiled `out/context.js` and assert `buildContextBlock` end-to-end. 11 new assertions (26 total,
  all passing): empty input → `""`; empty sections → `""`; file header with/without language +
  content; single-line (`line 3, col 5-10`) and multi-line (`lines 3:1–7:4`) selection ranges +
  text; diagnostic error/warning lines; and stable section order (file → selection → diagnostics).
  Phase 2 marked complete.
- **S17 — `src/inline.ts`** (2026-10-09): new pure module (no imports at all). Type
  `CompletionContext` (`language`, `path`, `prefix`, `suffix`) and two functions:
  `buildCompletionPrompt(ctx)` formats a focused "complete the code" prompt — a
  `Complete the following <language> code.` header, an instruction to return ONLY the completion
  (no explanation / fences / repeated code), an optional `File: <path>` line, the code before the
  cursor in a fenced block, and (only when non-empty) the code after the cursor as context-only.
  `parseCompletion(text)` trims, strips a surrounding markdown code fence (` ```lang … ``` `)
  if present, and returns the raw completion (empty string for empty/whitespace-only input or a
  bare fence). Verified under plain Node: prompt includes language/path/prefix/suffix and omits the
  File/suffix sections when empty; parseCompletion handles empty, whitespace, plain text, fenced
  (with/without lang), fence-only, and multi-line cases — ALL INLINE TESTS PASSED.
- **S18 — `src/inline/InlineCompletionProvider.ts`** (2026-10-09): new
  `InlineCompletionItemProvider`. `provideInlineCompletionItems` gathers the code around the cursor
  (bounded windows: `PREFIX_WINDOW=2000` before, `SUFFIX_WINDOW=500` after, via `offsetAt`), returns
  `[]` when there is no code before the cursor, builds the prompt via `buildCompletionPrompt`, and
  reuses the chat settings + toolbar (model/context) with `thinking` forced to `'off'` so ghost text
  stays fast (reasoning discarded). It bridges the vscode `CancellationToken` to a fetch
  `AbortController` (disposed in `finally`), streams `client.chatStream`, collects `content` (capped
  at `MAX_COMPLETION_CHARS=2000`), parses via `parseCompletion`, and returns
  `[new vscode.InlineCompletionItem(completion, new Range(position, position))]` — `[]` when the
  result is empty or the engine fails (non-fatal). Compiles clean; compiled output verified to
  contain the gathering, prompt, thinking-off, abort bridging, parse, and item-with-Range logic.
- **S19 — register inline completion** (2026-10-09): added the `llm.inline.enabled` setting
  (boolean, default `false`) to `package.json` (now 23 settings). In `extension.ts`, `activate()`
  reads the setting at activation and, when enabled, constructs an `InlineCompletionProvider` and
  registers it via `vscode.languages.registerInlineCompletionItemProvider([{ pattern: '**' }],
provider)` (all file types). The setting is read once at activation, so toggling it requires a
  reload (noted in the setting description). Ghost text is opt-in and off by default. Compiles
  clean; compiled `extension.js` verified to import the provider, read `llm.inline.enabled`, gate on
  it, and register with the `**` selector.
- **S20 — inline smoke test** (2026-10-09): extended `scripts/smoke-test.js` to import the real
  compiled `out/inline.js` and assert `buildCompletionPrompt` + `parseCompletion` end-to-end. 15 new
  assertions (41 total, all passing): prompt includes language/path/prefix/suffix and the
  "completion only" instruction; omits the File line and suffix section when empty; parseCompletion
  handles empty, whitespace-only, plain passthrough, trim, fenced (with/without lang), fence-only,
  and multi-line cases. Phase 3 marked complete.
- **S21 — `src/tools.ts`** (2026-10-09): new pure module (imports only the `ChatMessage` type from
  `./request`). Types `Tool` (OpenAI function-calling schema), `ToolCall` (`id`, `type`,
  `function.name`, `function.arguments`), `ToolResult` (`tool_call_id`, `content`). `CODE_TOOLS`
  defines 4 workspace tools — `read_file` (required `path`), `write_file` (required `path`,
  `content`), `list_dir` (required `path`), `search_files` (required `pattern`, optional `path`) —
  each with a `type: 'function'` envelope, description, and JSON-schema `parameters`. Also extended
  `ChatMessage` in `request.ts` to support `role: 'tool'` + `tool_call_id` (needed so
  `toolResultMessage` returns a valid `ChatMessage`). `toolResultMessage(call, content)` builds the
  `role: 'tool'` message with the matching `tool_call_id`. Verified under plain Node: 4 tools with
  correct names/required fields, and `toolResultMessage` produces a `role: 'tool'` message with the
  right `tool_call_id` + content — ALL TOOLS TESTS PASSED.
- **S22 — `src/request.ts` (tools)** (2026-10-09): extended the request builder for function
  calling. `ChatMessage` now carries an optional `tool_calls?: ToolCall[]` (on assistant turns that
  request tool calls) in addition to the `role: 'tool'` + `tool_call_id` added in S21. `ChatCompletionRequest`
  gained `tools?: Tool[]` and `tool_choice?: string`. `buildRequestBody` now sets `tools: CODE_TOOLS`
  - `tool_choice: 'auto'` when `settings.toolsEnabled` is true (omitted otherwise). Verified under
    plain Node: `toolsEnabled=false` → no `tools`/`tool_choice` in the body; `toolsEnabled=true` →
    `tools === CODE_TOOLS` (4 tools) + `tool_choice='auto'`; and an assistant turn with `tool_calls`
  - a `role: 'tool'` result round-trips through the body with `tool_call_id` preserved. Existing
    smoke test still passes.
- **S23 — `src/client.ts` (tools)** (2026-10-09): extended the SSE client for function calling.
  New `ToolCallDelta` type (raw partial delta keyed by `index`) and `StreamChunk` gained
  `toolCallDeltas?` (raw per-chunk) + `toolCalls?` (accumulated). New pure exported helper
  `accumulateToolCalls(existing, deltas)` folds deltas into the accumulator by `index` (arguments
  concatenated; id/name/type set when present). `parseSseLine` now extracts `delta.tool_calls` into
  `toolCallDeltas`; `chatStream` keeps a running `toolCalls` accumulator, folds each chunk's deltas
  via `accumulateToolCalls`, and attaches the accumulated calls to every yielded chunk (including the
  synthetic terminal chunk). Verified under plain Node: `accumulateToolCalls` merges by index and
  concatenates split arguments (2 calls, empty-deltas no-op); and a full `chatStream` against a mock
  server reassembles a tool call whose arguments are split across two SSE chunks into one
  `ToolCall` (`id=c1`, `name=read_file`, `arguments={"path":"a.ts"}`) alongside content. Existing
  smoke test still passes.
- **S24 — `src/tools/ToolExecutor.ts`** (2026-10-09): new vscode-specific executor. `execute(call)`
  parses the JSON arguments (invalid JSON → error result, not throw) and dispatches to `read_file`
  (size-capped read), `write_file` (mkdir -p + write), `list_dir` (sorted, dirs suffixed `/`), and
  `search_files` (regex with literal fallback, recursive walk skipping `node_modules`/`.git`/`out`/
  `dist`/`.vscode`, capped at `MAX_SEARCH_MATCHES=50`, results as `relPath:line: text`). All paths go
  through `resolveSafe`, which resolves against the first workspace folder and rejects any path that
  escapes it (`path.relative` starts with `..` or is absolute → `null` → "Path not allowed"). Every
  failure (unknown tool, bad path, I/O error) is returned as a `ToolResult` whose `content` describes
  the failure, so the agentic loop can continue. Compiles clean; compiled output verified to contain
  all 4 tools, the traversal rejection, the no-workspace guard, invalid-JSON handling, and the
  error→result (not throw) behavior.
- **S25 — agentic loop in `ChatViewProvider.handleSend`** (2026-10-09): rewrote the send path to
  run an agentic tool loop. `handleSend` now builds the initial body, then loops: `streamOneTurn`
  streams one assistant turn (posting content/reasoning deltas to the webview as they arrive and
  tracking the accumulated `toolCalls`), pushes the assistant turn (with `reasoning_content` and
  `tool_calls` when present) to history, and — when `settings.toolsEnabled` and the reply has
  `tool_calls` — executes each via `ToolExecutor.execute`, posts a `▸ <tool>…` delta, and appends the
  `toolResultMessage` to history. The request body is rebuilt each iteration from the _current_
  `this.history` (system-prefixed) so the new assistant/tool turns are included, then the loop
  re-sends. Stops when the model stops calling tools or `MAX_TOOL_ITERATIONS = 8` is hit (posts a
  `[stopped after N tool iterations]` note). New helpers: `streamOneTurn(body)` and
  `assistantMessage(content, reasoning, toolCalls)`. `body` is now a `let` (reassigned each
  iteration). Compiles clean; compiled output verified to contain the loop, `toolExecutor` init,
  `toolExecutor.execute`, `toolResultMessage`, the per-iteration rebuild, and the iteration cap.
  Existing smoke test still passes.
- **S26 — tools smoke test** (2026-10-09): extended `scripts/smoke-test.js` with 23 new assertions
  covering the tool pipeline. (a) `CODE_TOOLS` shape: 4 tools in order
  (`read_file,write_file,list_dir,search_files`), all `type=function`, all
  `parameters.type=object`, and the exact `required` arrays per tool. (b) `toolResultMessage`:
  `role=tool`, `tool_call_id` matches `call.id`, `content` passthrough. (c) `accumulateToolCalls`
  (pure): empty→empty, single delta, concatenating split arguments across two deltas, and two
  calls keyed by index. (d) Full `chatStream` tool-call accumulation: the mock server now branches
  on `Array.isArray(parsed.tools)` and streams a single `read_file` tool call whose arguments are
  split across two SSE chunks; the test asserts the request body carries `tools` (4) and
  `tool_choice=auto` when `toolsEnabled`, and that `chatStream` reassembles one `ToolCall`
  (`id=c1`, `name=read_file`, `arguments={"path":"a.ts"}`). Total assertions now 64 (was 41).
  Compiles clean; all 64 assertions pass.
- **S27 — `src/codeaction.ts` (pure prompt builder + parser)** (2026-10-09): new pure module
  (no `vscode` import, no network), mirroring `inline.ts`/`context.ts`. `CodeActionContext
{language, path, code, selection?: {startLine, endLine, text}, diagnostics?:
{line, column, severity, message}[]}`. `buildCodeActionPrompt(ctx)` emits a "Fix or refactor
  the following <language> code." header, a "Return ONLY the full updated code" instruction, the
  `File:` line (when path set), the `Code:` block, and — when present — the `Selected range`
  (single-line `line N` / multi-line `lines N–M`) and `Diagnostics to address` sections, in a
  stable order (code → selection → diagnostics). `parseCodeAction(text)` strips a surrounding
  markdown code fence, trims, and returns `''` for empty/whitespace/fence-only input. Compiles
  clean; verified under plain Node (20 checks: full/minimal/single-line prompts, stable order,
  and all parser cases).
- **S28 — `src/codeaction/CodeActionProvider.ts` (vscode-specific provider)** (2026-10-09):
  new `CodeActionProvider implements vscode.CodeActionProvider` (constructed with `context` +
  `LlmClient`, like `InlineCompletionProvider`). `provideCodeActions(document, range, context)`
  always offers an "Ask LLM to fix/refactor" `CodeAction` (kind `RefactorRewrite`,
  `isPreferred`) and — when diagnostics fall in the range — a "Fix with LLM" action (kind
  `QuickFix`, with the matching `diagnostics`). Because `vscode.CodeAction` has no `range`
  property, the range is carried on a local `RangeCodeAction` interface (`actionRange`) and read
  back in `resolveCodeAction` (same object reference within the host). `resolveCodeAction`
  gathers the file context (language, path, full code, selection = range text, diagnostics in
  range via `getDiagnostics` + `intersection`), builds the prompt via `buildCodeActionPrompt`,
  reuses the chat settings + toolbar (forcing `thinking: 'off'`), streams `client.chatStream`
  (collect content, capped at `MAX_EDIT_CHARS = 20000`), parses via `parseCodeAction`, and
  returns the action with a `WorkspaceEdit` replacing the range. Empty or failed result → the
  action is returned without an edit (no crash). Bridges `CancellationToken` → `AbortController`
  (disposed in `finally`). Compiles clean; compiled output verified to contain the provider,
  both action labels/kinds, `buildCodeActionPrompt`, `chatStream` collect, `parseCodeAction`,
  the `WorkspaceEdit` replace, `actionRange`, `diagnosticsInRange`, and the empty-result guard.
  Existing smoke test still passes.
- **S29 — register code action + `llm.codeAction.enabled` setting** (2026-10-09): added the
  `llm.codeAction.enabled` setting (boolean, default `false`) to `package.json`
  `contributes.configuration` (next to `llm.inline.enabled`). In `activate()`, when enabled, the
  `CodeActionProvider` is registered via
  `vscode.languages.registerCodeActionsProvider([{ pattern: '**' }], provider, {
providedCodeActionKinds: CodeActionProvider.providedKinds })` — mirroring the inline-completion
  registration (opt-in, read at activation, requires a reload to toggle). Compiles clean;
  `package.json` verified valid JSON with the setting present (boolean, default `false`); compiled
  `extension.js` verified to import the provider, read `codeAction.enabled`, gate on it, and call
  `registerCodeActionsProvider` with `providedCodeActionKinds` and the `**` pattern. Existing smoke
  test still passes.
- **S30 — code action smoke test** (2026-10-09): extended `scripts/smoke-test.js` with 20 new
  assertions covering the code-action pipeline. (a) `buildCodeActionPrompt`: full-context prompt
  (header with language, "Return ONLY the full updated code" instruction, `File:` path, code
  block, `Selected range (lines N–M)`, and a diagnostic line) plus the stable section order
  (code → selection → diagnostics); a minimal prompt (no path/selection/diagnostics → no `File:`
  / `Selected range` / `Diagnostics to address` sections); and a single-line selection
  (`Selected range (line N)`). (b) `parseCodeAction`: empty → empty, whitespace → empty, plain
  passthrough, trim, fence strip (with and without lang), fence-only → empty, and multi-line
  preserved. Total assertions now 84 (was 64). Compiles clean; all 84 assertions pass. **Phase 5
  complete.**
- **Bug fix — chat: empty Model dropdown + silent send failure** (2026-10-09): two runtime bugs
  found while the user tested the extension live. (1) The Model dropdown was empty because
  `buildWebviewHtml()` was called with no `init` and models were only pushed by the
  `llm.refreshModels` command (a no-op if the panel wasn't resolved yet). Fix: `ChatViewProvider`
  now auto-loads the model list when the webview posts `ready` — new `loadModels()` calls
  `client.listModels()` and posts `{type:'models'}` (silent on failure, so the manual entry still
  works). (2) Sending a prompt did nothing because the request setup in `handleSend`
  (`gatherContext` → `buildRequestBody`) ran OUTSIDE the `try/catch` (which only wrapped the
  streaming loop); a setup throw became an unhandled rejection before `stream_start` was posted,
  so no user message rendered and no error showed. Fix: the setup is now wrapped in its own
  `try/catch` that posts `{type:'error'}` and returns, so failures surface in the panel. Compiles
  clean; compiled output verified to contain `loadModels`, the `ready` → `loadModels` call, the
  setup `try/catch` posting `error`, and `stream_start` after setup. Existing smoke test still
  passes (84 assertions).
- **6.1 — `edit_file` tool schema** (2026-10-09): added the `edit_file` tool to `CODE_TOOLS` in
  `src/tools.ts` (placed after `write_file`, before `list_dir`). Params: `path` (workspace-relative),
  `old_string` (exact text incl. whitespace/indent), `new_string` (replacement), `replace_all`
  (bool, default `false`); `required: ["path", "old_string", "new_string"]`. The description tells
  the model that `old_string` must match **exactly** and be **unique** in the file unless
  `replace_all` is true, and to include surrounding context to disambiguate. `request.ts` picks it
  up automatically (it already sets `body.tools = CODE_TOOLS`), so no change was needed there.
  Compiles clean; compiled `out/tools.js` verified to contain the `edit_file` schema with all four
  properties and the correct `required` array.
- **6.2 — `edit_file` execution** (2026-10-09): implemented `edit_file` in
  `src/tools/ToolExecutor.ts`. New `editFile(call, relPath, oldString, newString, replaceAll)`
  reuses `resolveSafe` + the `MAX_READ_BYTES` size cap (rejects non-files / oversized files), reads
  the file, and counts non-overlapping occurrences of `old_string` via a new `countOccurrences`
  helper. Behavior: empty `old_string` → error; `0` matches → "old_string not found — re-read the
  file and copy the exact text"; `>1` matches and `!replace_all` → "old_string is not unique (N
  matches) — add more surrounding context, or set replace_all=true"; otherwise replace (first
  occurrence via `String.replace`, or all via `split().join()` when `replace_all`) and write back.
  Returns `Replaced N occurrence(s) in <path> (A chars → B chars)`. Wired into the `execute()`
  switch (`case "edit_file"`). Compiles clean; compiled `out/tools/ToolExecutor.js` verified to
  contain the dispatch, `editFile`, `countOccurrences`, and all four result branches. Core logic
  verified under plain Node (10 checks: unique match, no-match, ambiguous-match, replace_all,
  empty old_string, and `countOccurrences` edge cases — all pass).
- **6.3 — `read_file` line range** (2026-10-09): extended `read_file` with optional
  `start_line` / `end_line` (1-based, inclusive) so the harness can read large files in chunks.
  Schema change in `src/tools.ts`: added `start_line` / `end_line` (both `type: "number"`, optional;
  `required` stays `["path"]`) and updated the description. `ToolExecutor.readFile` now takes
  `startLine?` / `endLine?`; when both are omitted it returns the whole file (unchanged behavior).
  With a range it splits on `\r?\n`, clamps `start` to `≥1` and `end` to `≤ total`, errors when
  `start > end`, and returns `Lines <start>–<end> of <total> in <path>:\n<slice>`. The `execute()`
  switch passes `args.start_line` / `args.end_line` (only when `typeof === "number"`). Compiles
  clean; compiled `out/tools/ToolExecutor.js` + `out/tools.js` verified to contain the dispatch,
  the schema fields, the clamp/error/slice logic, and the `Lines … of …` header. Core slicing
  verified under plain Node (10 checks: no-range passthrough, full/middle/single-line ranges,
  start-only, end-only, end clamped, start-beyond-total error, start>end error, start clamped to 1
  — all pass).

## Steps — Phase 1 (one per session)

Each step is single-file, independently compilable and committable. Do them in order. Mark a
step `[x]` when committed, and move the **Next step** pointer forward.

- [x] **S1 — `package.json` manifest.** Add `llm.*` configuration, commands
      (`llm.openChat`, `llm.testConnection`, `llm.refreshModels`, `llm.clearChat`), the activity bar
      view container + `llm.chat` view, and lazy `activationEvents`.
      _Accept: `npm run compile` passes; manifest is valid (no vsce warnings about unknown keys)._
- [x] **S2 — `src/config.ts`.** Settings access (read all `llm.*`) + toolbar override state
      (Model/Thinking/Context) persisted in `Memento`. Export typed getters/setters.
      _Accept: compiles; no runtime deps._
- [x] **S3 — `src/request.ts`.** `buildRequestBody(cfg, messages)` merging settings ← toolbar
      overrides; token estimator (`chars/3.5`); history-trim for the context budget.
      _Accept: compiles; pure module (no vscode import needed)._
- [x] **S4 — `src/client.ts` (part 1).** `LlmClient` with `health()` and `listModels()`
      (non-streaming `fetch`, optional `Authorization` header).
      _Accept: compiles; both methods return typed results._
- [x] **S5 — `src/client.ts` (part 2).** Add `chatStream()` — POST `/v1/chat/completions`
      with `stream:true`, hand-rolled SSE parser yielding `{reasoning, content, done, usage}`.
      _Accept: compiles; parser handles `data:` lines, `[DONE]`, and `reasoning_content` vs `content`._
- [x] **S6 — `src/chat/webview.ts`.** `buildWebviewHtml()` — static HTML/CSS/JS shell: message
      list, input box, Model/Thinking/Context toolbar, collapsible thinking block. No logic yet.
      _Accept: compiles; returns a string; no external assets._
- [x] **S7 — `src/chat/ChatViewProvider.ts`.** `WebviewViewProvider` that builds the webview and
      round-trips a basic `hello`/`ready` message between webview and host.
      _Accept: compiles; view renders and a message round-trips._
- [x] **S8 — `src/extension.ts`.** `activate()`: register the view provider, the 4 commands, a
      status bar item, and a `/health` poll. Wire `llm.testConnection`.
      _Accept: compiles; extension activates; status bar reflects health._
- [x] **S9 — wire chat send.** Connect webview "send" → `request.ts` → `client.chatStream()` →
      stream deltas back to the webview for rendering.
      _Accept: compiles; a real message streams into the panel._
- [x] **S10 — wire toolbar.** Model/Thinking/Context dropdowns update the override state and
      feed `request.ts` (model list from `/v1/models`, thinking → `reasoning_effort`, context → budget).
      _Accept: compiles; changing a dropdown changes the next request body._
- [x] **S11 — thinking + context UI.** Render `reasoning_content` as a collapsed thinking block;
      show a "context trimmed" indicator when history was trimmed.
      _Accept: compiles; thinking block collapses/expands; indicator appears on trim._
- [x] **S12 — smoke test.** Manual test against the running ninfer engine: health, model list,
      one streamed chat with thinking. Update Status to "Phase 1 complete".
      _Accept: verified end-to-end; PROGRESS.md marked done._

## Steps — Phase 2 (one per session)

Context-aware chat: inject the active file, selection, and diagnostics into the request so the
model can see what the user is looking at. Keep the gathering vscode-specific (in the provider)
and the formatting pure (in `context.ts`) so it stays testable under plain Node.

- [x] **S13 — `src/context.ts`.** Pure module (no vscode). Types `ContextInput`
      (`file?`, `selection?`, `diagnostics?`) + `buildContextBlock(input): string` that formats the
      gathered context into a readable text block (empty string when nothing is provided).
      _Accept: compiles; pure module (no vscode import); verified under plain Node._
- [x] **S14 — gather + inject context.** In `ChatViewProvider`, read the active editor (file path,
      language, selection range + text) and workspace diagnostics, build the context block via
      `buildContextBlock`, and inject it into the request (prepended to the system prompt).
      _Accept: compiles; with an open file the request body carries the context block._
- [x] **S15 — context settings + toggle.** Add `llm.context.includeFile` / `includeSelection` /
      `includeDiagnostics` (default true) and a small "Context" toggle in the chat panel; respect
      the flags when gathering.
      _Accept: compiles; toggling a flag changes what is injected._
- [x] **S16 — context smoke test.** Extend `scripts/smoke-test.js` to assert `buildContextBlock`
      output for file/selection/diagnostics and that an empty input yields an empty string.
      _Accept: compiles; new assertions pass._

## Steps — Phase 3 (one per session)

Inline completion (ghost text) via `registerInlineCompletionItemProvider`. Keep the prompt
building + response parsing pure (in `inline.ts`) so it stays testable under plain Node; the
vscode-specific gathering lives in the provider.

- [x] **S17 — `src/inline.ts`.** Pure module (no vscode). Type `CompletionContext`
      (`language`, `path`, `prefix`, `suffix`) + `buildCompletionPrompt(ctx): string` (a focused
      "complete the code" prompt with the surrounding code) + `parseCompletion(text): string`
      (strip markdown code fences / leading whitespace, return the raw completion; empty when
      nothing usable).
      _Accept: compiles; pure module (no vscode import); verified under plain Node._
- [x] **S18 — `src/inline/InlineCompletionProvider.ts`.** `InlineCompletionItemProvider` whose
      `provideInlineCompletionItems` gathers the prefix (text before the cursor) + suffix (text
      after), builds the prompt via `buildCompletionPrompt`, calls `client.chatStream` and collects
      the content, then returns `[new vscode.InlineCompletionItem(parseCompletion(text), position)]`
      (empty array when there is nothing to complete or the result is empty).
      _Accept: compiles; provider returns a typed `InlineCompletionItem[]`._
- [x] **S19 — register inline completion.** In `extension.ts`, register the provider via
      `registerInlineCompletionItemProvider` gated by a new `llm.inline.enabled` setting (default
      `false`) so ghost text is opt-in.
      _Accept: compiles; with the setting on the provider is registered._
- [x] **S20 — inline smoke test.** Extend `scripts/smoke-test.js` to assert `buildCompletionPrompt`
      (includes language + prefix + suffix) and `parseCompletion` (strips fences, trims, empty for
      empty input).
      _Accept: compiles; new assertions pass._

## Steps — Phase 4 (one per session)

Manage code via tools: the engine's `tools`/`tool_choice` function-calling API drives an agentic
loop. The extension exposes a small set of workspace tools (`read_file`, `write_file`, `list_dir`,
`search_files`); the model calls them, the extension executes them against the workspace, feeds the
results back, and repeats until the model stops calling tools. Keep the tool schemas + message
shaping pure (in `tools.ts`) so they stay testable under plain Node; the vscode-specific execution
lives in `ToolExecutor`.

- [x] **S21 — `src/tools.ts`.** Pure module (no vscode). Types `Tool` (OpenAI function-calling
      schema), `ToolCall` (`id`, `function.name`, `function.arguments`), `ToolResult`
      (`tool_call_id`, `content`). `CODE_TOOLS: Tool[]` — schemas for `read_file`, `write_file`,
      `list_dir`, `search_files`. `toolResultMessage(call, content): ChatMessage` — builds the
      `role: 'tool'` message.
      _Accept: compiles; pure module (no vscode import); verified under plain Node._
- [x] **S22 — `src/request.ts` (tools).** Extend `ChatMessage` to support assistant `tool_calls`
      and `role: 'tool'` + `tool_call_id`; add `tools`/`tool_choice` to `ChatCompletionRequest`;
      wire `settings.toolsEnabled` → `tools: CODE_TOOLS` in `buildRequestBody`.
      _Accept: compiles; with `toolsEnabled` the body carries `tools`._
- [x] **S23 — `src/client.ts` (tools).** Extend `StreamChunk` with `toolCalls?: ToolCall[]`; parse
      `delta.tool_calls` (accumulate by index across chunks) in `parseSseLine`.
      _Accept: compiles; a streamed tool call reassembles into one `ToolCall`._
- [x] **S24 — `src/tools/ToolExecutor.ts`.** vscode-specific `ToolExecutor` with
      `execute(call): Promise<ToolResult>` implementing `read_file` / `write_file` / `list_dir` /
      `search_files` against the workspace (safe path handling, error → result, not throw).
      _Accept: compiles; each tool returns a typed `ToolResult`._
- [x] **S25 — agentic loop.** In `ChatViewProvider.handleSend`, when `settings.toolsEnabled`, run
      the loop: send (with tools) → if the reply has `tool_calls`, execute them via `ToolExecutor`,
      append the assistant turn + tool results, and re-send → until no `tool_calls` or a max
      iteration cap. Stream content deltas to the webview as they arrive.
      _Accept: compiles; a tool-calling reply is executed and fed back._
- [x] **S26 — tools smoke test.** Extend `scripts/smoke-test.js` to assert `CODE_TOOLS` shape,
      `toolResultMessage`, and `parseSseLine` tool-call accumulation (mock SSE with `tool_calls`
      deltas).
      _Accept: compiles; new assertions pass._

## Steps — Phase 5 (one per session)

Phase 5 = Code actions / refactors via `CodeActionProvider`. Mirrors the Phase 3 pattern:
a pure prompt-builder module, a vscode-specific provider, registration + a setting, then a
smoke test. The provider reuses `client.chatStream` (collect content) — no new non-streaming
endpoint is added.

- [x] **S27 — `src/codeaction.ts` (pure prompt builder + parser).** New pure module (no
      `vscode` import, no network). `CodeActionContext {language, path, code,
selection?: {startLine, endLine, text}, diagnostics?: {line, column, severity, message}[]}`.
      `buildCodeActionPrompt(ctx): string` — a "fix/refactor this code" prompt: a header, an
      instruction to return ONLY the full updated code (no explanation, no code fences), the file
      path, the code block, and — when present — the selected range and the diagnostics to
      address (stable order: code → selection → diagnostics). `parseCodeAction(text): string` —
      strips a surrounding markdown code fence, trims, returns `''` for empty. _Accept: compiles;
      pure module loads under plain Node; prompt includes language/path/code/diagnostics; parser
      strips fences._
- [x] **S28 — `src/codeaction/CodeActionProvider.ts` (vscode-specific provider).**
      `CodeActionProvider implements vscode.CodeActionProvider` (constructed with `context` +
      `LlmClient`, like `InlineCompletionProvider`). `provideCodeActions(document, range,
context)` returns an "Ask LLM to fix/refactor" `CodeAction` (kind `refactor.rewrite`,
      `needsResolve: true`) and — when diagnostics fall in the range — a "Fix with LLM" action
      (kind `quickfix`). `resolveCodeAction` gathers the file context (language, path, full code,
      selection = range text, diagnostics in range), builds the prompt via `buildCodeActionPrompt`,
      streams `client.chatStream` (collect content, capped), parses via `parseCodeAction`, and
      returns the action with a `WorkspaceEdit` replacing `range` with the parsed code. Empty or
      failed result → the action is returned without an edit (no crash). _Accept: compiles;
      compiled output contains the provider, prompt build, `chatStream` collect, `parseCodeAction`,
      and the `WorkspaceEdit` replace._
- [x] **S29 — register in `extension.ts` + `llm.codeAction.enabled` setting.** Add
      `llm.codeAction.enabled` (boolean, default `false`) to `package.json`
      `contributes.configuration`. In `activate()`, when enabled, register the provider via
      `vscode.languages.registerCodeActionsProvider([{ pattern: '**' }], provider, {
providedCodeActionKinds: [...] })`. _Accept: compiles; setting present; provider registered
      only when enabled._
- [x] **S30 — code action smoke test.** Extend `scripts/smoke-test.js` to assert
      `buildCodeActionPrompt` (language/path/code/diagnostics/selection present, stable order) and
      `parseCodeAction` (plain passthrough, fence strip, empty). _Accept: compiles; new assertions
      pass._

## Decisions

- 2026-10-09: Talk to the **engine directly** (no proxy). Proxy's preset/effort/context jobs become extension features.
- 2026-10-09: Standardize on `/v1/chat/completions` only (ignore `/v1/responses`, `/v1/messages`).
- 2026-10-09: Settings namespace is `llm.*` (engine-agnostic), not `ninfer.*`.
- 2026-10-09: "Context size" is a **client-side budget** (engine has no per-request context field); presets `auto/32k/64k/128k/240k`, trim oldest history when over.
- 2026-10-09: Thinking shown as a **collapsed** block by default.
- 2026-10-09: Model dropdown auto-selects the **first** `/v1/models` entry when `llm.model` is empty.

## Notes / Open questions

- Confirm `llm.*` namespace is acceptable (vs `ninfer.*`).
- Thinking preset set: `off · low · medium · high · max` — expose full engine ladder (`minimal`/`xhigh`/`max`) later if needed.
- ninfer engine public model ID: `qwen3.8-27b`; context ceiling `--max-context 240000`.
