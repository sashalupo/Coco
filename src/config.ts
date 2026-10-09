// config.ts — settings access + toolbar override state.
//
// Reads all `llm.*` settings and manages the runtime toolbar overrides
// (Model / Thinking / Context) persisted in a Memento. Pure data access:
// no network, no request building (that lives in request.ts).

import * as vscode from 'vscode';

/** Thinking presets shown in the chat toolbar. */
export type ThinkingLevel = 'off' | 'low' | 'medium' | 'high' | 'max';

/** Maps a toolbar thinking preset to the engine's `reasoning_effort`. */
export const THINKING_TO_EFFORT: Record<ThinkingLevel, string> = {
	off: 'none',
	low: 'low',
	medium: 'medium',
	high: 'high',
	max: 'xhigh',
};

/** Ordered list of thinking presets for the toolbar dropdown. */
export const THINKING_LEVELS: readonly ThinkingLevel[] = [
	'off',
	'low',
	'medium',
	'high',
	'max',
];

/** Context-budget presets shown in the chat toolbar. */
export type ContextLevel = 'auto' | '32k' | '64k' | '128k' | '240k';

/** Maps a context preset to a token budget (0 = auto / unbounded). */
export const CONTEXT_TO_TOKENS: Record<ContextLevel, number> = {
	auto: 0,
	'32k': 32_000,
	'64k': 64_000,
	'128k': 128_000,
	'240k': 240_000,
};

/** Ordered list of context presets for the toolbar dropdown. */
export const CONTEXT_LEVELS: readonly ContextLevel[] = [
	'auto',
	'32k',
	'64k',
	'128k',
	'240k',
];

/** All `llm.*` settings, read as a plain typed object. */
export interface LlmSettings {
	baseUrl: string;
	apiKey: string;
	model: string;
	systemPrompt: string;
	temperature: number;
	topP: number;
	topK: number;
	minP: number;
	presencePenalty: number;
	frequencyPenalty: number;
	seed: string;
	stop: string[];
	maxCompletionTokens: number;
	preserveThinking: boolean;
	stream: boolean;
	includeUsage: boolean;
	responseFormat: string;
	chatTemplateKwargs: Record<string, unknown>;
	toolsEnabled: boolean;
}

/**
 * Read all `llm.*` settings from the workspace configuration.
 * Defaults mirror the `package.json` contribution so the extension behaves
 * sensibly even if a setting is missing.
 */
export function readSettings(): LlmSettings {
	const c = vscode.workspace.getConfiguration('llm');
	return {
		baseUrl: c.get<string>('baseUrl', 'http://localhost:8080'),
		apiKey: c.get<string>('apiKey', ''),
		model: c.get<string>('model', ''),
		systemPrompt: c.get<string>('systemPrompt', ''),
		temperature: c.get<number>('temperature', 1.0),
		topP: c.get<number>('topP', 1.0),
		topK: c.get<number>('topK', 20),
		minP: c.get<number>('minP', 0.0),
		presencePenalty: c.get<number>('presencePenalty', 0),
		frequencyPenalty: c.get<number>('frequencyPenalty', 0),
		seed: c.get<string>('seed', ''),
		stop: c.get<string[]>('stop', []),
		maxCompletionTokens: c.get<number>('maxCompletionTokens', 4096),
		preserveThinking: c.get<boolean>('preserveThinking', false),
		stream: c.get<boolean>('stream', true),
		includeUsage: c.get<boolean>('includeUsage', true),
		responseFormat: c.get<string>('responseFormat', 'text'),
		chatTemplateKwargs: c.get<Record<string, unknown>>('chatTemplateKwargs', {}),
		toolsEnabled: c.get<boolean>('tools.enabled', false),
	};
}

/** Toolbar override state. `model: null` means "use settings / first model". */
export interface ToolbarState {
	model: string | null;
	thinking: ThinkingLevel;
	context: ContextLevel;
}

const DEFAULT_TOOLBAR: ToolbarState = {
	model: null,
	thinking: 'off',
	context: 'auto',
};

const TOOLBAR_KEY = 'llm.toolbar';

/**
 * Persists the runtime toolbar overrides (Model / Thinking / Context) in a
 * Memento so they survive reloads. Reads are synchronous (in-memory); writes
 * are persisted asynchronously by VS Code.
 */
export class ToolbarStateStore {
	private constructor(private readonly memento: vscode.Memento) {}

	/** Create a store backed by the given Memento (usually `context.globalState`). */
	static create(memento: vscode.Memento): ToolbarStateStore {
		return new ToolbarStateStore(memento);
	}

	/** Read the current toolbar state (defaults if never set). */
	get(): ToolbarState {
		return this.memento.get<ToolbarState>(TOOLBAR_KEY, DEFAULT_TOOLBAR);
	}

	/** Override the model. Pass `null` to clear the override. */
	setModel(model: string | null): Thenable<void> {
		return this.memento.update(TOOLBAR_KEY, { ...this.get(), model });
	}

	/** Override the thinking level. */
	setThinking(thinking: ThinkingLevel): Thenable<void> {
		return this.memento.update(TOOLBAR_KEY, { ...this.get(), thinking });
	}

	/** Override the context budget. */
	setContext(context: ContextLevel): Thenable<void> {
		return this.memento.update(TOOLBAR_KEY, { ...this.get(), context });
	}

	/** Reset all overrides back to defaults. */
	reset(): Thenable<void> {
		return this.memento.update(TOOLBAR_KEY, DEFAULT_TOOLBAR);
	}
}
