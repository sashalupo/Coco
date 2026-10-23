/**
 * Pure helpers for OpenAI's `*** Begin Patch` apply-patch edit format (1.100-3).
 *
 * Purity contract (same as `src/prompts.ts` / `src/instructions.ts`): no
 * `vscode` import, no fs — everything here operates on plain strings so it
 * can be unit-tested from the smoke test via `out/patch.js`.
 *
 * Grammar (deviations D1/D2/D3 from the plan):
 * - `*** Begin Patch` … `*** End Patch` (both required, exactly one patch).
 * - Sections: `*** Update File: <path>` and `*** Add File: <path>` only.
 *   `*** Delete File` and rename (`old => new`) are parse errors (D1).
 * - Inside a file section, hunks start with `@@` (optional trailing context
 *   text is ignored). Lines: ` ` (space) = context, `+` = add, `-` = remove.
 *   A line that is exactly `***` is a literal context line (escape). Any
 *   other line starting with `*** ` is a parse error.
 * - Context matching is exact (byte-for-byte, whitespace-sensitive) (D3).
 */

/** One line of a hunk: context (stays), add (inserted), or del (dropped). */
export interface PatchOp {
  kind: "ctx" | "add" | "del";
  /** Line text WITHOUT the leading ` `/`+`/`-` prefix. */
  text: string;
}

/** One file section of a patch. */
export interface PatchFile {
  op: "update" | "add";
  path: string;
  /** Hunks in order; each hunk is its ops in order. */
  hunks: PatchOp[][];
}

/** Normalize a patch path: forward slashes, strip a leading `./`. */
function normalizePath(p: string): string {
  let s = p.replace(/\\/g, "/").trim();
  while (s.startsWith("./")) s = s.slice(2);
  return s;
}

/**
 * Parse an OpenAI `*** Begin Patch` patch string.
 *
 * Throws a descriptive `Error` on: missing `*** Begin Patch` /
 * `*** End Patch`; an unknown `*** ` directive; a second file section
 * naming a different path (one file per patch); a hunk with no `@@`; or a
 * line that is neither ` `/`+`/`-`/`***` prefixed nor a directive.
 */
export function parsePatch(patch: string): { files: PatchFile[] } {
  // Tolerate a single trailing newline after `*** End Patch`.
  const lines = patch.replace(/^\uFEFF/, "").replace(/\n$/, "").split("\n");
  let i = 0;
  const next = (): string | undefined => (i < lines.length ? lines[i++] : undefined);

  if (next() !== "*** Begin Patch") {
    throw new Error("patch must start with '*** Begin Patch'");
  }

  const files: PatchFile[] = [];
  let current: PatchFile | null = null;
  let hunk: PatchOp[] | null = null;

  const closeHunk = (): void => {
    if (hunk !== null) {
      if (hunk.length === 0) {
        throw new Error("hunk with no lines after '@@'");
      }
      if (current) current.hunks.push(hunk);
      hunk = null;
    }
  };

  for (;;) {
    const line = next();
    if (line === undefined) {
      throw new Error("patch is missing '*** End Patch'");
    }
    if (line === "*** End Patch") {
      closeHunk();
      if (!current) {
        throw new Error("patch contains no file section");
      }
      return { files };
    }
    if (line === "*** Begin Patch") {
      throw new Error("nested '*** Begin Patch' is not allowed");
    }

    if (line.startsWith("*** ")) {
      // A directive (a bare `***` literal context line is handled below).
      closeHunk();
      const m = line.match(/^\*\*\* (Update File|Add File|Delete File): (.+)$/);
      if (!m) {
        throw new Error(`unknown patch directive: ${line}`);
      }
      const kind = m[1];
      let rawPath = m[2].trim();
      if (rawPath.includes(" => ")) {
        throw new Error(
          "rename sections ('old => new') are not supported — one file per patch",
        );
      }
      if (kind === "Delete File") {
        throw new Error("'*** Delete File' sections are not supported");
      }
      const path = normalizePath(rawPath);
      if (files.length > 0 && files[0].path !== path) {
        throw new Error(
          `one file per patch: sections name both '${files[0].path}' and '${path}'`,
        );
      }
      current = { op: kind === "Add File" ? "add" : "update", path, hunks: [] };
      files.push(current);
      continue;
    }

    if (!current) {
      throw new Error(`line before any file section: ${line}`);
    }

    if (line === "***") {
      // Literal context line (the standard escape).
      if (hunk === null) {
        throw new Error("hunk line before '@@'");
      }
      hunk.push({ kind: "ctx", text: "***" });
      continue;
    }

    if (line.startsWith("@@")) {
      closeHunk();
      hunk = [];
      continue;
    }

    if (hunk === null) {
      throw new Error(`hunk line before '@@': ${line}`);
    }

    const prefix = line.charAt(0);
    if (prefix === " " || prefix === "+" || prefix === "-") {
      hunk.push({
        kind: prefix === " " ? "ctx" : prefix === "+" ? "add" : "del",
        text: line.slice(1),
      });
      continue;
    }

    throw new Error(
      `invalid patch line (expected ' ', '+', '-' or '***' prefix): ${line}`,
    );
  }
}

/**
 * Apply a single file section's hunks to `oldContent`, sequentially against
 * the evolving content. Context matching is exact (byte-for-byte,
 * whitespace-sensitive); context lines need not be contiguous — lines
 * between them in the file are preserved untouched.
 *
 * Throws on 0 matches (`context not found`) or >1 matches
 * (`context is not unique`), naming the 1-based hunk index.
 */
export function applyPatchToContent(oldContent: string, file: PatchFile): string {
  let content = oldContent;
  file.hunks.forEach((hunk, idx) => {
    const n = idx + 1;
    const ctxOps = hunk.filter((o) => o.kind === "ctx");
    const ctxTexts = ctxOps.map((o) => o.text);

    // Find all start positions where the full context sequence matches in
    // order (non-contiguous allowed).
    const matches: number[] = [];
    if (ctxTexts.length === 0) {
      matches.push(0);
    } else {
      const lines = content.split("\n");
      for (let start = 0; start < lines.length; start++) {
        if (lines[start] !== ctxTexts[0]) continue;
        let pos = start;
        let ok = true;
        for (let k = 1; k < ctxTexts.length; k++) {
          let found = -1;
          for (let j = pos + 1; j < lines.length; j++) {
            if (lines[j] === ctxTexts[k]) {
              found = j;
              break;
            }
          }
          if (found === -1) {
            ok = false;
            break;
          }
          pos = found;
        }
        if (ok) matches.push(start);
      }
    }

    if (matches.length === 0) {
      throw new Error(
        `hunk ${n}: context not found in ${file.path} — re-read the file and copy the exact context lines (including whitespace and indentation).`,
      );
    }
    if (matches.length > 1) {
      throw new Error(
        `hunk ${n}: context is not unique in ${file.path} (${matches.length} matches) — add more context lines to disambiguate.`,
      );
    }

    const start = matches[0];
    const region: string[] = [];
    for (const op of hunk) {
      if (op.kind === "ctx" || op.kind === "add") region.push(op.text);
      // `del` lines drop.
    }
    if (ctxTexts.length === 0) {
      // No context lines (the `*** Add File` case): the hunk IS the content.
      content = region.join("\n");
      return content;
    }
    const lines = content.split("\n");
    // Region = first context line .. last context line (inclusive).
    let firstCtx = start;
    let lastCtx = start;
    let pos = start;
    for (let k = 1; k < ctxTexts.length; k++) {
      for (let j = pos + 1; j < lines.length; j++) {
        if (lines[j] === ctxTexts[k]) {
          pos = j;
          break;
        }
      }
    }
    lastCtx = pos;

    const out = [...lines.slice(0, firstCtx), ...region, ...lines.slice(lastCtx + 1)];
    content = out.join("\n");
  });
  return content;
}

/**
 * Top-level apply: parse the patch, assert exactly one file section whose
 * path equals `path` (normalized: forward slashes, no leading `./`),
 * enforce the existence rule (`add` requires the file NOT to exist;
 * `update` requires it to exist), and delegate to `applyPatchToContent`
 * (empty `oldContent` for `add`).
 */
export function applyPatch(
  patch: string,
  path: string,
  oldContent: string,
  fileExists: boolean,
): string {
  const { files } = parsePatch(patch);
  if (files.length !== 1) {
    throw new Error(`expected exactly one file section, got ${files.length}`);
  }
  const file = files[0];
  const expected = normalizePath(path);
  if (file.path !== expected) {
    throw new Error(
      `patch section names '${file.path}' but the target path is '${expected}'`,
    );
  }
  if (file.op === "add" && fileExists) {
    throw new Error(`'*** Add File' but ${file.path} already exists — use '*** Update File'`);
  }
  if (file.op === "update" && !fileExists) {
    throw new Error(`'*** Update File' but ${file.path} does not exist — use '*** Add File'`);
  }
  return applyPatchToContent(file.op === "add" ? "" : oldContent, file);
}
