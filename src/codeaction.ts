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

// ---------------------------------------------------------------------------
// Alt-text generation (AI code action) — pure helpers.
//
// Find an image reference (HTML <img> or Markdown ![alt](src)) on a line,
// detect placeholder alt text, build the prompt asking the model for a
// concise accessibility description, and parse the model's reply.
// No `vscode` import — independently testable.

/** An image reference found on a line (HTML <img> or Markdown ![alt](src)). */
export interface ImageRef {
  /** The image source (src attribute or Markdown URL). */
  src: string;
  /** The current alt text (may be empty or a placeholder). */
  alt: string;
  /** Offset within the line text where the alt-text slot starts. */
  altStart: number;
  /** Offset within the line text where the alt-text slot ends. */
  altEnd: number;
}

/**
 * Find an image reference on a single line of text.
 *
 * Matches:
 * - HTML `<img ... src="..." ...>` — the `alt` attribute may appear before or
 *   after `src`, with single or double quotes (a missing `alt` attribute is
 *   treated as an empty alt slot at the end of the tag).
 * - Markdown `![alt](src)`.
 *
 * `altStart`/`altEnd` are offsets within the line text pointing at the
 * alt-text slot (between `alt="` and `"`, or between `![` and `]`), so
 * `line.slice(altStart, altEnd) === alt`. Returns `null` when the line has no
 * image reference.
 */
export function findImageRef(line: string): ImageRef | null {
  // Markdown: ![alt](src)
  const md = line.match(/!\[([^\]]*)\]\(([^)\s]+)\)/);
  if (md) {
    const altStart = md.index! + 2; // after "!" + "["
    return {
      src: md[2],
      alt: md[1],
      altStart,
      altEnd: altStart + md[1].length,
    };
  }

  // HTML: <img ...>
  const tag = line.match(/<img\b[^>]*>/i);
  if (!tag) {
    return null;
  }
  const tagStart = tag.index!;
  const tagText = tag[0];

  const srcMatch = tagText.match(
    /src\s*=\s*(?:"([^"]*)"|'([^']*)')/i,
  );
  if (!srcMatch) {
    return null;
  }
  const src = srcMatch[1] !== undefined ? srcMatch[1] : srcMatch[2];

  const altMatch = tagText.match(
    /alt\s*=\s*(?:"([^"]*)"|'([^']*)')/i,
  );
  if (altMatch) {
    const alt = altMatch[1] !== undefined ? altMatch[1] : altMatch[2];
    // Offset of the first character of the alt value within the line:
    // right after the opening quote of the attribute value.
    const quoteOffset = altMatch[0].search(/["']/);
    const altStart = tagStart + altMatch.index! + quoteOffset + 1;
    return { src, alt, altStart, altEnd: altStart + alt.length };
  }

  // No alt attribute: empty slot at the end of the tag (before ">").
  return {
    src,
    alt: "",
    altStart: tagStart + tagText.length - 1,
    altEnd: tagStart + tagText.length - 1,
  };
}

/**
 * True when the alt text is empty or a known placeholder (tbd, todo, fixme,
 * image, img, placeholder, "description here").
 */
export function isPlaceholderAlt(alt: string): boolean {
  const t = alt.trim();
  if (t === "") {
    return true;
  }
  return /^(tbd|todo|fixme|image|img|placeholder|description here)$/i.test(t);
}

/**
 * Build the prompt asking the model for a concise accessibility alt text for
 * the image at `src`. Includes the surrounding context block and, when the
 * image itself could not be attached (`imageIncluded === false`), a note that
 * the model must describe the image from the source path and context alone.
 */
export function buildAltTextPrompt(
  src: string,
  context: string,
  imageIncluded: boolean,
): string {
  const parts: string[] = [];

  parts.push(
    "Write a concise accessibility alt text for the image: " + src,
  );
  parts.push(
    "Rules: at most 100 characters; no quotation marks; no code fences; " +
      "no explanation — return ONLY the alt text.",
  );

  if (context) {
    parts.push("Surrounding context:\n```\n" + context + "\n```");
  }

  if (!imageIncluded) {
    parts.push(
      "Note: the image itself could not be attached. Describe it from the " +
        "source path and the surrounding context alone.",
    );
  }

  return parts.join("\n\n");
}

/**
 * Parse the model's reply into a usable alt text.
 *
 * Trims, strips a surrounding markdown code fence, strips surrounding quotes,
 * collapses internal whitespace to single spaces, and caps the result at 200
 * characters. Returns `""` when nothing usable remains.
 */
export function parseAltText(text: string): string {
  if (!text) {
    return "";
  }
  let t = text.trim();

  // Strip a surrounding markdown code fence (```lang … ```). Multi-line
  // fences have the content on its own lines; inline fences (```A cat```)
  // have no newline, so the first three and last three characters are the
  // fence itself.
  if (t.startsWith("```") && t.endsWith("```") && t.length >= 6) {
    if (t.includes("\n")) {
      const fenceMatch = t.match(/^```[^\n]*\n([\s\S]*?)\n?```$/);
      if (fenceMatch) {
        t = fenceMatch[1];
      }
    } else {
      t = t.slice(3, -3);
    }
  }
  t = t.trim();

  // Strip one pair of surrounding quotes (single or double).
  if (
    t.length >= 2 &&
    ((t.startsWith('"') && t.endsWith('"')) ||
      (t.startsWith("'") && t.endsWith("'")))
  ) {
    t = t.slice(1, -1).trim();
  }

  // Collapse internal whitespace to single spaces.
  t = t.replace(/\s+/g, " ").trim();

  if (t.length === 0) {
    return "";
  }
  return t.length > 200 ? t.slice(0, 200) : t;
}
