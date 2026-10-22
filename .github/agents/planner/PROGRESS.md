# Planner — Progress Memory

> **This file is the agent's persistent memory.** The `Planner` agent
> (`.github/agents/planner.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Turn each changelog feature (from the Changelog Researcher's backlog) into a concrete,
step-by-step implementation plan for the `llm` VS Code extension. The planner does NOT write
code — only the Coder writes code.

## Status

- **Current item:** 1.99-6 (Create a new workspace with agent mode) — **planned** (2026-10-22, 4 slices S1–S4)
- **Next step:** orchestrator runs the slice pipeline starting at 1.99-6.S1
- **Last updated:** 2026-10-22
- **Last commit:** — (no planner commits yet)
- **Build state:** n/a (planner does not build)

## Backlog pointer

The ordered backlog (oldest → newest) lives in
`.github/agents/changelog-researcher/PROGRESS.md`. The planner plans the **first pending
item** (the oldest) that the orchestrator dispatches.

## Plans

### Item 1.98-1 — Editable terminal command approval in chat (planned 2026-10-22) — **Done** (2026-10-22, slices S1–S5 complete)

**Changelog reference:** VS Code 1.98, "Agent mode improvements" — terminal commands shown
inline in the chat response; user can edit the suggested command before running; Ctrl+Enter
confirms.

**Design decisions (justified):**
1. **Reuse `llm.tools.requireApproval`** (no new setting). `run_command` is already classified
   as mutating by `isMutatingTool()` (src/tools.ts ~line 328), so it already flows through the
   approval gate when the setting is on. Setting off → `run_command` runs immediately (no
   behavior change).
2. **New message pair** `command_approval` (host→webview) / `commandApproval` (webview→host)
   instead of reusing `approval_request`/`toolApproval`, because the command card needs an
   **editable input** and must return the (possibly edited) command string. Existing pair
   untouched → `write_file`/`edit_file` approval unaffected.
3. **Host-side command substitution:** on approval the host rewrites
   `call.function.arguments` with the edited command before `toolExecutor.execute(call)`. If
   edited, the tool result content is prefixed with a note and the `tool_result` postMessage
   carries `modified: true` so the webview can badge the card.
4. **Ctrl+Enter** handled in the webview only (keydown on the input); no VS Code keybinding.

**Slices:**

- **1.98-1.S1 — Webview: `command_approval` card (editable input, Run/Cancel, Ctrl+Enter).**
  File: `src/chat/webview.ts`. In `handleHostMessage`, add `case 'command_approval':` sibling
  to `approval_request` (~line 1906). Build a `.message.command-approval` card: role line
  "Run command?", a `<textarea class="cmd-input">` (rows≈2, monospace) pre-filled with
  `msg.command` (set via `.value`, never innerHTML), actions row with `Run` (`.cmd-run`) and
  `Cancel` (`.cmd-cancel`) buttons + a hidden `.status` div. `decide(approved)`: guard
  double-decide, disable both buttons, set status text, then
  `vscode.postMessage({ type: 'commandApproval', id: msg.id, approved, command: inputEl.value })`.
  Wire `click` on both buttons and `keydown` on the input: `e.key === 'Enter' && e.ctrlKey`
  → `e.preventDefault(); decide(true)`. Focus the input and select the text on render. Add
  minimal CSS for `.command-approval .cmd-input` (monospace, full width) and
  `.cmd-run`/`.cmd-cancel` reusing existing `.approve`/`.reject` styles.
  Acceptance: `npm run compile` passes; card renders with editable command; Ctrl+Enter and
  Run post `commandApproval` with the (edited) command; Cancel posts `approved: false`;
  buttons disable after deciding.

- **1.98-1.S2 — Host: `commandApproval` message handler + `waitForCommandApproval`.**
  File: `src/chat/ChatViewProvider.ts`. (a) In `onMessage` switch (~line 176) add
  `case "commandApproval": this.pendingCommandApproval?.(msg.approved === true, String(msg.command ?? "")); break;`.
  (b) Add field `private pendingCommandApproval: ((approved: boolean, command: string) => void) | null = null;`
  next to `pendingApproval` (~line 85). (c) Add
  `private waitForCommandApproval(signal: AbortSignal): Promise<{ approved: boolean; command: string }>`
  mirroring `waitForApproval` (~line 640): resolves `{approved:false, command:""}` on abort;
  stores the resolver in `pendingCommandApproval`.
  Acceptance: `npm run compile` passes; no behavior change yet.

- **1.98-1.S3 — Host: route `run_command` through the editable approval gate.**
  File: `src/chat/ChatViewProvider.ts`. In the agentic loop's tool-call `for` (~line 988–1008):
  when `settings.requireApproval && isMutating`, branch on
  `call.function.name === "run_command"`: parse `call.function.arguments` JSON, extract
  `command`; post `{ type: "command_approval", id: call.id, tool: "run_command", command }`;
  `const { approved, command: edited } = await this.waitForCommandApproval(signal);`.
  Rejected → push the existing "User rejected…" `toolResultMessage` and `continue`. Approved →
  if `edited.trim()` differs from the original command, set
  `call.function.arguments = JSON.stringify({ ...parsed, command: edited })` and remember
  `commandModified = true`. Non-`run_command` mutating tools keep the existing
  `approval_request` path unchanged. After `toolExecutor.execute(call)`, if `commandModified`,
  prefix `result.content` with `"Note: the user modified the command before running it.\n"`
  and include `modified: true` in the `tool_result` postMessage.
  Acceptance: `npm run compile` passes; setting on → editable card, edited command executes
  (visible in `$ <cmd>` output line), model told of modification; Cancel rejects;
  `write_file`/`edit_file` unchanged; setting off → immediate run, no card.

- **1.98-1.S4 — Webview: "modified by user" badge on the tool card.**
  File: `src/chat/webview.ts`. In `case 'tool_result':` (~line 1979), when
  `msg.modified === true`, append `<span class="tool-modified">modified by user</span>` next
  to the tool name in the card's summary (both found-card and fallback-card branches). Add a
  one-line CSS rule for `.tool-modified` (muted accent color, small font).
  Acceptance: `npm run compile` passes; modified `run_command` card shows the badge;
  unmodified cards do not.

- **1.98-1.S5 — Settings description + smoke test + PROGRESS.md.**
  Files: `package.json`, `scripts/smoke-test.js`, `.github/agents/planner/PROGRESS.md`.
  (a) `package.json`: update the `llm.tools.requireApproval` description to "Require user
  approval before mutating tools (write_file, edit_file, run_command) are applied.
  run_command shows an editable command card (Ctrl+Enter to run)." (b) `smoke-test.js`: add
  assertions that the webview HTML contains `command_approval` handling and the
  `commandApproval` postMessage type, and that `ChatViewProvider` source contains
  `waitForCommandApproval`. (c) `PROGRESS.md`: mark 1.98-1 Done, update Status/Next step.
  Acceptance: `npm run compile` + `node scripts/smoke-test.js` pass; PROGRESS.md in sync.

**Overall acceptance (Tester):** with `llm.tools.requireApproval: true`, a `run_command` tool
call renders an inline card with the command in an editable input; Run / Ctrl+Enter executes
the (possibly edited) command and the tool output shows the executed command; if edited, the
model is told and the card is badged; Cancel rejects and the model is told; with the setting
`false`, `run_command` runs immediately with no card; `write_file`/`edit_file` approval
unchanged; `npm run compile` clean.

**Risks:** multi-line commands OK (textarea + `shell: true`); empty edited command →
`ToolExecutor.runCommand` already returns an "empty command" error; abort while pending →
`waitForCommandApproval` resolves rejected (matches `waitForApproval`).


### Item 1.98-14 — Copilot Vision (Preview): image attachments (planned 2026-10-22)

**Changelog reference:** VS Code 1.98, "Copilot Vision (Preview)" — attach images to chat
prompts (drag/drop, paste, or paperclip > Screenshot Window); JPEG/JPG, PNG, GIF, WEBP;
warning when the model can't handle the file type. `image-attachments.gif`: attached image
rendered inline in the prompt; hover shows a preview.

**Design decisions (justified):**
1. **Webview-side capture, data-URL transport.** Paperclip 📎 (hidden `<input type=file
   accept="image/jpeg,image/png,image/gif,image/webp" multiple>`), `paste` on the textarea
   (`clipboardData.items` → `getAsFile()`), and `dragover`/`drop` on the input row all funnel
   into one `addImageFiles(FileList)` helper. `FileReader.readAsDataURL` →
   `vscode.postMessage({type:'send', text, images:[dataUrl,...]})`. No host file I/O, no temp
   files, no proxy — data URLs go straight into the JSON body.
2. **Multimodal body shape (OpenAI).** `ChatMessage` gains optional `images?: string[]`.
   `buildRequestBody` maps messages with images to
   `content: [{type:"text",text}, {type:"image_url", image_url:{url:dataUrl}}, ...]`;
   text-only messages keep `content: string` (zero change for existing engines).
   `estimateMessageTokens` adds a flat 1000 tokens/image (heuristic).
3. **Non-blocking vision warning.** Pure `isVisionCapableModel(model)` in `presets.ts`
   (case-insensitive substring match against a static marker list: llava, qwen2.5-vl,
   qwen2-vl, qwen3-vl, minicpm-v, glm-4v, glm-4.1v, internvl, pixtral, gemma-3, moondream,
   bakllava, mistral-small-3.1, llama3.2-vision, llama-4). Unknown/empty model → false
   (conservative). On send with images, if the resolved model (toolbar ?? `llm.model`) is
   not vision-capable the host posts `vision_warning`; the webview shows a dismissible amber
   notice above the input (auto-hide 8 s). The message still sends.
4. **Rendering.** Pending attachments: thumbnail strip (`.attach-strip`, 48px thumbs, ×
   remove) above the input row. Sent images: inline in the user bubble (`.msg-images`, 96px
   thumbs); hover preview = CSS `:hover { transform: scale(1.6); z-index: 10 }` (no JS
   tooltip — the data URL is the full image). `restore` re-renders from `m.images`.
5. **Gate + validation.** `llm.chat.vision.enabled` (default true; follows the
   `llm.chat.*.enabled` tag-feature pattern). Host sanitizes: mime ∈ {jpeg,png,gif,webp}
   (checked via the data-URL prefix), ≤ 10 MB each, ≤ 4 images; extras dropped silently.
   Setting off → images dropped, no warning.
6. **No new dependencies** — zero runtime npm deps, no bundler; existing `LlmClient`
   `fetch` path unchanged.

**Slices:**

- **1.98-14.S1 — `src/request.ts`: multimodal message support (pure).** — Done (2026-10-22)
  File: `src/request.ts`. (a) `ChatMessage`: add `images?: string[]` (data URLs).
  (b) New exported `type ContentPart = { type: "text"; text: string } | { type: "image_url";
  image_url: { url: string } }` and pure helper
  `toContentParts(content: string, images?: string[]): string | ContentPart[]` — plain
  string when no images, else parts array (text part first, one image part per data URL).
  (c) `buildRequestBody`: after `trimHistory`, map messages —
  `m.images?.length ? { ...m, content: toContentParts(m.content, m.images) } : m`; widen
  `ChatCompletionRequest.messages` element `content` to `string | ContentPart[]`.
  (d) `estimateMessageTokens`: `+ 1000 * (message.images?.length ?? 0)`.
  Acceptance: `npm run compile` clean; text-only bodies byte-identical to before; 2-image
  message → `content` array of 3 parts with correct `image_url.url`.
  Smoke (`vision-s1:`, 4): `out/request.js` exports `toContentParts`; `toContentParts("hi")`
  === `"hi"`; `toContentParts("hi", ["data:image/png;base64,AAA"])` is an array of length 2
  with `[1].type === "image_url"` and `[1].image_url.url` === the data URL;
  `estimateMessageTokens` with 1 image exceeds the no-image estimate by ≥ 900.

- **1.98-14.S2 — `src/presets.ts`: `isVisionCapableModel` (pure).** — Done (2026-10-22)
  File: `src/presets.ts`. Export `const VISION_MODEL_MARKERS: string[]` (llava, qwen2.5-vl,
  qwen2-vl, qwen3-vl, minicpm-v, minicpm-v2, glm-4v, glm-4.1v, internvl, pixtral, gemma-3,
  moondream, bakllava, mistral-small-3.1, llama3.2-vision, llama-4) and
  `export function isVisionCapableModel(model: string): boolean` — false for empty/whitespace;
  else case-insensitive `includes` against any marker.
  Acceptance: `npm run compile` clean; true for `"llava-llama-3.2-11b"`, false for
  `"qwen2.5:7b"` and `""`.
  Smoke (`vision-s2:`, 3): `out/presets.js` exports `isVisionCapableModel`; true for
  `"Qwen2.5-VL-7B-Instruct"` (case-insensitive); false for `""` and `"llama3.1:8b"`.

- **1.98-14.S3 — `src/chat/webview.ts`: attachment UI (capture, strip, inline render, hover, warning).** — Done (2026-10-22)
  File: `src/chat/webview.ts`. (a) HTML: `<button id="attach" title="Attach image (or paste /
  drag-drop)">📎</button>` before Send in `.input-row`; hidden
  `<input type="file" id="attach-file" accept="image/jpeg,image/png,image/gif,image/webp"
  multiple hidden>`; `<div id="attach-strip" class="attach-strip" hidden></div>` and
  `<div id="vision-warning" class="vision-warning" hidden></div>` above `.input-row`.
  (b) JS: `pendingImages` array; `addImageFiles(files)` — filter to the 4 mimes, cap 4
  images / 10 MB each, `FileReader.readAsDataURL` → push + `renderAttachStrip()`; wire
  `#attach` click → `#attach-file.click()`, `#attach-file` change, `inputEl` `paste`
  (`e.clipboardData.items` → `item.getAsFile()` for image/*), `dragover`/`drop` on the input
  row (`preventDefault`, `e.dataTransfer.files`). `renderAttachStrip()`: 48px thumbs with
  `title=name` + × remove button; hidden when empty. `doSend()`: post
  `{type:'send', text, images: pendingImages.map(i => i.dataUrl)}`; capture
  `lastSentImages` before clearing; reset strip. `addUserMessage(text, images)`: when
  `images` present append `<div class="msg-images">` with
  `<img class="msg-img" src=dataUrl title=escapedName>`; `stream_start` (non-skipUser)
  passes `lastSentImages`; `restore` passes `m.images`. `case 'vision_warning':` — set
  `#vision-warning` via `textContent`, unhide, auto-hide after 8 s (click also hides).
  (c) CSS: `.attach-strip` (flex/gap/wrap), `.attach-thumb` (48px, rounded, relative),
  `.attach-remove` (absolute ×), `.msg-images` (flex gap), `.msg-img` (96px, rounded,
  cursor zoom-in, `transition: transform .15s`),
  `.msg-img:hover { transform: scale(1.6); position: relative; z-index: 10; }` (hover
  preview), `.vision-warning` (amber, small).
  Acceptance: `npm run compile` clean; paperclip/paste/drag-drop add thumbs; send posts
  `images`; user bubble shows inline thumbs; hover scales; warning shows + auto-hides.
  Smoke (`vision-s3:`, 5): webview HTML contains `id="attach"`, `id="attach-file"`,
  `id="attach-strip"`, `id="vision-warning"`, and the strings `readAsDataURL`,
  `clipboardData`, `vision_warning`, `msg-img`.

- **1.98-14.S4 — `src/chat/ChatViewProvider.ts`: host send flow + validation + warning.** — Done (2026-10-22)
  File: `src/chat/ChatViewProvider.ts`. (a) Import `isVisionCapableModel` from `../presets`.
  (b) `onMessage` `case "send"`: pass
  `Array.isArray(msg.images) ? msg.images : []` to
  `this.handleSend(String(msg.text ?? ""), images)`. (c) `handleSend(text, images)`: read
  `visionEnabled` inline via
  `vscode.workspace.getConfiguration("llm").get<boolean>("chat.vision.enabled", true)`
  (schema entry lands in S5); sanitize images — keep only strings matching
  `^data:image/(jpeg|png|gif|webp);base64,`, ≤ 10 MB (data-URL length heuristic), max 4;
  push `{role:"user", content:text, images: sanitized.length ? sanitized : undefined}`.
  (d) Warning: if `sanitized.length > 0` and
  `!isVisionCapableModel(toolbar.model ?? settings.model)`, post
  `{type:"vision_warning", message: "Model '<model|default>' may not support images — the
  engine may ignore them."}`. Non-blocking: `runStream` proceeds regardless.
  Acceptance: `npm run compile` clean; images stored on the history user message; non-vision
  model → `vision_warning` posted and stream still runs; setting off → images dropped, no
  warning.
  Smoke (`vision-s4:`, 3): `ChatViewProvider.ts` source contains `isVisionCapableModel`,
  `vision_warning`, and `chat.vision.enabled`.

- **1.98-14.S5 — `package.json` setting + final smoke assertions + PROGRESS.md.** — Done (2026-10-22)
  Files: `package.json`, `scripts/smoke-test.js`, `.github/agents/planner/PROGRESS.md`.
  (a) `package.json`: add `llm.chat.vision.enabled` (boolean, default `true`, description:
  "Allow attaching images (JPEG/PNG/GIF/WEBP) to chat messages. Images are sent to the
  engine as base64 data URLs (OpenAI multimodal format).") next to the other `llm.chat.*`
  entries. (b) `smoke-test.js`: add the `vision-s1:` (4), `vision-s2:` (3), `vision-s3:`
  (5), `vision-s4:` (3) assertions (15 total; 342 → 357). (c) `PROGRESS.md`: mark 1.98-14
  Done, update Status/Next step.
  Acceptance: `npm run compile` + `node scripts/smoke-test.js` pass (357 assertions);
  setting visible in the VS Code settings UI.

**Overall acceptance (Tester):** with a vision-capable local engine, the user attaches a
PNG via paperclip, paste, or drag-drop; the thumbnail strip shows it; on send the user
bubble renders the image inline with hover zoom; the request body contains the `image_url`
data-URL part; with a non-vision model an amber non-blocking warning appears and the message
still sends; unsupported file types (e.g. `.bmp`) are rejected; `llm.chat.vision.enabled:
false` disables the feature; `npm run compile` clean; all 357 smoke assertions pass.

**Risks:** data URLs bloat the JSON body (worst case ~53 MB at the 4×10 MB cap) — acceptable
for local engines; conversation persistence stores base64 in globalState (fine for v1;
possible future downscale in the webview before sending); the vision-model marker list is
static — unknown models get the conservative non-blocking warning.

### Item 1.98-15 — Engine status indicator (planned 2026-10-22)

**Changelog reference:** VS Code 1.98, "Copilot status overview (Experimental)" —
reframed as an **engine status indicator**: status-bar item reflecting local-engine
connectivity (running/stopped, endpoint, active models) with a click-to-open overview.
Quota/cost sub-item dropped (free local engine). `copilot-status.png`: overview panel
opened from the status-bar icon.

**Design decisions (justified):**
1. **Reuse `client.health()`** (never throws, single `GET /health`) for the poll — not
   `listModels()`. Keep the existing 5 s interval; add a refresh on
   `onDidChangeWindowState` (window focused).
2. **Pure helpers in `src/presets.ts`** (`statusLabel`, `statusTooltip`,
   `statusOverviewItems`, `STATUS_COMMANDS`) so smoke tests exercise them via
   `out/presets.js`; `extension.ts` stays a thin host.
3. **Overview = QuickPick** (no new webview): engine state, endpoint, chat model,
   completions model + a "Useful commands" section (Open Chat, Test Connection,
   Refresh Models, Change Completions Model); picking a command executes it.
4. **New command `llm.showStatusOverview`** becomes the status-bar item's `command`
   (replacing `llm.testConnection`); Test Connection stays reachable inside the overview.
5. **Setting `llm.statusBar.enabled`** (boolean, default true), read at activation
   (same pattern as `llm.inline.enabled` — toggling requires a reload).

**Slices:**

- **1.98-15.S1 — `src/presets.ts`: pure status helpers.** — Done (2026-10-22)
  File: `src/presets.ts`. (a) `export interface EngineStatus { ok: boolean; status: number;
  statusText: string; error?: string }` (structural subset of `HealthResult`).
  (b) `export function statusLabel(s: EngineStatus): { icon: string; text: string }` —
  `$(check)`/`LLM` when ok, `$(error)`/`LLM` otherwise. (c)
  `export function statusTooltip(s: EngineStatus, baseUrl: string): string` — ok:
  `` `LLM engine healthy (${s.status} ${s.statusText}) — ${baseUrl}` ``; offline:
  `` `LLM engine unreachable — ${baseUrl}${s.error ? `: ${s.error}` : ` (${s.status})`}` ``.
  (d) `export interface StatusOverviewItem { label: string; description?: string;
  detail?: string; command?: string }` and
  `export function statusOverviewItems(s, baseUrl, chatModel, completionsModel):
  StatusOverviewItem[]` — 4 items: `Engine: running|stopped` (description = status text /
  error), `Endpoint: <baseUrl>`, `Chat model: <model|default (engine)>`,
  `Completions model: <model|chat model (default)>`. (e)
  `export const STATUS_COMMANDS: readonly { label: string; command: string; detail: string }[]`
  — Open Chat → `llm.openChat`, Test Connection → `llm.testConnection`, Refresh Models →
  `llm.refreshModels`, Change Completions Model → `llm.changeCompletionsModel`.
  Acceptance: `npm run compile` clean.
  Smoke (`status-s1:`, 4): exports present (`statusLabel`/`statusTooltip`/
  `statusOverviewItems` functions, `STATUS_COMMANDS` array of 4); `statusLabel` ok/offline
  icons; `statusTooltip` ok-case contains baseUrl + `200`, offline-case contains
  `unreachable` + error; `statusOverviewItems` returns 4 items with the 4 label prefixes
  and the empty-model fallbacks.
  Assertion count: 357 → 361.

- **1.98-15.S2 — `src/extension.ts`: gate + pure helpers + focus refresh.** — Done (2026-10-22)
  File: `src/extension.ts`. (a) Read `statusBar.enabled` (default true) at activation
  (pattern of `inlineEnabled`). (b) Wrap the existing status-bar block (createStatusBarItem
  + `updateHealth` + poll timer) in `if (statusBarEnabled)`. (c) `updateHealth` uses
  `statusLabel(result)` / `statusTooltip(result, readSettings().baseUrl)` instead of the
  inline strings (keep error `backgroundColor` + `status.show()`). (d) Add
  `vscode.window.onDidChangeWindowState((e) => { if (e.focused) void updateHealth(); })`
  to subscriptions (inside the gate).
  Acceptance: `npm run compile` clean; identical behavior when enabled; no item when
  disabled.
  Smoke (`status-s2:`, 3): `extension.ts` source contains `statusBar.enabled`,
  `statusLabel`, `onDidChangeWindowState`.
  Assertion count: 361 → 364.

- **1.98-15.S3 — `src/extension.ts`: `llm.showStatusOverview` QuickPick + repoint click.** — Done (2026-10-22)
  File: `src/extension.ts`. (a) Register `llm.showStatusOverview`: fresh
  `client.health()`, read `model`/`completions.model` from config, build QuickPick items
  from `statusOverviewItems(...)` (info rows, pick = no-op) + a `Useful commands` section
  mapping `STATUS_COMMANDS` to `{ label, detail, command }`; on pick with a `command`,
  `vscode.commands.executeCommand(item.command)`. (b) `status.command` →
  `"llm.showStatusOverview"`; tooltip suffix `(click for status overview)`.
  Acceptance: `npm run compile` clean; click opens the overview; picking a command
  executes it.
  Smoke (`status-s3:`, 3): `extension.ts` source contains `llm.showStatusOverview`,
  `statusOverviewItems`, `STATUS_COMMANDS`.
  Assertion count: 364 → 367.

- **1.98-15.S4 — `package.json` + final smoke assertions + PROGRESS.md.** — Done (2026-10-22)
  Files: `package.json`, `scripts/smoke-test.js`, `.github/agents/planner/PROGRESS.md`.
  (a) `package.json`: add command `llm.showStatusOverview` ("LLM: Show Status Overview"),
  activation event `onCommand:llm.showStatusOverview`, and setting
  `llm.statusBar.enabled` (boolean, default true, description: "Show the LLM engine status
  indicator in the status bar. Click it for a status overview. Toggling requires a
  reload.") next to `llm.completions.model`. (b) `smoke-test.js`: add `status-s1:` (4),
  `status-s2:` (3), `status-s3:` (3) plus `status-s4:` (4): parsed `package.json` has the
  `llm.showStatusOverview` command with title, the `onCommand:llm.showStatusOverview`
  activation event, `llm.statusBar.enabled` with `type === "boolean"` and
  `default === true`, and `llm.testConnection` still present (regression guard).
  (c) `PROGRESS.md`: mark 1.98-15 Done, update Status/Next step.
  Acceptance: `npm run compile` + `node scripts/smoke-test.js` pass (371 assertions);
  setting visible in the settings UI.
  Assertion count: 367 → 371.

**Overall acceptance (Tester):** engine running → `$(check) LLM` in the status bar;
engine stopped → `$(error) LLM` with error background; clicking opens a QuickPick listing
engine state, endpoint, chat model, completions model, and 4 useful commands (picking one
executes it); indicator refreshes on window focus and every 5 s;
`llm.statusBar.enabled: false` hides the indicator (after reload); `npm run compile`
clean; all 371 smoke assertions pass.

**Risks:** `HealthResult` is structurally compatible with `EngineStatus` (verified in
`src/client.ts`) — no client change; the 5 s poll interval is kept (changelog suggested
30 s, but `GET /health` is trivially cheap locally and the interval already exists);
QuickPick info rows are pickable no-ops (no disabled items in QuickPick) — acceptable for
v1.

### Item 1.99-2 — MCP server support (planned 2026-10-22)

**Changelog reference:** VS Code 1.99, "Model Context Protocol server support" —
reframed for the local extension: **stdio MCP servers only** (no SSE/HTTP transports),
configured via the `llm.mcp.servers` setting (object: name → `{ command, args?, env? }`),
hand-rolled newline-delimited JSON-RPC 2.0 (no runtime deps), discovered tools exposed to
the agent tool loop as `mcp__<server>__<tool>` behind the existing approval gate, plus
`llm.mcp.addServer` / `llm.mcp.listServers` commands. The changelog's "Select Tools"
webview button is out of scope (all discovered tools are exposed; per-tool toggling is a
follow-up).

**Assumptions verified (real code):**
- Tool shape: `interface Tool` at `src/tools.ts:12` (OpenAI function-calling schema);
  `CODE_TOOLS` at `src/tools.ts:48`; `toolResultMessage` at `src/tools.ts:365`;
  `isMutatingTool` at `src/tools.ts:381` (hardcoded list — `mcp__*` names will NOT match).
- Tool injection point: `src/request.ts:272-275` (`buildRequestBody`, `RequestConfig` at
  `src/request.ts:56`) — `body.tools = CODE_TOOLS` when `settings.toolsEnabled`.
- Tool loop: `src/chat/ChatViewProvider.ts` — agentic loop ~line 1098, approval gate
  line 1139 (`settings.requireApproval && isMutating`), execution line 1205
  (`this.toolExecutor.execute(call)`); `ToolExecutor.execute`
  (`src/tools/ToolExecutor.ts:267`) is a name-based switch that never throws.
- Settings: `readSettings()` at `src/config.ts:33`; `LlmSettings` at `src/presets.ts:65`
  (pure, vscode-free).
- Commands: `src/extension.ts:112-174` (7 commands); `package.json` contributes the same.
- Smoke test: `scripts/smoke-test.js` — 371 assertions, `assert(cond, label)` at line 187,
  static `package.json` section pattern `pkgS4` near line 2480.

**Design decisions (justified):**
1. **Protocol logic is pure and stream-injected** — `McpJsonRpc` takes
   `(input: ReadableStream, output: WritableStream)`; the smoke test simulates a server
   with `stream.PassThrough` pairs. `McpClient` (spawn) and `McpManager` are thin; the
   smoke test never spawns a process.
2. **All MCP tools are treated as mutating** for the approval gate (they can do anything
   external) — with `llm.tools.requireApproval` on, every MCP call goes through the
   existing `approval_request` path. No edit to `tools.ts`.
3. **Lazy start** — servers start only on (a) first `mcp__` tool call or (b) user picking
   a server in `llm.mcp.listServers` (refresh). `listServers()` never spawns.
4. **Schema mapping** — MCP `inputSchema` → OpenAI `parameters`, forcing
   `type: "object"` (some servers omit it).
5. **Never throw** — `McpManager.execute` returns an error `ToolResult` on any failure
   (mirrors `ToolExecutor.execute`); a dead server must not poison the tool loop.
6. **Name collisions** — `mcp__<server>__<tool>`; `parseMcpToolName` splits on the first
   and last `__` only; server/tool names containing `__` are unsupported (documented).
7. **Setting target** — `llm.mcp.addServer` writes `ConfigurationTarget.Workspace`; the
   manager re-reads settings each turn (no reload needed).
8. **Shared `McpManager`** — created in `activate()`, passed to the ChatViewProvider
   constructor and the commands; `dispose()` on deactivate.

**Slices:**

- **1.99-2.S1 — `src/mcp.ts` (new): pure MCP JSON-RPC client + tool mapping.** — Done (2026-10-22, PASS, 385 assertions)
  File: create `src/mcp.ts`; modify `scripts/smoke-test.js`.
  (a) `export interface McpServerConfig { command: string; args?: string[];
  env?: Record<string, string> }` + `export function parseMcpServers(raw: unknown):
  Record<string, McpServerConfig>` (pure validation: object only; each entry needs a
  non-empty string `command`; `args` coerced to string[] or undefined; `env` to string
  map; invalid entries dropped).
  (b) `export class McpJsonRpc` — newline-delimited JSON-RPC 2.0 over injected streams
  (`constructor(input: NodeJS.ReadableStream, output: NodeJS.WritableStream)`; no
  `child_process`). `request(method, params): Promise<unknown>` (id counter, pending map,
  resolves on matching `id`, rejects on JSON-RPC `error`); `notify(method, params)`;
  line-buffered reader (split on `\n`, ignore blank lines, tolerate partial lines).
  (c) `export class McpClient` — wraps `child_process.spawn(config.command, config.args,
  { env: { ...process.env, ...config.env } })`, pipes stdio into `McpJsonRpc`, handshake:
  `initialize` (params: `protocolVersion: "2024-11-05"`, `capabilities: {}`,
  `clientInfo: { name: "llm-vscode", version }`) → `notifications/initialized` →
  `tools/list`. Exposes `tools: McpTool[]` (`{ name, description?, inputSchema }`),
  `callTool(name, args): Promise<McpToolResult>` (`tools/call` with
  `{ name, arguments }`), `close()` (kills child), initialize timeout 10 s → reject +
  mark dead.
  (d) Pure mappers: `mcpToolName(server, tool)` → `` `mcp__${server}__${tool}` ``;
  `parseMcpToolName(name): { server, tool } | null`; `isMcpToolName(name)` (prefix
  `mcp__`); `mcpToolsToOpenAITools(server, tools): Tool[]` (maps `inputSchema` →
  `parameters`, forcing `type: "object"`); `mcpResultToText(result): string` (joins
  `content[]` parts where `type === "text"`; prefixes `Error: ` when `isError`).
  Acceptance: `npm run compile` clean.
  Smoke (`mcp-s1:`, ~10): framing (two messages in one chunk split correctly; partial
  line buffered); full handshake + `tools/list` + `tools/call` against a fake server from
  `stream.PassThrough` pairs (no real process); JSON-RPC error → rejection;
  `mcpToolName`/`parseMcpToolName` round-trip; `mcpToolsToOpenAITools` shape;
  `mcpResultToText` (multi-part + `isError`); `parseMcpServers` validation.
  Assertion count: 371 → ~381.

- **1.99-2.S2 — settings plumbing (`src/presets.ts`, `src/config.ts`).** — Done (2026-10-22, PASS, 387 assertions)
  Files: modify `src/presets.ts`, `src/config.ts`, `scripts/smoke-test.js`.
  (a) `presets.ts`: add `mcpServers: Record<string, McpServerConfig>` to `LlmSettings`
  (import the type from `./mcp` — `mcp.ts` is vscode-free, keeps `presets.ts` pure).
  (b) `config.ts`: `readSettings()` adds
  `mcpServers: parseMcpServers(c.get<unknown>("mcp.servers", {}))`.
  Acceptance: compiles.
  Smoke (`mcp-s2:`, 2): `out/presets.js`/`out/config.js` still load cleanly (regression
  guard).
  Assertion count: ~381 → ~383.

- **1.99-2.S3 — `src/mcpManager.ts` (new): lazy lifecycle + registry.** — Done (2026-10-22, PASS, 391 assertions)
  File: create `src/mcpManager.ts`; modify `scripts/smoke-test.js`.
  `export class McpManager` (no `vscode` import — pass a `notify` callback in the
  constructor to stay smoke-testable):
  - `setServers(servers: Record<string, McpServerConfig>)` (called each turn; drops
    clients for removed servers).
  - `ensureStarted(name): Promise<McpClient>` — lazy start on first need, cached; on
    failure records status `error`, no retry within the same turn.
  - `listServers(): McpServerStatus[]` — `{ name, status: "stopped" | "running" |
    "error", toolCount, error? }`; pure status read, does NOT auto-start.
  - `refresh(name): Promise<McpServerStatus>` — start/restart + discover tools (the
    changelog "refresh action").
  - `getTools(): Tool[]` — all discovered MCP tools as OpenAI `Tool`s (only successfully
    started servers).
  - `execute(name: string, args: Record<string, unknown>): Promise<ToolResult>` — full
    `mcp__server__tool` name; `ensureStarted` + `callTool`; returns `{ content }`, never
    throws.
  - `dispose()` — closes all clients.
  Acceptance: compiles; constructible without vscode at require-time.
  Smoke (`mcp-s3:`, ~4): `setServers` + `getTools` empty before start; `execute` with
  unknown server → error content (no throw); `listServers` reflects stopped status.
  Assertion count: ~383 → ~387.

- **1.99-2.S4 — extra tools in the request body (`src/request.ts`).**
  File: modify `src/request.ts`, `scripts/smoke-test.js`.
  (a) Add `mcpTools?: Tool[]` to `RequestConfig` (`src/request.ts:56`).
  (b) At `src/request.ts:272-275`: when `toolsEnabled`,
  `body.tools = mcpTools && mcpTools.length > 0 ? [...CODE_TOOLS, ...mcpTools] :
  CODE_TOOLS`.
  Acceptance: compiles.
  Smoke (`mcp-s4:`, 3): `buildRequestBody` with `mcpTools` → `body.tools` = built-in + N
  MCP tools with `mcp__` names; without `mcpTools` → exactly `CODE_TOOLS` (regression);
  `toolsEnabled: false` → no `tools` key.
  Assertion count: ~387 → ~390.

- **1.99-2.S5 — wire MCP into the chat tool loop (`src/chat/ChatViewProvider.ts`).**
  File: modify `src/chat/ChatViewProvider.ts`, `scripts/smoke-test.js`.
  (a) Accept an `McpManager` (constructor param, field next to `toolExecutor`); call
  `setServers(settings.mcpServers)` at the top of the send flow (where `readSettings()`
  is already called).
  (b) Pass `mcpTools: manager.getTools()` into both `buildRequestBody` calls (initial
  body + the rebuild at ~line 1230).
  (c) In the tool-call loop (~line 1131): if `isMcpToolName(call.function.name)` → treat
  as mutating for the approval gate (existing plain `approval_request` path, no command
  card) and route execution to `manager.execute(...)` instead of
  `this.toolExecutor.execute(call)` at line 1205. `tool_start`/`tool_result`
  postMessages unchanged.
  (d) `dispose()`/webview dispose: `manager.dispose()`.
  Acceptance: compiles.
  Smoke (`mcp-s5:`, 3): static source assertions on `out/chat/ChatViewProvider.js`
  (`isMcpToolName` usage, `mcpTools` passed to `buildRequestBody`, `manager.execute`
  routing).
  Assertion count: ~390 → ~393.

- **1.99-2.S6 — commands + manifest (`src/extension.ts`, `package.json`).**
  Files: modify `src/extension.ts`, `package.json`, `scripts/smoke-test.js`,
  `.github/agents/planner/PROGRESS.md`.
  (a) `package.json`: commands `llm.mcp.addServer` ("LLM: MCP: Add Server") and
  `llm.mcp.listServers` ("LLM: MCP: List Servers"); `onCommand` activation events for
  both; setting `llm.mcp.servers` (`type: "object"`, `default: {}`, description: stdio
  MCP servers, each `{ command, args?, env? }`).
  (b) `extension.ts`: create ONE shared `McpManager` in `activate()` (pass a `notify`
  callback using `vscode.window.showErrorMessage`), pass it to the ChatViewProvider
  constructor; `manager.dispose()` in `deactivate`.
  - `llm.mcp.addServer`: `showInputBox` flow name → command → args (space-separated,
    optional) → read current `llm.mcp.servers`, add entry, write via
    `workspace.getConfiguration("llm").update("mcp.servers", next,
    ConfigurationTarget.Workspace)`.
  - `llm.mcp.listServers`: QuickPick of `manager.listServers()` entries (label = name,
    description = status, detail = tool count); picking a server runs
    `manager.refresh(name)` and shows a second QuickPick / info message listing its tools
    (name + one-line description).
  (c) `smoke-test.js`: static section (mirroring `pkgS4`): both commands contributed
  with titles, both `onCommand` activation events, `llm.mcp.servers` schema `object`
  defaulting to `{}`, existing commands still present (regression guard).
  (d) `PROGRESS.md`: mark 1.99-2 Done, update Status/Next step.
  Acceptance: `npm run compile` + `node scripts/smoke-test.js` pass (~397 assertions).
  Assertion count: ~393 → ~397.

**Overall acceptance (Tester):** `npm run compile` clean; all smoke assertions pass;
`llm.mcp.servers` with a stdio server → its tools appear in the request body as
`mcp__<server>__<tool>`; with `llm.tools.requireApproval` on, MCP tool calls go through
the approval card; `llm.mcp.listServers` shows status without spawning, picking a server
starts it and lists its tools; `llm.mcp.addServer` writes the workspace setting; a dead
server returns an error tool result (never crashes the loop); child processes killed on
deactivate.

**Risks:** JSON-RPC framing must tolerate partial lines and multi-message chunks (covered
by S1 framing tests); `McpClient` spawn is untested in the smoke test by design (thin
wrapper); `__` in server/tool names unsupported (documented); the shared `McpManager`
must be created before the ChatViewProvider in `activate()`.

### Item 1.99-3 — Thinking tool (planned 2026-10-22)

**Changelog reference:** VS Code 1.99, "Thinking tool (Experimental)" — a `think`
tool that gives any model the opportunity to think between tool calls
(Anthropic-inspired); improves agent performance on complex tasks. Local reframe:
add a `think` tool to the agent tool loop — the model calls it with its reasoning,
the reasoning is echoed back as the tool result, no side effects.

**Verified code assumptions (file:line):**
- `src/tools.ts:12` — `interface Tool`; `src/tools.ts:48` — `CODE_TOOLS: Tool[]`
  (currently **11 tools**: read_file, write_file, edit_file, list_dir,
  search_files, run_command, get_diagnostics, git_status, git_diff,
  manage_todos, notebook_edit); `src/tools.ts:365` — `toolResultMessage(call,
  content)`; `src/tools.ts:381` — `isMutatingTool(name)` hardcoded list
  (`write_file`, `edit_file`, `run_command`, `notebook_edit`) — `think` NOT in it
  → returns false.
- `src/tools/ToolExecutor.ts:267` — `execute(call)` name-based `switch`, never
  throws (JSON parse errors + outer `catch` return error `ToolResult`s);
  `default:` → `Unknown tool: <name>`; private `result(call, content)` at 1190.
- `src/request.ts:272-279` — `buildRequestBody`: when `toolsEnabled`,
  `body.tools = mcpTools?.length ? [...CODE_TOOLS, ...mcpTools] : CODE_TOOLS`;
  `tool_choice = "auto"`. **No change needed** — `think` in `CODE_TOOLS` flows
  through automatically.
- `src/chat/ChatViewProvider.ts` — agentic loop ~1098; approval gate ~1139
  (`settings.requireApproval && isMutating`, `isMutating = isMutatingTool(name)
  || isMcpToolName(name)`); `tool_start` ~1190; execution ~1205
  (`this.toolExecutor.execute(call)` for non-MCP); `tool_result` ~1240; body
  rebuild ~1260. **No change needed** — `think` is non-mutating → skips approval
  gate, flows through `toolExecutor.execute` with generic posts.
- `src/chat/webview.ts:2200` — `case 'tool_start':` generic `.tool-card`
  (label "Tool call", tool name, args, spinner); `src/chat/webview.ts:2237` —
  `case 'tool_result':` finds card by `data-tool-id`, removes spinner, appends
  `<pre class="tool-output">`, collapses. **Generic rendering already handles
  `think`** — no webview change needed.
- `src/presets.ts:65` — `LlmSettings` (pure); `src/config.ts:63-64` —
  `toolsEnabled`/`requireApproval` via `c.get<boolean>("tools.enabled", false)`;
  `package.json:177-187` — `llm.tools.enabled` / `llm.tools.requireApproval`.
- `scripts/smoke-test.js` — `assert(cond, label)` at line 190; **401
  assertions**; ends `ALL SMOKE TESTS PASSED` at line 2903. `out/tools.js`,
  `out/request.js` require-able; `out/chat/ChatViewProvider.js` NOT (imports
  vscode) — static source assertions only. Existing regression guard at
  `scripts/smoke-test.js:474`: `CODE_TOOLS.length === 11` — **must be bumped to
  12 in S1**.

**Design decisions:**
1. Schema goes in `CODE_TOOLS` (`src/tools.ts`), not a separate export —
   `think` is a first-class no-side-effect meta tool like `manage_todos`;
   `request.ts` needs zero changes; smoke shape checks keep working.
2. `ToolExecutor.execute` gets `case "think"` echoing the reasoning back:
   `content = "Thought recorded: <text>"` (or `Thought recorded.` when empty).
   No I/O, no state, never throws.
3. No approval-gate treatment — `isMutatingTool("think")` is false (verified);
   runs immediately even with `requireApproval: true`.
4. No webview change — generic `tool_start`/`tool_result` card already displays
   the reasoning as output.
5. No new setting — always-on when `llm.tools.enabled` (existing gate, default
   false). A second boolean would be a redundant gate.

**Slices:**

- **1.99-3.S1 — `src/tools.ts`: `think` tool schema in `CODE_TOOLS`.** — Done (2026-10-22, PASS, 404 assertions)
  Files: `src/tools.ts` (modify), `scripts/smoke-test.js` (modify).
  Append a 12th entry to `CODE_TOOLS` (after `notebook_edit`):
  `name: "think"`; description: "Record a thought or reasoning step between tool
  calls. Use this to plan, reflect, or work through complex multi-step problems
  before acting. Takes a single 'thought' string; the thought is recorded and
  echoed back. It has no side effects and changes nothing."; parameters:
  `{ type: "object", properties: { thought: { type: "string", description:
  "The reasoning or plan to record." } }, required: ["thought"] }`.
  No change to `isMutatingTool`.
  Smoke (`think-s1:`, 3): `out/tools.js` — `CODE_TOOLS.length === 12`; the
  `think` entry exists with `required: ["thought"]` and
  `parameters.properties.thought.type === "string"`; `isMutatingTool("think")
  === false`. **Also update the existing line-474 assertion
  `CODE_TOOLS.length === 11` → `12`** (same slice, keeps suite green).
  Acceptance: compile clean; smoke 401 → 404.

- **1.99-3.S2 — `src/tools/ToolExecutor.ts`: `case "think"` echo handler.** — Done (2026-10-22, PASS, 407 assertions)
  Files: `src/tools/ToolExecutor.ts` (modify), `scripts/smoke-test.js` (modify).
  In `execute`'s switch (before `default:`): `case "think": return
  this.think(call, String(args.thought ?? ""));` + private method
  `think(call: ToolCall, thought: string): ToolResult` — `thought.trim() === ""`
  → `this.result(call, "Thought recorded.")`; else `this.result(call,
  "Thought recorded: " + thought)`. No I/O, no state, no throw.
  Smoke (`think-s2:`, 3): construct a `ToolExecutor` (existing executor-test
  pattern); `execute({ id: "t1", type: "function", function: { name: "think",
  arguments: JSON.stringify({ thought: "plan step 1" }) } })` →
  `tool_call_id === "t1"` and `content === "Thought recorded: plan step 1"`;
  empty thought → `content === "Thought recorded."`; invalid JSON arguments →
  content starts with `Invalid JSON arguments` (never throws).
  Acceptance: compile clean; smoke 404 → 407.

- **1.99-3.S3 — request-body + loop verification, final smoke assertions.**
  Files: `scripts/smoke-test.js` (modify). No source changes (wiring is
  automatic by design decisions 1 and 3).
  Smoke (`think-s3:`, 4): (a) `out/request.js` — `buildRequestBody` with
  `toolsEnabled: true` → `body.tools` contains a tool named `think` (12
  built-in + 0 MCP) and `body.tool_choice === "auto"`; (b) `toolsEnabled: false`
  → `body.tools === undefined` (regression: `think` not exposed without the tool
  loop); (c) static source assertion on `out/chat/ChatViewProvider.js`: contains
  `isMutatingTool` and `toolExecutor.execute(` (regression guard that `think`
  flows through the existing non-MCP path); (d) static source assertion:
  `ChatViewProvider.js` does NOT contain `name === "think"` (no special-casing —
  the loop stays generic).
  Acceptance: compile clean; smoke 407 → 411.

**Overall acceptance (Tester):** with `llm.tools.enabled: true`, the request
body's `tools` array includes the `think` tool; when the model emits a `think`
tool call it executes immediately (no approval card, even with
`requireApproval: true`), the webview shows the generic tool card with the
reasoning as output, and the model receives `Thought recorded: <text>` as the
tool result; with `llm.tools.enabled: false`, `think` is not exposed; compile
clean; all 411 smoke assertions pass.

**Risks:** some local engines ignore unknown/extra tools — acceptable, the tool
is opt-in via `llm.tools.enabled` and harmless if never called; the
`CODE_TOOLS.length` regression guard (line 474) is bumped in S1 so the suite
stays green mid-pipeline.

### Item 1.99-4 — Fetch tool (`#fetch`) (planned 2026-10-22)

**Changelog reference:** VS Code 1.99 — `#fetch` includes content from a publicly
accessible webpage in the prompt; picked up automatically in agent mode, referenceable
explicitly via `#fetch <url>`. Local reframe: plain Node 18+ `fetch` + hand-rolled
HTML→text extraction, size cap, per-URL in-memory cache. No headless browser.

**Verified code assumptions (file:line):**
- `src/tools.ts:12` — `interface Tool`; `:48` — `CODE_TOOLS` (**12 tools**, last:
  `think`); `:365` — `toolResultMessage`; `:381` — `isMutatingTool` hardcoded list
  (`write_file`, `edit_file`, `run_command`, `notebook_edit`) — `fetch_url` NOT in it
  → non-mutating, no approval gate.
- `src/tools/ToolExecutor.ts` — `execute()` name-based switch (ends `case "think"`
  then `default:`), never throws; private `result(call, content)`.
- `src/request.ts` — `buildRequestBody` spreads `CODE_TOOLS` (+ MCP) when
  `toolsEnabled` — new entry flows through automatically (zero change).
- `src/chat/ChatViewProvider.ts` — existing `#`-tag mechanism: `#codebase` (line 992),
  `#problems` (1008), `#folder:` (1037) — each = pure `extract*Tag` in
  `src/context.ts` + public `ToolExecutor` method + `llm.chat.*.enabled` setting.
  `#fetch` follows that pattern. Non-MCP tools route through
  `this.toolExecutor.execute(call)`; generic `tool_start`/`tool_result` webview cards —
  **no webview change needed**.
- `scripts/smoke-test.js` — 411 assertions; `assert(cond, label)` at line 190;
  `out/tools.js`, `out/request.js`, `out/context.js` require-able;
  `out/chat/ChatViewProvider.js` NOT (static source assertions only). Regression
  guards `CODE_TOOLS.length === 12` at lines **474 and 2909** — both bumped to 13 in S2.

**Design decisions:**
1. **Tool name `fetch_url`** (snake_case, matches the other 12). Params: `url`
   (string, required) + `max_chars` (number, optional). `required: ["url"]`.
2. **Pure module `src/fetchTool.ts`** (no `vscode` import, mirrors `src/notebook.ts`):
   - `htmlToText(html)` — strip `<script>`/`<style>` blocks (case-insensitive,
     non-greedy), replace `<br>`, `</p>`, `</div>`, `</li>`, `</h1..h6>`, `</tr>` with
     `\n`, remove all remaining tags, decode 5 common entities
     (`&amp; &lt; &gt; &quot; &#39;`), collapse 3+ newlines to 2, trim.
   - `fetchUrl(url, opts?: { maxChars?: number; fetchFn?: FetchFn }): Promise<string>`
     — `FetchFn = (url, init?) => Promise<Response>` (injectable; defaults to global
     `fetch`).
   - Caps: `DEFAULT_MAX_CHARS = 20000`, `HARD_MAX_CHARS = 50000` (model `max_chars`
     clamped to `[1, 50000]`); `TIMEOUT_MS = 15000` via `AbortSignal.timeout`;
     `MAX_RESPONSE_BYTES = 2_000_000` (read as `arrayBuffer`, reject if larger).
   - Cache: module-level `Map<string, { text: string; at: number }>`;
     `CACHE_TTL_MS = 600_000` (10 min), `CACHE_MAX_ENTRIES = 20` (FIFO eviction via
     `Map` insertion order). Key = URL string; only successful fetches cached.
     Export `clearFetchCache()`.
   - Content-type: `text/html` → `htmlToText`; else raw text.
   - **Never throws** — failures return error strings: `Invalid URL: <url>` (bad
     `new URL()` / non-http(s) scheme), `Fetch failed: <msg>`, `HTTP <status>
     <statusText> for <url>` (non-2xx), `Response too large (>2000000 bytes): <url>`.
   - Truncation: text > maxChars → cut + `\n… (truncated, showing first <n> of <total>
     chars)`.
3. **ToolExecutor:** `case "fetch_url"` → private `fetchUrlTool(call, url, maxChars)`;
   plus **public** `fetchUrl(url, maxChars?)` thin wrapper so the `#fetch` tag path
   reuses it (mirrors `codebaseSweep`/`collectDiagnostics`/`folderSweep`).
4. **`#fetch <url>` tag** follows the `#problems` pattern: `extractFetchTag(text):
   string | null` (regex `/#fetch(?!\w)\s+(\S+)/i`, first match, same-line URL;
   `null` = absent or bare `#fetch` with no URL — a no-op, unlike `#folder`'s root
   fallback); `formatFetchBlock(url, text)` (header `Fetched page: <url>`, body,
   20,000-char cap with `… (truncated)` suffix, `""` when body empty).
5. **Setting `llm.chat.fetch.enabled`** (boolean, default `true`) — mirrors
   `llm.chat.problems.enabled`; tag runs regardless of `llm.tools.enabled`. The
   **tool** is gated by the existing `llm.tools.enabled` (automatic via `CODE_TOOLS`).
6. **No approval gate** — `isMutatingTool("fetch_url")` is false (read-only).
7. **No webview change** — generic `.tool-card` renders `fetch_url` automatically.
8. **No new dependencies** — Node 18+ global `fetch`, regex extraction.

**Slices:**

- **1.99-4.S1 — `src/fetchTool.ts` (new): pure fetch + HTML→text + cache.** — Done (2026-10-22, PASS, 419 assertions)
  Files: `src/fetchTool.ts` (new), `scripts/smoke-test.js` (modify).
  Implement design decision 2 (exports: `htmlToText`, `fetchUrl`, `clearFetchCache`,
  `DEFAULT_MAX_CHARS`, `HARD_MAX_CHARS`, `CACHE_TTL_MS`, `CACHE_MAX_ENTRIES`,
  `type FetchFn`).
  Smoke (`fetch-s1:`, 8): (1) exports present + `DEFAULT_MAX_CHARS === 20000`;
  (2) `htmlToText` on a full HTML fixture (script/style/head) === `"Title\nHello
  world"`; (3) entity decoding `a&amp;b &lt;c&gt;` → `a&b <c>`; (4) `fetchUrl` with
  injected `fetchFn` (200 `text/html`) → text, not tags; (5) second call with a
  throwing `fetchFn` resolves cached text (fetchFn not invoked — counter); (6) 404
  response → starts with `HTTP 404`; (7) `fetchUrl("not a url")` and
  `fetchUrl("ftp://x")` → start with `Invalid URL`; (8) `maxChars: 10` on long body →
  ends with `(truncated`, length bounded; `clearFetchCache()` callable.
  Acceptance: compile clean; smoke 411 → 419.

- **1.99-4.S2 — `src/tools.ts` + `src/tools/ToolExecutor.ts`: `fetch_url` schema + executor case.** — Done (2026-10-22, PASS, 422 assertions)
  Files: `src/tools.ts`, `src/tools/ToolExecutor.ts`, `scripts/smoke-test.js` (modify).
  (a) `tools.ts`: append 13th `CODE_TOOLS` entry after `think`: `name: "fetch_url"`;
  description: "Fetch a publicly accessible webpage and return its text content (HTML
  converted to plain text). Use this to read documentation, API references, or any
  public URL. The content is truncated to max_chars (default 20000). Read-only: does
  not change the workspace."; params `url` (string, required) + `max_chars` (number,
  "Optional maximum characters to return (default 20000, max 50000)");
  `required: ["url"]`. No `isMutatingTool` change.
  (b) `ToolExecutor.ts`: import `fetchUrl` from `../fetchTool`; `case "fetch_url":
  return await this.fetchUrlTool(call, String(args.url ?? ""), typeof args.max_chars
  === "number" ? args.max_chars : undefined);` before `default:`; private
  `fetchUrlTool(call, url, maxChars)` → `this.result(call, await fetchUrl(url,
  { maxChars }))`; **public** `async fetchUrl(url: string, maxChars?: number):
  Promise<string>` thin wrapper (for the `#fetch` tag path).
  Smoke (`fetch-s2:`, 3): (1) `CODE_TOOLS.length === 13`, `fetch_url` entry
  `required: ["url"]` + `properties.url.type === "string"`,
  `isMutatingTool("fetch_url") === false`; (2) **bump both existing guards**
  `CODE_TOOLS.length === 12` → `13` (lines 474 and 2909); (3) `buildRequestBody`
  `toolsEnabled: true` → `body.tools` contains `fetch_url`.
  Acceptance: compile clean; smoke 419 → 422.

- **1.99-4.S3 — `src/context.ts`: `extractFetchTag` + `formatFetchBlock` (pure).** — Done (2026-10-22, PASS, 425 assertions)
  Files: `src/context.ts`, `scripts/smoke-test.js` (modify).
  `extractFetchTag(text): string | null` — regex `/#fetch(?!\w)\s+(\S+)/i`, first
  match, trimmed URL; `null` when absent or bare `#fetch` with no URL.
  `FETCH_BLOCK_MAX_CHARS = 20000`; `formatFetchBlock(url, text)` — `""` when
  `text.trim() === ""`; else `Fetched page: <url>\n\n<text>` with 20,000-char cap +
  `… (truncated)` suffix.
  Smoke (`fetch-s3:`, 3): (1) `extractFetchTag("please read #fetch
  https://example.com/docs")` === the URL; absent → `null`; bare `#fetch` at end →
  `null`; `#fetchfoo` no match; (2) `formatFetchBlock("https://x", "body")` starts
  with `Fetched page: https://x` + contains `body`; empty body → `""`; (3) 25,000-char
  body → length ≤ 20,050, ends with `(truncated)`.
  Acceptance: compile clean; smoke 422 → 425.

- **1.99-4.S4 — `#fetch` tag wiring + setting (FINAL)** — Done (2026-10-22, PASS, 426 assertions).
  Files: `src/chat/ChatViewProvider.ts`, `src/config.ts`, `src/presets.ts`,
  `package.json`, `scripts/smoke-test.js`, `.github/agents/planner/PROGRESS.md`
  (modify).
  (a) `presets.ts`: `fetchEnabled: boolean` on `LlmSettings`.
  (b) `config.ts`: `readSettings()` adds
  `fetchEnabled: c.get<boolean>("chat.fetch.enabled", true)`.
  (c) `ChatViewProvider.ts`: import `extractFetchTag`, `formatFetchBlock` from
  `../context`; in `runStream` after the `#folder:` block (~line 1037–1050): if
  `settings.fetchEnabled && lastUser`, `const u = extractFetchTag(lastUser.content)`;
  if `u !== null`, `const fetched = await this.toolExecutor.fetchUrl(u)`;
  `const fetchBlock = formatFetchBlock(u, fetched)`; append to `finalContextBlock`
  (same `? + "\n\n" + :` pattern).
  (d) `package.json`: `llm.chat.fetch.enabled` (boolean, default `true`, description:
  "Allow the `#fetch <url>` tag to include webpage content in chat context. The page
  is fetched over plain HTTP and converted to plain text (cached for 10 minutes).")
  next to the other `llm.chat.*` entries.
  (e) `smoke-test.js` (`fetch-s4:`, 1): static source assertion —
  `out/chat/ChatViewProvider.js` contains `extractFetchTag` and `fetchUrl(`.
  (f) `PROGRESS.md`: mark 1.99-4 Done, update Status/Next step.
  Acceptance: `npm run compile` + `node scripts/smoke-test.js` pass (**426
  assertions**); setting visible in the settings UI.

**Overall acceptance (Tester):** `npm run compile` clean; all **426** smoke
assertions pass; with `llm.tools.enabled: true` the request body's `tools` includes
`fetch_url` (13 built-in) and a `fetch_url` call runs without an approval card (even
with `requireApproval: true`), with errors (bad URL, non-200, timeout, oversized)
returned as error tool results (never a crash); `#fetch https://example.com` in any
mode injects a `Fetched page: <url>` block (≤20,000 chars) into the system prompt,
cached per URL for 10 min; `llm.chat.fetch.enabled: false` makes the tag inert; no
webview changes, no new runtime dependencies.

**Risks:** no network in smoke tests — all fetch behavior via injected `fetchFn`
(real global-`fetch` path is a thin untested wrapper, same stance as `McpClient`
spawn); outbound GET without approval (SSRF-ish via prompt injection — acceptable for
a local dev tool; follow-up could add a host allowlist); regex-based HTML→text (no DOM
parser, zero-dep constraint); cache is per-process, lost on reload.

### Item 1.99-5 — Usages tool (`#usages`) (planned 2026-10-22)

**Changelog reference:** VS Code 1.99, "Agent mode tools — Usages tool (`#usages`)" —
`#usages` combines Find All References + Find Implementations + Go to Definition so chat
can learn about a function/class/interface (sample implementations, refactor impact);
picked up automatically in agent mode, referenceable via `#usages <symbol>` in other modes.

**Local reframe:** engine-agnostic, free local LLM — no VS Code language-service reference
API. Grep-based whole-word usages search across the workspace (Node built-ins only),
mirroring the existing `search_files` CODE_TOOL walk (`ToolExecutor.searchMatches`).

**Design decisions (justified):**
1. **Tool name `find_usages`** — distinct from `search_files` (free-text/regex);
   symbol-oriented whole-word search. Read-only → NOT in `isMutatingTool`.
2. **Pure helper module `src/usages.ts`** (mirrors `src/fetchTool.ts`/`src/context.ts`):
   regex building + block formatting are pure/smoke-testable; the workspace walk stays in
   `ToolExecutor` (needs `workspaceFolders`, `SKIP_DIRS`, `MAX_READ_BYTES`).
3. **Whole-word regex:** `(?<![A-Za-z0-9_$])<escaped>(?![A-Za-z0-9_$])` — case-sensitive;
   lookarounds (not `\b`) so `_private`/`$id` symbols match correctly.
4. **Definition heuristic:** first match in walk order labeled `def:`; no language service.
5. **Tag:** `/#usages(?!\w)\s+([A-Za-z_$][A-Za-z0-9_$]*)/i` — bare `#usages` → null,
   `#usagesfoo` → null.
6. **Cap:** `USAGES_BLOCK_MAX_CHARS = 20000` (consistent with fetch/folder),
   `… (truncated)` suffix, `""` on empty body; ≤5 lines/file, ≤200 matches.
7. **Setting:** `llm.chat.usages.enabled` (default true), config field `usagesEnabled` —
   tag runs regardless of `llm.tools.enabled` (same as `#fetch`/`#codebase`).

**Slices:**

- **1.99-5.S1 — `src/usages.ts`: pure usages helpers (new file).** — Done (2026-10-22, PASS, 430 assertions)
  File: `src/usages.ts` (new; no `vscode` import, no I/O).
  (a) `export function buildUsagesRegex(symbol: string): RegExp` — escape
  (`replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`) + lookaround whole-word regex; empty/whitespace
  symbol → throw `Error("symbol is empty")`.
  (b) `export interface UsagesMatch { file: string; line: number; text: string;
  isDefinition: boolean }`.
  (c) `export const USAGES_BLOCK_MAX_CHARS = 20000;`
  (d) `export function formatUsagesBlock(symbol: string, matches: UsagesMatch[]): string` —
  `""` when empty; else header `Usages for \`symbol\`: N reference(s) in M file(s)`, then
  per file (first-appearance order) `def: <line>: <text>` for the first match and
  `<line>: <text>` for the rest (≤5 lines/file, `… and K more in <file>`); whole block
  truncated to `USAGES_BLOCK_MAX_CHARS` + `… (truncated)`.
  Acceptance: `npm run compile` clean.
  Smoke (`usages-s1:`, 4): exports present; regex matches `foo()`/`x = foo`, rejects
  `foobar`/`foo_bar`; `formatUsagesBlock("foo", []) === ""`; 25k body truncates ≤20050
  ending `(truncated)`, `USAGES_BLOCK_MAX_CHARS === 20000`.
  Expected smoke total: **430**.

- **1.99-5.S2 — `src/tools.ts` + `src/tools/ToolExecutor.ts`: `find_usages` tool.** — Done (2026-10-22, PASS, 435 assertions)
  Files: `src/tools.ts`, `src/tools/ToolExecutor.ts`.
  (a) `tools.ts`: append 14th `Tool` after `fetch_url` — name `find_usages`, description
  "Find all usages of a symbol (function/class/interface/variable) across the workspace:
  whole-word matches grouped by file, first match marked as the likely definition, with a
  reference count. Use to understand a symbol's implementations and refactor impact.",
  params `{ symbol: string (required), path?: string }`. `isMutatingTool` unchanged.
  (b) `ToolExecutor.ts`: `case "find_usages":` → `this.findUsages(call, String(args.symbol
  ?? ""), args.path ? String(args.path) : undefined)`. New `private async findUsages(...)`:
  empty symbol → error result; `resolveSafe(relPath ?? ".")` guard (same message as
  `searchFiles`); `buildUsagesRegex` in try/catch → error result; `searchMatches`-style
  walk (cap 200) collecting `UsagesMatch[]` via `toWorkspaceRelative`; first match
  `isDefinition: true`; `formatUsagesBlock`; zero matches → `No usages found for
  \`symbol\``.
  Acceptance: `npm run compile` clean; tool read-only (no approval gate).
  Smoke (`usages-s2:`, 5 new + 2 updates): update existing `CODE_TOOLS.length === 13`
  (line ~474) → 14 and the names-list assertion (line ~475) → append `,find_usages`;
  update `toolsS1.CODE_TOOLS.length === 13` (line ~3076) and `fetchBody.tools.length ===
  13` (line ~3113) → 14; new: `byName.find_usages` required `["symbol"]` +
  `isMutatingTool("find_usages") === false`; temp-dir fixture (`mkdtempSync`, `a.ts` with
  `function foo() {}` + `foo()`, `b.ts` with `foo();` + `foobar`) → `execute` content
  includes `def:`, `a.ts`, `b.ts`, `2 reference(s)`, excludes `foobar`;
  `buildRequestBody` `toolsEnabled: true` → `body.tools.length === 14` incl. `find_usages`.
  Expected smoke total: **433**.

- **1.99-5.S3 — `src/context.ts`: `#usages` tag extract + block format.** — Done (2026-10-22, PASS, 439 assertions)
  File: `src/context.ts`.
  (a) `export function extractUsagesTag(text: string): string | null` —
  `/#usages(?!\w)\s+([A-Za-z_$][A-Za-z0-9_$]*)/i`; trimmed symbol or `null`.
  (b) `export function formatUsagesTagBlock(symbol: string, body: string): string` —
  `""` on empty body; else `Usages for \`symbol\`:\n\n<body>` truncated to
  `USAGES_BLOCK_MAX_CHARS` (imported from `./usages`) + `… (truncated)`.
  Acceptance: `npm run compile` clean.
  Smoke (`usages-s3:`, 4): `extractUsagesTag("explain #usages myFunc please") ===
  "myFunc"`; null for `"no tag"` / `"end #usages"` / `"#usagesfoo x"`;
  `formatUsagesTagBlock("f", "body")` starts with `` Usages for `f`: `` and includes
  `body`, empty body → `""`; 25k body truncates ≤20050 ending `(truncated)`.
  Expected smoke total: **437**.

- **1.99-5.S4 — wiring: `ChatViewProvider` + `config.ts` + `package.json` + smoke +
  PROGRESS.md.** — Done (2026-10-22, PASS, 441 assertions)
  Files: `src/chat/ChatViewProvider.ts`, `src/config.ts`, `package.json`,
  `scripts/smoke-test.js`, `.github/agents/planner/PROGRESS.md`.
  (a) `config.ts`: `usagesEnabled: c.get<boolean>("chat.usages.enabled", true)` next to
  `fetchEnabled` (~line 75).
  (b) `package.json`: `llm.chat.usages.enabled` (boolean, default `true`) after
  `llm.chat.fetch.enabled` (~line 250): "Allow the `#usages <symbol>` tag to include a
  workspace-wide usages report (whole-word matches grouped by file, definition +
  reference count) in chat context."
  (c) `ChatViewProvider.ts`: import `extractUsagesTag`, `formatUsagesTagBlock`; after the
  `#fetch` block (~line 1063) add the `#usages` block mirroring it — gated on
  `settings.usagesEnabled && lastUser && this.toolExecutor` → `extractUsagesTag` →
  `this.toolExecutor.findUsagesPublic(symbol)` (new `public async findUsagesPublic(symbol:
  string): Promise<string>` wrapper around the private core, same pattern as
  `collectDiagnostics`/`fetchUrl` backing both tool and tag) → `formatUsagesTagBlock` →
  append to `finalContextBlock`.
  (d) `smoke-test.js` (`usages-s4:`, 2): `out/chat/ChatViewProvider.js` source (readFile
  only — not require-able) includes `extractUsagesTag` and `findUsagesPublic(`;
  `out/config.js` source includes `"chat.usages.enabled"`.
  (e) `PROGRESS.md`: mark 1.99-5 Done, update Status/Next step.
  Acceptance: `npm run compile` + `node scripts/smoke-test.js` pass.
  Expected smoke total: **439**.

**Overall acceptance (Tester):** with `llm.tools.enabled: true`, the model can call
`find_usages` (14th tool, read-only, no approval) and gets a grouped, capped usages report
with a `def:` marker and reference count; `#usages <symbol>` in any mode injects a
`Usages for \`symbol\`:` block (≤20,000 chars) into the system prompt;
`llm.chat.usages.enabled: false` makes the tag inert; whole-word matching excludes
`foobar`-style substrings; no webview changes; no new runtime dependencies;
`npm run compile` clean; smoke 439 PASS.

**Risks:** whole-word regex is a heuristic (no language service) — misses aliased/renamed
imports and dynamic references; "definition" = first match in walk order (may be a
reference if the definition file sorts later); tag runs regardless of
`llm.tools.enabled` (consistent with `#fetch`/`#codebase`); no webview chip/indicator
(matches `#fetch` precedent).

### Item 1.99-6 — Create a new workspace with agent mode (planned 2026-10-22)

**Changelog reference:** VS Code 1.99, "Create a new workspace with agent mode (Experimental)" — agent mode initializes, configures, and launches new projects (extension, MCP server, dev environment) with dependencies and settings. Local reframe: a `#newWorkspace <type> [folder]` chat tag that injects a scaffold prompt instructing the agent to create the project files via the existing file tools (`write_file`, `list_dir`, `run_command`). No new dependencies, no webview redesign.

**Design decisions:**
1. **Tag, not command** — `#newWorkspace <type> [folder]` follows the `#fetch`/`#usages` pattern.
2. **Prompt-driven scaffolding, no direct file seeding** — the scaffold prompt instructs the agent to create files via `write_file`/`run_command`.
3. **Four small templates** in new pure module `src/workspaceScaffold.ts`: `extension`, `mcp-server`, `dev-env`, `generic`. Each ≤5 files, ≤~40 lines/file.
4. **Tag grammar:** `/#newWorkspace(?!\w)\s+([a-z-]+)(?:\s+(\S+))?/i` — type required, validated; folder optional, defaults to `<type>-project`.
5. **Setting `llm.chat.newWorkspace.enabled`** (boolean, default `true`).
6. **No webview change, no new tools, no new dependencies.**

**Slices:**

- **1.99-6.S1 — `src/workspaceScaffold.ts` (new): templates + prompt builder (pure) — Done (2026-10-22, PASS, 446 assertions).**
  Files: `src/workspaceScaffold.ts` (new), `scripts/smoke-test.js`.
  `WorkspaceTemplate` interface, `WORKSPACE_TEMPLATES` (4 templates), `listWorkspaceTypes()`, `buildScaffoldPrompt(type, folder)`.
  Smoke (`ws-s1:`, 5). Acceptance: compile clean; smoke 441 → **446**.

- **1.99-6.S2 — `src/context.ts`: `#newWorkspace` tag extract + block format (pure).**
  Files: `src/context.ts`, `scripts/smoke-test.js`.
  `extractNewWorkspaceTag(text)`, `formatWorkspaceBlock(type, folder, prompt)`.
  Smoke (`ws-s2:`, 4). Acceptance: compile clean; smoke 446 → **450**.

- **1.99-6.S3 — wiring: `ChatViewProvider` + `config.ts` + `presets.ts` + `package.json`.**
  Files: `src/chat/ChatViewProvider.ts`, `src/config.ts`, `src/presets.ts`, `package.json`.
  `newWorkspaceEnabled` setting; `#newWorkspace` block in `runStream` after `#usages`.
  Acceptance: compile clean; tag injects scaffold block.

- **1.99-6.S4 — final smoke assertions + PROGRESS.md (FINAL).**
  Files: `scripts/smoke-test.js`, `.github/agents/planner/PROGRESS.md`.
  Smoke (`ws-s4:`, 3). Acceptance: compile + smoke pass (**453 assertions**).

**Risks:** agent needs `llm.tools.enabled: true` to create files; folder paths workspace-relative (`resolveSafe` guard); template `package.json` names use fixed placeholder.

## Done

- **1.98-12** (2026-10-22) — Change completions model. All slices S1–S4 implemented (`buildCompletionsModelList` pure quick-pick list builder in `src/presets.ts`; `completionsModel` config field in `src/presets.ts`/`src/config.ts` with `InlineCompletionProvider` swapping `settings.model` for the completions model when non-empty (toolbar override still wins); `llm.changeCompletionsModel` QuickPick command in `src/extension.ts` (engine models via `client.listModels()`, failure → warning + configured-only list, writes `ConfigurationTarget.Workspace` or `Global`); `package.json` command + `llm.completions.model` setting schema; final smoke assertions). Key decisions:
  1. **Fallback chain** `llm.completions.model` → `llm.model` → engine default — empty setting keeps prior behavior exactly (no `model` override).
  2. **Zero changes to `request.ts`** — the provider swaps `settings.model` before `buildRequestBody`; the existing `toolbar.model ?? settings.model` precedence means the toolbar override still wins (consistent with chat).
  3. **Command never hard-fails** — engine unreachable → warning + list of configured models only.
  4. **Workspace-scoped write** (global when no workspace folder) — per-project capability choice.
- **1.98-10** (2026-10-22) — `#folder:` tag: attach a folder's file tree as chat context. All slices S1–S4
  implemented (`extractFolderTag`/`formatFolderBlock` pure helpers in `src/context.ts`; `ToolExecutor.folderSweep`
  file-tree sweep (depth ≤ 3, cap 100 entries, no contents); `ChatViewProvider.runStream` injects the folder block
  after the `#problems` block, gated on `llm.chat.folderContext.enabled` (default true); `package.json` settings
  schema entry; final smoke assertions). Key decisions:
  1. **Tag-only scope** — no paperclip/drag-and-drop (single webview, no attachment UI).
  2. **File tree only** — no file contents (that's `read_file`'s job); mirrors `codebaseSweep`'s structure walk.
  3. **Bounded output** — 100 entries (sweep) + 8,000 chars (formatting, `… (truncated)` suffix).
  4. **No fallback for bad folder names** — renders `(folder not found: <name>)` so the model sees the error;
     bare `#folder` sweeps the workspace root (never a silent no-op).
  5. **`folderContextEnabled` config field pulled into S3** so that slice compiles standalone; S4 only added the
     `package.json` schema entry + final smoke assertions.
- **1.98-9** (2026-10-22) — `#problems` tag: attach compiler/linter problems as chat context. All slices S1–S4
  implemented (`extractProblemsTag`/`formatProblemsBlock` pure helpers in `src/context.ts`; `ToolExecutor.collectDiagnostics`
  extracted from `getDiagnostics` with a 50-problem cap; `ChatViewProvider.runStream` injects the problems block after the
  `#codebase` block, gated on `llm.chat.problems.enabled` (default true), with qualifier path-rejection → workspace fallback;
  `package.json` settings schema entry; final smoke assertions). Key decisions:
  1. **Tag-only scope** — no paperclip/drag-and-drop (single webview, no attachment UI).
  2. **Reuses diagnostics collection** — `collectDiagnostics` is the extracted `getDiagnostics` core; the `get_diagnostics`
     tool output is unchanged (thin wrapper).
  3. **Bounded output** — 50 problems (collection) + 8,000 chars (formatting, `… (truncated)` suffix).
  4. **`problemsEnabled` config field pulled into S3** so that slice compiles standalone; S4 only added the `package.json`
     schema entry + final smoke assertions.
- **1.98-1** (2026-10-22) — Editable terminal command approval in chat. All slices S1–S5
  implemented and committed (webview `command_approval` card with editable command +
  Ctrl+Enter; host `commandApproval` handler + `waitForCommandApproval`; agentic loop routes
  `run_command` through the editable gate with edited-command rewrite + "modified by user"
  badge; settings description updated; smoke-test source assertions added).
- **1.98-8** (2026-10-22) — `#codebase` tag: advanced codebase search in chat. All slices S1–S4
  implemented (`extractCodebaseQuery`/`formatCodebaseSweep` pure helpers in `src/context.ts`;
  `ToolExecutor.codebaseSweep` gathering project structure + git status + text search via shared
  `searchMatches`; `ChatViewProvider.runStream` injects the sweep after the `@file` block, gated on
  `llm.chat.codebaseSearch.enabled` (default true); `package.json` settings schema entry; final smoke
  assertions). Key decisions:
  1. **No embeddings/semantic search** — the paid-service sub-item was dropped; the sweep reuses
     existing ToolExecutor logic (structure walk, `gitStatusText`, `searchMatches`).
  2. **Sweep runs regardless of `llm.tools.enabled`** — it is context injection, not tool calling;
     the only gate is the new setting.
  3. **`codebaseSearchEnabled` config field pulled into S3** so that slice compiles standalone; S4
     only added the `package.json` schema entry + final smoke assertions.
- **1.98-2** (2026-10-22) — Notebook support in chat. All slices S1–S6 implemented
  (`notebook_edit` tool with 5 actions; pure `src/notebook.ts` parse/format/create/apply
  module; `ToolExecutor` executes it with snapshot/revert; tagged `.ipynb` files render
  cell-by-cell in context; `requireApproval` description updated; final smoke assertions
  added). Key decisions:
  1. **Single `notebook_edit` tool with 5 actions** (`create`, `modify_cell`, `insert_cell`,
     `delete_cell`, `change_cell_type`) instead of one tool per action — keeps the tool list
     small for weaker local engines; multi-cell `create` uses the `<<<CELL>>>` text marker.
  2. **Plain-text cell-change summary** (e.g. `Modified cell 2 (code): 42 chars of source.`)
     as the tool result instead of a JSON line diff — a diff on raw `.ipynb` JSON is noisy
     and unhelpful to the model.
  3. **No host/webview changes** — `isMutatingTool("notebook_edit")` is `true`, so the
     existing generic `approval_request` gate in `ChatViewProvider.ts` picks the tool up
     with zero new host or webview code (verified by a final smoke assertion).

- [x] Plan backlog item 1.98-14 (Copilot Vision — image attachments) — planned 2026-10-22; 5 slices S1–S5.
- [x] Dispatch slices 1.98-14.S1 → S5 (one per session).
- [x] Plan backlog item 1.98-15 (Engine status indicator) — planned 2026-10-22; 4 slices S1–S4.
- [x] Dispatch slices 1.98-15.S1 → S4 (one per session).
## Todo

- [x] Wait for the Changelog Researcher to populate the backlog.
- [x] Plan backlog item 1.98-1 (editable terminal command approval) — planned 2026-10-22.
- [x] Dispatch slices 1.98-1.S1 → S5 (one per session).
- [x] Plan backlog item 1.98-2 (notebook support in chat) — planned 2026-10-22; slices S1–S6 dispatched and done.
- [x] Plan backlog item 1.98-8 (`#codebase` tag — advanced codebase search; drop the embeddings sub-item) — planned 2026-10-22; slices S1–S4 dispatched and done.
- [x] Plan backlog item 1.98-9 (`#problems` tag) — planned 2026-10-22; slices S1–S4 dispatched and done.
- [x] Plan backlog item 1.98-10 (`#folder:` tag) — planned 2026-10-22; slices S1–S4 dispatched and done.
- [x] Plan backlog item 1.98-12 (Change completions model) — planned 2026-10-22; slices S1–S4 dispatched and done.
- [ ] For each dispatched item: study the changelog entry (text + images), ground the plan in
      the real codebase, break it into tiny slices (one file / one concern each), write the
      plan, record it here.

## Notes / decisions

- The planner does NOT write code. Only the Coder writes code.
- Every plan must reference real file paths and existing patterns (read the relevant source
  files read-only first).
- Every slice must touch **at most one file and one concern** and be independently compilable
  (`npm run compile`) and committable. The orchestrator dispatches ONE slice per session, so
  keep slices tiny to limit token consumption.
- Always plan oldest → newest. Never skip ahead.

---

# Plan: 1.98-2 — Notebook support in chat — **Done** (2026-10-22, slices S1–S6 complete)

**Changelog reference:** VS Code 1.98 — "Notebook support in Copilot Edits (Preview): edit notebook files from chat — create notebooks, modify content across multiple cells, insert/delete cells, change cell types."

## Approach

Notebooks are plain JSON (`.ipynb`, nbformat 4), so with zero dependencies we add **one mutating tool, `notebook_edit`**, with an `action` parameter (`create` | `modify_cell` | `insert_cell` | `delete_cell` | `change_cell_type`) that parses the `.ipynb` JSON, mutates the `cells` array, and writes it back. All pure parse/format/mutate logic lives in a new dependency-free module `src/notebook.ts` (independently testable from `scripts/smoke-test.js` against compiled `out/`), while `ToolExecutor` handles the vscode-specific parts (path safety, snapshot/revert, write). Because `isMutatingTool("notebook_edit")` returns `true`, the existing boolean `approval_request` gate in `ChatViewProvider.ts` picks it up **with zero changes to the host or webview** — the generic approval card already renders tool name + args. Context: when a `.ipynb` is tagged via `@filename`, `buildContextBlock` renders a cell-by-cell text view (source + output summary) instead of raw JSON. The tool result includes a plain-text summary of the cell change (the existing line diff on raw JSON is noisy, so a summary is the primary feedback, per the design direction).

## Slices

### S1 — `notebook_edit` tool schema + mutating flag
- **File:** `src/tools.ts`
- **What:** Add a `notebook_edit` entry to `CODE_TOOLS` (after `manage_todos`):
  - `description`: "Edit a Jupyter notebook (.ipynb) file. Actions: `create` (create a new notebook with the given cells), `modify_cell` (replace a cell's source), `insert_cell` (insert a new cell at cell_index), `delete_cell` (remove a cell), `change_cell_type` (switch a cell between `code` and `markdown`). Cell indices are 0-based. Use this instead of write_file/edit_file for .ipynb files."
  - `parameters.properties`: `path` (string, workspace-relative `.ipynb` path), `action` (string, enum of the 5 actions), `cell_index` (number, 0-based; required for modify/delete/change_cell_type; for insert_cell the new cell takes this index), `cell_type` (string, enum `code`|`markdown`, for create/insert/change_cell_type), `source` (string, cell source text; for create, multiple cells are separated by a documented marker — use `\n<<<CELL>>>\n` between cells).
  - `required: ["path", "action"]`.
  - Extend `isMutatingTool()`: `name === "notebook_edit"`.
- **Acceptance:** `npm run compile` passes. Smoke test (extend section 5 + 7b): `CODE_TOOLS.length === 11`; tool-name order string ends with `...,manage_todos,notebook_edit`; `byName.notebook_edit.function.parameters.required.join(",") === "path,action"`; `action` enum has 5 values; `isMutatingTool("notebook_edit")` is true.

### S2 — `src/notebook.ts`: pure parse / format / create helpers
- **File:** `src/notebook.ts` (new)
- **What:** Pure module, no `vscode` import, no deps:
  - `interface NbCell { cell_type: "code" | "markdown"; source: string; outputs?: unknown[]; }` and `interface NbDoc { cells: NbCell[]; }` (source normalized to a single string — join `string[]` sources).
  - `parseNotebook(text: string): NbDoc | null` — JSON.parse, validate `cells` is an array, normalize each cell's `source` (string | string[]) to a string; return `null` on any failure.
  - `formatNotebookForContext(text: string): string` — human-readable rendering: per cell `### Cell N (code|markdown)` + source in a fenced block + one-line output summary (e.g. `outputs: 2 (stream, error)` or `outputs: none`); returns a clear error string when `parseNotebook` fails.
  - `createNotebook(source: string): string` — build a minimal valid nbformat-4 `.ipynb` JSON string (nbformat 4, nbformat_minor 5, empty metadata, `language_info` for code cells); splits `source` on the `<<<CELL>>>` marker into cells.
- **Acceptance:** `npm run compile` passes. Smoke test (new section, e.g. `// 10) notebook helpers (1.98-2)`): `parseNotebook` round-trips a 2-cell doc (string and string[] sources); `parseNotebook("not json") === null`; `formatNotebookForContext` output contains `Cell 0 (code)`, the source text, and an `outputs:` line; `createNotebook` output parses via `parseNotebook` with the expected cell count/types.

### S3 — `src/notebook.ts`: `applyNotebookEdit` (the 5 actions)
- **File:** `src/notebook.ts`
- **What:** Add `applyNotebookEdit(text: string, edit: { action: string; cellIndex?: number; cellType?: "code" | "markdown"; source?: string }): { ok: boolean; message: string; newContent?: string }`:
  - `create`: ignore `text`; `newContent = createNotebook(source ?? "")`; message `Created notebook with N cell(s).`
  - `modify_cell` / `delete_cell` / `change_cell_type`: parse existing (error message if invalid JSON or not a notebook), validate `cellIndex` is an integer in `[0, cells.length)` (error message includes valid range), mutate, `newContent = JSON.stringify(doc, null, 1)`.
  - `insert_cell`: parse existing; `cellIndex` clamped to `[0, cells.length]`; splice in a new cell (`outputs: []` for code); message states new index + total.
  - Messages are plain-text summaries of the cell change (e.g. `Modified cell 2 (code): 42 chars of source.`) — this is what the engine and the approval card see.
- **Acceptance:** `npm run compile` passes. Smoke test: each of the 5 actions succeeds on a fixture doc (assert resulting `parseNotebook` cell count/types/source); error cases return `ok: false` with a message: bad JSON, out-of-range `cell_index`, missing `source` for `modify_cell`, unknown action.

### S4 — `ToolExecutor`: execute `notebook_edit`
- **File:** `src/tools/ToolExecutor.ts`
- **What:**
  - Import `applyNotebookEdit` from `../notebook`.
  - Add `case "notebook_edit":` in `execute()` → `this.notebookEdit(call, String(args.path ?? ""), String(args.action ?? ""), typeof args.cell_index === "number" ? args.cell_index : undefined, args.cell_type === "code" || args.cell_type === "markdown" ? args.cell_type : undefined, typeof args.source === "string" ? args.source : undefined)`.
  - New private `notebookEdit(...)`: `resolveSafe` (reject outside-workspace); read old content if the file exists (empty + `existed=false` otherwise); call `applyNotebookEdit`; on `ok: false` return the error as the `ToolResult` (no write, no snapshot); on success set `this.lastSnapshot` + `recordSnapshot(relPath, oldContent, existed)`, `mkdir` parent, write `newContent`, `recordChange`, and return `Wrote ${relPath} — ${message}` (plain-text summary; skip `unifiedDiff` on raw JSON — it's noisy, per design direction).
- **Acceptance:** `npm run compile` passes. Smoke test (new section, mirroring the `write_file`/`edit_file` executor tests): in a temp workspace, `notebook_edit` `create` writes a valid `.ipynb` (file exists, `parseNotebook` OK); `modify_cell` + `insert_cell` + `delete_cell` + `change_cell_type` mutate it correctly; out-of-range index leaves the file untouched; `revertLast()` restores pre-mutation content; `getChangeSummary()` includes the `.ipynb` path.

### S5 — Context: render tagged `.ipynb` files as cells
- **File:** `src/context.ts`
- **What:** Import `formatNotebookForContext` from `./notebook`. In `buildContextBlock`, in the `taggedFiles` loop: when `tf.path.toLowerCase().endsWith(".ipynb")`, emit the header + `formatNotebookForContext(tf.content)` instead of the raw-JSON fenced block. (The `ChatViewProvider` tagged-file reader already reads any file as utf8 — no host change needed.)
- **Acceptance:** `npm run compile` passes. Smoke test (extend section 3b): `buildContextBlock({ taggedFiles: [{ path: "nb.ipynb", content: <fixture json> }] })` contains `Tagged file: nb.ipynb`, `Cell 0 (code)`, and does **not** contain the raw `"cells":` JSON key; a non-`.ipynb` tagged file still renders the raw fenced block.

### S6 — package.json descriptions + final smoke assertions + PROGRESS.md
- **Files:** `package.json`, `scripts/smoke-test.js`, `.github/agents/planner/PROGRESS.md`
- **What:**
  - `package.json`: update `llm.tools.requireApproval` description to list `notebook_edit` alongside `write_file, edit_file, run_command`; optionally extend the top-level extension `description` with "edit Jupyter notebooks from chat".
  - `scripts/smoke-test.js`: add a final static section (mirroring the 1.98-1 section 9) asserting `package.json` contains `notebook_edit` in the `requireApproval` description, and that `ChatViewProvider.ts` still routes mutating tools through `approval_request` (i.e. `isMutatingTool` is the single gate — no notebook-specific host code was added).
  - `PROGRESS.md`: mark 1.98-2 Planned→(after slices land) Done; record decisions (single `notebook_edit` tool, plain-text summary instead of JSON diff, no host/webview changes).
- **Acceptance:** `npm run compile` passes; `node scripts/smoke-test.js` prints `ALL SMOKE TESTS PASSED` including all new notebook assertions.

## Overall acceptance criteria (Tester)

1. `npm run compile` clean; `node scripts/smoke-test.js` fully green.
2. In a live session with `llm.tools.requireApproval` on: asking the model to create/modify a notebook posts a generic `approval_request` card showing `notebook_edit` + args; Approve applies the change, Reject feeds the standard "user rejected" tool result.
3. `@notebook.ipynb` in a chat message injects a cell-by-cell text view (not raw JSON) into the system prompt.
4. Notebook mutations participate in the existing per-run snapshot system: revert-last, revert-all, and the change-summary footer all work on `.ipynb` files.

## Risks / open questions

- **`read_file` on `.ipynb`** still returns raw JSON. Acceptable for this item (the model is told to use `notebook_edit`); a follow-up could make `read_file` auto-format notebooks.
- **Multi-cell `create`/`insert`** uses a `<<<CELL>>>` text marker rather than a JSON array, to keep the schema simple for weaker local engines; if engines struggle, a follow-up could add an optional `cells` array param.
- **Diff preview:** the existing line diff on raw JSON is intentionally skipped in favor of a plain-text cell-change summary (permitted by the design direction). The webview's tool-result rendering is unchanged.
- **Cell metadata/metadata preservation:** `applyNotebookEdit` preserves all existing notebook fields (it only touches `cells`); new cells get minimal metadata. No nbformat validation beyond `cells` array shape — engines produce valid-enough output for VS Code's notebook renderer.

**Slice count:** 6 (S1–S6), each ≤1 source file + its smoke-test additions, independently compilable/committable. No host (`ChatViewProvider.ts`) or webview changes required — the approval gate is inherited via `isMutatingTool`.

# Plan: 1.98-8 — `#codebase` tag: advanced codebase search in chat (Planned 2026-10-22) — **Done** (2026-10-22, slices S1–S4 complete)

**Changelog:** VS Code 1.98 — "More advanced codebase search in Copilot Chat (`#codebase`)". Embeddings-based semantic search sub-item DROPPED (paid service).

## Decisions
1. Setting: `llm.chat.codebaseSearch.enabled` (boolean, default `true`); read as `codebaseSearchEnabled`. When false, `#codebase` is inert.
2. Sweep REUSES existing ToolExecutor logic via new public `codebaseSweep(query: string): Promise<string>`: project structure (SKIP_DIRS, depth ≤ 3, cap 100 entries), git status (reuse `gitStatusText()`, cap 50 lines, `git exited…` → ""), text search (shared private `searchMatches(pattern, rootAbs, cap)` extracted from `searchFiles`; sweep cap 20, tool keeps 50). Total block cap 12,000 chars with `… (truncated)` suffix.
3. Workspace symbol search DROPPED (no symbol provider; model has search tools in the loop).
4. `extractCodebaseQuery(text): string | null` — null = tag absent; "" = tag with no query; else trimmed same-line remainder. Case-insensitive, word-bounded (`#codebasefoo` no match).
5. Sweep runs regardless of `llm.tools.enabled` (context injection, not tool calling); only gate is the new setting.
6. Injection in `ChatViewProvider.runStream` after the `@file` block: append `Codebase sweep:` section after `buildContextBlock` output.
7. Pure formatting in `src/context.ts` (`formatCodebaseSweep`); ToolExecutor only gathers raw data.

## Slices
- **S1** `src/context.ts`: `extractCodebaseQuery` (string | null) + `CodebaseSweepData` interface + `formatCodebaseSweep(data, query?)` — stable block with `### Project structure` / `### Git status (modified files)` / `### Search: <query>` headers, placeholders for empty fields, 12,000-char truncation, `""` when all empty. Smoke section `// 12) codebase sweep (1.98-8)`. — Done (2026-10-22)
- **S2** `src/tools/ToolExecutor.ts`: public `codebaseSweep(query)` — structure walk (depth ≤ 3, cap 100), `gitStatusText()` (cap 50 lines, `git exited` → ""), search via new private `searchMatches` (cap 20; `searchFiles` refactored to use it, cap 50); composes `formatCodebaseSweep`. Static smoke: source contains `codebaseSweep(`, `formatCodebaseSweep`, `gitStatusText`; `searchMatches(` ≥ 2 occurrences. — Done (2026-10-22)
- **S3** `src/chat/ChatViewProvider.ts`: in `runStream` after `@file` block — if `settings.codebaseSearchEnabled` and tag present, `codebaseBlock = await this.toolExecutor.codebaseSweep(q)`; append to contextBlock. Import `extractCodebaseQuery`. Static smoke: source contains `extractCodebaseQuery` and `codebaseSweep(`. — Done (2026-10-22; `codebaseSearchEnabled` in `readSettings()`/`LlmSettings` pulled into S3 so the slice compiles standalone)
- **S4** `package.json` + `src/config.ts` + `src/presets.ts` + `scripts/smoke-test.js` + planner PROGRESS.md: add `llm.chat.codebaseSearch.enabled` (default true), `codebaseSearchEnabled` in `readSettings()` + `LlmSettings` (presets.ts), final static smoke assertions, mark 1.98-8 Done. — Done (2026-10-22; config/presets parts already landed in S3, so S4 = `package.json` schema entry + final smoke assertions + memory)

## Overall acceptance
1. compile clean + smoke fully green. 2. `#codebase <q>` → `Codebase sweep` section (structure, git status when dirty, search matches), ≤12,000 chars. 3. setting false → inert. 4. `#codebase` no query → structure + git status, search placeholder. 5. `@file` tagging, section order, 11 tools unaffected.

# Plan: 1.98-9 — Attach problems as chat context (`#problems`) (Planned 2026-10-22) — **Done** (2026-10-22, slices S1–S4 complete)

**Changelog:** VS Code 1.98 — "Attach problems from the Problems panel as chat context — type `#problems` (or paperclip / drag). Specific problems, all problems in a file, or all files in the codebase."

## Decisions
1. Tag-only scope — no paperclip/drag-and-drop (single webview, no attachment UI).
2. Follow the `#codebase` pattern exactly: pure extraction + formatting in `src/context.ts`, vscode collection in ToolExecutor, wiring in `runStream` appended after the codebase block.
3. Tag grammar: `extractProblemsTag(text): string | null` — `/#problems(?!\w)/i`, first match, trimmed same-line remainder as qualifier: `""` = bare tag = all workspace problems; non-empty = workspace-relative file path; `null` = absent.
4. REUSE diagnostics collection: extract `getDiagnostics` body into `public async collectDiagnostics(relPath?: string): Promise<string>` (same guards/formatting/empty strings); `getDiagnostics` becomes a thin wrapper. New cap: 50 problems + `… (showing first 50 of N)` note.
5. Bounded output: 50 problems (in collectDiagnostics) + 8,000 chars (in pure `formatProblemsBlock`, `… (truncated)` suffix).
6. New setting `llm.chat.problems.enabled` (default true) — mirrors `llm.chat.codebaseSearch.enabled`.
7. `formatProblemsBlock(data: { text: string }, scope?: string): string` — header `Problems (scope: workspace|<path>)`, body = text or `(no problems — clean)`, 8,000-char cap, `""` when text empty AND scope is workspace.
8. No webview changes.
9. Qualifier fallback (S3): if the qualifier is non-empty and path resolution rejects it, fall back to workspace scope (avoids rendering "Path not allowed" as body).

## Slices
- **S1** `src/context.ts` (+ smoke): `extractProblemsTag` + `ProblemsBlockData` + `PROBLEMS_BLOCK_MAX_CHARS = 8000` + `formatProblemsBlock`. Smoke section 13a (~10 assertions). — Done (2026-10-22)
- **S2** `src/tools/ToolExecutor.ts` (+ smoke): `public async collectDiagnostics(relPath?)` extracted from `getDiagnostics` (thin wrapper, tool behavior byte-identical); 50-problem cap. Smoke 13b static: `collectDiagnostics(` ≥ 2, `getDiagnostics` intact, `showing first 50`. — Done (2026-10-22)
- **S3** `src/chat/ChatViewProvider.ts` + `src/config.ts` + `src/presets.ts` (+ smoke): `problemsEnabled` field (presets + config, default true); in `runStream` after the `#codebase` block: if `settings.problemsEnabled` and tag present, `collectDiagnostics(p || undefined)` → `formatProblemsBlock` → append to `finalContextBlock`; qualifier path-rejection → workspace fallback. Smoke 13c static (5 checks). — Done (2026-10-22; `problemsEnabled` in `readSettings()`/`LlmSettings` landed in S3 so the slice compiles standalone)
- **S4** `package.json` + `scripts/smoke-test.js` + planner PROGRESS.md: `llm.chat.problems.enabled` (boolean, default true); smoke 13d; mark 1.98-9 Done. — Done (2026-10-22; config/presets parts already landed in S3, so S4 = `package.json` schema entry + final smoke assertions + memory)

## Overall acceptance
1. compile clean + smoke all green (270 prior + section 13). 2. `#problems` → `Problems (scope: workspace)` block (≤50 problems / ≤8,000 chars); bare tag + no diagnostics → no block. 3. `#problems src/foo.ts` → file scope; outside-workspace path → not injected (workspace fallback). 4. setting false → tag inert. 5. `get_diagnostics` tool output unchanged. 6. No webview changes, no new deps.

# Plan: 1.98-10 — Attach folders as context (`#folder:<name>`) — **Done** (2026-10-22, slices S1–S4)

**Changelog reference:** VS Code 1.98 — attach a folder as context via the paperclip or by
typing `#folder:` followed by the folder name (previously only drag-and-drop from Explorer).
Relevance: `keep (capability/context)` — context injection. Gap: no `#folder:` tag exists
(only `@filename` single-file tags).

**Key decisions (final):**
1. **Tag syntax:** `#folder:<name>` (colon) AND `#folder <name>` (space) are both accepted,
   mirroring `#problems <path>`. Regex: `/#folder(?::|(?=\s|$))(\S*)/i` — word-bounded
   (`#folderfoo` does NOT match), case-insensitive (`#Folder` DOES). Only the FIRST
   occurrence counts; only the same-line remainder is read. Bare `#folder` (no name) →
   **workspace root** (sweep the whole first workspace folder, like `#codebase`'s structure
   walk) — NOT ignored, so the tag is never a silent no-op.
2. **Resolution:** folder name is workspace-root-relative, resolved via the existing
   `ToolExecutor.resolveSafe()` (first workspace root; `..` escape → rejected). If the
   resolved path does not exist or is not a directory → the block renders
   `(folder not found: <name>)` so the model knows. No fallback to root (unlike `#problems`
   path fallback) — a wrong folder name is user error the model should see.
3. **Sweep content:** file tree ONLY (no file contents — that's what `read_file` is for).
   Mirrors `codebaseSweep`'s structure walk: depth ≤ 3, cap 100 entries, `SKIP_DIRS`
   skipped, `… (truncated at 100 entries)` suffix. No git status, no search.
4. **Char cap:** `FOLDER_BLOCK_MAX_CHARS = 8000` (exported, like `PROBLEMS_BLOCK_MAX_CHARS`),
   `… (truncated)` suffix. Smaller than the 12,000 codebase cap — a folder tree is smaller
   and the block is additive context.
5. **Setting:** `llm.chat.folderContext.enabled` (boolean, default `true`); config field
   `folderContextEnabled`. Gated ONLY on this setting; runs regardless of
   `llm.tools.enabled` (same as `#codebase`/`#problems`).
6. **Tag-only scope:** no paperclip/drag-and-drop UI (single webview, no attachment UI —
   same decision as 1.98-9).

**Block format (S1):**
```
Folder: <name or (workspace root)>
<tree lines, or "(empty folder)", or "(folder not found: <name>)">
```
Header uses the raw tag name; `(workspace root)` when the name is empty.

## Slices

### 1.98-10.S1 — Pure helpers in `src/context.ts` — Done (2026-10-22)
File: `src/context.ts` (append a `#folder` section after the `#problems` section, mirroring
its style).
- `export function extractFolderTag(text: string): string | null` — regex
  `/#folder(?::|(?=\s|$))(\S*)/i`; returns the trimmed folder-name remainder (group 1,
  `""` for bare tag), `null` if absent. Same-line semantics: the `(\S*)` capture naturally
  stops at whitespace/newline.
- `export interface FolderBlockData { tree: string; notFound?: boolean; }`
- `export const FOLDER_BLOCK_MAX_CHARS = 8000;` + `const FOLDER_BLOCK_TRUNCATED_SUFFIX =
  "… (truncated)";`
- `export function formatFolderBlock(data: FolderBlockData, folder?: string): string` —
  header `Folder: ${folder && folder.trim() !== "" ? folder : "(workspace root)"}`; body:
  `data.notFound` → `(folder not found: ${folder})`; else `data.tree || "(empty folder)"`.
  Truncate to `FOLDER_BLOCK_MAX_CHARS` + suffix. Never returns `""` (the tag was explicit —
  always show the header so the model knows the folder was requested).
Smoke (new section **14a**, labels `folder-s1:`):
- `extractFolderTag("#folder:src") === "src"`; `extractFolderTag("#folder src") === "src"`;
  `extractFolderTag("#folder") === ""`; `extractFolderTag("no tag") === null`;
  `extractFolderTag("#folderfoo") === null`; `extractFolderTag("#Folder:src") === "src"`;
  `extractFolderTag("#folder:src\nline2") === "src"`.
- `formatFolderBlock({ tree: "a/\nb.ts" }, "src")` includes `Folder: src` and the tree;
  `formatFolderBlock({ tree: "" }, "src")` includes `(empty folder)`;
  `formatFolderBlock({ tree: "", notFound: true }, "nope")` includes
  `(folder not found: nope)`; `formatFolderBlock({ tree: "x".repeat(9000) })` truncated to
  cap + suffix; bare (no folder) header shows `(workspace root)`.
Acceptance: `npm run compile` passes; smoke green (existing 294 + new).

### 1.98-10.S2 — `ToolExecutor.folderSweep` in `src/tools/ToolExecutor.ts` — Done (2026-10-22)
File: `src/tools/ToolExecutor.ts` (add a public method next to `codebaseSweep`, ~line 856).
- `public async folderSweep(folderName: string): Promise<string>` — returns the formatted
  block (mirrors `codebaseSweep` which returns the formatted string, keeping the provider
  wiring identical to `#codebase`/`#problems`).
- Body: `const rootAbs = await this.resolveSafe(".");` if null →
  `formatFolderBlock({ tree: "", notFound: true }, folderName || "(workspace root)")`
  (no workspace). Else `const target = folderName.trim() === "" ? rootAbs :
  await this.resolveSafe(folderName);` if null → notFound block. `fs.promises.stat(target)`
  → on error or `!isDirectory()` → notFound block. Walk: same structure as `codebaseSweep`'s
  inner `walk` (depth ≤ 3, cap 100, `SKIP_DIRS`, indent `"  ".repeat(depth - 1)`,
  `… (truncated at 100 entries)`), starting at `walk(target, 1)`. Return
  `formatFolderBlock({ tree: structure }, folderName)`.
Smoke (new section **14b**, labels `folder-s2:`): static checks on `ToolExecutor.ts` source —
`folderSweep(` present; `formatFolderBlock` imported/used; `resolveSafe` still present;
`codebaseSweep(` still present (untouched).
Acceptance: `npm run compile` passes; smoke green.

### 1.98-10.S3 — Wiring in `src/chat/ChatViewProvider.ts` + `src/config.ts` + `src/presets.ts` — Done (2026-10-22)
Files: `src/chat/ChatViewProvider.ts`, `src/config.ts`, `src/presets.ts` (three files, one
concern — the wiring; same shape as 1.98-9.S3 which pulled the config field in so the slice
compiles standalone).
- `presets.ts`: add to `LlmSettings` after `problemsEnabled` (~line 94):
  `/** Enable the \`#folder:\` chat tag (folder tree injected as context). */
  folderContextEnabled: boolean;`
- `config.ts`: add after line 72:
  `folderContextEnabled: c.get<boolean>("chat.folderContext.enabled", true),`
- `ChatViewProvider.ts`: import `extractFolderTag` (line ~27–29 import block). In
  `runStream`, immediately AFTER the `#problems` block (~line 973), add:
  ```ts
  // 1.98-10.S3: `#folder:` tag — sweep the named folder (tree only) and append
  // the result to the context block. Gated only on settings.folderContextEnabled
  // (runs regardless of llm.tools.enabled, same as `#codebase`/`#problems`).
  if (settings.folderContextEnabled && lastUser && this.toolExecutor) {
    const f = extractFolderTag(lastUser.content);
    if (f !== null) {
      const folderBlock = await this.toolExecutor.folderSweep(f);
      if (folderBlock) {
        finalContextBlock = finalContextBlock
          ? finalContextBlock + "\n\n" + folderBlock
          : folderBlock;
      }
    }
  }
  ```
Smoke (new section **14c**, labels `folder-s3:`): static checks — `ChatViewProvider.ts`
contains `extractFolderTag`, `folderSweep(`, `folderContextEnabled`; `config.ts` contains
`chat.folderContext.enabled`; `presets.ts` contains `folderContextEnabled`.
Acceptance: `npm run compile` passes; smoke green.

### 1.98-10.S4 — `package.json` + final smoke + mark done — Done (2026-10-22)
Files: `package.json`, `scripts/smoke-test.js`, `.github/agents/planner/PROGRESS.md`.
- `package.json`: after `llm.chat.problems.enabled` (~line 215) add:
  ```json
  "llm.chat.folderContext.enabled": {
    "type": "boolean",
    "default": true,
    "description": "When the user types #folder:<name> (or '#folder <name>') in a chat message, attach the folder's file tree as context. Bare #folder attaches the workspace root."
  }
  ```
- `smoke-test.js`: new section **14d** (labels `folder-s4:`) — parsed-JSON checks:
  `llm.chat.folderContext.enabled` exists, `type === "boolean"`, `default === true`,
  description is a non-empty string containing `#folder`.
- `PROGRESS.md`: move 1.98-10 to Done, update Status/Next step.
Acceptance: `npm run compile` + `node scripts/smoke-test.js` pass (all prior 294 + new
assertions green); PROGRESS.md in sync.

## Overall acceptance (Tester)
Typing `#folder:src` (or `#folder src`) in a chat message injects a `Folder: src` block with
the folder's file tree (depth ≤ 3, ≤ 100 entries, no file contents) into the system prompt;
bare `#folder` injects the workspace-root tree; a nonexistent folder injects
`(folder not found: <name>)`; `#folderfoo` does not trigger; the block is truncated at
8,000 chars; with `llm.chat.folderContext.enabled: false` the tag is ignored; the tag works
regardless of `llm.tools.enabled`; `npm run compile` clean; smoke test fully green.

## Risks / open questions
- **Multi-root workspaces:** `resolveSafe` resolves against the FIRST workspace root only
  (existing behavior, shared with `@file` tags and `#codebase`). A folder name that exists
  only in another root → `(folder not found: <name>)`. Acceptable; consistent with the rest
  of the extension.
- **Folder names with spaces:** `(\S*)` captures only the first token, so `#folder:my
  folder` attaches `my`. Documented limitation (same as `#problems <path>`); acceptable.
- **Bare `#folder` = workspace root** overlaps with `#codebase`'s structure walk —
  intentional (root tree without git status/search); no conflict.

# Plan: 1.98-12 — Change completions model (Planned 2026-10-22) — **Done** (2026-10-22, slices S1–S4 complete)

**Changelog reference:** VS Code 1.98 — "Change the model used for inline code completions via the **Change Completions Model** command in the Command Palette (or 'Configure Code Completions' in the Copilot title-bar menu)." Relevance: `keep (capability/context)` — selecting which local engine/model serves completions is a capability control. Gap: no such command exists yet.

## Decisions
1. **Setting:** `llm.completions.model` (string, default `""`). Empty = "use the main chat model" (`llm.model`), which itself falls back to the engine default. Fallback chain: `llm.completions.model` → `llm.model` → engine default. Mirrors existing `llm.model` semantics.
2. **Config field:** `completionsModel: string` in `LlmSettings` (presets.ts) + `readSettings()` (config.ts). Pulled into **S2** (first slice that needs it to compile) — same pattern as 1.98-10.S3.
3. **Provider wiring (S2):** `InlineCompletionProvider` builds `settings = { ...readSettings(), model: readSettings().completionsModel }` before `buildRequestBody` — the completions model replaces the chat model for the request body; `buildRequestBody`'s existing `toolbar.model ?? settings.model` (request.ts ~line 180) does the rest with **zero changes to request.ts**. Toolbar override still wins (consistent with chat).
4. **Command:** `llm.changeCompletionsModel` ("LLM: Change Completions Model") in `extension.ts`. `vscode.window.showQuickPick` list built by pure `buildCompletionsModelList(current, chatModel, engineModels)` in `presets.ts`: first entry always "Use chat model (default)" (value `""`), then current completions model (if non-empty and ≠ chat model), then chat model (if non-empty), then engine models — deduped by value, `picked: true` on the active value. Engine models via `client.listModels()`; on failure a warning is shown and the list falls back to current + chat model only (command never hard-fails).
5. **Write target:** `ConfigurationTarget.Workspace` (or `Global` when no workspace folder). Justification: per-project capability choice (different projects may want a smaller/faster local model for ghost text); visible in `.vscode/settings.json`.
6. **No webview changes, no new dependencies.** The chat toolbar Model dropdown is NOT touched (it controls the chat model).

## Slices
- **S1** `src/presets.ts` (+ smoke): `CompletionsModelOption` interface + pure `buildCompletionsModelList(current, chatModel, engineModels)` (default entry first, dedup, `picked` on active). Smoke section **15a** (labels `compm-s1:`, ~8 assertions). — Done (2026-10-22)
- **S2** `src/presets.ts` + `src/config.ts` + `src/inline/InlineCompletionProvider.ts` (+ smoke): `completionsModel` field in `LlmSettings` + `readSettings()` (`c.get<string>("completions.model", "")`); provider swaps `settings.model` for `completionsModel` before `buildRequestBody` (toolbar override still wins). Smoke **15b** (labels `compm-s2:`): static checks — `presets.ts` has `completionsModel`, `config.ts` has `completions.model`, `InlineCompletionProvider.ts` has `completionsModel` + `buildRequestBody(`. — Done (2026-10-22)
- **S3** `src/extension.ts` (+ smoke): register `llm.changeCompletionsModel` — read `completions.model` + `model`, `client.listModels()` (failure → warning + configured-only list), `buildCompletionsModelList` → QuickPick (default entry `$(symbol-inherit) Use chat model (default)`, `description: "active"` on picked), write to `ConfigurationTarget.Workspace` (or `Global`), info message; cancel = no-op. Smoke **15c** (labels `compm-s3:`): static checks — `llm.changeCompletionsModel`, `buildCompletionsModelList`, `showQuickPick`, `completions.model`, `ConfigurationTarget.Workspace`. — Done (2026-10-22)
- **S4** `package.json` + `scripts/smoke-test.js` + planner PROGRESS.md: `contributes.commands` entry `{ "command": "llm.changeCompletionsModel", "title": "LLM: Change Completions Model" }`; `contributes.configuration.properties["llm.completions.model"]` (string, default `""`, description mentions completions + the command). Smoke **15d** (labels `compm-s4:`): parsed-JSON checks (setting exists/type/default/description; command entry exists with title). Mark 1.98-12 Done. — Done (2026-10-22)

## Overall acceptance (Tester)
1. `npm run compile` clean; `node scripts/smoke-test.js` fully green.
2. Command Palette → "LLM: Change Completions Model" shows a QuickPick: "Use chat model (default)" first, active model badged `active`, engine models listed; picking writes `llm.completions.model` (workspace scope in a workspace, global otherwise) + confirmation; cancel is a no-op.
3. With `llm.completions.model` set, inline completions send that model in the request body; with it empty, completions use `llm.model` / engine default (no behavior change).
4. Chat model selection (toolbar dropdown, `llm.model`) unaffected.

## Risks / open questions
- **Engine unreachable when the command runs:** QuickPick still works with configured models only (warning shown); the command never hard-fails.
- **Toolbar model override still wins over `llm.completions.model`** in the inline provider (reuses chat toolbar state) — consistent with chat; a per-feature toolbar override is out of scope.
- **Multi-root workspaces:** `ConfigurationTarget.Workspace` writes to the first workspace folder's settings (VS Code default); acceptable, consistent with the rest of the extension.
