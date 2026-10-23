// config.ts — settings access + toolbar override state.
//
// Reads all `llm.*` settings and manages the runtime toolbar overrides
// (Model / Thinking / Context) persisted in a Memento. Pure data access:
// no network, no request building (that lives in request.ts).

import * as vscode from "vscode";
import type {
  ChatMode,
  ContextFlags,
  ContextLevel,
  LlmSettings,
  ThinkingLevel,
  ToolbarState,
} from "./presets";
import { DEFAULT_CONTEXT_FLAGS, normalizeChatMode } from "./presets";
import type { ChatMessage } from "./request";
import { parseMcpServers } from "./mcp";

// Re-export the pure presets/types so existing importers of config.ts keep
// working. (request.ts imports from ./presets directly to stay vscode-free.)
export {
  CONTEXT_LEVELS,
  CONTEXT_TO_TOKENS,
  THINKING_LEVELS,
  THINKING_TO_EFFORT,
} from "./presets";
export type {
  ContextLevel,
  LlmSettings,
  ThinkingLevel,
  ToolbarState,
} from "./presets";

/**
 * Read all `llm.*` settings from the workspace configuration.
 * Defaults mirror the `package.json` contribution so the extension behaves
 * sensibly even if a setting is missing.
 */
export function readSettings(): LlmSettings {
  const c = vscode.workspace.getConfiguration("llm");
  return {
    baseUrl: c.get<string>("baseUrl", "http://localhost:8080"),
    apiKey: c.get<string>("apiKey", ""),
    model: c.get<string>("model", ""),
    systemPrompt: c.get<string>("systemPrompt", ""),
    temperature: c.get<number>("temperature", 1.0),
    topP: c.get<number>("topP", 1.0),
    topK: c.get<number>("topK", 20),
    minP: c.get<number>("minP", 0.0),
    presencePenalty: c.get<number>("presencePenalty", 0),
    frequencyPenalty: c.get<number>("frequencyPenalty", 0),
    seed: c.get<string>("seed", ""),
    stop: c.get<string[]>("stop", []),
    maxCompletionTokens: c.get<number>("maxCompletionTokens", 4096),
    preserveThinking: c.get<boolean>("preserveThinking", false),
    stream: c.get<boolean>("stream", true),
    includeUsage: c.get<boolean>("includeUsage", true),
    responseFormat: c.get<string>("responseFormat", "text"),
    chatTemplateKwargs: c.get<Record<string, unknown>>(
      "chatTemplateKwargs",
      {},
    ),
    toolsEnabled: c.get<boolean>("tools.enabled", false),
    requireApproval: c.get<boolean>("tools.requireApproval", false),
    autoApprove: c.get<boolean>("tools.autoApprove", false),
    context: {
      includeFile: c.get<boolean>("context.includeFile", true),
      includeSelection: c.get<boolean>("context.includeSelection", true),
      includeDiagnostics: c.get<boolean>("context.includeDiagnostics", true),
    },
    instructionsEnabled: c.get<boolean>("instructions.enabled", true),
    instructionFiles: c.get<string[]>("instructions.files", []),
    promptFiles: c.get<string[]>("promptFiles.locations", [".prompts/**/*.prompt.md", ".github/copilot-instructions.md"]),
    instructionsFilesEnabled: c.get<boolean>("instructionsFiles.enabled", true),
    instructionsFilesLocations: c.get<string[]>("instructionsFiles.locations", ["**/*.instructions.md"]),
    codebaseSearchEnabled: c.get<boolean>("chat.codebaseSearch.enabled", true),
    problemsEnabled: c.get<boolean>("chat.problems.enabled", true),
    folderContextEnabled: c.get<boolean>("chat.folderContext.enabled", true),
    fetchEnabled: c.get<boolean>("chat.fetch.enabled", true),
    fetchMaxTokens: c.get<number>("chat.fetch.maxTokens", 5000),
    usagesEnabled: c.get<boolean>("chat.usages.enabled", true),
    newWorkspaceEnabled: c.get<boolean>("chat.newWorkspace.enabled", true),
    searchResultsEnabled: c.get<boolean>("chat.searchResults.enabled", true),
    newNotebookEnabled: c.get<boolean>("chat.newNotebook.enabled", true),
    notebookToolsEnabled: c.get<boolean>("chat.notebookTools.enabled", true),
    completionsModel: c.get<string>("completions.model", ""),
    agentAutoFix: c.get<boolean>("agent.autoFix", true),
    agentTrackManualEdits: c.get<boolean>("agent.trackManualEdits", true),
    chatSummarizeEnabled: c.get<boolean>("chat.summarize.enabled", true),
    chatSummarizeThreshold: c.get<number>("chat.summarize.threshold", 0.7),
    mcpServers: parseMcpServers(c.get<unknown>("mcp.servers", {})),
  };
}

const DEFAULT_TOOLBAR: ToolbarState = {
  model: null,
  thinking: "off",
  context: "auto",
  contextFlags: { ...DEFAULT_CONTEXT_FLAGS },
  mode: "agent",
};

const TOOLBAR_KEY = "llm.toolbar";

/**
 * Persists the runtime toolbar overrides (Model / Thinking / Context) in a
 * Memento so they survive reloads. Reads are synchronous (in-memory); writes
 * are persisted asynchronously by VS Code.
 */
export class ToolbarStateStore {
  private constructor(private readonly memento: vscode.Memento) {}

  /** Create a store backed by the given Memento (usually `context.globalState`). */
  static create(memento: vscode.Memento): ToolbarStateStore {
    return new ToolbarStateStore(memento);
  }

  /** Read the current toolbar state (defaults if never set). */
  get(): ToolbarState {
    const state = this.memento.get<ToolbarState>(TOOLBAR_KEY, DEFAULT_TOOLBAR);
    // Backfill `contextFlags` for state saved before S15 introduced it.
    // Backfill `mode` for state saved before 1.99-10 introduced it.
    return {
      ...state,
      contextFlags: { ...DEFAULT_CONTEXT_FLAGS, ...state.contextFlags },
      mode: normalizeChatMode(state.mode),
    };
  }

  /** Override the model. Pass `null` to clear the override. */
  setModel(model: string | null): Thenable<void> {
    return this.memento.update(TOOLBAR_KEY, { ...this.get(), model });
  }

  /** Override the thinking level. */
  setThinking(thinking: ThinkingLevel): Thenable<void> {
    return this.memento.update(TOOLBAR_KEY, { ...this.get(), thinking });
  }

  /** Override the context budget. */
  setContext(context: ContextLevel): Thenable<void> {
    return this.memento.update(TOOLBAR_KEY, { ...this.get(), context });
  }

  /** Override the unified chat mode (ask / agent / edit). */
  setMode(mode: ChatMode): Thenable<void> {
    return this.memento.update(TOOLBAR_KEY, { ...this.get(), mode });
  }

  /** Override which editor-context sections to inject. */
  setContextFlags(flags: ContextFlags): Thenable<void> {
    return this.memento.update(TOOLBAR_KEY, {
      ...this.get(),
      contextFlags: flags,
    });
  }

  /** Reset all overrides back to defaults. */
  reset(): Thenable<void> {
    return this.memento.update(TOOLBAR_KEY, DEFAULT_TOOLBAR);
  }
}

const CONVERSATIONS_KEY = "llm.conversations";

/** A single saved conversation. */
export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
}

/**
 * Persists multiple chat conversations in a Memento so they survive VS Code
 * restarts. Reads are synchronous (in-memory); writes are persisted
 * asynchronously by VS Code.
 */
export class ConversationStore {
  private constructor(private readonly memento: vscode.Memento) {}

  /** Create a store backed by the given Memento (usually `context.globalState`). */
  static create(memento: vscode.Memento): ConversationStore {
    return new ConversationStore(memento);
  }

  /** Read all persisted conversations (empty array if never set). */
  getAll(): Conversation[] {
    return this.memento.get<Conversation[]>(CONVERSATIONS_KEY, []);
  }

  /** Persist the full conversation list. */
  setAll(conversations: Conversation[]): Thenable<void> {
    return this.memento.update(CONVERSATIONS_KEY, conversations);
  }

  /**
   * Save or update a single conversation. If the id already exists it is
   * replaced; otherwise it is prepended (newest first).
   */
  upsert(conv: Conversation): Thenable<void> {
    const all = this.getAll();
    const idx = all.findIndex((c) => c.id === conv.id);
    if (idx >= 0) {
      all[idx] = conv;
    } else {
      all.unshift(conv);
    }
    return this.memento.update(CONVERSATIONS_KEY, all);
  }

  /** Remove a conversation by id. */
  remove(id: string): Thenable<void> {
    const all = this.getAll().filter((c) => c.id !== id);
    return this.memento.update(CONVERSATIONS_KEY, all);
  }

  /** Rename a conversation by id. No-op when the id is not found. */
  rename(id: string, title: string): Thenable<void> {
    const all = this.getAll();
    const idx = all.findIndex((c) => c.id === id);
    if (idx < 0) {
      return Promise.resolve();
    }
    all[idx] = { ...all[idx], title };
    return this.memento.update(CONVERSATIONS_KEY, all);
  }

  /** Clear all conversations. */
  clear(): Thenable<void> {
    return this.memento.update(CONVERSATIONS_KEY, []);
  }
}
