// extension.ts — activation: wires the chat view, commands, status bar, and
// the /health poll. The engine is talked to directly via LlmClient.

import * as vscode from 'vscode';
import { LlmClient } from './client';
import { readSettings } from './config';
import { ChatViewProvider } from './chat/ChatViewProvider';

/** How often to poll `GET /health` for the status bar. */
const HEALTH_POLL_INTERVAL_MS = 5000;

export function activate(context: vscode.ExtensionContext): void {
	const client = new LlmClient(readSettings);
	const provider = new ChatViewProvider(context, client);

	// Register the chat webview (view id must match package.json `llm.chat`).
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(provider.viewType, provider)
	);

	// Status bar item reflecting engine health.
	const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	status.command = 'llm.testConnection';
	status.tooltip = 'LLM engine status (click to test connection)';
	context.subscriptions.push(status);

	// Poll /health and reflect the result in the status bar.
	const updateHealth = async (): Promise<void> => {
		const result = await client.health();
		if (result.ok) {
			status.text = '$(check) LLM';
			status.backgroundColor = undefined;
			status.tooltip = `LLM engine healthy (${result.status} ${result.statusText})`;
		} else {
			status.text = '$(error) LLM';
			status.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
			status.tooltip = `LLM engine unreachable${result.error ? `: ${result.error}` : ` (${result.status})`}`;
		}
		status.show();
	};
	const pollTimer = setInterval(() => {
		void updateHealth();
	}, HEALTH_POLL_INTERVAL_MS);
	context.subscriptions.push({ dispose: () => clearInterval(pollTimer) });
	void updateHealth();

	// Commands.
	context.subscriptions.push(
		vscode.commands.registerCommand('llm.openChat', async () => {
			await vscode.commands.executeCommand('workbench.view.llm');
		}),
		vscode.commands.registerCommand('llm.testConnection', async () => {
			const result = await client.health();
			if (result.ok) {
				vscode.window.showInformationMessage(`LLM engine healthy (${result.status} ${result.statusText})`);
			} else {
				vscode.window.showErrorMessage(
					`LLM engine unreachable${result.error ? `: ${result.error}` : ` (${result.status})`}`
				);
			}
		}),
		vscode.commands.registerCommand('llm.refreshModels', async () => {
			try {
				const models = await client.listModels();
				const ids = models.data.map((m) => m.id);
				provider.postMessage({ type: 'models', models: ids });
				vscode.window.showInformationMessage(`Loaded ${ids.length} model(s)`);
			} catch (err) {
				vscode.window.showErrorMessage(
					`Failed to load models: ${err instanceof Error ? err.message : String(err)}`
				);
			}
		}),
		vscode.commands.registerCommand('llm.clearChat', () => {
			provider.clear();
		})
	);
}

export function deactivate(): void {}
