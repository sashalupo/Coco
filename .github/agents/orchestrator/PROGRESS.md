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

- **Current item:** **1.101-6 PENDING** (Chat UX improvements: distinct user messages, visible undo, navigable attachments — not yet planned)
- **Current slice:** none (item boundary)
- **Retry state:** clear
- **Next step:** dispatch the **Planner** for 1.101-6 (Chat UX improvements) (user goal: complete versions 1.101 → 1.107)
- **Last updated:** 2026-10-24
- **Last commit:** 0ca8c81 (tester: verify 1.101-5 PASS)
- **Build state:** compiles clean; smoke 870/870 PASS (verified 2026-10-24)
- **Note (2026-10-24):** working tree contained stale uncommitted changes that would have
  reverted completed 1.100 items (smoke 675 state); discarded via `git checkout --` to
  restore the committed 791-state before continuing.
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

**1.101-5 (DONE, S-001–S-003, verified PASS 2026-10-24):** MCP development mode — `McpDevConfig` + `dev` on `McpServerConfig` + `parseMcpServers` dev coercion + pure `mcpWatchTarget(watchGlob, cwd)` + `mcpDebugArgs(command, args)` in `src/mcp.ts` (S-001 b5290e2); `devWatchers` map + `mcpDebugArgs` spawn rewrite in `ensureStarted` (stdio-only) + `startDevWatch`/`stopDevWatch` 500 ms debounced `fs.watch` → `refresh` + watchers stopped on `setServers` removal + `dispose` in `src/mcpManager.ts` (S-002 0689df2); smoke guards `mcp-dev-s1..s12`, gate 858→870 (S-003 07e89ed, incl. in-slice fix: `refresh` bails on removed servers, `setServers` stops `devWatchers` independently). Tester PASS (commit 0ca8c81). No new tag — `changelog-1.101` already exists.

**1.101-4 (DONE, S-001–S-008, verified PASS 2026-10-24):** MCP sampling — `McpSamplingMessage`/`McpSamplingParams`/`McpSamplingResult`/`McpSamplingLogEntry` + `mcpSamplingParamsToMessages`/`mcpSamplingResultToText` in `src/mcp.ts` (S-001 fcad4cd); `McpJsonRpc.onRequest` hook + `setSamplingHandler` on both clients (S-002 c966c12); policy layer (per-server allow/deny, log capped 100, `getSamplingLog`, `setSamplingCallback`) in `src/mcpManager.ts` (S-003 e369283); `mcpSamplingConfirm`/`mcpSamplingAllowed` settings in `src/config.ts`+`src/presets.ts` (S-004 3bc09fb); host callback + first-use confirmation + `chatStream` round-trip in `src/chat/ChatViewProvider.ts` (S-005 10340a3); `sampling_request` card in `src/chat/webview.ts` (S-006 d3e07af); settings contributed in `package.json` (S-007 075690c); smoke guards `mcp-sampling-s1..s15`, gate 843→858 (S-008 876266a). Tester PASS (commit d1a936c). No new tag — `changelog-1.101` already exists.

**1.101-3 (DONE, S-001–S-008, verified PASS 2026-10-24):** MCP resources — `McpResource`/`McpResourceTemplate`/`McpResourceReadResult` + `mcpResourceReadToText` + `parseMcpResourceRef` in `src/mcp.ts` (S-001 0890a42); client `resources`/`resourceTemplates` + best-effort `loadResources()` (own 2 s timeout, after handshake) + `readResource(uri)` (S-002 4df9029); `McpClientLike` resource surface + `getServerResources`/`getServerResourceTemplates`/never-throwing `readResource(server, uri)` in `src/mcpManager.ts` (S-003 b126091); `ContextPill.kind` += `"mcp"` + `#mcp:<server>/<uri>` pill parsing in `src/context.ts` (S-004 428aac4); mcp pills consumed at send → `ctxInput.taggedFiles` in `src/chat/ChatViewProvider.ts` (S-005 743e6bd); "MCP Resources" category in `llm.addContext` + `llm.browseMcpResources` command in `src/extension.ts` + `package.json` (S-006 6ded6ee); `kind === "mcp"` pills rendered with plug icon in `src/chat/webview.ts` (S-007 76e6569); smoke guards `mcp-resource-s1..s15`, gate 828→843 (S-008 7eee189). Tester PASS (commit 4be0b9c). No new tag — `changelog-1.101` already exists.

**1.101-2 (DONE, S-001–S-006 + fix, verified PASS 2026-10-24):** MCP prompts — `McpPrompt`/`McpPromptResult`/`parseMcpPromptCommand`/`mcpPromptToText` + client `prompts`/`getPrompt` + best-effort `prompts/list` (own 2 s timeout, AFTER tools/list handshake) in `src/mcp.ts` (S-001 2f9a8a1, S-002 e7dc727); `McpClientLike` prompt surface + `getServerPrompts` + never-throwing `getPrompt(server, prompt, variableText?)` with first-arg mapping in `src/mcpManager.ts` (S-003 0779c4c); `/mcp.` intercept + `listMcpPrompts()` + `mcp_prompts` host message in `src/chat/ChatViewProvider.ts` (S-004 c4a765e); slash-command dropdown in `src/chat/webview.ts` (S-005 3808cac); smoke guards `mcp-prompt-s1..s15`, gate 813→828 (S-006 fe9743a); fix: send resolved `res.content` to model, raw command stays visible (882e7b8). Tester PASS (commit 01b1977). No new tag — `changelog-1.101` already exists.

**1.101-1 (DONE, S-001–S-008, tag `changelog-1.101`):** `src/toolsets.ts` pure module `parseToolsetsJson`/`resolveToolset`/`buildToolsetsExample` (S-001, e26766d); `extractToolsetTag` + `#toolset:` pill in `src/context.ts` (S-002, bf93a03); `toolsetsEnabled` default true in presets/config (S-003, 10d1c20); tag + toolbar picker → `promptTools` with tag > picker > prompt-file precedence + unknown/empty-set errors in `src/chat/ChatViewProvider.ts` (S-004, 6bb3424); Tools `<select>` + `toolsets` host message + `#toolset:` pills in `src/chat/webview.ts` (S-005, 52438e8 + gap fix 8221e8d); `llm.toolsets.enabled` + `llm.toolsets.createFile` in `package.json` (S-006, bb866e9); command registration scaffolding `.vscode/toolsets.json` (no overwrite) in `src/extension.ts` (S-007, 33f01d0); smoke guards `toolsets-s1..s7`, gate 806→813 (S-008, 92df096). Tester PASS 2026-10-24 (all 7 acceptance criteria).

**1.100-38 (DONE, S-001–S-005):** `McpToolAnnotations` + `annotations?` on `McpTool` + `mcpToolDisplayName()` in `src/mcp.ts` (S-001, b565dec); `McpManager.getToolAnnotations()` (S-002, de743b4); approval-gate bypass for `readOnlyHint: true` + `displayName` in `tool_start`/`tool_result` in `src/chat/ChatViewProvider.ts` (S-003, 2fb8325); `msg.displayName` rendering in `src/chat/webview.ts` (S-004, 3719bdc); smoke guards `mcp-ann-s1..s5`, gate 798→805 (S-005, 7f98964). No new tag — `changelog-1.100` already exists.

**1.100-31 (DONE, S-001–S-005):** `extractVariableNames`/`formatKernelState` in `src/notebook.ts` (S-001, 504abbf); 4 tool schemas `run_notebook_cell`/`get_kernel_state`/`list_packages`/`install_package` + `isMutatingTool` in `src/tools.ts` (S-002, b616305); 4 `execute()` cases + `kernelState` Map + jupyter→python3→python fallback in `src/tools/ToolExecutor.ts` (S-003, c3939d5); `llm.chat.notebookTools.enabled` gate in config/presets/request/package.json (S-004, 2825f58); smoke guards `nbtools-s1..s6`, gate 791→798 (S-005, 341de11). No new tag — `changelog-1.100` already exists.

**1.100-30 (DONE, S-001–S-003):** `extractNotebookCellOutput` + `NotebookCellOutputLike` in `src/notebook.ts` (S-001, affc774); `registerDragAndDropController` (viewContainerId `llm`, mime `notebook.cellOutput`) in `src/extension.ts` — Alt rule for text-only drops, vision gate, reuses `cell_output_inject` — + `llm.chat.cellOutputDrop.enabled` setting (S-002, 26efb84); smoke guards `drop-s1..s4`, count 787→791 (S-003, aa35cbb). No new tag — `changelog-1.100` already exists (final commit 3b0606e).

**1.100-29 (DONE, S-001–S-003):** pure alt-text helpers `findImageRef`/`isPlaceholderAlt`/`buildAltTextPrompt`/`parseAltText` in `src/codeaction.ts` (S-001, d01fc92); QuickFix "Generate alt text" on HTML/Markdown image lines with placeholder alt + one-shot vision `chatStream` resolve + `llm.codeAction.altText.enabled` setting (S-002, df5f480); smoke guards `alt-s1`, count 780→787 (S-003, ef5a845). No new tag — `changelog-1.100` already exists (final commit ef5a845).

**1.100-19 (DONE, S-001–S-003):** `launchTask` data + `buildTasksJson` in `src/workspaceScaffold.ts` (S-001, 5e3bde9); `buildScaffoldPrompt` tasks.json write + ask-and-run steps (S-002, 2c014c2); smoke guards `ws-s5`, count 774→780 (S-003, 7b4b7cc). No new tag — `changelog-1.100` already exists (final commit 7b4b7cc). **1.100-18 skipped** (no preview webview; revisit if a preview panel is ever added).

**1.100-16 (DONE, S1–S4):** `McpInput` interface + `McpServerConfig.inputs` + `parseMcpServers` inputs coercion + `detectSecretEnvName` + `resolveMcpInputs` in `src/mcp.ts` (S1, 201a24a); `McpClient` ctor `inputs?` arg + `McpManager` inputs Map / `setInputs` / `setServers` drop / `ensureStarted` pass-through + ctor-throw catch (S2, dbad249 + fixes 237e68c, f92343e); `llm.mcp.addServer` stdio env prompt + secret → `${input:...}` + `inputs` entry + password prompt + `mcpManager.setInputs` + `package.json` description (S3, 8f685b7); smoke guards `mcp-inputs-s1..s4`, count 766→774 (S4, 5f230bc). No new tag — `changelog-1.100` already exists (final commit 5f230bc).

**1.100-15 (DONE, S1–S6):** `McpProgressNotification`/`McpProgressCallback` + `McpJsonRpc` onNotification hook + `McpClient.setProgressCallback` (S1, 7aa4c4a); `McpHttpClient.setProgressCallback` + SSE progress capture in `post` (S2, a1e8cd5); `McpClientLike`/`McpManager.execute` onProgress threading + concrete `callTool` set/clear wiring (S3, ca9294e + fix 59e6731); `tool_progress` postMessage from MCP branch in `src/chat/ChatViewProvider.ts` (S4, 0b8ce56); webview `prettyJson` + `tool_progress` progress bar/line + CSS in `src/chat/webview.ts` (S5, 5cb6ea7); smoke guards `mcp-progress-s6`, count 758→766 (S6, f8e3b1f). No new tag — `changelog-1.100` already exists (final commit f8e3b1f).

**1.100-14 (DONE, S1–S5):** `McpToolResult.content` widened + `mcpResultToImages` pure extractor in `src/mcp.ts` (S1, 486f58e); `McpManager.execute` returns `{ content, images? }` (S2, 215b394); `tool_result` posts carry `images` in `src/chat/ChatViewProvider.ts` (S3, 814fbea); `.tool-images`/`.tool-img` thumbnail rendering in `src/chat/webview.ts` (S4, 7535819); smoke guards `mcp-img-s5`, count 750→758 (S5, 45939ec). No new tag — `changelog-1.100` already exists (final commit 45939ec).

**1.100-13 (DONE, S1–S5):** `McpHttpClient` + `parseSseMessages` + `url`-entry `parseMcpServers` in `src/mcp.ts` (S1, 61f7b85); `llm.mcp.servers` description documents Streamable HTTP (S2, e542ced); `McpClientLike` + transport pick in `src/mcpManager.ts` (S3, 3f8a4fa); `llm.mcp.addServer` transport quick-pick (stdio / Streamable HTTP url) in `src/extension.ts` (S4, afd54ec); smoke guards `mcp-http-s5` incl. live SSE/JSON mock servers, count 736→750 (S5, b267290). No new tag — `changelog-1.100` already exists (final commit b267290).

**1.100-12 (DONE, S1–S5):** `summarizeSplit`/`buildTranscript`/`SUMMARY_MARKER` helpers in `src/request.ts` (S1, 372d4b0); `llm.chat.summarize.enabled`/`threshold` settings (S2, 40f762c); automatic summarization pass `maybeSummarizeHistory` + agent-loop hook in `src/chat/ChatViewProvider.ts` (S3, 6e99092); webview `.message.summarized` marker + `summarize_result` case in `src/chat/webview.ts` (S4, bfc117d); smoke guards, count 714→736 (S5, ec9a244). No new tag — `changelog-1.100` already exists (final commit ec9a244).

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
| 1.101-1 | 1.101 | `changelog-1.101` | 92df096 | 2026-10-24 |
| 1.101-2 | 1.101 | `changelog-1.101` (already exists — left in place) | 01b1977 | 2026-10-24 |
| 1.101-3 | 1.101 | `changelog-1.101` (already exists — left in place) | 4be0b9c | 2026-10-24 |
| 1.101-4 | 1.101 | `changelog-1.101` (already exists — left in place) | d1a936c | 2026-10-24 |
| 1.101-5 | 1.101 | `changelog-1.101` (already exists — left in place) | 0ca8c81 | 2026-10-24 |

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

## Incidents

- **2026-10-24 — S-005 landed on side branch `fix/webview-script-syntax`.** The Coder's S-005 webview work (plus a webview script-escape fix + new "webview inline scripts parse" smoke check, gate 805→806) was committed on branch `fix/webview-script-syntax` instead of `master`. Verified the diff was exactly the S-005 scope (webview.ts + smoke-test.js + the host-push gap fix in ChatViewProvider.ts), then fast-forward merged into `master` (master was a direct ancestor). No history rewritten. **Smoke gate is now 806** — S-008 must bump 806 → 813 (not 805 → 812 as originally planned).

