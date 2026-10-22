// presets.ts — pure, engine-agnostic presets and shared types.
//
// No `vscode` import: this module is safe to load under plain Node (tests,
// tooling). Both `config.ts` (settings/toolbar state) and `request.ts`
// (request building) import from here so the preset tables have a single
// source of truth.

/** Thinking presets shown in the chat toolbar. */
export type ThinkingLevel = "off" | "low" | "medium" | "high" | "max";

/** Maps a toolbar thinking preset to the engine's `reasoning_effort`. */
export const THINKING_TO_EFFORT: Record<ThinkingLevel, string> = {
  off: "none",
  low: "low",
  medium: "medium",
  high: "high",
  max: "xhigh",
};

/** Ordered list of thinking presets for the toolbar dropdown. */
export const THINKING_LEVELS: readonly ThinkingLevel[] = [
  "off",
  "low",
  "medium",
  "high",
  "max",
];

/** Context-budget presets shown in the chat toolbar. */
export type ContextLevel = "auto" | "32k" | "64k" | "128k" | "240k";

/** Maps a context preset to a token budget (0 = auto / unbounded). */
export const CONTEXT_TO_TOKENS: Record<ContextLevel, number> = {
  auto: 0,
  "32k": 32_000,
  "64k": 64_000,
  "128k": 128_000,
  "240k": 240_000,
};

/** Ordered list of context presets for the toolbar dropdown. */
export const CONTEXT_LEVELS: readonly ContextLevel[] = [
  "auto",
  "32k",
  "64k",
  "128k",
  "240k",
];

/** Which editor-context sections to inject into the request. */
export interface ContextFlags {
  includeFile: boolean;
  includeSelection: boolean;
  includeDiagnostics: boolean;
}

/** Default context flags: include everything. */
export const DEFAULT_CONTEXT_FLAGS: ContextFlags = {
  includeFile: true,
  includeSelection: true,
  includeDiagnostics: true,
};

/** All `llm.*` settings, read as a plain typed object. */
export interface LlmSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  topP: number;
  topK: number;
  minP: number;
  presencePenalty: number;
  frequencyPenalty: number;
  seed: string;
  stop: string[];
  maxCompletionTokens: number;
  preserveThinking: boolean;
  stream: boolean;
  includeUsage: boolean;
  responseFormat: string;
  chatTemplateKwargs: Record<string, unknown>;
  toolsEnabled: boolean;
  requireApproval: boolean;
  context: ContextFlags;
  /** Enable auto-loading of custom instruction files (AGENTS.md, etc.). */
  instructionsEnabled: boolean;
  /** Extra workspace-relative instruction file paths (in addition to defaults). */
  instructionFiles: string[];
}

/** Toolbar override state. `model: null` means "use settings / first model". */
export interface ToolbarState {
  model: string | null;
  thinking: ThinkingLevel;
  context: ContextLevel;
  contextFlags: ContextFlags;
}
