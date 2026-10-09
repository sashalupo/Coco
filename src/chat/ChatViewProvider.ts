// ChatViewProvider.ts — the chat panel's WebviewViewProvider.
//
// S7: builds the webview (via buildWebviewHtml) and round-trips a basic
// `hello`/`ready` message between the webview and the host. The webview posts
// `{type:'ready'}` on load; the host replies with `{type:'hello'}`. Later
// steps (S9–S11) extend `onDidReceiveMessage` with the real chat/toolbar flow.

import * as vscode from 'vscode';
import { buildWebviewHtml } from './webview';

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

	constructor(private readonly context: vscode.ExtensionContext) {}

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
	 * Handle a message from the webview. S7 only round-trips `ready` →
	 * `hello`; the real chat/toolbar handling is added in S9–S11.
	 */
	private onMessage(msg: WebviewToHostMessage): void {
		switch (msg.type) {
			case 'ready':
				// Round-trip: acknowledge the webview is up.
				this.postMessage({ type: 'hello', message: 'LLM chat panel ready' });
				break;
			default:
				// Unknown message types are ignored for now.
				break;
		}
	}

	/** Send a message to the webview (no-op if the view is not resolved). */
	public postMessage(message: HostToWebviewMessage): void {
		this.webview?.postMessage(message);
	}
}
