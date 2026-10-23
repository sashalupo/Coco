# Planner — Progress Memory

> **This file is the agent's persistent memory.** The `Planner` agent
> (`.github/agents/planner.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Turn each changelog feature (from the Changelog Researcher's backlog) into a concrete,
step-by-step implementation plan for the `llm` VS Code extension. The planner does NOT write
code — only the Coder writes code.

## Active plan — 1.100-29 · Generate alt text in HTML or Markdown (AI code action)

- **Status:** Planned — 2026-10-23
- **Changelog:** VS Code 1.100 — lightbulb quick fix "Generate alt text" on a line containing an HTML `<img>` element (`generate-alt-text.png`). Reframed as a local-LLM code action: detect the image reference, send the image (vision) + surrounding context to the model, offer the generated alt text as a quick fix.
- **Approach:** Extend the existing code-action pair: pure helpers in `src/codeaction.ts` (image-ref detection, prompt, parse), provider branch in `src/codeaction/CodeActionProvider.ts` (new "Generate alt text" QuickFix on HTML/Markdown image lines with empty/placeholder alt; one-shot `chatStream` with the image as a base64 `image_url` part, reusing the existing vision gate `llm.chat.vision.enabled` and the `thinking: "off"` toolbar pattern). New setting `llm.codeAction.altText.enabled` (default `true`).
- **Files to touch:** `src/codeaction.ts`, `src/codeaction/CodeActionProvider.ts`, `package.json`, `scripts/smoke-test.js`.
- **Slices:**
  - **S-001** — `src/codeaction.ts`: add pure helpers — `ImageRef { src, alt, altStart, altEnd }` (alt offsets within the line); `findImageRef(line)` for HTML `<img ... src=...>` (alt before/after src, single/double quotes) and Markdown `![alt](src)`; `isPlaceholderAlt(alt)` (empty or tbd/todo/fixme/image/img/placeholder/description here, case-insensitive); `buildAltTextPrompt(src, context, imageIncluded)` (concise ≤100-char accessibility alt, no quotes/fences/explanation; notes when image not attached); `parseAltText(text)` (trim, strip fences/quotes, collapse whitespace, cap 200 chars).
    - *Acceptance:* `npm run compile` passes; `findImageRef('<img src="a.png" alt="">')` → src `a.png`, alt `""`, slot offsets correct; `findImageRef('![x](img/pic.jpg)')` → src `img/pic.jpg`, alt `x`; `findImageRef('no image here')` → `null`; `isPlaceholderAlt("")`/`("TODO")` true, `("a cat")` false; `parseAltText('```A cat```')` → `A cat`.
  - **S-002** — `src/codeaction/CodeActionProvider.ts` + `package.json`: in `provideCodeActions`, for `html`/`markdown` docs where the line at `range.start.line` has a `findImageRef` hit with `isPlaceholderAlt` and `llm.codeAction.altText.enabled` (default `true`) — push a QuickFix **"Generate alt text"** carrying the alt-slot `actionRange` + `isAltText` marker. In `resolveCodeAction`, branch on the marker: resolve image path relative to the doc, read + base64-encode to `data:image/<mime>;base64,...` (mime from extension; skip attachment on any error), gate attachment on `llm.chat.vision.enabled` (default `true`; off → text-only, `imageIncluded: false`), prompt via `buildAltTextPrompt` with ±5 lines of context, one-shot `chatStream` (existing pattern: `thinking: "off"`, abort bridge, ~200-char cap), `parseAltText`, `edit.replace(doc.uri, altSlotRange, altText)`; failed/empty → action without edit. `package.json`: add `llm.codeAction.altText.enabled` (boolean, default `true`).
    - *Acceptance:* `npm run compile` passes; lightbulb on `<img src="x.png" alt="">` (HTML) offers "Generate alt text"; resolving replaces the empty alt with the model's text; no action on non-image lines or lines with descriptive alt; missing image file degrades to text-only without crashing.
  - **S-003** — `scripts/smoke-test.js`: add an `alt-s1` block before the final count check — require `out/codeaction.js`, assert S-001 acceptance (findImageRef HTML/Markdown/null, isPlaceholderAlt, buildAltTextPrompt contains src + context, parseAltText fence-strip); assert `src/codeaction/CodeActionProvider.ts` source contains `"Generate alt text"` and `altText.enabled`; assert `package.json` contains `llm.codeAction.altText.enabled`; **bump hard gate `780` → `787`** (count check + PASS message).
    - *Acceptance:* `node scripts/smoke-test.js` passes with total assertion count 787.
- **Acceptance criteria (whole item):** `npm run compile` passes; smoke test passes at 787; lightbulb on an HTML `<img>` / Markdown `![...](...)` line with empty/placeholder alt offers "Generate alt text"; resolving sends the image (base64 `image_url` part) + surrounding context to the local model and replaces the alt slot with the generated text; vision gate and missing-file cases degrade gracefully.
- **Risks / open questions:**
  - Reuses `llm.chat.vision.enabled` as the image-attachment gate; the action itself is gated by the new `llm.codeAction.altText.enabled`.
  - Action offered only when alt is empty/placeholder (changelog's "generate or update" for missing alt); updating a descriptive existing alt is out of scope.
  - `resolveCodeAction` uses the active editor's document (existing provider limitation, unchanged).
- **Next item:** 1.100-30 · Drag and drop cell outputs to chat (per researcher backlog; 1.100-31 and 1.100-38 also remain).


## Status

- **Current item:** 1.100-29 (planned: 3 slices — S-001 in `src/codeaction.ts`, S-002 in `src/codeaction/CodeActionProvider.ts` + `package.json`, S-003 smoke)
- **Next step:** dispatch the Coder for 1.100-29 S-001
- **Last updated:** 2026-10-23
- **Last commit:** (planner commit for the 1.100-29 plan)
- **Build state:** n/a (planner does not build)

## Plans delivered (recap)

Each item was split into slices of ≤3 files; plans themselves are pruned (see git history).

**1.98 (complete, tag `changelog-1.98`):** editable `run_command` approval card + "modified by user" badge (1); `notebook_edit` tool, 5 actions, `src/notebook.ts`, `.ipynb` rendered as cells (2); `#codebase` sweep (8); `#problems` (9); `#folder:<name>` (10); `llm.changeCompletionsModel` + `llm.completions.model` (12); image attachments + `llm.chat.vision.enabled` (14); status-bar overview `llm.showStatusOverview` + `llm.statusBar.enabled` (15). Already built: 3, 4, 6. Smoke ends ~371.

**1.99 (complete, tag `changelog-1.99`):** MCP client over stdio `src/mcp.ts` + `src/mcpManager.ts` (2); `think` tool (3); `fetch_url` + `#fetch` `src/fetchTool.ts` (4); `find_usages` + `#usages` `src/usages.ts` (5); `#newWorkspace` scaffolds `src/workspaceScaffold.ts` (6); tool approvals with session/workspace/global scope `ApprovalStore` (8); Ask/Agent/Edit mode picker (10); reusable prompt files `llm.usePrompt` `src/prompts.ts` (12); URL/bmp images (13); completions status + `llm.toggleCompletions` (16); `#searchResults` (19); explicit save on keep (23); nbformat 4.5 cell ids (27); `new_notebook` tool + `/newNotebook` (28); cell outputs to chat `llm.addCellOutput` (29). Already built: 1, 24. Smoke ends ~584.

**1.100-19 (planned, built):** create/launch tasks after `#newWorkspace` — `launchTask` per template + `buildTasksJson` + scaffold-prompt steps (3 slices: S-001/S-002 in `src/workspaceScaffold.ts`, S-003 smoke).

**1.100 (in progress, tag `changelog-1.100`):** done so far: instructions files `.instructions.md` with `applyTo` auto-attach, `src/instructions.ts` (1); prompt-file front matter `mode`/`tools`, `llm.runPrompt` + Play button, languages `llm.prompt`/`llm.instructions` (2); `apply_patch` tool `src/patch.ts` (3); `#fetch` as Markdown with `llm.chat.fetch.maxTokens` token trim (7). Chat input pills: `ContextPill` + `parsePillRefs`/`dedupePills` in `src/context.ts`, pill strip UI in `src/chat/webview.ts`, `postContextPills()`/`remove_pill` in `src/chat/ChatViewProvider.ts`, grouped `llm.addContext` quick-pick in `src/extension.ts` (8). Smoke 690.
