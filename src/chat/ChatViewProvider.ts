// ChatViewProvider.ts — the chat panel's WebviewViewProvider.
//
// S7: builds the webview (via buildWebviewHtml) and round-trips a basic
// `hello`/`ready` message between the webview and the host. The webview posts
// `{type:'ready'}` on load; the host replies with `{type:'hello'}`. Later
// steps (S9–S11) extend `onDidReceiveMessage` with the real chat/toolbar flow.

import * as vscode from "vscode";
import { buildWebviewHtml } from "./webview";
import { LlmClient, type UsageInfo } from "../client";
import {
  readSettings,
  ToolbarStateStore,
  ConversationStore,
  type Conversation,
} from "../config";
import {
  buildRequestBody,
  type ChatCompletionRequest,
  type ChatMessage,
} from "../request";
import { buildContextBlock, type ContextInput } from "../context";
import { toolResultMessage, type ToolCall } from "../tools";
import { ToolExecutor } from "../tools/ToolExecutor";
import type {
  ContextFlags,
  ContextLevel,
  ThinkingLevel,
  ToolbarState,
} from "../presets";

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
  public readonly viewType = "llm.chat";

  /** The resolved webview (set in `resolveWebviewView`). */
  private webview?: vscode.Webview;

  /** Conversation history (user/assistant turns). */
  private history: ChatMessage[] = [];

  /** Persisted toolbar overrides (Model/Thinking/Context). */
  private readonly toolbarStore: ToolbarStateStore;

  /** Persisted conversations (survive VS Code restarts). */
  private readonly conversationStore: ConversationStore;

  /** ID of the currently active conversation. */
  private currentConvId: string;

  /** Abort controller for the in-flight stream (null when idle). */
  private abortController: AbortController | null = null;

  /** Executes the workspace tools the engine calls (Phase 4). */
  private readonly toolExecutor: ToolExecutor;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly client: LlmClient,
  ) {
    this.toolbarStore = ToolbarStateStore.create(context.globalState);
    this.conversationStore = ConversationStore.create(context.globalState);
    // Restore the most recent conversation (or start fresh).
    const all = this.conversationStore.getAll();
    if (all.length > 0) {
      this.currentConvId = all[0].id;
      this.history = all[0].messages;
    } else {
      this.currentConvId = this.generateId();
      this.history = [];
    }
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
      case "ready":
        // Round-trip: acknowledge the webview is up, sync the persisted
        // toolbar state into the dropdowns, and load the model list so the
        // Model dropdown is populated when the panel opens.
        this.postMessage({ type: "hello", message: "LLM chat panel ready" });
        this.pushToolbarState();
        this.pushHistory();
        void this.loadModels();
        break;
      case "send":
        void this.handleSend(String(msg.text ?? ""));
        break;
      case "toolbar":
        this.applyToolbarMessage(msg);
        break;
      case "newChat":
        this.startNewConversation();
        break;
      case "switchConversation":
        this.switchConversation(String(msg.id ?? ""));
        break;
      case "deleteConversation":
        this.deleteConversation(String(msg.id ?? ""));
        break;
      case "stop":
        this.abortController?.abort();
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
      type: "toolbar",
      model: t.model ?? "",
      thinking: t.thinking,
      context: t.context,
      contextFlags: t.contextFlags,
    });
  }

  /** Push the current history + conversation list so the webview can render. */
  private pushHistory(): void {
    const all = this.conversationStore.getAll();
    this.postMessage({
      type: "restore",
      messages: this.history,
      conversations: all.map((c) => ({ id: c.id, title: c.title })),
      activeId: this.currentConvId,
    });
  }

  /** Generate a short unique id for a new conversation. */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /** Derive a short title from the first user message (or "New Chat"). */
  private deriveTitle(messages: ChatMessage[]): string {
    const firstUser = messages.find((m) => m.role === "user");
    if (!firstUser) {
      return "New Chat";
    }
    const text = firstUser.content.trim();
    return text.length > 40 ? text.slice(0, 40) + "…" : text;
  }

  /** Save the current conversation to the store. */
  private saveCurrentConversation(): void {
    if (this.history.length === 0) {
      return; // Nothing to save.
    }
    const conv: Conversation = {
      id: this.currentConvId,
      title: this.deriveTitle(this.history),
      messages: this.history,
    };
    void this.conversationStore.upsert(conv);
  }

  /** Start a brand-new conversation (saves the current one first). */
  private startNewConversation(): void {
    this.saveCurrentConversation();
    this.currentConvId = this.generateId();
    this.history = [];
    this.postMessage({ type: "clear" });
    this.pushHistory();
  }

  /** Switch to a previously saved conversation by id. */
  private switchConversation(id: string): void {
    if (id === this.currentConvId) {
      return;
    }
    // Save the current conversation before switching away.
    this.saveCurrentConversation();
    const target = this.conversationStore.getAll().find((c) => c.id === id);
    if (!target) {
      return;
    }
    this.currentConvId = id;
    this.history = target.messages;
    this.postMessage({ type: "restore", messages: this.history });
  }

  /**
   * Delete a saved conversation by id. If it is the active one, the current
   * conversation is reset to a fresh (empty) state. The updated list is
   * pushed so the webview's History dropdown refreshes.
   */
  private deleteConversation(id: string): void {
    if (!id) {
      return;
    }
    void this.conversationStore.remove(id);
    if (id === this.currentConvId) {
      // The active conversation was deleted — start fresh.
      this.currentConvId = this.generateId();
      this.history = [];
      this.postMessage({ type: "clear" });
    }
    this.pushHistory();
  }

  /**
   * Fetch the model list from the engine and push it to the webview so the
   * Model dropdown is populated. A failure (engine unreachable) is silent —
   * the dropdown simply stays as-is and the manual entry still works.
   */
  private async loadModels(): Promise<void> {
    try {
      const models = await this.client.listModels();
      const ids = models.data.map((m) => m.id);
      this.postMessage({ type: "models", models: ids });
    } catch {
      // Engine unreachable — the dropdown simply stays as-is; the manual
      // entry still works. Failures are intentionally silent.
    }
  }

  /** Persist a toolbar change posted by the webview. */
  private applyToolbarMessage(msg: WebviewToHostMessage): void {
    const rawModel = msg.model == null ? "" : String(msg.model);
    const thinking = String(msg.thinking ?? "off") as ThinkingLevel;
    const context = String(msg.context ?? "auto") as ContextLevel;
    void this.toolbarStore.setModel(rawModel === "" ? null : rawModel);
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

    this.history.push({ role: "user", content: text });

    // Build the request body. This is wrapped in its own try/catch (separate
    // from the streaming loop below) so a setup failure — context gathering or
    // request building — surfaces as an error in the panel instead of failing
    // silently before anything is rendered.
    let body: ChatCompletionRequest;
    let trimmed: boolean;
    let systemPrompt = "";
    try {
      // Gather editor context (active file, selection, diagnostics) and fold
      // it into the system prompt so the model can see what the user is
      // looking at. Each section is gated by the toolbar's context flags.
      // Empty context is a no-op.
      const contextBlock = buildContextBlock(
        this.gatherContext(toolbar.contextFlags),
      );
      systemPrompt = this.composeSystemPrompt(
        settings.systemPrompt,
        contextBlock,
      );

      const withSystem: ChatMessage[] = systemPrompt
        ? [{ role: "system", content: systemPrompt }, ...this.history]
        : [...this.history];

      const initial = buildRequestBody({ settings, toolbar }, withSystem);
      body = initial.body;
      trimmed = initial.trimmed;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.postMessage({ type: "error", message });
      return;
    }

    this.postMessage({ type: "stream_start", trimmed });

    // Create an AbortController so the user can cancel mid-stream.
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // Accumulate token usage across the (possibly multi-turn) agentic loop.
    const usage: UsageInfo = {};

    try {
      // Agentic loop: when tools are enabled, keep sending the request
      // while the assistant replies with tool_calls — executing each via
      // the ToolExecutor and feeding the results back — until the model
      // stops calling tools or the iteration cap is hit.
      let iterations = 0;
      for (;;) {
        if (signal.aborted) {
          break;
        }
        const { content, reasoning, toolCalls, usage: turnUsage } =
          await this.streamOneTurn(body, signal);
        this.accumulateUsage(usage, turnUsage);
        this.history.push(this.assistantMessage(content, reasoning, toolCalls));

        if (!settings.toolsEnabled || toolCalls.length === 0) {
          break;
        }
        if (++iterations >= MAX_TOOL_ITERATIONS) {
          this.postMessage({
            type: "delta",
            content: `\n\n[stopped after ${MAX_TOOL_ITERATIONS} tool iterations]`,
          });
          break;
        }

        // Execute each tool call and append the results to the history.
        for (const call of toolCalls) {
          this.postMessage({
            type: "delta",
            content: `\n\n▸ ${call.function.name}…`,
          });
          const result = await this.toolExecutor.execute(call);
          this.history.push(toolResultMessage(call, result.content));
        }

        // Rebuild the request body with the updated history (system +
        // the new assistant/tool turns) and loop.
        const currentWithSystem = systemPrompt
          ? [
              { role: "system" as const, content: systemPrompt },
              ...this.history,
            ]
          : [...this.history];
        const rebuilt = buildRequestBody(
          { settings, toolbar },
          currentWithSystem,
        );
        body = rebuilt.body;
      }
      this.postMessage({ type: "stream_end", usage });
    } catch (err) {
      if (signal.aborted) {
        // User-initiated stop — not an error.
        this.postMessage({ type: "stream_end", usage });
      } else {
        const message = err instanceof Error ? err.message : String(err);
        this.postMessage({ type: "error", message });
      }
    } finally {
      this.abortController = null;
    }
    // Persist the updated conversation so it survives a VS Code restart.
    // Runs on both success and error paths so the user's message is never lost.
    this.saveCurrentConversation();
  }

  /**
   * Stream a single assistant turn: collect content/reasoning deltas (posted
   * to the webview as they arrive) and the accumulated tool calls.
   */
  private async streamOneTurn(
    body: import("../request").ChatCompletionRequest,
    signal?: AbortSignal,
  ): Promise<{
    content: string;
    reasoning: string;
    toolCalls: ToolCall[];
    usage?: UsageInfo;
  }> {
    let content = "";
    let reasoning = "";
    let toolCalls: ToolCall[] = [];
    let usage: UsageInfo | undefined;
    for await (const chunk of this.client.chatStream(body, signal)) {
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
      if (chunk.usage) {
        usage = chunk.usage;
      }
      if (chunk.reasoning || chunk.content) {
        this.postMessage({
          type: "delta",
          reasoning: chunk.reasoning,
          content: chunk.content,
        });
      }
    }
    return { content, reasoning, toolCalls, usage };
  }

  /** Add one turn's usage into a running total (ignores undefined fields). */
  private accumulateUsage(total: UsageInfo, turn?: UsageInfo): void {
    if (!turn) {
      return;
    }
    if (typeof turn.prompt_tokens === "number") {
      total.prompt_tokens = (total.prompt_tokens ?? 0) + turn.prompt_tokens;
    }
    if (typeof turn.completion_tokens === "number") {
      total.completion_tokens =
        (total.completion_tokens ?? 0) + turn.completion_tokens;
    }
    if (typeof turn.total_tokens === "number") {
      total.total_tokens = (total.total_tokens ?? 0) + turn.total_tokens;
    }
  }

  /** Build an assistant `ChatMessage` from a streamed turn. */
  private assistantMessage(
    content: string,
    reasoning: string,
    toolCalls: ToolCall[],
  ): ChatMessage {
    const msg: ChatMessage = { role: "assistant", content };
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
        return "error";
      case vscode.DiagnosticSeverity.Warning:
        return "warning";
      case vscode.DiagnosticSeverity.Information:
        return "info";
      case vscode.DiagnosticSeverity.Hint:
        return "hint";
      default:
        return "info";
    }
  }

  /**
   * Combine the configured system prompt with the gathered context block.
   * Either may be empty; the result is empty only when both are empty.
   */
  private composeSystemPrompt(
    systemPrompt: string,
    contextBlock: string,
  ): string {
    if (systemPrompt && contextBlock) {
      return `${systemPrompt}\n\n${contextBlock}`;
    }
    return systemPrompt || contextBlock;
  }

  /** Reset the conversation history and clear the webview. */
  public clear(): void {
    this.saveCurrentConversation();
    this.currentConvId = this.generateId();
    this.history = [];
    this.postMessage({ type: "clear" });
    this.pushHistory();
  }

  /** Send a message to the webview (no-op if the view is not resolved). */
  public postMessage(message: HostToWebviewMessage): void {
    this.webview?.postMessage(message);
  }
}
