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
import { spawn } from "child_process";
import type { ToolCall, ToolResult } from "../tools";
import { unifiedDiff } from "../diff";

/** Cap on the number of search matches returned. */
const MAX_SEARCH_MATCHES = 50;
/** Cap on the size of a single file read (bytes). */
const MAX_READ_BYTES = 256 * 1024;
/** Directories to skip when searching. */
const SKIP_DIRS = new Set(["node_modules", ".git", "out", "dist", ".vscode"]);
/** Default timeout for run_command (ms). */
const DEFAULT_COMMAND_TIMEOUT = 60_000;
/** Maximum timeout for run_command (ms). */
const MAX_COMMAND_TIMEOUT = 60_000;
/** Cap on command output (chars). */
const MAX_COMMAND_OUTPUT = 100_000;

export class ToolExecutor {
  /** Snapshot of the last mutation (for undo / revert). */
  private lastSnapshot: {
    relPath: string;
    oldContent: string;
    existed: boolean;
  } | null = null;

  /** Whether there is a mutation to revert. */
  public get hasLastSnapshot(): boolean {
    return this.lastSnapshot !== null;
  }

  /**
   * Revert the last mutation: restore the pre-mutation content (or delete
   * the file if it was newly created). Returns a human-readable message.
   */
  public async revertLast(): Promise<string> {
    if (!this.lastSnapshot) {
      return "No changes to revert.";
    }
    const { relPath, oldContent, existed } = this.lastSnapshot;
    this.lastSnapshot = null;
    const abs = await this.resolveSafe(relPath);
    if (!abs) {
      return `Cannot revert: path not allowed (${relPath}).`;
    }
    try {
      if (!existed) {
        // The file was newly created — delete it.
        await fs.promises.unlink(abs);
        return `Reverted: deleted ${relPath} (was newly created).`;
      }
      await fs.promises.writeFile(abs, oldContent, "utf8");
      return `Reverted ${relPath} (${oldContent.length} chars restored).`;
    } catch (err) {
      return `Revert failed: ${this.msg(err)}`;
    }
  }

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
          return await this.readFile(
            call,
            String(args.path ?? ""),
            typeof args.start_line === "number" ? args.start_line : undefined,
            typeof args.end_line === "number" ? args.end_line : undefined,
          );
        case "write_file":
          return await this.writeFile(
            call,
            String(args.path ?? ""),
            String(args.content ?? ""),
          );
        case "edit_file":
          return await this.editFile(
            call,
            String(args.path ?? ""),
            String(args.old_string ?? ""),
            String(args.new_string ?? ""),
            args.replace_all === true,
          );
        case "list_dir":
          return await this.listDir(call, String(args.path ?? ""));
        case "search_files":
          return await this.searchFiles(
            call,
            String(args.pattern ?? ""),
            args.path ? String(args.path) : undefined,
          );
        case "run_command":
          return await this.runCommand(
            call,
            String(args.command ?? ""),
            typeof args.timeout_ms === "number" ? args.timeout_ms : undefined,
          );
        default:
          return this.result(call, `Unknown tool: ${name}`);
      }
    } catch (err) {
      return this.result(call, `Tool ${name} failed: ${this.msg(err)}`);
    }
  }

  // --- Tools -------------------------------------------------------------

  private async readFile(
    call: ToolCall,
    relPath: string,
    startLine?: number,
    endLine?: number,
  ): Promise<ToolResult> {
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
    // No line range: return the whole file (current behavior).
    if (startLine === undefined && endLine === undefined) {
      return this.result(call, content);
    }
    const lines = content.split(/\r?\n/);
    const total = lines.length;
    // Clamp to valid 1-based range.
    const start = Math.max(1, startLine ?? 1);
    const end = Math.min(total, endLine ?? total);
    if (start > end) {
      return this.result(
        call,
        `Invalid line range: start_line ${start} > end_line ${end} (file has ${total} lines).`,
      );
    }
    const slice = lines.slice(start - 1, end);
    const header = `Lines ${start}–${end} of ${total} in ${relPath}:\n`;
    return this.result(call, header + slice.join("\n"));
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
    // Read the old content (if the file exists) for the diff preview and
    // the undo snapshot.
    let oldContent = "";
    let existed = false;
    try {
      oldContent = await fs.promises.readFile(abs, "utf8");
      existed = true;
    } catch {
      // File does not exist yet — old content is empty.
    }
    this.lastSnapshot = { relPath, oldContent, existed };
    await fs.promises.mkdir(path.dirname(abs), { recursive: true });
    await fs.promises.writeFile(abs, content, "utf8");
    const diff = unifiedDiff(oldContent, content, relPath, relPath);
    const diffBlock = diff ? `\n\nDiff:\n${diff}` : "";
    return this.result(
      call,
      `Wrote ${content.length} characters to ${relPath}${diffBlock}`,
    );
  }

  private async editFile(
    call: ToolCall,
    relPath: string,
    oldString: string,
    newString: string,
    replaceAll: boolean,
  ): Promise<ToolResult> {
    if (oldString === "") {
      return this.result(
        call,
        "old_string is empty — provide the exact text to replace.",
      );
    }
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
        `File too large to edit (${stat.size} bytes): ${relPath}`,
      );
    }
    const content = await fs.promises.readFile(abs, "utf8");
    const count = this.countOccurrences(content, oldString);
    if (count === 0) {
      return this.result(
        call,
        `old_string not found in ${relPath} — re-read the file and copy the ` +
          `exact text (including whitespace and indentation).`,
      );
    }
    if (count > 1 && !replaceAll) {
      return this.result(
        call,
        `old_string is not unique in ${relPath} (${count} matches) — add more ` +
          `surrounding context to make it unique, or set replace_all=true.`,
      );
    }
    const replaced = replaceAll
      ? content.split(oldString).join(newString)
      : content.replace(oldString, newString);
    this.lastSnapshot = { relPath, oldContent: content, existed: true };
    await fs.promises.writeFile(abs, replaced, "utf8");
    const n = replaceAll ? count : 1;
    const diff = unifiedDiff(content, replaced, relPath, relPath);
    const diffBlock = diff ? `\n\nDiff:\n${diff}` : "";
    return this.result(
      call,
      `Replaced ${n} occurrence${n === 1 ? "" : "s"} in ${relPath} ` +
        `(${oldString.length} chars → ${newString.length} chars)${diffBlock}`,
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

  /**
   * Run a shell command in the workspace root, capture stdout+stderr,
   * enforce a timeout and an output cap. Returns exit code + output.
   */
  private async runCommand(
    call: ToolCall,
    command: string,
    timeoutMs?: number,
  ): Promise<ToolResult> {
    if (!command.trim()) {
      return this.result(call, "command is empty — provide a shell command.");
    }
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return this.result(call, "No workspace folder — cannot run command.");
    }
    const cwd = folders[0].uri.fsPath;
    const timeout = Math.min(
      Math.max(1000, timeoutMs ?? DEFAULT_COMMAND_TIMEOUT),
      MAX_COMMAND_TIMEOUT,
    );

    return new Promise<ToolResult>((resolve) => {
      const child = spawn(command, {
        cwd,
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
        timeout,
      });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let settled = false;

      const settle = (content: string) => {
        if (settled) return;
        settled = true;
        resolve(this.result(call, content));
      };

      child.on("timeout", () => {
        timedOut = true;
        child.kill("SIGKILL");
      });

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
        if (stdout.length > MAX_COMMAND_OUTPUT) {
          stdout = stdout.slice(0, MAX_COMMAND_OUTPUT) + "\n… (truncated)";
          child.kill("SIGKILL");
        }
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
        if (stderr.length > MAX_COMMAND_OUTPUT) {
          stderr = stderr.slice(0, MAX_COMMAND_OUTPUT) + "\n… (truncated)";
          child.kill("SIGKILL");
        }
      });

      child.on("error", (err) => {
        settle(`Command failed to start: ${err.message}`);
      });

      child.on("close", (code, signal) => {
        const exitCode = code ?? (signal ? 1 : 0);
        const parts: string[] = [];
        parts.push(`$ ${command}`);
        parts.push(
          `Exit code: ${exitCode}${signal ? ` (signal: ${signal})` : ""}`,
        );
        if (timedOut) {
          parts.push(`(timed out after ${timeout}ms)`);
        }
        if (stdout) {
          parts.push(`\nstdout:\n${stdout}`);
        }
        if (stderr) {
          parts.push(`\nstderr:\n${stderr}`);
        }
        if (!stdout && !stderr) {
          parts.push("(no output)");
        }
        settle(parts.join("\n"));
      });
    });
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

  /** Count non-overlapping occurrences of `needle` in `haystack`. */
  private countOccurrences(haystack: string, needle: string): number {
    if (needle === "") {
      return 0;
    }
    let count = 0;
    let idx = haystack.indexOf(needle);
    while (idx !== -1) {
      count++;
      idx = haystack.indexOf(needle, idx + needle.length);
    }
    return count;
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
