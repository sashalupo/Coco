// context.ts — gather + format editor context for the chat request.
//
// Pure logic module: takes already-gathered context (file, selection,
// diagnostics) and formats it into a readable text block that can be prepended
// to the system prompt. No `vscode` import, no network — independently
// testable. The vscode-specific gathering lives in the ChatViewProvider.

import { formatNotebookForContext } from "./notebook";

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
