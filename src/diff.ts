// diff.ts — pure unified-diff helper (no vscode, no deps).
//
// Hand-rolled line diff used to preview file mutations (write_file /
// edit_file). Produces a unified diff (`---` / `+++` / `@@` hunks with
// `+` / `-` / ` ` prefixed lines). Returns "" when the two texts are
// identical. Kept pure so it stays testable under plain Node.

/** Max LCS DP cells before falling back to a full-replace diff. */
const MAX_DIFF_CELLS = 1_000_000;
/** Lines of context shown around each change in a hunk. */
const CONTEXT = 3;

/** A single diff operation on one line. */
interface Op {
  type: "equal" | "del" | "ins";
  line: string;
}

/**
 * Compute a unified diff between two texts.
 * Returns `""` when `oldText === newText`.
 */
export function unifiedDiff(
  oldText: string,
  newText: string,
  oldLabel = "a",
  newLabel = "b",
): string {
  if (oldText === newText) {
    return "";
  }
  const a = splitLines(oldText);
  const b = splitLines(newText);
  const ops = diffLines(a, b);
  return formatUnified(ops, oldLabel, newLabel);
}

/** Split text into lines (a trailing newline yields a final empty line). */
function splitLines(text: string): string[] {
  if (text === "") {
    return [];
  }
  return text.split(/\r?\n/);
}

/**
 * Compute the line operations (equal/del/ins) that turn `a` into `b` using
 * an LCS dynamic program. Falls back to a full-replace diff when the DP
 * table would be too large.
 */
function diffLines(a: string[], b: string[]): Op[] {
  const n = a.length;
  const m = b.length;
  if (n * m > MAX_DIFF_CELLS) {
    const ops: Op[] = [];
    for (const line of a) {
      ops.push({ type: "del", line });
    }
    for (const line of b) {
      ops.push({ type: "ins", line });
    }
    return ops;
  }
  // LCS table (n+1) x (m+1), filled bottom-up.
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  // Backtrack to emit operations.
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: "equal", line: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: "del", line: a[i] });
      i++;
    } else {
      ops.push({ type: "ins", line: b[j] });
      j++;
    }
  }
  while (i < n) {
    ops.push({ type: "del", line: a[i++] });
  }
  while (j < m) {
    ops.push({ type: "ins", line: b[j++] });
  }
  return ops;
}

/**
 * Format operations as a unified diff, grouping changes into hunks with
 * `CONTEXT` lines of surrounding context.
 */
function formatUnified(
  ops: Op[],
  oldLabel: string,
  newLabel: string,
): string {
  const n = ops.length;
  // Mark which ops fall within a hunk (a change plus its context).
  const include = new Array<boolean>(n).fill(false);
  for (let k = 0; k < n; k++) {
    if (ops[k].type !== "equal") {
      const lo = Math.max(0, k - CONTEXT);
      const hi = Math.min(n - 1, k + CONTEXT);
      for (let c = lo; c <= hi; c++) {
        include[c] = true;
      }
    }
  }
  const out: string[] = [`--- ${oldLabel}`, `+++ ${newLabel}`];
  let oldNo = 1;
  let newNo = 1;
  let k = 0;
  while (k < n) {
    // Skip a run of excluded (context-free) equal lines, advancing numbers.
    if (!include[k]) {
      while (k < n && !include[k]) {
        if (ops[k].type === "equal") {
          oldNo++;
          newNo++;
        }
        k++;
      }
      continue;
    }
    // Start of a hunk.
    const hunkStartOld = oldNo;
    const hunkStartNew = newNo;
    let oldCount = 0;
    let newCount = 0;
    const body: string[] = [];
    while (k < n && include[k]) {
      const op = ops[k];
      if (op.type === "equal") {
        body.push(` ${op.line}`);
        oldCount++;
        newCount++;
        oldNo++;
        newNo++;
      } else if (op.type === "del") {
        body.push(`-${op.line}`);
        oldCount++;
        oldNo++;
      } else {
        body.push(`+${op.line}`);
        newCount++;
        newNo++;
      }
      k++;
    }
    out.push(`@@ -${hunkStartOld},${oldCount} +${hunkStartNew},${newCount} @@`);
    out.push(...body);
  }
  return out.join("\n");
}
