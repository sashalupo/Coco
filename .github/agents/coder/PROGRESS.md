# Coder — Progress Memory

> **This file is the agent's persistent memory.** The `Coder` agent
> (`.github/agents/coder.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Implement the plans produced by the Planner agent for the `llm` VS Code extension. The Coder
is the **ONLY agent that writes code**. It keeps the build green at every step and commits
after each compiling step.

## Status

- **Current step:** 1.98-1.S2 done (host `commandApproval` handler + `waitForCommandApproval`)
- **Next step:** 1.98-1.S3 — Host: route `run_command` through the editable approval gate (src/chat/ChatViewProvider.ts)
- **Last updated:** 2026-10-22
- **Last commit:** — (orchestrator commits; no coder commits yet)
- **Build state:** `npm run compile` passes after 1.98-1.S2

## Plan pointer

The current plan lives in `.github/agents/planner/PROGRESS.md`. The Coder implements it step
by step, one step per session.

## Done

- **1.98-1.S1** (2026-10-22) — Webview `command_approval` card. File: `src/chat/webview.ts` only.
  - Added `case 'command_approval':` in the host-message handler, sibling to `approval_request`.
    Builds a `.message.command-approval` card: role line "Run command?", a
    `<textarea class="cmd-input" rows="2">` pre-filled via `.value = msg.command` (never
    innerHTML), actions row with `Run` (`.cmd-run`) / `Cancel` (`.cmd-cancel`) buttons and a
    hidden `.status` div. `decideCmd(approved)` guards double-decide (`decided` flag),
    disables both buttons + the textarea, sets status ("Ran" / "Cancelled"), then
    `vscode.postMessage({ type: 'commandApproval', id: msg.id, approved, command: cmdInput.value })`.
    Wired `click` on both buttons and `keydown` on the textarea (`Enter` + `Ctrl` →
    `preventDefault(); decideCmd(true)`). Focuses and selects the textarea on render.
  - Added CSS in the existing style block: `.message.command-approval` (bordered card mirroring
    `.message.approval`), `.command-approval .cmd-input` (monospace, full width, VS Code input
    CSS variables), `.cmd-run`/`.cmd-cancel` mirroring `.approve`/`.reject`, `.status`.
  - Verified: `npm run compile` passes. Host-side handling is slice S2 (not yet implemented).
- **1.98-1.S2** (2026-10-22) — Host `commandApproval` handler + `waitForCommandApproval`. File: `src/chat/ChatViewProvider.ts` only.
  - Added field `private pendingCommandApproval: ((approved: boolean, command: string) => void) | null = null;` next to `pendingApproval`.
  - Added `case "commandApproval":` in the `onMessage` switch (sibling to `toolApproval`): calls
    `this.pendingCommandApproval?.(msg.approved === true, String(msg.command ?? ""))`.
  - Added `private waitForCommandApproval(signal: AbortSignal): Promise<{ approved: boolean; command: string }>`
    mirroring `waitForApproval`: resolves `{ approved: false, command: "" }` if the signal is already
    aborted or aborts while waiting (abort listener wired with `{ once: true }`, removed on resolve,
    `pendingCommandApproval` cleared on both paths); otherwise stores the resolver in
    `pendingCommandApproval` and resolves with the webview's decision + (possibly edited) command.
  - Verified: `npm run compile` passes. No behavior change yet — nothing posts `command_approval`
    (that is slice S3); this slice is plumbing only.

## Todo

- [ ] 1.98-1.S3 — Host: route `run_command` through the editable approval gate (src/chat/ChatViewProvider.ts).
- [ ] 1.98-1.S3 — Host: route `run_command` through the editable approval gate.
- [ ] 1.98-1.S4 — Webview: "modified by user" badge on the tool card.
- [ ] 1.98-1.S5 — Settings description + smoke test + PROGRESS.md.

## Notes / decisions

- The Coder is the ONLY agent that writes code.
- One step per session. Each step independently compiles and commits.
- No runtime npm dependencies. No bundler. Stay minimal.
- Always update this file in the same commit as the code it describes.
