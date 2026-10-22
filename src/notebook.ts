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
 * is split on the `<<<CELL>>>` marker line into cells (default type `code`).
 * Each cell gets a stable `cell-<index>` id (nbformat 4.5) so diffs can be
 * computed against it.
 */
export function createNotebook(source: string): string {
  const chunks = source
    .split(new RegExp(`^\\s*${CELL_MARKER}\\s*$`, "gm"))
    .map((s) => s.replace(/^\n+/, ""));
  const cells = chunks.map((src, i) => ({
    id: `cell-${i}`,
    cell_type: "code",
    execution_count: null,
    metadata: {},
    outputs: [],
    source: src,
  }));
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
