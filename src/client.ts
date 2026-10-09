// client.ts — LlmClient: talks to the engine over HTTP.
//
// `health()` / `listModels()` (non-streaming) and `chatStream()` (SSE).
// Uses Node 18+ global `fetch` (typed by @types/node) — no runtime deps,
// no `vscode` import.

import type { LlmSettings } from './presets';
import type { ChatCompletionRequest } from './request';

/** A settings provider so the client always reads fresh baseUrl/apiKey. */
export type SettingsProvider = () => LlmSettings;

/** Result of a `GET /health` probe. Never throws; failures set `ok: false`. */
export interface HealthResult {
	ok: boolean;
	status: number;
	statusText: string;
	body: unknown;
	/** Present when the request could not be completed (e.g. engine down). */
	error?: string;
}

/** A single model entry from `GET /v1/models`. */
export interface ModelInfo {
	id: string;
	object?: string;
	owned_by?: string;
	[key: string]: unknown;
}

/** The `GET /v1/models` response envelope. */
export interface ModelListResult {
	data: ModelInfo[];
	object?: string;
}

/** Token usage reported by the engine (usually the final stream chunk). */
export interface UsageInfo {
	prompt_tokens?: number;
	completion_tokens?: number;
	total_tokens?: number;
	[key: string]: unknown;
}

/** One streamed delta yielded by `chatStream()`. */
export interface StreamChunk {
	/** Incremental thinking text (`reasoning_content`). */
	reasoning: string;
	/** Incremental answer text (`content`). */
	content: string;
	/** True on the terminal chunk (the `[DONE]` sentinel, or stream end). */
	done: boolean;
	/** Usage stats, present on the final chunk when `include_usage` is set. */
	usage?: UsageInfo;
}

export class LlmClient {
	constructor(private readonly getSettings: SettingsProvider) {}

	/** Base URL with any trailing slash stripped. */
	private baseUrl(): string {
		return this.getSettings().baseUrl.replace(/\/+$/, '');
	}

	/** Request headers. Adds `Authorization: Bearer …` only when a key is set. */
	private headers(): Record<string, string> {
		const { apiKey } = this.getSettings();
		const h: Record<string, string> = {};
		if (apiKey) {
			h['Authorization'] = `Bearer ${apiKey}`;
		}
		return h;
	}

	/**
	 * Probe `GET /health`. Resolves with a `HealthResult` on every outcome —
	 * network failures resolve with `ok: false` and an `error` message so the
	 * status-bar poll never has to catch.
	 */
	async health(signal?: AbortSignal): Promise<HealthResult> {
		try {
			const res = await fetch(`${this.baseUrl()}/health`, {
				headers: this.headers(),
				signal,
			});
			const body = await res.json().catch(() => null);
			return { ok: res.ok, status: res.status, statusText: res.statusText, body };
		} catch (err) {
			return {
				ok: false,
				status: 0,
				statusText: 'unreachable',
				body: null,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}

	/**
	 * Fetch `GET /v1/models`. Resolves with the model list, or throws an
	 * `Error` on a non-2xx response or network failure (callers surface it).
	 */
	async listModels(signal?: AbortSignal): Promise<ModelListResult> {
		const res = await fetch(`${this.baseUrl()}/v1/models`, {
			headers: this.headers(),
			signal,
		});
		if (!res.ok) {
			throw new Error(`listModels failed: ${res.status} ${res.statusText}`);
		}
		return (await res.json()) as ModelListResult;
	}

	/**
	 * POST `/v1/chat/completions` with `stream: true` and yield SSE deltas.
	 *
	 * Each yielded `StreamChunk` carries incremental `reasoning`
	 * (`reasoning_content`) and `content` text. The terminal chunk has
	 * `done: true` (the `[DONE]` sentinel, or a synthetic one if the stream
	 * ends without it). `usage` is surfaced on the final chunk when the
	 * engine reports it. Throws on a non-2xx response or network failure.
	 */
	async *chatStream(
		body: ChatCompletionRequest,
		signal?: AbortSignal,
	): AsyncGenerator<StreamChunk> {
		const payload: ChatCompletionRequest = { ...body, stream: true };
		const res = await fetch(`${this.baseUrl()}/v1/chat/completions`, {
			method: 'POST',
			headers: { ...this.headers(), 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
			signal,
		});
		if (!res.ok || !res.body) {
			const text = await res.text().catch(() => '');
			throw new Error(
				`chatStream failed: ${res.status} ${res.statusText}${text ? ` ${text}` : ''}`.trim(),
			);
		}

		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';
		let emittedDone = false;
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					break;
				}
				buffer += decoder.decode(value, { stream: true });
				let m: RegExpExecArray | null;
				while ((m = /\r?\n/.exec(buffer)) !== null) {
					const line = buffer.slice(0, m.index);
					buffer = buffer.slice(m.index + m[0].length);
					const chunk = this.parseSseLine(line);
					if (chunk) {
						if (chunk.done) {
							emittedDone = true;
						}
						yield chunk;
					}
				}
			}
			// Flush trailing bytes and a final line lacking a newline.
			buffer += decoder.decode();
			if (buffer.length > 0) {
				const chunk = this.parseSseLine(buffer);
				if (chunk) {
					if (chunk.done) {
						emittedDone = true;
					}
					yield chunk;
				}
			}
			if (!emittedDone) {
				yield { reasoning: '', content: '', done: true };
			}
		} finally {
			reader.releaseLock();
		}
	}

	/** Parse one SSE line into a `StreamChunk`, or null if it is not a `data:` line. */
	private parseSseLine(line: string): StreamChunk | null {
		const trimmed = line.trim();
		if (!trimmed.startsWith('data:')) {
			return null;
		}
		const data = trimmed.slice(5).trim();
		if (data === '[DONE]') {
			return { reasoning: '', content: '', done: true };
		}
		if (data.length === 0) {
			return null;
		}
		let parsed: any;
		try {
			parsed = JSON.parse(data);
		} catch {
			return null;
		}
		const delta = parsed?.choices?.[0]?.delta ?? {};
		const reasoning = typeof delta.reasoning_content === 'string' ? delta.reasoning_content : '';
		const content = typeof delta.content === 'string' ? delta.content : '';
		const usage = parsed?.usage as UsageInfo | undefined;
		return { reasoning, content, done: false, usage };
	}
}
