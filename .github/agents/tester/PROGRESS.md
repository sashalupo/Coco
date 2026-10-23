# Tester — Progress Memory

> **This file is the agent's persistent memory.** The `Tester` agent
> (`.github/agents/tester.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Verify that the Coder's implementation of each changelog feature compiles cleanly and behaves
correctly. The tester does NOT write code — it runs the build, the smoke test, and the
acceptance checks, and reports a clear pass/fail.

## Status
- **Current item:** 1.100-38 — COMPLETE (whole item verified PASS, all 7 acceptance criteria)
- **Next step:** 1.101-1 — Chat tool sets (next backlog item after 1.100-38)
- **Last updated:** 2026-10-24
- **Last commit:** 7f98964 (1.100-38 S-005, verified PASS)
- **Build state:** compiles clean; smoke 805/805 PASS (verified 2026-10-24)
## Verified (recap)

Slice detail pruned (see `git log` for full history). All slices verified PASS (build exit 0 + full smoke + scope check via `git show --stat`; `ninfer` submodule never committed).

- **1.100-31 S-001…S-005** (504abbf, b616305, c3939d5, 2825f58, 341de11) — PASS. Notebook tools for agent mode. Whole-item verification (2026-10-24): compile exit 0; smoke 798/798 (gate 791→798, `nbtools-s1..s6`); 4 tools in `CODE_TOOLS` (`src/tools.ts` L505/530/550/563); `isMutatingTool` true only for `run_notebook_cell`+`install_package` (L605-615), false for `get_kernel_state`/`list_packages`; `llm.chat.notebookTools.enabled` boolean default true (`package.json` L358-362); gate in `src/request.ts` L428-437 drops exactly the 4 execution tools when `notebookToolsEnabled === false` (`notebook_edit`/`new_notebook` untouched); `ToolExecutor.ts` has 4 `execute()` cases (L440-450) + `kernelState` Map (L107) + jupyter/python3/python and pip/pip3 fallbacks; no new runtime deps (S-004 `package.json` diff is settings-only); no webview changes (no `chat/webview.ts` in any of the 5 commits); scope via `git show --stat` per commit — only expected files + coder PROGRESS.md; `ninfer` never committed.

- **1.100-31 S-001** (504abbf) — PASS. `src/notebook.ts` only: two new exported pure helpers `extractVariableNames(source)` (regex over `import x`/`import x as y`/`from m import a`/`from m import a as b`/top-level `x = ...`/`def x`/`class X`; deduped, order-preserving, top-level only) and `formatKernelState(path, executed, variables)` (per-cell executed summary + variable list; "no cells executed yet" when empty). Verified: compile exit 0; smoke 791/791; scope via `git show --stat 504abbf` (only `src/notebook.ts` + coder PROGRESS.md; `ninfer` not committed); no `vscode` import in `src/notebook.ts` (grep: only comments); runtime probe on `out/notebook.js` — `extractVariableNames` returned exactly `["np","path","x","foo","Bar"]` (no `z`); `formatKernelState` empty → "no cells executed yet"; non-empty → per-cell "executed" lines + "variables: np, x".

- **1.100-30 S-003** (aa35cbb) — PASS. `scripts/smoke-test.js` only: 4 new assertions `drop-s1`…`drop-s4` (drag-and-drop controller on `viewContainerId: "llm"`; `notebook.cellOutput` + `e.modifiers.alt` Alt rule; `extractNotebookCellOutput` in `src/notebook.ts`; `llm.chat.cellOutputDrop.enabled` boolean default true in `package.json`); hard gate 787→791. Verified: compile exit 0; smoke 791/791; scope via `git show --stat aa35cbb` (only `scripts/smoke-test.js` + coder PROGRESS.md; `ninfer` not committed); grep confirmed all 4 assertions + gate 791. Item 1.100-30 complete.
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
