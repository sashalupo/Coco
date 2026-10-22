# Tester — Progress Memory

> **This file is the agent's persistent memory.** The `Tester` agent
> (`.github/agents/tester.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Verify that the Coder's implementation of each changelog feature compiles cleanly and behaves
correctly. The tester does NOT write code — it runs the build, the smoke test, and the
acceptance checks, and reports a clear pass/fail.

## Status

- **Current item:** **none** — awaiting a coded item from the Coder
- **Next step:** verify the first coded item (once the Coder reports done)
- **Last updated:** 2026-10-22
- **Last commit:** — (no tester commits yet)
- **Build state:** baseline compiles clean (`npm run compile`); smoke test passes

## Verification commands

- **Compile:** `npm run compile` (must exit 0, no errors)
- **Smoke test:** `node scripts/smoke-test.js` (must pass all assertions)
- **Lint (optional):** `npm run lint`

## Verifications

_(none yet — each verified item is recorded here with its verdict and evidence)_

## Done

_(none yet)_

## Todo

- [ ] Wait for a coded item from the Coder.
- [ ] For each item: run build, run smoke test, exercise acceptance checks, record verdict.

## Notes / decisions

- The tester does NOT write code. If a bug is found, report it (exact error, file, line) so
  the Coder can fix it.
- Always run the build first. If it fails, report fail immediately.
- Always run the smoke test. Record the assertion count.
- Report, don't fix.
