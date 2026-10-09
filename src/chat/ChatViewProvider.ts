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
import { buildContextBlock, type ContextInput } from '../context';
import { toolResultMessage, type ToolCall } from '../tools';
import { ToolExecutor } from '../tools/ToolExecutor';
import type { ContextFlags, ContextLevel, ThinkingLevel, ToolbarState } from '../presets';

/** Cap on the number of tool-call iterations in the agentic loop. */
const MAX_TOOL_ITERATIONS = 8;

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

	/** Executes the workspace tools the engine calls (Phase 4). */
	private readonly toolExecutor: ToolExecutor;

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly client: LlmClient
	) {
		this.toolbarStore = ToolbarStateStore.create(context.globalState);
		this.toolExecutor = new ToolExecutor();
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
			contextFlags: t.contextFlags,
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
		if (msg.contextFlags) {
			const f = msg.contextFlags as Partial<ContextFlags>;
			void this.toolbarStore.setContextFlags({
				includeFile: f.includeFile !== false,
				includeSelection: f.includeSelection !== false,
				includeDiagnostics: f.includeDiagnostics !== false,
			});
		}
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

		// Gather editor context (active file, selection, diagnostics) and fold
		// it into the system prompt so the model can see what the user is
		// looking at. Each section is gated by the toolbar's context flags.
		// Empty context is a no-op.
		const contextBlock = buildContextBlock(this.gatherContext(toolbar.contextFlags));
		const systemPrompt = this.composeSystemPrompt(settings.systemPrompt, contextBlock);

		const withSystem: ChatMessage[] = systemPrompt
			? [{ role: 'system', content: systemPrompt }, ...this.history]
			: [...this.history];

		const initial = buildRequestBody({ settings, toolbar }, withSystem);
		let body = initial.body;
		this.postMessage({ type: 'stream_start', trimmed: initial.trimmed });

		try {
			// Agentic loop: when tools are enabled, keep sending the request
			// while the assistant replies with tool_calls — executing each via
			// the ToolExecutor and feeding the results back — until the model
			// stops calling tools or the iteration cap is hit.
			let iterations = 0;
			for (;;) {
				const { content, reasoning, toolCalls } = await this.streamOneTurn(body);
				this.history.push(this.assistantMessage(content, reasoning, toolCalls));

				if (!settings.toolsEnabled || toolCalls.length === 0) {
					break;
				}
				if (++iterations >= MAX_TOOL_ITERATIONS) {
					this.postMessage({
						type: 'delta',
						content: `\n\n[stopped after ${MAX_TOOL_ITERATIONS} tool iterations]`,
					});
					break;
				}

				// Execute each tool call and append the results to the history.
				for (const call of toolCalls) {
					this.postMessage({ type: 'delta', content: `\n\n▸ ${call.function.name}…` });
					const result = await this.toolExecutor.execute(call);
					this.history.push(toolResultMessage(call, result.content));
				}

				// Rebuild the request body with the updated history (system +
				// the new assistant/tool turns) and loop.
				const currentWithSystem = systemPrompt
					? [{ role: 'system' as const, content: systemPrompt }, ...this.history]
					: [...this.history];
				const rebuilt = buildRequestBody({ settings, toolbar }, currentWithSystem);
				body = rebuilt.body;
			}
			this.postMessage({ type: 'stream_end' });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.postMessage({ type: 'error', message });
		}
	}

	/**
	 * Stream a single assistant turn: collect content/reasoning deltas (posted
	 * to the webview as they arrive) and the accumulated tool calls.
	 */
	private async streamOneTurn(body: import('../request').ChatCompletionRequest): Promise<{
		content: string;
		reasoning: string;
		toolCalls: ToolCall[];
	}> {
		let content = '';
		let reasoning = '';
		let toolCalls: ToolCall[] = [];
		for await (const chunk of this.client.chatStream(body)) {
			if (chunk.done) {
				break;
			}
			if (chunk.reasoning) {
				reasoning += chunk.reasoning;
			}
			if (chunk.content) {
				content += chunk.content;
			}
			if (chunk.toolCalls) {
				toolCalls = chunk.toolCalls;
			}
			if (chunk.reasoning || chunk.content) {
				this.postMessage({ type: 'delta', reasoning: chunk.reasoning, content: chunk.content });
			}
		}
		return { content, reasoning, toolCalls };
	}

	/** Build an assistant `ChatMessage` from a streamed turn. */
	private assistantMessage(content: string, reasoning: string, toolCalls: ToolCall[]): ChatMessage {
		const msg: ChatMessage = { role: 'assistant', content };
		if (reasoning) {
			msg.reasoning_content = reasoning;
		}
		if (toolCalls.length > 0) {
			msg.tool_calls = toolCalls;
		}
		return msg;
	}

	/**
	 * Gather the current editor context: the active file (path, language,
	 * contents), the current selection (range + text), and workspace
	 * diagnostics. Each section is gated by the `ContextFlags` so the user can
	 * opt out of any of them. Returns an empty `ContextInput` when there is no
	 * active text editor (or every flag is off), so `buildContextBlock` yields
	 * an empty string.
	 */
	private gatherContext(flags: ContextFlags): ContextInput {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return {};
		}

		const input: ContextInput = {};
		const doc = editor.document;

		// Active file: path (workspace-relative when possible), language, contents.
		if (flags.includeFile) {
			const wsFolder = vscode.workspace.getWorkspaceFolder(doc.uri);
			const path = wsFolder
				? vscode.workspace.asRelativePath(doc.uri)
				: doc.uri.fsPath;
			input.file = {
				path,
				language: doc.languageId,
				content: doc.getText(),
			};
		}

		// Selection: only when the user has actually selected something.
		if (flags.includeSelection) {
			const sel = editor.selection;
			if (!sel.isEmpty) {
				input.selection = {
					startLine: sel.start.line + 1,
					startColumn: sel.start.character + 1,
					endLine: sel.end.line + 1,
					endColumn: sel.end.character + 1,
					text: doc.getText(sel),
				};
			}
		}

		// Diagnostics for the active file (errors/warnings/info).
		if (flags.includeDiagnostics) {
			const diags = vscode.languages.getDiagnostics(doc.uri);
			if (diags.length > 0) {
				input.diagnostics = diags.map((d) => ({
					line: d.range.start.line + 1,
					column: d.range.start.character + 1,
					severity: this.severityLabel(d.severity),
					message: d.message,
				}));
			}
		}

		return input;
	}

	/** Map a `DiagnosticSeverity` to a short human-readable label. */
	private severityLabel(severity: vscode.DiagnosticSeverity): string {
		switch (severity) {
			case vscode.DiagnosticSeverity.Error:
				return 'error';
			case vscode.DiagnosticSeverity.Warning:
				return 'warning';
			case vscode.DiagnosticSeverity.Information:
				return 'info';
			case vscode.DiagnosticSeverity.Hint:
				return 'hint';
			default:
				return 'info';
		}
	}

	/**
	 * Combine the configured system prompt with the gathered context block.
	 * Either may be empty; the result is empty only when both are empty.
	 */
	private composeSystemPrompt(systemPrompt: string, contextBlock: string): string {
		if (systemPrompt && contextBlock) {
			return `${systemPrompt}\n\n${contextBlock}`;
		}
		return systemPrompt || contextBlock;
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
