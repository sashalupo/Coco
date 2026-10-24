/**
 * Pure helpers for custom chat modes (1.101-8).
 *
 * Purity contract (same as `src/prompts.ts`): no `vscode` import, no fs —
 * everything here operates on plain strings so it can be unit-tested from the
 * smoke test via `out/chatmodes.js`.
 *
 * A custom mode is a `*.chatprompt.md` file: front matter (`description`,
 * `tools`) + a body of instructions. Unlike a prompt file, a chatprompt file
 * DEFINES a mode — `mode`/`title` front-matter keys are not honored.
 */

import { stripPromptComments } from "./prompts";

/** A discovered custom chat mode file. */
export interface CustomModeFile {
  /** Mode name (filename stem, e.g. `review.chatprompt.md` → `review`). */
  name: string;
  /** One-line description (shown in the mode dropdown). */
  description?: string;
  /** Agent-mode tool allow-list (comma-separated in front matter). */
  tools?: string[];
  /** Mode instructions (body, comments stripped, trimmed). */
  instructions: string;
  /** File path the mode was loaded from. */
  path: string;
}

/**
 * Derive the mode name from a file path: the filename stem.
 * `review.chatprompt.md` → `review`; `a/b/x.chatprompt.md` → `x`;
 * a file without the `.chatprompt.md` suffix falls back to stripping the
 * last extension (`x.md` → `x`); no extension → the basename itself.
 */
export function chatModeName(filePath: string): string {
  const base = filePath.split("/").pop() ?? filePath;
  if (base.endsWith(".chatprompt.md")) {
    return base.slice(0, -".chatprompt.md".length);
  }
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}

/**
 * Parse a `*.chatprompt.md` file into a `CustomModeFile`.
 *
 * Front matter uses the same `---`/`...` delimiter + `key: value` rules as
 * `parsePromptFrontMatter` (BOM trimmed, first line exactly `---`, closing
 * delimiter `---` or `...`, values trimmed and stripped of matching
 * surrounding quotes) but only `description` and `tools` are honored —
 * `mode`/`title` are ignored (a chatprompt file defines a mode, it is not a
 * runnable prompt). `tools` is comma-split/trimmed/empties-dropped; empty →
 * `undefined`. `instructions` = `stripPromptComments(body).trim()`.
 * Returns `null` when `instructions` is empty (a mode with no body is
 * invalid).
 */
export function parseChatModeFile(
  content: string,
  filePath: string
): CustomModeFile | null {
  const text = content.replace(/^\uFEFF/, "");
  const lines = text.split("\n");
  let meta: { description?: string; tools?: string[] } = {};
  let body = content;
  if (lines[0] === "---") {
    let close = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === "---" || lines[i] === "...") {
        close = i;
        break;
      }
    }
    if (close !== -1) {
      for (let i = 1; i < close; i++) {
        const line = lines[i];
        const idx = line.indexOf(":");
        if (idx <= 0) {
          continue;
        }
        const key = line.slice(0, idx).trim().toLowerCase();
        let value = line.slice(idx + 1).trim();
        if (
          value.length >= 2 &&
          ((value[0] === '"' && value[value.length - 1] === '"') ||
            (value[0] === "'" && value[value.length - 1] === "'"))
        ) {
          value = value.slice(1, -1);
        }
        if (key === "description") {
          meta.description = value;
        } else if (key === "tools") {
          const tools = value
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
          if (tools.length > 0) {
            meta.tools = tools;
          }
        }
      }
      body = lines
        .slice(close + 1)
        .join("\n")
        .replace(/^\n+/, "");
    }
  }
  const instructions = stripPromptComments(body).trim();
  if (!instructions) {
    return null;
  }
  return {
    name: chatModeName(filePath),
    description: meta.description,
    tools: meta.tools,
    instructions,
    path: filePath,
  };
}

/**
 * Template written by "New Chat Mode…". The front-matter example sets a
 * one-line description and an agent-mode tool allow-list; the body is the
 * mode's instructions (HTML comments are stripped before injection).
 */
export const CHATMODE_TEMPLATE: string =
  "---\ndescription: One-line description of this mode\ntools: read_file, edit_file\n---\n# My Mode\n\nInstructions the model follows while this mode is selected.\n";
