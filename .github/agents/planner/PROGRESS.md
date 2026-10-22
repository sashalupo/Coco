# Planner — Progress Memory

> **This file is the agent's persistent memory.** The `Planner` agent
> (`.github/agents/planner.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Turn each changelog feature (from the Changelog Researcher's backlog) into a concrete,
step-by-step implementation plan for the `llm` VS Code extension. The planner does NOT write
code — only the Coder writes code.

## Status

- **Current item:** 1.98-1 (VS Code 1.98 — Agent mode improvements: editable terminal command approval)
- **Next step:** dispatch slice 1.98-1.S1 (webview `command_approval` card)
- **Last updated:** 2026-10-22
- **Last commit:** — (no planner commits yet)
- **Build state:** n/a (planner does not build)

## Backlog pointer

The ordered backlog (oldest → newest) lives in
`.github/agents/changelog-researcher/PROGRESS.md`. The planner plans the **first pending
item** (the oldest) that the orchestrator dispatches.

## Plans

### Item 1.98-1 — Editable terminal command approval in chat (planned 2026-10-22)

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


## Done

_(none yet)_

## Todo

- [x] Wait for the Changelog Researcher to populate the backlog.
- [x] Plan backlog item 1.98-1 (editable terminal command approval) — planned 2026-10-22.
- [ ] Dispatch slices 1.98-1.S1 → S5 (one per session).
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
