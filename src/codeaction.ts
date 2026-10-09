// codeaction.ts — build + parse code-action (fix/refactor) prompts.
//
// Pure logic module: takes the code (plus an optional selection and the
// diagnostics to address) and formats a focused "fix/refactor this code"
// prompt, then parses the model's reply back into the full updated code.
// No `vscode` import, no network — independently testable. The
// vscode-specific gathering (document, range, diagnostics) lives in the
// CodeActionProvider.

/** A single diagnostic (error/warning/info) to address. */
export interface CodeActionDiagnostic {
  /** 1-based line number the diagnostic starts on. */
  line: number;
  /** 1-based column the diagnostic starts on. */
  column: number;
  /** Severity label, e.g. "error" | "warning" | "info". */
  severity: string;
  /** The diagnostic message. */
  message: string;
}

/** The code context for a code action, gathered by the provider. */
export interface CodeActionContext {
  /** Language identifier, e.g. "typescript". */
  language: string;
  /** File path (workspace-relative when possible). */
  path: string;
  /** The full file contents (or the relevant excerpt to fix/refactor). */
  code: string;
  /** The selected range, if any (what the user is focused on). */
  selection?: {
    /** 1-based start line. */
    startLine: number;
    /** 1-based end line. */
    endLine: number;
    /** The selected text. */
    text: string;
  };
  /** Diagnostics to address, if any. */
  diagnostics?: CodeActionDiagnostic[];
}

/**
 * Build a focused prompt asking the model to fix or refactor the code.
 *
 * The prompt includes the language, the file path, the code (to be fixed /
 * refactored), and — when present — the selected range and the diagnostics to
 * address. It asks the model to return ONLY the full updated code, with no
 * explanation or code fences. Sections are emitted in a stable order:
 * code → selection → diagnostics.
 */
export function buildCodeActionPrompt(ctx: CodeActionContext): string {
  const parts: string[] = [];

  parts.push(`Fix or refactor the following ${ctx.language} code.`);
  parts.push(
    "Return ONLY the full updated code — no explanation, no code fences, " +
      "no partial diffs, no repeated unchanged boilerplate.",
  );

  if (ctx.path) {
    parts.push(`File: ${ctx.path}`);
  }

  parts.push("Code:\n```\n" + ctx.code + "\n```");

  if (ctx.selection) {
    const s = ctx.selection;
    const range =
      s.startLine === s.endLine
        ? `line ${s.startLine}`
        : `lines ${s.startLine}–${s.endLine}`;
    parts.push(`Selected range (${range}):\n\`\`\`\n${s.text}\n\`\`\``);
  }

  if (ctx.diagnostics && ctx.diagnostics.length > 0) {
    const lines = ctx.diagnostics.map(
      (d) => `- [${d.severity}] ${d.line}:${d.column} — ${d.message}`,
    );
    parts.push("Diagnostics to address:\n" + lines.join("\n"));
  }

  return parts.join("\n\n");
}

/**
 * Parse the model's reply into the full updated code.
 *
 * Strips a surrounding markdown code fence (```lang … ```) if present, trims
 * leading/trailing whitespace, and returns the raw code. Returns an empty
 * string when there is nothing usable (empty input, or only a fence).
 */
export function parseCodeAction(text: string): string {
  if (!text) {
    return "";
  }
  let t = text.trim();

  // Strip a leading markdown code fence (```lang … ```).
  const fenceMatch = t.match(/^```[^\n]*\n([\s\S]*?)\n?```/);
  if (fenceMatch) {
    t = fenceMatch[1];
  }
  // Remove any trailing closing fence that was not matched above.
  t = t.replace(/\n?```\s*$/, "");

  return t.trim();
}
