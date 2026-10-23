# Planner — Progress Memory

> **This file is the agent's persistent memory.** The `Planner` agent
> (`.github/agents/planner.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Turn each changelog feature (from the Changelog Researcher's backlog) into a concrete,
step-by-step implementation plan for the `llm` VS Code extension. The planner does NOT write
code — only the Coder writes code.

## Active plan — 1.100-12 · Conversation summary (context-window management)

- **Status:** Planned (2026-10-23)
- **Changelog:** VS Code 1.100 (Apr 2025) — long conversations are compressed into a
  **"Summarized conversation history"** message instead of keeping the whole FIFO,
  keeping the prompt prefix stable and responses fast. Local reframe: local engines
  have hard, small context windows; when the estimated conversation tokens cross a
  threshold (default 70% of the selected context budget), run a summarization pass
  over the older turns and replace them with a single summary message. (Prompt-caching
  half is cloud-specific and dropped.)
- **Grounding notes:** `src/request.ts` already has `estimateTokens` (chars/3.5),
  `estimateMessagesTokens`, and `trimHistory` (hard FIFO drop — summarization is the
  soft alternative). `CONTEXT_TO_TOKENS` in `src/presets.ts` maps the toolbar context
  preset to a token budget (0 = auto/unbounded) — that is the "model context window"
  source. `handleCompact()` in `ChatViewProvider.ts` (~line 577) is the existing
  *manual* compaction (keep last 4, summarize rest, replace with a
  `[Context summary of earlier conversation]` user message, post `compact_result`) —
  the new feature is the *automatic* version, reusing the same summarization prompt
  shape. The agent loop `for(;;)` is at ~line 1452; the 1.100-11 manual-edit hook sits
  at loop top before `streamOneTurn` — the summarization check goes right after it.
  The webview `restore` handler renders only `user`/`assistant` roles, so the marker
  needs a small render branch. Smoke hard gate is 714.
- **Files to touch:** `src/request.ts`, `src/presets.ts`, `src/config.ts`,
  `package.json`, `src/chat/ChatViewProvider.ts`, `src/chat/webview.ts`,
  `scripts/smoke-test.js`.
- **Slices (in order):**
  - `1.100-12.S1` — pure helpers in `src/request.ts` (no vscode import):
    (a) add optional `summarized?: boolean` flag to the `ChatMessage` interface;
    (b) `export const SUMMARY_MARKER = "[Summarized conversation history]"`;
    (c) `export function summarizeSplit(messages: ChatMessage[], threshold: number,
    windowTokens: number): number | null` — returns the index `i` such that
    `messages[0..i)` is summarized and `messages[i..]` is kept, or `null` when no
    summarization is due. Rules: `null` when `windowTokens <= 0` (auto/unbounded),
    `threshold <= 0`, or `estimateMessagesTokens(messages) < threshold * windowTokens`;
    `null` when fewer than 6 messages; keep the last 4 messages (same keep-count as
    `handleCompact`); the split point must not break a tool-call group — if
    `messages[i].role === "tool"` or `messages[i].tool_calls` is non-empty, walk `i`
    forward until the group is intact; the split point must not land on a
    `summarized` message (walk forward past it); `null` if walking leaves fewer than
    4 messages to keep; (d) `export function buildTranscript(messages: ChatMessage[]):
    string` — `"User: …" / "Assistant: …" / "System: …" / "Tool: …"` lines joined by
    blank lines (same shape as the transcript in `handleCompact`).
  - `1.100-12.S2` — settings: `llm.chat.summarize.enabled` (boolean, default `true`)
    and `llm.chat.summarize.threshold` (number, default `0.7`, minimum 0, maximum 1)
    in `package.json` schema; `LlmSettings.chatSummarizeEnabled: boolean` +
    `LlmSettings.chatSummarizeThreshold: number` in `src/presets.ts`; reads in
    `src/config.ts` `readSettings()` with the same defaults. No context-window size
    setting — the window is the toolbar context preset via `CONTEXT_TO_TOKENS`
    (auto = disabled, which matches "local engines vary; user picks the preset").
  - `1.100-12.S3` — automatic summarization pass in `src/chat/ChatViewProvider.ts`:
    private `summarizing = false` re-entrancy guard; private
    `async maybeSummarizeHistory(settings, toolbar): Promise<void>` — compute
    `windowTokens = CONTEXT_TO_TOKENS[toolbar.context]`; call `summarizeSplit(this.history,
    settings.chatSummarizeThreshold, windowTokens)`; on `null` return; set
    `summarizing = true`; build the transcript via `buildTranscript(toSummarize)`;
    call `this.client.chatStream` non-streaming with the same summarization system
    prompt as `handleCompact` ("Summarize the following conversation concisely.
    Preserve key decisions, file paths, code changes, and task context. Keep it under
    500 words. Format as a brief narrative." + a line asking to end with the current
    task state); collect the summary; on empty summary or error, post a `delta` note
    (`[summarization failed — keeping full history]`) and return; otherwise replace:
    `this.history = [{ role: "user", content: SUMMARY_MARKER + "\n" + summary,
    summarized: true }, ...toKeep]`; `this.saveCurrentConversation()`; post a `delta`
    note (`[summarized conversation history: N messages → 1 summary]`) and a
    `summarize_result` message (token before/after, same shape as `compact_result`);
    post `restore` with the new history so the webview re-renders; finally
    `summarizing = false`. Hook: at the top of the agent loop, immediately after the
    1.100-11 manual-edit block and before the `step` post, `if
    (settings.chatSummarizeEnabled && !this.summarizing) { await
    this.maybeSummarizeHistory(settings, toolbar); }`.
  - `1.100-12.S4` — webview marker rendering in `src/chat/webview.ts`: in the
    `restore` handler's message loop, add a branch for messages with
    `m.summarized === true` (any role): render a muted system-style note — a
    `.message.summarized` div with a `.role` label "Summarized conversation history"
    and the content (minus the `SUMMARY_MARKER` prefix) rendered via `renderMarkdown`,
    styled like the existing muted system notice (1.99-28.S4 pattern: small, muted,
    centered-ish, with a subtle top border); add a `case 'summarize_result':` that
    renders the result line like `compact_result` (reuse the `revert-result` class);
    add the `.message.summarized` CSS rules.
  - `1.100-12.S5` — smoke-test guards in `scripts/smoke-test.js`:
    (a) `request.js` exports `summarizeSplit`, `buildTranscript`, `SUMMARY_MARKER`;
    (b) pure-function tests of compiled `summarizeSplit`: under threshold → `null`;
    `windowTokens = 0` → `null`; `threshold = 0` → `null`; fewer than 6 messages →
    `null`; over threshold with 10 plain user/assistant messages → split index 6
    (keep last 4); tool-group guard: a `tool` message at the naive split point moves
    the split forward past the group; a `summarized` message at the split point is
    skipped; (c) `buildTranscript` produces `User: …`/`Assistant: …` lines;
    (d) `package.json` schema: `llm.chat.summarize.enabled` boolean default true,
    `llm.chat.summarize.threshold` number default 0.7; (e) `config.ts` reads both
    with defaults; `presets.ts` has both fields; (f) `ChatViewProvider.ts` references
    `chatSummarizeEnabled`, `summarizeSplit`, `SUMMARY_MARKER`, `maybeSummarizeHistory`,
    and the "summarized conversation history" delta note; (g) `webview.ts` contains
    the `summarized` render branch, `summarize_result` case, and
    "Summarized conversation history" label; (h) raise the hard total-count gate
    (714 → new total).
- **First slice:** `1.100-12.S1`.
- **Acceptance:** compile + smoke pass; in a long agent session with a context preset
  selected (e.g. 32k), when estimated history tokens cross 70% of the budget the
  agent loop automatically compresses the older turns into a single
  "Summarized conversation history" message before the next turn; recent turns (last
  4) are preserved; the marker is visible in the Chat view; a `delta` note announces
  the compression; the summary message is never re-summarized; tool-call groups are
  never split; with the `auto` context preset or the setting disabled, no automatic
  summarization occurs (existing `trimHistory` behavior unchanged); manual Compact
  button still works.
- **Open questions:** (1) threshold is relative to the *toolbar context preset*
  budget, not a per-model window (no model metadata available from the engine) —
  acceptable, the user picks the preset to match their local model; (2) the summary
  message is a `user`-role message (same as `handleCompact`) so it survives
  `trimHistory`'s "keep the latest user turn" rule and renders in the webview; the
  `summarized` flag distinguishes it; (3) summarization runs at most once per loop
  iteration and is guarded by `summarizing` so a failed pass doesn't retry every
  turn within the same run (it may retry on the next run — acceptable).


## Status

- **Current item:** 1.100-12 (planned) — 1.100-11 complete
- **Next step:** dispatch `1.100-12.S1` (pure helpers in `src/request.ts`) to the Coder
- **Last updated:** 2026-10-23
- **Last commit:** (planner commit for the 1.100-12 plan)
- **Build state:** n/a (planner does not build)

## Plans delivered (recap)

Each item was split into slices of ≤3 files; plans themselves are pruned (see git history).

**1.98 (complete, tag `changelog-1.98`):** editable `run_command` approval card + "modified by user" badge (1); `notebook_edit` tool, 5 actions, `src/notebook.ts`, `.ipynb` rendered as cells (2); `#codebase` sweep (8); `#problems` (9); `#folder:<name>` (10); `llm.changeCompletionsModel` + `llm.completions.model` (12); image attachments + `llm.chat.vision.enabled` (14); status-bar overview `llm.showStatusOverview` + `llm.statusBar.enabled` (15). Already built: 3, 4, 6. Smoke ends ~371.

**1.99 (complete, tag `changelog-1.99`):** MCP client over stdio `src/mcp.ts` + `src/mcpManager.ts` (2); `think` tool (3); `fetch_url` + `#fetch` `src/fetchTool.ts` (4); `find_usages` + `#usages` `src/usages.ts` (5); `#newWorkspace` scaffolds `src/workspaceScaffold.ts` (6); tool approvals with session/workspace/global scope `ApprovalStore` (8); Ask/Agent/Edit mode picker (10); reusable prompt files `llm.usePrompt` `src/prompts.ts` (12); URL/bmp images (13); completions status + `llm.toggleCompletions` (16); `#searchResults` (19); explicit save on keep (23); nbformat 4.5 cell ids (27); `new_notebook` tool + `/newNotebook` (28); cell outputs to chat `llm.addCellOutput` (29). Already built: 1, 24. Smoke ends ~584.

**1.100 (in progress, tag `changelog-1.100`):** done so far: instructions files `.instructions.md` with `applyTo` auto-attach, `src/instructions.ts` (1); prompt-file front matter `mode`/`tools`, `llm.runPrompt` + Play button, languages `llm.prompt`/`llm.instructions` (2); `apply_patch` tool `src/patch.ts` (3); `#fetch` as Markdown with `llm.chat.fetch.maxTokens` token trim (7). Chat input pills: `ContextPill` + `parsePillRefs`/`dedupePills` in `src/context.ts`, pill strip UI in `src/chat/webview.ts`, `postContextPills()`/`remove_pill` in `src/chat/ChatViewProvider.ts`, grouped `llm.addContext` quick-pick in `src/extension.ts` (8). Smoke 690.
