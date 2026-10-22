# Tester — Progress Memory

> **This file is the agent's persistent memory.** The `Tester` agent
> (`.github/agents/tester.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Verify that the Coder's implementation of each changelog feature compiles cleanly and behaves
correctly. The tester does NOT write code — it runs the build, the smoke test, and the
acceptance checks, and reports a clear pass/fail.

## Status

- **Current item:** 1.99-10.S3 — webview mode picker — **PASS** (2026-10-22)
- **Next step:** 1.99-10.S4 — next slice of item 1.99-10 (Unified Chat view — history)
- **Last updated:** 2026-10-22
- **Last commit:** e281b7f (feat(llm): unified chat — host wiring + toolbar mode (1.99-10.S2)); S3 commit pending
- **Build state:** 478/478 PASS


### 1.99-10.S3 — webview mode picker (src/chat/webview.ts) (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **478 PASS lines** (475 prior + 3 new `unif-s3:`), 0 FAIL.
- **Acceptance checks:** (1) build exit 0 PASS; (2) smoke 478/478 with 3 genuine `unif-s3:` static-source assertions in new `// 34) Unified chat mode — webview picker (1.99-10.S3)` section (smoke-test.js:3655) all passing: `unif-s3: mode-select element`, `unif-s3: mode options`, `unif-s3: mode in toolbar payload` PASS; (3) `src/chat/webview.ts`: HTML L1109 `<select id="mode-select">` with options Ask / Agent (selected) / Edit, placed as first labeled control in `.toolbar` after `#quick-new-chat` and before the Model label; JS L1173 `var modeSelect = document.getElementById('mode-select')` + L1305 `modeSelect.addEventListener('change', postToolbar)`; `getToolbar()` L1836 returns `mode: modeSelect.value`; `setToolbar(state)` L1849 sets `modeSelect.value = state.mode` guarded to `'ask' | 'agent' | 'edit'`; `postToolbar()` L1465 payload includes `mode: state.mode`; `case 'toolbar':` in `handleHostMessage` L1942 passes `mode: msg.mode` into `setToolbar` PASS; (4) scope: exactly coder PROGRESS.md, smoke-test.js, webview.ts modified (ninfer submodule marker ignored); no package-lock.json drift PASS.
- **Verdict:** **PASS** — all 4 criteria met.

### 1.99-10.S2 — host wiring: presets + config + ChatViewProvider (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **475 PASS lines** (472 prior + 3 new `unif-s2:`), 0 FAIL.
- **Acceptance checks:** (1) build exit 0 PASS; (2) smoke 475/475 with 3 genuine `unif-s2:` static-source assertions in new `// 33) Unified chat mode — host wiring (1.99-10.S2)` section (smoke-test.js:3623) all passing: `unif-s2: ChatViewProvider wiring` (normalizeChatMode + modeAddendum + `mode: toolbar.mode`), `unif-s2: config setMode + backfill`, `unif-s2: presets ToolbarState.mode` PASS; (3) `src/presets.ts`: `ToolbarState` gains `mode: ChatMode` (after `contextFlags`); `src/config.ts`: `DEFAULT_TOOLBAR` gains `mode: "agent"`, `get()` backfills `mode: normalizeChatMode(state.mode)`, new `setMode(mode: ChatMode): Thenable<void>` setter, imports `ChatMode` type + `normalizeChatMode`; `src/chat/ChatViewProvider.ts`: imports `modeAddendum` + `normalizeChatMode` from `../presets`; `pushToolbarState()` posts `mode: t.mode`; `applyToolbarMessage()` persists via `setMode(normalizeChatMode(msg.mode))`; `runStream` passes `mode: toolbar.mode` to BOTH `buildRequestBody` call sites (initial + rebuilt); `composeSystemPrompt` gains 4th param `modeAddendum: string` (appended last in `parts`, filtered by existing empty-trim guard), call site passes `modeAddendum(toolbar.mode)` PASS; (4) scope: exactly coder PROGRESS.md, smoke-test.js, ChatViewProvider.ts, config.ts, presets.ts modified (ninfer submodule marker ignored); no package-lock.json drift PASS.
- **Verdict:** **PASS** — all 4 criteria met.

### 1.99-10.S1 — pure mode logic (src/presets.ts + src/request.ts) (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **472 PASS lines** (466 prior + 6 new `unif-s1:`), 0 FAIL.
- **Acceptance checks:** (1) build exit 0 PASS; (2) smoke 472/472 with 6 genuine `unif-s1:` assertions in new `// 32) Unified chat mode — pure logic (1.99-10.S1)` section (smoke-test.js:3576) all passing: CHAT_MODES order, normalizeChatMode valid+invalid, modeAddendum edit/ask/agent-empty, buildRequestBody ask/agent/no-mode tools PASS; (3) `src/presets.ts:359–381`: `ChatMode = "ask" | "agent" | "edit"`, `CHAT_MODES = ["ask","agent","edit"]`, `normalizeChatMode` (invalid → `"agent"`), `EDIT_MODE_ADDENDUM`, `modeAddendum` (edit → Edit addendum, ask → Ask addendum, else `""`) PASS; (4) `src/request.ts`: `RequestConfig.mode?: ChatMode` (L63, import L10); `buildRequestBody` L279–287: `mode = cfg.mode ?? "agent"`; ask → `body.tool_choice = "none"` + no `body.tools`; agent/edit/absent → existing `settings.toolsEnabled` branch byte-identical (backward compatible) PASS; (5) scope: exactly coder PROGRESS.md, smoke-test.js, presets.ts, request.ts modified; no package-lock.json drift; diff stat +78/−1 PASS.
- **Minor (non-blocking):** brace-less `else` at `src/request.ts:282` — compiles and behaves correctly.
- **Verdict:** **PASS** — all 4 criteria met.

### 1.99-8.S4 — FINAL: `package.json` + final smoke assertions (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **466 PASS lines** (464 prior + 2 new `appr-s4:`), 0 FAIL.
- **Acceptance checks:** (1) build exit 0 PASS; (2) smoke 466/466 PASS; (3) 2 genuine `appr-s4:` assertions passing: `package.json has llm.tools.autoApprove`; `package.json still has llm.tools.requireApproval` PASS; (4) `package.json` valid JSON — `llm.tools.autoApprove` = `{type: "boolean", default: false, description: "Auto-approve all mutating tools without asking (experimental). Overrides llm.tools.requireApproval. Remembered approvals (session/workspace/global) also skip the prompt."}`, adjacent to `llm.tools.requireApproval` in `contributes.configuration.properties` PASS; (5) full-item regression: all 11 earlier `appr-s*:` assertions pass — `appr-s1:` ×5, `appr-s2:` ×3, `appr-s3:` ×3 PASS; (6) scope: exactly ` M .github/agents/coder/PROGRESS.md`, ` M package.json`, ` M scripts/smoke-test.js` (ninfer submodule marker ignored); no `package-lock.json` drift PASS.
- **Verdict:** **PASS** — all 6 criteria met. **Item 1.99-8 (Agent mode tool approvals) fully verified (S1–S4).**

### 1.99-8.S3 — webview scope dropdown on both approval cards (src/chat/webview.ts) (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **464 PASS lines** (461 prior + 3 new `appr-s3:`), 0 FAIL.
- **Acceptance checks:** (1) build exit 0 PASS; (2) smoke 464/464 PASS; (3) 3 genuine `appr-s3:` assertions all passing: `webview has approve-scope dropdown`; `webview has workspace scope option`; `webview has global scope option` PASS; (4) wiring in `src/chat/webview.ts`: `case 'approval_request':` (L2135) renders `<select class="approve-scope">` (L2144) with 4 options once/session/workspace/global (default once, L2145–2148); `decide()` disables approve/reject buttons + `scopeEl` (L2160–2162) then posts `vscode.postMessage({ type: 'toolApproval', id: msg.id, approved: approved, scope: scopeEl.value })` (L2165); `case 'command_approval':` (L2172) renders identical 4-option dropdown (L2182–2186); `decideCmd()` disables run/cancel/input/`cmdScopeEl` (L2199–2203) then posts `vscode.postMessage({ type: 'commandApproval', id: msg.id, approved: approved, command: cmdInput.value, scope: cmdScopeEl.value })` (L2206); `.approve-scope` CSS rule at L317 + `:focus` at L326 PASS; (5) scope: exactly ` M .github/agents/coder/PROGRESS.md`, ` M scripts/smoke-test.js`, ` M src/chat/webview.ts` (ninfer submodule marker ignored); no `package-lock.json` drift PASS.
- **Verdict:** **PASS** — all 5 criteria met.

### 1.99-8.S2 — host wiring: ChatViewProvider + config.ts + presets.ts autoApprove (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **461 PASS lines** (458 prior + 3 new `appr-s2:`), 0 FAIL.
- **Acceptance checks:** (1) build exit 0 PASS; (2) smoke 461/461 PASS; (3) 3 genuine `appr-s2:` assertions all passing (smoke-test.js L3521/3529/3537): `ChatViewProvider wires ApprovalStore`; `config reads tools.autoApprove`; `presets LlmSettings has autoApprove` PASS; (4) wiring in `src/chat/ChatViewProvider.ts`: L113 `private readonly approvalStore: ApprovalStore;` + L150 `new ApprovalStore(context.workspaceState, context.globalState)`; gate at L1245–1250 verbatim `settings.requireApproval && isMutating && !settings.autoApprove && !this.approvalStore.isApproved(call.function.name)` (isMutating = `isMutatingTool(...) || isMcpToolName(...)` L1238–1240); both approval branches (run_command L1282–1287, plain L1316–1321) call `this.approvalStore.remember(call.function.name, scope)` only when `scope === "session" || scope === "workspace" || scope === "global"`; reject paths `continue` before any remember; `onMessage` L219/L226 pass `typeof msg.scope === "string" ? msg.scope : undefined` PASS; (5) `src/config.ts:65` `autoApprove: c.get<boolean>("tools.autoApprove", false)`; `src/presets.ts:89` `autoApprove: boolean` PASS; (6) scope: exactly ` M .github/agents/coder/PROGRESS.md`, ` M scripts/smoke-test.js`, ` M src/chat/ChatViewProvider.ts`, ` M src/config.ts`, ` M src/presets.ts` (ninfer submodule marker ignored); no `package-lock.json` drift PASS.
- **Verdict:** **PASS** — all 5 criteria met.

### 1.99-8.S1 — pure ApprovalStore (src/presets.ts) (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **458 PASS lines** (453 prior + 5 new `appr-s1:`), 0 FAIL.
- **Acceptance checks:** (1) build exit 0 PASS; (2) smoke 458/458 PASS PASS; (3) 5 genuine `appr-s1:` assertions all passing: `presets exports ApprovalStore`; `workspace remember → isApproved`; `session remember → isApproved`; `global remember → isApproved`; `unremembered tool not approved + listApproved sorted` PASS; (4) `src/presets.ts` pure — only import is `import type { McpServerConfig } from "./mcp"` (L8), no `vscode` import (all other "vscode" hits are comments); `ApprovalStore` class at L302 with `isApproved` (L313), `remember` (L322), `listApproved` (L338) PASS; (5) scope: exactly ` M .github/agents/coder/PROGRESS.md`, ` M scripts/smoke-test.js`, ` M src/presets.ts` (ninfer submodule marker ignored); no `package-lock.json` drift PASS; (6) last commit `5fdca80` (chore: record 1.99-8 plan), no coder commit for S1 PASS.
- **Verdict:** **PASS** — all 5 criteria met.

### 1.99-6.S4 — FINAL: new workspace wiring smoke + PROGRESS.md (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **453 PASS lines** (450 prior + 3 new `ws-s4:`), 0 FAIL.
- **Acceptance checks:** (1) build exit 0 PASS; (2) smoke 453/453 PASS with 3 genuine `ws-s4:` assertions all passing (ChatViewProvider wiring: out/chat/ChatViewProvider.js contains `extractNewWorkspaceTag` + `buildScaffoldPrompt`; config wiring: out/config.js contains `"chat.newWorkspace.enabled"`; package.json setting: `llm.chat.newWorkspace.enabled` boolean/default true + `llm.chat.usages.enabled` regression guard) PASS; (3) static: new `// 27) New workspace wiring (1.99-6.S4)` section uses `fs.readFileSync` for `out/chat/ChatViewProvider.js` (`chatViewSrcWsS4`) and `out/config.js` (`configSrcWsS4`) — no `require` of vscode-importing modules; `require` only for `package.json` PASS; (4) scope: exactly `scripts/smoke-test.js`, planner PROGRESS.md, coder PROGRESS.md; no `package-lock.json` drift PASS; (5) last commit `2d0a5df` (coder: 1.99-6.S3), no coder commit for S4 PASS.
- **Verdict:** **PASS** — all criteria met. **Item 1.99-6 (New workspace `#newWorkspace`) fully verified (S1–S4).**

### 1.99-6.S3 — new workspace wiring + setting (ChatViewProvider + config + presets + package.json) (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **450 PASS lines** (no new assertions this slice; S4 will add), 0 FAIL.
- **Acceptance checks:** (1) build exit 0 PASS; (2) smoke 450/450 PASS; (3) `src/chat/ChatViewProvider.ts` `#newWorkspace` block (L1091–1106) uses `extractNewWorkspaceTag` (L1096), `buildScaffoldPrompt` (L1098), `formatWorkspaceBlock` (L1099); gated on `settings.newWorkspaceEnabled && lastUser` (L1095, no toolExecutor); placed after `#usages` block (L1077–1090) and before `loadInstructions` (L1112); imports at L36–37 (`../context`) + L41 (`../workspaceScaffold`) PASS; (4) `src/config.ts:77` `newWorkspaceEnabled: c.get<boolean>("chat.newWorkspace.enabled", true)` PASS; (5) `src/presets.ts:104` `newWorkspaceEnabled: boolean` PASS; (6) `package.json` valid JSON, `llm.chat.newWorkspace.enabled` = `{type: "boolean", default: true}`; `llm.chat.usages.enabled` still present (regression guard) PASS; (7) scope: exactly coder PROGRESS.md, `package.json`, `src/chat/ChatViewProvider.ts`, `src/config.ts`, `src/presets.ts`; no `package-lock.json` drift PASS; (8) last commit `06430f7` (coder: 1.99-6.S2), no coder commit for S3 PASS.
- **Verdict:** **PASS** — all criteria met.

### 1.99-6.S2 — new workspace tag context (src/context.ts) (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **450 PASS lines** (446 prior + 4 new `ws-s2:`), 0 FAIL.
- **Acceptance checks:** (1) build exit 0 PASS; (2) smoke 450/450 PASS with 4 genuine `ws-s2:` assertions all passing (extract with type + folder; extract with default folder; null cases; formatWorkspaceBlock) PASS; (3) `src/context.ts` remains pure — imports only `./notebook`, `./usages`, `./workspaceScaffold` (new `listWorkspaceTypes` import); no `vscode` import PASS; (4) scope: exactly coder PROGRESS.md, `scripts/smoke-test.js`, `src/context.ts`; no `package-lock.json` drift PASS; (5) last commit `d405e15` (coder: 1.99-6.S1), no coder commit for S2 PASS.
- **Verdict:** **PASS** — all criteria met.

### 1.99-6.S1 — workspace scaffold templates (src/workspaceScaffold.ts) (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **446 PASS lines** (441 prior + 5 new `ws-s1:`), 0 FAIL.
- **Acceptance checks:** (1) build exit 0 PASS; (2) smoke 446/446 PASS; (3) 5 genuine `ws-s1:` assertions all passing (exports/4 templates/types list; template shape; extension template package.json+src/extension.ts; mcp-server src/server.ts tools/list+stdin; buildScaffoldPrompt content, unknown type → '', generic no npm install) PASS; (4) `src/workspaceScaffold.ts` pure module — zero real imports (grep hits only inside template-string contents) PASS; (5) scope: only `src/workspaceScaffold.ts` (new), `scripts/smoke-test.js`, coder PROGRESS.md modified; no package-lock drift PASS; (6) last commit f5df1af, no coder commit PASS.
- **Verdict:** **PASS** — all criteria met.

### 1.99-5.S4 — #usages tag wiring + setting (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **441 PASS lines** (439 prior + 2 new `usages-s4:`), 0 FAIL.
- **Acceptance checks:**
  - (1) Build exit 0. PASS
  - (2) Smoke test exit 0, `ALL SMOKE TESTS PASSED`, 441 `PASS:` lines, 0 FAIL. PASS
  - (3) New `// 24) Usages tag wiring (1.99-5.S4)` section (smoke-test.js:3327) has 2 genuine `usages-s4:` static-source assertions: (a) `out/chat/ChatViewProvider.js` includes `extractUsagesTag` AND `findUsagesPublic(`; (b) `out/config.js` includes `"chat.usages.enabled"`. PASS
  - (4) Source: `src/config.ts:76` `usagesEnabled` after `fetchEnabled`; `src/presets.ts:102` `usagesEnabled: boolean`; `package.json:250` `llm.chat.usages.enabled` (boolean, default true); `src/tools/ToolExecutor.ts:1223` public `findUsagesPublic` wrapper; `src/chat/ChatViewProvider.ts` `#usages` block (L1070–1084) after `#fetch`, gated on `settings.usagesEnabled && lastUser && this.toolExecutor`. PASS
  - (5) Scope: exactly 7 files (coder PROGRESS, package.json, smoke-test.js, ChatViewProvider, config, presets, ToolExecutor). `package-lock.json` untouched. PASS
  - (6) `git log --oneline -1` → `84ecb31` (feat(llm): usages tool — extractUsagesTag + formatUsagesTagBlock (1.99-5.S3)). No coder commit. PASS
- **Verdict:** **PASS** — all 6 criteria met. **Item 1.99-5 (Usages tool `#usages`) fully verified (S1–S4).**

### 1.99-5.S3 — usages tag context (src/context.ts) (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **439 PASS lines** (435 prior + 4 new `usages-s3:`), 0 FAIL.
- **Acceptance checks:**
  - (1) Build exit 0. PASS
  - (2) Smoke test exit 0, `ALL SMOKE TESTS PASSED`, 439 `PASS:` lines, 0 FAIL. PASS
  - (3) New `// 23) Usages tag context (1.99-5.S3)` section (smoke-test.js:3295, diff +32/−0) has 4 genuine `usages-s3:` assertions vs `out/context.js`: (a) `extractUsagesTag("explain #usages myFunc please") === "myFunc"`; (b) `null` for `"no tag"` / `"end #usages"` (bare) / `"#usagesfoo x"` (no space); (c) `formatUsagesTagBlock("f","body")` starts with `` Usages for `f`: ``, includes `body`, `("f","   ") === ""`; (d) 25,000-char body → `length <= 20050` + `endsWith("(truncated)")`. PASS
  - (4) Source: `git diff src/context.ts` = 2 hunks, +48/−0, purely additive — `import { USAGES_BLOCK_MAX_CHARS } from "./usages";` + `extractUsagesTag` (regex `/#usages(?!\w)\s+([A-Za-z_$][A-Za-z0-9_$]*)/i`, returns `m[1].trim()` or `null`) + `formatUsagesTagBlock` (whitespace-only → `""`, truncates to `USAGES_BLOCK_MAX_CHARS` + `… (truncated)` — same pattern as `formatFetchBlock`). File remains pure (no `vscode` import; only pre-existing comment mentions). PASS
  - (5) Scope: `git status --short | grep -v ninfer` → exactly ` M .github/agents/coder/PROGRESS.md`, ` M scripts/smoke-test.js`, ` M src/context.ts`. `package-lock.json` untouched. PASS
  - (6) `git log --oneline -1` → `8539470` (feat(llm): usages tool — find_usages tool schema + executor (1.99-5.S2)). No coder commit. PASS
- **Verdict:** **PASS** — all 6 criteria met.

### 1.99-5.S2 — find_usages tool schema + executor (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **435 PASS lines** (430 prior + 5 new `usages-s2:`), 0 FAIL.
- **Acceptance checks:**
  - (1) Build exit 0. PASS
  - (2) Smoke test exit 0, `ALL SMOKE TESTS PASSED`, 435 `PASS:` lines, 0 FAIL. PASS
  - (3) New `// 22) Usages tool schema + executor (1.99-5.S2)` section (smoke-test.js:3211) has 5 genuine `usages-s2:` assertions: (a) `byName.find_usages` exists, `required` deep-equals `["symbol"]`, `isMutatingTool("find_usages") === false`; (b) temp-dir fixture → real `execute({name:"find_usages", arguments:{symbol:"foo"}})` content includes `def:`, `a.ts`, `b.ts`, `3 reference(s)`, `2 file(s)`, excludes `foobar`; (c) empty symbol → `content.startsWith("Error")`; (d) `buildRequestBody` `toolsEnabled: true` → `body.tools.length === 14` incl. `find_usages`; (e) unknown symbol → `includes("No usages found")`. PASS
  - (4) Count guards: `grep '=== 13\|length === 13' scripts/smoke-test.js` → zero matches; joined-names list (L477) ends `...,think,fetch_url,find_usages`. PASS
  - (5) Source: `git diff src/tools.ts` = 1 hunk +27/−0 — `find_usages` appended after `fetch_url`, `required: ["symbol"]`, optional `path`; `isMutatingTool` unchanged. `git diff src/tools/ToolExecutor.ts` = 3 hunks, +106/−0, purely additive: `../usages` imports, `case "find_usages":` before `default:`, private `findUsages` (empty-symbol guard, `resolveSafe` guard, try/catch around `buildUsagesRegex`, match cap 200, first match `isDefinition: true`, zero matches → `No usages found for <symbol>`, outer try/catch — never throws). PASS
  - (6) Scope: `git status --short | grep -v ninfer` → exactly ` M .github/agents/coder/PROGRESS.md`, ` M scripts/smoke-test.js`, ` M src/tools.ts`, ` M src/tools/ToolExecutor.ts`. `package-lock.json` untouched. PASS
  - (7) `git log --oneline -1` → `2c84ea8` (feat(llm): usages tool — pure usages helpers (1.99-5.S1)). No coder commit. PASS
- **Verdict:** **PASS** — all 7 criteria met.

### 1.99-5.S1 — pure usages helpers (src/usages.ts) (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **430 PASS lines** (426 prior + 4 new `usages-s1:`), 0 FAIL.
- **Acceptance checks:**
  - (1) Build exit 0. PASS
  - (2) Smoke test exit 0, `ALL SMOKE TESTS PASSED`, 430 `PASS:` lines, 0 FAIL. PASS
  - (3) New `// 21) Usages helpers (1.99-5.S1)` section (smoke-test.js:3157, diff +54/−0) requires `out/usages.js` with 4 genuine `usages-s1:` assertions: (a) exports present incl. `USAGES_BLOCK_MAX_CHARS === 20000`; (b) `buildUsagesRegex("foo")` matches `foo()`/`x = foo`, rejects `foobar`/`foo_bar`, empty throws; (c) `formatUsagesBlock("foo", []) === ""` + 2-match/2-file block has header `Usages for \`foo\`: 2 reference(s) in 2 file(s)`, `def:`, both file names; (d) 2×13k-char matches → length ≤ 20050 + ends with `(truncated)`. PASS
  - (4) Source: `src/usages.ts` is a new pure module — no `vscode` import, no `fs`/`path`/`child_process`; `buildUsagesRegex` escapes symbol + lookaround boundaries, throws on empty/whitespace; `formatUsagesBlock` has `MAX_MATCHES_PER_FILE = 5` with `… and K more in <file>` and truncation to `USAGES_BLOCK_MAX_CHARS` + `… (truncated)`. PASS
  - (5) Scope: `git status --short | grep -v ninfer` → exactly ` M .github/agents/coder/PROGRESS.md`, ` M scripts/smoke-test.js`, `?? src/usages.ts`. `package-lock.json` untouched. PASS
  - (6) `git log --oneline -1` → `169b392` (chore(llm): record 1.99-5 plan (4 slices) — Usages tool (#usages)). No coder commit. PASS
- **Verdict:** **PASS** — all 6 criteria met.

### 1.99-4.S4 — #fetch tag wiring + llm.chat.fetch.enabled setting (FINAL) (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **426 PASS lines** (425 prior + 1 new `fetch-s4:`), 0 FAIL.
- **Acceptance checks:**
  - (1) Build exit 0. PASS
  - (2) Smoke test exit 0, `ALL SMOKE TESTS PASSED`, 426 `PASS:` lines, 0 FAIL. PASS
  - (3) New `// 20d) Fetch tag wiring (1.99-4.S4)` section (single diff hunk, +11/−0) has 1 genuine `fetch-s4:` static-source assertion vs `out/chat/ChatViewProvider.js`: contains `extractFetchTag` AND `fetchUrl(` (confirmed at compiled lines 955/957). PASS
  - (4) Source: `src/presets.ts` 1 hunk +2/−0 (`fetchEnabled: boolean` after `folderContextEnabled`); `src/config.ts` 1 hunk +1/−0 (`fetchEnabled: c.get<boolean>("chat.fetch.enabled", true)`); `src/chat/ChatViewProvider.ts` 2 hunks +19/−0 — `../context` import extended with `extractFetchTag`/`formatFetchBlock`, new `#fetch` block after the `#folder:` block (L1038), gated on `settings.fetchEnabled`, calls `this.toolExecutor.fetchUrl(...)`, uses `formatFetchBlock`, same `? + "\n\n" + :` append pattern; zero deletions. `package.json` 1 hunk +5/−0 — `llm.chat.fetch.enabled` (boolean, default `true`, description mentions `#fetch <url>`); valid JSON. PASS
  - (5) Scope: `git status --short | grep -v ninfer` → exactly the 6 in-scope files + coder PROGRESS.md. `package-lock.json` untouched. PASS
  - (6) `git log --oneline -1` → `03d6da3` (feat(llm): fetch tool — extractFetchTag + formatFetchBlock (1.99-4.S3)). No coder commit. PASS
  - (7) Planner memory: line 794 — `1.99-4.S4 — #fetch tag wiring + setting (FINAL) — Done (2026-10-22, PASS, 426 assertions)`. PASS
- **Verdict:** **PASS** — all 7 criteria met. **Item 1.99-4 (Fetch tool `#fetch`) fully verified (S1–S4).**

### 1.99-4.S3 — extractFetchTag + formatFetchBlock (src/context.ts) (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **425 PASS lines** (422 prior + 3 new `fetch-s3:`), 0 FAIL.
- **Acceptance checks:**
  - (1) Build exit 0. PASS
  - (2) Smoke test exit 0, `ALL SMOKE TESTS PASSED`, 425 `PASS:` lines, 0 FAIL. PASS
  - (3) New `// 20c) Fetch tag context (1.99-4.S3)` section (single diff hunk, +30/−0) has 3 genuine `fetch-s3:` assertions vs `out/context.js`: (a) `extractFetchTag("please read #fetch https://example.com/docs") === "https://example.com/docs"` + `null` for absent / bare-at-end / `#fetchfoo`; (b) `formatFetchBlock("https://x","body")` starts with `Fetched page: https://x` + contains `body`, whitespace-only → `""`; (c) 25,000-char body → `length <= 20050` + `endsWith("(truncated)")` + `FETCH_BLOCK_MAX_CHARS === 20000`. PASS
  - (4) Source: `git diff src/context.ts` = 1 hunk +52/−0, purely additive after `formatFolderBlock` (`#folder` section): `extractFetchTag` with regex `/#fetch(?!\w)\s+(\S+)/i`, `FETCH_BLOCK_MAX_CHARS = 20000`, `formatFetchBlock` with `""` for whitespace-only and `… (truncated)` suffix; no pre-existing code modified/deleted; no `vscode` import added (file remains pure). PASS
  - (5) Scope: `git status --short | grep -v ninfer` → exactly ` M .github/agents/coder/PROGRESS.md`, ` M scripts/smoke-test.js`, ` M src/context.ts`. `package-lock.json` untouched. PASS
  - (6) `git log --oneline -1` → `23e40d4` (feat(llm): fetch tool — fetch_url schema + executor case (1.99-4.S2)). No coder commit. PASS
- **Verdict:** **PASS** — all 6 criteria met.

### 1.99-4.S2 — fetch_url schema + executor case (src/tools.ts, src/tools/ToolExecutor.ts) (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **422 PASS lines** (419 prior + 3 new `fetch-s2:`), 0 FAIL.
- **Acceptance checks:**
  - (1) Build exit 0. PASS
  - (2) Smoke test exit 0, `ALL SMOKE TESTS PASSED`, 422 `PASS:` lines, 0 FAIL. PASS
  - (3) New `// 20b) Fetch tool schema + executor (1.99-4.S2)` section has 3 genuine `fetch-s2:` assertions: (a) `CODE_TOOLS.length === 13` + `fetch_url` `required` deep-equal `["url"]` + `properties.url.type === "string"` + `isMutatingTool("fetch_url") === false`; (b) real `ToolExecutor.execute({name:"fetch_url"})` call → cache hit (no network), `tool_call_id === "f1"`, content includes `"hi there"`; (c) `buildRequestBody` `toolsEnabled: true` → `body.tools.length === 13` incl. `fetch_url`. PASS
  - (4) Regression guards bumped 12 → 13 in exactly 5 places (CODE_TOOLS.length ~L474, joined-names list now ends `...,think,fetch_url` ~L477, `toolBody.tools.length` ~L598, `think-s1` ~L2909, `think-s3` ~L2970); no assertion logic weakened. PASS
  - (5) Source: `git diff src/tools.ts` = 1 hunk +26/−0 — `fetch_url` entry appended after `think`; `isMutatingTool` unchanged. `git diff src/tools/ToolExecutor.ts` = 3 hunks, +42/−0, purely additive: `fetchUrl` import from `../fetchTool`, `case "fetch_url":` before `default:`, new public `async fetchUrl(url, maxChars?)` wrapper + private `fetchUrlTool`; `countOccurrences` and all pre-existing code byte-identical (zero deletions — mid-edit hiccup left no trace). PASS
  - (6) Scope: `git status --short | grep -v ninfer` → exactly ` M .github/agents/coder/PROGRESS.md`, ` M scripts/smoke-test.js`, ` M src/tools.ts`, ` M src/tools/ToolExecutor.ts`. `package-lock.json` untouched. PASS
  - (7) `git log --oneline -1` → `e6017e9` (feat(llm): fetch tool — pure fetchTool module (1.99-4.S1)). No coder commit. PASS
- **Verdict:** **PASS** — all 6 criteria met.

### 1.99-4.S1 — pure fetchTool module (src/fetchTool.ts) (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **419 PASS lines** (411 prior + 8 new `fetch-s1:`), 0 FAIL.
- **Acceptance checks:**
  - (1) Build exit 0. PASS
  - (2) Smoke test exit 0, `ALL SMOKE TESTS PASSED`, 419 `PASS:` lines, 0 FAIL. PASS
  - (3) New `// 20) Fetch tool (1.99-4.S1)` section has 8 genuine `fetch-s1:` runtime assertions vs `out/fetchTool.js`: (a) exports are functions + `DEFAULT_MAX_CHARS === 20000`; (b) `htmlToText` full-HTML fixture === `"Title\nHello world"`; (c) entities `a&amp;b &lt;c&gt;` → `a&b <c>`; (d) injected `fetchFn` 200 `text/html` → body text, no tags, fetchFn called once; (e) second call with throwing `fetchFn` → cached text, `throwingCalls === 0`; (f) 404 → `startsWith("HTTP 404")`; (g) `"not a url"` + `"ftp://x"` → `Invalid URL`; (h) `maxChars: 10` → `(truncated` marker, bounded length, `clearFetchCache()` callable. PASS
  - (4) Source: `src/fetchTool.ts` is a new pure module — no `vscode` import; exports `htmlToText`/`fetchUrl`/`clearFetchCache`/`DEFAULT_MAX_CHARS`/`HARD_MAX_CHARS`/`CACHE_TTL_MS`/`CACHE_MAX_ENTRIES`/`type FetchFn`; never throws (all failure paths return `Invalid URL:` / `Fetch failed:` / `HTTP <status>` / `Response too large` strings); module-level `Map` cache with 10-min TTL + FIFO eviction (20 entries); `AbortSignal.timeout(15000)` used. PASS
  - (5) Scope: `git status --short | grep -v ninfer` → exactly ` M .github/agents/coder/PROGRESS.md`, ` M scripts/smoke-test.js`, `?? src/fetchTool.ts`; `package-lock.json` untouched. `git diff scripts/smoke-test.js` = 1 hunk, +75/−0 (purely additive; `fetch404` naming avoids collision with pre-existing `notFound` at line 741 — no existing assertion weakened). PASS
  - (6) `git log --oneline -1` → `62d0036` (chore(llm): record 1.99-4 plan (4 slices) — Fetch tool (#fetch)). No coder commit. PASS
- **Verdict:** **PASS** — all 6 criteria met.

### 1.99-3.S3 (FINAL) — request-body + loop verification (scripts/smoke-test.js only) (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **411 PASS lines** (407 prior + 4 new `think-s3:`), 0 FAIL.
- **Acceptance checks:**
  - (1) Build exit 0. PASS
  - (2) Smoke test exit 0, `ALL SMOKE TESTS PASSED`, 411 `PASS:` lines, 0 FAIL. PASS
  - (3) New `// 19c) Thinking tool wiring (1.99-3.S3)` section (single diff hunk, +34/−0) has 4 genuine `think-s3:` assertions: (a) real `buildRequestBody` call with `toolsEnabled: true` → `body.tools.length === 12`, `some(t => t.function.name === "think")`, `tool_choice === "auto"`; (b) `toolsEnabled: false` → `body.tools === undefined`; (c) static source on `out/chat/ChatViewProvider.js`: contains `isMutatingTool` AND `toolExecutor.execute(`; (d) static source: does NOT contain `name === "think"`. PASS
  - (4) Scope: `git status --short | grep -v ninfer` → exactly ` M .github/agents/coder/PROGRESS.md`, ` M scripts/smoke-test.js`. No source files changed; `package-lock.json` untouched. PASS
  - (5) `git log --oneline -1` → `469123c` (feat(llm): thinking tool — ToolExecutor think echo handler (1.99-3.S2)). No coder commit for S3. PASS
- **Verdict:** **PASS** — all 5 criteria met. **Item 1.99-3 (Thinking tool) fully verified (S1–S3).**

### 1.99-3.S2 — ToolExecutor think echo handler (src/tools/ToolExecutor.ts) (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **407 PASS lines** (404 prior + 3 new `think-s2:`), 0 FAIL.
- **Acceptance checks:**
  - (1) Build exit 0. PASS
  - (2) Smoke test exit 0, `ALL SMOKE TESTS PASSED`, 407 `PASS:` lines, 0 FAIL. PASS
  - (3) New `// 19b) Thinking tool executor (1.99-3.S2)` section has 3 genuine `think-s2:` runtime assertions against `out/tools/ToolExecutor.js`: (a) `execute({id:"t1", thought:"plan step 1"})` → `tool_call_id === "t1"` && `content === "Thought recorded: plan step 1"`; (b) empty thought → `content === "Thought recorded."`; (c) `arguments: "{not json"` → `content.startsWith("Invalid JSON arguments")`, never throws. PASS
  - (4) Source: `git diff src/tools/ToolExecutor.ts` = exactly 2 hunks — `case "think": return this.think(call, String(args.thought ?? ""));` before `default:` in `execute`'s switch, and new `private think(call, thought)` method (empty/whitespace → `"Thought recorded."`, else `"Thought recorded: " + thought`). No other switch cases or methods changed. PASS
  - (5) Scope: `git status --short | grep -v ninfer` → exactly ` M .github/agents/coder/PROGRESS.md`, ` M scripts/smoke-test.js`, ` M src/tools/ToolExecutor.ts`. `package-lock.json` untouched. PASS
  - (6) `git log --oneline -1` → `576adfe` (feat(llm): thinking tool — think schema in CODE_TOOLS (1.99-3.S1)). No coder commit for S2. PASS
- **Verdict:** **PASS** — all 6 criteria met.

### 1.99-3.S1 — `think` tool schema in `CODE_TOOLS` (src/tools.ts) (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **404 PASS lines** (401 prior + 3 new `think-s1:`), 0 FAIL.
- **Acceptance checks:**
  - (1) Build exit 0. PASS
  - (2) Smoke test exit 0, `ALL SMOKE TESTS PASSED`, 404 `PASS:` lines. PASS
  - (3) New `// 19) Thinking tool (1.99-3.S1)` section has 3 genuine `think-s1:` assertions (runtime vs `out/tools.js`): (a) `CODE_TOOLS.length === 12` + `think` `required` deep-equal `["thought"]` + `properties.thought.type === "string"`; (b) `isMutatingTool("think") === false` && `isMutatingTool("write_file") === true`; (c) `think` shape `type === "function"`, `name === "think"`. PASS
  - (4) Source: `git diff src/tools.ts` = exactly 1 hunk +21/-0 — `think` entry appended after `notebook_edit` with exact description/parameters; `isMutatingTool` unchanged. PASS
  - (5) Regression guards: `git diff scripts/smoke-test.js` = 3 hunks — `CODE_TOOLS.length === 11` → `12` + label; tool-names-in-order list ends `...,notebook_edit,think`; `toolBody.tools.length === 11` → `12`. No other assertions weakened. PASS
  - (6) Scope: `git status --short | grep -v ninfer` → exactly ` M scripts/smoke-test.js`, ` M src/tools.ts`. `package-lock.json` untouched. PASS
  - (7) `git log --oneline -1` → `de1a302` (1.99-3 plan). No coder commit for S1. PASS
- **Verdict:** **PASS** — all 7 criteria met.

### 1.99-2.S6 (FINAL) — MCP commands + manifest (extension.ts, package.json, mcpManager.ts accessor) (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **401 PASS lines** (397 prior + 4 new `mcp-s6:`), 0 FAIL.
- **Acceptance checks:**
  - (1) Build exit 0. PASS
  - (2) Smoke test exit 0, `ALL SMOKE TESTS PASSED`, 401 `PASS:` lines. PASS
  - (3) `// 18f) MCP commands + manifest (1.99-2.S6)` section has 4 `mcp-s6:` assertions: exact command titles, both `onCommand:` activation events, `llm.mcp.servers` object/`{}` default, 7-command regression guard. PASS
  - (4) Source: `llm.mcp.addServer` 3-step InputBox (name non-empty + no `__`, command non-empty, optional space-separated args) → `ConfigurationTarget.Workspace` write + info message; `llm.mcp.listServers` QuickPick (label=name, description=status, detail=tool count/error) → `await manager.refresh(name)` → error/empty handled, second QuickPick of tools; `deactivate()` calls `mcpManager?.dispose()` (module-level manager); `src/mcpManager.ts` diff = only `McpTool` import + read-only `getServerTools(name)` (live client tools when running, else `[]`); `package.json` valid JSON, +2 commands, +2 activation events, +1 setting. PASS
  - (5) Scope: `git status --short | grep -v ninfer` → exactly ` M package.json`, ` M scripts/smoke-test.js`, ` M src/extension.ts`, ` M src/mcpManager.ts`. `package-lock.json` untouched. PASS
  - (6) `git log --oneline -1` → `9783237` (1.99-2.S5). No coder commit for S6. PASS
- **Verdict:** **PASS** — all 6 criteria met. **Item 1.99-2 (MCP server support) fully verified (S1–S6).**

### 1.99-2.S5 — wire MCP into the chat tool loop (ChatViewProvider + extension glue) (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **397 PASS lines** (394 prior + 3 new `mcp-s5:`), 0 FAIL.
- **Acceptance checks:**
  - (1) Build exit 0. PASS
  - (2) Smoke test exit 0, `ALL SMOKE TESTS PASSED`, 397 `PASS:` lines. PASS
  - (3) New `// 18e) MCP chat wiring (1.99-2.S5)` section has 3 `mcp-s5:` static-source assertions on `out/chat/ChatViewProvider.js`: (a) `isMcpToolName` + `setServers`; (b) `mcpTools:` count ≥ 2 (found 2); (c) `mcpManager.execute(` + `mcpManager.dispose()`. Static approach justified (ChatViewProvider.js imports vscode). PASS
  - (4) Source: `mcpManager` field + 3rd constructor param; `setServers(settings.mcpServers)` at top of `runStream`; both `buildRequestBody` sites pass `mcpTools: this.mcpManager.getTools()`; `isMutating` ORs `isMcpToolName(...)` (approval_request path unchanged); MCP routing with invalid-JSON guard resolving `Error: invalid tool arguments: ...` (never throws), result wrapped `{ tool_call_id: call.id, content }`; non-MCP → `toolExecutor.execute(call)`; `dispose()` calls `mcpManager.dispose()`; `extension.ts` creates ONE shared `McpManager` (notify via `showErrorMessage`) passed to provider; no new commands, no package.json change. PASS
  - (5) Scope: `git status --short | grep -v ninfer` → exactly ` M scripts/smoke-test.js`, ` M src/chat/ChatViewProvider.ts`, ` M src/extension.ts`. `package-lock.json` untouched. PASS
  - (6) `git log --oneline -1` → `ffee7e4` (1.99-2.S4). No coder commit for S5. PASS
- **Verdict:** **PASS** — all 6 criteria met.

### 1.99-2.S4 — extra tools in request body (`src/request.ts`) (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **394 PASS lines** (391 prior + 3 new `mcp-s4:`), 0 FAIL.
- **Acceptance checks:**
  - (1) Build exit 0. PASS
  - (2) Smoke test exit 0, `ALL SMOKE TESTS PASSED`, 394 `PASS:` lines (391 + 3 `mcp-s4:`). PASS
  - (3) New `// 18d) MCP tools in request body (1.99-2.S4)` section (smoke-test.js lines 2792-2833) has 3 genuine `mcp-s4:` assertions calling `buildRequestBody` from `out/request.js` (required at line 9): (a) `toolsEnabled: true` + `mcpTools: [oneMcpTool]` → `body.tools.length === CODE_TOOLS.length + 1`, last tool name `mcp__srv__tool`, `tool_choice === "auto"`; (b) `toolsEnabled: true` without `mcpTools` → `JSON.stringify(body.tools) === JSON.stringify(CODE_TOOLS)` (deep-equal regression guard); (c) `toolsEnabled: false` + `mcpTools` → `body.tools === undefined`. Non-tautological (real function calls, distinct inputs). PASS
  - (4) Source: `src/request.ts` line 60 `mcpTools?: Tool[];` on `RequestConfig`; lines 277-281: `if (settings.toolsEnabled) { body.tools = mcpTools && mcpTools.length > 0 ? [...CODE_TOOLS, ...mcpTools] : CODE_TOOLS; body.tool_choice = "auto"; }` — exact match. PASS
  - (5) Scope: `git status --short | grep -v ninfer` → exactly ` M scripts/smoke-test.js`, ` M src/request.ts`. `package-lock.json` untouched. PASS
  - (6) `git log --oneline -1` → `851b1b2` (feat(llm): MCP server support — McpManager lazy lifecycle + registry (1.99-2.S3)). No coder commit for S4. PASS
- **Verdict:** **PASS** — all 6 criteria met.

### 1.99-2.S3 — `src/mcpManager.ts`: McpManager lazy lifecycle + registry (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **391 PASS lines** (387 prior + 4 new `mcp-s3:`), 0 FAIL. Wall-clock **0.235 s** (`time`).
- **Acceptance checks:**
  - (1) Build exit 0. PASS
  - (2) Smoke test exit 0, `ALL SMOKE TESTS PASSED`, 391 `PASS:` lines. PASS
  - (3) New `// 18c) MCP manager (1.99-2.S3)` section (smoke-test.js lines 2759-2795) has 4 genuine `mcp-s3:` assertions: (a) fresh manager — `getTools()` empty + `listServers()` exactly `[{name:"a",status:"stopped",toolCount:0}]` (JSON equality, non-trivial); (b) `execute("mcp__a__x")` on `{command:"node",args:["-e","process.exit(1)"]}` RESOLVES with `content` starting `Error:` and containing server name — uses real binary exiting non-zero because `McpClient` lacks a spawn `error` handler (documented in section NOTE); (c) `execute("not_an_mcp_name")` → content includes `not an MCP tool name`; (d) `setServers({})` → `listServers().length === 0`. Section completes fast (whole suite 0.235 s ≪ 30 s). PASS
  - (4) Purity: `grep -n vscode src/mcpManager.ts` → only line 3 (comment). No `vscode` import. PASS
  - (5) Contract (source read): `execute()` body fully wrapped in try/catch; every path returns `{ content: "Error: ..." }` (bad name, unknown server, start failure, outer catch) — never throws/rejects. `listServers()` is a pure map over `this.servers` + `statusFor` (no spawn). `dispose()` clears all maps + `servers = {}` — idempotent. PASS
  - (6) Scope: `git status --short | grep -v ninfer` → exactly ` M scripts/smoke-test.js`, `?? src/mcpManager.ts`. `package-lock.json` untouched. PASS
  - (7) `git log --oneline -1` → `94a7965` (feat(llm): MCP server support — settings plumbing (1.99-2.S2)). No coder commit for S3. PASS
- **Verdict:** **PASS** — all 7 criteria met.



### 1.99-2.S2 — MCP settings plumbing (`mcpServers` in `LlmSettings` + `readSettings()`) (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, exit 0, **387 PASS lines** (385 prior + 2 new `mcp-s2:`).
- **Acceptance checks:**
  - (1) Build exit 0. PASS
  - (2) Smoke test exit 0, `ALL SMOKE TESTS PASSED`, 387 `PASS:` lines. PASS
  - (3) New `// 18b) MCP settings plumbing (1.99-2.S2)` section (smoke-test.js lines 2739-2754) has 2 `mcp-s2:` assertions: (a) `out/presets.js` loads and `parseMcpServers` reachable via `out/mcp.js` (runtime require — valid since presets/mcp are vscode-free); (b) static source assertion that `src/config.ts` contains `parseMcpServers` and `"mcp.servers"` (accepted approach since `out/config.js` requires `vscode` at load time). Both non-trivial. PASS
  - (4) `src/presets.ts` has NO `vscode` import — only import is `import type { McpServerConfig } from "./mcp";` (line 8, type-only). `vscode` appears only in comments. PASS
  - (5) `src/presets.ts` line 102: `mcpServers: Record<string, McpServerConfig>;` in `LlmSettings`; `src/config.ts` line 76: `mcpServers: parseMcpServers(c.get<unknown>("mcp.servers", {}))`. PASS
  - (6) `git status --short | grep -v ninfer` → exactly ` M scripts/smoke-test.js`, ` M src/config.ts`, ` M src/presets.ts`. `package-lock.json` untouched. PASS
  - (7) `git log --oneline -1` → `c8222cb` (feat(llm): MCP server support — pure JSON-RPC client + tool mapping (1.99-2.S1)). No coder commit for S2. PASS
- **Verdict:** **PASS** — all 7 criteria met.

## Verification commands

- **Compile:** `npm run compile` (must exit 0, no errors)
- **Smoke test:** `node scripts/smoke-test.js` (must pass all assertions)
- **Lint (optional):** `npm run lint`

## Verifications

### 1.98-1.S1 — webview `command_approval` card (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED (13 assertions shown in tail; full suite green).
- **Static checks in `src/chat/webview.ts`:**
  - (a) `case 'command_approval':` present in host-message handler (line 1977). PASS
  - (b) textarea value set via `cmdInput.value = msg.command || ''` (line 1990); card HTML string contains an empty `<textarea class="cmd-input">` — command NOT interpolated into innerHTML. PASS
  - (c) `vscode.postMessage({ type: 'commandApproval', id: msg.id, approved: approved, command: cmdInput.value })` (line 2003) — includes `id`, `approved`, `command`. PASS
  - (d) keydown handler: `if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); decideCmd(true); }` (lines 2007-2012). PASS
  - (e) double-decide guard: `var decided = false;` + `if (decided) { return; } decided = true;` in `decideCmd` (lines 1994-1997). PASS
  - (f) CSS rules present: `.message.command-approval .cmd-input` (line 327), `.cmd-run` (line 348), `.cmd-cancel` (line 352), plus `.status`. PASS
- **Scope check:** `git status --short` / `git diff --stat` → only `src/chat/webview.ts` (+83) among source files; also `.github/agents/coder/PROGRESS.md` and `.github/agents/planner/PROGRESS.md` (memory updates, expected). `ninfer` shows a submodule dirty marker (`m`), not a source-file change. PASS
- **Note:** host-side `commandApproval` handling intentionally absent (slice S2) — expected, not a failure.


### 1.98-1.S2 — host-side `commandApproval` plumbing (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED (23 assertions in tail; full suite green).
- **Static checks in `src/chat/ChatViewProvider.ts`:**
  - (a) `private pendingCommandApproval: ((approved: boolean, command: string) => void) | null = null;` present next to `pendingApproval`. PASS
  - (b) `case "commandApproval":` in `onMessage` switch calls `this.pendingCommandApproval?.(msg.approved === true, String(msg.command ?? ""))`. PASS
  - (c) `waitForCommandApproval(signal: AbortSignal): Promise<{ approved: boolean; command: string }>` present: resolves `{approved:false, command:""}` when already aborted; abort listener (`{ once: true }`) resolves `{approved:false, command:""}` and clears `pendingCommandApproval`; normal resolver removes the abort listener and clears `pendingCommandApproval` before resolving. PASS
  - (d) `git diff src/chat/ChatViewProvider.ts` → 3 hunks, additions only (+37 lines, 0 deletions); existing `waitForApproval` / `toolApproval` logic untouched. PASS
- **Scope check:** `git status --short` / `git diff --stat` → only `src/chat/ChatViewProvider.ts` (+37) among source files; also `.github/agents/coder/PROGRESS.md` (memory update, expected) and `ninfer` submodule dirty marker (not a source change). PASS
- **Note:** behaviorally a no-op by design — nothing posts `command_approval` yet (that is slice S3). Expected, not a failure.

### 1.98-1.S3 — host: route `run_command` through editable approval gate (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED (full suite green).
- **Static checks in `src/chat/ChatViewProvider.ts`:**
  - (a) `if (call.function.name === "run_command")` branch exists inside `settings.requireApproval && isMutating` block. PASS
  - (b) `command_approval` postMessage includes `id: call.id`, `tool: "run_command"`, `command`. PASS
  - (c) `await this.waitForCommandApproval(signal)` present in `run_command` path. PASS
  - (d) Rejection path pushes "User rejected…" `toolResultMessage` and `continue`s. PASS
  - (e) On approval with non-empty edited command differing from original: `call.function.arguments = JSON.stringify({...parsed, command: edited})` and `commandModified = true`. PASS
  - (f) Empty edited command (`edited.trim() === ""`) does NOT modify arguments (guarded by `edited.trim() !== ""`). PASS
  - (g) After `toolExecutor.execute`, if `commandModified`: model-facing content prefixed with `"Note: the user modified the command before running it.\n"`; `tool_result` postMessage gains `modified: true`. PASS
  - (h) `git diff` confirms old `approval_request`/`waitForApproval` logic moved verbatim into `else` branch (unchanged for `write_file`/`edit_file`). PASS
  - (i) When `requireApproval` is false, the entire `if (settings.requireApproval && isMutating)` block is skipped — no `command_approval` post, no `waitForCommandApproval` call. PASS
- **Scope check:** `git status --short` / `git diff --stat` → only `src/chat/ChatViewProvider.ts` (+81/-21) among source files; also `.github/agents/coder/PROGRESS.md` (memory update, expected) and `ninfer` submodule dirty marker (not a source change). PASS


### 1.98-1.S4 — webview "modified by user" badge on tool card (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED (full suite green; tail showed 13 PASS lines ending in diffStats).
- **Static checks in `src/chat/webview.ts` (via `git diff`):**
  - (a) `if (msg.modified === true)` present in BOTH the found-card branch (appends badge to `details.querySelector('summary')`) and the fallback-card branch (appends badge to `tcSummary` after `tcName`). PASS
  - (b) Badge element: `badge.className = 'tool-modified'`, `badge.textContent = 'modified by user'` (and `tcBadge` equivalents). PASS
  - (c) CSS rule `.tool-modified { font-size: 10px; font-weight: 600; color: var(--vscode-descriptionForeground, #9d9d9d); }` added in the existing style block. PASS
  - (d) `git diff src/chat/webview.ts` → exactly 3 hunks, all additions (+17/-0): CSS rule + 2 badge blocks. No other behavior in the `tool_result` handler changed. PASS
- **Scope check:** `git status --short` / `git diff --stat` → only `src/chat/webview.ts` (+17) among source files; also `.github/agents/coder/PROGRESS.md` (memory update, expected) and `ninfer` submodule dirty marker (not a source change). PASS

### 1.98-2.S1 — `notebook_edit` tool schema + mutating flag (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED (exit 0). New assertions confirmed in output: `tools: CODE_TOOLS has 11 tools`, `tools: tool names in order` (ends `...,manage_todos,notebook_edit`), `tools: notebook_edit required=[path,action]`, `tools: notebook_edit action enum has 5 values`, `approval: notebook_edit is mutating`.
- **Static checks in `src/tools.ts` (via `git diff`):**
  - (a) `notebook_edit` appended to `CODE_TOOLS` after `manage_todos` (now 11 tools); `required: ["path", "action"]`; `action` enum exactly 5 values: create, modify_cell, insert_cell, delete_cell, change_cell_type; `path` string, `cell_index` number, `cell_type` enum code|markdown, `source` string. PASS
  - (b) `isMutatingTool` extended: `name === "notebook_edit"` added to the OR chain (existing three tools unchanged). PASS
  - (c) `git diff src/tools.ts` → exactly 2 hunks, additions only (+58/-1): new tool entry + `isMutatingTool` extension. No other tool schemas touched. PASS
- **Scope check:** `git status --short` / `git diff --stat` → only `src/tools.ts` (+58/-1) and `scripts/smoke-test.js` (+17/-4) among source files; also `.github/agents/coder/PROGRESS.md` (memory update, expected) and `ninfer` submodule dirty marker (not a source change). PASS
- **Smoke-test diff note:** pre-existing hardcoded `toolBody.tools.length === 10` correctly updated to `11`; tool-name order assertion extended with `notebook_edit`.


### 1.98-9.S2 — `ToolExecutor.collectDiagnostics` shared helper (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **284 assertions** (280 prior + 4 new `problems-s2:` in subsection 13b).
- **Static checks in `src/tools/ToolExecutor.ts` (via `git diff`):**
  - (a) `public async collectDiagnostics(relPath?: string): Promise<string>` present; extracted body keeps the same workspace-folder guard string, path-safety string, per-file format (`rel:` header + `  sev line:col — message [source]`), and empty-result strings ("No diagnostics in open files (clean)." / "No diagnostics in <relPath> (clean)."). PASS
  - (b) New 50-problem cap: `shown` counter, `continue`/`break` at 50, suffix `… (showing first 50 of ${total})` appended only when `total > 50`. PASS
  - (c) `getDiagnostics` is now a thin async wrapper (`const text = await this.collectDiagnostics(relPath); return this.result(call, text);`); `case "get_diagnostics":` in `execute()` intact and still calls it. PASS
  - (d) Diff is a pure extraction: single logical change, old body re-added as `collectDiagnostics` modulo `this.result(call, X)` → `return X` and the cap logic. No other tool/method touched. PASS
- **Scope check:** `git status --short` → only `src/tools/ToolExecutor.ts` (+38/-14), `scripts/smoke-test.js` (+19), `.github/agents/coder/PROGRESS.md`; `ninfer` submodule dirty marker (not a source change). PASS
- **New smoke assertions (4, subsection 13b):** genuine source-content checks on `toolExecSrc` — `collectDiagnostics(` present, occurrence count ≥ 2 (definition + call site), `getDiagnostics` still present, `showing first 50` cap note present. Not tautologies. PASS

### 1.98-9.S3 — `problemsEnabled` field + `#problems` wiring (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED (**290 assertions**; 6 new `problems-s3:` green in subsection `// 13c) problems tag (1.98-9.S3)`).
- `src/presets.ts`: `LlmSettings` gains `problemsEnabled: boolean;` (single additive line + doc comment). PASS
- `src/config.ts`: `readSettings()` returns `problemsEnabled: c.get<boolean>("chat.problems.enabled", true)` (single additive line). PASS
- `src/chat/ChatViewProvider.ts` (git diff = 2 hunks, +31/-0): (a) `extractProblemsTag` + `formatProblemsBlock` added to the `../context` import. (b) In `runStream`, immediately after the `#codebase` block and before `composeSystemPrompt`: gated on `settings.problemsEnabled && lastUser && this.toolExecutor`; `extractProblemsTag(lastUser.content)` → `await this.toolExecutor.collectDiagnostics(p || undefined)`; qualifier fallback — if `p` non-empty and text starts with `"Path not allowed"`, re-call `collectDiagnostics()` with no arg and reset scope to default; `formatProblemsBlock({ text: problemsText }, problemsScope)`; non-empty block appended to `finalContextBlock` with the same `\n\n` join pattern as `#codebase`. (c) `#codebase` wiring and all other methods untouched (diff review). (d) `composeSystemPrompt` still receives `finalContextBlock`. All PASS.
- 6 new smoke assertions genuine: source-content checks on `chatViewSrc` (`extractProblemsTag`, `formatProblemsBlock`, `collectDiagnostics(`, `problemsEnabled`), `configSrc` (`chat.problems.enabled`), `presetsSrc` (`problemsEnabled`). Not tautologies. PASS
- Scope: only `src/chat/ChatViewProvider.ts`, `src/config.ts`, `src/presets.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md` (+ ninfer submodule marker). PASS

### 1.98-9.S4 — `package.json`: `llm.chat.problems.enabled` + final smoke assertions (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED (**294 assertions**; 4 new `problems-s4:` green in subsection `// 13d) problems tag (1.98-9.S4)`).
- `package.json`: valid JSON; single additive hunk (+5/-0) adding `llm.chat.problems.enabled` (`type: "boolean"`, `default: true`, description mentions `#problems` and the `#problems <path>` qualifier). Existing `llm.chat.codebaseSearch.enabled` entry untouched (context lines only in diff). PASS
- 4 new smoke assertions genuine: parsed-JSON checks on `pkg.contributes.configuration.properties["llm.chat.problems.enabled"]` — entry exists, `type === "boolean"`, `default === true`, non-empty description containing `#problems`. Not tautologies. PASS
- Scope: `git status --short` → only `package.json`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md`, `.github/agents/planner/PROGRESS.md` (+ ninfer submodule marker). PASS
- Planner PROGRESS.md: 1.98-9 marked **Done** (S1–S4 complete); Next step → 1.98-10 (`#folder:` tag). PASS
- **Item 1.98-9 fully verified (S1–S4 all PASS).**

### 1.98-10.S1 — `src/context.ts`: `extractFolderTag` + `formatFolderBlock` + `FOLDER_BLOCK_MAX_CHARS` (pure) (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED (**306 assertions**; 12 new `folder-s1:` green in subsection `// 14a) folder tag (1.98-10.S1)`).
- `src/context.ts` (pure — no `vscode` import added; grep matches only comments): (a) `extractFolderTag(text): string | null` uses the approved corrected alternation `/#folder(?::(\S*)|[ \t]+(\S*)|(?=\n|$))/i` returning `(m[1] ?? m[2] ?? "").trim()` (the plan's literal lookahead regex was broken for the space form — KNOWN approved deviation). (b) `FolderBlockData { tree: string; notFound?: boolean; }`. (c) `FOLDER_BLOCK_MAX_CHARS = 8000`. (d) `formatFolderBlock(data, folder?)` — header `Folder: <name>` / `Folder: (workspace root)` when empty/absent; body `(folder not found: <name>)` when `notFound` else `data.tree || "(empty folder)"`; truncation at 8,000 + `… (truncated)`; never returns `""`. All PASS.
- Behavior contract verified at runtime against compiled `out/context.js` via `node -e`: `#folder:src`→`"src"`, `#folder src`→`"src"`, bare `#folder`→`""`, absent→`null`, `#folderfoo`→`null`, `#Folder:src`→`"src"` (case-insensitive), `#folder:src\nline2`→`"src"` (same-line), first-occurrence-only, `#folder:src more`→`"src"` (stops at whitespace), `#folder:`→`""`. All PASS.
- `git diff src/context.ts` = single additive hunk (+69/-0) appended after `formatProblemsBlock`; `#codebase`/`#problems` sections untouched. PASS
- 12 new smoke assertions genuine: concrete-input behavior checks on the real compiled `extractFolderTag`/`formatFolderBlock`/`FOLDER_BLOCK_MAX_CHARS`. Not tautologies. PASS
- Scope: `git status --short` → only `src/context.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md` (+ ninfer submodule marker). PASS

### 1.98-10.S2 — `ToolExecutor.folderSweep(folderName)` (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **310 assertions** (306 prior + 4 new `folder-s2:` in subsection 14b).
- **Static checks in `src/tools/ToolExecutor.ts` (via `git diff`):**
  - (a) `public async folderSweep(folderName: string): Promise<string>` present immediately after `codebaseSweep`. PASS
  - (b) Guard chain: `resolveSafe(".")` null → notFound block with `folderName || "(workspace root)"`; empty `folderName` → `target = rootAbs`; non-empty → `resolveSafe(folderName)`, null → notFound; `fs.promises.stat` catch → notFound; `!stat.isDirectory()` → notFound. PASS
  - (c) Walk mirrors `codebaseSweep` inner walk verbatim: depth ≤ 3, cap 100, `SKIP_DIRS` skip, `"  ".repeat(depth - 1)` indent, `… (truncated at 100 entries)` suffix; file tree only (no git/search). PASS
  - (d) Returns `formatFolderBlock({ tree: structure }, folderName)`; `formatFolderBlock` imported from `../context` (line 17). PASS
  - (e) `git diff` → exactly 2 hunks (import + new method, +71/−1); `codebaseSweep`, `collectDiagnostics`, `searchMatches`, `resolveSafe` untouched. PASS
- **Scope check:** `git status --short` → only `src/tools/ToolExecutor.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md` (+ `ninfer` submodule marker, ignored). PASS
- **Behavior spot-check:** `node -e` against `out/context.js` — `formatFolderBlock({tree:"",notFound:true},"nope")` → `"Folder: nope\n(folder not found: nope)"`; empty name → `Folder: (workspace root)` header. fs-dependent path verified by static review. PASS

### 1.98-10.S3 — `folderContextEnabled` field + `#folder:` chat wiring (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **315 assertions** (310 prior + 5 new `folder-s3:` in subsection 14c; 0 FAIL).
- **Wiring in `src/chat/ChatViewProvider.ts` (via `git diff` — exactly 2 hunks, +18/−0):**
  - (a) `extractFolderTag` added to the `../context` import (line 30). PASS
  - (b) In `runStream`, the `#folder:` block sits immediately after the `#problems` block (line 982) and before `composeSystemPrompt` (line 998). PASS
  - (c) Gated on `settings.folderContextEnabled && lastUser && this.toolExecutor`; calls `extractFolderTag(lastUser.content)`; on non-null `f` calls `await this.toolExecutor.folderSweep(f)`; non-empty result appended to `finalContextBlock` with `\n\n` join (assigns directly when empty). PASS
  - (d) `#codebase` (line 937) and `#problems` (line 953) wiring blocks UNCHANGED — diff contains only the import extension and the new `#folder:` block. PASS
- **Settings field:** `src/presets.ts` line 96 `folderContextEnabled: boolean;` (immediately after `problemsEnabled` at line 94). `src/config.ts` line 73 `folderContextEnabled: c.get<boolean>("chat.folderContext.enabled", true)`. PASS
- **Smoke 14c:** 5 genuine static checks labeled `folder-s3:` — `ChatViewProvider.ts` contains `extractFolderTag`, `folderSweep(`, `folderContextEnabled`; `config.ts` contains `chat.folderContext.enabled`; `presets.ts` contains `folderContextEnabled`. Not tautologies. PASS
- **Scope check:** `git status --short` → only `src/chat/ChatViewProvider.ts`, `src/config.ts`, `src/presets.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md` (+ `ninfer` submodule marker, ignored). PASS

### 1.98-10.S3 — `folderContextEnabled` field + `#folder:` chat wiring (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **315 assertions** (310 prior + 5 new `folder-s3:` in subsection 14c).
- **Wiring in `src/chat/ChatViewProvider.ts`:** `extractFolderTag` imported from `../context` (line 30); `#folder:` block at L982 — after `#problems` (L953), before `composeSystemPrompt` (L998); gated on `settings.folderContextEnabled && lastUser && this.toolExecutor`; `git diff` = exactly 2 hunks (+18/−0): import extension + new block only; `#codebase`/`#problems` unchanged. PASS
- **Settings field:** `src/presets.ts:96` `folderContextEnabled: boolean;` (after `problemsEnabled`); `src/config.ts:73` `folderContextEnabled: c.get<boolean>("chat.folderContext.enabled", true)`. PASS
- **Smoke 14c:** 5 genuine static checks (`folder-s3:`). PASS
- **Scope check:** only the 5 in-scope files (+ `ninfer` marker, ignored). PASS

### 1.98-10.S4 — `package.json`: `llm.chat.folderContext.enabled` + smoke 14d + planner memory (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **319 assertions** (315 prior + 4 new `folder-s4:` in subsection 14d; 0 FAIL).
- **`package.json`:** valid JSON (`node -e JSON.parse` OK). `llm.chat.folderContext.enabled` present with `type: "boolean"`, `default: true`, non-empty description containing `#folder`. `git diff package.json` = single additive hunk (+5/−0) placed immediately after `llm.chat.problems.enabled`; no other change. PASS
- **Smoke 14d:** 4 genuine parsed-JSON checks on `pkg.contributes.configuration.properties["llm.chat.folderContext.enabled"]` (NOT string-contains on raw file): entry exists, `type === "boolean"`, `default === true`, description non-empty and contains `#folder`. Not tautologies. PASS
- **Planner memory:** `.github/agents/planner/PROGRESS.md` marks 1.98-10 **Done** (2026-10-22, slices S1–S4); each slice S1–S4 annotated Done. PASS
- **Scope check:** `git status --short` (ignoring `ninfer` submodule marker) → only `package.json`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md`, `.github/agents/planner/PROGRESS.md`. PASS
- **Item 1.98-10 fully verified (S1–S4 all PASS).**

### 1.98-10.S4 — `package.json`: `llm.chat.folderContext.enabled` + smoke 14d + planner memory (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **319 assertions** (315 prior + 4 new `folder-s4:` in subsection 14d).
- **`package.json`:** valid JSON; `llm.chat.folderContext.enabled` present with `type: "boolean"`, `default: true`, non-empty description containing `#folder`; `git diff` = single additive hunk (+5/−0) immediately after `llm.chat.problems.enabled`. PASS
- **Smoke 14d:** 4 genuine parsed-JSON checks (`folder-s4:`) — entry exists, `type === "boolean"`, `default === true`, description non-empty + contains `#folder`. PASS
- **Planner memory:** item 1.98-10 marked Done (2026-10-22, slices S1–S4), each slice annotated done. PASS
- **Scope check:** only the 4 in-scope files (+ `ninfer` marker, ignored). PASS
- **Item 1.98-10 fully verified (S1–S4 all PASS).**

### 1.98-12.S1 — pure `buildCompletionsModelList` in `src/presets.ts` (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **327 assertions** (319 prior + 8 new `compm-s1:`; 0 FAIL).
- **Static checks in `src/presets.ts`:** (a) `CompletionsModelOption` interface exported with `value: string`, `label: string`, `picked: boolean`. PASS (b) `buildCompletionsModelList(current, chatModel, engineModels)` exported, pure. PASS (c) No `import ... from "vscode"` anywhere in the file (grep exit 1). PASS
- **Behavior contract** — `node -e` spot checks against compiled `out/presets.js`:
  - `("", "", [])` → exactly 1 entry `{value:"", label:"Use chat model (default)", picked:true}`. PASS
  - `("m-a","m-b",["m-c"])` → values `["","m-a","m-b","m-c"]`; `picked:true` only on `m-a`. PASS
  - `("m-b","m-b",["m-c"])` → values `["","m-b","m-c"]`; `picked:true` on `m-b` (dedup current===chat). PASS
  - `("","m-b",["m-b","m-c"])` → values `["","m-b","m-c"]` (engine model == chat model not duplicated). NOTE: `picked:true` lands on the default entry (value "") because `current === ""` — matches the documented contract ("`picked` is true on the entry matching `current` ("" → the default entry)"); the criterion's "no picked anywhere" wording is subsumed by this. PASS
  - `("m-c","",["m-a","m-c"])` → values `["","m-c","m-a"]` (current first among candidates, deduped against engine list); `picked` on `m-c`. PASS
- **Smoke 15a:** 8 genuine `compm-s1:` assertions (lines 2169–2206 of `scripts/smoke-test.js`) exercising the compiled function: default entry shape, picked-on-default, ordering, single picked, current===chat dedup, engine dedup, empty-inputs single entry, picked-false on non-active. Not tautologies. PASS
- **Scope check:** `git status --short` (ignoring `ninfer` submodule marker) → only `src/presets.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md`. PASS


### 1.98-12.S1 — pure `buildCompletionsModelList` in `src/presets.ts` (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **327 assertions** (319 prior + 8 new `compm-s1:` in section 15a).
- **Static:** `CompletionsModelOption` interface (value/label/picked) + `buildCompletionsModelList` exported; `src/presets.ts` remains vscode-free. PASS
- **Behavior spot-checks** (`node -e` on `out/presets.js`): empty inputs → single default entry (picked); `("m-a","m-b",["m-c"])` → `["","m-a","m-b","m-c"]` picked on `m-a`; `current === chatModel` dedup → single picked entry; engine-model/chat-model dedup; current-first ordering with engine dedup. All match documented contract. PASS
- **Smoke 15a:** 8 genuine assertions (not tautologies). PASS
- **Scope check:** only `src/presets.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md` (+ `ninfer` marker, ignored). PASS

### 1.98-12.S2 — `completionsModel` field + InlineCompletionProvider wiring (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **332 assertions** (327 prior + 5 new `compm-s2:` in subsection 15b).
- **Settings field:** `src/presets.ts` `completionsModel: string;` after `folderContextEnabled`; `src/config.ts` `completionsModel: c.get<string>("completions.model", "")`. PASS
- **Provider wiring:** conditional override `const settings = base.completionsModel ? { ...base, model: base.completionsModel } : base;` — buggy unconditional form NOT present; `toolbar`/`buildRequestBody` unchanged; `git diff src/request.ts` empty. PASS
- **Smoke 15b:** 5 genuine static checks (`compm-s2:`), incl. `base.completionsModel` fallback-guard check. PASS
- **Scope check:** only the 5 in-scope files (+ `ninfer` marker, ignored). PASS
- **Note:** fallback bug (unconditional override → empty `model` omitted from request body) found by orchestrator, fixed by Coder before verification.

### 1.98-12.S3 — `llm.changeCompletionsModel` QuickPick command in `src/extension.ts` (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **337 assertions** (332 prior + 5 new `compm-s3:` in subsection 15c; 0 FAIL).
- **Command registration:** `src/extension.ts:124` `vscode.commands.registerCommand("llm.changeCompletionsModel", async () => {` — inside the `context.subscriptions.push(...)` block, immediately after the `llm.commitChanges` registration (line 121). PASS
- **QuickPick list:** `buildCompletionsModelList` imported from `./presets` (line 10); items built at line 136 via `buildCompletionsModelList(current, chatModel, engineModels).map(...)`; default entry (`o.value === ""`) → `label: "$(symbol-inherit) Use chat model (default)"`; `description: o.picked ? "active" : undefined`. PASS
- **Engine-unreachable fallback:** `client.listModels()` wrapped in try/catch (lines 129–135); on failure `showWarningMessage("LLM engine unreachable — showing configured models only.")` and list built from empty `engineModels` (initialized `[]`). PASS
- **Setting write:** `if (!picked) { return; }` cancel no-op (no write, no info message); `target = workspaceFolders ? ConfigurationTarget.Workspace : ConfigurationTarget.Global`; `await cfg.update("completions.model", picked.value, target)`. PASS
- **Smoke 15c:** 5 genuine static assertions (`compm-s3:`, lines 2234–2260) on `src/extension.ts` source: contains `llm.changeCompletionsModel`, `buildCompletionsModelList`, `showQuickPick`, `completions.model`, `ConfigurationTarget.Workspace`. Not tautologies. PASS
- **Scope check:** `git status --short` (ignoring `ninfer` submodule marker) → only `src/extension.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md`. PASS

### 1.98-12.S4 — `package.json` contributions + smoke 15d + planner memory (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **342 assertions** (337 prior + 5 new `compm-s4:` in subsection 15d; 0 FAIL).
- **JSON validity:** `package.json` parses as valid JSON (`node -e JSON.parse` OK). PASS
- **Setting contribution:** `contributes.configuration.properties["llm.completions.model"]` exists with `type === "string"`, `default === ""`, description mentions completions. PASS
- **Command contribution:** `contributes.commands` contains `command === "llm.changeCompletionsModel"` with non-empty `title === "LLM: Change Completions Model"`. PASS
- **Smoke 15d:** 5 genuine parsed-JSON assertions (lines 2265–2290) operating on the parsed `pkg` object — NOT string-contains on raw file text. Not tautologies. PASS
- **Planner memory:** `.github/agents/planner/PROGRESS.md` marks 1.98-12 **Done** (Status + plan header); slices S1–S4 each annotated `— Done (2026-10-22)`. PASS
- **Scope check:** `git status --short | grep -v ninfer` → only `package.json`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md`, `.github/agents/planner/PROGRESS.md` (+ `ninfer` submodule marker, ignored). PASS
- **Item 1.98-12 fully verified (S1–S4 all PASS).**

### 1.98-14.S1 — `src/request.ts`: multimodal message support (pure) (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **346 assertions** (342 prior + 4 new `vision-s1:` in subsection 16; 0 FAIL).
- **`src/request.ts`:** (a) `ChatMessage` gains optional `images?: string[]`; `content` still typed `string`. PASS (b) `ContentPart` type + exported pure `toContentParts(content, images?)`: no/empty images → plain string (zero behavior change); else parts array, text part first, one `{type:"image_url",image_url:{url}}` per data URL. PASS (c) `RequestMessage` type: `content: string | ContentPart[]`. PASS (d) `buildRequestBody`: after `trimHistory`, maps messages with `images` via `toContentParts` — text-only messages pass through unchanged (byte-identical bodies). PASS (e) `estimateMessageTokens` adds `1000 * (message.images?.length ?? 0)`; also sums only text parts of parts-array content. PASS
- **Smoke 16:** 4 genuine behavior assertions (`vision-s1:`) on compiled `out/request.js`: export check, strict string equality, full parts-array shape check, ≥900 token delta. Not tautologies. PASS
- **Scope check:** `git status --short | grep -v ninfer` → only `src/request.ts` (+62/−6), `scripts/smoke-test.js` (+34/−0), `.github/agents/coder/PROGRESS.md`. No `package-lock.json`. PASS

### 1.98-14.S2 — `src/presets.ts`: `isVisionCapableModel` (pure) (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **349 assertions** (346 prior + 3 new `vision-s2:` in subsection 16b; 0 FAIL).
- **Behavior checks on compiled `out/presets.js` (`node -e`):** (a) `isVisionCapableModel` exported as `function`. PASS (b) `isVisionCapableModel("Qwen2.5-VL-7B-Instruct")` === `true` (case-insensitive). PASS (c) `isVisionCapableModel("")` === `false`. PASS (d) `isVisionCapableModel("llama3.1:8b")` === `false`. PASS (e) `VISION_MODEL_MARKERS` is an array with exactly 16 entries. PASS
- **Smoke 16b:** 3 genuine assertions requiring compiled `out/presets.js` and asserting strict `=== true` / `=== false` on concrete inputs — would fail if the function were unexported or broken. Not tautologies. PASS
- **Purity:** `src/presets.ts` has no `vscode` import. PASS
- **Scope check:** only `src/presets.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md` modified. No `package-lock.json`. PASS

### 1.98-14.S3 — webview attachment UI (paperclip / paste / drag-drop, thumbnails, hover preview, warning notice) (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **354 assertions** (349 prior + 5 new `vision-s3:`).
- **Static checks in `src/chat/webview.ts`:** (a) HTML ids `attach`, `attach-file` (accept jpeg/png/gif/webp, multiple), `attach-strip`, `vision-warning` present. PASS (b) `pendingImages` state; `addImageFiles` filters 4 mimes, caps 4 images / 10 MB, `FileReader.readAsDataURL`. PASS (c) `renderAttachStrip` 48px thumbs + remove buttons, hides when empty. PASS (d) Events: `#attach` click → file input click; change; `paste` via `clipboardData.items` + `getAsFile()`; `dragover`/`drop` with `preventDefault`. PASS (e) `doSend()` posts `{type:'send', text, images}`; `lastSentImages` captured BEFORE `pendingImages = []` reset. PASS (f) `addUserMessage(text, images)` renders `.msg-images`/`.msg-img`; `stream_start` (non-skipUser) passes captured images; `restore` passes `m.images`. PASS (g) `case 'vision_warning'` sets textContent, unhides, auto-hides after 8 s, click hides. PASS (h) CSS `.attach-strip`, `.attach-thumb`, `.attach-remove`, `.msg-images`, `.msg-img` (hover scale 1.6), `.vision-warning`. PASS
- **5 new `vision-s3:` smoke assertions genuine:** source-content checks — each would fail if the UI were missing. PASS
- **Scope check:** only `src/chat/webview.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md` modified. `package-lock.json` NOT modified. PASS

### 1.98-14.S4 — host send flow + image validation + non-blocking vision warning (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **357 assertions** (354 prior + 3 new `vision-s4:` in subsection 16d; 0 FAIL).
- **Static checks in `src/chat/ChatViewProvider.ts`:** (a) `isVisionCapableModel` value-imported from `../presets` (line 45). PASS (b) `case "send":` passes `Array.isArray(msg.images) ? msg.images : []` (line 163). PASS (c) Vision gate `get<boolean>("chat.vision.enabled", true)` (lines 860–862). PASS (d) Sanitization: `^data:image/(jpeg|png|gif|webp);base64,`, `img.length <= 14 * 1024 * 1024`, `.slice(0, 4)`; gate false → `[]` silently. PASS (e) History push `images: sanitized.length > 0 ? sanitized : undefined` (line 878). PASS (f) Warning only when `sanitized.length > 0` AND `!isVisionCapableModel(this.toolbarStore.get().model ?? settings.model)` — both fields verified real (`ToolbarState.model: string | null`, `LlmSettings.model: string`); message mentions model name; non-blocking (`runStream` proceeds unconditionally, line 891). PASS (g) `this.postMessage({ type: "vision_warning", ... })` (line 886). PASS
- **Smoke 16d:** 3 genuine source-content checks (`isVisionCapableModel`, `vision_warning`, `chat.vision.enabled`) — each would fail if the wiring were removed. PASS
- **Scope check:** only `src/chat/ChatViewProvider.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md` modified. `package-lock.json` untouched. PASS

### 1.98-14.S5 — `package.json`: `llm.chat.vision.enabled` + planner memory (FINAL) (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **357 assertions** (unchanged — S5 adds NO new assertions; 0 FAIL).
- **`package.json`:** valid JSON. Parsed-JSON check: `contributes.configuration.properties["llm.chat.vision.enabled"]` exists with `type === "boolean"`, `default === true`, non-empty description mentioning images. PASS
- **Planner memory:** `.github/agents/planner/PROGRESS.md` marks 1.98-14 **Done** (Status block + all 5 slice headers annotated `— Done (2026-10-22)`; dispatch line checked off). PASS
- **Scope check:** exactly 3 files modified: `package.json`, `.github/agents/coder/PROGRESS.md`, `.github/agents/planner/PROGRESS.md`. `package-lock.json` NOT modified; `scripts/smoke-test.js` NOT modified. PASS
- **1.98-14 fully verified (all slices S1–S5 PASS).**

### 1.98-15.S1 — pure status helpers in `src/presets.ts` (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **361 assertions** (357 prior + 4 new `status-s1:` in section 17; 0 FAIL).
- **Static checks in `src/presets.ts`:** (a) `EngineStatus` interface — standalone structural subset (`ok`, `status`, `statusText`, `error?`), no `client.ts` import. PASS (b) `statusLabel`: `$(check) LLM` / `$(error) LLM`. PASS (c) `statusTooltip`: ok → `LLM engine healthy (<status> <statusText>) — <baseUrl>`; offline → `LLM engine unreachable — <baseUrl>: <error>` (or `(<status>)` fallback). PASS (d) `statusOverviewItems`: 4 rows — `Engine: running|stopped`, `Endpoint`, `Chat model` (fallback `default (engine)`), `Completions model` (fallback `chat model (default)`). PASS (e) `STATUS_COMMANDS`: 4 entries (Open Chat / Test Connection / Refresh Models / Change Completions Model). PASS
- **Purity:** `src/presets.ts` has zero import statements — no `vscode`, no `client.ts` import. PASS
- **Smoke 17:** 4 genuine behavior assertions on compiled `out/presets.js` (require + strict value checks: export types, JSON.stringify equality on statusLabel, concrete tooltip content, 4-row shape + empty-model fallbacks). Not tautologies. PASS
- **Scope check:** `git status --short | grep -v ninfer` → only `src/presets.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md`. `package-lock.json` NOT modified. PASS

### 1.98-15.S2 — `src/extension.ts`: status-bar gate + pure helpers + focus refresh (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **364 assertions** (361 prior + 3 new `status-s2:` in section 17b; 0 FAIL).
- **Static checks in `src/extension.ts`:** (a) `statusBarEnabled` read at activation via `getConfiguration("llm").get<boolean>("statusBar.enabled", true)` — default `true`, same pattern as `inlineEnabled`. PASS (b) Entire status-bar block (`createStatusBarItem(Left, 100)`, `status.command = "llm.testConnection"`, `updateHealth`, 5 s `setInterval` poll with `clearInterval` dispose, initial `void updateHealth()`) wrapped in `if (statusBarEnabled)`; `context.subscriptions.push(status)` only when created. PASS (c) `updateHealth` uses `statusLabel(result)` for `status.text` and `statusTooltip(result, readSettings().baseUrl)` for `status.tooltip`; `statusBarItem.errorBackground` when `!result.ok` and `status.show()` preserved. PASS (d) `vscode.window.onDidChangeWindowState` refresh on `e.focused` registered inside the gate and pushed to subscriptions. PASS (e) Commands `llm.openChat`, `llm.testConnection`, `llm.refreshModels`, `llm.changeCompletionsModel` (plus `llm.clearChat`, `llm.commitChanges`) still registered; `statusLabel`/`statusTooltip` imported from `./presets`. PASS
- **Smoke 17b:** 3 genuine static source checks on `src/extension.ts` (`statusBar.enabled`, `statusLabel`, `onDidChangeWindowState`) — each would fail if the wiring were removed. Not tautologies. PASS
- **Scope check:** `git status --short | grep -v ninfer` → only `src/extension.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md`. `package-lock.json` NOT modified. PASS

### 1.98-15.S3 — `src/extension.ts`: `llm.showStatusOverview` QuickPick + repoint click (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **367 assertions** (364 prior + 3 new `status-s3:` in section 17c; 0 FAIL).
- **Static checks in `src/extension.ts`:** (a) `llm.showStatusOverview` registered in the `context.subscriptions.push(...)` commands block: fresh `await client.health()`, `readSettings()` for `baseUrl`/`model`/`completionsModel`, info rows from `statusOverviewItems(...)` mapped to `{label, description}` (pick = no-op), `Useful commands` separator + `STATUS_COMMANDS.map(c => ({label, detail, command}))`, `showQuickPick(items, { placeHolder: "LLM engine status" })`, `if (picked && picked.command) await vscode.commands.executeCommand(picked.command)`. PASS (b) `status.command = "llm.showStatusOverview"` (repointed from `llm.testConnection`, which remains registered). PASS (c) `updateHealth` tooltip: `statusTooltip(result, readSettings().baseUrl) + " (click for status overview)"`. PASS (d) No `canSelectMany`, no duplicate command registrations, single status-bar block; `llm.openChat`/`llm.testConnection`/`llm.refreshModels`/`llm.changeCompletionsModel` still registered. PASS
- **Smoke 17c:** 3 genuine static source checks on `src/extension.ts` (`llm.showStatusOverview`, `statusOverviewItems`, `STATUS_COMMANDS`) — each would fail if the wiring were removed. Not tautologies. PASS
- **Scope check:** `git status --short | grep -v ninfer` → only `src/extension.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md`. `package-lock.json` NOT modified. PASS

### 1.98-15.S4 — `package.json` contributions + final smoke assertions + planner PROGRESS.md (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **371 assertions** (367 prior + 4 new `status-s4:` in subsection `// 17d) package.json contributions (1.98-15.S4)`; 0 FAIL).
- **`package.json`:** valid JSON (`JSON.parse` OK). `git diff` = exactly 3 additive hunks (+9/−1): (a) `activationEvents` gains `"onCommand:llm.showStatusOverview"`; (b) `contributes.commands` gains `{"command":"llm.showStatusOverview","title":"LLM: Show Status Overview"}` after `llm.testConnection`; (c) `contributes.configuration.properties` gains `llm.statusBar.enabled` (`type: "boolean"`, `default: true`, description verbatim: "Show the LLM engine status indicator in the status bar. Click it for a status overview. Toggling requires a reload."). No other settings/commands disturbed; `package-lock.json` untouched. PASS
- **Smoke 17d:** 4 genuine parsed-JSON checks on `pkgS4 = JSON.parse(fs.readFileSync(package.json))` (NOT string-contains on raw file): (a) `contributes.commands` contains `command === "llm.showStatusOverview"` with non-empty `title`; (b) `activationEvents` contains `"onCommand:llm.showStatusOverview"`; (c) `llm.statusBar.enabled` has `type === "boolean"` and `default === true`; (d) regression guard — `contributes.commands` still contains `command === "llm.testConnection"`. Not tautologies. PASS
- **Planner memory:** `.github/agents/planner/PROGRESS.md` marks 1.98-15 **Done** (2026-10-22, 4 slices S1–S4); Status Current item → Done; all 4 slice headers annotated `— Done (2026-10-22)`; Todo dispatch line checked off. PASS
- **Scope check:** `git status --short | grep -v ninfer` → only `package.json`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md`, `.github/agents/planner/PROGRESS.md`. PASS
- **Item 1.98-15 fully verified (S1–S4 all PASS).**

## Done

- [x] **1.98-1.S1** — webview `command_approval` card — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-1.S2** — host-side `commandApproval` plumbing — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-1.S3** — host: route `run_command` through editable approval gate — **PASS** (2026-10-22, see Verifications)

## Todo

- [x] **1.98-12.S1** — pure `buildCompletionsModelList` — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-12.S2** — `completionsModel` field + provider wiring (fallback fix) — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-12.S3** — `llm.changeCompletionsModel` QuickPick command — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-12.S4** — `package.json` contributions + smoke 15d + planner memory — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-12** — completions model quick pick — **fully verified** (all slices S1–S4 PASS, 2026-10-22)
- [x] **1.98-14.S1** — `src/request.ts`: multimodal message support (pure) — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-14.S2** — `src/presets.ts`: `isVisionCapableModel` (pure) — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-14.S3** — webview attachment UI — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-14.S4** — host send flow + image validation + vision warning — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-14.S5** — `package.json`: `llm.chat.vision.enabled` + planner memory (FINAL) — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-14** — Copilot Vision (image attachments) — **fully verified** (all slices S1–S5 PASS, 2026-10-22)
- [ ] **1.98-12.S2** — next slice of 1.98-12 (completions model quick pick)
- [x] **1.98-1.S4** — webview "modified by user" badge on tool card — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-1.S5** — settings description + smoke test + planner PROGRESS.md — **PASS** (2026-10-22)
- [x] **1.98-1** — fully verified (all slices S1–S5 PASS)
- [x] **1.98-2.S1** — `notebook_edit` tool schema + mutating flag — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-2.S2** — `src/notebook.ts` pure parse/format/create helpers — **PASS** (2026-10-22)
- [x] **1.98-2.S3** — `applyNotebookEdit` (the 5 actions) — **PASS** (2026-10-22)
- [x] **1.98-2.S4** — ToolExecutor: execute `notebook_edit` — **PASS** (2026-10-22)
- [x] **1.98-2.S5** — context: render tagged .ipynb files as cells in `src/context.ts` — **PASS** (2026-10-22)
- [x] **1.98-2.S6** — package.json descriptions + final smoke assertions + PROGRESS.md — **PASS** (2026-10-22)
- [x] **1.98-2** — fully verified (all slices S1–S6 PASS)
- [x] **1.98-8.S1** — `src/context.ts`: `extractCodebaseQuery` + `formatCodebaseSweep` (pure) — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-8.S2** — `src/tools/ToolExecutor.ts`: `codebaseSweep(query)` public method — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-8.S3** — ChatViewProvider: detect `#codebase`, run sweep, inject context — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-8.S4** — package.json settings schema + final smoke assertions + PROGRESS.md — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-8** — fully verified (all slices S1–S4 PASS)
- [x] **1.98-9.S1** — `src/context.ts`: `extractProblemsTag` + `formatProblemsBlock` (pure) — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-9.S2** — `ToolExecutor.collectDiagnostics` shared helper — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-9.S3** — `problemsEnabled` field + `#problems` wiring — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-9.S4** — `package.json`: `llm.chat.problems.enabled` + final smoke assertions — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-9** — fully verified (all slices S1–S4 PASS)
- [x] **1.98-10.S1** — `src/context.ts`: `extractFolderTag` + `formatFolderBlock` + `FOLDER_BLOCK_MAX_CHARS` (pure) — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-10.S2** — `ToolExecutor.folderSweep(folderName)` — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-10.S3** — `folderContextEnabled` field + `#folder:` chat wiring — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-10.S4** — `package.json` settings schema + smoke 14d + planner memory — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-10** — `#folder:` tag — **fully verified** (all slices S1–S4 PASS, 2026-10-22)
- [x] **1.98-12.S1** — pure `buildCompletionsModelList` — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-12.S2** — `completionsModel` field + provider wiring (fallback fix) — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-12.S3** — `llm.changeCompletionsModel` QuickPick command — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-12.S4** — `package.json` contributions + smoke 15d + planner memory — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-12** — completions model quick pick — **fully verified** (all slices S1–S4 PASS, 2026-10-22)
- [x] **1.98-14.S1** — `src/request.ts`: multimodal message support (pure) — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-14.S2** — `src/presets.ts`: `isVisionCapableModel` (pure) — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-14.S3** — webview attachment UI — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-14.S4** — host send flow + image validation + vision warning — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-14.S5** — `package.json`: `llm.chat.vision.enabled` + planner memory (FINAL) — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-14** — Copilot Vision (image attachments) — **fully verified** (all slices S1–S5 PASS, 2026-10-22)
- [x] **1.98-15.S1** — pure status helpers in `src/presets.ts` (statusLabel/statusTooltip/statusOverviewItems/STATUS_COMMANDS) — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-15.S2** — `src/extension.ts`: status-bar gate + pure helpers + focus refresh — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-15.S3** — `src/extension.ts`: `llm.showStatusOverview` QuickPick + repoint click — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-15.S4** — `package.json` contributions + final smoke assertions + planner memory (FINAL) — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-15** — Engine status indicator — **fully verified** (all slices S1–S4 PASS, 2026-10-22)
- [x] **1.98-10.S4** — `package.json`: `llm.chat.folderContext.enabled` + smoke 14d + planner memory — **PASS** (2026-10-22, see Verifications)
- [x] **1.98-10** — fully verified (all slices S1–S4 PASS)
- [ ] For each item: run build, run smoke test, exercise acceptance checks, record verdict.

## Notes / decisions

- The tester does NOT write code. If a bug is found, report it (exact error, file, line) so
  the Coder can fix it.
- Always run the build first. If it fails, report fail immediately.
- Always run the smoke test. Record the assertion count.
- Report, don't fix.

### 1.98-2.S2 — `src/notebook.ts` pure parse/format/create helpers (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED (196 assertions; 17 new `notebook:` green). Static checks a–d PASS (pure module, null on bad JSON/missing cells, string[] join, nbformat-4 re-parse, `<<<CELL>>>` split, fence switching). Scope: only `src/notebook.ts` (new) + `scripts/smoke-test.js` (+88).

### 1.98-2.S3 — `applyNotebookEdit` (the 5 actions) (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED (24 new `notebook-edit:` assertions green, incl. 4 error cases). Static checks a–d PASS: 5 actions + unknown→ok:false; cellIndex integer in [0,cells.length) for modify/delete/change, clamped [0,cells.length] for insert (undefined→append), range in error messages; mutations re-serialize raw doc via `parseNotebookRaw` + `JSON.stringify(raw, null, 1)` (non-`cells` fields preserved); `modify_cell` requires source, `change_cell_type` requires valid cellType. Scope: only `src/notebook.ts` (+166) + `scripts/smoke-test.js` (+185) among source files.

### 1.98-2.S4 — ToolExecutor: execute `notebook_edit` (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED; 16 `nb-exec:` assertions green. Static checks a–d PASS: case in execute() with coerced args; resolveSafe + snapshot system (lastSnapshot/recordSnapshot/recordChange); ok:false returns before any snapshot/write; git diff = 3 additive hunks (+61/-0). Scope: only ToolExecutor.ts (+61) + smoke-test.js (+172).

### 1.98-2.S5 — context: render tagged .ipynb files as cells (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED (241 assertions); 5 new `context:` notebook assertions green. Static checks a–b PASS: `formatNotebookForContext` imported from ./notebook, used only for case-insensitive `.ipynb` in taggedFiles loop; non-.ipynb raw fenced block unchanged (+9/-1). Scope: only context.ts + smoke-test.js (+54).

### 1.98-2.S6 — package.json descriptions + final smoke assertions + PROGRESS.md (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED (245 assertions; 4 new `nb-final:` green). Static checks 3–6 PASS: package.json single 1-line hunk (requireApproval lists notebook_edit); 4 new assertions are genuine feature references; planner PROGRESS.md marks 1.98-2 Done, next → 1.98-8; scope = package.json (±1) + smoke-test.js (+33) + memory files only.
- **Item 1.98-2 fully verified (S1–S6 all PASS).**

### 1.98-8.S1 — `src/context.ts`: `extractCodebaseQuery` + `formatCodebaseSweep` (pure) (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED (**257 assertions**; 12 new `codebase:` green in section `// 12) codebase sweep (1.98-8)`).
- Static checks in `src/context.ts`: (a) `extractCodebaseQuery(text: string): string | null` — regex `/#codebase(?!\w)/i` (case-insensitive, word-bounded; `#codebasefoo` no match); null when absent, "" for bare tag, trimmed same-line remainder. (b) `CodebaseSweepData` interface with `structure`, `gitStatus`, `search`. (c) `formatCodebaseSweep(data, query?)` — header `Codebase sweep (query: <q|none>)`; three `###` headers in order; placeholders `(clean or not a git repo)` / `(no matches)`; 12,000-char cap with `… (truncated)`; `""` only when all-empty AND no query. (d) Purity: no `vscode` import. All PASS.
- Scope: only `src/context.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md` (+ ninfer marker). PASS

### 1.98-8.S2 — `src/tools/ToolExecutor.ts`: `codebaseSweep(query)` public method (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED (**262 assertions**; 5 new `codebase-s2:` green in subsection `// 12b) codebase sweep (1.98-8.S2)`).
- Static checks: (a) `private async searchMatches(pattern, rootAbs, cap): Promise<string[]>` — shared recursive walk, SKIP_DIRS, regex with literal fallback, `relPath:line: text` lines, stops at cap. (b) `searchFiles` delegates to `searchMatches(pattern, rootAbs, MAX_SEARCH_MATCHES)`; cap 50 + truncation suffix preserved; diff confirms pure extraction. (c) `public async codebaseSweep(query)` — structure walk depth ≤ 3, SKIP_DIRS, `name/` dirs / `name` files, 2-space indent, 100-entry cap + `… (truncated at 100 entries)`, `"(no workspace folder)"` fallback; git status via `gitStatusText()` with `git exited` → `""` and 50-line cap; search via `searchMatches(query, rootAbs, 20)` only when non-blank; composes `formatCodebaseSweep` from `../context`. All PASS.
- Scope: only `src/tools/ToolExecutor.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md` (+ ninfer marker). PASS

### 1.98-8.S3 — `src/chat/ChatViewProvider.ts`: detect `#codebase`, run sweep, inject context (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED (**266 assertions**; 4 new `codebase-s3:` in subsection `// 12c) codebase sweep (1.98-8.S3)`).
- ChatViewProvider (git diff +20/-1, 3 hunks): (a) `extractCodebaseQuery` added to `../context` import. (b) In `runStream` after `buildContextBlock(ctxInput)`: guarded by `settings.codebaseSearchEnabled && lastUser && this.toolExecutor`; `extractCodebaseQuery(lastUser.content) !== null` → `await this.toolExecutor.codebaseSweep(q)`; non-empty result appended with `"\n\n"` separator into `finalContextBlock`. (c) `composeSystemPrompt` receives `finalContextBlock`; `buildContextBlock` section order untouched. (d) `this.toolExecutor` in guard — no crash path. All PASS.
- `src/presets.ts`: `LlmSettings` gains `codebaseSearchEnabled: boolean;`. PASS
- `src/config.ts`: `readSettings()` returns `codebaseSearchEnabled: c.get<boolean>("chat.codebaseSearch.enabled", true)`. PASS
- No regression: `@file` tagged-file path and rest of `runStream` untouched. PASS
- Scope: only `src/chat/ChatViewProvider.ts`, `src/config.ts`, `src/presets.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md` (+ ninfer marker). PASS

### 1.98-8.S4 — package.json settings schema + final smoke assertions + PROGRESS.md (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED (**270 assertions**; 4 new `codebase-s4:` in subsection `// 12d) codebase sweep (1.98-8.S4)`).
- package.json: single additive hunk (+5/-0) adding `llm.chat.codebaseSearch.enabled` (`type: "boolean"`, `default: true`, description mentions `#codebase`); no other settings changed.
- 4 new smoke assertions genuine: parsed package.json type/default checks + source-content checks on `src/config.ts` and `src/chat/ChatViewProvider.ts`.
- Planner PROGRESS.md: `# Plan: 1.98-8` marked Done (S1–S4 annotated); Next step → 1.98-9 (`#problems`).
- Spot-check: `runStream` gates on `settings.codebaseSearchEnabled && lastUser && this.toolExecutor`; `extractCodebaseQuery(lastUser.content) !== null` → `codebaseSweep(q)` appended after `buildContextBlock` output; setting false → tag inert. PASS.
- Scope: only `package.json`, `scripts/smoke-test.js`, coder + planner PROGRESS.md (+ ninfer marker). PASS
- **Item 1.98-8 fully verified (S1–S4 all PASS).**

### 1.98-9.S1 — `src/context.ts`: `extractProblemsTag` + `formatProblemsBlock` (pure) (2026-10-22) — **PASS**

- Build: `npm run compile` exit 0. Smoke test: ALL PASSED (**280 assertions**; 10 new `problems:` green in section `// 13) problems tag (1.98-9)` / subsection `13a`).
- Static checks: (a) `extractProblemsTag(text: string): string | null` — regex `/#problems(?!\w)/i` (case-insensitive, word-bounded); first match; trimmed same-line remainder; `""` bare tag; null absent. (b) `ProblemsBlockData` interface with `text: string`. (c) `export const PROBLEMS_BLOCK_MAX_CHARS = 8000`. (d) `formatProblemsBlock(data, scope?)` — header `Problems (scope: workspace)` default / `Problems (scope: <scope>)`; body text or `(no problems — clean)`; 8,000-char truncation + `… (truncated)`; `""` only when text empty AND default scope. (e) Purity: no `vscode` import. All PASS.
- Scope: only `src/context.ts`, `scripts/smoke-test.js`, `.github/agents/coder/PROGRESS.md` (+ ninfer marker). PASS

### 1.98-12.S2 — `completionsModel` setting field + InlineCompletionProvider wiring (2026-10-22) — **PASS**

- **Build:** `npm run compile` → exit 0, zero errors.
- **Smoke test:** `node scripts/smoke-test.js` → ALL SMOKE TESTS PASSED, **332 assertions** (327 prior + 5 new `compm-s2:`; 0 FAIL).
- **Settings field:** `src/presets.ts` `LlmSettings` gains `completionsModel: string;` immediately after `folderContextEnabled` (+ doc comment). `src/config.ts` `readSettings()` returns `completionsModel: c.get<string>("completions.model", "")` (single additive line). PASS
- **Provider wiring (`src/inline/InlineCompletionProvider.ts`, git diff = 1 hunk, +6/−1):** (a) override is CONDITIONAL — `const base = readSettings(); const settings = base.completionsModel ? { ...base, model: base.completionsModel } : base;` — the buggy unconditional `{ ...base, model: base.completionsModel }` is NOT present (empty `llm.completions.model` keeps `llm.model` fallback). PASS (b) `const toolbar = { ...this.toolbarStore.get(), thinking: "off" as const };` and `buildRequestBody({ settings, toolbar }, [...])` unchanged (context lines in diff). PASS (c) `git diff src/request.ts` → empty (0 lines). PASS
- **Smoke 15b:** 5 genuine static checks labeled `compm-s2:` — `presetsSrc` contains `completionsModel`; `configSrc` contains `completions.model`; `inlineSrc` contains `completionsModel`; `inlineSrc` contains `buildRequestBody(`; `inlineSrc` contains `base.completionsModel` (fallback guard). Not tautologies. PASS
- **Scope check:** `git status --short` (ignoring `ninfer` submodule marker) → only `src/presets.ts` (+2), `src/config.ts` (+1), `src/inline/InlineCompletionProvider.ts` (+6/−1), `scripts/smoke-test.js` (+26), `.github/agents/coder/PROGRESS.md`. PASS
- **Note:** the fallback bug (unconditional `model: base.completionsModel` → empty string omits `model` from the request body, breaking the `llm.model` fallback) was found by the orchestrator and fixed by the Coder (conditional override) BEFORE this verification. Verified state is the FIXED one.
