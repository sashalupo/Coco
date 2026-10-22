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

/**
 * Derive a display title: the first markdown H1 (`# Title`) if present,
 * otherwise the filename without its extension. Empty content → filename.
 */
export function promptTitle(content: string, filePath: string): string {
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

/** Template written by "New Prompt File…". */
export const PROMPT_TEMPLATE: string =
  "# My Prompt\n\n<!-- Describe what this prompt does. HTML comments are\n     stripped before the prompt is sent to the model. -->\n\n";
