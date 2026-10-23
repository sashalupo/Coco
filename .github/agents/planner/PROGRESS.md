# Planner — Progress Memory

> **This file is the agent's persistent memory.** The `Planner` agent
> (`.github/agents/planner.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Turn each changelog feature (from the Changelog Researcher's backlog) into a concrete,
step-by-step implementation plan for the `llm` VS Code extension. The planner does NOT write
code — only the Coder writes code.

## Active plan — 1.100-10 · Autofix diagnostics from agent mode edits

- **Status:** Planned (2026-10-23)
- **Changelog:** VS Code 1.100 (Apr 2025) — if a file edit in agent mode introduces new
  errors, agent mode detects them and automatically proposes a follow-up edit (no manual
  follow-up prompt needed); disable via setting (local reframe: `llm.agent.autoFix`,
  default on).
- **Files to touch:** `src/config.ts`, `src/presets.ts`, `package.json`,
  `src/tools/ToolExecutor.ts`, `src/chat/ChatViewProvider.ts`, `scripts/smoke-test.js`.
- **Slices (in order):**
  - `1.100-10.S1` — `llm.agent.autoFix` setting (default `true`): `config.ts`
    `readSettings()` read + `presets.ts` `LlmSettings.agentAutoFix: boolean` field +
    `package.json` `llm.agent.autoFix` schema entry (boolean, default true, description
    mentions auto-fixing new errors after agent edits).
  - `1.100-10.S2` — pure exported helper `newDiagnostics(before, after)` in
    `src/tools/ToolExecutor.ts`: key = `severity|startLine|startChar|message`; returns
    the `after` entries whose key is absent from `before` (order preserved). No vscode
    import needed for the helper itself (accepts plain diagnostic-shaped tuples).
  - `1.100-10.S3` — agent-loop hook in `src/chat/ChatViewProvider.ts`: before executing
    each tool-call batch, snapshot `vscode.languages.getDiagnostics()` for the files the
    batch will edit (write_file/edit_file/apply_patch/notebook_edit paths from args);
    after the batch, wait ~500 ms (language-server settle), re-collect, diff via
    `newDiagnostics`; if new errors and `settings.agentAutoFix` and autoFixRounds < 2,
    push a system message ("New problems appeared in <file>: <diagnostics text>. Fix
    them.") + a short `delta` note, increment the round counter, and continue the loop.
    Reset `autoFixRounds` at run start (next to `clearChangeSummary()`). Cap: **2
    follow-up rounds per run** — after the cap, new errors are reported in a final
    `delta` note and the loop proceeds normally.
  - `1.100-10.S4` — smoke-test regression guards in `scripts/smoke-test.js`:
    `llm.agent.autoFix` schema (boolean, default true); `config.ts` reads it with
    default true; `presets.ts` has the field; `ToolExecutor.ts` exports
    `newDiagnostics`; `ChatViewProvider.ts` references `agentAutoFix` and the round cap
    (2); update the total assertion count (690 → new total).
- **First slice:** `1.100-10.S1`.
- **Acceptance:** compile + smoke pass; setting exists, defaults on, and off disables the
  loop; new errors after an edit trigger at most 2 auto follow-up turns; no behavior
  change when no new errors appear; loop always terminates.
- **Open questions:** (1) diff on all severities or errors-only — plan: all severities,
  message says "new problems"; (2) post a `delta` note for webview visibility — plan:
  yes, one short line per injected round.


## Status

- **Current item:** 1.100-10 (planned) — 1.100-8 complete
- **Next step:** dispatch `1.100-10.S1` (setting) to the Coder
- **Last updated:** 2026-10-23
- **Last commit:** (planner commit for the 1.100-10 plan)
- **Build state:** n/a (planner does not build)

## Plans delivered (recap)

Each item was split into slices of ≤3 files; plans themselves are pruned (see git history).

**1.98 (complete, tag `changelog-1.98`):** editable `run_command` approval card + "modified by user" badge (1); `notebook_edit` tool, 5 actions, `src/notebook.ts`, `.ipynb` rendered as cells (2); `#codebase` sweep (8); `#problems` (9); `#folder:<name>` (10); `llm.changeCompletionsModel` + `llm.completions.model` (12); image attachments + `llm.chat.vision.enabled` (14); status-bar overview `llm.showStatusOverview` + `llm.statusBar.enabled` (15). Already built: 3, 4, 6. Smoke ends ~371.

**1.99 (complete, tag `changelog-1.99`):** MCP client over stdio `src/mcp.ts` + `src/mcpManager.ts` (2); `think` tool (3); `fetch_url` + `#fetch` `src/fetchTool.ts` (4); `find_usages` + `#usages` `src/usages.ts` (5); `#newWorkspace` scaffolds `src/workspaceScaffold.ts` (6); tool approvals with session/workspace/global scope `ApprovalStore` (8); Ask/Agent/Edit mode picker (10); reusable prompt files `llm.usePrompt` `src/prompts.ts` (12); URL/bmp images (13); completions status + `llm.toggleCompletions` (16); `#searchResults` (19); explicit save on keep (23); nbformat 4.5 cell ids (27); `new_notebook` tool + `/newNotebook` (28); cell outputs to chat `llm.addCellOutput` (29). Already built: 1, 24. Smoke ends ~584.

**1.100 (in progress, tag `changelog-1.100`):** done so far: instructions files `.instructions.md` with `applyTo` auto-attach, `src/instructions.ts` (1); prompt-file front matter `mode`/`tools`, `llm.runPrompt` + Play button, languages `llm.prompt`/`llm.instructions` (2); `apply_patch` tool `src/patch.ts` (3); `#fetch` as Markdown with `llm.chat.fetch.maxTokens` token trim (7). Chat input pills: `ContextPill` + `parsePillRefs`/`dedupePills` in `src/context.ts`, pill strip UI in `src/chat/webview.ts`, `postContextPills()`/`remove_pill` in `src/chat/ChatViewProvider.ts`, grouped `llm.addContext` quick-pick in `src/extension.ts` (8). Smoke 690.
