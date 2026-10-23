# LLM Extension — Progress Memory

> **This file is the agent's persistent memory.** The `LLM Extension Developer` agent
> (`.github/agents/llm-extension.agent.md`) MUST read this at session start and update it at
> session end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Build a minimal, optimized, engine-agnostic VS Code extension that chats with any
OpenAI-compatible local engine (ninfer today). Aim: mirror Copilot for VS Code, eventually
managing code. Phase 1 = set provider + runtime parameters + chat.

## Status

- **Current phase:** **Phase 21 complete** — Send-while-streaming 3 options (21.1 done)
- **Next step:** **none** — awaiting new direction (see `todo.md` for the backlog)
- **Last updated:** 2026-10-22
- **Last commit:** `ce6a95d` — feat(llm): send-while-streaming 3 options (Phase 21)
- **Build state:** compiles clean; smoke passes

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
| 6     | Targeted file editing (`edit_file`)             | complete |
| 7     | Safe writes & review (diff, approval, undo)     | complete |
| 8     | Run & verify (`run_command`, `get_diagnostics`) | complete |
| 9     | Harness UX (tool cards, step budget, summary)   | complete |
| 10    | Git integration (status/diff, commit)           | complete |
| 11    | Sessions side panel (conversation management)   | complete |
| 12    | Change toolbox footer bar                       | complete |
| 13    | Multi-file diff view                            | complete |
| 14    | Per-file keep/undo in the change footer         | complete |
| 15 | Token budget bar | complete |
| 16 | Streaming tool-call progress cards | complete |
| 17 | Agent todos checklist (`manage_todos`) | complete |
| 18 | Restore checkpoints | complete |
| 19 | Compact conversation | complete |
| 20 | `@file` tagging | complete |
| 21 | Send-while-streaming (stop / queue / steer) | complete |

## Done (recap)

- **Phase 1 (S1–S12):** manifest, `config.ts`, `request.ts`/`presets.ts`, `client.ts` (SSE), webview + `ChatViewProvider`, toolbar (Model/Thinking/Context), smoke test.
- **Phase 2 (S13–S16):** `context.ts` editor/selection/diagnostics context + setting.
- **Phase 3 (S17–S20):** inline ghost-text completions (`InlineCompletionProvider`, `llm.inline.enabled`).
- **Phase 4 (S21–S26):** tools (`tools.ts`, `ToolExecutor`), agentic loop in `handleSend`.
- **Phase 5 (S27–S30):** code actions (`codeaction.ts`, `CodeActionProvider`).
- **Phase 6–8:** `edit_file`, `read_file` line range; diff preview, approval gate, undo; `run_command`, `get_diagnostics`, tool output display.
- **Phase 9–10:** tool cards, step budget, change summary; `git_status`/`git_diff`, commit command.
- **Phase 11–14:** Sessions side panel; change-toolbox footer (keep/undo, clickable rows); multi-file diff view; per-file keep/undo.
- **Phase 15–21:** token budget bar; streaming tool progress; `manage_todos` checklist; restore checkpoints; compact conversation; `@file` tagging; send-while-streaming (stop/queue/steer).
- **Fixes kept as lessons:** webview needs the `window` `message` fallback; Delete/Rename session buttons were wired in 2026-10-09.

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
