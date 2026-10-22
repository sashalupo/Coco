// context.ts — gather + format editor context for the chat request.
//
// Pure logic module: takes already-gathered context (file, selection,
// diagnostics) and formats it into a readable text block that can be prepended
// to the system prompt. No `vscode` import, no network — independently
// testable. The vscode-specific gathering lives in the ChatViewProvider.

import { formatNotebookForContext } from "./notebook";
import { USAGES_BLOCK_MAX_CHARS } from "./usages";
import { listWorkspaceTypes } from "./workspaceScaffold";

/** A single diagnostic (error/warning/info) on a file. */
export interface ContextDiagnostic {
  /** 1-based line number the diagnostic starts on. */
  line: number;
  /** 1-based column the diagnostic starts on. */
  column: number;
  /** Severity label, e.g. "error" | "warning" | "info". */
  severity: string;
  /** The diagnostic message. */
  message: string;
}

/** The active file being looked at (if any). */
export interface ContextFile {
  /** File path (workspace-relative when possible). */
  path: string;
  /** Language identifier, e.g. "typescript". */
  language?: string;
  /** The full file contents (or the relevant excerpt). */
  content: string;
}

/** The current selection within the active file (if any). */
export interface ContextSelection {
  /** 1-based start line. */
  startLine: number;
  /** 1-based start column. */
  startColumn: number;
  /** 1-based end line. */
  endLine: number;
  /** 1-based end column. */
  endColumn: number;
  /** The selected text. */
  text: string;
}

/** Everything gathered from the editor to inject into the request. */
export interface ContextInput {
  file?: ContextFile;
  selection?: ContextSelection;
  diagnostics?: ContextDiagnostic[];
  /** Files explicitly tagged by the user via @filename references. */
  taggedFiles?: ContextFile[];
}

/**
 * Extract `@filename` references from a user message. A tag is `@` followed
 * by a path-like token (letters, digits, `.`, `_`, `-`, `/`). Returns the
 * unique file paths in order of first appearance. Pure and testable.
 */
export function extractTaggedFiles(text: string): string[] {
  if (!text) {
    return [];
  }
  const re = /@([A-Za-z0-9_.\-/]+)/g;
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const p = m[1];
    if (!seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}

/**
 * Format the gathered context into a readable text block.
 *
 * Returns an empty string when nothing is provided, so callers can safely
 * skip injection. Sections are emitted in a stable order: file, selection,
 * diagnostics, tagged files.
 */
export function buildContextBlock(input: ContextInput): string {
  const sections: string[] = [];

  if (input.file) {
    const header = input.file.language
      ? `File: ${input.file.path} (${input.file.language})`
      : `File: ${input.file.path}`;
    sections.push(`${header}\n\`\`\`\n${input.file.content}\n\`\`\``);
  }

  if (input.selection) {
    const s = input.selection;
    const range =
      s.startLine === s.endLine
        ? `line ${s.startLine}, col ${s.startColumn}-${s.endColumn}`
        : `lines ${s.startLine}:${s.startColumn}–${s.endLine}:${s.endColumn}`;
    sections.push(`Selection (${range}):\n\`\`\`\n${s.text}\n\`\`\``);
  }

  if (input.diagnostics && input.diagnostics.length > 0) {
    const lines = input.diagnostics.map(
      (d) => `- [${d.severity}] ${d.line}:${d.column} — ${d.message}`,
    );
    sections.push(`Diagnostics:\n${lines.join("\n")}`);
  }

  if (input.taggedFiles && input.taggedFiles.length > 0) {
    for (const tf of input.taggedFiles) {
      const header = tf.language
        ? `Tagged file: ${tf.path} (${tf.language})`
        : `Tagged file: ${tf.path}`;
      if (tf.path.toLowerCase().endsWith(".ipynb")) {
        // Notebooks render as a cell-by-cell text view, not raw JSON.
        sections.push(`${header}\n${formatNotebookForContext(tf.content)}`);
      } else {
        sections.push(`${header}\n\`\`\`\n${tf.content}\n\`\`\``);
      }
    }
  }

  return sections.join("\n\n");
}

// ---------------------------------------------------------------------------
// #codebase tag (1.98-8): pure parsing + formatting helpers. The actual
// workspace sweep (structure / git status / text search) is wired up in a
// later slice; these functions only parse the tag and render the block.
// ---------------------------------------------------------------------------

/**
 * Extract the `#codebase` tag query from a user message.
 *
 * Finds the FIRST case-insensitive, word-bounded `#codebase` occurrence
 * (`#codebasefoo` does NOT match; `#Codebase` DOES). Returns the trimmed
 * text after the tag on the SAME line (up to the next newline). Returns
 * `""` when the tag is present but nothing follows on that line, and
 * `null` when the tag is absent. Pure and testable.
 */
export function extractCodebaseQuery(text: string): string | null {
  const m = /#codebase(?!\w)/i.exec(text);
  if (!m) {
    return null;
  }
  const rest = text.slice(m.index + m[0].length);
  const nl = rest.indexOf("\n");
  const sameLine = nl === -1 ? rest : rest.slice(0, nl);
  return sameLine.trim();
}

/** The three pieces of data a workspace sweep produces. */
export interface CodebaseSweepData {
  /** Project structure listing (relative paths). */
  structure: string;
  /** Git status text (modified files); "" when clean / not a repo. */
  gitStatus: string;
  /** Text-search matches for the query; "" when none. */
  search: string;
}

/** Hard cap for the rendered sweep block. */
const CODEBASE_SWEEP_MAX_CHARS = 12000;
const CODEBASE_SWEEP_TRUNCATED_SUFFIX = "… (truncated)";

/**
 * Render a `#codebase` sweep result as a stable context block:
 *
 * ```
 * Codebase sweep (query: <query>)
 * ### Project structure
 * <structure>
 * ### Git status (modified files)
 * <gitStatus or "(clean or not a git repo)">
 * ### Search: <query>
 * <search or "(no matches)">
 * ```
 *
 * The header query is `(none)` when the query is empty/undefined. Empty
 * sub-sections render their placeholder line (never a dangling header).
 * The whole block is truncated to 12,000 chars with a `… (truncated)`
 * suffix. Returns `""` when all three fields are empty. Pure and testable.
 */
export function formatCodebaseSweep(
  data: CodebaseSweepData,
  query?: string,
): string {
  const q = query && query.trim() !== "" ? query : "(none)";
  if (!data.structure && !data.gitStatus && !data.search && q === "(none)") {
    return "";
  }
  const block = [
    `Codebase sweep (query: ${q})`,
    "### Project structure",
    data.structure,
    "### Git status (modified files)",
    data.gitStatus || "(clean or not a git repo)",
    `### Search: ${q}`,
    data.search || "(no matches)",
  ].join("\n");
  if (block.length <= CODEBASE_SWEEP_MAX_CHARS) {
    return block;
  }
  return (
    block.slice(0, CODEBASE_SWEEP_MAX_CHARS) + CODEBASE_SWEEP_TRUNCATED_SUFFIX
  );
}

// ---------------------------------------------------------------------------
// #problems tag (1.98-9): attach compiler/linter problems as chat context.
// Diagnostics collection (vscode) is wired up in a later slice; these
// functions only parse the tag and render the block.
// ---------------------------------------------------------------------------

/**
 * Extract the `#problems` tag qualifier from a user message.
 *
 * Finds the FIRST case-insensitive, word-bounded `#problems` occurrence
 * (`#problemsfoo` does NOT match; `#Problems` DOES). Returns the trimmed
 * text after the tag on the SAME line (up to the next newline) — the raw
 * qualifier (a file path, or empty). Returns `""` when the tag is present
 * but nothing follows on that line, and `null` when the tag is absent.
 * Pure and testable.
 */
export function extractProblemsTag(text: string): string | null {
  const m = /#problems(?!\w)/i.exec(text);
  if (!m) {
    return null;
  }
  const rest = text.slice(m.index + m[0].length);
  const nl = rest.indexOf("\n");
  const sameLine = nl === -1 ? rest : rest.slice(0, nl);
  return sameLine.trim();
}

/** The data a problems collection produces. */
export interface ProblemsBlockData {
  /** Formatted diagnostics text; "" when there are no problems. */
  text: string;
}

/** Hard cap for the rendered problems block. */
export const PROBLEMS_BLOCK_MAX_CHARS = 8000;
const PROBLEMS_BLOCK_TRUNCATED_SUFFIX = "… (truncated)";

/**
 * Render a `#problems` result as a stable context block:
 *
 * ```
 * Problems (scope: workspace)
 * <text or "(no problems — clean)">
 * ```
 *
 * The scope is `workspace` when scope is undefined/empty, else the given
 * scope (e.g. a file path). The whole block is truncated to
 * `PROBLEMS_BLOCK_MAX_CHARS` chars with a `… (truncated)` suffix. Returns
 * `""` when `data.text` is empty AND scope is undefined/`"workspace"`
 * (nothing to show for the default scope). Pure and testable.
 */
export function formatProblemsBlock(
  data: ProblemsBlockData,
  scope?: string,
): string {
  const s = scope && scope.trim() !== "" ? scope : "workspace";
  if (!data.text && s === "workspace") {
    return "";
  }
  const block = `Problems (scope: ${s})\n${data.text || "(no problems — clean)"}`;
  if (block.length <= PROBLEMS_BLOCK_MAX_CHARS) {
    return block;
  }
  return (
    block.slice(0, PROBLEMS_BLOCK_MAX_CHARS) + PROBLEMS_BLOCK_TRUNCATED_SUFFIX
  );
}

// ---------------------------------------------------------------------------
// #folder tag (1.98-10): attach a folder's file tree as chat context.
// Folder sweeping (fs) is wired up in a later slice; these functions only
// parse the tag and render the block.
// ---------------------------------------------------------------------------

/**
 * Extract the `#folder` tag qualifier from a user message.
 *
 * Finds the FIRST case-insensitive, word-bounded `#folder` occurrence.
 * Both `#folder:<name>` (colon) and `#folder <name>` (space) are accepted;
 * `#folderfoo` does NOT match (a colon or end/whitespace must follow
 * `folder`). Returns the trimmed folder-name remainder (up to the next
 * whitespace/newline — same-line semantics), `""` for the bare tag, and
 * `null` when the tag is absent. Pure and testable.
 */
export function extractFolderTag(text: string): string | null {
  const m = /#folder(?::(\S*)|[ \t]+(\S*)|(?=\n|$))/i.exec(text);
  if (!m) {
    return null;
  }
  return (m[1] ?? m[2] ?? "").trim();
}

/** The data a folder sweep produces. */
export interface FolderBlockData {
  /** Rendered file tree; "" when the folder is empty. */
  tree: string;
  /** Set when the folder could not be resolved. */
  notFound?: boolean;
}

/** Hard cap for the rendered folder block. */
export const FOLDER_BLOCK_MAX_CHARS = 8000;
const FOLDER_BLOCK_TRUNCATED_SUFFIX = "… (truncated)";

/**
 * Render a `#folder` result as a stable context block:
 *
 * ```
 * Folder: <name or "(workspace root)">
 * <tree or "(empty folder)" or "(folder not found: <name>)">
 * ```
 *
 * The whole block is truncated to `FOLDER_BLOCK_MAX_CHARS` chars with a
 * `… (truncated)` suffix. Unlike `formatProblemsBlock`, this NEVER returns
 * `""` — the tag was explicit, so the header is always shown. Pure and
 * testable.
 */
export function formatFolderBlock(
  data: FolderBlockData,
  folder?: string,
): string {
  const f = folder && folder.trim() !== "" ? folder : "(workspace root)";
  const body = data.notFound
    ? `(folder not found: ${f})`
    : data.tree || "(empty folder)";
  const block = `Folder: ${f}\n${body}`;
  if (block.length <= FOLDER_BLOCK_MAX_CHARS) {
    return block;
  }
  return (
    block.slice(0, FOLDER_BLOCK_MAX_CHARS) + FOLDER_BLOCK_TRUNCATED_SUFFIX
  );
}

// ---------------------------------------------------------------------------
// #fetch tag (1.99-4): attach a fetched web page as chat context. The actual
// fetch (network) is wired up in a later slice; these functions only parse
// the tag and render the block.
// ---------------------------------------------------------------------------

/**
 * Extract the `#fetch` tag URL from a user message.
 *
 * Finds the FIRST case-insensitive, word-bounded `#fetch` occurrence
 * (`#fetchfoo` does NOT match; `#Fetch` DOES). Returns the trimmed URL
 * token (first non-whitespace run) after the tag, or `null` when the tag
 * is absent or bare (no URL follows). Pure and testable.
 */
export function extractFetchTag(text: string): string | null {
  const m = /#fetch(?!\w)\s+(\S+)/i.exec(text);
  if (!m) {
    return null;
  }
  return m[1].trim();
}

/** Hard cap for the rendered fetch block. */
export const FETCH_BLOCK_MAX_CHARS = 20000;
const FETCH_BLOCK_TRUNCATED_SUFFIX = "… (truncated)";

/**
 * Render a `#fetch` result as a stable context block:
 *
 * ```
 * Fetched page: <url>
 *
 * <text>
 * ```
 *
 * The whole block is truncated to `FETCH_BLOCK_MAX_CHARS` chars with a
 * `… (truncated)` suffix. Returns `""` when `text` is empty/whitespace.
 * Pure and testable.
 */
export function formatFetchBlock(url: string, text: string): string {
  if (text.trim() === "") {
    return "";
  }
  const block = `Fetched page: ${url}\n\n${text}`;
  if (block.length <= FETCH_BLOCK_MAX_CHARS) {
    return block;
  }
  return (
    block.slice(0, FETCH_BLOCK_MAX_CHARS) + FETCH_BLOCK_TRUNCATED_SUFFIX
  );
}

// ---------------------------------------------------------------------------
// #usages tag (1.99-5): attach find_usages results as chat context. The actual
// search is wired up in a later slice; these functions only parse the tag and
// render the block.
// ---------------------------------------------------------------------------

/**
 * Extract the `#usages` tag symbol from a user message.
 *
 * Finds the FIRST case-insensitive, word-bounded `#usages` occurrence
 * (`#usagesfoo` does NOT match; `#Usages` DOES). Returns the trimmed symbol
 * token (must be a valid identifier: `[A-Za-z_$][A-Za-z0-9_$]*`) after the
 * tag, or `null` when the tag is absent, bare (no symbol follows), or the
 * token is not a valid identifier. Pure and testable.
 */
export function extractUsagesTag(text: string): string | null {
  const m = /#usages(?!\w)\s+([A-Za-z_$][A-Za-z0-9_$]*)/i.exec(text);
  if (!m) {
    return null;
  }
  return m[1].trim();
}

/**
 * Render a `#usages` result as a stable context block:
 *
 * ```
 * Usages for `symbol`:
 *
 * <body>
 * ```
 *
 * The whole block is truncated to `USAGES_BLOCK_MAX_CHARS` chars with a
 * `… (truncated)` suffix. Returns `""` when `body` is empty/whitespace.
 * Pure and testable.
 */
export function formatUsagesTagBlock(symbol: string, body: string): string {
  if (body.trim() === "") {
    return "";
  }
  const block = `Usages for \`${symbol}\`:\n\n${body}`;
  if (block.length <= USAGES_BLOCK_MAX_CHARS) {
    return block;
  }
  return block.slice(0, USAGES_BLOCK_MAX_CHARS) + "… (truncated)";
}

// ---------------------------------------------------------------------------
// #newWorkspace tag (1.99-6): scaffold a new workspace with agent mode. These
// functions only parse the tag and render the scaffold prompt block; the
// wiring lives in a later slice.
// ---------------------------------------------------------------------------

/**
 * Extract the `#newWorkspace` tag from a user message.
 *
 * Finds the FIRST case-insensitive, word-bounded `#newWorkspace` occurrence
 * (`#newWorkspacefoo` does NOT match; `#NewWorkspace` DOES). The type token
 * must be a known workspace type (see `listWorkspaceTypes()`); the optional
 * folder token defaults to `<type>-project`. Returns `null` when the tag is
 * absent, the type is unknown, or no type token follows the tag. Pure and
 * testable.
 */
export function extractNewWorkspaceTag(
  text: string,
): { type: string; folder: string } | null {
  const m = /#newWorkspace(?!\w)\s+([a-z-]+)(?:\s+(\S+))?/i.exec(text);
  if (!m) {
    return null;
  }
  const type = m[1].toLowerCase();
  if (!listWorkspaceTypes().includes(type)) {
    return null;
  }
  const folder = m[2] ?? `${type}-project`;
  return { type, folder };
}

/**
 * Render a `#newWorkspace` scaffold prompt as a stable context block:
 *
 * ```
 * New workspace scaffold (<type> → <folder>):
 *
 * <prompt>
 * ```
 *
 * The whole block is truncated to `WORKSPACE_BLOCK_MAX_CHARS` chars with a
 * `… (truncated)` suffix. Returns `""` when `prompt` is empty/whitespace.
 * Pure and testable.
 */
export function formatWorkspaceBlock(
  type: string,
  folder: string,
  prompt: string,
): string {
  const WORKSPACE_BLOCK_MAX_CHARS = 20000;
  if (prompt.trim() === "") {
    return "";
  }
  const block = `New workspace scaffold (${type} → ${folder}):\n\n${prompt}`;
  if (block.length <= WORKSPACE_BLOCK_MAX_CHARS) {
    return block;
  }
  return block.slice(0, WORKSPACE_BLOCK_MAX_CHARS) + "… (truncated)";
}

// ---------------------------------------------------------------------------
// #searchResults tag (1.99-19): attach workspace text-search results as chat
// context. The actual search is wired up in a later slice; these functions
// only parse the tag and render the block.
// ---------------------------------------------------------------------------

/**
 * Extract the `#searchResults` tag query from a user message.
 *
 * Finds the FIRST case-insensitive, word-bounded `#searchResults` occurrence.
 * Both `#searchResults:query` (colon) and `#searchResults query` (space) are
 * accepted; `#searchResultsfoo` does NOT match (a colon or end/whitespace
 * must follow `searchResults`). Returns the trimmed query token (up to the
 * next whitespace/newline — same-line semantics), `""` for the bare tag, and
 * `null` when the tag is absent. Pure and testable.
 */
export function extractSearchResultsTag(text: string): string | null {
  const m = /#searchResults(?::(\S*)|[ \t]+(\S*)|(?=\n|$))/i.exec(text);
  if (!m) {
    return null;
  }
  return (m[1] ?? m[2] ?? "").trim();
}

/** Hard cap for the rendered search-results block. */
export const SEARCH_RESULTS_BLOCK_MAX_CHARS = 8000;
const SEARCH_RESULTS_TRUNCATED_SUFFIX = "… (truncated)";

/**
 * Render `#searchResults` matches as a stable context block:
 *
 * ```
 * Search results (query: <query or "(none)">):
 * <body or "(no matches)">
 * ```
 *
 * The whole block is truncated to `SEARCH_RESULTS_BLOCK_MAX_CHARS` chars with
 * a `… (truncated)` suffix. Unlike `formatProblemsBlock`, this NEVER returns
 * `""` — the tag was explicit, so the header is always shown. Pure and
 * testable.
 */
export function formatSearchResultsBlock(query: string, body: string): string {
  const q = query.trim() !== "" ? query : "(none)";
  const b = body.trim() !== "" ? body : "(no matches)";
  const block = `Search results (query: ${q}):\n${b}`;
  if (block.length <= SEARCH_RESULTS_BLOCK_MAX_CHARS) {
    return block;
  }
  return (
    block.slice(0, SEARCH_RESULTS_BLOCK_MAX_CHARS) +
    SEARCH_RESULTS_TRUNCATED_SUFFIX
  );
}
