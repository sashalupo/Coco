# Orchestrator — Progress Memory

> **This file is the agent's persistent memory.** The `Orchestrator` agent
> (`.github/agents/orchestrator.agent.md`) MUST read this at session start and update it at
> session end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Coordinate the team (Planner → Coder → Tester) to implement the `llm` VS Code extension
features from the VS Code Copilot changelog, **oldest to newest**. The orchestrator never
writes code — it dispatches, verifies each stage, records, and commits.

## Status

- **Current item:** **1.98-1** — Agent mode: editable terminal command + Ctrl+Enter confirm (VS Code 1.98)
- **Current slice:** **1.98-1.S2** — Host: `commandApproval` handler + `waitForCommandApproval`
- **Retry state:** **none** (sub-agent, attempts used / 5) — set when a sub-agent errors and
  is being retried with the same prompt; clear on success or when the budget is exhausted
- **Next step:** dispatch the **Changelog Researcher** to study the changelog and build the
  ordered backlog (oldest → newest)
- **Last updated:** 2026-10-22
- **Last commit:** `e3553d4` — chore(llm): build v1.98 changelog backlog (17 items, 6 pending)
- **Build state:** compiles clean; smoke test passes (S1 verified)

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

- **1.98-1.S1** (2026-10-22) — webview `command_approval` card: editable textarea (value-set, no innerHTML), Run/Cancel, Ctrl+Enter, double-decide guard, CSS. Tester PASS (compile + smoke + 6 static checks).

## Tags (changelog-version tags on completed items)

> When the last slice of a changelog item is committed, a lightweight tag `changelog-<version>`
> is created on that commit. Record each tag here as items complete.

| Item | Changelog version | Tag | Commit | Date |
| ---- | ----------------- | --- | ------ | ---- |
| _(none yet)_ | | | | |

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
