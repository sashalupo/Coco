/**
 * Tool sets — pure parsing/resolution helpers for `.vscode/toolsets.json`.
 *
 * A tool set is a named group of tool names. Chat can reference a set via a
 * `#toolset:<name>` tag or the toolbar "Tools" picker; the resolved tool list
 * feeds the existing `RequestConfig.promptTools` filter in `buildRequestBody`.
 *
 * This module is pure: no `vscode` import, no I/O.
 */

/** A single named tool set. */
export interface Toolset {
	name: string;
	description?: string;
	tools: string[];
}

/** Shape of the `.vscode/toolsets.json` file. */
export interface ToolsetsFile {
	toolsets: Record<string, { description?: string; tools: string[] }>;
}

/** Result of a tolerant parse: valid entries plus per-entry/parse errors. */
export interface ParseToolsetsResult {
	toolsets: Toolset[];
	errors: string[];
}

/**
 * Strip `//` line comments, line by line. A `//` inside a JSON string literal
 * is left alone; a `//` outside strings starts a comment to end of line.
 * (The scaffold only uses line comments, so this is sufficient.)
 */
function stripLineComments(text: string): string {
	const lines = text.split('\n');
	const out: string[] = [];
	for (const line of lines) {
		let inString = false;
		let cut = -1;
		for (let i = 0; i < line.length; i++) {
			const ch = line[i];
			if (inString) {
				if (ch === '\\') {
					i++; // skip escaped char
				} else if (ch === '"') {
					inString = false;
				}
			} else if (ch === '"') {
				inString = true;
			} else if (ch === '/' && line[i + 1] === '/') {
				cut = i;
				break;
			}
		}
		out.push(cut >= 0 ? line.slice(0, cut) : line);
	}
	return out.join('\n');
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/**
 * Tolerantly parse toolsets JSON text.
 *
 * - Strips `//` line comments before `JSON.parse`.
 * - On JSON parse failure: `{ toolsets: [], errors: [message] }` (never throws).
 * - Validates shape: top-level object with a `toolsets` object; each entry must
 *   have `tools` as a string array. Per-entry problems are collected as errors
 *   (e.g. `"toolset 'x': 'tools' must be an array of strings"`); valid entries
 *   still parse even if others are invalid.
 */
export function parseToolsetsJson(text: string): ParseToolsetsResult {
	let raw: unknown;
	try {
		raw = JSON.parse(stripLineComments(text));
	} catch (err) {
		return { toolsets: [], errors: [err instanceof Error ? err.message : String(err)] };
	}

	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return { toolsets: [], errors: ['top-level value must be an object'] };
	}

	const obj = raw as Record<string, unknown>;
	if (typeof obj.toolsets !== 'object' || obj.toolsets === null || Array.isArray(obj.toolsets)) {
		return { toolsets: [], errors: ["'toolsets' must be an object"] };
	}

	const toolsets: Toolset[] = [];
	const errors: string[] = [];
	for (const [name, entry] of Object.entries(obj.toolsets as Record<string, unknown>)) {
		if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
			errors.push(`toolset '${name}': entry must be an object`);
			continue;
		}
		const e = entry as Record<string, unknown>;
		if (!isStringArray(e.tools)) {
			errors.push(`toolset '${name}': 'tools' must be an array of strings`);
			continue;
		}
		const toolset: Toolset = { name, tools: e.tools };
		if (typeof e.description === 'string') {
			toolset.description = e.description;
		}
		toolsets.push(toolset);
	}
	return { toolsets, errors };
}

/**
 * Case-insensitive lookup of a tool set by name.
 * Returns the set's `tools` array, or `null` when no set matches.
 */
export function resolveToolset(toolsets: Toolset[], name: string): string[] | null {
	const wanted = name.toLowerCase();
	for (const ts of toolsets) {
		if (ts.name.toLowerCase() === wanted) {
			return ts.tools;
		}
	}
	return null;
}

/**
 * Scaffold JSON for `.vscode/toolsets.json`: a `//`-commented example set
 * plus a short comment explaining the shape. Parseable by
 * `parseToolsetsJson` (comments are stripped).
 */
export function buildToolsetsExample(): string {
	return [
		'{',
		'  // Tool sets: named groups of tool names.',
		'  // Reference a set in chat with #toolset:<name> or the toolbar "Tools" picker.',
		'  // Shape: { "toolsets": { "<name>": { "description": "...", "tools": ["tool_a", "tool_b"] } } }',
		'  "toolsets": {',
		'    "gh-news": {',
		'      "description": "GitHub news gathering tools",',
		'      "tools": ["fetch_url", "run_command"]',
		'    }',
		'  }',
		'}',
		'',
	].join('\n');
}
