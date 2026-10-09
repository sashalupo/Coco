// ToolExecutor.ts — execute the workspace tools the engine calls.
//
// vscode-specific: resolves workspace-relative paths safely (no traversal
// outside the workspace) and runs `read_file` / `write_file` / `list_dir` /
// `search_files` against the workspace. Every failure is returned as a
// `ToolResult` (an error message the engine can read), never thrown, so the
// agentic loop can continue.

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import type { ToolCall, ToolResult } from "../tools";

/** Cap on the number of search matches returned. */
const MAX_SEARCH_MATCHES = 50;
/** Cap on the size of a single file read (bytes). */
const MAX_READ_BYTES = 256 * 1024;
/** Directories to skip when searching. */
const SKIP_DIRS = new Set(["node_modules", ".git", "out", "dist", ".vscode"]);

export class ToolExecutor {
  /**
   * Execute a tool call and return its result. Never throws: any error is
   * returned as a `ToolResult` whose `content` describes the failure.
   */
  public async execute(call: ToolCall): Promise<ToolResult> {
    const name = call.function.name;
    let args: Record<string, unknown>;
    try {
      args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
    } catch (err) {
      return this.result(call, `Invalid JSON arguments: ${this.msg(err)}`);
    }

    try {
      switch (name) {
        case "read_file":
          return await this.readFile(call, String(args.path ?? ""));
        case "write_file":
          return await this.writeFile(
            call,
            String(args.path ?? ""),
            String(args.content ?? ""),
          );
        case "list_dir":
          return await this.listDir(call, String(args.path ?? ""));
        case "search_files":
          return await this.searchFiles(
            call,
            String(args.pattern ?? ""),
            args.path ? String(args.path) : undefined,
          );
        default:
          return this.result(call, `Unknown tool: ${name}`);
      }
    } catch (err) {
      return this.result(call, `Tool ${name} failed: ${this.msg(err)}`);
    }
  }

  // --- Tools -------------------------------------------------------------

  private async readFile(call: ToolCall, relPath: string): Promise<ToolResult> {
    const abs = await this.resolveSafe(relPath);
    if (!abs) {
      return this.result(
        call,
        `Path not allowed (outside workspace): ${relPath}`,
      );
    }
    const stat = await fs.promises.stat(abs);
    if (!stat.isFile()) {
      return this.result(call, `Not a file: ${relPath}`);
    }
    if (stat.size > MAX_READ_BYTES) {
      return this.result(
        call,
        `File too large to read (${stat.size} bytes): ${relPath}`,
      );
    }
    const content = await fs.promises.readFile(abs, "utf8");
    return this.result(call, content);
  }

  private async writeFile(
    call: ToolCall,
    relPath: string,
    content: string,
  ): Promise<ToolResult> {
    const abs = await this.resolveSafe(relPath);
    if (!abs) {
      return this.result(
        call,
        `Path not allowed (outside workspace): ${relPath}`,
      );
    }
    await fs.promises.mkdir(path.dirname(abs), { recursive: true });
    await fs.promises.writeFile(abs, content, "utf8");
    return this.result(
      call,
      `Wrote ${content.length} characters to ${relPath}`,
    );
  }

  private async listDir(call: ToolCall, relPath: string): Promise<ToolResult> {
    const abs = await this.resolveSafe(relPath);
    if (!abs) {
      return this.result(
        call,
        `Path not allowed (outside workspace): ${relPath}`,
      );
    }
    const entries = await fs.promises.readdir(abs, { withFileTypes: true });
    const lines = entries
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
    return this.result(
      call,
      lines.length ? lines.join("\n") : "(empty directory)",
    );
  }

  private async searchFiles(
    call: ToolCall,
    pattern: string,
    relPath?: string,
  ): Promise<ToolResult> {
    const rootRel = relPath ?? ".";
    const rootAbs = await this.resolveSafe(rootRel);
    if (!rootAbs) {
      return this.result(
        call,
        `Path not allowed (outside workspace): ${rootRel}`,
      );
    }
    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch {
      // Fall back to a literal search if the pattern is not a valid regex.
      regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    }

    const matches: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      if (matches.length >= MAX_SEARCH_MATCHES) {
        return;
      }
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        if (matches.length >= MAX_SEARCH_MATCHES) {
          return;
        }
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (!SKIP_DIRS.has(e.name)) {
            await walk(full);
          }
        } else if (e.isFile()) {
          const fileMatches = await this.searchFile(full, regex);
          matches.push(...fileMatches);
        }
      }
    };
    await walk(rootAbs);

    if (matches.length === 0) {
      return this.result(call, `No matches for /${pattern}/`);
    }
    const suffix =
      matches.length >= MAX_SEARCH_MATCHES
        ? `\n… (truncated at ${MAX_SEARCH_MATCHES})`
        : "";
    return this.result(call, matches.join("\n") + suffix);
  }

  // --- Helpers -----------------------------------------------------------

  /** Search a single file for the pattern; return `relPath:line: text` lines. */
  private async searchFile(file: string, regex: RegExp): Promise<string[]> {
    const out: string[] = [];
    let text: string;
    try {
      const stat = await fs.promises.stat(file);
      if (stat.size > MAX_READ_BYTES) {
        return out; // skip large files
      }
      text = await fs.promises.readFile(file, "utf8");
    } catch {
      return out; // unreadable/binary: skip
    }
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        const rel = this.toWorkspaceRelative(file);
        out.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
      }
    }
    return out;
  }

  /**
   * Resolve a workspace-relative path to an absolute path, rejecting any
   * path that escapes the workspace (e.g. `../../etc/passwd`). Returns
   * `null` when the path is not allowed or there is no workspace.
   */
  private async resolveSafe(relPath: string): Promise<string | null> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return null;
    }
    const root = folders[0].uri.fsPath;
    const abs = path.resolve(root, relPath);
    // The resolved path must be the root itself or inside it.
    const rel = path.relative(root, abs);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      return null;
    }
    return abs;
  }

  /** Workspace-relative path for display (falls back to the absolute path). */
  private toWorkspaceRelative(abs: string): string {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return abs;
    }
    const root = folders[0].uri.fsPath;
    const rel = path.relative(root, abs);
    return rel.startsWith("..") ? abs : rel;
  }

  /** Build a `ToolResult` for the given call. */
  private result(call: ToolCall, content: string): ToolResult {
    return { tool_call_id: call.id, content };
  }

  /** Short error message. */
  private msg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
