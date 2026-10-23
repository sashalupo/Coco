# Planner — Progress Memory

> **This file is the agent's persistent memory.** The `Planner` agent
> (`.github/agents/planner.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Turn each changelog feature (from the Changelog Researcher's backlog) into a concrete,
step-by-step implementation plan for the `llm` VS Code extension. The planner does NOT write
code — only the Coder writes code.

## Status

- **Current item:** 1.100-7 (Fetch tool improvements — entire page, Markdown, context-window trimming) — **In progress** (planned 2026-10-23, 4 slices S1–S4)
- **Next step:** dispatch 1.100-7.S1 (htmlToMarkdown + trimToTokenBudget in `src/fetchTool.ts`)
- **Last updated:** 2026-10-23
- **Last commit:** (planner commit for the 1.100-7 plan)
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

### Item 1.100-3 — Faster agent mode edits (apply-patch edit format)

**Changelog reference:** VS Code 1.100 (April 2025) — "Faster agent mode edits": agent mode supports OpenAI's apply-patch editing format and Anthropic's replace-string tool for significantly faster edits, especially in large files.
**Planned:** 2026-10-23, 2 slices S1–S2
**Baseline smoke:** 637 assertions

**UI/behavior notes:** No images. No UI change — this is a model-facing tool. The model now has a second edit tool (`apply_patch`) alongside the existing `edit_file` (the Anthropic-style replace-string) and chooses per edit: `edit_file` for a single small targeted replacement, `apply_patch` for multi-hunk / large-file edits in one call.

**Design decisions (justified):**
1. **Patch format = OpenAI's `*** Begin Patch` format** (not unified diff). Grammar:
   - `*** Begin Patch` … `*** End Patch` (both required, exactly one patch per call).
   - Sections: `*** Update File: <path>` and `*** Add File: <path>` only. **Deviation D1:** `*** Delete File` / rename (`*** Update File: <old> => <new>`) are NOT supported — the tool takes a single `path` argument, so the patch may only touch that one file; a section header naming a different file is a parse error.
   - Inside a file section, hunks start with `@@` (optionally followed by context text, which is ignored). Lines: ` ` (space) = context, `+` = add, `-` = remove. A line that is exactly `***` is a literal context line (the standard escape). Any other line starting with `*** ` is a parse error.
   - **Deviation D2:** the tool's `path` argument is authoritative; the path in `*** Update File:` / `*** Add File:` must equal it (after normalization) or the call fails.
2. **Hunk matching (hand-rolled, pure TS — no npm deps).** For each hunk: build the context string from its context lines (space-prefixed) in order. Find occurrences in the file content by scanning for the first context line, then verifying the full context sequence matches at that position (context lines need not be contiguous in the hunk — lines between them in the file are preserved and untouched). Rules:
   - **0 matches** → error `hunk N: context not found in <path> — re-read the file and copy the exact context lines (including whitespace and indentation).`
   - **>1 matches** → error `hunk N: context is not unique in <path> (M matches) — add more context lines to disambiguate.`
   - On match, the region from the first context line to the last context line is replaced by: context lines interleaved with the `+`/`-` lines in hunk order (i.e. `-` lines drop, `+` lines insert, context lines stay). Hunks are applied **sequentially** against the evolving content (later hunks see earlier hunks' results).
   - **Deviation D3:** matching is **exact** (byte-for-byte, including whitespace) — no whitespace-insensitive fallback.
3. **`*** Add File`** requires the file to NOT exist (error otherwise); the resulting content is the hunk lines with `+` prefixes stripped. `*** Update File` requires the file to exist.
4. **Mutating + approval gate.** `apply_patch` is added to `isMutatingTool` → flows through the existing `llm.tools.requireApproval` gate, identical to `edit_file`.
5. **Executor mirrors `editFile` bookkeeping** (`ToolExecutor.ts` L505): `resolveSafe` → size guard (`MAX_READ_BYTES`) → read → `lastSnapshot` + `recordSnapshot` → write → `recordChange` → `unifiedDiff` block in the result. On any parse/match failure: **no write, no snapshot**, error text returned as the `ToolResult` so the agentic loop can retry.
6. **No `request.ts` change needed** — `buildRequestBody` sends `[...CODE_TOOLS, ...mcpTools]` (L336), so the new schema entry is automatically exposed.
7. **Tool description** steers the choice: "Apply a multi-hunk patch to a file in one call. Use for large or multi-location edits; for a single small replacement prefer edit_file."

**Files to touch:** `src/patch.ts` (new), `src/tools.ts`, `src/tools/ToolExecutor.ts`, `scripts/smoke-test.js`

**Slices:**

- **1.100-3.S1** — `src/patch.ts`: pure patch parser + applier (+12 smoke).
  Files: `src/patch.ts` (new), `scripts/smoke-test.js`.
  1. `src/patch.ts` (pure, no vscode/fs imports — smoke-requireable from `out/patch.js`):
     - `export interface PatchOp { kind: "ctx" | "add" | "del"; text: string }` and `export interface PatchFile { op: "update" | "add"; path: string; hunks: PatchOp[][] }`.
     - `export function parsePatch(patch: string): { files: PatchFile[] }` — throws `Error` with a descriptive message on: missing `*** Begin Patch` / `*** End Patch`; unknown `*** ` directive; a file-section path that differs from other sections (multi-file patch → error "one file per patch"); a hunk with no `@@`; a line that is neither ` ` / `+` / `-` / `***` prefixed nor a directive.
     - `export function applyPatchToContent(oldContent: string, file: PatchFile): string` — implements decision 2 (sequential hunk application, exact context matching, 0-match / >1-match errors naming the hunk index, 1-based).
     - `export function applyPatch(patch: string, path: string, oldContent: string, fileExists: boolean): string` — top-level: `parsePatch`, assert exactly one file section and its path equals `path` (normalized: forward slashes, no leading `./`), enforce add-vs-update existence rule, delegate to `applyPatchToContent` (empty `oldContent` for add).
  2. `scripts/smoke-test.js` — new section `// 74) apply_patch core (1.100-3.S1)`, `require("../out/patch.js")`, **12 assertions**, prefix `patch-s1:`:
     1. Single-hunk update: context + one `-` + one `+` → expected new content.
     2. Multi-hunk update (2 hunks, second hunk's context shifted by the first) → both applied.
     3. Pure-insertion hunk (context + `+` lines, no `-`) → lines inserted between context.
     4. `*** Add File` content assembly (all-`+` hunk) → exact content.
     5. Context not found → throws, message contains `context not found` and the hunk index.
     6. Non-unique context (same 2 context lines appear twice) → throws, message contains `not unique`.
     7. Missing `*** End Patch` → throws.
     8. Unknown directive (`*** Foo Bar: x`) → throws.
     9. Two file sections in one patch → throws (one file per patch).
     10. File-section path ≠ expected path → throws.
     11. `***` literal context line is preserved as a literal `***` line in the output.
     12. `applyPatch` existence rules: `add` on existing file → throws; `update` on missing file → throws.
  Acceptance: `npm run compile` passes; smoke → **649** (637 + 12).

- **1.100-3.S2** — `apply_patch` tool schema + executor wiring (+5 smoke).
  Files: `src/tools.ts`, `src/tools/ToolExecutor.ts`, `scripts/smoke-test.js`.
  1. `src/tools.ts`:
     - `CODE_TOOLS`: add `apply_patch` entry **after `edit_file`** — params `path` (string, workspace-relative) + `patch` (string, "the full patch, from `*** Begin Patch` to `*** End Patch`"); `required: ["path", "patch"]`. Description per decision 7, including the format sketch and the exact-match/unique-context contract.
     - `isMutatingTool`: add `name === "apply_patch"`.
  2. `src/tools/ToolExecutor.ts`:
     - Import `applyPatch` from `../patch`.
     - `execute` switch: `case "apply_patch":` → `this.applyPatchTool(call, String(args.path ?? ""), String(args.patch ?? ""))`.
     - `private async applyPatchTool(call, relPath, patch): Promise<ToolResult>` — mirrors `editFile` (L505): empty-patch guard; `resolveSafe`; `patch.length > MAX_READ_BYTES` guard; read old content (missing → `existed=false`); `applyPatch(patch, relPath, oldContent, existed)` inside try/catch → on throw return `this.result(call, err.message)` (no write, no snapshot); on success: `lastSnapshot` + `recordSnapshot` → `writeFile` → `recordChange` → result `Applied patch to <path> (N hunks)${diffBlock}` using the existing `unifiedDiff`.
  3. `scripts/smoke-test.js`:
     - **Update the two existing hard-coded tool-list assertions** (L481 section 5 and L4269 section 54): `CODE_TOOLS.length === 15` → `16`, and the expected name string gains `apply_patch` after `edit_file` in both places.
     - New section `// 75) apply_patch tool (1.100-3.S2)`, **5 assertions**, prefix `patch-s2:`:
       1. `CODE_TOOLS` contains `apply_patch` with `required === ["path","patch"]`.
       2. `isMutatingTool("apply_patch") === true`.
       3. `src/tools/ToolExecutor.ts` source contains `case "apply_patch"` and imports `applyPatch` from `../patch` (static source assertion).
       4. The `applyPatchTool` region of the executor source contains `recordSnapshot` and `unifiedDiff` (snapshot + diff bookkeeping wired).
       5. The `apply_patch` tool description mentions `edit_file` (the model is steered between the two edit tools).
  Acceptance: `npm run compile` passes; smoke → **654** (649 + 5).

**Total expected assertions after all slices:** 637 → **654** (+17: S1 +12, S2 +5).

**Overall acceptance (Tester):** In agent mode the model sees both `edit_file` and `apply_patch` in the tools list. A well-formed `apply_patch` call with a multi-hunk `*** Begin Patch` patch edits the target file in one call: the file content reflects all hunks, the result message includes the unified diff, the change appears in the per-run change summary, and Keep/Undo + `revertAll` restore the pre-patch content (snapshot path identical to `edit_file`). A non-matching or non-unique context returns a descriptive error naming the hunk, with **no file write and no snapshot**. `apply_patch` is subject to the `llm.tools.requireApproval` gate. `npm run compile` clean; `node scripts/smoke-test.js` → **654 PASS**.

**Risks / deviations:**
- **D1 — no delete/rename sections:** `*** Delete File` and `*** Update File: old => new` are rejected as parse errors; single-file-per-call via the `path` argument.
- **D2 — `path` argument is authoritative:** the section-header path must match it.
- **D3 — exact, whitespace-sensitive context matching** (no fuzzy fallback), consistent with `edit_file`.
- **R1 — sequential hunk application:** later hunks match against already-patched content.
- **R2 — large files:** the patch string and target file are both capped at `MAX_READ_BYTES` (256 KB), same as `edit_file`.
- **R3 — existing assertions touched:** the two hard-coded 15-tool assertions (sections 5 and 54) are updated in S2.

### Item 1.100-7 — Fetch tool improvements (entire page, Markdown format, context-window trimming)

**Changelog reference:** VS Code 1.100 (April 2025) — `#fetch` adds the **entire page** as context, converts pages to **Markdown** (standardized, LLM-friendly), and when the context window would be exceeded, **excludes less relevant sections** to stay within the limit. No images.
**Planned:** 2026-10-23, 4 slices S1–S4
**Baseline smoke:** 654 assertions

**Design decisions (justified):**
1. **`htmlToMarkdown` is a new pure function in `src/fetchTool.ts`** (hand-rolled, no turndown — zero runtime deps). `htmlToText` is **kept unchanged** (still used for non-HTML content types and by existing `fetch-s1:` smoke assertions). `fetchUrl` uses `htmlToMarkdown` for `text/html` responses **only when a token budget is requested** (D2); otherwise it keeps the existing `htmlToText` path so the 1.99-4 behavior and its assertions are untouched.
2. **Markdown mapping (hand-rolled tokenizer + stack-based recursive descent over a tag token stream):**
   - `h1`–`h6` → `#`–`######` + space;
   - `a[href]` → `[text](href)` (no href → plain text); `img[src]` → `![alt](src)`;
   - `strong`/`b` → `**text**`; `em`/`i` → `*text*`; `code` → `` `text` ``;
   - `pre` (with optional `code[language-x]`) → fenced block (fence is ``` unless content contains backticks, then ````);
   - `ul`/`ol`/`li` → `- ` / `1. ` (nesting via 2-space indent per level, capped at 4 levels);
   - `table`/`tr`/`th`/`td` → pipe rows with a `| --- |` separator after the header row (cells flattened to inline text, `|` escaped as `\|`);
   - `blockquote` → `> ` prefix per line; `hr` → `---`; `br` → newline;
   - `script`/`style`/`noscript`/`template`/`head` → dropped entirely;
   - all other tags → their text content (attributes ignored); the 5 common entities decoded (same set as `htmlToText`);
   - post-processing: collapse 3+ newlines to 2, trim trailing spaces per line, trim result.
   - **Deviation D1 (robustness):** malformed HTML (unclosed tags) is handled by a stack-based parser that silently pops the stack at mismatched closes and at EOF — never throws, consistent with the module's "never throws" contract.
3. **Token budget = `maxTokens` option, estimated as `Math.ceil(chars / 3.5)`** (same estimator family as `request.ts`). New constant `DEFAULT_MAX_TOKENS = 5000` (~17 500 chars — slightly under the existing 20 000-char default, so the default `#fetch` block stays within its `FETCH_BLOCK_MAX_CHARS` cap).
4. **`trimToTokenBudget(md, maxTokens)` (pure):**
   - If `estimateTokens(md) <= maxTokens` → return `{ text: md, trimmed: false }`.
   - **Sections** = top-level Markdown sections: the preamble before the first `# ` heading is section 0; each `# ` (h1) heading starts a new section (h2–h6 stay inside their parent section — splitting only on h1 keeps tables/lists intact).
   - **Relevance score** (0 = drop first): a section is **low-relevance (score 0)** if its heading text or first non-empty line matches the boilerplate regex `/nav|menu|footer|foot|cookie|privacy|terms|legal|sign ?in|log ?in|log ?out|subscribe|newsletter|copyright|©|social|share|breadcrumb/i`; otherwise score 1.
   - **Drop order:** all score-0 sections first (in document order), then score-1 sections from the **end** of the document backwards, until the estimate fits. If even the first score-1 section alone exceeds the budget, hard-truncate it at the char equivalent (`maxTokens * 3.5`) — the budget is **always** respected.
   - Result: `{ text, trimmed }` where `text` ends with `\n… [trimmed to fit context window: dropped N section(s)]` when anything was dropped (or hard-truncated: `… [trimmed to fit context window]`).
5. **`fetchUrl` integration:** new optional `maxTokens` in the opts. When present (finite, ≥ 1): HTML content is converted via `htmlToMarkdown`, then `trimToTokenBudget(md, maxTokens)` is applied — the **cache stores the full untrimmed Markdown** (cache key = URL, as today), and the budget trim is applied at read time (cache hits get trimmed too, so a cached page respects a smaller budget on later calls). `maxChars` still applies as a final safety net (clamped as today). When `maxTokens` is absent: existing `htmlToText` + `truncate` path, byte-for-byte unchanged.
6. **Setting: `llm.chat.fetch.maxTokens`** (number, default `5000`) — the user-facing knob for "how much of the page fits my local model's window". `0` or negative → disables the budget (falls back to the plain `maxChars` path). Plumbed `presets.ts` → `config.ts` → `ToolExecutor.fetchUrl(url, maxChars?, maxTokens?)` → `fetchTool.fetchUrl`. The `#fetch` tag path (`ChatViewProvider`) calls `this.toolExecutor.fetchUrl(fetchUrl_)` — the executor reads the setting itself, so **no `ChatViewProvider.ts` change is needed** (the tag path automatically gets Markdown + budget trim).
7. **`fetch_url` tool description** updated to mention Markdown conversion and the token budget (the model-facing contract changes).

**Files to touch:** `src/fetchTool.ts`, `src/tools.ts`, `src/tools/ToolExecutor.ts`, `src/presets.ts`, `src/config.ts`, `package.json`, `scripts/smoke-test.js`

**Slices:**

- **1.100-7.S1** — `src/fetchTool.ts`: `htmlToMarkdown` + `trimToTokenBudget` (pure) (+10 smoke).
  Files: `src/fetchTool.ts`, `scripts/smoke-test.js`.
  1. `src/fetchTool.ts`:
     - `export function estimateTokens(text: string): number` — `Math.ceil(text.length / 3.5)`.
     - `export const DEFAULT_MAX_TOKENS = 5000;`
     - `export function htmlToMarkdown(html: string): string` — per decision 2. Never throws.
     - `export function trimToTokenBudget(md: string, maxTokens: number): { text: string; trimmed: boolean }` — per decision 4.
  2. `scripts/smoke-test.js` — new section `// 76) fetch markdown + budget (1.100-7.S1)`, `require("../out/fetchTool.js")`, **10 assertions**, prefix `fetchmd-s1:`:
     1. Headings: `<h1>A</h1><h3>B</h3>` → `# A` and `### B` lines.
     2. Links/images: `<a href="https://x">t</a>` → `[t](https://x)`; `<img src="i.png" alt="a">` → `![a](i.png)`.
     3. Emphasis + code: `<strong>s</strong> <em>e</em> <code>c</code>` → `**s** *e* \`c\``.
     4. Code fence: `<pre><code class="language-js">let a=1;</code></pre>` → fenced block with `js` language and the code line.
     5. Lists: nested `<ul><li>a<ul><li>b</li></ul></li></ul>` → `- a` then indented `- b`; `<ol>` → `1. `.
     6. Table: 2×2 table with `th` header → pipe rows + `| --- |` separator; a `|` inside a cell is escaped.
     7. `script`/`style`/`head` content is dropped; entities decoded (`&amp;` → `&`).
     8. `estimateTokens("x".repeat(3500)) === 1000`.
     9. `trimToTokenBudget` under budget → `trimmed === false`, text unchanged.
     10. `trimToTokenBudget` over budget: a doc with an h1 "Navigation" section (boilerplate) + two content sections → the nav section is dropped first, result ends with the `… [trimmed to fit context window: dropped N section(s)]` marker, and `estimateTokens(result.text) <= maxTokens`.
  Acceptance: `npm run compile` passes; smoke → **664** (654 + 10).

- **1.100-7.S2** — `src/fetchTool.ts` `fetchUrl` `maxTokens` wiring + `src/tools.ts` description (+5 smoke).
  Files: `src/fetchTool.ts`, `src/tools.ts`, `scripts/smoke-test.js`.
  1. `src/fetchTool.ts`: `fetchUrl` opts gain `maxTokens?: number`. When `maxTokens` is a finite number ≥ 1 and content-type is `text/html`: `const md = htmlToMarkdown(raw);` cache stores `{ text: md, at }` (full, untrimmed); return value = `trimToTokenBudget(md, maxTokens).text` (then the existing `maxChars` `truncate` as final safety net). Cache hits: if `maxTokens` given → trim the cached text; else existing `truncate` path. Non-HTML content: `maxTokens` still trims via `trimToTokenBudget` (sections = paragraphs split on blank lines — reuse the same function; preamble-only docs just hard-truncate). `maxTokens` absent → **existing behavior unchanged** (protects all `fetch-s1:` assertions).
  2. `src/tools.ts`: `fetch_url` description → "Fetch a publicly accessible webpage and return its content as **Markdown** (HTML converted to Markdown; other content types returned as-is). When `max_tokens` is set, content is trimmed to fit the token budget by dropping low-relevance sections (navigation, footer, boilerplate) first. Read-only: does not change the workspace." `max_chars` param description unchanged; add `max_tokens` param (number, "Optional token budget (estimated as chars/3.5). Content is trimmed to fit by dropping low-relevance sections first.").
  3. `scripts/smoke-test.js` — section `// 77) fetchUrl maxTokens (1.100-7.S2)`, **5 assertions**, prefix `fetchmd-s2:`:
     1. `fetchUrl` with injected `fetchFn` (text/html, `maxTokens: 50`) → result is Markdown (contains `# ` heading) and `estimateTokens(result) <= 50` (or the hard-truncation marker present).
     2. Second call (cache hit) with a **smaller** `maxTokens` → still within budget (trim applied at read time).
     3. `fetchUrl` **without** `maxTokens` → result identical to the old `htmlToText`-based output for the same fixture (regression guard: 1.99-4 path untouched).
     4. `CODE_TOOLS` `fetch_url` entry has a `max_tokens` param and its description mentions "Markdown".
     5. Non-HTML content-type (`text/plain`) with `maxTokens` → trimmed via budget (marker present when over budget), not Markdown-converted.
  Acceptance: compile passes; smoke → **669** (664 + 5).

- **1.100-7.S3** — Setting plumbing `llm.chat.fetch.maxTokens` (+3 smoke).
  Files: `src/presets.ts`, `src/config.ts`, `src/tools/ToolExecutor.ts`, `scripts/smoke-test.js`.
  1. `src/presets.ts`: after `fetchEnabled: boolean;` add `fetchMaxTokens: number;` (doc comment: token budget for `#fetch`/`fetch_url`; 0 disables).
  2. `src/config.ts`: after `fetchEnabled` add `fetchMaxTokens: c.get<number>("chat.fetch.maxTokens", 5000),`.
  3. `src/tools/ToolExecutor.ts`: `fetchUrl(url, maxChars?, maxTokens?)` — read the setting when `maxTokens` is not passed: `const budget = maxTokens ?? vscode.workspace.getConfiguration("llm").get<number>("chat.fetch.maxTokens", 5000);` pass `maxTokens: budget > 0 ? budget : undefined` to `fetchTool.fetchUrl`. (The `#fetch` tag path calls `this.toolExecutor.fetchUrl(fetchUrl_)` and therefore picks this up with **no provider change**.)
  4. `scripts/smoke-test.js` — section `// 78) fetchMaxTokens settings (1.100-7.S3)`, **3 assertions**, prefix `fetchmd-s3:` (static source assertions — `config.ts`/`presets.ts`/`ToolExecutor.ts` import vscode):
     1. `src/config.ts` contains `c.get<number>("chat.fetch.maxTokens", 5000)`.
     2. `src/presets.ts` contains `fetchMaxTokens: number;`.
     3. `src/tools/ToolExecutor.ts` contains `chat.fetch.maxTokens` (the executor reads the setting).
  Acceptance: compile passes; smoke → **672** (669 + 3).

- **1.100-7.S4** — `package.json` schema + final smoke (+3 smoke).
  Files: `package.json`, `scripts/smoke-test.js`.
  1. `package.json` `contributes.configuration.properties`: add after `llm.chat.fetch.enabled`:
     - `llm.chat.fetch.maxTokens`: `{ "type": "number", "default": 5000, "description": "Token budget (estimated as chars/3.5) for #fetch / fetch_url page content. Pages are converted to Markdown and trimmed to fit by dropping low-relevance sections (navigation, footer, boilerplate) first. Set to 0 to disable the budget (plain character truncation)." }`
     - Update the `llm.chat.fetch.enabled` description: "…converted to **Markdown** (cached for 10 minutes) and trimmed to the `llm.chat.fetch.maxTokens` budget."
  2. `scripts/smoke-test.js` — section `// 79) fetch.maxTokens schema (1.100-7.S4)`, **3 assertions**, prefix `fetchmd-s4:` (against the already-loaded `pkgJson`):
     1. `properties["llm.chat.fetch.maxTokens"]` is `type: "number"` with `default === 5000`.
     2. Its description mentions `Markdown` and `maxTokens`/budget.
     3. `properties["llm.chat.fetch.enabled"].description` mentions `Markdown`.
  Acceptance: compile passes; smoke → **675** (654 + 21).

**Total expected assertions after all slices:** 654 → **675** (+21: S1 +10, S2 +5, S3 +3, S4 +3).

**Overall acceptance (Tester):** With `llm.chat.fetch.maxTokens` at its default (5000): sending `#fetch <url>` (or an agent-mode `fetch_url` call) attaches the **entire page** converted to **Markdown** (headings, links, lists, code fences, tables rendered per the mapping above); when the page's estimated tokens exceed the budget, low-relevance sections (nav/footer/cookie/privacy/sign-in/…) are dropped first, then trailing sections, and the block ends with the `… [trimmed to fit context window]` marker — the result always fits the budget. Setting the value to `0` restores the 1.99-4 plain-text + char-truncation behavior. Cache still works (10 min TTL, 20 entries) and cached pages are re-trimmed to a smaller budget on later calls. `npm run compile` clean; `node scripts/smoke-test.js` → **675 PASS**.

**Risks / deviations:**
- **D1 — malformed HTML:** stack-based parser silently recovers (pop on mismatch/EOF); never throws (module contract).
- **D2 — Markdown only under a budget:** the default `#fetch` path *does* get Markdown (the executor always passes the setting's default 5000), but `fetchTool.fetchUrl` called without `maxTokens` (e.g. direct tests) keeps the old `htmlToText` path — this is what keeps the 1.99-4 `fetch-s1:` assertions green.
- **R1 — h1-only section splitting:** pages with no h1 headings produce a single preamble section → the trim degrades to a hard char-truncation (still budget-safe).
- **R2 — boilerplate regex false positives:** a content section legitimately titled "Menu" is dropped first. Mitigation: it is only dropped *first*, never *last*.
- **R3 — `FETCH_BLOCK_MAX_CHARS` (20 000) vs 5000 tokens (~17 500 chars):** the default budget keeps the `#fetch` block under the existing `formatFetchBlock` cap, so no `context.ts` change is needed.
- **R4 — token estimator:** `chars/3.5` is a coarse estimate (same family as `request.ts`); the hard-truncation fallback guarantees the budget is never exceeded.
