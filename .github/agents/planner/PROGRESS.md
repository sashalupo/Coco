# Planner — Progress Memory

> **This file is the agent's persistent memory.** The `Planner` agent
> (`.github/agents/planner.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Turn each changelog feature (from the Changelog Researcher's backlog) into a concrete,
step-by-step implementation plan for the `llm` VS Code extension. The planner does NOT write
code — only the Coder writes code.

## Active plan — 1.100-11 · Handling of undo and manual edits in agent mode

- **Status:** Planned (2026-10-23)
- **Changelog:** VS Code 1.100 (Apr 2025) — manual edits during an agent session no
  longer confuse the model: the agent is prompted about the user's changes and
  re-reads files when necessary before editing files that may have changed.
  Local reframe: track file mtime/size of agent-touched files between turns; on
  external change, inject a system note ("user manually modified X — re-read it
  before editing") behind `llm.agent.trackManualEdits` (default on).
- **Files to touch:** `src/tools/ToolExecutor.ts`, `src/config.ts`, `src/presets.ts`,
  `package.json`, `src/chat/ChatViewProvider.ts`, `scripts/smoke-test.js`.
- **Slices (in order):**
  - `1.100-11.S1` — pure exported helper in `src/tools/ToolExecutor.ts` (next to
    `newDiagnostics`): `interface FileSnapshot { mtimeMs: number; size: number }`
    + `externallyChanged(snapshots, current): string[]` — paths in `current` whose
    `mtimeMs` or `size` differs from the stored snapshot (order = `current` order);
    deleted paths ignored. No vscode import.
  - `1.100-11.S2` — `llm.agent.trackManualEdits` setting (default `true`):
    `config.ts` `readSettings()` read + `presets.ts`
    `LlmSettings.agentTrackManualEdits: boolean` + `package.json` schema entry
    (boolean, default true).
  - `1.100-11.S3` — agent-loop hook in `src/chat/ChatViewProvider.ts`: private
    `touchedFiles: Map<string, FileSnapshot>` cleared at run start (next to
    `clearChangeSummary()`); `snapshotTouchedFiles(paths)` via `fs.stat` (skip on
    error); after each tool batch snapshot `autofixEditedPaths(toolCalls)` (agent's
    own writes become the baseline); at the top of the loop (before
    `streamOneTurn`), if `settings.agentTrackManualEdits` and `touchedFiles`
    non-empty, stat all tracked paths, call `externallyChanged`, and for each
    changed path push a system message ("The user manually modified <path> while
    the agent was running. Re-read it with read_file before editing it.") + a
    `delta` note (`[manual edit detected: <path>]`), then re-snapshot those paths
    so the note fires at most once per external change.
  - `1.100-11.S4` — smoke-test guards in `scripts/smoke-test.js`:
    `ToolExecutor.ts` exports `externallyChanged` + `FileSnapshot`; pure-function
    tests of compiled `externallyChanged` (mtime change → listed; size change →
    listed; identical → `[]`; order preserved); `llm.agent.trackManualEdits`
    schema (boolean, default true); `config.ts` reads it with default true;
    `presets.ts` has the field; `ChatViewProvider.ts` references
    `agentTrackManualEdits`, `externallyChanged`, and the "manually modified"
    note; raise the hard total-count gate (701 → new total).
- **First slice:** `1.100-11.S1`.
- **Acceptance:** compile + smoke pass; external modification of an
  agent-touched file is detected before the next turn and a system note + delta
  note are injected; note fires at most once per external change; the agent's own
  writes never trigger the note; setting off disables detection; no behavior
  change when no external edits occur.
- **Open questions:** (1) mtimeMs + size is sufficient (no content hashing);
  (2) files not yet touched by the agent have no baseline and are not tracked —
  acceptable, the note covers the confusion case (files the agent already
  touched); (3) externally deleted files are skipped (`fs.stat` error), not
  reported.


## Status

- **Current item:** 1.100-11 (planned) — 1.100-10 complete
- **Next step:** dispatch `1.100-11.S1` (pure helper) to the Coder
- **Last updated:** 2026-10-23
- **Last commit:** (planner commit for the 1.100-11 plan)
- **Build state:** n/a (planner does not build)

## Plans delivered (recap)

Each item was split into slices of ≤3 files; plans themselves are pruned (see git history).

**1.98 (complete, tag `changelog-1.98`):** editable `run_command` approval card + "modified by user" badge (1); `notebook_edit` tool, 5 actions, `src/notebook.ts`, `.ipynb` rendered as cells (2); `#codebase` sweep (8); `#problems` (9); `#folder:<name>` (10); `llm.changeCompletionsModel` + `llm.completions.model` (12); image attachments + `llm.chat.vision.enabled` (14); status-bar overview `llm.showStatusOverview` + `llm.statusBar.enabled` (15). Already built: 3, 4, 6. Smoke ends ~371.

**1.99 (complete, tag `changelog-1.99`):** MCP client over stdio `src/mcp.ts` + `src/mcpManager.ts` (2); `think` tool (3); `fetch_url` + `#fetch` `src/fetchTool.ts` (4); `find_usages` + `#usages` `src/usages.ts` (5); `#newWorkspace` scaffolds `src/workspaceScaffold.ts` (6); tool approvals with session/workspace/global scope `ApprovalStore` (8); Ask/Agent/Edit mode picker (10); reusable prompt files `llm.usePrompt` `src/prompts.ts` (12); URL/bmp images (13); completions status + `llm.toggleCompletions` (16); `#searchResults` (19); explicit save on keep (23); nbformat 4.5 cell ids (27); `new_notebook` tool + `/newNotebook` (28); cell outputs to chat `llm.addCellOutput` (29). Already built: 1, 24. Smoke ends ~584.

**1.100 (in progress, tag `changelog-1.100`):** done so far: instructions files `.instructions.md` with `applyTo` auto-attach, `src/instructions.ts` (1); prompt-file front matter `mode`/`tools`, `llm.runPrompt` + Play button, languages `llm.prompt`/`llm.instructions` (2); `apply_patch` tool `src/patch.ts` (3); `#fetch` as Markdown with `llm.chat.fetch.maxTokens` token trim (7). Chat input pills: `ContextPill` + `parsePillRefs`/`dedupePills` in `src/context.ts`, pill strip UI in `src/chat/webview.ts`, `postContextPills()`/`remove_pill` in `src/chat/ChatViewProvider.ts`, grouped `llm.addContext` quick-pick in `src/extension.ts` (8). Smoke 690.
