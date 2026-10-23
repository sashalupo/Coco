# Planner — Progress Memory

> **This file is the agent's persistent memory.** The `Planner` agent
> (`.github/agents/planner.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Turn each changelog feature (from the Changelog Researcher's backlog) into a concrete,
step-by-step implementation plan for the `llm` VS Code extension. The planner does NOT write
code — only the Coder writes code.

## Active plan — 1.100-18 · Select and attach UI elements to chat (Experimental) — SKIPPED

- **Status:** Skipped (not applicable: no preview webview) — decided 2026-10-23
- **Changelog:** VS Code 1.100 (Apr 2025) — in the built-in Simple Browser, a toolbar "Start" button lets you select any element of a locally-hosted page; attaches a **screenshot of the element + its HTML and CSS** to chat. Config: `chat.sendElementsToChat.enabled` / `.attachCSS` / `.attachImages`. No screenshots (release notes reference a video).
- **Decision: SKIP.** The feature's core precondition — a **hosted preview webview** that renders a local page — does not exist in this extension. Grounding:
  - `src/chat/webview.ts` + `src/chat/ChatViewProvider.ts` are the **only** webview (the chat panel). Grep across `src/**` finds **no** `createWebviewPanel`, **no** `iframe`, **no** preview panel, and **no** element-picker (`outerHTML` / `getComputedStyle` / `html2canvas` / `screenshot` / `sendElementsToChat` / `attachCSS` all absent).
  - The Simple-Browser host part is **VS Code core**; the extension cannot contribute a toolbar button to it.
  - The reframe note itself flags this as **low priority** and **"depends on whether the extension ever hosts a preview."**
- **Why not a minimal implementation:** the only way to make "pick element" useful is to host a preview webview that iframes a local dev-server URL. That is a **new, large feature** (preview panel + URL input + iframe + injected selection script + hand-rolled screenshot/CSS capture, since no runtime deps are allowed) — far beyond the scope of this experimental toolbar-button item and outside the extension's identity as a generic OpenAI Chat Completions client. The "attach to chat" half (image attachment + context pills) already exists, but there is no page to pick from.
- **Revisit trigger:** if the extension ever adds a preview webview (e.g. a `llm.preview` panel that iframes a local dev server), re-plan this as: inject a selection script → capture element `outerHTML` + computed CSS + a canvas screenshot → attach via the existing image-attachment + context-pill path, gated by `llm.chat.sendElements.enabled` / `.attachCSS` / `.attachImages`.
- **Next item:** 1.100-19 · Create and launch tasks in agent mode (workspace creation follow-up).


## Status

- **Current item:** 1.100-18 (skipped: no preview webview) — 1.100-16 planned
- **Next step:** dispatch the Planner for 1.100-19 (Create and launch tasks in agent mode)
- **Last updated:** 2026-10-23
- **Last commit:** (planner commit for the 1.100-18 skip decision)
- **Build state:** n/a (planner does not build)

## Plans delivered (recap)

Each item was split into slices of ≤3 files; plans themselves are pruned (see git history).

**1.98 (complete, tag `changelog-1.98`):** editable `run_command` approval card + "modified by user" badge (1); `notebook_edit` tool, 5 actions, `src/notebook.ts`, `.ipynb` rendered as cells (2); `#codebase` sweep (8); `#problems` (9); `#folder:<name>` (10); `llm.changeCompletionsModel` + `llm.completions.model` (12); image attachments + `llm.chat.vision.enabled` (14); status-bar overview `llm.showStatusOverview` + `llm.statusBar.enabled` (15). Already built: 3, 4, 6. Smoke ends ~371.

**1.99 (complete, tag `changelog-1.99`):** MCP client over stdio `src/mcp.ts` + `src/mcpManager.ts` (2); `think` tool (3); `fetch_url` + `#fetch` `src/fetchTool.ts` (4); `find_usages` + `#usages` `src/usages.ts` (5); `#newWorkspace` scaffolds `src/workspaceScaffold.ts` (6); tool approvals with session/workspace/global scope `ApprovalStore` (8); Ask/Agent/Edit mode picker (10); reusable prompt files `llm.usePrompt` `src/prompts.ts` (12); URL/bmp images (13); completions status + `llm.toggleCompletions` (16); `#searchResults` (19); explicit save on keep (23); nbformat 4.5 cell ids (27); `new_notebook` tool + `/newNotebook` (28); cell outputs to chat `llm.addCellOutput` (29). Already built: 1, 24. Smoke ends ~584.

**1.100 (in progress, tag `changelog-1.100`):** done so far: instructions files `.instructions.md` with `applyTo` auto-attach, `src/instructions.ts` (1); prompt-file front matter `mode`/`tools`, `llm.runPrompt` + Play button, languages `llm.prompt`/`llm.instructions` (2); `apply_patch` tool `src/patch.ts` (3); `#fetch` as Markdown with `llm.chat.fetch.maxTokens` token trim (7). Chat input pills: `ContextPill` + `parsePillRefs`/`dedupePills` in `src/context.ts`, pill strip UI in `src/chat/webview.ts`, `postContextPills()`/`remove_pill` in `src/chat/ChatViewProvider.ts`, grouped `llm.addContext` quick-pick in `src/extension.ts` (8). Smoke 690.
