/**
 * notebook.ts — pure Jupyter notebook (.ipynb) helpers for the `notebook_edit`
 * tool (item 1.98-2). No `vscode` import, no dependencies: everything here is
 * plain string/JSON manipulation so it can be unit-tested from the smoke test
 * against the compiled `out/notebook.js`.
 *
 * Cell `source` is normalized to a single string (nbformat allows either a
 * string or an array of strings; we join array sources).
 */

export interface NbCell {
  cell_type: "code" | "markdown";
  source: string;
  outputs?: unknown[];
}

export interface NbDoc {
  cells: NbCell[];
}

/** Marker line that separates cells in the `source` param of `create`. */
export const CELL_MARKER = "<<<CELL>>>";

/**
 * Validate notebook JSON text and return the raw parsed object (all fields
 * preserved). Returns `null` on any failure: bad JSON, missing/non-array
 * `cells`, or a cell with a bad shape (wrong `cell_type`,
 * non-string/non-array `source`).
 */
function parseNotebookRaw(text: string): Record<string, unknown> | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.cells)) return null;
  for (const c of obj.cells) {
    if (typeof c !== "object" || c === null) return null;
    const cell = c as Record<string, unknown>;
    if (cell.cell_type !== "code" && cell.cell_type !== "markdown") {
      return null;
    }
    if (typeof cell.source === "string") continue;
    if (
      Array.isArray(cell.source) &&
      cell.source.every((s) => typeof s === "string")
    ) {
      continue;
    }
    return null;
  }
  return obj;
}

/**
 * Parse notebook JSON text into a normalized `NbDoc`. Returns `null` on any
 * failure: bad JSON, missing/non-array `cells`, or a cell with a bad shape
 * (wrong `cell_type`, non-string/non-array `source`).
 */
export function parseNotebook(text: string): NbDoc | null {
  const raw = parseNotebookRaw(text);
  if (!raw) return null;

  const cells: NbCell[] = [];
  for (const c of raw.cells as Record<string, unknown>[]) {
    let source: string;
    if (typeof c.source === "string") {
      source = c.source;
    } else {
      source = (c.source as string[]).join("");
    }
    const out: NbCell = { cell_type: c.cell_type as "code" | "markdown", source };
    if (Array.isArray(c.outputs)) {
      out.outputs = c.outputs;
    }
    cells.push(out);
  }
  return { cells };
}

/**
 * One-line summary of a cell's outputs, e.g. `outputs: 2 (stream, error)` or
 * `outputs: none`.
 */
function summarizeOutputs(cell: NbCell): string {
  const outputs = cell.outputs;
  if (!outputs || outputs.length === 0) return "outputs: none";
  const kinds: string[] = [];
  for (const o of outputs) {
    if (typeof o === "object" && o !== null) {
      const t = (o as Record<string, unknown>).output_type;
      if (typeof t === "string") {
        if (!kinds.includes(t)) kinds.push(t);
      }
    }
  }
  return kinds.length > 0
    ? `outputs: ${outputs.length} (${kinds.join(", ")})`
    : `outputs: ${outputs.length}`;
}

/**
 * Render a notebook as a human-readable context block: one section per cell
 * with a `### Cell N (code|markdown)` heading, the source in a fenced code
 * block, and a one-line output summary. Returns a clear error string when the
 * text is not a valid notebook.
 */
export function formatNotebookForContext(text: string): string {
  const doc = parseNotebook(text);
  if (!doc) {
    return "Error: could not parse notebook (invalid .ipynb JSON).";
  }
  const parts: string[] = [];
  doc.cells.forEach((cell, i) => {
    const fence = cell.source.includes("```") ? "~~~~" : "```";
    parts.push(
      `### Cell ${i} (${cell.cell_type})\n${fence}\n${cell.source}\n${fence}\n${summarizeOutputs(cell)}`,
    );
  });
  return parts.join("\n\n");
}

/** Next free `cell-N` id that does not collide with existing cell ids. */
function nextCellId(existing: Record<string, unknown>[]): string {
  const taken = new Set(
    existing
      .map((c) => c.id)
      .filter((v): v is string => typeof v === "string"),
  );
  let n = 0;
  while (taken.has(`cell-${n}`)) n++;
  return `cell-${n}`;
}

/**
 * Build a minimal valid nbformat-4 notebook JSON string from `source`, which
 * is split on typed cell markers (`<<<CELL>>>` or `<<<CELL:markdown>>>`) into
 * cells. Cell 0 is always `code`. Each marker starts a new cell of its type
 * (default `code`). Whitespace-only cell sources are dropped.
 * Each cell gets a stable `cell-<index>` id (nbformat 4.5) so diffs can be
 * computed against it.
 */
export function createNotebook(source: string): string {
  // Trailing `[ \t]*` (not `\s*`) so the regex does not consume the newline
  // ending the marker line; `cellStart` skips it explicitly.
  const markerRe = /^\s*<<<CELL(?::(markdown|code))?>>>[ \t]*$/gm;
  const matches = [...source.matchAll(markerRe)];
  const cells: {
    id: string;
    cell_type: "code" | "markdown";
    execution_count: null;
    metadata: Record<string, unknown>;
    outputs: unknown[];
    source: string;
  }[] = [];

  // Index just past the marker line: the regex's trailing `\s*$` backtracks
  // and does not consume the newline ending the marker line, so skip it
  // explicitly to start the cell source on the next line.
  const cellStart = (m: RegExpMatchArray): number => {
    const i0 = (m.index ?? 0) + m[0].length;
    if (source.startsWith("\r\n", i0)) return i0 + 2;
    if (source[i0] === "\n") return i0 + 1;
    return i0;
  };

  // Trim leading newlines (marker line boundary) and trailing newlines
  // (newline ending the line before the next marker).
  const cleanSource = (s: string): string =>
    s.replace(/^\n+/, "").replace(/\n+$/, "");

  if (matches.length === 0) {
    // No markers: single code cell (drop if whitespace-only)
    const src = cleanSource(source);
    if (src.trim().length > 0) {
      cells.push({
        id: `cell-0`,
        cell_type: "code",
        execution_count: null,
        metadata: {},
        outputs: [],
        source: src,
      });
    }
  } else {
    // Cell 0: text before the first marker (always code)
    const src0 = cleanSource(source.slice(0, matches[0].index));
    if (src0.trim().length > 0) {
      cells.push({
        id: `cell-${cells.length}`,
        cell_type: "code",
        execution_count: null,
        metadata: {},
        outputs: [],
        source: src0,
      });
    }
    // Each marker starts a new cell of its type
    for (let i = 0; i < matches.length; i++) {
      const type: "code" | "markdown" =
        matches[i][1] === "markdown" ? "markdown" : "code";
      const start = cellStart(matches[i]);
      const end = i + 1 < matches.length ? matches[i + 1].index : source.length;
      const src = cleanSource(source.slice(start, end));
      if (src.trim().length > 0) {
        cells.push({
          id: `cell-${cells.length}`,
          cell_type: type,
          execution_count: null,
          metadata: {},
          outputs: [],
          source: src,
        });
      }
    }
  }

  const doc = {
    cells,
    metadata: {
      language_info: { name: "python" },
    },
    nbformat: 4,
    nbformat_minor: 5,
  };
  return JSON.stringify(doc, null, 1);
}

/**
 * Build a marker-separated source string for a new notebook from a user query.
 * Produces 3 cells: a markdown title, a markdown objective, and a starter code cell.
 */
export function planNewNotebook(query: string): string {
  const trimmed = query.trim();
  const firstLine = trimmed.split("\n")[0].trim();
  const title = firstLine.length > 0 ? firstLine.slice(0, 80) : "New notebook";
  return (
    `<<<CELL:markdown>>>\n# ${title}\n` +
    `<<<CELL:markdown>>>\n## Objective\n\n${trimmed}\n` +
    `<<<CELL>>>\n# TODO: implement`
  );
}

/**
 * Derive a filesystem-safe notebook name from a query string.
 * First line, lowercased, non-alphanumeric runs → `-`, trimmed dashes, ≤ 40 chars.
 * Falls back to `"notebook"` if the result is empty.
 */
export function notebookNameFromQuery(query: string): string {
  const firstLine = query.trim().split("\n")[0].trim();
  let slug = firstLine
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  if (slug.length === 0) slug = "notebook";
  return slug;
}

/**
 * Apply one `notebook_edit` action to notebook JSON text. Mutates only the
 * `cells` array of the raw doc (all other fields are preserved) and returns
 * the re-serialized notebook as `newContent`. `create` ignores `text` and
 * builds a fresh notebook via `createNotebook`.
 */
export function applyNotebookEdit(
  text: string,
  edit: {
    action: string;
    cellIndex?: number;
    cellType?: "code" | "markdown";
    source?: string;
  },
): { ok: boolean; message: string; newContent?: string } {
  const { action } = edit;

  if (action === "create") {
    const newContent = createNotebook(edit.source ?? "");
    const doc = parseNotebook(newContent);
    const n = doc ? doc.cells.length : 0;
    return {
      ok: true,
      message: `Created notebook with ${n} cell(s).`,
      newContent,
    };
  }

  const raw = parseNotebookRaw(text);
  if (!raw) {
    return {
      ok: false,
      message: "Invalid notebook: could not parse .ipynb JSON.",
    };
  }
  const cells = raw.cells as Record<string, unknown>[];
  const inRange = (idx: unknown): idx is number =>
    typeof idx === "number" && Number.isInteger(idx) && idx >= 0 && idx < cells.length;
  const rangeError = (): { ok: false; message: string } => ({
    ok: false,
    message: `cellIndex out of range: expected an integer in [0, ${cells.length}).`,
  });
  const serialize = (): string => JSON.stringify(raw, null, 1);

  switch (action) {
    case "modify_cell": {
      if (typeof edit.source !== "string") {
        return { ok: false, message: "modify_cell requires a source." };
      }
      if (!inRange(edit.cellIndex)) return rangeError();
      const idx = edit.cellIndex;
      const cell = cells[idx];
      cell.source = edit.source;
      return {
        ok: true,
        message: `Modified cell ${idx} (${cell.cell_type}): ${edit.source.length} chars of source.`,
        newContent: serialize(),
      };
    }
    case "delete_cell": {
      if (!inRange(edit.cellIndex)) return rangeError();
      const idx = edit.cellIndex;
      const [removed] = cells.splice(idx, 1);
      return {
        ok: true,
        message: `Deleted cell ${idx} (${removed.cell_type}). ${cells.length} cells remain.`,
        newContent: serialize(),
      };
    }
    case "change_cell_type": {
      if (edit.cellType !== "code" && edit.cellType !== "markdown") {
        return {
          ok: false,
          message: "change_cell_type requires cellType to be 'code' or 'markdown'.",
        };
      }
      if (!inRange(edit.cellIndex)) return rangeError();
      const idx = edit.cellIndex;
      cells[idx].cell_type = edit.cellType;
      return {
        ok: true,
        message: `Changed cell ${idx} to ${edit.cellType}.`,
        newContent: serialize(),
      };
    }
    case "insert_cell": {
      let idx: number;
      if (edit.cellIndex === undefined) {
        idx = cells.length;
      } else if (typeof edit.cellIndex !== "number" || !Number.isInteger(edit.cellIndex)) {
        return { ok: false, message: "cellIndex must be an integer." };
      } else {
        idx = Math.max(0, Math.min(edit.cellIndex, cells.length));
      }
      const type: "code" | "markdown" =
        edit.cellType === "markdown" ? "markdown" : "code";
      const cell: Record<string, unknown> = {
        id: nextCellId(cells),
        cell_type: type,
        source: edit.source ?? "",
        metadata: {},
      };
      if (type === "code") {
        cell.outputs = [];
        cell.execution_count = null;
      }
      cells.splice(idx, 0, cell);
      return {
        ok: true,
        message: `Inserted ${type} cell at index ${idx}. ${cells.length} cells total.`,
        newContent: serialize(),
      };
    }
    default:
      return { ok: false, message: `Unknown action: ${action}` };
  }
}

/** Cell outputs rendered for chat context: fenced text blocks + image data URLs. */
export interface CellOutputContext {
  text: string;
  images: string[];
}

const OUTPUT_IMAGE_MIMES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
];
const MAX_OUTPUT_IMAGES = 4;
const MAX_IMAGE_BASE64 = 10 * 1024 * 1024;
const MAX_OUTPUT_TEXT = 20000;
const TRUNCATION_MARKER = "\n… [truncated]";

/** Join a nbformat text value (string or string[]) into a single string. */
function joinTextValue(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v.every((s) => typeof s === "string")) {
    return v.join("");
  }
  return "";
}

/**
 * Extract a cell's outputs into chat context (item 1.99-29): non-empty text
 * blocks rendered as `<kind>:\n<fence>\n<content>\n<fence>` (fence is `~~~~`
 * when the content contains triple backticks), joined with `\n\n` and sliced
 * to 20 000 chars + `\n… [truncated]` when cut; image outputs (png/jpeg/gif/
 * webp, ≤ 10 MB base64, capped at 4) as `data:<mime>;base64,<value>` URLs.
 * Pure — no vscode import.
 */
export function extractCellOutputs(cell: NbCell): CellOutputContext {
  const blocks: string[] = [];
  const images: string[] = [];
  const fence = (s: string) => (s.includes("```") ? "~~~~" : "```");
  for (const o of cell.outputs ?? []) {
    if (typeof o !== "object" || o === null) continue;
    const out = o as Record<string, unknown>;
    const type = out.output_type;
    if (type === "stream") {
      // nbformat puts `text` at the top level of stream outputs; also accept
      // a nested `data.text` shape.
      const data =
        typeof out.data === "object" && out.data !== null
          ? (out.data as Record<string, unknown>)
          : {};
      const text = joinTextValue(out.text ?? data.text);
      if (text) {
        blocks.push(`stream:\n${fence(text)}\n${text}\n${fence(text)}`);
      }
    } else if (type === "error") {
      const ename = typeof out.ename === "string" ? out.ename : "Error";
      const evalue = typeof out.evalue === "string" ? out.evalue : "";
      let text = `${ename}: ${evalue}`;
      const tb = Array.isArray(out.traceback) ? out.traceback.slice(0, 10) : [];
      for (const line of tb) {
        const s = joinTextValue(line);
        if (s) text += `\n${s}`;
      }
      blocks.push(`error:\n${fence(text)}\n${text}\n${fence(text)}`);
    } else if (type === "execute_result" || type === "display_data") {
      const data =
        typeof out.data === "object" && out.data !== null
          ? (out.data as Record<string, unknown>)
          : {};
      const text = joinTextValue(data["text/plain"] ?? data["text"]);
      if (text) {
        blocks.push(`${type}:\n${fence(text)}\n${text}\n${fence(text)}`);
      }
      for (const mime of OUTPUT_IMAGE_MIMES) {
        const v = data[mime];
        if (
          typeof v === "string" &&
          images.length < MAX_OUTPUT_IMAGES &&
          v.length <= MAX_IMAGE_BASE64
        ) {
          images.push(`data:${mime};base64,${v}`);
        }
      }
    }
  }
  let text = blocks.join("\n\n");
  if (text.length > MAX_OUTPUT_TEXT) {
    text = text.slice(0, MAX_OUTPUT_TEXT) + TRUNCATION_MARKER;
  }
  return { text, images };
}

/**
 * Structural mirror of `vscode.NotebookCellOutputItem` (item 1.100-30):
 * declared here so this pure module never imports `vscode`. The real
 * `vscode.NotebookCellOutput` is structurally compatible and is cast at the
 * call site in `extension.ts`.
 */
export interface NotebookCellOutputItemLike {
  mime: string;
  data(): Promise<Uint8Array | Buffer>;
}

export interface NotebookCellOutputLike {
  items: NotebookCellOutputItemLike[];
}

const LIVE_OUTPUT_IMAGE_MIMES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/bmp",
];

/**
 * Extract a live notebook cell output into chat context (item 1.100-30):
 * `text/plain` items concatenated (utf-8) into `text`; image items
 * (png/jpeg/gif/webp/bmp) base64-encoded as `data:<mime>;base64,<value>`
 * URLs in `images`; other mimes ignored. Same `{ text, images }` shape as
 * `extractCellOutputs`. Pure — no vscode import.
 */
export async function extractNotebookCellOutput(
  output: NotebookCellOutputLike
): Promise<{ text: string; images: string[] }> {
  const textParts: string[] = [];
  const images: string[] = [];
  for (const item of output.items ?? []) {
    if (!item || typeof item.mime !== "string") continue;
    let bytes: Uint8Array | Buffer;
    try {
      bytes = await item.data();
    } catch {
      continue;
    }
    if (item.mime === "text/plain") {
      const s = Buffer.from(bytes).toString("utf-8");
      if (s) textParts.push(s);
    } else if (LIVE_OUTPUT_IMAGE_MIMES.includes(item.mime)) {
      images.push(`data:${item.mime};base64,${Buffer.from(bytes).toString("base64")}`);
    }
  }
  return { text: textParts.join(""), images };
}
