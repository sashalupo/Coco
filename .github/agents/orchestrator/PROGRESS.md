# Orchestrator — Progress Memory

> **This file is the agent's persistent memory.** The `Orchestrator` agent
> (`.github/agents/orchestrator.agent.md`) MUST read this at session start and update it at
> session end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Coordinate the team (Planner → Coder → Tester) to implement the `llm` VS Code extension
features from the VS Code Copilot changelog, **oldest to newest**. The orchestrator never
writes code — it dispatches, verifies each stage, records, and commits.

## Status

- **Current item:** **none** — awaiting the Changelog Researcher to populate the backlog
- **Next step:** dispatch the **Changelog Researcher** to study the changelog and build the
  ordered backlog (oldest → newest)
- **Last updated:** 2026-10-22
- **Last commit:** — (no orchestrator commits yet)
- **Build state:** baseline compiles clean (`npm run compile`); smoke test passes

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

_(none yet)_

## Todo

- [ ] Dispatch the Changelog Researcher to study the changelog and build the backlog.
- [ ] For each backlog item (oldest → newest): dispatch Planner → Coder → Tester, verify,
      record, commit.

## Notes / decisions

- The orchestrator does NOT write code. Only the Coder writes code.
- Always implement oldest → newest. Never skip ahead.
- If the Tester reports a failure, re-dispatch the Coder with the failure details, then
  re-test, until it passes.
- **Local LLM filter:** the engine is free — tokens are not paid for. Never dispatch
  cost/money-driven features (token-spend guards, dollar budgets, paid-API rate limits). Only
  `pending` items with `Relevance: keep (capability/context)` are implemented. See the full
  filter in `.github/agents/changelog-researcher.agent.md`.
