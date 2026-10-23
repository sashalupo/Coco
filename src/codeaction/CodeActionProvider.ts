// CodeActionProvider.ts — "Ask LLM to fix/refactor" code actions via the engine.
//
// `provideCodeActions` offers a refactor action (and a quickfix action when the
// range has diagnostics). `resolveCodeAction` gathers the file context, builds
// a fix/refactor prompt (via the pure `codeaction.ts` helpers), streams a reply
// from the engine, and returns the action with a `WorkspaceEdit` that replaces
// the range with the model's suggested code. The vscode-specific gathering
// lives here; the prompt building + parsing are pure and testable in
// `codeaction.ts`.

import * as fs from "fs";
import * as vscode from "vscode";
import { LlmClient } from "../client";
import { readSettings, ToolbarStateStore } from "../config";
import { buildRequestBody } from "../request";
import {
  buildAltTextPrompt,
  buildCodeActionPrompt,
  findImageRef,
  isPlaceholderAlt,
  parseAltText,
  parseCodeAction,
  type CodeActionContext,
  type CodeActionDiagnostic,
  type ImageRef,
} from "../codeaction";

/** Cap on the length of the model's suggested replacement. */
const MAX_EDIT_CHARS = 20000;

/**
 * A code action that carries the range the model's edit should replace.
 * `vscode.CodeAction` has no `range` property (the range is normally implied
 * by the `edit`), so we attach it here and read it back in `resolveCodeAction`
 * (the same object reference is passed to the resolver within the host).
 */
interface RangeCodeAction extends vscode.CodeAction {
  /** The range the model's suggested code should replace. */
  actionRange?: vscode.Range;
  /** Marker: this action generates alt text for an image on the line. */
  isAltText?: boolean;
}

export class CodeActionProvider implements vscode.CodeActionProvider {
  private readonly toolbarStore: ToolbarStateStore;

  constructor(
    context: vscode.ExtensionContext,
    private readonly client: LlmClient,
  ) {
    this.toolbarStore = ToolbarStateStore.create(context.globalState);
  }

  /** The kinds this provider can produce (used at registration). */
  public static readonly providedKinds: vscode.CodeActionKind[] = [
    vscode.CodeActionKind.RefactorRewrite,
    vscode.CodeActionKind.QuickFix,
  ];

  /**
   * Offer code actions for a range. Always offers "Ask LLM to fix/refactor";
   * additionally offers "Fix with LLM" when diagnostics fall in the range.
   * The heavy lifting is deferred to `resolveCodeAction`.
   */
  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: RangeCodeAction[] = [];

    // Always offer the refactor action.
    const refactor: RangeCodeAction = new vscode.CodeAction(
      "Ask LLM to fix/refactor",
      vscode.CodeActionKind.RefactorRewrite,
    );
    refactor.actionRange = range;
    refactor.isPreferred = true;
    actions.push(refactor);

    // Offer a quickfix when diagnostics overlap the range.
    const inRange = context.diagnostics.filter(
      (d) => d.range.intersection(range) !== null,
    );
    if (inRange.length > 0) {
      const fix: RangeCodeAction = new vscode.CodeAction(
        "Fix with LLM",
        vscode.CodeActionKind.QuickFix,
      );
      fix.actionRange = range;
      fix.diagnostics = inRange;
      actions.push(fix);
    }

    // Offer "Generate alt text" on HTML/Markdown image lines whose alt text
    // is empty or a placeholder (gated by `llm.codeAction.altText.enabled`).
    if (
      (document.languageId === "html" || document.languageId === "markdown") &&
      vscode.workspace
        .getConfiguration("llm.codeAction")
        .get<boolean>("altText.enabled", true)
    ) {
      const lineText = document.lineAt(range.start.line).text;
      const ref = findImageRef(lineText);
      if (ref && isPlaceholderAlt(ref.alt)) {
        const alt: RangeCodeAction = new vscode.CodeAction(
          "Generate alt text",
          vscode.CodeActionKind.QuickFix,
        );
        alt.isAltText = true;
        // The alt-text slot on the line (may be an empty range for a missing
        // alt attribute; the resolver inserts the text there).
        alt.actionRange = new vscode.Range(
          range.start.line,
          ref.altStart,
          range.start.line,
          ref.altEnd,
        );
        actions.push(alt);
      }
    }

    return actions;
  }

  /**
   * Resolve an action: build the prompt, stream the model's suggested code,
   * and attach a `WorkspaceEdit` that replaces the action's range. A failed
   * or empty result leaves the action without an edit (no crash).
   */
  public async resolveCodeAction(
    action: vscode.CodeAction,
    token: vscode.CancellationToken,
  ): Promise<vscode.CodeAction> {
    const range = (action as RangeCodeAction).actionRange;
    if (!range) {
      return action;
    }
    // `resolveCodeAction` does not receive the document, so use the active
    // editor's document (the one the action was offered for in practice).
    const doc = vscode.window.activeTextEditor?.document;
    if (!doc) {
      return action;
    }

    // Alt-text action: generate a concise accessibility description for the
    // image on the line and replace the alt-text slot with it.
    if ((action as RangeCodeAction).isAltText) {
      return this.resolveAltText(action, doc, range, token);
    }

    // Gather the file context.
    const diagnostics = this.diagnosticsInRange(doc, range);
    const ctx: CodeActionContext = {
      language: doc.languageId,
      path: this.relativePath(doc),
      code: doc.getText(),
      selection: {
        startLine: range.start.line + 1,
        endLine: range.end.line + 1,
        text: doc.getText(range),
      },
      diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
    };
    const prompt = buildCodeActionPrompt(ctx);

    // Reuse the chat settings + toolbar (model/context), but force thinking
    // off so the fix stays fast and direct.
    const settings = readSettings();
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
          if (content.length > MAX_EDIT_CHARS) {
            break;
          }
        }
      }
    } catch {
      // A failed request is non-fatal: return the action without an edit.
      return action;
    } finally {
      cancelSub.dispose();
    }

    const replacement = parseCodeAction(content).slice(0, MAX_EDIT_CHARS);
    if (!replacement) {
      return action;
    }

    const edit = new vscode.WorkspaceEdit();
    edit.replace(doc.uri, range, replacement);
    action.edit = edit;
    return action;
  }

  /**
   * Resolve a "Generate alt text" action: re-derive the image reference from
   * the line, optionally attach the image as a data URL (when local and
   * `llm.chat.vision.enabled`), ask the model for a concise alt text, and
   * replace the alt-text slot with it. A failed or empty result leaves the
   * action without an edit (no crash).
   */
  private async resolveAltText(
    action: vscode.CodeAction,
    doc: vscode.TextDocument,
    altSlotRange: vscode.Range,
    token: vscode.CancellationToken,
  ): Promise<vscode.CodeAction> {
    const lineText = doc.lineAt(altSlotRange.start.line).text;
    const ref = findImageRef(lineText);
    if (!ref) {
      return action;
    }

    // Attach the image only when it is local (not http(s)/data) and vision is
    // enabled; any read/encode error degrades to text-only.
    const isRemote =
      /^https?:\/\//i.test(ref.src) || ref.src.startsWith("data:");
    const visionEnabled = vscode.workspace
      .getConfiguration("llm.chat")
      .get<boolean>("vision.enabled", true);
    let dataUrl: string | undefined;
    if (!isRemote && visionEnabled) {
      try {
        const imageUri = vscode.Uri.joinPath(doc.uri, ref.src);
        dataUrl = await this.imageDataUrl(imageUri);
      } catch {
        dataUrl = undefined;
      }
    }
    const imageIncluded = dataUrl !== undefined;

    // Context: ±5 lines around the image line.
    const start = Math.max(0, altSlotRange.start.line - 5);
    const end = Math.min(doc.lineCount - 1, altSlotRange.start.line + 5);
    const context = doc
      .getText(new vscode.Range(start, 0, end, 0))
      .split("\n")
      .join("\n");

    const prompt = buildAltTextPrompt(ref.src, context, imageIncluded);

    // Same one-shot pattern as the fix/refactor action: chat settings +
    // toolbar with thinking forced off.
    const settings = readSettings();
    const toolbar = { ...this.toolbarStore.get(), thinking: "off" as const };
    const { body } = buildRequestBody({ settings, toolbar }, [
      {
        role: "user",
        content: prompt,
        ...(imageIncluded ? { images: [dataUrl!] } : {}),
      },
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
          if (content.length > MAX_EDIT_CHARS) {
            break;
          }
        }
      }
    } catch {
      // A failed request is non-fatal: return the action without an edit.
      return action;
    } finally {
      cancelSub.dispose();
    }

    const altText = parseAltText(content);
    if (!altText) {
      return action;
    }

    const edit = new vscode.WorkspaceEdit();
    edit.replace(doc.uri, altSlotRange, altText);
    action.edit = edit;
    return action;
  }

  /**
   * Read an image file and encode it as a `data:image/<mime>;base64,...`
   * URL. Returns `undefined` when the extension is not a known image type or
   * the file cannot be read.
   */
  private async imageDataUrl(uri: vscode.Uri): Promise<string | undefined> {
    const mime = imageMime(uri.path);
    if (!mime) {
      return undefined;
    }
    const buf = await fs.promises.readFile(uri.fsPath);
    return `data:${mime};base64,${buf.toString("base64")}`;
  }

  /** Diagnostics (as plain objects) whose range intersects the given range. */
  private diagnosticsInRange(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): CodeActionDiagnostic[] {
    const all = vscode.languages.getDiagnostics(document.uri);
    return all
      .filter((d) => d.range.intersection(range) !== null)
      .map((d) => ({
        line: d.range.start.line + 1,
        column: d.range.start.character + 1,
        severity: this.severityLabel(d.severity),
        message: d.message,
      }));
  }

  /** Map a `DiagnosticSeverity` to a short label. */
  private severityLabel(severity: vscode.DiagnosticSeverity): string {
    switch (severity) {
      case vscode.DiagnosticSeverity.Error:
        return "error";
      case vscode.DiagnosticSeverity.Warning:
        return "warning";
      case vscode.DiagnosticSeverity.Information:
        return "info";
      default:
        return "hint";
    }
  }

  /** Workspace-relative path when possible, else the fs path. */
  private relativePath(document: vscode.TextDocument): string {
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    return folder
      ? vscode.workspace.asRelativePath(document.uri)
      : document.uri.fsPath;
  }
}

/** Map a file extension to an image MIME type (or `undefined`). */
function imageMime(path: string): string | undefined {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "bmp":
      return "image/bmp";
    case "avif":
      return "image/avif";
    default:
      return undefined;
  }
}
