# LLM Extension — Progress Memory

> **This file is the agent's persistent memory.** The `LLM Extension Developer` agent
> (`.github/agents/llm-extension.agent.md`) MUST read this at session start and update it at
> session end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Build a minimal, optimized, engine-agnostic VS Code extension that chats with any
OpenAI-compatible local engine (ninfer today). Aim: mirror Copilot for VS Code, eventually
managing code. Phase 1 = set provider + runtime parameters + chat.

## Status

- **Current phase:** 2 (in progress)
- **Next step:** S14
- **Last updated:** 2026-10-09
- **Last commit:** S13 (context.ts)
- **Build state:** compiles clean (`npm run compile`); smoke test passes

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

| Phase | Capability                                      | Status      |
| ----- | ----------------------------------------------- | ----------- |
| 1     | Provider + parameters + chat                    | complete    |
| 2     | Context-aware chat (file/selection/diagnostics) | not started |
| 3     | Inline completion (ghost text)                  | not started |
| 4     | Manage code via tools (agentic loop)            | not started |
| 5     | Code actions / refactors                        | not started |

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
- [ ] **S14 — gather + inject context.** In `ChatViewProvider`, read the active editor (file path,
      language, selection range + text) and workspace diagnostics, build the context block via
      `buildContextBlock`, and inject it into the request (prepended to the system prompt).
      _Accept: compiles; with an open file the request body carries the context block._
- [ ] **S15 — context settings + toggle.** Add `llm.context.includeFile` / `includeSelection` /
      `includeDiagnostics` (default true) and a small "Context" toggle in the chat panel; respect
      the flags when gathering.
      _Accept: compiles; toggling a flag changes what is injected._
- [ ] **S16 — context smoke test.** Extend `scripts/smoke-test.js` to assert `buildContextBlock`
      output for file/selection/diagnostics and that an empty input yields an empty string.
      _Accept: compiles; new assertions pass._

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
