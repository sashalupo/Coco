# Planner — Progress Memory

> **This file is the agent's persistent memory.** The `Planner` agent
> (`.github/agents/planner.agent.md`) MUST read this at session start and update it at session
> end. Keep it accurate and current. Commit it together with the work it describes.

## Mission

Turn each changelog feature (from the Changelog Researcher's backlog) into a concrete,
step-by-step implementation plan for the `llm` VS Code extension. The planner does NOT write
code — only the Coder writes code.

## Active plan — 1.100-14 · MCP support for image output

- **Status:** Planned (2026-10-23)
- **Changelog:** VS Code 1.100 (Apr 2025) — MCP servers can return **images** as part of
  tool output, rendered in chat (with a note that not all models can read images from
  tool output). No screenshots — no UI-fidelity requirement beyond the existing
  tool-result card.
- **Grounding notes:** `src/mcp.ts` (pure) holds `McpToolResult` whose `content` is typed
  `{ type: string; text?: string }[]`; both transports (`McpClient.callTool` stdio and
  `McpHttpClient.callTool` HTTP) already pass the raw JSON-RPC `result` through as
  `r as McpToolResult`, so image blocks (`{ type: "image", data, mimeType }`) already
  arrive intact — only the type + a pure extractor are missing. `mcpResultToText`
  filters `type === "text"`, so it already ignores image blocks (no change needed).
  `src/mcpManager.ts` `execute` returns `{ content: string }` via `mcpResultToText`.
  `src/chat/ChatViewProvider.ts` MCP branch (~line 1787) does
  `result = { tool_call_id, content: mcpRes.content }` and posts `tool_result` with
  `output`. `src/chat/webview.ts` `tool_result` case (~line 2504) renders a
  `pre.tool-output` in both the found-card and fallback branches; existing image
  rendering (`msg-images`/`msg-img`, `data:` URIs, and the cell-output
  `/^data:image\/(jpeg|png|gif|webp|bmp);base64,/` guard) is reusable. Smoke test MCP
  section ~line 2760; hard gate is 750 (line 6072).
- **Spec (minimal, engine-agnostic):** MCP tool results may contain content blocks of
  type `image` with `data` (base64) and `mimeType` alongside `text` blocks. Parse image
  blocks (both transports — already pass-through), surface them as `data:` URIs through
  the manager to the chat layer, and render them as `<img>` thumbnails in the tool-result
  card. Text-only results behave exactly as before.
- **Files to touch:** `src/mcp.ts`, `src/mcpManager.ts`, `src/chat/ChatViewProvider.ts`,
  `src/chat/webview.ts`, `scripts/smoke-test.js`.
- **Slices (in order):**
  - `1.100-14.S1` — image content-block type + pure extractor in `src/mcp.ts`:
    (a) widen `McpToolResult.content` to
    `{ type: string; text?: string; data?: string; mimeType?: string }[]`;
    (b) `export function mcpResultToImages(result: McpToolResult): string[]` — pure:
    for each part with `type === "image"`, a non-empty string `data`, and a non-empty
    string `mimeType`, emit `` `data:${mimeType};base64,${data}` ``; skip malformed
    parts; return `[]` when none. No transport change.
  - `1.100-14.S2` — `src/mcpManager.ts`: import `mcpResultToImages` from `./mcp`; change
    `execute`'s return type to `{ content: string; images?: string[] }`; on the success
    path compute `const images = mcpResultToImages(result)` and return
    `{ content: mcpResultToText(result), ...(images.length ? { images } : {}) }`; error
    paths unchanged (no images).
  - `1.100-14.S3` — `src/chat/ChatViewProvider.ts`: in the MCP branch capture
    `mcpRes.images` (e.g. `const mcpImages = mcpRes.images`); when posting the
    `tool_result` message add
    `...(mcpImages && mcpImages.length ? { images: mcpImages } : {})`; non-MCP tools
    unchanged.
  - `1.100-14.S4` — `src/chat/webview.ts`: in the `tool_result` case, after appending the
    `pre.tool-output` in **both** the found-card and fallback branches, if `msg.images`
    is a non-empty array append a `div.tool-images` with one `<img class="tool-img">` per
    `data:` URI (guard with the same
    `/^data:image\/(jpeg|png|gif|webp|bmp);base64,/` regex used for cell outputs); add
    CSS `.tool-images` (flex, gap, wrap, margin-top) and `.tool-img` (max-width ~240px,
    border-radius, `cursor: zoom-in`) near the existing `.tool-output`/`.msg-img` rules.
  - `1.100-14.S5` — smoke-test guards in `scripts/smoke-test.js`:
    (a) `mcpResultToImages` pure tests: text-only → `[]`; single image block → one
    `data:<mime>;base64,<data>` URI; mixed text+image → 1 image (text ignored); image
    block missing `data` → skipped → `[]`;
    (b) `mcpResultToText` regression: a result with only image blocks → `""` (images not
    leaked into text);
    (c) static: `src/mcpManager.ts` references `mcpResultToImages` and returns `images`;
    `out/chat/ChatViewProvider.js` posts `images` in the `tool_result` message;
    `src/chat/webview.ts` references the `tool-img` class;
    (d) raise the hard total-count gate (750 → 758, 8 new assertions).
- **First slice:** `1.100-14.S1`.
- **Acceptance:** compile + smoke pass; an MCP tool result containing `image` content
  blocks (base64 `data` + `mimeType`) is parsed on both stdio and HTTP transports,
  surfaced through `McpManager.execute` → the chat `tool_result` message, and rendered
  as `data:`-URI thumbnails in the tool-result card; text-only results behave exactly as
  before.
- **Open questions:** (1) images are rendered in the card but are NOT re-injected into
  the model context as attachments (the backlog's "vision-capable models can consume
  them" is a note, not a requirement) — out of scope here; (2) `mimeType` is trusted
  from the server and only rendered when it matches a known image type —
  malformed/unknown types are skipped.


## Status

- **Current item:** 1.100-14 (planned) — 1.100-13 planned
- **Next step:** dispatch `1.100-14.S1` (image content blocks + `mcpResultToImages` in `src/mcp.ts`) to the Coder
- **Last updated:** 2026-10-23
- **Last commit:** (planner commit for the 1.100-14 plan)
- **Build state:** n/a (planner does not build)

## Plans delivered (recap)

Each item was split into slices of ≤3 files; plans themselves are pruned (see git history).

**1.98 (complete, tag `changelog-1.98`):** editable `run_command` approval card + "modified by user" badge (1); `notebook_edit` tool, 5 actions, `src/notebook.ts`, `.ipynb` rendered as cells (2); `#codebase` sweep (8); `#problems` (9); `#folder:<name>` (10); `llm.changeCompletionsModel` + `llm.completions.model` (12); image attachments + `llm.chat.vision.enabled` (14); status-bar overview `llm.showStatusOverview` + `llm.statusBar.enabled` (15). Already built: 3, 4, 6. Smoke ends ~371.

**1.99 (complete, tag `changelog-1.99`):** MCP client over stdio `src/mcp.ts` + `src/mcpManager.ts` (2); `think` tool (3); `fetch_url` + `#fetch` `src/fetchTool.ts` (4); `find_usages` + `#usages` `src/usages.ts` (5); `#newWorkspace` scaffolds `src/workspaceScaffold.ts` (6); tool approvals with session/workspace/global scope `ApprovalStore` (8); Ask/Agent/Edit mode picker (10); reusable prompt files `llm.usePrompt` `src/prompts.ts` (12); URL/bmp images (13); completions status + `llm.toggleCompletions` (16); `#searchResults` (19); explicit save on keep (23); nbformat 4.5 cell ids (27); `new_notebook` tool + `/newNotebook` (28); cell outputs to chat `llm.addCellOutput` (29). Already built: 1, 24. Smoke ends ~584.

**1.100 (in progress, tag `changelog-1.100`):** done so far: instructions files `.instructions.md` with `applyTo` auto-attach, `src/instructions.ts` (1); prompt-file front matter `mode`/`tools`, `llm.runPrompt` + Play button, languages `llm.prompt`/`llm.instructions` (2); `apply_patch` tool `src/patch.ts` (3); `#fetch` as Markdown with `llm.chat.fetch.maxTokens` token trim (7). Chat input pills: `ContextPill` + `parsePillRefs`/`dedupePills` in `src/context.ts`, pill strip UI in `src/chat/webview.ts`, `postContextPills()`/`remove_pill` in `src/chat/ChatViewProvider.ts`, grouped `llm.addContext` quick-pick in `src/extension.ts` (8). Smoke 690.
