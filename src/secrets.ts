// secrets.ts — pure secret-scanning helper (no vscode, no deps).
//
// Scans text (typically a staged git diff) for secret-like patterns so the
// "Commit changes" command can refuse to commit credentials. Kept pure so it
// stays testable under plain Node. This is a best-effort heuristic, not a
// guarantee — it catches common, high-signal patterns.

/** A single secret match found in the scanned text. */
export interface SecretMatch {
  /** 1-based line number where the match was found. */
  line: number;
  /** Human-readable name of the pattern that matched. */
  pattern: string;
  /** The matched substring (truncated for display). */
  match: string;
}

/** High-signal secret patterns. Order matters only for reporting. */
const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "OpenAI key", re: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  {
    name: "Private key block",
    re: /-----BEGIN (?:RSA|EC|OPENSSH|DSA|PGP) PRIVATE KEY-----/,
  },
  { name: "Bearer token", re: /\bBearer\s+[A-Za-z0-9\-_.]{20,}\b/ },
  {
    name: "credential assignment",
    re: /\b(password|passwd|pwd|secret|api_?key|access_?token|auth_?token)\b\s*[:=]\s*['"][^'"\s]{8,}['"]/i,
  },
];

/** Truncate a matched secret for safe display (keep a short prefix). */
function truncate(s: string): string {
  return s.length > 24 ? s.slice(0, 24) + "…" : s;
}

/**
 * Scan text line-by-line for secret-like patterns. Returns one entry per
 * match (a line can match multiple patterns). Returns `[]` when nothing is
 * found.
 */
export function scanForSecrets(text: string): SecretMatch[] {
  const out: SecretMatch[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const p of SECRET_PATTERNS) {
      const m = p.re.exec(lines[i]);
      if (m) {
        out.push({ line: i + 1, pattern: p.name, match: truncate(m[0]) });
      }
    }
  }
  return out;
}
