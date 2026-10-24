# Tester — Progress Memory

> **This file is the agent's persistent memory.** The `Tester` agent
> (`.github/agents/tester.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Verify that the Coder's implementation of each changelog feature compiles cleanly and behaves
correctly. The tester does NOT write code — it runs the build, the smoke test, and the
acceptance checks, and reports a clear pass/fail.

## Status
- **Current item:** 1.101-1 — COMPLETE (whole item verified PASS, all 7 acceptance criteria)
- **Next step:** 1.101-2 — MCP support for prompts (next backlog item after 1.101-1)
- **Last updated:** 2026-10-24
- **Last commit:** 92df096 (1.101-1 S-008, verified PASS)
- **Build state:** compiles clean; smoke 813/813 PASS (verified 2026-10-24)
## Verified (recap)

Slice detail pruned (see `git log` for full history). All slices verified PASS (build exit 0 + full smoke + scope check via `git show --stat`; `ninfer` submodule never committed).

- **1.101-1 whole item** (e26766d, bf93a03, 10d1c20, 6bb3424, 52438e8+8221e8d, bb866e9, 33f01d0, 92df096) — PASS (2026-10-24). Chat tool sets. Compile exit 0; smoke 813/813 (gate 806→813, `toolsets-s1..s7`). (1) `#toolset:<name>` tag + toolbar Tools picker both feed `promptTools` in `runStream` (`src/chat/ChatViewProvider.ts` L1344-1366; precedence tag > `pendingToolset` > `pendingPromptTools`), applied by the existing filter in `src/request.ts` L415-425. (2) Unknown/empty set → `postMessage({type:"error"})` ("Unknown tool set: X" / "tool set 'X' has no tools", `resolveToolsetTools` L1109-1135); bare `#toolset` (empty name) treated as absent (L1357-1359). (3) `llm.toolsets.createFile` registered in `src/extension.ts` L922-949: `stat` first → "already exists" info + return (no overwrite), else writes `buildToolsetsExample()` to `.vscode/toolsets.json` and opens it. (4) `llm.toolsets.enabled` boolean default true (`package.json` L414-418; `src/config.ts` L87; `src/presets.ts` L122); gate `if (settings.toolsetsEnabled)` L1352 disables tag+picker resolution. (5) No new runtime deps (bb866e9 `package.json` diff is contributes-only). Runtime probes: `extractToolsetTag` colon/space/bare-eol/`#toolsetfoo` → "gh-news"/"gh-news"/""/null; `parseToolsetsJson(buildToolsetsExample())` → 1 set, 0 errors; `resolveToolset` case-insensitive hit + unknown → null. Note: S-005 webview changes (Tools `<select>`, `case 'toolsets'`, `#toolset:` pill icon) landed in 52438e8 (side-branch `fix/webview-script-syntax`, recorded in d77ecde) + host push in 8221e8d; both in range 10d1c20..92df096. Scope via `git show --stat` per commit — only expected files + agent PROGRESS.md; `ninfer` never committed in range.

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
