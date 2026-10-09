// client.ts — LlmClient: talks to the engine over HTTP.
//
// Part 1: non-streaming `health()` and `listModels()`. Part 2 (S5) adds
// `chatStream()`. Uses Node 18+ global `fetch` (typed by @types/node) — no
// runtime deps, no `vscode` import.

import type { LlmSettings } from './presets';

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
}
