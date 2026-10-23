# Planner — Progress Memory

> **This file is the agent's persistent memory.** The `Planner` agent
> (`.github/agents/planner.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Turn each changelog feature (from the Changelog Researcher's backlog) into a concrete,
step-by-step implementation plan for the `llm` VS Code extension. The planner does NOT write
code — only the Coder writes code.

## Status

- **Current item:** 1.100-2 (Prompt files improvements) — **Done** (2026-10-23, all 6 slices S1–S6 complete)
- **Next step:** plan next pending backlog item
- **Last updated:** 2026-10-23
- **Last commit:** (planner commit for the 1.100-2 plan)
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

### Item 1.100-1 — Instructions files (`.instructions.md`)

**Changelog reference:** VS Code 1.100 — "Instructions files": a parallel `.instructions.md` file type alongside custom instructions, with `applyTo` front-matter globs that auto-attach the file when the chat context references matching files, plus commands to attach a discovered file to chat and to scaffold a new one. Reframed engine-agnostic for the `llm` extension.

**UI/behavior notes:**
- **Auto-attach:** invisible to the user — when the active file or an `@tagged` file matches an `.instructions.md` file's `applyTo` glob, the file's body (front-matter stripped) is folded into the system prompt, and the file path appears in the existing `instructions` indicator (host→webview `{ type: "instructions", files: [...] }`).
- **`llm.attachInstructions`:** QuickPick titled "LLM: Attach Instructions File" listing discovered files (label = front-matter `title` or filename, description = workspace-relative path). Picking one prepends its body to the chat input (same UX as `llm.usePrompt`) and opens the LLM view.
- **`llm.newInstructionsFile`:** input box → creates `.instructions/<name>.instructions.md` under the workspace root with a front-matter template, then opens it.
- No new webview chrome; the only new host→webview message is `instructions_inject` (text prepend, identical pattern to `prompt_inject` at `webview.ts` L2008).

**Files to touch:** `src/instructions.ts`, `src/presets.ts`, `src/config.ts`, `src/chat/ChatViewProvider.ts`, `src/chat/webview.ts`, `src/extension.ts`, `package.json`, `scripts/smoke-test.js`

**Baseline smoke:** 584 assertions.

**Slices:**

- **1.100-1.S1** — Pure core in `src/instructions.ts` (+10 smoke). — **DONE**
  Files: `src/instructions.ts`, `scripts/smoke-test.js`.
  1. `src/instructions.ts` — add (all pure, no vscode/fs):
     - `export interface InstructionsFileMeta { applyTo?: string; title?: string }`
     - `export function parseInstructionsFrontMatter(content: string): { meta: InstructionsFileMeta; body: string }` — front-matter exists only when the **first line is exactly `---`** (after trimming a BOM). Find the next line that is exactly `---` (or `...`); if none, treat the whole content as body with empty meta. Inside: parse simple `key: value` lines; only `applyTo` and `title` are honored (others ignored); values trimmed and stripped of matching surrounding single/double quotes. `body` = everything after the closing delimiter, with leading newlines trimmed. No front-matter → `{ meta: {}, body: content }`.
     - `export function globToRegExp(glob: string): RegExp` — hand-rolled (no `glob`/`minimatch`): scan left→right; `**/` → `(?:.*/)?`, `**` → `.*`, `*` → `[^/]*`, `?` → `[^/]`, every other character regex-escaped. Anchored `^…$`.
     - `export function applyToMatches(applyTo: string, filePath: string): boolean` — empty `applyTo` → `false`; split `applyTo` on `|` (alternation of globs); normalize `filePath` to forward slashes and strip a leading `./`; true if any alternative's `globToRegExp` matches.
     - `export function pickAutoAttachFiles(files: ReadonlyArray<{ path: string; applyTo?: string }>, contextPaths: ReadonlyArray<string>): string[]` — return `files` (in order, deduped by path) whose `applyTo` is non-empty and matches **any** `contextPaths` entry. Files without `applyTo` are never auto-attached (attachable only via the command).
     - `export const INSTRUCTIONS_FILE_TEMPLATE: string` = `"---\napplyTo: src/**/*.ts\n---\n\n# My Instructions\n\n<!-- Instructions the LLM should follow when working on files\n     matching the applyTo glob above. -->\n"`
     - `export function instructionsFileName(name: string): string` — trim; replace `[^a-zA-Z0-9._-]` runs with `-`; strip leading `-`/`.`; fallback `"instructions"`; append `.instructions.md` if the result doesn't already end with it.
  2. `scripts/smoke-test.js` — new section `// 62) instructions files core (1.100-1.S1)`, `require("../out/instructions.js")`, **10 assertions**, prefix `instrf-s1:`:
     1. `parseInstructionsFrontMatter` parses `applyTo` + `title` and returns the body after the closing `---`.
     2. No front-matter → `meta` empty, `body === content`.
     3. Unclosed front-matter (opening `---`, no close) → empty meta, body = full content.
     4. Quoted values (`applyTo: "src/**/*.ts"`) are unquoted.
     5. `globToRegExp("**/*.ts")` matches `a/b/c.ts` and `c.ts`.
     6. `globToRegExp("src/*.ts")` matches `src/a.ts` but **not** `src/a/b.ts` (`*` doesn't cross `/`).
     7. `applyToMatches("src/**/*.ts", "src/x/y.ts")` true; `applyToMatches("src/**/*.ts", "lib/y.ts")` false.
     8. `applyToMatches` alternation: `"src/**/*.ts | lib/**/*.py"` matches both sides.
     9. `pickAutoAttachFiles` returns only matching files, preserves order, dedupes, and skips files without `applyTo`.
     10. `INSTRUCTIONS_FILE_TEMPLATE` round-trips: `parseInstructionsFrontMatter(INSTRUCTIONS_FILE_TEMPLATE)` yields `meta.applyTo === "src/**/*.ts"` and non-empty body; `instructionsFileName("My File!")` === `"My-File.instructions.md"`.
  Acceptance: `npm run compile` passes; smoke → **594** (584 + 10).

- **1.100-1.S2** — Settings plumbing (+3 smoke). — **DONE**
  Files: `src/presets.ts`, `src/config.ts`, `scripts/smoke-test.js`.
  1. `src/presets.ts` — after `promptFiles: string[];` (L96) add to `LlmSettings`: `instructionsFilesEnabled: boolean;` and `instructionsFilesLocations: string[];` (with doc comments).
  2. `src/config.ts` — after `promptFiles` (L74) add: `instructionsFilesEnabled: c.get<boolean>("instructionsFiles.enabled", true),` and `instructionsFilesLocations: c.get<string[]>("instructionsFiles.locations", ["**/*.instructions.md"]),`
  3. `scripts/smoke-test.js` — section `// 63) instructionsFiles settings (1.100-1.S2)`, **3 assertions**, prefix `instrf-s2:` (static source assertions — `config.ts`/`presets.ts` import vscode and can't be required):
     1. `src/config.ts` contains `c.get<boolean>("instructionsFiles.enabled", true)`.
     2. `src/config.ts` contains `c.get<string[]>("instructionsFiles.locations", ["**/*.instructions.md"])`.
     3. `src/presets.ts` contains both `instructionsFilesEnabled: boolean;` and `instructionsFilesLocations: string[];`.
  Acceptance: `npm run compile` passes; smoke → **597** (594 + 3).

- **1.100-1.S3** — `applyTo` auto-attach in `ChatViewProvider.ts` (+3 smoke). — **DONE**
  Files: `src/chat/ChatViewProvider.ts`, `scripts/smoke-test.js`.
  1. `src/chat/ChatViewProvider.ts`:
     - Extend the existing `../instructions` import (L55) with `parseInstructionsFrontMatter`, `pickAutoAttachFiles`.
     - New private method `private async loadInstructionsFiles(settings: LlmSettings, contextPaths: string[]): Promise<{ block: string; files: InstructionFile[] }>`:
       - Gate: `if (!settings.instructionsFilesEnabled) return { block: "", files: [] };` and `if (contextPaths.length === 0) return { block: "", files: [] };`
       - `root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath`; no root → empty.
       - Discover: for each glob in `settings.instructionsFilesLocations`, `vscode.workspace.findFiles(glob, "**/node_modules/**", 100)`; dedupe by `fsPath`.
       - Read each (cap `MAX_INSTRUCTION_CHARS`, `truncated` flag), `parseInstructionsFrontMatter(raw)` → collect `{ path: relPath, applyTo: meta.applyTo, body, truncated }` (`relPath = vscode.workspace.asRelativePath(uri)`).
       - `const matched = pickAutoAttachFiles(discovered, contextPaths);`
       - Build `InstructionFile[]` from matched entries using the **body** (front-matter stripped) as `content`; return `{ block: combineInstructions(files), files }`.
     - In `handleSend`, immediately after the tagged-files block (after L1073, before `const contextBlock = buildContextBlock(ctxInput)` at L1074):
       - `const contextPaths = [ctxInput.file?.path, ...(ctxInput.taggedFiles ?? []).map((f) => f.path)].filter((p): p is string => typeof p === "string" && p.length > 0);`
       - `const instrFiles = await this.loadInstructionsFiles(settings, contextPaths);`
       - After `finalContextBlock` is finalized (post-`#newWorkspace`, ~L1205), if `instrFiles.block` is non-empty append it: `finalContextBlock = finalContextBlock ? finalContextBlock + "\n\n" + instrFiles.block : instrFiles.block;`
       - Extend the existing indicator post (L1220): `files: [...instructionFiles.map((f) => f.path), ...instrFiles.files.map((f) => f.path)]`.
  2. `scripts/smoke-test.js` — section `// 64) applyTo auto-attach (1.100-1.S3)`, **3 assertions**, prefix `instrf-s3:` (static source assertions on `src/chat/ChatViewProvider.ts`):
     1. Contains `loadInstructionsFiles`.
     2. Contains `pickAutoAttachFiles` (the pure matcher is actually wired in).
     3. Contains `instructionsFilesEnabled` (the setting gate is checked).
  Acceptance: `npm run compile` passes; smoke → **600** (597 + 3).

- **1.100-1.S4** — Webview `instructions_inject` handler (+2 smoke). — **DONE**
  Files: `src/chat/webview.ts`, `scripts/smoke-test.js`.
  1. `src/chat/webview.ts` — in `handleHostMessage`, add next to `case 'prompt_inject':` (L2008):
     ```js
     case 'instructions_inject': {
         const text = String(msg.content ?? '');
         if (!text) break;
         if (!inputEl) break;
         const existing = inputEl.value;
         inputEl.value = existing ? text + '\n\n' + existing : text;
         inputEl.focus();
         break;
     }
     ```
     (Identical prepend-to-`#input` pattern as `prompt_inject`; `msg.content` is the front-matter-stripped body.)
  2. `scripts/smoke-test.js` — section `// 65) instructions_inject webview (1.100-1.S4)`, **2 assertions**, prefix `instrf-s4:` (read `src/chat/webview.ts` as text):
     1. Contains `instructions_inject`.
     2. `webviewSrc.slice(webviewSrc.indexOf("instructions_inject"))` contains `inputEl.focus` (handler focuses the input after prepending).
  Acceptance: `npm run compile` passes; smoke → **602** (600 + 2).

- **1.100-1.S5** — Commands `llm.attachInstructions` + `llm.newInstructionsFile` (+4 smoke). — **DONE**
  Files: `src/extension.ts`, `scripts/smoke-test.js`.
  1. `src/extension.ts`:
     - Extend the `./instructions` import with `parseInstructionsFrontMatter`, `INSTRUCTIONS_FILE_TEMPLATE`, `instructionsFileName`; reuse `promptTitle` for the QuickPick label.
     - `vscode.commands.registerCommand("llm.attachInstructions", async () => { … })` — modeled on `llm.usePrompt` (L198):
       - `const cfg = vscode.workspace.getConfiguration("llm");` `enabled = cfg.get<boolean>("instructionsFiles.enabled", true)`; off → `showInformationMessage("llm.instructionsFiles.enabled is off.")`, return.
       - `globs = cfg.get<string[]>("instructionsFiles.locations", ["**/*.instructions.md"])` filtered to non-empty strings; none → info message "No instructions file locations configured (llm.instructionsFiles.locations).", return.
       - Discover via `vscode.workspace.findFiles(glob, "**/node_modules/**", 200)` per glob, deduped by `fsPath`.
       - QuickPick items: `label = promptTitle(raw, fsPath)` (first H1 or filename), `description = vscode.workspace.asRelativePath(uri)`, `uri`. Empty discovery → info message "No .instructions.md files found.", return.
       - On pick: `readFile` → `parseInstructionsFrontMatter` → `body = stripPromptComments(meta.body)` (reuse the existing comment-stripping); empty → info message "That instructions file is empty.", return.
       - `provider.postMessage({ type: "instructions_inject", title, content: body });` then `await vscode.commands.executeCommand("workbench.view.llm");`
     - `vscode.commands.registerCommand("llm.newInstructionsFile", async () => { … })` — modeled on "New Prompt File…" (L261–300):
       - `showInputBox({ prompt: "Instructions file name", validateInput: /^[a-zA-Z0-9._-]+$/ })`; cancelled → return.
       - `root = vscode.workspace.workspaceFolders?.[0]?.uri`; none → `showErrorMessage("Open a workspace to create instructions files.")`, return.
       - `target = vscode.Uri.joinPath(root, ".instructions", instructionsFileName(name));` exists guard (`fs.stat` → "That instructions file already exists.", return).
       - `fs.createDirectory(joinPath(root, ".instructions"))` → `fs.writeFile(target, Buffer.from(INSTRUCTIONS_FILE_TEMPLATE, "utf8"))` → `openTextDocument` + `showTextDocument`.
  2. `scripts/smoke-test.js` — section `// 66) instructions commands (1.100-1.S5)`, **4 assertions**, prefix `instrf-s5:` (read `out/extension.js` as text):
     1. Contains `"llm.attachInstructions"`.
     2. Contains `"llm.newInstructionsFile"`.
     3. Contains `instructions_inject` (the attach command posts the webview message).
     4. Contains `INSTRUCTIONS_FILE_TEMPLATE` (the new-file command writes the template).
  Acceptance: `npm run compile` passes; smoke → **606** (602 + 4).

- **1.100-1.S6** — `package.json` schema (+4 smoke). — **DONE**
  Files: `package.json`, `scripts/smoke-test.js`.
  1. `package.json` `contributes.commands` — add:
     - `{ "command": "llm.attachInstructions", "title": "LLM: Attach Instructions File", "icon": "$(book)" }`
     - `{ "command": "llm.newInstructionsFile", "title": "LLM: New Instructions File", "icon": "$(new-file)" }`
  2. `package.json` `contributes.configuration.properties` — add after `llm.promptFiles.locations`:
     - `llm.instructionsFiles.enabled`: `{ "type": "boolean", "default": true, "description": "Discover .instructions.md files and auto-attach them (via their applyTo front-matter glob) when the chat context references matching files." }`
     - `llm.instructionsFiles.locations`: `{ "type": "array", "items": { "type": "string" }, "default": ["**/*.instructions.md"], "description": "Glob patterns (workspace-relative) for .instructions.md files. Pick one via the 'LLM: Attach Instructions File' command (llm.attachInstructions) to prepend it to the chat input." }`
  3. `scripts/smoke-test.js` — section `// 67) instructionsFiles schema (1.100-1.S6)`, **4 assertions**, prefix `instrf-s6:` (against the already-loaded `pkgJson`):
     1. `contributes.commands` contains `llm.attachInstructions` with a title including "Attach Instructions".
     2. `contributes.commands` contains `llm.newInstructionsFile` with a title including "New Instructions File".
     3. `properties["llm.instructionsFiles.enabled"]` is `type: "boolean"` with `default === true`.
     4. `properties["llm.instructionsFiles.locations"]` is `type: "array"` with string items and a `default` array containing `"**/*.instructions.md"`.
  Acceptance: `npm run compile` passes; smoke → **610** (584 + 26).

**Total expected assertions after all slices:** 584 → **610** (+26: S1 +10, S2 +3, S3 +3, S4 +2, S5 +4, S6 +4).

**Overall acceptance (Tester):** With `llm.instructionsFiles.enabled` on and a `.instructions.md` file (e.g. `.instructions/ts.instructions.md` with `applyTo: src/**/*.ts`) in the workspace: opening `src/foo.ts` and sending a chat message folds the file's body into the system prompt and lists the file in the instructions indicator; `@src/foo.ts` tags trigger the same. `llm.attachInstructions` (palette) lists discovered `.instructions.md` files; picking one prepends its body to the chat input and opens the LLM view. `llm.newInstructionsFile` creates `.instructions/<name>.instructions.md` from the template and opens it. Setting off → no discovery, no auto-attach, `llm.attachInstructions` shows the info message. No workspace / no matches → info messages, no crash. `npm run compile` clean; `node scripts/smoke-test.js` → **610 PASS**.

**Risks / open questions:**
- **R1 — `applyTo` semantics:** files **without** `applyTo` are never auto-attached (command-only); files **with** `applyTo` attach only on a context-path match. Context paths = active file + `@tagged` files only (not diagnostics or `#codebase` sweep results).
- **R2 — Default glob breadth:** `**/*.instructions.md` can match files in nested repos; mitigated by the `**/node_modules/**` exclude and the 100-file discovery cap.
- **R3 — Front-matter parser is intentionally minimal** (flat `key: value`, two keys). Nested YAML or other keys are ignored — documented in the template comment.
- **R4 — `promptTitle` reuse** for the QuickPick label means an `.instructions.md` with no H1 falls back to the filename (label shows `foo.instructions`). No behavior risk.
- **R5 — Indicator list growth:** the `instructions` webview message now carries default-instruction + auto-attached paths; the webview already renders a plain list, no change needed.


### Item 1.100-2 — Prompt files improvements (front matter `mode`/`tools`, Play button, run semantics)

**Changelog:** VS Code 1.100 — "Prompt files improvements": `.prompt.md` front matter gains `mode` (`ask`/`edit`/`agent`) and `tools` (agent-mode tool list); `description` front matter for both prompt and instructions file types; Play button in the prompt-file editor toolbar runs the prompt; `Chat: Use Prompt` → `Chat: Run Prompt` with run-immediately semantics; own language IDs ("Prompt"/"Instructions") so untitled docs work as temporary prompt files.
**Planned:** 2026-10-23, 6 slices S1–S6
**Baseline smoke:** 610 assertions

**UI/behavior notes (from image notes):**
- `run-prompt-from-play-button.png` — a **Play button in the editor title bar** of an open `.prompt.md` file; clicking it runs the prompt (mode switch + tool filter + send).
- `run-prompt-as-slash-command.png` — a `/prompt-name` slash command running a prompt file in chat. **Decision: deferred** (see Deviations D5).

**Design decisions (justified):**
1. **Front matter parser in `src/prompts.ts`** (pure, mirrors `parseInstructionsFrontMatter` style from `src/instructions.ts`): first line exactly `---` (after BOM trim), closed by `---`/`...`; honors `mode` (validated against `ask|agent|edit`, invalid → `undefined`), `tools` (comma-separated tool names, trimmed, empties dropped), `description`, `title`. Body = everything after the closing delimiter, leading newlines trimmed. No/unclosed front matter → empty meta, full content as body.
2. **`promptTitle` prefers front-matter `title`** over the first H1 (fallback chain: fm title → H1 → filename).
3. **Run-immediately semantics** = host-side `ChatViewProvider.runPrompt(content, filePath)`: parse front matter → `toolbarStore.setMode(normalizeChatMode(meta.mode))` (default `agent`) → set a `pendingPromptTools` filter → push the stripped body as a user message → `runStream`. No webview round-trip for the Play button path.
4. **Tool filter plumbing:** `RequestConfig.promptTools?: string[]` in `src/request.ts`; when present and non-empty, `body.tools` is filtered to the listed names (MCP tools included if their name matches). Empty/absent → existing behavior. `ChatViewProvider` holds `private pendingPromptTools: string[] | null`, set by `runPrompt`, consumed + cleared in `runStream`.
5. **Webview `prompt_run` handler** (parity/future slash-command path): sets `#mode-select` value (if valid) and triggers the existing send flow with the given text.
6. **Command rename:** `llm.usePrompt` → `llm.runPrompt` (title "LLM: Run Prompt", icon `$(play)`). **Deviation D1:** the old `llm.usePrompt` ID is kept as a thin deprecated alias (one-line `executeCommand("llm.runPrompt")`) so existing keybindings/activation events don't break; the QuickPick title becomes "LLM: Run Prompt" and picking a file now **runs** it (mode switch + tool filter + send) instead of `prompt_inject`-ing it as context.
7. **Play button:** `menus["editor/title"]` entry gated on `resourceFilename =~ /.*\.prompt\.md$/` (works for untitled docs whose name ends in `.prompt.md`, matching the language-ID goal).
8. **Language IDs:** `contributes.languages` — `llm.prompt` (Prompt, `*.prompt.md`) and `llm.instructions` (Instructions, `*.instructions.md`). No grammars (markdown fallback rendering is fine).
9. **`PROMPT_TEMPLATE`** gains a front-matter example (`mode: agent`, `tools: read_file, edit_file`, `description: …`).

**Files to touch:** `src/prompts.ts`, `src/request.ts`, `src/chat/ChatViewProvider.ts`, `src/chat/webview.ts`, `src/extension.ts`, `package.json`, `scripts/smoke-test.js`

**Slices:**

- **1.100-2.S1** — `src/prompts.ts`: front-matter parsing + template (+10 smoke).
  1. Add `export interface PromptFileMeta { mode?: "ask" | "agent" | "edit"; tools?: string[]; description?: string; title?: string }` and `export function parsePromptFrontMatter(content: string): { meta: PromptFileMeta; body: string }` (algorithm per decision 1; `mode` validated via `["ask","agent","edit"].includes(v)`; `tools` split on `,`).
  2. `promptTitle`: new first fallback — `parsePromptFrontMatter(content).meta.title` before the H1 match.
  3. `PROMPT_TEMPLATE` → front-matter example + existing H1/comment body.
  4. Smoke: section `// 68) prompt front matter (1.100-2.S1)`, `require("../out/prompts.js")`, **10 assertions**, prefix `prompt2-s1:` (parse mode/tools/description/title; no front matter; unclosed front matter; invalid mode → `undefined`; quoted values; `tools` with spaces/empties; body after delimiter; `promptTitle` prefers fm title over H1; template round-trips; `stripPromptComments` still works on the body).
  Acceptance: `npm run compile` passes; smoke → **620** (610 + 10).

- **1.100-2.S2** — `src/request.ts`: `promptTools` filter (+3 smoke).
  1. `RequestConfig`: add `promptTools?: string[];` (doc: "when set, restrict `body.tools` to these names").
  2. In the tools block: after building the candidate list (`CODE_TOOLS` + `mcpTools`), if `cfg.promptTools` is a non-empty array → `body.tools = candidates.filter((t) => cfg.promptTools!.includes(t.function.name))`. Ask mode unchanged (`tool_choice: "none"`, no tools).
  3. Smoke: section `// 69) promptTools filter (1.100-2.S2)`, **3 assertions**, prefix `prompt2-s2:` (build a request with `promptTools: ["read_file"]` → `body.tools` has exactly 1 entry named `read_file`; `promptTools: []` → full tool list; ask mode + `promptTools` → no `tools` field).
  Acceptance: compile passes; smoke → **623** (620 + 3).

- **1.100-2.S3** — `src/chat/ChatViewProvider.ts`: `runPrompt` + tool filter wiring (+4 smoke).
  1. Import `parsePromptFrontMatter, stripPromptComments, MAX_PROMPT_CHARS` from `../prompts`.
  2. `private pendingPromptTools: string[] | null = null;`
  3. `public async runPrompt(content: string, filePath: string): Promise<void>`:
     - Guard: `if (this.abortController) { this.postMessage({ type: "error", message: "A request is already running — stop it first." }); return; }`
     - `const { meta, body: rawBody } = parsePromptFrontMatter(content.slice(0, MAX_PROMPT_CHARS));`
     - `const text = stripPromptComments(rawBody);` if empty → `postMessage({ type: "error", message: "That prompt file is empty (or only comments)." })`, return.
     - `await this.toolbarStore.setMode(normalizeChatMode(meta.mode));` (absent → `agent` default via `normalizeChatMode(undefined)`).
     - `this.pendingPromptTools = meta.tools && meta.tools.length > 0 ? meta.tools : null;`
     - `this.history.push({ role: "user", content: text });` then `await this.runStream(readSettings(), this.toolbarStore.get(), false);`
  4. In `runStream`: at the top, `const promptTools = this.pendingPromptTools; this.pendingPromptTools = null;` and pass `promptTools` into the `buildRequestBody` config (alongside `mode: toolbar.mode`).
  5. Smoke: section `// 70) runPrompt (1.100-2.S3)`, **4 assertions**, prefix `prompt2-s3:` (static source assertions on `src/chat/ChatViewProvider.ts`: contains `runPrompt(`; contains `parsePromptFrontMatter`; contains `pendingPromptTools`; the `buildRequestBody` call site passes `promptTools`).
  Acceptance: compile passes; smoke → **627** (623 + 4).

- **1.100-2.S4** — `src/chat/webview.ts`: `prompt_run` handler (+2 smoke).
  1. In `handleHostMessage`, next to `case 'prompt_inject':`: `case 'prompt_run':` — `const text = String(msg.text ?? ''); if (!text) break;` if `msg.mode` is one of `ask|agent|edit` set `modeSelect.value = msg.mode` (the change listener posts the toolbar sync); then set `inputEl.value = text` and invoke the existing send path (same function the Send button calls).
  2. Smoke: section `// 71) prompt_run webview (1.100-2.S4)`, **2 assertions**, prefix `prompt2-s4:` (webview source contains `prompt_run`; the `prompt_run` region reaches the send invocation).
  Acceptance: compile passes; smoke → **629** (627 + 2).

- **1.100-2.S5** — `src/extension.ts`: rename to `llm.runPrompt` + run semantics (+4 smoke).
  1. Rename the `llm.usePrompt` registration to `llm.runPrompt`; QuickPick title → `"LLM: Run Prompt"`, placeHolder → `"Select a prompt to run in chat"`.
  2. On pick: read file → `parsePromptFrontMatter` → `provider.runPrompt(content, uri.fsPath)` (replaces the `prompt_inject` postMessage); keep the empty-body guard message.
  3. Add deprecated alias: `vscode.commands.registerCommand("llm.usePrompt", () => vscode.commands.executeCommand("llm.runPrompt"))`.
  4. Keep the "New Prompt File…" flow unchanged (it now writes the S1 template).
  5. Smoke: section `// 72) llm.runPrompt command (1.100-2.S5)`, **4 assertions**, prefix `prompt2-s5:` (read `out/extension.js`: contains `"llm.runPrompt"`; contains the deprecated `"llm.usePrompt"` alias; contains `runPrompt(` (calls the provider method); the old inject path is gone from that command).
  Acceptance: compile passes; smoke → **633** (629 + 4).

- **1.100-2.S6** — `package.json`: command rename, Play button menu, language IDs (+4 smoke).
  1. `contributes.commands`: replace the `llm.usePrompt` entry with `{ "command": "llm.runPrompt", "title": "LLM: Run Prompt", "icon": "$(play)" }`.
  2. `activationEvents`: `onCommand:llm.usePrompt` → `onCommand:llm.runPrompt`.
  3. New `contributes.menus`: `{ "editor/title": [{ "command": "llm.runPrompt", "when": "resourceFilename =~ /.*\\.prompt\\.md$/" }] }`.
  4. New `contributes.languages`: `llm.prompt` (name "Prompt", extensions `[".prompt.md"]`) and `llm.instructions` (name "Instructions", extensions `[".instructions.md"]`).
  5. Smoke: section `// 73) runPrompt schema (1.100-2.S6)`, **4 assertions**, prefix `prompt2-s6:` (commands contain `llm.runPrompt` with title "LLM: Run Prompt" and `$(play)` icon; `menus["editor/title"]` has the `llm.runPrompt` entry with the `.prompt.md` `when` clause; `languages` contains both `llm.prompt` and `llm.instructions` with the right extensions).
  Acceptance: compile passes; smoke → **637** (633 + 4).

**Total expected assertions:** 610 → **637** (+27: S1 +10, S2 +3, S3 +4, S4 +2, S5 +4, S6 +4).

**Overall acceptance (Tester):** A `.prompt.md` file with `mode: ask` + `tools: read_file, edit_file` front matter: the Play button appears in its editor title bar; clicking it (or `LLM: Run Prompt` from the palette) switches the chat mode picker to the front-matter mode, sends the stripped body immediately, and (in agent mode) the request's `tools` array contains only the listed tools. Files without front matter run in the default agent mode with the full tool list. Empty/comment-only files → error notice, no send. A request already running → "stop it first" notice. Untitled docs named `*.prompt.md` get the Play button and the `llm.prompt` language. `npm run compile` clean; `node scripts/smoke-test.js` → **637 PASS**.

**Risks / deviations:**
- **D1 — command rename:** `llm.usePrompt` kept as a one-line deprecated alias (behavior now = run). Deviation from a hard rename to avoid breaking existing keybindings/activation.
- **D2 — `prompt_inject` retained:** the webview handler stays (harmless); only the prompt command stops using it.
- **D3 — `tools` in ask mode:** ignored (ask mode never sends tools); documented in the template comment.
- **D4 — Play button `when` clause:** `resourceFilename =~ /.*\.prompt\.md$/` covers untitled docs named `*.prompt.md`; a doc with the `llm.prompt` language but a different name won't show the button (acceptable).
- **D5 — slash command `/prompt-name` deferred:** the `run-prompt-as-slash-command.png` behavior (intercepting `/name` in chat input and matching discovered prompt files) is NOT in this item's slices; it needs its own slice (discovery + name normalization + `handleSend` interception). Flagged for a follow-up item.
- **R1 — `runPrompt` concurrency:** guarded by the `abortController` check (S3).
- **R2 — `promptTools` cleared per turn:** set/cleared inside `runStream` so a normal follow-up send in the same conversation uses the full tool list again (the filter applies only to the run turn).
