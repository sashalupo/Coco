# Changelog Researcher — Progress Memory

> **This file is the agent's persistent memory.** The `Changelog Researcher` agent
> (`.github/agents/changelog-researcher.agent.md`) MUST read this at session start and update
> it at session end. Keep it accurate and current. Commit it together with the work it
> describes.

## Mission

Study the VS Code Copilot changelog (text **and images**) and maintain the **ordered backlog**
(oldest → newest) of features the team will implement for the `llm` VS Code extension. The
researcher does NOT write code — it builds and maintains the backlog.

## Source

- **Changelog:** `https://github.com/microsoft/vscode/blob/main/extensions/copilot/CHANGELOG.md`
- **Raw (for fetching):** `https://raw.githubusercontent.com/microsoft/vscode/main/extensions/copilot/CHANGELOG.md`
- The changelog is ordered **newest first**. The backlog below is **oldest first** (reversed).

## Status

- **Last processed version:** **none** — the changelog has not been studied yet
- **Next step:** fetch the raw changelog, study the oldest entries first (reverse the
  newest-first order), extract their images, and append them to the backlog below
- **Last updated:** 2026-10-22
- **Last commit:** — (no researcher commits yet)

## Backlog (oldest → newest)

> Each entry: **ID** · **version/date** · **title** · **description** · **image notes** ·
> **status** (`pending` | `in-progress` | `done` | `done (already built)`) · **implemented in**.
>
> The orchestrator always picks the **first `pending` item** (the oldest).

_(none yet — the changelog has not been studied)_

## Done

_(none yet)_

## Todo

- [ ] Fetch the raw changelog markdown.
- [ ] Study the oldest entries first (reverse the newest-first order).
- [ ] For each entry: extract + fetch images, write image notes.
- [ ] Append entries to the backlog (oldest → newest), set status to `pending`.
- [ ] Deduplicate against `.github/agents/llm-extension/PROGRESS.md` Done list (mark already-
      built items as `done (already built)`).

## Notes / decisions

- The researcher does NOT write code. Only the Coder writes code.
- **Images are mandatory to study.** Every entry with a screenshot must carry image notes
  (layout, controls, labels, states).
- Always keep the backlog in chronological order (oldest → newest). New (newest) entries are
  appended to the end.
- Never reorder the backlog out of chronological order.
