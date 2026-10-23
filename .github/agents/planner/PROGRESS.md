# Planner — Progress Memory

> **This file is the agent's persistent memory.** The `Planner` agent
> (`.github/agents/planner.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Turn each changelog feature (from the Changelog Researcher's backlog) into a concrete,
step-by-step implementation plan for the `llm` VS Code extension. The planner does NOT write
code — only the Coder writes code.

## Status

- **Current item:** 1.99-29 (Cell output to chat — `llm.addCellOutput`) — **complete** (2026-10-23, 4 slices S1–S4 done)
- **Next step:** item 1.99-29 complete — v1.99 backlog exhausted; next: v1.100 research
- **Last updated:** 2026-10-23
- **Last commit:** — (no planner commits yet)
- **Build state:** n/a (planner does not build)

### Item 1.99-28 — AI notebook editing improvements — new notebook tool

**Changelog:** VS Code 1.99 — "AI notebook editing improvements": a dedicated tool that plans and creates a new Jupyter notebook from a chat query; `/newNotebook` in ask mode; notebook tool in agent/edit mode. (Navigate/undo AI edits sub-features are VS Code core notebook UI — skipped.)
**Planned:** 2026-10-22, 5 slices S1–S5
**Baseline smoke:** 546 assertions

**Design decisions (justified):**
1. **Model-free planning, deterministic cells.** `planNewNotebook(query)` (pure, in `src/notebook.ts`) plans a fixed 3-cell skeleton from the query: markdown title cell, markdown objective cell (full query), starter code cell. Rationale: works with a free local LLM with zero extra model round-trips; the agent can then fill cells with the existing `notebook_edit` tool.
2. **Typed cell markers.** `createNotebook`'s marker line gains an optional type: `<<<CELL>>>` (code, unchanged default) and `<<<CELL:markdown>>>` / `<<<CELL:code>>>`. Whitespace-only chunks are dropped. Backward compatible.
3. **One shared creation path.** `ToolExecutor.createNewNotebook(relPath, query): Promise<string>` is the single implementation. The `new_notebook` agent tool case and the `/newNotebook` chat command both call it.
4. **`/newNotebook` is host-side (ask-mode safe).** Ask mode never sends tools, so the command intercepts `/newNotebook <query>` before pushing to history, creates the file directly, posts a `notebook_created` webview message, and returns (no model round-trip).
5. **`new_notebook` is mutating** → flows through the existing `llm.tools.requireApproval` approval gate.
6. **Setting:** `llm.chat.newNotebook.enabled` (default `true`), gates only the chat command.

**Files to touch:** `src/notebook.ts`, `src/tools.ts`, `src/tools/ToolExecutor.ts`, `src/presets.ts`, `src/config.ts`, `src/chat/ChatViewProvider.ts`, `src/chat/webview.ts`, `package.json`, `scripts/smoke-test.js`

**Slices:**

- **1.99-28.S1** — `src/notebook.ts`: typed cell markers + `planNewNotebook` + `notebookNameFromQuery` (pure).
  Files: `src/notebook.ts`, `scripts/smoke-test.js`.
  1. `createNotebook`: replace the single-marker split with a `matchAll` scan of `/^\s*<<<CELL(?::(markdown|code))?>\s*$/gm`; cell 0 = text before the first marker (always `code`), each marker starts a cell of its type (default `code`), trailing text is a `code` cell; drop whitespace-only cell sources; keep `id: cell-<index>`, `nbformat 4 / minor 5`, and the `replace(/^\n+/, "")` source trim.
  2. `export function planNewNotebook(query: string): string` — returns the marker-separated source: `<<<CELL:markdown>>>\n# <title>` + `<<<CELL:markdown>>>\n## Objective\n\n<query>` + `<<<CELL>>>\n# TODO: implement` (title = first line of trimmed query, ≤ 80 chars, fallback `"New notebook"`).
  3. `export function notebookNameFromQuery(query: string): string` — first line, lowercased, `[^a-z0-9]+` → `-`, trimmed dashes, ≤ 40 chars, fallback `"notebook"`.
  4. Smoke: new section `// 53) new_notebook planning (1.99-28)`. 9 assertions, prefix `nbnew-s1:`.
  Acceptance: `npm run compile` passes; smoke → **555** (546 + 9).

- **1.99-28.S2** — `new_notebook` agent tool (schema + executor).
  Files: `src/tools.ts`, `src/tools/ToolExecutor.ts`, `scripts/smoke-test.js`.
  1. `src/tools.ts`: add `new_notebook` entry to `CODE_TOOLS` after `notebook_edit` — params `path` + `query`, `required: ["path","query"]`.
  2. `src/tools.ts` `isMutatingTool`: add `name === "new_notebook"`.
  3. `src/tools/ToolExecutor.ts`: import `createNotebook`, `planNewNotebook`, `parseNotebook` from `../notebook`; add `public async createNewNotebook(relPath, query): Promise<string>` — `resolveSafe`, empty-query guard, exists guard, `createNotebook(planNewNotebook(query))`, snapshot bookkeeping, `mkdir -p` + `writeFile`, `recordChange`, return message.
  4. `execute` switch: `case "new_notebook"`.
  5. Smoke: section `// 54)`. 5 assertions, prefix `nbnew-s2:`.
  Acceptance: compile passes; smoke → **560** (555 + 5).

- **1.99-28.S3** — Setting plumbing: `llm.chat.newNotebook.enabled`.
  Files: `src/presets.ts`, `src/config.ts`, `scripts/smoke-test.js`.
  1. `src/presets.ts`: add `newNotebookEnabled: boolean;` to `LlmSettings`.
  2. `src/config.ts`: `newNotebookEnabled: c.get<boolean>("chat.newNotebook.enabled", true)`.
  3. Smoke: section `// 55)`. 3 assertions, prefix `nbnew-s3:`.
  Acceptance: compile passes; smoke → **563** (560 + 3).

- **1.99-28.S4** — `/newNotebook` chat command (host-side) + `notebook_created` webview notice.
  Files: `src/chat/ChatViewProvider.ts`, `src/chat/webview.ts`, `scripts/smoke-test.js`.
  1. `ChatViewProvider.ts` `handleSend`: intercept `/^\/newNotebook[ \t]+([\s\S]+)$/i.exec(text)`. When matched: check `settings.newNotebookEnabled`, derive `relPath = "notebooks/" + notebookNameFromQuery(query) + ".ipynb"`, call `this.toolExecutor.createNewNotebook(relPath, query)`, post `{ type: "notebook_created", ok, path, message }`, return (no history push, no model round-trip).
  2. `webview.ts`: `case 'notebook_created':` — render notice with ✅/⚠️ prefix, `textContent` (never innerHTML).
  3. Smoke: section `// 56)`. 3 assertions, prefix `nbnew-s4:`.
  Acceptance: compile passes; smoke → **566** (563 + 3).

- **1.99-28.S5** (Done — item 1.99-28 complete) — `package.json` setting schema + final smoke.
  Files: `package.json`, `scripts/smoke-test.js`.
  1. `package.json`: add `llm.chat.newNotebook.enabled` (boolean, default true).
  2. Smoke: section `// 57)`. 2 assertions, prefix `nbnew-s5:`.
  Acceptance: compile passes; smoke → **568** (546 + 22).

**Total expected assertions after all slices:** 546 → **568** (+22: S1 +9, S2 +5, S3 +3, S4 +3, S5 +2).

**Risks:**
- Name collision: two `/newNotebook` commands with same first line → second fails with "already exists".
- `createNotebook("")` now yields 0 cells (was 1 empty cell). No existing assertion depends on old behavior.
- Existing `"tools: tool names in order"` assertion (14 names) must be updated to 15 in S2.

### Item 1.99-29 — Cell output to chat (text/image)

**Changelog reference:** VS Code 1.99 — "Add cell output to chat" (triple-dot menu / right-click on a notebook cell). Reframed engine-agnostic: a command `llm.addCellOutput` that reads the active notebook's cell outputs and injects them into the chat input (text context + image attachments).

**Design decisions (justified):**
1. **Pure extraction in `src/notebook.ts`.** `extractCellOutputs(cell: NbCell): { text: string; images: string[] }` operates on the raw nbformat `outputs` array (the shape `parseNotebook` already preserves). No vscode import → smoke-testable against `out/notebook.js`.
2. **Text formatting:** `stream` → `data["text"]` (array-of-strings joined, or string); `error` → `ename: evalue` + first 10 `traceback` lines; `execute_result`/`display_data` → `data["text/plain"]` (or `data["text"]`). Each block wrapped in a fenced block (```` ~~~~ ```` if content contains ```` ``` ````) with a kind label. Total text capped at 20 000 chars with a `… [truncated]` marker.
3. **Images:** `display_data`/`execute_result` with `data["image/png"|"image/jpeg"|"image/gif"|"image/webp"]` (base64) → `data:<mime>;base64,<b64>` data URLs. Max 4 images (matches webview `MAX_IMAGES`), each ≤ 10 MB base64 (matches `MAX_IMAGE_BYTES` after ~4/3 inflation). These data URLs pass the existing `handleSend` sanitizer unchanged.
4. **Injection reuses existing webview plumbing.** New host→webview message `cell_output_inject { text, images }`: text is prepended to `#input` exactly like `prompt_inject` (L2008); images are pushed into `pendingImages` (respecting `MAX_IMAGES`/`MAX_IMAGE_BYTES`/`IMAGE_TYPES`) + `renderAttachStrip()`. No new send path — the user reviews and hits Send.
5. **Active cell = last code cell with outputs.** VS Code's API does not expose the *active* notebook cell (no `activeNotebookCell` on `NotebookEditor`); the command reads the `.ipynb` file of `vscode.window.activeNotebookEditor` via `workspace.openTextDocument`, parses with `parseNotebook`, and picks the last code cell whose `outputs` is non-empty. Documented limitation (risk R1).
6. **Vision gate respected:** when `llm.chat.vision.enabled` is off, images are dropped (text still injected).
7. **Setting:** `llm.chat.addCellOutput.enabled` (boolean, default `true`) gates the command, consistent with the other `llm.chat.*.enabled` toggles. Read directly via `getConfiguration` in the command (matching the `llm.usePrompt` pattern) — no presets/config change needed.

**Files to touch:** `src/notebook.ts`, `src/chat/webview.ts`, `src/extension.ts`, `package.json`, `scripts/smoke-test.js`

**Baseline smoke:** 568 assertions.

**Slices:**

- **1.99-29.S1** — `extractCellOutputs` (pure).
  Files: `src/notebook.ts`, `scripts/smoke-test.js`.
  1. `src/notebook.ts`: add `export interface CellOutputContext { text: string; images: string[] }` and `export function extractCellOutputs(cell: NbCell): CellOutputContext`. Iterate `cell.outputs ?? []` (skip non-objects). Per `output_type`:
     - `stream`: `data.text` (string, or string[] joined).
     - `error`: `${ename ?? "Error"}: ${evalue ?? ""}` + `\n` + first 10 `traceback` entries (each string or string[] joined).
     - `execute_result` / `display_data`: `data["text/plain"] ?? data["text"]` (string or string[] joined); then for each of `image/png, image/jpeg, image/gif, image/webp` present in `data` (string value only): push `data:<mime>;base64,<value>` if `images.length < 4` and `value.length <= 10 * 1024 * 1024`.
     Non-empty text blocks are rendered as `<kind>:\n<fence>\n<content>\n<fence>` (fence = `~~~~` if content contains ` ``` `, else ` ``` `) and joined with `\n\n`; the joined result is sliced to 20 000 chars + `\n… [truncated]` when cut. Returns `{ text, images }` (both may be empty).
  2. `scripts/smoke-test.js`: new section `// 58) cell output extraction (1.99-29.S1)`, prefix `cellout-s1:`, 8 assertions:
     - stream output → text contains the streamed line and a `stream:` label;
     - error output → text contains `ename`, `evalue`, and a traceback line;
     - display_data with `text/plain` + `image/png` → text contains the plain text AND `images[0]` starts with `data:image/png;base64,`;
     - execute_result image → captured as data URL;
     - no outputs → `{ text: "", images: [] }`;
     - 5 image outputs → `images.length === 4` (cap);
     - image base64 > 10 MB (synthetic string) → not included;
     - text > 20 000 chars → result text length ≤ 20 000 + marker and ends with `… [truncated]`.
  Acceptance: `npm run compile` passes; smoke → **576** (568 + 8).

- **1.99-29.S2** — Webview: `cell_output_inject` handler.
  Files: `src/chat/webview.ts`, `scripts/smoke-test.js`.
  1. `src/chat/webview.ts`: in `handleHostMessage`, add `case 'cell_output_inject':` next to `case 'prompt_inject':` (~L2008). Guard `inputEl`. Text: `const t = String(msg.text ?? ''); if (t) { inputEl.value = existing ? t + '\n\n' + existing : t; }` (same prepend pattern as `prompt_inject`). Images: `Array.isArray(msg.images)` → for each string matching `/^data:image\/(jpeg|png|gif|webp|bmp);base64,/` with `length <= 14 * 1024 * 1024`: if `pendingImages.length < MAX_IMAGES` push `{ name: 'cell-output-' + (pendingImages.length + 1), dataUrl: img }`; then `renderAttachStrip()` if any were added. Focus `inputEl`.
  2. `scripts/smoke-test.js`: section `// 59) cell_output_inject webview (1.99-29.S2)`, prefix `cellout-s2:`, 2 assertions (read `src/chat/webview.ts` as text): contains `cell_output_inject`; and `webviewSrc.slice(webviewSrc.indexOf("cell_output_inject")).includes("renderAttachStrip")` (handler region reaches the attach-strip render).
  Acceptance: `npm run compile` passes; smoke → **578** (576 + 2).

- **1.99-29.S3** — `llm.addCellOutput` command (host).
  Files: `src/extension.ts`, `scripts/smoke-test.js`.
  1. `src/extension.ts`: import `parseNotebook, extractCellOutputs` from `./notebook`. In the commands block, add `vscode.commands.registerCommand("llm.addCellOutput", async () => { ... })` modeled on `llm.usePrompt` (L198):
     - `const enabled = vscode.workspace.getConfiguration("llm").get<boolean>("chat.addCellOutput.enabled", true);` if off → `showInformationMessage("llm.chat.addCellOutput.enabled is off.")`, return.
     - `const editor = vscode.window.activeNotebookEditor;` if `!editor` → `showInformationMessage("No active notebook — open a notebook with cell outputs first.")`, return.
     - `const doc = await vscode.workspace.openTextDocument(editor.notebook.uri); const parsed = parseNotebook(doc.getText());` if `!parsed` → info message "Could not parse notebook.", return.
     - `const cell = [...parsed.cells].reverse().find((c) => c.cell_type === "code" && Array.isArray(c.outputs) && c.outputs.length > 0);` if none → info message "The notebook has no cell outputs yet — run a cell first.", return.
     - `const { text, images } = extractCellOutputs(cell);` if both empty → info message "That cell's outputs are empty.", return.
     - Vision gate: `const visionEnabled = ...get<boolean>("chat.vision.enabled", true); const imgs = visionEnabled ? images : [];`
     - `provider.postMessage({ type: "cell_output_inject", text, images: imgs });` then `await vscode.commands.executeCommand("workbench.view.llm");`
  2. `scripts/smoke-test.js`: section `// 60) llm.addCellOutput command (1.99-29.S3)`, prefix `cellout-s3:`, 3 assertions (read `out/extension.js` as text): contains `"llm.addCellOutput"`; contains `activeNotebookEditor`; contains `extractCellOutputs` and `cell_output_inject`.
  Acceptance: `npm run compile` passes; smoke → **581** (578 + 3).

- **1.99-29.S4** (Done — item 1.99-29 complete) — `package.json` command + setting schema + final smoke.
  Files: `package.json`, `scripts/smoke-test.js`.
  1. `package.json` `contributes.commands`: add `{ "command": "llm.addCellOutput", "title": "LLM: Add Cell Output to Chat", "icon": "$(notebook)" }`.
  2. `package.json` `contributes.configuration.properties`: add `llm.chat.addCellOutput.enabled` (boolean, default `true`, description: "Enable the 'LLM: Add Cell Output to Chat' command (llm.addCellOutput), which injects the active notebook's cell outputs (text and images) into the chat input.").
  3. `scripts/smoke-test.js`: section `// 61) addCellOutput schema (1.99-29.S4)`, prefix `cellout-s4:`, 3 assertions: `pkgJson.contributes.commands` contains `llm.addCellOutput` with title including "Cell Output"; `pkgJson.contributes.configuration.properties["llm.chat.addCellOutput.enabled"]` is boolean with default `true`; its description mentions `llm.addCellOutput`.
  Acceptance: `npm run compile` passes; smoke → **584** (568 + 16).

**Total expected assertions after all slices:** 568 → **584** (+16: S1 +8, S2 +2, S3 +3, S4 +3).

**Overall acceptance (Tester):** with a `.ipynb` open in a notebook editor whose last code cell has outputs, running `llm.addCellOutput` (command palette or the notebook-editor menu) opens the LLM chat view, prepends a formatted text block (stream/error/text-plain, fenced, truncated at 20k) to the chat input, and attaches up to 4 image outputs as thumbnails in the attach strip; pressing Send sends them through the existing vision pipeline. No active notebook / no outputs / parse failure / setting off → info message, no crash. `npm run compile` clean; `node scripts/smoke-test.js` → 584 PASS.

**Risks / open questions:**
- **R1 — "active cell" ambiguity:** VS Code does not expose the active notebook cell via API. Decision: use the **last code cell with outputs**.
- **R2 — Untitled/unsaved notebooks:** `openTextDocument(editor.notebook.uri)` works for untitled docs too (returns the in-memory doc); no special handling needed.
- **R3 — Large outputs:** 20k-char text cap + 4×10MB image cap keep the chat input and request body bounded; the existing `handleSend` sanitizer (14MB data-URL cap) is a second line of defense.
- **R4 — `execute_result` images:** some kernels emit images only in `display_data`; both types are handled, so no loss.

