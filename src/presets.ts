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
  /** Enable the `#codebase` chat tag (workspace sweep injected as context). */
  codebaseSearchEnabled: boolean;
  /** Enable the `#problems` chat tag (diagnostics injected as context). */
  problemsEnabled: boolean;
  /** Enable the `#folder:` chat tag (folder tree injected as context). */
  folderContextEnabled: boolean;
}

/** Toolbar override state. `model: null` means "use settings / first model". */
export interface ToolbarState {
  model: string | null;
  thinking: ThinkingLevel;
  context: ContextLevel;
  contextFlags: ContextFlags;
}

/** One entry in the "Change Completions Model" quick pick. */
export interface CompletionsModelOption {
  /** Model ID to write to llm.completions.model ("" = use chat model). */
  value: string;
  /** Display label. */
  label: string;
  /** True when this is the currently active completions model. */
  picked: boolean;
}

/**
 * Build the quick-pick list for the Change Completions Model command.
 * Pure: no vscode, no network.
 * - First entry is always "Use chat model (default)" (value "").
 * - Then the current completions model (if non-empty and ≠ chat model),
 *   the chat model (if non-empty), then engine models — deduped by value.
 * - `picked` is true on the entry matching `current` ("" → the default entry).
 */
export function buildCompletionsModelList(
  current: string,
  chatModel: string,
  engineModels: readonly string[],
): CompletionsModelOption[] {
  const list: CompletionsModelOption[] = [
    { value: "", label: "Use chat model (default)", picked: current === "" },
  ];
  const seen = new Set<string>([""]);
  const candidates: string[] = [];
  if (current !== "" && current !== chatModel) {
    candidates.push(current);
  }
  if (chatModel !== "") {
    candidates.push(chatModel);
  }
  for (const m of engineModels) {
    candidates.push(m);
  }
  for (const value of candidates) {
    if (value === "" || seen.has(value)) {
      continue;
    }
    seen.add(value);
    list.push({ value, label: value, picked: value === current });
  }
  return list;
}
