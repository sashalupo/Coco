// inline.ts — build + parse inline-completion (ghost text) prompts.
//
// Pure logic module: takes the code around the cursor and formats a focused
// "complete the code" prompt, then parses the model's reply back into a raw
// completion string. No `vscode` import, no network — independently testable.
// The vscode-specific gathering (cursor position, prefix/suffix) lives in the
// InlineCompletionProvider.

/** The code context around the cursor, gathered by the provider. */
export interface CompletionContext {
	/** Language identifier, e.g. "typescript". */
	language: string;
	/** File path (workspace-relative when possible). */
	path: string;
	/** The text before the cursor (what the model should continue). */
	prefix: string;
	/** The text after the cursor (context only, so the model knows what follows). */
	suffix: string;
}

/**
 * Build a focused prompt asking the model to complete the code at the cursor.
 *
 * The prompt includes the language, the file path, the code before the cursor
 * (to be continued), and the code after the cursor (context only). It asks the
 * model to return ONLY the completion, with no explanation or code fences.
 */
export function buildCompletionPrompt(ctx: CompletionContext): string {
	const parts: string[] = [];

	parts.push(`Complete the following ${ctx.language} code.`);
	parts.push(
		'Return ONLY the completion that continues from the cursor — no explanation, ' +
			'no code fences, no repeated code.',
	);

	if (ctx.path) {
		parts.push(`File: ${ctx.path}`);
	}

	parts.push('Code before the cursor:\n```\n' + ctx.prefix + '\n```');

	if (ctx.suffix) {
		parts.push('Code after the cursor (context only, do not repeat):\n```\n' + ctx.suffix + '\n```');
	}

	return parts.join('\n\n');
}

/**
 * Parse the model's reply into a raw completion string.
 *
 * Strips a surrounding markdown code fence (```lang … ```) if present, trims
 * leading/trailing whitespace, and returns the raw completion. Returns an empty
 * string when there is nothing usable (empty input, or only a fence).
 */
export function parseCompletion(text: string): string {
	if (!text) {
		return '';
	}
	let t = text.trim();

	// Strip a leading markdown code fence (```lang … ```).
	const fenceMatch = t.match(/^```[^\n]*\n([\s\S]*?)\n?```/);
	if (fenceMatch) {
		t = fenceMatch[1];
	}
	// Remove any trailing closing fence that was not matched above.
	t = t.replace(/\n?```\s*$/, '');

	return t.trim();
}
