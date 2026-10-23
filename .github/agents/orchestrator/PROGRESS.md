# Orchestrator — Progress Memory

> **This file is the agent's persistent memory.** The `Orchestrator` agent
> (`.github/agents/orchestrator.agent.md`) MUST read this at session start and update it at
> session end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Coordinate the team (Planner → Coder → Tester) to implement the `llm` VS Code extension
features from the VS Code release notes archive at `https://code.visualstudio.com/updates/archive`,
**oldest to newest** within the active window. The orchestrator never writes code — it
dispatches, verifies each stage, records, and commits.

## Status

- **Current item:** **1.100-12** — Conversation summary (context-window management) — **IN PROGRESS** (5 slices S1–S5; S1–S3 done)
- **Current slice:** 1.100-12.S3 DONE (verified PASS)
- **Retry state:** **none** (sub-agent, attempts used / 5) — set when a sub-agent errors and
  is being retried with the same prompt; clear on success or when the budget is exhausted
- **Next step:** 1.100-12.S4 — webview marker rendering in `src/chat/webview.ts` (user goal: continue until version 1.107)
- **Last updated:** 2026-10-23
- **Last commit:** 3f2493d (tester verified 1.100-12.S3; code 6e99092)
- **Build state:** compiles clean; smoke 714/714 PASS (verified 2026-10-23)
- **Note (2026-10-22):** v1.99 changelog researched **inline** (researcher sub-agent failed
  with `context_length_exceeded` — deterministic, do not retry). Backlog recorded in the
  researcher PROGRESS.md: 15 pending keep-items (1.99-2 … 1.99-29), 10 skipped, 2
  done-already-built (1.99-1, 1.99-24).

## Team

| Agent | File | Memory file |
| ----- | ---- | ----------- |
| Planner | `.github/agents/planner.agent.md` | `.github/agents/planner/PROGRESS.md` |
| Coder | `.github/agents/coder.agent.md` | `.github/agents/coder/PROGRESS.md` |
| Tester | `.github/agents/tester.agent.md` | `.github/agents/tester/PROGRESS.md` |
| Changelog Researcher | `.github/agents/changelog-researcher.agent.md` | `.github/agents/changelog-researcher/PROGRESS.md` |

## Backlog pointer

The ordered backlog (oldest → newest) lives in
`.github/agents/changelog-researcher/PROGRESS.md`. The orchestrator always picks the **first
pending item** (the oldest).

## Done

Recap per version (micro-steps pruned; one slice = one commit, see `git log`).

**1.98 (complete, tag `changelog-1.98`):** editable `run_command` approval card + "modified by user" badge (1); `notebook_edit` tool, 5 actions, `src/notebook.ts`, `.ipynb` rendered as cells (2); `#codebase` sweep (8); `#problems` (9); `#folder:<name>` (10); `llm.changeCompletionsModel` + `llm.completions.model` (12); image attachments + `llm.chat.vision.enabled` (14); status-bar overview `llm.showStatusOverview` + `llm.statusBar.enabled` (15). Already built: 3, 4, 6. Smoke ends ~371.

**1.99 (complete, tag `changelog-1.99`):** MCP client over stdio `src/mcp.ts` + `src/mcpManager.ts` (2); `think` tool (3); `fetch_url` + `#fetch` `src/fetchTool.ts` (4); `find_usages` + `#usages` `src/usages.ts` (5); `#newWorkspace` scaffolds `src/workspaceScaffold.ts` (6); tool approvals with session/workspace/global scope `ApprovalStore` (8); Ask/Agent/Edit mode picker (10); reusable prompt files `llm.usePrompt` `src/prompts.ts` (12); URL/bmp images (13); completions status + `llm.toggleCompletions` (16); `#searchResults` (19); explicit save on keep (23); nbformat 4.5 cell ids (27); `new_notebook` tool + `/newNotebook` (28); cell outputs to chat `llm.addCellOutput` (29). Already built: 1, 24. Smoke ends ~584.

**1.100 (in progress, tag `changelog-1.100`):** done so far: instructions files `.instructions.md` with `applyTo` auto-attach, `src/instructions.ts` (1); prompt-file front matter `mode`/`tools`, `llm.runPrompt` + Play button, languages `llm.prompt`/`llm.instructions` (2); `apply_patch` tool `src/patch.ts` (3); `#fetch` as Markdown with `llm.chat.fetch.maxTokens` token trim (7); 1.100-8.S1 `ContextPill` + `parsePillRefs`/`dedupePills` in `src/context.ts`; 1.100-8.S2 pill strip UI in `src/chat/webview.ts`; 1.100-8.S3 host pill consumption + `postContextPills` in `src/chat/ChatViewProvider.ts`; 1.100-8.S4 `llm.addContext` grouped quick-pick (files/folders/selection/problems) + `context_inject`; 1.100-8 complete (S5 smoke guards). Smoke 690.

**1.100-12 (in progress):** `summarizeSplit`/`buildTranscript`/`SUMMARY_MARKER` helpers in `src/request.ts` (S1, 372d4b0); `llm.chat.summarize.enabled`/`threshold` settings (S2, 40f762c); automatic summarization pass `maybeSummarizeHistory` + agent-loop hook in `src/chat/ChatViewProvider.ts` (S3, 6e99092).

**1.100-11 (DONE, S1–S4):** `externallyChanged`/`FileSnapshot` helper in `src/tools/ToolExecutor.ts` (S1, 02e835e); `llm.agent.trackManualEdits` setting (default on) (S2, 9eb5918); manual-edit detection hook in agent loop (S3, dfe2f34); smoke guards, count 701→714 (S4, 3c4de22). No new tag — `changelog-1.100` already exists (final commit 3c4de22).

**1.100-10 (DONE, S1–S4):** `llm.agent.autoFix` setting (default on) (S1, ee2a9bb); `newDiagnostics` diff helper in `src/tools/ToolExecutor.ts` (S2, 6a0fa00); agent-loop autofix hook (pre-batch snapshot → 500 ms settle → diff → ≤2 follow-up rounds) in `src/chat/ChatViewProvider.ts` (S3, b0de672 + fix 308e856); smoke guards, count 690→701 (S4, ede4d2c). No new tag — `changelog-1.100` already exists (final commit ede4d2c).

Team flow used throughout: Planner (slices) → Coder (one slice) → Tester → orchestrator commits; retry a failed sub-agent up to 5× with the same prompt.

## Tags (changelog-version tags on completed items)

> When the last slice of a changelog item is committed, a lightweight tag `changelog-<version>`
> is created on that commit. Record each tag here as items complete.

| Item | Changelog version | Tag | Commit | Date |
| ---- | ----------------- | --- | ------ | ---- |
| 1.98-1 | 1.98 | `changelog-1.98` | ba127fd | 2026-10-22 |
| 1.99-2 | 1.99 | `changelog-1.99` | 1adefb6 | 2026-10-22 |
| 1.100-1 | 1.100 | `changelog-1.100` | e63ed62 | 2026-10-23 |
| 1.100-8 | 1.100 | `changelog-1.100` (already exists — left in place) | 08f2625 | 2026-10-23 |

## Todo

- [ ] Dispatch the Changelog Researcher to study the changelog and build the backlog.
- [ ] For each backlog item (oldest → newest): dispatch Planner (first slice only) → Coder
      (one slice) → Tester, verify, record, commit. Repeat one slice per session until the
      item is complete, then move to the next item.

## Notes / decisions

- The orchestrator does NOT write code. Only the Coder writes code.
- Always implement oldest → newest. Never skip ahead.
- If the Tester reports a failure, re-dispatch the Coder with the failure details, then
  re-test, until it passes.
- **Local LLM filter:** the engine is free — tokens are not paid for. Never dispatch
  cost/money-driven features (token-spend guards, dollar budgets, paid-API rate limits). Only
  `pending` items with `Relevance: keep (capability/context)` are implemented. See the full
  filter in `.github/agents/changelog-researcher.agent.md`.
- **One slice per session:** a feature is broken into tiny slices (one file / one concern
  each). The orchestrator dispatches ONE slice per session through Planner → Coder → Tester.
  This keeps each session's token consumption low. A slice touching >3 files is too big —
  split it further.
- **Retry on error: 5× same prompt.** If a sub-agent errors out (crash / timeout / no usable
  report), re-dispatch it up to 5 times with the EXACT SAME prompt before changing approach.
  Track the count in **Retry state**. Only after 5 identical retries fail, change approach
  (split the slice, simplify the prompt, or report the blocker). A genuine Tester failure
  (build error / failed acceptance) is NOT an error — fix it via the Coder instead of
  burning the retry budget.
- **Tag on item completion.** When the last slice of a changelog item is committed, create a
  lightweight tag `changelog-<version>` on that commit (e.g. `changelog-1.100.0`). Only the
  final slice is tagged — intermediate slices are not. Record the tag in the **Tags** table
  above. Never tag a commit that does not compile or has a failing test. If the tag already
  exists, leave it (do not force-recreate).
