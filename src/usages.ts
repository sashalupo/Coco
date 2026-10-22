/**
 * usages.ts — pure usages-search helpers for the `find_usages` tool
 * (item 1.99-5). No `vscode` import, no dependencies: whole-word regex
 * building and result-block formatting only, so it can be unit-tested
 * from the smoke test against the compiled `out/usages.js`.
 */

/** One usages match (file + 1-based line + line text + definition flag). */
export interface UsagesMatch {
  file: string;
  line: number;
  text: string;
  isDefinition: boolean;
}

/** Max characters in a formatted usages block before truncation. */
export const USAGES_BLOCK_MAX_CHARS = 20000;
const USAGES_BLOCK_TRUNCATED_SUFFIX = "… (truncated)";
/** Max match lines rendered per file before the "… and K more" line. */
const MAX_MATCHES_PER_FILE = 5;

/**
 * Build a case-sensitive whole-word regex for a code symbol.
 * The symbol is escaped, then wrapped in lookaround boundaries that
 * reject `[A-Za-z0-9_$]` on either side (so `foo` matches `foo()` and
 * `x = foo` but not `foobar` or `foo_bar`).
 *
 * @throws Error when the symbol is empty or whitespace-only.
 */
export function buildUsagesRegex(symbol: string): RegExp {
  if (symbol.trim() === "") {
    throw new Error("symbol is empty");
  }
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    "(?<![A-Za-z0-9_$])" + escaped + "(?![A-Za-z0-9_$])",
  );
}

/**
 * Render usages matches as a stable context block:
 *
 * ```
 * Usages for `symbol`: N reference(s) in M file(s)
 *
 * <file>
 *   def: <line>: <text>
 *   <line>: <text>
 *   … and K more in <file>
 * ```
 *
 * Files appear in first-appearance order; the FIRST match overall is
 * prefixed `def: `. At most 5 match lines per file. The whole block is
 * truncated to `USAGES_BLOCK_MAX_CHARS` chars with a `… (truncated)`
 * suffix. Returns `""` when there are no matches. Pure and testable.
 */
export function formatUsagesBlock(
  symbol: string,
  matches: UsagesMatch[],
): string {
  if (matches.length === 0) {
    return "";
  }
  const files: string[] = [];
  for (const m of matches) {
    if (!files.includes(m.file)) {
      files.push(m.file);
    }
  }
  const lines: string[] = [
    `Usages for \`${symbol}\`: ${matches.length} reference(s) in ${files.length} file(s)`,
    "",
  ];
  for (const file of files) {
    const fileMatches = matches.filter((m) => m.file === file);
    lines.push(file);
    const shown = fileMatches.slice(0, MAX_MATCHES_PER_FILE);
    shown.forEach((m, i) => {
      const prefix = i === 0 && matches[0] === m ? "def: " : "";
      lines.push(`  ${prefix}${m.line}: ${m.text}`);
    });
    const remaining = fileMatches.length - shown.length;
    if (remaining > 0) {
      lines.push(`  … and ${remaining} more in ${file}`);
    }
  }
  const block = lines.join("\n");
  if (block.length <= USAGES_BLOCK_MAX_CHARS) {
    return block;
  }
  return block.slice(0, USAGES_BLOCK_MAX_CHARS) + USAGES_BLOCK_TRUNCATED_SUFFIX;
}
