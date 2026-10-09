# LLM Extension — Progress Memory

> **This file is the agent's persistent memory.** The `LLM Extension Developer` agent
> (`.github/agents/llm-extension.agent.md`) MUST read this at session start and update it at
> session end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Build a minimal, optimized, engine-agnostic VS Code extension that chats with any
OpenAI-compatible local engine (ninfer today). Aim: mirror Copilot for VS Code, eventually
managing code. Phase 1 = set provider + runtime parameters + chat.

## Status

- **Current phase:** 1 (not started)
- **Last updated:** 2026-10-09
- **Last commit:** (none yet)
- **Build state:** not compiled

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
| Setting | Default | Maps to |
|---|---|---|
| `llm.baseUrl` | `http://localhost:8080` | provider endpoint |
| `llm.apiKey` | *(empty)* | optional `Authorization: Bearer` |
| `llm.model` | *(empty = first from `/v1/models`)* | `model` fallback |
| `llm.systemPrompt` | *(empty)* | injected `system` message |
| `llm.temperature` | `1.0` | `temperature` |
| `llm.topP` / `llm.topK` / `llm.minP` | `1.0` / `20` / `0.0` | sampling |
| `llm.presencePenalty` / `llm.frequencyPenalty` | `0` | sampling |
| `llm.seed` | *(empty = random)* | `seed` |
| `llm.stop` | `[]` | `stop` (max 4) |
| `llm.maxCompletionTokens` | `4096` | `max_completion_tokens` |
| `llm.preserveThinking` | `false` | `preserve_thinking` |
| `llm.stream` | `true` | `stream` |
| `llm.includeUsage` | `true` | `stream_options.include_usage` |
| `llm.responseFormat` | `text` | `response_format` |
| `llm.chatTemplateKwargs` | `{}` | `chat_template_kwargs` |
| `llm.tools.enabled` | `false` | gates tool-calling phase |

### `package.json` contributions
- `configuration`: all `llm.*` settings.
- `commands`: `llm.openChat`, `llm.testConnection`, `llm.refreshModels`, `llm.clearChat`.
- `viewsContainers.activitybar` + `views.activitybar.llm`: the `llm.chat` view.
- `activationEvents`: `onView:llm.chat`, `onCommand:llm.testConnection` (lazy).

## Roadmap

| Phase | Capability | Status |
|---|---|---|
| 1 | Provider + parameters + chat | not started |
| 2 | Context-aware chat (file/selection/diagnostics) | not started |
| 3 | Inline completion (ghost text) | not started |
| 4 | Manage code via tools (agentic loop) | not started |
| 5 | Code actions / refactors | not started |

## Done

_(none yet)_

## Todo — Phase 1

- [ ] `package.json`: add `llm.*` configuration, commands, activity bar view, lazy activation events.
- [ ] `src/config.ts`: settings access + toolbar override state (Memento).
- [ ] `src/client.ts`: `LlmClient` — `health()`, `listModels()`, `chatStream()` (fetch + SSE parser).
- [ ] `src/request.ts`: `buildRequestBody()` (merge settings ← overrides) + token estimator + history trim.
- [ ] `src/chat/webview.ts`: `buildWebviewHtml()` — chat UI + Model/Thinking/Context toolbar + collapsible thinking block.
- [ ] `src/chat/ChatViewProvider.ts`: `WebviewViewProvider` wiring webview ↔ extension host.
- [ ] `src/extension.ts`: `activate()` — register view provider, commands, status bar, health poll.
- [ ] `npm run compile` passes cleanly.
- [ ] Manual smoke test against the running ninfer engine (health, models, one streamed chat).

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
