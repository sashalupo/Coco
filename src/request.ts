// request.ts — build the /v1/chat/completions request body.
//
// Pure logic module: merges `settings ← toolbar overrides` into the final
// request body, estimates token usage, and trims history to fit the context
// budget. No `vscode` import, no network — independently testable.

import {
	CONTEXT_TO_TOKENS,
	THINKING_TO_EFFORT,
	type LlmSettings,
	type ToolbarState,
} from './presets';
import { CODE_TOOLS, type Tool, type ToolCall } from './tools';

/** A single chat message. `reasoning_content` carries the thinking block. */
export interface ChatMessage {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string;
	reasoning_content?: string;
	/** Present on `role: 'tool'` messages: the id of the tool call being answered. */
	tool_call_id?: string;
	/** Present on `role: 'assistant'` messages that request tool calls. */
	tool_calls?: ToolCall[];
}

/** The merged configuration: base settings + runtime toolbar overrides. */
export interface RequestConfig {
	settings: LlmSettings;
	toolbar: ToolbarState;
}

/** The JSON body sent to POST /v1/chat/completions. */
export interface ChatCompletionRequest {
	model?: string;
	messages: ChatMessage[];
	temperature?: number;
	top_p?: number;
	top_k?: number;
	min_p?: number;
	presence_penalty?: number;
	frequency_penalty?: number;
	seed?: number;
	stop?: string[];
	max_completion_tokens?: number;
	preserve_thinking?: boolean;
	stream?: boolean;
	stream_options?: { include_usage: boolean };
	response_format?: { type: string };
	chat_template_kwargs?: Record<string, unknown>;
	reasoning_effort?: string;
	enable_thinking?: boolean;
	/** Function-calling tools the model may invoke (Phase 4). */
	tools?: Tool[];
	/** Tool-choice hint (`auto` / `none` / a specific function name). */
	tool_choice?: string;
}

/** Result of building a request: the body + whether history was trimmed. */
export interface BuildResult {
	body: ChatCompletionRequest;
	trimmed: boolean;
	budgetTokens: number;
}

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

/** Rough chars-per-token heuristic (no tokenizer dependency). */
const CHARS_PER_TOKEN = 3.5;

/** Per-message overhead (role, delimiters, separators). */
const MESSAGE_OVERHEAD = 4;

/** Estimate the token count of a plain string. */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Estimate the token count of a single message (content + thinking). */
export function estimateMessageTokens(message: ChatMessage): number {
	const content = message.content ?? '';
	const reasoning = message.reasoning_content ?? '';
	return MESSAGE_OVERHEAD + estimateTokens(content) + estimateTokens(reasoning);
}

/** Estimate the total token count of a message list. */
export function estimateMessagesTokens(messages: ChatMessage[]): number {
	return messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
}

// ---------------------------------------------------------------------------
// History trimming
// ---------------------------------------------------------------------------

/**
 * Trim the oldest history so the message list fits `budgetTokens`.
 *
 * - Leading `system` message(s) are always kept.
 * - The most recent message (the latest user turn) is always kept.
 * - Messages are dropped from the front of the history (oldest first) until
 *   the total is under budget, or only the latest message remains.
 *
 * A `budgetTokens` of `0` (the `auto` preset) disables trimming.
 */
export function trimHistory(
	messages: ChatMessage[],
	budgetTokens: number,
): { messages: ChatMessage[]; trimmed: boolean } {
	if (budgetTokens <= 0 || messages.length === 0) {
		return { messages, trimmed: false };
	}
	if (estimateMessagesTokens(messages) <= budgetTokens) {
		return { messages, trimmed: false };
	}

	// Split off leading system message(s).
	let systemEnd = 0;
	while (systemEnd < messages.length && messages[systemEnd].role === 'system') {
		systemEnd++;
	}
	const system = messages.slice(0, systemEnd);
	const history = messages.slice(systemEnd);

	if (history.length <= 1) {
		// Nothing to trim (only the latest turn, or just system).
		return { messages, trimmed: false };
	}

	// Drop oldest history messages, always keeping the last one.
	let start = 0;
	while (
		start < history.length - 1 &&
		estimateMessagesTokens([...system, ...history.slice(start)]) > budgetTokens
	) {
		start++;
	}
	return { messages: [...system, ...history.slice(start)], trimmed: start > 0 };
}

// ---------------------------------------------------------------------------
// Request builder
// ---------------------------------------------------------------------------

/**
 * Build the final request body by merging `settings ← toolbar overrides`.
 *
 * - `model`: toolbar override wins, else `llm.model`; omitted when empty so
 *   the engine can pick its default/first model.
 * - `thinking`: toolbar preset → `reasoning_effort`; `off` omits
 *   `enable_thinking`, any other level sets `enable_thinking: true`.
 * - `context`: toolbar preset → token budget used to trim history.
 */
export function buildRequestBody(
	cfg: RequestConfig,
	messages: ChatMessage[],
): BuildResult {
	const { settings, toolbar } = cfg;

	const budgetTokens = CONTEXT_TO_TOKENS[toolbar.context];
	const { messages: trimmedMessages, trimmed } = trimHistory(messages, budgetTokens);

	const body: ChatCompletionRequest = {
		messages: trimmedMessages,
		temperature: settings.temperature,
		top_p: settings.topP,
		top_k: settings.topK,
		min_p: settings.minP,
		presence_penalty: settings.presencePenalty,
		frequency_penalty: settings.frequencyPenalty,
		max_completion_tokens: settings.maxCompletionTokens,
		preserve_thinking: settings.preserveThinking,
		stream: settings.stream,
	};

	// Model: toolbar override wins, else settings. Omit when empty.
	const model = toolbar.model ?? settings.model;
	if (model) {
		body.model = model;
	}

	// Seed: only when set and numeric.
	if (settings.seed) {
		const n = Number(settings.seed);
		if (Number.isFinite(n)) {
			body.seed = n;
		}
	}

	// Stop: only when non-empty (engine caps at 4).
	if (settings.stop.length > 0) {
		body.stop = settings.stop.slice(0, 4);
	}

	// stream_options.include_usage only when streaming.
	if (settings.stream && settings.includeUsage) {
		body.stream_options = { include_usage: true };
	}

	// response_format only when not plain text.
	if (settings.responseFormat && settings.responseFormat !== 'text') {
		body.response_format = { type: settings.responseFormat };
	}

	// chat_template_kwargs only when non-empty.
	if (settings.chatTemplateKwargs && Object.keys(settings.chatTemplateKwargs).length > 0) {
		body.chat_template_kwargs = settings.chatTemplateKwargs;
	}

	// Thinking → reasoning_effort (+ enable_thinking when on).
	body.reasoning_effort = THINKING_TO_EFFORT[toolbar.thinking];
	if (toolbar.thinking !== 'off') {
		body.enable_thinking = true;
	}

	// Tools: expose the workspace tools when tool calling is enabled.
	if (settings.toolsEnabled) {
		body.tools = CODE_TOOLS;
		body.tool_choice = 'auto';
	}

	return { body, trimmed, budgetTokens };
}
