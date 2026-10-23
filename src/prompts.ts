/**
 * Pure helpers for reusable prompt files (1.99-12).
 *
 * Purity contract (same as `src/instructions.ts`): no `vscode` import, no fs —
 * everything here operates on plain strings so it can be unit-tested from the
 * smoke test via `out/prompts.js`.
 */

/** A discovered reusable prompt file. */
export interface PromptFile {
  /** Workspace-relative path (e.g. ".prompts/refactor.prompt.md"). */
  path: string;
  /** Display title (first markdown H1, else filename without extension). */
  title: string;
  /** Raw file content (comments NOT yet stripped). */
  content: string;
}

/** Cap on prompt file size (chars) — mirrors MAX_INSTRUCTION_CHARS. */
export const MAX_PROMPT_CHARS = 32_000;

/** Front-matter metadata of a prompt file (1.100-2). */
export interface PromptFileMeta {
  /** Chat mode the prompt runs in; invalid/missing → undefined. */
  mode?: "ask" | "agent" | "edit";
  /** Agent-mode tool allow-list (comma-separated in front matter). */
  tools?: string[];
  /** One-line description of what the prompt does. */
  description?: string;
  /** Optional display title (preferred over the first H1). */
  title?: string;
}

/**
 * Parse the YAML-ish front-matter of a prompt file (1.100-2).
 *
 * Front-matter exists only when the first line is exactly `---` (after
 * trimming a BOM). The closing delimiter is the next line that is exactly
 * `---` or `...`; if none is found the whole content is treated as body with
 * empty meta. Inside, only simple `key: value` lines are parsed and only
 * `mode`, `tools`, `description` and `title` are honored (others ignored);
 * values are trimmed and stripped of matching surrounding single/double
 * quotes. `mode` is validated against `ask`/`agent`/`edit` (case-insensitive,
 * normalized to lowercase; invalid → undefined). `tools` is a comma-separated
 * list of tool names (each trimmed, empties dropped; empty → undefined).
 * `body` is everything after the closing delimiter with leading newlines
 * trimmed.
 */
export function parsePromptFrontMatter(content: string): {
  meta: PromptFileMeta;
  body: string;
} {
  const text = content.replace(/^\uFEFF/, "");
  const lines = text.split("\n");
  if (lines[0] !== "---") {
    return { meta: {}, body: content };
  }
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---" || lines[i] === "...") {
      close = i;
      break;
    }
  }
  if (close === -1) {
    return { meta: {}, body: content };
  }
  const meta: PromptFileMeta = {};
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
    if (key === "mode") {
      const m = value.toLowerCase();
      if (m === "ask" || m === "agent" || m === "edit") {
        meta.mode = m;
      }
    } else if (key === "tools") {
      const tools = value
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      if (tools.length > 0) {
        meta.tools = tools;
      }
    } else if (key === "description") {
      meta.description = value;
    } else if (key === "title") {
      meta.title = value;
    }
  }
  const body = lines
    .slice(close + 1)
    .join("\n")
    .replace(/^\n+/, "");
  return { meta, body };
}

/**
 * Derive a display title: the front-matter `title` if present, otherwise the
 * first markdown H1 (`# Title`), otherwise the filename without its
 * extension. Empty content → filename.
 */
export function promptTitle(content: string, filePath: string): string {
  const fmTitle = parsePromptFrontMatter(content).meta.title;
  if (fmTitle) return fmTitle;
  const m = /^#\s+(.+)$/m.exec(content);
  if (m) return m[1].trim();
  const base = filePath.split("/").pop() ?? filePath;
  if (base.endsWith(".prompt.md")) return base.slice(0, -".prompt.md".length);
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}

/**
 * Strip markdown/HTML comments from prompt content before it is sent to
 * the LLM (changelog: "all commented-out links are ignored").
 * - Removes multi-line `<!-- … -->` blocks (non-greedy, dotAll).
 * - Removes leftover single-line `<!-- … -->` fragments.
 * - Collapses 2+ consecutive newlines to 1; trims the result.
 */
export function stripPromptComments(content: string): string {
  return content
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/**
 * Format a prompt file as a labeled block for system-prompt injection:
 * `## Prompt: <title>\n\n<stripped content>` — "" when content is empty
 * after stripping.
 */
export function promptBlock(file: PromptFile): string {
  const stripped = stripPromptComments(file.content);
  if (!stripped) return "";
  return `## Prompt: ${file.title}\n\n${stripped}`;
}

/**
 * Template written by "New Prompt File…". The front-matter example sets the
 * chat mode and an agent-mode tool allow-list; `tools` is ignored in ask
 * mode. HTML comments in the body are stripped before the prompt is sent to
 * the model.
 */
export const PROMPT_TEMPLATE: string =
  "---\nmode: agent\ntools: read_file, edit_file\ndescription: One-line description of what this prompt does\n---\n# My Prompt\n\n<!-- Describe what this prompt does. HTML comments are\n     stripped before the prompt is sent to the model. -->\n\n";
