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
