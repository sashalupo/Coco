// config.ts — settings access + toolbar override state.
//
// Reads all `llm.*` settings and manages the runtime toolbar overrides
// (Model / Thinking / Context) persisted in a Memento. Pure data access:
// no network, no request building (that lives in request.ts).

import * as vscode from "vscode";
import type {
  ContextFlags,
  ContextLevel,
  LlmSettings,
  ThinkingLevel,
  ToolbarState,
} from "./presets";
import { DEFAULT_CONTEXT_FLAGS } from "./presets";

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
    context: {
      includeFile: c.get<boolean>("context.includeFile", true),
      includeSelection: c.get<boolean>("context.includeSelection", true),
      includeDiagnostics: c.get<boolean>("context.includeDiagnostics", true),
    },
  };
}

const DEFAULT_TOOLBAR: ToolbarState = {
  model: null,
  thinking: "off",
  context: "auto",
  contextFlags: { ...DEFAULT_CONTEXT_FLAGS },
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
    return {
      ...state,
      contextFlags: { ...DEFAULT_CONTEXT_FLAGS, ...state.contextFlags },
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
