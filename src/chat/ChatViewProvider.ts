// ChatViewProvider.ts — the chat panel's WebviewViewProvider.
//
// S7: builds the webview (via buildWebviewHtml) and round-trips a basic
// `hello`/`ready` message between the webview and the host. The webview posts
// `{type:'ready'}` on load; the host replies with `{type:'hello'}`. Later
// steps (S9–S11) extend `onDidReceiveMessage` with the real chat/toolbar flow.

import * as vscode from 'vscode';
import { buildWebviewHtml } from './webview';
import { LlmClient } from '../client';
import { readSettings, ToolbarStateStore } from '../config';
import { buildRequestBody, type ChatMessage } from '../request';
import type { ContextLevel, ThinkingLevel, ToolbarState } from '../presets';

/** Messages the webview sends to the host. */
export interface WebviewToHostMessage {
	type: string;
	[key: string]: unknown;
}

/** Messages the host sends to the webview. */
export interface HostToWebviewMessage {
	type: string;
	[key: string]: unknown;
}

export class ChatViewProvider implements vscode.WebviewViewProvider {
	public readonly viewType = 'llm.chat';

	/** The resolved webview (set in `resolveWebviewView`). */
	private webview?: vscode.Webview;

	/** Conversation history (user/assistant turns). */
	private history: ChatMessage[] = [];

	/** Persisted toolbar overrides (Model/Thinking/Context). */
	private readonly toolbarStore: ToolbarStateStore;

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly client: LlmClient
	) {
		this.toolbarStore = ToolbarStateStore.create(context.globalState);
	}

	/**
	 * Resolve the webview: set its HTML and wire the message handler.
	 * `retainContextWhenHidden` keeps the webview alive when the panel is
	 * hidden so chat history is not lost.
	 */
	public resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.webview = webviewView.webview;
		webviewView.webview.options = {
			enableScripts: true,
			enableForms: true,
		};
		webviewView.webview.html = buildWebviewHtml();

		webviewView.webview.onDidReceiveMessage((msg: WebviewToHostMessage) => {
			this.onMessage(msg);
		});
	}

	/**
	 * Handle a message from the webview. `ready` → `hello` (S7); `send` →
	 * stream a chat completion (S9). Toolbar handling is added in S10.
	 */
	private onMessage(msg: WebviewToHostMessage): void {
		switch (msg.type) {
			case 'ready':
				// Round-trip: acknowledge the webview is up, then sync the
				// persisted toolbar state into the dropdowns.
				this.postMessage({ type: 'hello', message: 'LLM chat panel ready' });
				this.pushToolbarState();
				break;
			case 'send':
				void this.handleSend(String(msg.text ?? ''));
				break;
			case 'toolbar':
				this.applyToolbarMessage(msg);
				break;
			default:
				// Unknown message types are ignored for now.
				break;
		}
	}

	/** Push the persisted toolbar state to the webview (model `null` → `''`). */
	private pushToolbarState(): void {
		const t = this.toolbarStore.get();
		this.postMessage({
			type: 'toolbar',
			model: t.model ?? '',
			thinking: t.thinking,
			context: t.context,
		});
	}

	/** Persist a toolbar change posted by the webview. */
	private applyToolbarMessage(msg: WebviewToHostMessage): void {
		const rawModel = msg.model == null ? '' : String(msg.model);
		const thinking = (String(msg.thinking ?? 'off')) as ThinkingLevel;
		const context = (String(msg.context ?? 'auto')) as ContextLevel;
		void this.toolbarStore.setModel(rawModel === '' ? null : rawModel);
		void this.toolbarStore.setThinking(thinking);
		void this.toolbarStore.setContext(context);
	}

	/**
	 * Send a user message and stream the assistant's reply back to the webview.
	 * Uses the settings + the persisted toolbar overrides (model/thinking/
	 * context) so the dropdowns feed the next request body.
	 */
	private async handleSend(text: string): Promise<void> {
		if (!text) {
			return;
		}
		const settings = readSettings();
		const toolbar: ToolbarState = this.toolbarStore.get();

		this.history.push({ role: 'user', content: text });

		const withSystem: ChatMessage[] = settings.systemPrompt
			? [{ role: 'system', content: settings.systemPrompt }, ...this.history]
			: [...this.history];

		const { body, trimmed } = buildRequestBody({ settings, toolbar }, withSystem);
		this.postMessage({ type: 'stream_start', trimmed });

		let assistantContent = '';
		let assistantReasoning = '';
		try {
			for await (const chunk of this.client.chatStream(body)) {
				if (chunk.done) {
					break;
				}
				if (chunk.reasoning) {
					assistantReasoning += chunk.reasoning;
				}
				if (chunk.content) {
					assistantContent += chunk.content;
				}
				if (chunk.reasoning || chunk.content) {
					this.postMessage({
						type: 'delta',
						reasoning: chunk.reasoning,
						content: chunk.content,
					});
				}
			}
			this.postMessage({ type: 'stream_end' });
			const assistantMsg: ChatMessage = { role: 'assistant', content: assistantContent };
			if (assistantReasoning) {
				assistantMsg.reasoning_content = assistantReasoning;
			}
			this.history.push(assistantMsg);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.postMessage({ type: 'error', message });
		}
	}

	/** Reset the conversation history and clear the webview. */
	public clear(): void {
		this.history = [];
		this.postMessage({ type: 'clear' });
	}

	/** Send a message to the webview (no-op if the view is not resolved). */
	public postMessage(message: HostToWebviewMessage): void {
		this.webview?.postMessage(message);
	}
}
