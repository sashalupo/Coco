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
 * Parse notebook JSON text into a normalized `NbDoc`. Returns `null` on any
 * failure: bad JSON, missing/non-array `cells`, or a cell with a bad shape
 * (wrong `cell_type`, non-string/non-array `source`).
 */
export function parseNotebook(text: string): NbDoc | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.cells)) return null;

  const cells: NbCell[] = [];
  for (const c of obj.cells) {
    if (typeof c !== "object" || c === null) return null;
    const cell = c as Record<string, unknown>;
    if (cell.cell_type !== "code" && cell.cell_type !== "markdown") {
      return null;
    }
    let source: string;
    if (typeof cell.source === "string") {
      source = cell.source;
    } else if (Array.isArray(cell.source)) {
      if (!cell.source.every((s) => typeof s === "string")) return null;
      source = (cell.source as string[]).join("");
    } else {
      return null;
    }
    const out: NbCell = { cell_type: cell.cell_type, source };
    if (Array.isArray(cell.outputs)) {
      out.outputs = cell.outputs;
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

/**
 * Build a minimal valid nbformat-4 notebook JSON string from `source`, which
 * is split on the `<<<CELL>>>` marker line into cells (default type `code`).
 */
export function createNotebook(source: string): string {
  const chunks = source
    .split(new RegExp(`^\\s*${CELL_MARKER}\\s*$`, "gm"))
    .map((s) => s.replace(/^\n+/, ""));
  const cells = chunks.map((src) => ({
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
