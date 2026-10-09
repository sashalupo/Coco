# LLM Extension — Progress Memory

> **This file is the agent's persistent memory.** The `LLM Extension Developer` agent
> (`.github/agents/llm-extension.agent.md`) MUST read this at session start and update it at
> session end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Build a minimal, optimized, engine-agnostic VS Code extension that chats with any
OpenAI-compatible local engine (ninfer today). Aim: mirror Copilot for VS Code, eventually
managing code. Phase 1 = set provider + runtime parameters + chat.

## Status

- **Current phase:** 1 (in progress)
- **Next step:** S6
- **Last updated:** 2026-10-09
- **Last commit:** S5 (src/client.ts part 2)
- **Build state:** compiles clean (`npm run compile`)

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
| 1     | Provider + parameters + chat                    | not started |
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
- [ ] **S6 — `src/chat/webview.ts`.** `buildWebviewHtml()` — static HTML/CSS/JS shell: message
      list, input box, Model/Thinking/Context toolbar, collapsible thinking block. No logic yet.
      _Accept: compiles; returns a string; no external assets._
- [ ] **S7 — `src/chat/ChatViewProvider.ts`.** `WebviewViewProvider` that builds the webview and
      round-trips a basic `hello`/`ready` message between webview and host.
      _Accept: compiles; view renders and a message round-trips._
- [ ] **S8 — `src/extension.ts`.** `activate()`: register the view provider, the 4 commands, a
      status bar item, and a `/health` poll. Wire `llm.testConnection`.
      _Accept: compiles; extension activates; status bar reflects health._
- [ ] **S9 — wire chat send.** Connect webview "send" → `request.ts` → `client.chatStream()` →
      stream deltas back to the webview for rendering.
      _Accept: compiles; a real message streams into the panel._
- [ ] **S10 — wire toolbar.** Model/Thinking/Context dropdowns update the override state and
      feed `request.ts` (model list from `/v1/models`, thinking → `reasoning_effort`, context → budget).
      _Accept: compiles; changing a dropdown changes the next request body._
- [ ] **S11 — thinking + context UI.** Render `reasoning_content` as a collapsed thinking block;
      show a "context trimmed" indicator when history was trimmed.
      _Accept: compiles; thinking block collapses/expands; indicator appears on trim._
- [ ] **S12 — smoke test.** Manual test against the running ninfer engine: health, model list,
      one streamed chat with thinking. Update Status to "Phase 1 complete".
      _Accept: verified end-to-end; PROGRESS.md marked done._

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
