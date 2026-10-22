# Planner — Progress Memory

> **This file is the agent's persistent memory.** The `Planner` agent
> (`.github/agents/planner.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Turn each changelog feature (from the Changelog Researcher's backlog) into a concrete,
step-by-step implementation plan for the `llm` VS Code extension. The planner does NOT write
code — only the Coder writes code.

## Status

- **Current item:** **none** — awaiting the Changelog Researcher to populate the backlog
- **Next step:** plan the first pending backlog item (oldest first) once the backlog exists
- **Last updated:** 2026-10-22
- **Last commit:** — (no planner commits yet)
- **Build state:** n/a (planner does not build)

## Backlog pointer

The ordered backlog (oldest → newest) lives in
`.github/agents/changelog-researcher/PROGRESS.md`. The planner plans the **first pending
item** (the oldest) that the orchestrator dispatches.

## Plans

_(none yet — each planned item is recorded here with its slice list and acceptance criteria)_

## Done

_(none yet)_

## Todo

- [ ] Wait for the Changelog Researcher to populate the backlog.
- [ ] For each dispatched item: study the changelog entry (text + images), ground the plan in
      the real codebase, break it into tiny slices (one file / one concern each), write the
      plan, record it here.

## Notes / decisions

- The planner does NOT write code. Only the Coder writes code.
- Every plan must reference real file paths and existing patterns (read the relevant source
  files read-only first).
- Every slice must touch **at most one file and one concern** and be independently compilable
  (`npm run compile`) and committable. The orchestrator dispatches ONE slice per session, so
  keep slices tiny to limit token consumption.
- Always plan oldest → newest. Never skip ahead.
