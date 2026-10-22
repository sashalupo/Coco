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
