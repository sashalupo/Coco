/**
 * fetchTool.ts — pure URL-fetching helpers for the `fetch_url` tool
 * (item 1.99-4). No `vscode` import, no dependencies: Node 18+ global
 * `fetch` + hand-rolled HTML→text conversion, so it can be unit-tested
 * from the smoke test against the compiled `out/fetchTool.js` with an
 * injected `fetchFn` (no network required).
 *
 * `fetchUrl` never throws — every failure returns a descriptive error
 * string so the LLM can read it as tool output.
 */

/** Injectable fetch (defaults to the Node 18+ global `fetch`). */
export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/** Default cap on returned characters. */
export const DEFAULT_MAX_CHARS = 20000;
/** Hard cap — model-supplied `maxChars` is clamped to `[1, HARD_MAX_CHARS]`. */
export const HARD_MAX_CHARS = 50000;
/** Cache entry lifetime (10 minutes). */
export const CACHE_TTL_MS = 600_000;
/** Max cached entries (FIFO eviction via Map insertion order). */
export const CACHE_MAX_ENTRIES = 20;

const TIMEOUT_MS = 15000;
const MAX_RESPONSE_BYTES = 2_000_000;

/** Module-level response cache: URL → { text, at }. Successful fetches only. */
const cache = new Map<string, { text: string; at: number }>();

/** Empty the fetch cache. */
export function clearFetchCache(): void {
  cache.clear();
}

/**
 * Convert an HTML document to plain text:
 * - strip `<script>…</script>` and `<style>…</style>` blocks;
 * - turn `<br>` / block-level closing tags into newlines;
 * - remove all remaining tags;
 * - decode the 5 common entities;
 * - collapse 3+ newlines to 2, trim each line, trim the result.
 */
export function htmlToText(html: string): string {
  let t = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  t = t.replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)\s*>/gi, "\n");
  t = t.replace(/<[^>]*>/g, "");
  t = t
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  t = t.replace(/\n{3,}/g, "\n\n");
  t = t
    .split("\n")
    .map((line) => line.trim())
    .join("\n");
  return t.trim();
}

/**
 * Estimate the token count of a text (chars / 3.5, same estimator family
 * as `request.ts`).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

/** Default token budget for fetched pages (~17 500 chars). */
export const DEFAULT_MAX_TOKENS = 5000;

/** Decode the 5 common HTML entities (same set as `htmlToText`). */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Void elements (no closing tag). */
const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "source", "track", "wbr",
]);
/** Elements whose entire content is dropped. */
const DROPPED_TAGS = new Set(["script", "style", "noscript", "template", "head"]);
/** Block-level tags that force a blank line before/after. */
const BLOCK_TAGS = new Set([
  "address", "article", "aside", "blockquote", "dd", "details", "div",
  "dl", "dt", "fieldset", "figcaption", "figure", "footer", "form",
  "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "li", "main",
  "nav", "ol", "p", "pre", "section", "table", "ul",
]);

interface MdToken {
  kind: "open" | "close" | "text";
  tag?: string;
  attrs?: Record<string, string>;
  text?: string;
}

/** Tokenize HTML into open/close/text tokens (comments + doctypes dropped). */
function tokenizeHtml(html: string): MdToken[] {
  const tokens: MdToken[] = [];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>|<([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[5] !== undefined) {
      if (m[5].length > 0) tokens.push({ kind: "text", text: m[5] });
    } else if (m[2] !== undefined) {
      const attrs: Record<string, string> = {};
      const am = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|[^\s"'>]+))?/g;
      let a: RegExpExecArray | null;
      while ((a = am.exec(m[3])) !== null) {
        attrs[a[1].toLowerCase()] = a[3] ?? a[4] ?? (a[2] !== undefined ? a[2].slice(1) : "");
      }
      tokens.push({ kind: "open", tag: m[2].toLowerCase(), attrs });
    } else if (m[1] !== undefined) {
      tokens.push({ kind: "close", tag: m[1].toLowerCase() });
    }
  }
  return tokens;
}

/**
 * Convert an HTML document to Markdown (hand-rolled, no dependencies).
 *
 * Mapping: h1–h6 → `#`–`######`; `a[href]` → `[text](href)`; `img[src]` →
 * `![alt](src)`; `strong`/`b` → `**text**`; `em`/`i` → `*text*`; `code` →
 * backticked; `pre` (with optional `code[language-x]`) → fenced block
 * (```` ``` ```` unless the content contains backticks, then ```` ```` ````);
 * `ul`/`ol`/`li` → `- ` / `1. ` (2-space indent per level, capped at 4);
 * `table`/`tr`/`th`/`td` → pipe rows with a `| --- |` separator after the
 * header row (cells flattened to inline text, `|` escaped as `\|`);
 * `blockquote` → `> ` prefix per line; `hr` → `---`; `br` → newline;
 * `script`/`style`/`noscript`/`template`/`head` → dropped; all other tags →
 * their text content; the 5 common entities decoded.
 *
 * Malformed HTML (unclosed tags) is handled by a stack-based parser that
 * silently pops the stack at mismatched closes and at EOF — never throws.
 */
export function htmlToMarkdown(html: string): string {
  const tokens = tokenizeHtml(html);
  const lines: string[] = [];
  let lastBlank = true;
  const stack: string[] = [];
  const bqPrefixes: string[] = [];
  const listStack: { type: "ul" | "ol"; count: number }[] = [];
  const cellStack: { rows: string[][]; row: string[] | null }[] = [];
  const aStack: (string | undefined)[] = [];
  let pre: { buf: string; lang: string } | null = null;
  let inCode = false;
  let inCell = false;
  let cellBuf = "";
  let liBuf = "";
  let liPrefix = "";
  let liOpen = false;
  let skipDepth = 0;

  const curBq = () => bqPrefixes.join("");
  const curList = () => listStack[listStack.length - 1];
  const curCell = () => cellStack[cellStack.length - 1];

  function emitLine(line: string, block: boolean): void {
    const p = curBq();
    const out = p ? p + line : line;
    if (out.trim().length === 0) {
      if (!lastBlank) lines.push("");
      lastBlank = true;
    } else {
      if (block && !lastBlank) lines.push("");
      lines.push(out);
      lastBlank = false;
    }
  }

  function emitInline(s: string): void {
    if (s.length === 0) return;
    if (pre) {
      pre.buf += s;
      return;
    }
    if (inCell) {
      cellBuf += s;
      return;
    }
    if (liOpen) {
      liBuf += s;
      return;
    }
    if (lastBlank) {
      lines.push(s);
      lastBlank = false;
    } else {
      lines[lines.length - 1] += s;
    }
  }

  function finishLi(): void {
    if (!liOpen) return;
    liOpen = false;
    const content = liBuf.trim();
    liBuf = "";
    if (liPrefix) {
      const p = liPrefix;
      liPrefix = "";
      emitLine(p + content, true);
      return;
    }
    const l = curList();
    const indent = "  ".repeat(Math.min(Math.max(listStack.length - 1, 0), 3));
    const marker = l && l.type === "ol" ? `${l.count}. ` : "- ";
    emitLine(indent + marker + content, true);
  }

  function finishCell(): void {
    if (!inCell) return;
    inCell = false;
    const c = curCell();
    if (c && c.row) c.row.push(cellBuf.trim().replace(/\|/g, "\\|"));
    cellBuf = "";
  }

  function finishRow(): void {
    const c = curCell();
    if (c && c.row) {
      c.rows.push(c.row);
      c.row = null;
    }
  }

  function emitTable(): void {
    const t = cellStack.pop();
    if (!t) return;
    finishRow();
    if (t.rows.length === 0) return;
    const n = Math.max(...t.rows.map((r) => r.length));
    const rows: string[] = [];
    for (const r of t.rows) {
      const cells = r.slice(0, n);
      while (cells.length < n) cells.push("");
      rows.push("| " + cells.join(" | ") + " |");
    }
    rows.splice(1, 0, "| " + Array(n).fill("---").join(" | ") + " |");
    for (const r of rows) emitLine(r, false);
    emitLine("", true);
  }

  function emitPre(): void {
    if (!pre) return;
    const content = pre.buf.replace(/\n$/, "");
    const fence = content.includes("`") ? "````" : "```";
    emitLine(fence + pre.lang, true);
    for (const l of content.split("\n")) emitLine(l, false);
    emitLine(fence, false);
    emitLine("", true);
    pre = null;
  }

  for (const tok of tokens) {
    if (skipDepth > 0) {
      if (tok.kind === "open") skipDepth++;
      else if (tok.kind === "close") skipDepth = Math.max(0, skipDepth - 1);
      continue;
    }
    if (tok.kind === "text") {
      emitInline(decodeEntities(tok.text ?? ""));
      continue;
    }
    if (tok.kind === "open") {
      const tag = tok.tag ?? "";
      if (DROPPED_TAGS.has(tag)) {
        skipDepth = 1;
        continue;
      }
      if (VOID_TAGS.has(tag)) {
        if (tag === "br") {
          if (pre) pre.buf += "\n";
          else if (inCell) cellBuf += "\n";
          else if (liOpen) liBuf += "\n";
          else if (!lastBlank) lines[lines.length - 1] += "\n";
        } else if (tag === "img") {
          const src = tok.attrs?.src ?? "";
          const alt = tok.attrs?.alt ?? "";
          emitInline(`![${alt}](${src})`);
        } else if (tag === "hr") {
          finishLi();
          emitLine("---", true);
        }
        continue;
      }
      if (tag === "pre") {
        finishLi();
        pre = { buf: "", lang: "" };
        continue;
      }
      if (pre) {
        if (tag === "code") {
          const cls = tok.attrs?.class ?? "";
          const lm = /language-([a-zA-Z0-9_+-]+)/.exec(cls);
          if (lm) pre.lang = lm[1];
        }
        stack.push(tag);
        continue;
      }
      if (tag === "code") {
        inCode = true;
        emitInline("`");
        stack.push(tag);
        continue;
      }
      if (tag === "blockquote") {
        finishLi();
        bqPrefixes.push("> ");
        stack.push(tag);
        continue;
      }
      if (tag === "table") {
        finishLi();
        cellStack.push({ rows: [], row: null });
        stack.push(tag);
        continue;
      }
      if (tag === "tr") {
        const c = curCell();
        if (c) {
          finishRow();
          c.row = [];
        }
        stack.push(tag);
        continue;
      }
      if (tag === "th" || tag === "td") {
        finishCell();
        inCell = true;
        cellBuf = "";
        stack.push(tag);
        continue;
      }
      if (tag === "ul" || tag === "ol") {
        finishLi();
        listStack.push({ type: tag, count: 0 });
        stack.push(tag);
        continue;
      }
      if (tag === "li") {
        finishLi();
        const l = curList();
        if (l && l.type === "ol") l.count++;
        liOpen = true;
        liBuf = "";
        stack.push(tag);
        continue;
      }
      if (tag === "a") {
        aStack.push(tok.attrs?.href);
        emitInline("[");
        stack.push(tag);
        continue;
      }
      if (tag === "strong" || tag === "b") {
        emitInline("**");
        stack.push(tag);
        continue;
      }
      if (tag === "em" || tag === "i") {
        emitInline("*");
        stack.push(tag);
        continue;
      }
      if (BLOCK_TAGS.has(tag)) {
        finishLi();
        if (tag.startsWith("h") && tag.length === 2) {
          const level = Number(tag[1]);
          liPrefix = "#".repeat(level) + " ";
          liOpen = true;
          liBuf = "";
        }
        stack.push(tag);
        continue;
      }
      stack.push(tag);
      continue;
    }
    // close tag
    const tag = tok.tag ?? "";
    if (tag === "pre") {
      emitPre();
      const i = stack.lastIndexOf("pre");
      if (i >= 0) stack.length = i;
      else while (stack.length > 0) stack.pop();
      continue;
    }
    if (tag === "code" && inCode) {
      inCode = false;
      emitInline("`");
      const i = stack.lastIndexOf("code");
      if (i >= 0) stack.length = i;
      else while (stack.length > 0) stack.pop();
      continue;
    }
    if (tag === "blockquote") {
      finishLi();
      bqPrefixes.pop();
      const i = stack.lastIndexOf("blockquote");
      if (i >= 0) stack.length = i;
      else while (stack.length > 0) stack.pop();
      continue;
    }
    if (tag === "table") {
      finishCell();
      emitTable();
      const i = stack.lastIndexOf("table");
      if (i >= 0) stack.length = i;
      else while (stack.length > 0) stack.pop();
      continue;
    }
    if (tag === "tr") {
      finishCell();
      finishRow();
      const i = stack.lastIndexOf("tr");
      if (i >= 0) stack.length = i;
      else while (stack.length > 0) stack.pop();
      continue;
    }
    if (tag === "th" || tag === "td") {
      finishCell();
      const i = stack.lastIndexOf(tag);
      if (i >= 0) stack.length = i;
      else while (stack.length > 0) stack.pop();
      continue;
    }
    if (tag === "ul" || tag === "ol") {
      finishLi();
      listStack.pop();
      const i = stack.lastIndexOf(tag);
      if (i >= 0) stack.length = i;
      else while (stack.length > 0) stack.pop();
      continue;
    }
    if (tag === "li") {
      finishLi();
      const i = stack.lastIndexOf("li");
      if (i >= 0) stack.length = i;
      else while (stack.length > 0) stack.pop();
      continue;
    }
    if (tag === "a") {
      const href = aStack.pop();
      if (href !== undefined && href !== "") emitInline(`](${href})`);
      const i = stack.lastIndexOf("a");
      if (i >= 0) stack.length = i;
      else while (stack.length > 0) stack.pop();
      continue;
    }
    if (tag === "strong" || tag === "b") {
      emitInline("**");
      const i = stack.lastIndexOf(tag);
      if (i >= 0) stack.length = i;
      else while (stack.length > 0) stack.pop();
      continue;
    }
    if (tag === "em" || tag === "i") {
      emitInline("*");
      const i = stack.lastIndexOf(tag);
      if (i >= 0) stack.length = i;
      else while (stack.length > 0) stack.pop();
      continue;
    }
    if (BLOCK_TAGS.has(tag)) {
      finishLi();
      const i = stack.lastIndexOf(tag);
      if (i >= 0) stack.length = i;
      else while (stack.length > 0) stack.pop();
      continue;
    }
    // Unknown / mismatched close: silently pop the stack (D1).
    const i = stack.lastIndexOf(tag);
    if (i >= 0) stack.length = i;
    else while (stack.length > 0) stack.pop();
  }
  // EOF: flush any open structures (D1 — never throws).
  if (pre) emitPre();
  finishCell();
  if (cellStack.length > 0) emitTable();
  finishLi();

  let out = lines.join("\n");
  out = out.replace(/\n{3,}/g, "\n\n");
  out = out
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n");
  return out.trim();
}

/** Boilerplate section detector (score 0 = drop first). */
const BOILERPLATE_RE =
  /nav|menu|footer|foot|cookie|privacy|terms|legal|sign ?in|log ?in|log ?out|subscribe|newsletter|copyright|©|social|share|breadcrumb/i;

/**
 * Trim a Markdown document to fit a token budget (estimated via
 * `estimateTokens`).
 *
 * Sections: the preamble before the first `# ` heading is section 0; each
 * `# ` (h1) heading starts a new section (h2–h6 stay inside their parent
 * section). A section is low-relevance (score 0) if its heading text or
 * first non-empty line matches the boilerplate regex; otherwise score 1.
 * Drop order: all score-0 sections first (document order), then score-1
 * sections from the end backwards, until the estimate fits. If even the
 * first score-1 section alone exceeds the budget, it is hard-truncated at
 * `maxTokens * 3.5` chars — the budget is always respected.
 *
 * When anything was dropped the text ends with
 * `\n… [trimmed to fit context window: dropped N section(s)]`; hard
 * truncation only ends with `… [trimmed to fit context window]`.
 */
export function trimToTokenBudget(
  md: string,
  maxTokens: number,
): { text: string; trimmed: boolean } {
  if (estimateTokens(md) <= maxTokens) {
    return { text: md, trimmed: false };
  }
  const lines = md.split("\n");
  const sections: string[][] = [[]];
  for (const line of lines) {
    if (line.startsWith("# ")) {
      sections.push([line]);
    } else {
      sections[sections.length - 1].push(line);
    }
  }
  const score = (sec: string[]): number => {
    const heading = sec[0] ?? "";
    const firstLine = sec.find((l) => l.trim().length > 0) ?? "";
    return BOILERPLATE_RE.test(heading) || BOILERPLATE_RE.test(firstLine)
      ? 0
      : 1;
  };
  const scores = sections.map(score);
  const keep = sections.map(() => true);
  let dropped = 0;
  const fits = (): boolean =>
    estimateTokens(
      keep
        .map((k, i) => (k ? sections[i].join("\n") : ""))
        .filter((s) => s.length > 0)
        .join("\n\n"),
    ) <= maxTokens;
  for (let i = 0; i < sections.length; i++) {
    if (scores[i] === 0 && keep[i]) {
      keep[i] = false;
      dropped++;
    }
  }
  for (let i = sections.length - 1; i >= 0 && !fits(); i--) {
    if (keep[i] && scores[i] === 1) {
      keep[i] = false;
      dropped++;
    }
  }
  if (!fits()) {
    // Even the first score-1 section alone exceeds the budget: hard-truncate.
    const maxChars = Math.floor(maxTokens * 3.5);
    const first = sections[0].join("\n");
    const text =
      first.slice(0, maxChars) + "\n… [trimmed to fit context window]";
    return { text, trimmed: true };
  }
  const text =
    keep
      .map((k, i) => (k ? sections[i].join("\n") : ""))
      .filter((s) => s.length > 0)
      .join("\n\n") +
    `\n… [trimmed to fit context window: dropped ${dropped} section(s)]`;
  return { text, trimmed: true };
}

function clampMaxChars(maxChars: number): number {
  const n = Math.floor(maxChars);
  if (!Number.isFinite(n)) return DEFAULT_MAX_CHARS;
  return Math.min(HARD_MAX_CHARS, Math.max(1, n));
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n… (truncated, showing first ${maxChars} of ${text.length} chars)`;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Fetch a URL and return its content as text (HTML is converted via
 * `htmlToText`). Never throws — failures resolve to a descriptive error
 * string: `Invalid URL: …`, `Fetch failed: …`, `HTTP <status> <statusText>
 * for <url>`, or `Response too large (>2000000 bytes): <url>`.
 *
 * Successful results are cached (10 min TTL, 20 entries FIFO); a cache
 * hit skips the network entirely.
 */
export async function fetchUrl(
  url: string,
  opts?: { maxChars?: number; fetchFn?: FetchFn },
): Promise<string> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return `Invalid URL: ${url}`;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return `Invalid URL: ${url}`;
  }

  const maxChars = clampMaxChars(opts?.maxChars ?? DEFAULT_MAX_CHARS);

  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return truncate(hit.text, maxChars);
  }

  const doFetch: FetchFn = opts?.fetchFn ?? ((u2, init) => fetch(u2, init));

  let res: Response;
  try {
    res = await doFetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    return `Fetch failed: ${errorMessage(e)}`;
  }

  if (!res.ok) {
    return `HTTP ${res.status} ${res.statusText} for ${url}`;
  }

  let buf: ArrayBuffer;
  try {
    buf = await res.arrayBuffer();
  } catch (e) {
    return `Fetch failed: ${errorMessage(e)}`;
  }
  if (buf.byteLength > MAX_RESPONSE_BYTES) {
    return `Response too large (>2000000 bytes): ${url}`;
  }

  const raw = new TextDecoder("utf-8").decode(buf);
  const contentType = res.headers.get("content-type") ?? "";
  const text = contentType.includes("text/html") ? htmlToText(raw) : raw;

  cache.set(url, { text, at: Date.now() });
  while (cache.size > CACHE_MAX_ENTRIES) {
    const first = cache.keys().next();
    if (first.done) break;
    cache.delete(first.value);
  }

  return truncate(text, maxChars);
}
