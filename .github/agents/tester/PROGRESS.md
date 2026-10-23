# Tester — Progress Memory

> **This file is the agent's persistent memory.** The `Tester` agent
> (`.github/agents/tester.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Verify that the Coder's implementation of each changelog feature compiles cleanly and behaves
correctly. The tester does NOT write code — it runs the build, the smoke test, and the
acceptance checks, and reports a clear pass/fail.

## Status
- **Current item:** 1.100-30 — in progress (S-001, S-002 verified PASS)
- **Next step:** 1.100-30 S-003 (smoke 787→791)
- **Last updated:** 2026-10-23
- **Last commit:** 26efb84 (1.100-30 S-002, verified PASS)
- **Build state:** compiles clean; smoke 787/787 PASS (verified 2026-10-23)
## Verified (recap)

Slice detail pruned (see `git log` for full history). All slices verified PASS (build exit 0 + full smoke + scope check via `git show --stat`; `ninfer` submodule never committed).

- **1.100-30 S-002** (26efb84) — PASS. `registerDragAndDropController` in `src/extension.ts` targeting `viewContainerId: "llm"`, `dropMimeTypes: ["notebook.cellOutput"]`; Alt rule (`e.modifiers.alt` for text-only), vision gate, `cell_output_inject` post; `llm.chat.cellOutputDrop.enabled` (boolean, default true) in `package.json`. Scope: only `src/extension.ts`, `package.json`, coder PROGRESS.md; `webview.ts` untouched; `ninfer` not committed. Compile exit 0; smoke 787/787.
- **1.100-30 S-001** (affc774) — PASS. `extractNotebookCellOutput` in `src/notebook.ts` (pure, no vscode import); runtime probe 5/5. Smoke 787/787.
- **1.100-29 S-001–S-003** (d01fc92, df5f480, ef5a845) — PASS. Alt-text code action; item complete. Smoke 787/787.
- **1.100-19 S-001–S-003** (5e3bde9, 2c014c2, 7b4b7cc) — PASS. Workspace tasks.json scaffold; item complete. Smoke 780/780.
- **1.100-16 S1–S4 + 2 fixes** — PASS. MCP server inputs/secret detection; item complete. Smoke 774/774.
- **1.100-15 S1–S6 + 1 fix** — PASS. MCP progress notifications; item complete. Smoke 766/766.
- **1.100-14 S1–S5** — PASS. MCP image results; item complete. Smoke 758/758.
- **1.100-13 S1–S5** — PASS. MCP Streamable HTTP transport; item complete. Smoke 750/750.
- **1.100-12 S1–S5** — PASS. Conversation summarization; item complete. Smoke 736/736.
- **1.100-11 S1–S4** — PASS. Manual-edit tracking; item complete. Smoke 714/714.
- **1.100-10 S1–S4 + 1 fix** — PASS. Agent auto-fix (original S3 FAIL: pre-batch snapshot taken post-batch; fixed in 308e856). Item complete. Smoke 701/701.
- **1.100-8 S1–S5** — PASS. Context pills + `llm.addContext`. Item complete. Smoke 690/690.

## Verification commands

- **Compile:** `npm run compile` (must exit 0, no errors)
- **Smoke test:** `node scripts/smoke-test.js` (must pass all assertions)
- **Lint (optional):** `npm run lint`

## Notes / decisions

- The tester does NOT write code. If a bug is found, report it (exact error, file, line) so
  the Coder can fix it.
- Always run the build first. If it fails, report fail immediately.
- Always run the smoke test. Record the assertion count.
- Report, don't fix.
