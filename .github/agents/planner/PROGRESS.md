# Planner — Progress Memory

> **This file is the agent's persistent memory.** The `Planner` agent
> (`.github/agents/planner.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Turn each changelog feature (from the Changelog Researcher's backlog) into a concrete,
step-by-step implementation plan for the `llm` VS Code extension. The planner does NOT write
code — only the Coder writes code.

## Active plan — 1.100-19 · Create and launch tasks in agent mode (workspace creation follow-up)

- **Status:** Planned — 2026-10-23
- **Changelog:** VS Code 1.100 — at the end of the new-workspace creation flow, the user is prompted to **create and run a task** for launching the app/project (task reuse). No images.
- **Approach:** The `#newWorkspace` flow (1.99-6) is agent-driven: `buildScaffoldPrompt()` in `src/workspaceScaffold.ts` builds the agent instructions, `formatWorkspaceBlock()` in `src/context.ts` renders the block, `ChatViewProvider.ts` injects it. The follow-up is a pure extension of the scaffold prompt + a per-template `tasks.json` template. The existing `run_command` tool (1.98-1, with approval) is reused to run the launch task — **no new tool, no new setting** (gated by the existing `llm.chat.newWorkspace.enabled`).
- **Files to touch:** `src/workspaceScaffold.ts`, `scripts/smoke-test.js`.
- **Slices:**
  - **S-001** — `src/workspaceScaffold.ts`: add `launchTask?: { label: string; command: string }` to `WorkspaceTemplate`; set on `extension` (`Compile`, `npm run compile`), `mcp-server` (`Start`, `npm start`), `dev-env` (`Dev`, `npm run dev`); `generic` has none. Add pure `buildTasksJson(type: string): string` → valid VS Code `tasks.json` (version `2.0.0`, one `shell` task with label/command, `problemMatcher: []`), or `""` for unknown/`generic`.
    - *Acceptance:* `npm run compile` passes; `buildTasksJson("extension")` contains `"label": "Compile"` and `"command": "npm run compile"`; `buildTasksJson("generic") === ""`; `buildTasksJson("nope") === ""`.
  - **S-002** — `src/workspaceScaffold.ts`: extend `buildScaffoldPrompt()` — when the template has a `launchTask`, add steps: write `.vscode/tasks.json` via `write_file` with exactly the `buildTasksJson` content (fenced block), then ask the user whether to run the launch task now and, if yes, run it via `run_command`. Keep the existing optional `npm install` step (renumber). `generic` prompt unchanged.
    - *Acceptance:* `npm run compile` passes; `buildScaffoldPrompt("extension", "x")` contains `.vscode/tasks.json` and `run_command`; `buildScaffoldPrompt("generic", "x")` does NOT contain `tasks.json`.
  - **S-003** — `scripts/smoke-test.js`: add a `ws-s5` block after the existing `ws-s1` block (~line 3355) requiring `buildTasksJson` from `out/workspaceScaffold.js` and asserting the S-001/S-002 acceptance checks.
    - *Acceptance:* `node scripts/smoke-test.js` passes with the new assertions.
- **Acceptance criteria (whole item):** `npm run compile` passes; smoke test passes; `#newWorkspace extension my-ext` prompt now instructs the agent to write `.vscode/tasks.json` (correct launch task) and to ask the user before running it via `run_command`; `generic` scaffold prompt unchanged.
- **Risks / open questions:**
  - Task labels/commands chosen per template (`Compile`/`Start`/`Dev`); if different labels are preferred, only S-001 data changes.
  - `run_command` 60s timeout is fine for compile/start smoke runs; no change needed.
  - No new setting — reuses the `llm.chat.newWorkspace.enabled` gate (matches "small extension" scope).
- **Next item:** 1.100-29 · Generate alt text in HTML or Markdown (AI code action).


## Status

- **Current item:** 1.100-19 (planned: 3 slices — S-001/S-002 in `src/workspaceScaffold.ts`, S-003 smoke)
- **Next step:** dispatch the Coder for 1.100-19 S-001
- **Last updated:** 2026-10-23
- **Last commit:** (planner commit for the 1.100-19 plan)
- **Build state:** n/a (planner does not build)

## Plans delivered (recap)

Each item was split into slices of ≤3 files; plans themselves are pruned (see git history).

**1.98 (complete, tag `changelog-1.98`):** editable `run_command` approval card + "modified by user" badge (1); `notebook_edit` tool, 5 actions, `src/notebook.ts`, `.ipynb` rendered as cells (2); `#codebase` sweep (8); `#problems` (9); `#folder:<name>` (10); `llm.changeCompletionsModel` + `llm.completions.model` (12); image attachments + `llm.chat.vision.enabled` (14); status-bar overview `llm.showStatusOverview` + `llm.statusBar.enabled` (15). Already built: 3, 4, 6. Smoke ends ~371.

**1.99 (complete, tag `changelog-1.99`):** MCP client over stdio `src/mcp.ts` + `src/mcpManager.ts` (2); `think` tool (3); `fetch_url` + `#fetch` `src/fetchTool.ts` (4); `find_usages` + `#usages` `src/usages.ts` (5); `#newWorkspace` scaffolds `src/workspaceScaffold.ts` (6); tool approvals with session/workspace/global scope `ApprovalStore` (8); Ask/Agent/Edit mode picker (10); reusable prompt files `llm.usePrompt` `src/prompts.ts` (12); URL/bmp images (13); completions status + `llm.toggleCompletions` (16); `#searchResults` (19); explicit save on keep (23); nbformat 4.5 cell ids (27); `new_notebook` tool + `/newNotebook` (28); cell outputs to chat `llm.addCellOutput` (29). Already built: 1, 24. Smoke ends ~584.

**1.100 (in progress, tag `changelog-1.100`):** done so far: instructions files `.instructions.md` with `applyTo` auto-attach, `src/instructions.ts` (1); prompt-file front matter `mode`/`tools`, `llm.runPrompt` + Play button, languages `llm.prompt`/`llm.instructions` (2); `apply_patch` tool `src/patch.ts` (3); `#fetch` as Markdown with `llm.chat.fetch.maxTokens` token trim (7). Chat input pills: `ContextPill` + `parsePillRefs`/`dedupePills` in `src/context.ts`, pill strip UI in `src/chat/webview.ts`, `postContextPills()`/`remove_pill` in `src/chat/ChatViewProvider.ts`, grouped `llm.addContext` quick-pick in `src/extension.ts` (8). Smoke 690.
