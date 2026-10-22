# Coder — Progress Memory

> **This file is the agent's persistent memory.** The `Coder` agent
> (`.github/agents/coder.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Implement the plans produced by the Planner agent for the `llm` VS Code extension. The Coder
is the **ONLY agent that writes code**. It keeps the build green at every step and commits
after each compiling step.

## Status

- **Current step:** **none** — awaiting a plan from the Planner
- **Next step:** implement the first step of the current plan (once a plan exists)
- **Last updated:** 2026-10-22
- **Last commit:** — (no coder commits yet)
- **Build state:** baseline compiles clean (`npm run compile`); smoke test passes

## Plan pointer

The current plan lives in `.github/agents/planner/PROGRESS.md`. The Coder implements it step
by step, one step per session.

## Done

_(none yet)_

## Todo

- [ ] Wait for a plan from the Planner.
- [ ] For each plan step: implement, verify (`npm run compile`), record, commit.

## Notes / decisions

- The Coder is the ONLY agent that writes code.
- One step per session. Each step independently compiles and commits.
- No runtime npm dependencies. No bundler. Stay minimal.
- Always update this file in the same commit as the code it describes.
