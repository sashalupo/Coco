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
  completionsStatusLabel,
  STATUS_COMMANDS,
} from "./presets";
import { promptTitle, stripPromptComments, PROMPT_TEMPLATE, MAX_PROMPT_CHARS } from "./prompts";

/** How often to poll `GET /health` for the status bar. */
const HEALTH_POLL_INTERVAL_MS = 5000;

/** Shared MCP manager (module-level so `deactivate` can dispose it). */
let mcpManager: McpManager | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const client = new LlmClient(readSettings);
  // 1.99-2.S5: one shared MCP server manager; the chat provider syncs it
  // each turn and disposes it on deactivation.
  mcpManager = new McpManager((msg) =>
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
      const cs = completionsStatusLabel(
        inlineEnabled,
        vscode.window.activeTextEditor !== undefined,
      );
      status.text = `${icon} ${text} ${cs.icon} ${cs.text}`;
      status.tooltip =
        statusTooltip(result, readSettings().baseUrl) +
        " (click for status overview) | " +
        cs.tooltip;
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
    // Refresh when the active editor changes (completions indicator).
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(() => void updateHealth()),
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
      const completionsEnabled = vscode.workspace
        .getConfiguration("llm")
        .get<boolean>("inline.enabled", false);
      const infoItems = statusOverviewItems(
        result,
        settings.baseUrl,
        settings.model,
        settings.completionsModel,
        completionsEnabled,
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
    vscode.commands.registerCommand("llm.usePrompt", async () => {
      const settings = readSettings();
      const globs = (settings.promptFiles ?? []).filter(
        (g) => typeof g === "string" && g.length > 0,
      );
      if (globs.length === 0) {
        vscode.window.showInformationMessage(
          "No prompt file locations configured (llm.promptFiles.locations).",
        );
        return;
      }
      const found: vscode.Uri[] = [];
      const seen = new Set<string>();
      for (const glob of globs) {
        const uris = await vscode.workspace.findFiles(
          glob,
          "**/node_modules/**",
          200,
        );
        for (const uri of uris) {
          if (!seen.has(uri.fsPath)) {
            seen.add(uri.fsPath);
            found.push(uri);
          }
        }
      }
      const items: (vscode.QuickPickItem & { uri?: vscode.Uri })[] = found.map(
        (uri) => ({
          label: promptTitle("", uri.fsPath),
          description: vscode.workspace.asRelativePath(uri),
          uri,
        }),
      );
      items.push({
        label: "$(new-file) New Prompt File…",
        description: "create .prompts/<name>.prompt.md",
      });
      const picked = await vscode.window.showQuickPick(items, {
        title: "LLM: Use Prompt",
        placeHolder: "Select a reusable prompt to use in chat",
      });
      if (!picked) {
        return; // cancelled
      }
      if (picked.uri) {
        const raw = await vscode.workspace.fs.readFile(picked.uri);
        const content = Buffer.from(raw).toString("utf8").slice(0, MAX_PROMPT_CHARS);
        const stripped = stripPromptComments(content);
        if (stripped.length === 0) {
          vscode.window.showInformationMessage(
            "That prompt file is empty (or only comments).",
          );
          return;
        }
        provider.postMessage({
          type: "prompt_inject",
          title: promptTitle(content, picked.uri.fsPath),
          content: stripped,
        });
        await vscode.commands.executeCommand("workbench.view.llm");
        return;
      }
      // New Prompt File…
      const name = await vscode.window.showInputBox({
        prompt: "Prompt file name",
        validateInput: (v) =>
          /^[a-zA-Z0-9._-]+$/.test(v)
            ? undefined
            : "Use letters, digits, dot, dash, underscore only",
      });
      if (name === undefined) {
        return; // cancelled
      }
      const root = vscode.workspace.workspaceFolders?.[0]?.uri;
      if (!root) {
        vscode.window.showErrorMessage("Open a workspace to create prompt files.");
        return;
      }
      const target = vscode.Uri.joinPath(root, ".prompts", name + ".prompt.md");
      try {
        await vscode.workspace.fs.stat(target);
        vscode.window.showInformationMessage("That prompt file already exists.");
        return;
      } catch {
        // does not exist — create it below.
      }
      await vscode.workspace.fs.createDirectory(
        vscode.Uri.joinPath(root, ".prompts"),
      );
      await vscode.workspace.fs.writeFile(
        target,
        Buffer.from(PROMPT_TEMPLATE, "utf8"),
      );
      const doc = await vscode.workspace.openTextDocument(target);
      await vscode.window.showTextDocument(doc);
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
    vscode.commands.registerCommand("llm.toggleCompletions", async () => {
      const cfg = vscode.workspace.getConfiguration("llm");
      const current = cfg.get<boolean>("inline.enabled", false);
      const items = [
        { label: "$(check) Enable inline completions", value: true },
        { label: "$(x) Disable inline completions", value: false },
      ].map((o) => ({
        label: o.label,
        description: o.value === current ? "active" : undefined,
        value: o.value,
      }));
      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: "Inline code completions",
        title: "Toggle Completions",
      });
      if (!picked) {
        return; // cancelled
      }
      const target = vscode.workspace.workspaceFolders
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;
      await cfg.update("inline.enabled", picked.value, target);
      vscode.window.showInformationMessage(
        "Inline completions " +
          (picked.value ? "enabled" : "disabled") +
          ". Reload the window to apply.",
      );
    }),
    vscode.commands.registerCommand("llm.mcp.addServer", async () => {
      const name = await vscode.window.showInputBox({
        prompt: "MCP server name",
        placeHolder: "e.g. filesystem",
        validateInput: (v) => {
          if (!v.trim()) {
            return "Name must not be empty.";
          }
          if (v.includes("__")) {
            return "Name must not contain '__' (reserved for tool names).";
          }
          return undefined;
        },
      });
      if (!name) {
        return; // cancelled
      }
      const command = await vscode.window.showInputBox({
        prompt: "Command to start the server",
        placeHolder: "e.g. npx",
        validateInput: (v) => (v.trim() ? undefined : "Command must not be empty."),
      });
      if (!command) {
        return; // cancelled
      }
      const argsRaw = await vscode.window.showInputBox({
        prompt: "Arguments (space-separated, optional)",
        placeHolder: "e.g. -y @modelcontextprotocol/server-filesystem /tmp",
      });
      const args = argsRaw ? argsRaw.trim().split(/\s+/) : [];
      const cfg = vscode.workspace.getConfiguration("llm.mcp");
      const servers = cfg.get<
        Record<string, { command: string; args?: string[]; env?: Record<string, string> }>
      >("servers", {});
      servers[name.trim()] = { command: command.trim(), ...(args.length ? { args } : {}) };
      await cfg.update(
        "servers",
        servers,
        vscode.ConfigurationTarget.Workspace,
      );
      vscode.window.showInformationMessage(
        `MCP server '${name.trim()}' added to llm.mcp.servers (workspace). Reload or start a chat turn to connect.`,
      );
    }),
    vscode.commands.registerCommand("llm.mcp.listServers", async () => {
      const manager = mcpManager;
      if (!manager) {
        vscode.window.showWarningMessage("LLM extension not activated.");
        return;
      }
      const servers = manager.listServers();
      if (servers.length === 0) {
        vscode.window.showInformationMessage(
          "No MCP servers configured (llm.mcp.servers is empty).",
        );
        return;
      }
      const picked = await vscode.window.showQuickPick(
        servers.map((s) => ({
          label: s.name,
          description: s.status,
          detail: s.error ? `${s.toolCount} tools — ${s.error}` : `${s.toolCount} tools`,
        })),
        { placeHolder: "MCP servers (pick one to refresh and show its tools)" },
      );
      if (!picked) {
        return; // cancelled
      }
      const status = await manager.refresh(picked.label);
      const tools = manager.getServerTools(picked.label);
      if (status.status === "error") {
        vscode.window.showErrorMessage(
          `MCP server '${picked.label}' failed: ${status.error ?? "unknown error"}`,
        );
        return;
      }
      if (tools.length === 0) {
        vscode.window.showInformationMessage(
          `MCP server '${picked.label}' is running but exposes no tools.`,
        );
        return;
      }
      const toolPicked = await vscode.window.showQuickPick(
        tools.map((t) => ({
          label: t.name,
          detail: t.description,
        })),
        { placeHolder: `Tools of MCP server '${picked.label}'` },
      );
      if (toolPicked) {
        vscode.window.showInformationMessage(
          `Tool '${toolPicked.label}'${toolPicked.detail ? ` — ${toolPicked.detail}` : ""}`,
        );
      }
    }),
  );
}

export function deactivate(): void {
  mcpManager?.dispose();
  mcpManager = undefined;
}
