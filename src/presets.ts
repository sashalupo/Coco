// presets.ts — pure, engine-agnostic presets and shared types.
//
// No `vscode` import: this module is safe to load under plain Node (tests,
// tooling). Both `config.ts` (settings/toolbar state) and `request.ts`
// (request building) import from here so the preset tables have a single
// source of truth.

import type { McpServerConfig } from "./mcp";

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
  /** Auto-approve all mutating tools without asking (experimental). */
  autoApprove: boolean;
  context: ContextFlags;
  /** Enable auto-loading of custom instruction files (AGENTS.md, etc.). */
  instructionsEnabled: boolean;
  /** Extra workspace-relative instruction file paths (in addition to defaults). */
  instructionFiles: string[];
  /** Glob patterns (workspace-relative) for reusable prompt files. */
  promptFiles: string[];
  /** Enable `.instructions.md` discovery + `applyTo` auto-attach. */
  instructionsFilesEnabled: boolean;
  /** Glob patterns (workspace-relative) for `.instructions.md` files. */
  instructionsFilesLocations: string[];
  /** Enable the `#codebase` chat tag (workspace sweep injected as context). */
  codebaseSearchEnabled: boolean;
  /** Enable the `#problems` chat tag (diagnostics injected as context). */
  problemsEnabled: boolean;
  /** Enable the `#folder:` chat tag (folder tree injected as context). */
  folderContextEnabled: boolean;
  /** Enable the `#fetch` chat tag (webpage content injected as context). */
  fetchEnabled: boolean;
  /** Token budget (estimated as chars/3.5) for `#fetch`/`fetch_url` page content; 0 disables the budget. */
  fetchMaxTokens: number;
  /** Enable the `#usages` chat tag (workspace usages report injected as context). */
  usagesEnabled: boolean;
  /** Allow the #newWorkspace tag to inject a project scaffold prompt. */
  newWorkspaceEnabled: boolean;
  /** Enable the `#searchResults` chat tag (workspace text-search results injected as context). */
  searchResultsEnabled: boolean;
  /** Enable the `new_notebook` agent tool (create a new Jupyter notebook planned from a query). */
  newNotebookEnabled: boolean;
  /** Model for inline completions. Empty = use the main chat model. */
  completionsModel: string;
  /** Auto-fix new errors introduced by agent-mode file edits (up to 2 follow-up rounds per run). */
  agentAutoFix: boolean;
  /** Prompt the agent about manual edits the user makes to files during an agent run. */
  agentTrackManualEdits: boolean;
  /** Automatically summarize older conversation turns when the estimated history crosses the token threshold. */
  chatSummarizeEnabled: boolean;
  /** Fraction of the selected context budget at which the conversation is summarized (0 disables). */
  chatSummarizeThreshold: number;
  /** MCP server configurations (name → command/args/env). */
  mcpServers: Record<string, McpServerConfig>;
}

/** Toolbar override state. `model: null` means "use settings / first model". */
export interface ToolbarState {
  model: string | null;
  thinking: ThinkingLevel;
  context: ContextLevel;
  contextFlags: ContextFlags;
  mode: ChatMode;
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

/**
 * Case-insensitive markers of known vision-capable local model families.
 * Used for the non-blocking "model may not support images" warning.
 */
export const VISION_MODEL_MARKERS: string[] = [
  "llava",
  "qwen2.5-vl",
  "qwen2-vl",
  "qwen3-vl",
  "minicpm-v",
  "minicpm-v2",
  "glm-4v",
  "glm-4.1v",
  "internvl",
  "pixtral",
  "gemma-3",
  "moondream",
  "bakllava",
  "mistral-small-3.1",
  "llama3.2-vision",
  "llama-4",
];

/**
 * Heuristic: does this model ID look vision-capable?
 * Empty/whitespace → false (conservative). Otherwise a case-insensitive
 * substring match against any marker in `VISION_MODEL_MARKERS`.
 */
export function isVisionCapableModel(model: string): boolean {
  const m = model.trim().toLowerCase();
  if (m === "") {
    return false;
  }
  return VISION_MODEL_MARKERS.some((marker) => m.includes(marker));
}

/**
 * Engine health snapshot for the status indicator.
 * Structural subset of `HealthResult` in `client.ts` — declared here so this
 * module stays vscode-free and dependency-free.
 */
export interface EngineStatus {
  ok: boolean;
  status: number;
  statusText: string;
  error?: string;
}

/**
 * Status-bar label for the engine indicator.
 * `$(check) LLM` when healthy, `$(error) LLM` otherwise.
 */
export function statusLabel(s: EngineStatus): { icon: string; text: string } {
  return s.ok ? { icon: "$(check)", text: "LLM" } : { icon: "$(error)", text: "LLM" };
}

/**
 * Status-bar tooltip for the engine indicator.
 * Healthy: `LLM engine healthy (<status> <statusText>) — <baseUrl>`.
 * Unreachable: `LLM engine unreachable — <baseUrl>: <error>` (or `(<status>)`
 * when no error text is available).
 */
export function statusTooltip(s: EngineStatus, baseUrl: string): string {
  if (s.ok) {
    return `LLM engine healthy (${s.status} ${s.statusText}) — ${baseUrl}`;
  }
  return `LLM engine unreachable — ${baseUrl}${s.error ? `: ${s.error}` : ` (${s.status})`}`;
}

/**
 * Status-bar label for the inline-completions indicator.
 * Active (enabled + an editor is focused): `$(pass-filled) LLM`.
 * Idle/disabled: `$(pass-filled~strikethrough) LLM` with a tooltip explaining
 * why (no active editor vs. feature disabled).
 */
export function completionsStatusLabel(
  enabled: boolean,
  hasActiveEditor: boolean,
): { icon: string; text: string; tooltip: string } {
  if (enabled && hasActiveEditor) {
    return {
      icon: "$(pass-filled)",
      text: "LLM",
      tooltip: "Code completions enabled for the active editor",
    };
  }
  return {
    icon: "$(pass-filled~strikethrough)",
    text: "LLM",
    tooltip: enabled
      ? "No active editor — code completions idle"
      : "Code completions disabled (llm.inline.enabled)",
  };
}

/** One row in the status overview QuickPick. */
export interface StatusOverviewItem {
  label: string;
  description?: string;
  detail?: string;
  command?: string;
}

/**
 * Build the 5 info rows of the status overview:
 * engine state, endpoint, chat model, completions model, completions state.
 * Pure: no vscode, no network.
 */
export function statusOverviewItems(
  s: EngineStatus,
  baseUrl: string,
  chatModel: string,
  completionsModel: string,
  completionsEnabled: boolean = false,
): StatusOverviewItem[] {
  return [
    s.ok
      ? { label: "Engine: running", description: s.statusText }
      : { label: "Engine: stopped", description: s.error || s.statusText },
    { label: "Endpoint", description: baseUrl },
    { label: "Chat model", description: chatModel || "default (engine)" },
    { label: "Completions model", description: completionsModel || "chat model (default)" },
    { label: "Completions", description: completionsEnabled ? "on (active editor)" : "off" },
  ];
}

/** Useful commands listed in the status overview QuickPick. */
export const STATUS_COMMANDS: readonly {
  label: string;
  command: string;
  detail: string;
}[] = [
  { label: "Open Chat", command: "llm.openChat", detail: "Open the LLM chat panel" },
  {
    label: "Test Connection",
    command: "llm.testConnection",
    detail: "Ping the engine health endpoint",
  },
  {
    label: "Refresh Models",
    command: "llm.refreshModels",
    detail: "Re-fetch the model list from the engine",
  },
  {
    label: "Change Completions Model",
    command: "llm.changeCompletionsModel",
    detail: "Pick the model used for inline completions",
  },
  {
    label: "Toggle Completions",
    command: "llm.toggleCompletions",
    detail: "Enable/disable inline code completions (reload required)",
  },
];

/** Scope a remembered tool approval applies to. */
export type ApprovalScope = "session" | "workspace" | "global";

/** Structural memento (workspaceState / globalState) — keeps this module vscode-free. */
export interface MementoLike {
  get(key: string): unknown;
  update(key: string, value: unknown): PromiseLike<void>;
}

/**
 * Remembered tool approvals (1.99-8). Session approvals live in memory (cleared on
 * reload); workspace/global approvals persist as JSON string arrays in the given
 * mementos. Pure — no vscode import, smoke-testable via out/presets.js.
 */
export class ApprovalStore {
  private static readonly WORKSPACE_KEY = "llm.approvals.workspace";
  private static readonly GLOBAL_KEY = "llm.approvals.global";
  private readonly session = new Set<string>();

  constructor(
    private readonly workspace: MementoLike,
    private readonly global: MementoLike,
  ) {}

  /** True if the tool is approved for this session, workspace, or globally. */
  isApproved(tool: string): boolean {
    if (this.session.has(tool)) return true;
    return (
      this.readArray(ApprovalStore.WORKSPACE_KEY, this.workspace).includes(tool) ||
      this.readArray(ApprovalStore.GLOBAL_KEY, this.global).includes(tool)
    );
  }

  /** Remember an approval at the given scope (dedupes persisted arrays). */
  remember(tool: string, scope: ApprovalScope): void {
    if (scope === "session") {
      this.session.add(tool);
      return;
    }
    const memento = scope === "workspace" ? this.workspace : this.global;
    const key =
      scope === "workspace"
        ? ApprovalStore.WORKSPACE_KEY
        : ApprovalStore.GLOBAL_KEY;
    const arr = this.readArray(key, memento);
    if (!arr.includes(tool)) arr.push(tool);
    void memento.update(key, arr);
  }

  /** Sorted union of all approved tool names (session ∪ workspace ∪ global). */
  listApproved(): string[] {
    const set = new Set<string>(this.session);
    for (const t of this.readArray(ApprovalStore.WORKSPACE_KEY, this.workspace)) {
      set.add(t);
    }
    for (const t of this.readArray(ApprovalStore.GLOBAL_KEY, this.global)) {
      set.add(t);
    }
    return [...set].sort();
  }

  private readArray(key: string, memento: MementoLike): string[] {
    const v = memento.get(key);
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is string => typeof x === "string");
  }
}

/** Unified Chat view mode (toolbar override, not a setting). */
export type ChatMode = "ask" | "agent" | "edit";

/** All chat modes, in display order. */
export const CHAT_MODES: readonly ChatMode[] = ["ask", "agent", "edit"];

/** Coerce an unknown value (e.g. from a memento) to a valid ChatMode. */
export function normalizeChatMode(v: unknown): ChatMode {
  return v === "ask" || v === "agent" || v === "edit" ? v : "agent";
}

/** System-prompt addendum for Edit mode. */
export const EDIT_MODE_ADDENDUM: string =
  "You are in Edit mode. Focus on making precise, minimal changes to the user's code. Use the file tools (read_file, edit_file, write_file) to inspect and modify files, and present a short summary of the changes you made (files touched and what changed) instead of long explanations.";

/** System-prompt addendum for a chat mode ("" = no addendum). */
export function modeAddendum(mode: ChatMode): string {
  if (mode === "edit") return EDIT_MODE_ADDENDUM;
  if (mode === "ask")
    return "You are in Ask mode. Answer the user's question directly. Do not use tools or modify files.";
  return "";
}
