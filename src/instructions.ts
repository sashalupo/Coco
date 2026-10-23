// instructions.ts — pure logic for the "custom instructions file" feature.
//
// No `vscode` import, no fs, no network: this module defines the default
// instruction file paths the extension looks for, the per-file size cap, and
// the pure helper that combines loaded file contents into a single
// instructions block. The vscode-specific file discovery/reading lives in
// `chat/ChatViewProvider.ts`. Kept pure so it stays testable under plain Node.

/**
 * Default instruction files, checked in priority order (first found wins).
 * Paths are workspace-relative. Mirrors VS Code 1.98's Copilot custom
 * instructions GA (`AGENTS.md` / `.github/copilot-instructions.md`).
 */
export const DEFAULT_INSTRUCTION_FILES: readonly string[] = [
  "AGENTS.md",
  ".github/copilot-instructions.md",
];

/** Cap on the number of characters read from a single instruction file. */
export const MAX_INSTRUCTION_CHARS = 32_000;

/** A single instruction file that was found and loaded. */
export interface InstructionFile {
  /** Workspace-relative path (as configured / discovered). */
  path: string;
  /** The (possibly truncated) file contents. */
  content: string;
  /** True when the file exceeded `MAX_INSTRUCTION_CHARS` and was truncated. */
  truncated: boolean;
}

/**
 * Combine loaded instruction files into a single instructions block.
 *
 * - Returns `""` when no files are provided or all have empty content.
 * - Each file is wrapped in a clearly delimited section headed by its path so
 *   the model can tell which file each instruction came from.
 * - Files are joined in the order given (priority order).
 */
export function combineInstructions(files: InstructionFile[]): string {
  const sections = files
    .filter((f) => f.content.trim().length > 0)
    .map((f) => {
      const note = f.truncated ? " (truncated)" : "";
      return `## Instructions from ${f.path}${note}\n\n${f.content.trim()}`;
    });
  if (sections.length === 0) {
    return "";
  }
  return sections.join("\n\n");
}

// ---------------------------------------------------------------------------
// Instructions files (1.100-1): `.instructions.md` files with `applyTo`
// front-matter globs that auto-attach when the chat context references
// matching files. Pure logic only — discovery/reading lives in the host.
// ---------------------------------------------------------------------------

/** Front-matter metadata honored in an `.instructions.md` file. */
export interface InstructionsFileMeta {
  /** Glob (or `|`-separated alternation of globs) the file applies to. */
  applyTo?: string;
  /** Optional display title for the file. */
  title?: string;
}

/**
 * Parse the YAML-ish front-matter of an instructions file.
 *
 * Front-matter exists only when the first line is exactly `---` (after
 * trimming a BOM). The closing delimiter is the next line that is exactly
 * `---` or `...`; if none is found the whole content is treated as body with
 * empty meta. Inside, only simple `key: value` lines are parsed and only
 * `applyTo` and `title` are honored (others ignored); values are trimmed and
 * stripped of matching surrounding single/double quotes. `body` is everything
 * after the closing delimiter with leading newlines trimmed.
 */
export function parseInstructionsFrontMatter(content: string): {
  meta: InstructionsFileMeta;
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
  const meta: InstructionsFileMeta = {};
  for (let i = 1; i < close; i++) {
    const line = lines[i];
    const idx = line.indexOf(":");
    if (idx <= 0) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      value.length >= 2 &&
      ((value[0] === '"' && value[value.length - 1] === '"') ||
        (value[0] === "'" && value[value.length - 1] === "'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key === "applyTo") {
      meta.applyTo = value;
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
 * Convert a glob pattern to an anchored RegExp. Hand-rolled (no glob or
 * minimatch packages): a double-star followed by a slash becomes an
 * optional any-path prefix, a bare double-star matches anything, a single
 * star matches any run of non-slash characters, a question mark matches a
 * single non-slash character, and every other character is regex-escaped.
 */
export function globToRegExp(glob: string): RegExp {
  let out = "^";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        if (glob[i + 2] === "/") {
          out += "(?:.*/)?";
          i += 2;
        } else {
          out += ".*";
          i += 1;
        }
      } else {
        out += "[^/]*";
      }
    } else if (ch === "?") {
      out += "[^/]";
    } else {
      out += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  out += "$";
  return new RegExp(out);
}

/**
 * True when `filePath` matches any glob in the `|`-separated `applyTo`
 * alternation. Empty `applyTo` → `false`. `filePath` is normalized to
 * forward slashes and a leading `./` is stripped before matching.
 */
export function applyToMatches(applyTo: string, filePath: string): boolean {
  if (!applyTo || applyTo.trim() === "") {
    return false;
  }
  const normalized = filePath.replace(/\\/g, "/").replace(/^\.\//, "");
  return applyTo
    .split("|")
    .map((g) => g.trim())
    .filter((g) => g.length > 0)
    .some((g) => globToRegExp(g).test(normalized));
}

/**
 * Pick the files (in order, deduped by path) whose non-empty `applyTo`
 * matches any `contextPaths` entry. Files without `applyTo` are never
 * auto-attached (they are attachable only via the command).
 */
export function pickAutoAttachFiles(
  files: ReadonlyArray<{ path: string; applyTo?: string }>,
  contextPaths: ReadonlyArray<string>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of files) {
    if (seen.has(f.path)) {
      continue;
    }
    if (!f.applyTo || f.applyTo.trim() === "") {
      continue;
    }
    if (contextPaths.some((p) => applyToMatches(f.applyTo as string, p))) {
      seen.add(f.path);
      out.push(f.path);
    }
  }
  return out;
}

/** Front-matter template for newly created `.instructions.md` files. */
export const INSTRUCTIONS_FILE_TEMPLATE: string =
  "---\napplyTo: src/**/*.ts\n---\n\n# My Instructions\n\n<!-- Instructions the LLM should follow when working on files\n     matching the applyTo glob above. -->\n";

/**
 * Sanitize a user-supplied name into an instructions file name: trim,
 * replace runs of `[^a-zA-Z0-9._-]` with `-`, strip leading `-`/`.`
 * characters, fall back to `"instructions"` when empty, and append
 * `.instructions.md` when the result does not already end with it.
 */
export function instructionsFileName(name: string): string {
  let s = name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[-.]+/, "")
    .replace(/[-.]+$/, "");
  if (s === "") {
    s = "instructions";
  }
  if (!s.endsWith(".instructions.md")) {
    s += ".instructions.md";
  }
  return s;
}
