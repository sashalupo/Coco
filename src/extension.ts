// extension.ts — activation: wires the chat view, commands, status bar, and
// the /health poll. The engine is talked to directly via LlmClient.

import * as vscode from "vscode";
import { LlmClient } from "./client";
import { readSettings } from "./config";
import { ChatViewProvider } from "./chat/ChatViewProvider";
import { McpManager } from "./mcpManager";
import { InlineCompletionProvider } from "./inline/InlineCompletionProvider";
import { CodeActionProvider } from "./codeaction/CodeActionProvider";
import {
  buildCompletionsModelList,
  statusLabel,
  statusTooltip,
  statusOverviewItems,
  STATUS_COMMANDS,
} from "./presets";

/** How often to poll `GET /health` for the status bar. */
const HEALTH_POLL_INTERVAL_MS = 5000;

export function activate(context: vscode.ExtensionContext): void {
  const client = new LlmClient(readSettings);
  // 1.99-2.S5: one shared MCP server manager; the chat provider syncs it
  // each turn and disposes it on deactivation.
  const mcpManager = new McpManager((msg) =>
    vscode.window.showErrorMessage(msg),
  );
  const provider = new ChatViewProvider(context, client, mcpManager);

  // Register the chat webview (view id must match package.json `llm.chat`).
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(provider.viewType, provider),
  );
  // The provider owns the change-highlight decoration types (Phase 12.5);
  // dispose them on deactivation.
  context.subscriptions.push(provider);

  // Register inline (ghost text) completion, opt-in via `llm.inline.enabled`.
  // The setting is read at activation, so toggling it requires a reload.
  const inlineEnabled = vscode.workspace
    .getConfiguration("llm")
    .get<boolean>("inline.enabled", false);
  if (inlineEnabled) {
    const inlineProvider = new InlineCompletionProvider(context, client);
    context.subscriptions.push(
      vscode.languages.registerInlineCompletionItemProvider(
        [{ pattern: "**" }],
        inlineProvider,
      ),
    );
  }

  // Register the LLM code action (fix/refactor), opt-in via `llm.codeAction.enabled`.
  // The setting is read at activation, so toggling it requires a reload.
  const codeActionEnabled = vscode.workspace
    .getConfiguration("llm")
    .get<boolean>("codeAction.enabled", false);
  if (codeActionEnabled) {
    const codeActionProvider = new CodeActionProvider(context, client);
    context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(
        [{ pattern: "**" }],
        codeActionProvider,
        { providedCodeActionKinds: CodeActionProvider.providedKinds },
      ),
    );
  }

  // Status bar item reflecting engine health, opt-in via `llm.statusBar.enabled`.
  // The setting is read at activation, so toggling it requires a reload.
  const statusBarEnabled = vscode.workspace
    .getConfiguration("llm")
    .get<boolean>("statusBar.enabled", true);
  if (statusBarEnabled) {
    const status = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100,
    );
    status.command = "llm.showStatusOverview";
    status.tooltip = "LLM engine status (click for status overview)";
    context.subscriptions.push(status);

    // Poll /health and reflect the result in the status bar.
    const updateHealth = async (): Promise<void> => {
      const result = await client.health();
      const { icon, text } = statusLabel(result);
      status.text = `${icon} ${text}`;
      status.tooltip =
        statusTooltip(result, readSettings().baseUrl) +
        " (click for status overview)";
      if (result.ok) {
        status.backgroundColor = undefined;
      } else {
        status.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.errorBackground",
        );
      }
      status.show();
    };
    const pollTimer = setInterval(() => {
      void updateHealth();
    }, HEALTH_POLL_INTERVAL_MS);
    context.subscriptions.push({ dispose: () => clearInterval(pollTimer) });
    // Refresh immediately when the window regains focus.
    context.subscriptions.push(
      vscode.window.onDidChangeWindowState((e) => {
        if (e.focused) {
          void updateHealth();
        }
      }),
    );
    void updateHealth();
  }

  // Commands.
  context.subscriptions.push(
    vscode.commands.registerCommand("llm.openChat", async () => {
      await vscode.commands.executeCommand("workbench.view.llm");
    }),
    vscode.commands.registerCommand("llm.testConnection", async () => {
      const result = await client.health();
      if (result.ok) {
        vscode.window.showInformationMessage(
          `LLM engine healthy (${result.status} ${result.statusText})`,
        );
      } else {
        vscode.window.showErrorMessage(
          `LLM engine unreachable${result.error ? `: ${result.error}` : ` (${result.status})`}`,
        );
      }
    }),
    vscode.commands.registerCommand("llm.refreshModels", async () => {
      try {
        const models = await client.listModels();
        const ids = models.data.map((m) => m.id);
        provider.postMessage({ type: "models", models: ids });
        vscode.window.showInformationMessage(`Loaded ${ids.length} model(s)`);
      } catch (err) {
        vscode.window.showErrorMessage(
          `Failed to load models: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }),
    vscode.commands.registerCommand("llm.clearChat", () => {
      provider.clear();
    }),
    vscode.commands.registerCommand("llm.commitChanges", () => {
      void provider.commitChanges();
    }),
    vscode.commands.registerCommand("llm.showStatusOverview", async () => {
      const result = await client.health();
      const settings = readSettings();
      const infoItems = statusOverviewItems(
        result,
        settings.baseUrl,
        settings.model,
        settings.completionsModel,
      ).map((item) => ({
        label: item.label,
        description: item.description,
      }));
      const commandItems = STATUS_COMMANDS.map((c) => ({
        label: c.label,
        detail: c.detail,
        command: c.command,
      }));
      const items: (vscode.QuickPickItem & { command?: string })[] = [
        ...infoItems,
        { label: "Useful commands", kind: vscode.QuickPickItemKind.Separator },
        ...commandItems,
      ];
      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: "LLM engine status",
      });
      if (picked && picked.command) {
        await vscode.commands.executeCommand(picked.command);
      }
    }),
    vscode.commands.registerCommand("llm.changeCompletionsModel", async () => {
      const cfg = vscode.workspace.getConfiguration("llm");
      const current = cfg.get<string>("completions.model", "");
      const chatModel = cfg.get<string>("model", "");
      let engineModels: string[] = [];
      try {
        engineModels = (await client.listModels()).data.map((m) => m.id);
      } catch {
        vscode.window.showWarningMessage(
          "LLM engine unreachable — showing configured models only.",
        );
      }
      const items = buildCompletionsModelList(current, chatModel, engineModels).map(
        (o) => ({
          label: o.value === "" ? "$(symbol-inherit) Use chat model (default)" : o.value,
          description: o.picked ? "active" : undefined,
          value: o.value,
        }),
      );
      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: "Model for inline code completions",
        title: "Change Completions Model",
      });
      if (!picked) {
        return; // cancelled
      }
      const target = vscode.workspace.workspaceFolders
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;
      await cfg.update("completions.model", picked.value, target);
      vscode.window.showInformationMessage(
        picked.value === ""
          ? "Inline completions will use the chat model."
          : `Inline completions will use model: ${picked.value}`,
      );
    }),
  );
}

export function deactivate(): void {}
