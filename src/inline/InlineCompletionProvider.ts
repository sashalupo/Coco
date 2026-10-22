// InlineCompletionProvider.ts — ghost-text (inline) completion via the engine.
//
// `provideInlineCompletionItems` gathers the code around the cursor, builds a
// focused completion prompt (via the pure `inline.ts` helpers), streams a
// completion from the engine, and returns it as an `InlineCompletionItem`.
// The vscode-specific gathering lives here; the prompt building + parsing are
// pure and testable in `inline.ts`.

import * as vscode from "vscode";
import { LlmClient } from "../client";
import { readSettings, ToolbarStateStore } from "../config";
import { buildRequestBody } from "../request";
import {
  buildCompletionPrompt,
  parseCompletion,
  type CompletionContext,
} from "../inline";

/** Max characters of code to include before the cursor. */
const PREFIX_WINDOW = 2000;
/** Max characters of code to include after the cursor (context only). */
const SUFFIX_WINDOW = 500;
/** Cap on the length of the returned completion. */
const MAX_COMPLETION_CHARS = 2000;

export class InlineCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  private readonly toolbarStore: ToolbarStateStore;

  constructor(
    context: vscode.ExtensionContext,
    private readonly client: LlmClient,
  ) {
    this.toolbarStore = ToolbarStateStore.create(context.globalState);
  }

  /**
   * Produce a ghost-text completion at the cursor. Returns an empty array
   * when there is nothing to complete, the engine is unavailable, or the
   * result is empty.
   */
  public async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
  ): Promise<vscode.InlineCompletionItem[]> {
    // Gather the code around the cursor (bounded windows).
    const fullText = document.getText();
    const offset = document.offsetAt(position);
    const prefix = fullText.slice(Math.max(0, offset - PREFIX_WINDOW), offset);
    const suffix = fullText.slice(offset, offset + SUFFIX_WINDOW);

    // Nothing to continue when there is no code before the cursor.
    if (!prefix.trim()) {
      return [];
    }

    const ctx: CompletionContext = {
      language: document.languageId,
      path: this.relativePath(document),
      prefix,
      suffix,
    };
    const prompt = buildCompletionPrompt(ctx);

    // Reuse the chat settings + toolbar (model/context), but force thinking
    // off so ghost text stays fast and direct (reasoning is discarded anyway).
    // 1.98-12: the completions model (llm.completions.model) replaces the chat
    // model for this request; empty → keep llm.model (falls back to engine default).
    const base = readSettings();
    const settings = base.completionsModel
      ? { ...base, model: base.completionsModel }
      : base;
    const toolbar = { ...this.toolbarStore.get(), thinking: "off" as const };
    const { body } = buildRequestBody({ settings, toolbar }, [
      { role: "user", content: prompt },
    ]);

    // Bridge the vscode CancellationToken to a fetch AbortSignal.
    const controller = new AbortController();
    const cancelSub = token.onCancellationRequested(() => controller.abort());

    let content = "";
    try {
      for await (const chunk of this.client.chatStream(
        body,
        controller.signal,
      )) {
        if (chunk.done) {
          break;
        }
        if (chunk.content) {
          content += chunk.content;
          if (content.length > MAX_COMPLETION_CHARS) {
            break;
          }
        }
      }
    } catch {
      // A failed completion is non-fatal: just show nothing.
      return [];
    } finally {
      cancelSub.dispose();
    }

    const completion = parseCompletion(content).slice(0, MAX_COMPLETION_CHARS);
    if (!completion) {
      return [];
    }
    // Ghost text is inserted at the cursor (an empty range at the position).
    const range = new vscode.Range(position, position);
    return [new vscode.InlineCompletionItem(completion, range)];
  }

  /** Workspace-relative path when possible, else the fs path. */
  private relativePath(document: vscode.TextDocument): string {
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    return folder
      ? vscode.workspace.asRelativePath(document.uri)
      : document.uri.fsPath;
  }
}
