// extension.ts — activation: wires the chat view, commands, status bar, and
// the /health poll. The engine is talked to directly via LlmClient.

import * as vscode from "vscode";
import { LlmClient } from "./client";
import { readSettings } from "./config";
import { ChatViewProvider } from "./chat/ChatViewProvider";
import { McpManager } from "./mcpManager";
import { detectSecretEnvName, McpInput } from "./mcp";
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
import {
  parseNotebook,
  extractCellOutputs,
  extractNotebookCellOutput,
  NotebookCellOutputLike,
} from "./notebook";
import {
  parseInstructionsFrontMatter,
  INSTRUCTIONS_FILE_TEMPLATE,
  instructionsFileName,
} from "./instructions";
import { buildToolsetsExample } from "./toolsets";

/**
 * 1.100-30.S-002: the pinned `@types/vscode` (1.140.0) predates the
 * `window.registerDragAndDropController` API (added in VS Code 1.99), so
 * declare the minimal surface we use here. The runtime engine is newer
 * and provides the API; this is types-only, no runtime dependency.
 */
declare module "vscode" {
  namespace window {
    function registerDragAndDropController(
      controller: {
        target: { viewContainerId: string };
        handleDrop: (e: DragAndDropEvent) => void;
      },
      options: { dropMimeTypes: string[] },
    ): Disposable;
  }
  interface DragAndDropEvent {
    data: { items: DragAndDropDataItem[] };
    modifiers: { alt: boolean; ctrl: boolean; shift: boolean };
  }
  interface DragAndDropDataItem {
    type: string;
    data: unknown;
  }
}

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

  // 1.100-30.S-002: drag-and-drop controller — drop notebook cell outputs
  // (mime `notebook.cellOutput`) onto the LLM view container to attach them
  // to the chat input, reusing the same `cell_output_inject` webview message
  // as the `llm.addCellOutput` command.
  context.subscriptions.push(
    vscode.window.registerDragAndDropController(
      {
        target: { viewContainerId: "llm" },
        handleDrop: async (e: vscode.DragAndDropEvent) => {
          const dropEnabled = vscode.workspace
            .getConfiguration("llm")
            .get<boolean>("chat.cellOutputDrop.enabled", true);
          if (!dropEnabled) {
            return;
          }
          const visionEnabled = vscode.workspace
            .getConfiguration("llm")
            .get<boolean>("chat.vision.enabled", true);
          for (const item of e.data.items) {
            if (item.type !== "notebook.cellOutput") {
              continue;
            }
            try {
              const output = item.data as unknown as NotebookCellOutputLike;
              const { text, images } =
                await extractNotebookCellOutput(output);
              // Alt rule: text-only drops require Alt (avoids clashing with
              // text selection); image outputs attach on a plain drop.
              if (text && images.length === 0 && !e.modifiers.alt) {
                continue;
              }
              const imgs = visionEnabled ? images : [];
              provider.postMessage({
                type: "cell_output_inject",
                text,
                images: imgs,
              });
            } catch {
              // One bad item must not break the others.
            }
          }
        },
      },
      { dropMimeTypes: ["notebook.cellOutput"] },
    ),
  );

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
    vscode.commands.registerCommand("llm.runPrompt", async () => {
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
        title: "LLM: Run Prompt",
        placeHolder: "Select a prompt to run in chat",
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
        await vscode.commands.executeCommand("workbench.view.llm");
        await provider.runPrompt(content, picked.uri.fsPath);
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
    // 1.100-2.S5: deprecated alias — `llm.usePrompt` now runs the prompt
    // (previously it injected it as context).
    vscode.commands.registerCommand("llm.usePrompt", () =>
      vscode.commands.executeCommand("llm.runPrompt"),
    ),
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
      const transport = await vscode.window.showQuickPick(
        [
          { label: "stdio (command)", value: "stdio" },
          { label: "Streamable HTTP (url)", value: "http" },
        ],
        { placeHolder: "MCP server transport" },
      );
      if (!transport) {
        return; // cancelled
      }
      const cfg = vscode.workspace.getConfiguration("llm.mcp");
      const servers = cfg.get<
        Record<
          string,
          {
            command?: string;
            args?: string[];
            env?: Record<string, string>;
            inputs?: Record<string, McpInput>;
            url?: string;
          }
        >
      >("servers", {});
      if (transport.value === "http") {
        const url = await vscode.window.showInputBox({
          prompt: "Streamable HTTP endpoint URL",
          placeHolder: "e.g. http://localhost:8080/mcp",
          validateInput: (v) => {
            const t = v.trim();
            if (!t) {
              return "URL must not be empty.";
            }
            if (!/^https?:\/\//.test(t)) {
              return "URL must start with http:// or https://.";
            }
            return undefined;
          },
        });
        if (!url) {
          return; // cancelled
        }
        servers[name.trim()] = { url: url.trim() };
        await cfg.update(
          "servers",
          servers,
          vscode.ConfigurationTarget.Workspace,
        );
        vscode.window.showInformationMessage(
          `MCP server '${name.trim()}' added to llm.mcp.servers (workspace) via Streamable HTTP. Reload or start a chat turn to connect.`,
        );
        return;
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
      const envRaw = await vscode.window.showInputBox({
        prompt: "Environment variables (KEY=VALUE, comma-separated, optional)",
        placeHolder: "e.g. API_KEY=sk-..., PORT=8080",
      });
      const env: Record<string, string> = {};
      const inputs: Record<string, McpInput> = {};
      if (envRaw) {
        for (const token of envRaw.split(",")) {
          const eq = token.indexOf("=");
          if (eq <= 0) {
            continue; // no '=' or empty key
          }
          const key = token.slice(0, eq).trim();
          const value = token.slice(eq + 1).trim();
          if (!key) {
            continue;
          }
          if (detectSecretEnvName(key)) {
            env[key] = `$\{input:${key}}`;
            inputs[key] = {
              description: `Value for ${key}`,
              type: "string",
              password: true,
              required: true,
            };
          } else {
            env[key] = value;
          }
        }
      }
      const serverName = name.trim();
      servers[serverName] = {
        command: command.trim(),
        ...(args.length ? { args } : {}),
        ...(Object.keys(env).length ? { env } : {}),
        ...(Object.keys(inputs).length ? { inputs } : {}),
      };
      await cfg.update(
        "servers",
        servers,
        vscode.ConfigurationTarget.Workspace,
      );
      if (Object.keys(inputs).length > 0) {
        const values: Record<string, string> = {};
        for (const key of Object.keys(inputs)) {
          const value = await vscode.window.showInputBox({
            prompt: `Enter value for ${key} (stored in memory for this session)`,
            password: true,
          });
          if (value !== undefined) {
            values[key] = value;
          }
        }
        if (Object.keys(values).length > 0) {
          if (mcpManager) {
            mcpManager.setInputs(serverName, values);
          } else {
            vscode.window.showWarningMessage(
              "MCP manager not yet active — values must be re-entered after reload.",
            );
          }
        }
      }
      vscode.window.showInformationMessage(
        `MCP server '${serverName}' added to llm.mcp.servers (workspace) via stdio. Reload or start a chat turn to connect.`,
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
    vscode.commands.registerCommand("llm.addCellOutput", async () => {
      const enabled = vscode.workspace
        .getConfiguration("llm")
        .get<boolean>("chat.addCellOutput.enabled", true);
      if (!enabled) {
        vscode.window.showInformationMessage(
          "llm.chat.addCellOutput.enabled is off.",
        );
        return;
      }
      const editor = vscode.window.activeNotebookEditor;
      if (!editor) {
        vscode.window.showInformationMessage(
          "No active notebook — open a notebook with cell outputs first.",
        );
        return;
      }
      const doc = await vscode.workspace.openTextDocument(editor.notebook.uri);
      const parsed = parseNotebook(doc.getText());
      if (!parsed) {
        vscode.window.showInformationMessage("Could not parse notebook.");
        return;
      }
      const cell = [...parsed.cells]
        .reverse()
        .find(
          (c) =>
            c.cell_type === "code" &&
            Array.isArray(c.outputs) &&
            c.outputs.length > 0,
        );
      if (!cell) {
        vscode.window.showInformationMessage(
          "The notebook has no cell outputs yet — run a cell first.",
        );
        return;
      }
      const { text, images } = extractCellOutputs(cell);
      if (!text && images.length === 0) {
        vscode.window.showInformationMessage("That cell's outputs are empty.");
        return;
      }
      const visionEnabled = vscode.workspace
        .getConfiguration("llm")
        .get<boolean>("chat.vision.enabled", true);
      const imgs = visionEnabled ? images : [];
      provider.postMessage({ type: "cell_output_inject", text, images: imgs });
      await vscode.commands.executeCommand("workbench.view.llm");
    }),
    // 1.100-8.S4: streamlined context picker — a two-step quick pick
    // (category → item) that inserts a context reference into the chat
    // input via the `context_inject` webview message. Files → `@<rel
    // path>` (file pill), folders → `#folder:<name>` (folder pill),
    // selection → `@<rel path>` (selection is re-gathered at send time via
    // the context flags), problems → `#problems` (re-gathered at send time).
    vscode.commands.registerCommand("llm.addContext", async () => {
      const rel = (uri: vscode.Uri): string => {
        const ws = vscode.workspace.getWorkspaceFolder(uri);
        return ws ? vscode.workspace.asRelativePath(uri) : uri.fsPath;
      };

      // Build the category list (only include groups that have items).
      const categories: { id: string; label: string; description: string }[] =
        [];
      const fileUris = await vscode.workspace.findFiles(
        "**/*",
        "**/node_modules/**",
        20,
      );
      if (fileUris.length > 0) {
        categories.push({
          id: "files",
          label: "$(file) Files",
          description: `${fileUris.length} workspace file(s)`,
        });
      }
      const folders = (vscode.workspace.workspaceFolders ?? []).slice(0, 20);
      if (folders.length > 0) {
        categories.push({
          id: "folders",
          label: "$(folder) Folders",
          description: `${folders.length} workspace folder(s)`,
        });
      }
      const editor = vscode.window.activeTextEditor;
      const selection =
        editor && !editor.selection.isEmpty ? editor : undefined;
      if (selection) {
        categories.push({
          id: "selection",
          label: "$(list-selection) Selection",
          description: `${rel(selection.document.uri)} (lines ${
            selection.selection.start.line + 1
          }–${selection.selection.end.line + 1})`,
        });
      }
      const diagEntries = vscode.languages
        .getDiagnostics()
        .filter(([, ds]) => ds.length > 0)
        .slice(0, 10);
      if (diagEntries.length > 0) {
        categories.push({
          id: "problems",
          label: "$(warning) Problems",
          description: `${diagEntries.reduce((n, [, ds]) => n + ds.length, 0)} diagnostic(s)`,
        });
      }
      // 1.101-3.S-006: MCP Resources category — shown when any configured
      // server is running and exposes at least one resource.
      const mcpEntries: { server: string; name: string; uri: string }[] = [];
      if (mcpManager) {
        for (const s of mcpManager.listServers()) {
          if (s.status !== "running") {
            continue;
          }
          for (const r of mcpManager.getServerResources(s.name)) {
            mcpEntries.push({ server: s.name, name: r.name, uri: r.uri });
          }
        }
      }
      if (mcpEntries.length > 0) {
        categories.push({
          id: "mcpResources",
          label: "$(server-process) MCP Resources",
          description: `${mcpEntries.length} resource(s) from running MCP server(s)`,
        });
      }
      if (categories.length === 0) {
        vscode.window.showInformationMessage(
          "No context to add — open a file or select some text first.",
        );
        return;
      }
      const cat = await vscode.window.showQuickPick(
        categories.map((c) => ({
          label: c.label,
          description: c.description,
          id: c.id,
        })),
        {
          title: "LLM: Add Context to Chat",
          placeHolder: "Select a context category",
        },
      );
      if (!cat) {
        return; // cancelled
      }

      let ref = "";
      if (cat.id === "files") {
        const picked = await vscode.window.showQuickPick(
          fileUris.map((uri) => ({ label: rel(uri), uri })),
          {
            title: "LLM: Add Context to Chat",
            placeHolder: "Select a file",
          },
        );
        if (picked) {
          ref = `@${rel(picked.uri)}`;
        }
      } else if (cat.id === "folders") {
        const picked = await vscode.window.showQuickPick(
          folders.map((f) => ({
            label: f.name,
            description: f.uri.fsPath,
            name: f.name,
          })),
          {
            title: "LLM: Add Context to Chat",
            placeHolder: "Select a folder",
          },
        );
        if (picked) {
          ref = `#folder:${picked.name}`;
        }
      } else if (cat.id === "selection" && selection) {
        ref = `@${rel(selection.document.uri)}`;
      } else if (cat.id === "problems") {
        ref = "#problems";
      } else if (cat.id === "mcpResources") {
        const picked = await vscode.window.showQuickPick(
          mcpEntries.map((e) => ({
            label: `${e.server} · ${e.name}`,
            description: e.uri,
            server: e.server,
            uri: e.uri,
          })),
          {
            title: "LLM: Add Context to Chat",
            placeHolder: "Select an MCP resource",
          },
        );
        if (picked) {
          ref = `#mcp:${picked.server}/${picked.uri}`;
        }
      }
      if (!ref) {
        return; // cancelled
      }

      provider.postMessage({ type: "context_inject", content: ref });
      await vscode.commands.executeCommand("workbench.view.llm");
    }),
    // 1.101-3.S-006: MCP: Browse Resources — two-step quick pick
    // (server → resource) that reads the resource and opens its text in a
    // read-only untitled document. Templates are listed with a "(template)"
    // marker but disabled for reading (URI template expansion is out of
    // scope).
    vscode.commands.registerCommand("llm.browseMcpResources", async () => {
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
      const serverPicked = await vscode.window.showQuickPick(
        servers.map((s) => ({
          label: s.name,
          description: s.status,
          detail: s.error ? `${s.toolCount} tools — ${s.error}` : `${s.toolCount} tools`,
        })),
        { placeHolder: "MCP servers (pick one to browse its resources)" },
      );
      if (!serverPicked) {
        return; // cancelled
      }
      const name = serverPicked.label;
      const resources = manager.getServerResources(name);
      const templates = manager.getServerResourceTemplates(name);
      if (resources.length === 0 && templates.length === 0) {
        vscode.window.showInformationMessage(
          `MCP server '${name}' exposes no resources.`,
        );
        return;
      }
      const resPicked = await vscode.window.showQuickPick(
        [
          ...resources.map((r) => ({
            label: r.name,
            description: r.uri,
            detail: r.description,
            uri: r.uri,
            disabled: false,
          })),
          ...templates.map((t) => ({
            label: `${t.name} (template)`,
            description: t.uriTemplate,
            detail: t.description,
            uri: t.uriTemplate,
            disabled: true,
          })),
        ],
        { placeHolder: `Resources of MCP server '${name}'` },
      );
      if (!resPicked) {
        return; // cancelled
      }
      const result = await manager.readResource(name, resPicked.uri);
      if (result.content.startsWith("Error:")) {
        vscode.window.showErrorMessage(result.content);
        return;
      }
      const doc = await vscode.workspace.openTextDocument({
        content: result.content,
        language: "plaintext",
      });
      await vscode.window.showTextDocument(doc, {
        viewColumn: vscode.ViewColumn.One,
        preview: false,
      });
    }),
    vscode.commands.registerCommand("llm.attachInstructions", async () => {
      const cfg = vscode.workspace.getConfiguration("llm");
      const enabled = cfg.get<boolean>("instructionsFiles.enabled", true);
      if (!enabled) {
        vscode.window.showInformationMessage(
          "llm.instructionsFiles.enabled is off.",
        );
        return;
      }
      const globs = (
        cfg.get<string[]>("instructionsFiles.locations", [
          "**/*.instructions.md",
        ]) ?? []
      ).filter((g) => typeof g === "string" && g.length > 0);
      if (globs.length === 0) {
        vscode.window.showInformationMessage(
          "No instructions file locations configured (llm.instructionsFiles.locations).",
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
      if (found.length === 0) {
        vscode.window.showInformationMessage("No .instructions.md files found.");
        return;
      }
      const items: (vscode.QuickPickItem & { uri?: vscode.Uri })[] = found.map(
        (uri) => ({
          label: promptTitle("", uri.fsPath),
          description: vscode.workspace.asRelativePath(uri),
          uri,
        }),
      );
      const picked = await vscode.window.showQuickPick(items, {
        title: "LLM: Attach Instructions File",
        placeHolder: "Select an instructions file to prepend to the chat input",
      });
      if (!picked || !picked.uri) {
        return; // cancelled
      }
      const raw = await vscode.workspace.fs.readFile(picked.uri);
      const content = Buffer.from(raw).toString("utf8");
      const meta = parseInstructionsFrontMatter(content);
      const body = stripPromptComments(meta.body);
      if (body.length === 0) {
        vscode.window.showInformationMessage("That instructions file is empty.");
        return;
      }
      provider.postMessage({
        type: "instructions_inject",
        title: promptTitle(content, picked.uri.fsPath),
        content: body,
      });
      await vscode.commands.executeCommand("workbench.view.llm");
    }),
    vscode.commands.registerCommand("llm.newInstructionsFile", async () => {
      const name = await vscode.window.showInputBox({
        prompt: "Instructions file name",
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
        vscode.window.showErrorMessage(
          "Open a workspace to create instructions files.",
        );
        return;
      }
      const target = vscode.Uri.joinPath(
        root,
        ".instructions",
        instructionsFileName(name),
      );
      try {
        await vscode.workspace.fs.stat(target);
        vscode.window.showInformationMessage(
          "That instructions file already exists.",
        );
        return;
      } catch {
        // does not exist — create it below.
      }
      await vscode.workspace.fs.createDirectory(
        vscode.Uri.joinPath(root, ".instructions"),
      );
      await vscode.workspace.fs.writeFile(
        target,
        Buffer.from(INSTRUCTIONS_FILE_TEMPLATE, "utf8"),
      );
      const doc = await vscode.workspace.openTextDocument(target);
      await vscode.window.showTextDocument(doc);
    }),
    vscode.commands.registerCommand("llm.toolsets.createFile", async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri;
      if (!root) {
        vscode.window.showWarningMessage(
          "Open a workspace to create a tool sets file.",
        );
        return;
      }
      const target = vscode.Uri.joinPath(root, ".vscode", "toolsets.json");
      try {
        await vscode.workspace.fs.stat(target);
        vscode.window.showInformationMessage(
          "Tool sets file already exists",
        );
        return;
      } catch {
        // does not exist — create it below.
      }
      await vscode.workspace.fs.createDirectory(
        vscode.Uri.joinPath(root, ".vscode"),
      );
      await vscode.workspace.fs.writeFile(
        target,
        Buffer.from(buildToolsetsExample(), "utf8"),
      );
      const doc = await vscode.workspace.openTextDocument(target);
      await vscode.window.showTextDocument(doc);
    }),
  );
}

export function deactivate(): void {
  mcpManager?.dispose();
  mcpManager = undefined;
}
