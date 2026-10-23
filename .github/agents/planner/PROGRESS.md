# Planner — Progress Memory

> **This file is the agent's persistent memory.** The `Planner` agent
> (`.github/agents/planner.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Turn each changelog feature (from the Changelog Researcher's backlog) into a concrete,
step-by-step implementation plan for the `llm` VS Code extension. The planner does NOT write
code — only the Coder writes code.

## Active plan — 1.100-30 · Drag and drop cell outputs to chat (VS Code 1.100)

- **Status:** Planned — 2026-10-23
- **Changelog:** Notebook cell outputs (image and text) can be dragged into the Chat view to attach them; text outputs require holding Alt to avoid clashing with text selection. UX extension of 1.99-29 (`llm.addCellOutput`).
- **Approach:** `vscode.window.registerDragAndDropController` (VS Code 1.80+) targeting view container `"llm"` with `dropMimeTypes: ["notebook.cellOutput"]`. Reuses the existing `cell_output_inject` webview message (1.99-29) — **no webview changes**.
- **Grounding (verified):**
  - No drag-and-drop code exists yet (grep `registerDragAndDropController|enableDrop` → 0 hits).
  - Chat panel: `WebviewViewProvider` in `src/chat/ChatViewProvider.ts:106`, view container `"llm"` (`package.json:94-101`).
  - `llm.addCellOutput` (`src/extension.ts:566`): gate `llm.chat.addCellOutput.enabled`, `extractCellOutputs(cell)` (`src/notebook.ts:415` → `{ text, images }` base64 data URLs), vision gate `llm.chat.vision.enabled`, posts `cell_output_inject`.
  - Webview handles `cell_output_inject` (`src/chat/webview.ts:2199`): text → input, images → `pendingImages` (cap `MAX_IMAGES = 4`) → attach strip.
  - Smoke gate: `scripts/smoke-test.js:6496-6500` (`assertCount !== 787`).
- **Files to touch:** `src/notebook.ts`, `src/extension.ts`, `package.json`, `scripts/smoke-test.js`.
- **Slices:**
  - **S-001** — `src/notebook.ts` (1 file): add `export function extractNotebookCellOutput(output: NotebookCellOutputLike): { text: string; images: string[] }` where `NotebookCellOutputLike` is a **structural** type (`{ items: { mime: string; data(): Promise<Uint8Array | Buffer> }[] }`) — `src/notebook.ts` is a PURE module (no `vscode` import; the `vscode.NotebookCellOutput` instance is structurally compatible and is cast at the call site in `extension.ts`). `text/plain` items → `text`; `image/png|jpeg|gif|webp|bmp` items → `data:<mime>;base64,...` data URLs. Same shape as `extractCellOutputs`.
    - *Acceptance:* `npm run compile` passes; `src/notebook.ts` still has no `vscode` import; the helper is unit-testable from the smoke test against `out/notebook.js` with a fake output object.
  - **S-002** — `src/extension.ts` + `package.json` (2 files):
    - `package.json`: new setting `llm.chat.cellOutputDrop.enabled` (boolean, default `true`).
    - `extension.ts`: in `activate()`, register `vscode.window.registerDragAndDropController({ target: { viewContainerId: "llm" }, handleDrop: async (e) => { … } }, { dropMimeTypes: ["notebook.cellOutput"] })`. `handleDrop`: return if `llm.chat.cellOutputDrop.enabled` is off; for each item with `type === "notebook.cellOutput"`, `extractNotebookCellOutput(item.data as unknown as NotebookCellOutputLike)`; **Alt rule** — text-only output (`text` non-empty, no images) is skipped unless `e.modifiers.alt`; images attach on plain drop; gate images on `llm.chat.vision.enabled`; post `{ type: "cell_output_inject", text, images }` to the chat provider.
    - *Acceptance:* `npm run compile` passes; setting present; controller targets `"llm"`; Alt rule present.
  - **S-003** — `scripts/smoke-test.js` (1 file): 4 new assertions — (1) `extension.ts` includes `registerDragAndDropController` + `viewContainerId: "llm"`; (2) `extension.ts` includes `notebook.cellOutput` + `e.modifiers.alt`; (3) `notebook.ts` includes `extractNotebookCellOutput`; (4) `package.json` has `llm.chat.cellOutputDrop.enabled` (boolean, default `true`). Bump hard gate **787 → 791** (count check + PASS message).
    - *Acceptance:* `node scripts/smoke-test.js` passes at 791/791.
- **Acceptance criteria (whole item):** compile passes; smoke 791/791; image output attaches on plain drop; text-only output attaches only with Alt; both gates work; no new runtime deps; no webview changes.
- **Risks / open questions:**
  - `e.modifiers.alt` availability (safe failure: text-only never attaches).
  - `"notebook.cellOutput"` mime literal (safe failure: controller doesn't fire).
  - Multiple outputs per drag handled by iterating items (webview caps at 4 images).
- **Next item:** 1.100-31 · Notebook tools for agent mode (followed by 1.100-38 · MCP Tool Annotations).


## Status

- **Current item:** 1.100-30 (planned: 3 slices — S-001 in `src/notebook.ts`, S-002 in `src/extension.ts` + `package.json`, S-003 smoke 787→791)
- **Next step:** dispatch the Coder for 1.100-30 S-001
- **Last updated:** 2026-10-23
- **Last commit:** (planner commit for the 1.100-30 plan)
- **Build state:** n/a (planner does not build)

## Plans delivered (recap)

Each item was split into slices of ≤3 files; plans themselves are pruned (see git history).

**1.98 (complete, tag `changelog-1.98`):** editable `run_command` approval card + "modified by user" badge (1); `notebook_edit` tool, 5 actions, `src/notebook.ts`, `.ipynb` rendered as cells (2); `#codebase` sweep (8); `#problems` (9); `#folder:<name>` (10); `llm.changeCompletionsModel` + `llm.completions.model` (12); image attachments + `llm.chat.vision.enabled` (14); status-bar overview `llm.showStatusOverview` + `llm.statusBar.enabled` (15). Already built: 3, 4, 6. Smoke ends ~371.

**1.99 (complete, tag `changelog-1.99`):** MCP client over stdio `src/mcp.ts` + `src/mcpManager.ts` (2); `think` tool (3); `fetch_url` + `#fetch` `src/fetchTool.ts` (4); `find_usages` + `#usages` `src/usages.ts` (5); `#newWorkspace` scaffolds `src/workspaceScaffold.ts` (6); tool approvals with session/workspace/global scope `ApprovalStore` (8); Ask/Agent/Edit mode picker (10); reusable prompt files `llm.usePrompt` `src/prompts.ts` (12); URL/bmp images (13); completions status + `llm.toggleCompletions` (16); `#searchResults` (19); explicit save on keep (23); nbformat 4.5 cell ids (27); `new_notebook` tool + `/newNotebook` (28); cell outputs to chat `llm.addCellOutput` (29). Already built: 1, 24. Smoke ends ~584.

**1.100-29 (planned, built):** generate alt text code action — pure helpers in `src/codeaction.ts` + QuickFix "Generate alt text" with one-shot vision `chatStream` resolve + `llm.codeAction.altText.enabled` (3 slices: S-001 `src/codeaction.ts`, S-002 provider + `package.json`, S-003 smoke 780→787).

**1.100-19 (planned, built):** create/launch tasks after `#newWorkspace` — `launchTask` per template + `buildTasksJson` + scaffold-prompt steps (3 slices: S-001/S-002 in `src/workspaceScaffold.ts`, S-003 smoke).

**1.100 (in progress, tag `changelog-1.100`):** done so far: instructions files `.instructions.md` with `applyTo` auto-attach, `src/instructions.ts` (1); prompt-file front matter `mode`/`tools`, `llm.runPrompt` + Play button, languages `llm.prompt`/`llm.instructions` (2); `apply_patch` tool `src/patch.ts` (3); `#fetch` as Markdown with `llm.chat.fetch.maxTokens` token trim (7). Chat input pills: `ContextPill` + `parsePillRefs`/`dedupePills` in `src/context.ts`, pill strip UI in `src/chat/webview.ts`, `postContextPills()`/`remove_pill` in `src/chat/ChatViewProvider.ts`, grouped `llm.addContext` quick-pick in `src/extension.ts` (8). Smoke 690.
