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
import { unifiedDiff, diffStats } from "../diff";
import { scanForSecrets } from "../secrets";

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
/** Timeout for read-only git commands (ms). */
const GIT_TIMEOUT_MS = 10_000;

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
   * Per-run change summary (Phase 9.3): the net added/removed lines per file
   * for the current agentic run. Keyed by workspace-relative path; a file
   * edited multiple times in one run accumulates its net change. Cleared at
   * the start of each run via `clearChangeSummary()`.
   */
  private runChanges: Map<string, { added: number; removed: number }> =
    new Map();

  /**
   * Per-run snapshots (Phase 12.1): the pre-mutation content of every file
   * mutated in the current agentic run, keyed by workspace-relative path.
   * Only the FIRST mutation of a file is recorded, so `revertAll()` restores
   * the original pre-run content even if the file is edited multiple times.
   * Cleared at the start of each run via `clearChangeSummary()`.
   */
  private runSnapshots: Map<
    string,
    { relPath: string; oldContent: string; existed: boolean }
  > = new Map();

  /** Clear the per-run change summary + snapshots (call at the start of a run). */
  public clearChangeSummary(): void {
    this.runChanges = new Map();
    this.runSnapshots = new Map();
  }

  /**
   * The per-run change summary: one entry per mutated file with its net
   * added/removed lines. Empty when no files were mutated this run.
   */
  public getChangeSummary(): {
    path: string;
    added: number;
    removed: number;
  }[] {
    return Array.from(this.runChanges.entries()).map(([path, s]) => ({
      path,
      added: s.added,
      removed: s.removed,
    }));
  }

  /**
   * The pre-run snapshot for a single file (Phase 12.5): its pre-mutation
   * content and whether it existed before the run. `null` when the file was
   * not mutated this run (e.g. after Keep/Undo cleared the snapshots). Used
   * to compute which lines to highlight when a footer file row is opened.
   */
  public getSnapshot(
    relPath: string,
  ): { relPath: string; oldContent: string; existed: boolean } | null {
    return this.runSnapshots.get(relPath) ?? null;
  }

  /** Record a file mutation in the per-run change summary. */
  private recordChange(
    relPath: string,
    oldContent: string,
    newContent: string,
  ): void {
    const { added, removed } = diffStats(oldContent, newContent);
    const prev = this.runChanges.get(relPath) ?? { added: 0, removed: 0 };
    this.runChanges.set(relPath, {
      added: prev.added + added,
      removed: prev.removed + removed,
    });
  }

  /**
   * Store the pre-mutation snapshot for a file in the per-run snapshot map.
   * Only the FIRST mutation of a file in a run is recorded, so `revertAll()`
   * restores the original pre-run content even when the file is edited
   * multiple times in the same run.
   */
  private recordSnapshot(
    relPath: string,
    oldContent: string,
    existed: boolean,
  ): void {
    if (!this.runSnapshots.has(relPath)) {
      this.runSnapshots.set(relPath, { relPath, oldContent, existed });
    }
  }

  /**
   * Revert all mutations made in the current run: restore each snapshotted
   * file to its pre-run content (or delete it if it was newly created).
   * Returns a human-readable summary. Clears the snapshot + change maps.
   */
  public async revertAll(): Promise<string> {
    if (this.runSnapshots.size === 0) {
      return "No changes to revert.";
    }
    const reverted: string[] = [];
    const failed: string[] = [];
    for (const snap of this.runSnapshots.values()) {
      const abs = await this.resolveSafe(snap.relPath);
      if (!abs) {
        failed.push(snap.relPath);
        continue;
      }
      try {
        if (!snap.existed) {
          // The file was newly created this run — delete it.
          await fs.promises.unlink(abs);
        } else {
          await fs.promises.writeFile(abs, snap.oldContent, "utf8");
        }
        reverted.push(snap.relPath);
      } catch {
        failed.push(snap.relPath);
      }
    }
    this.runSnapshots = new Map();
    this.runChanges = new Map();
    if (reverted.length === 0) {
      return `Revert failed for: ${failed.join(", ")}.`;
    }
    const summary =
      `Reverted ${reverted.length} file${reverted.length === 1 ? "" : "s"}: ` +
      `${reverted.join(", ")}`;
    return failed.length > 0
      ? `${summary} (failed: ${failed.join(", ")}).`
      : summary;
  }

  /**
   * Revert a single file to its pre-run content (or delete it if it was
   * newly created). Removes the file from the snapshot + change maps so
   * subsequent `revertAll()` / `getChangeSummary()` calls skip it.
   * Returns a human-readable message.
   */
  public async revertFile(relPath: string): Promise<string> {
    const snap = this.runSnapshots.get(relPath);
    if (!snap) {
      return `No snapshot for ${relPath} (already kept or reverted).`;
    }
    const abs = await this.resolveSafe(relPath);
    if (!abs) {
      return `Cannot revert: path not allowed (${relPath}).`;
    }
    try {
      if (!snap.existed) {
        await fs.promises.unlink(abs);
      } else {
        await fs.promises.writeFile(abs, snap.oldContent, "utf8");
      }
    } catch (err) {
      return `Revert failed for ${relPath}: ${err instanceof Error ? err.message : String(err)}`;
    }
    this.runSnapshots.delete(relPath);
    this.runChanges.delete(relPath);
    return snap.existed
      ? `Reverted ${relPath} (restored pre-run content).`
      : `Reverted ${relPath} (deleted newly-created file).`;
  }

  /**
   * Accept (keep) a single file's changes: remove it from the snapshot +
   * change maps without touching the file on disk. Subsequent
   * `revertAll()` / `getChangeSummary()` calls skip it.
   * Returns a human-readable message.
   */
  public keepFile(relPath: string): string {
    if (!this.runSnapshots.has(relPath)) {
      return `No pending changes for ${relPath}.`;
    }
    this.runSnapshots.delete(relPath);
    this.runChanges.delete(relPath);
    return `Kept ${relPath}.`;
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
        case "get_diagnostics":
          return this.getDiagnostics(
            call,
            args.path ? String(args.path) : undefined,
          );
        case "git_status":
          return this.gitStatus(call);
        case "git_diff":
          return this.gitDiff(call, args.path ? String(args.path) : undefined);
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
    this.recordSnapshot(relPath, oldContent, existed);
    await fs.promises.mkdir(path.dirname(abs), { recursive: true });
    await fs.promises.writeFile(abs, content, "utf8");
    this.recordChange(relPath, oldContent, content);
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
    this.recordSnapshot(relPath, content, true);
    await fs.promises.writeFile(abs, replaced, "utf8");
    this.recordChange(relPath, content, replaced);
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

  /**
   * Return compiler/linter diagnostics (errors and warnings) for a single
   * file (by workspace-relative path) or for all open files when no path is
   * given. Read-only: never mutates workspace state.
   */
  private getDiagnostics(call: ToolCall, relPath?: string): ToolResult {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return this.result(
        call,
        "No workspace folder — cannot read diagnostics.",
      );
    }
    const root = folders[0].uri.fsPath;

    // Collect diagnostics: for a specific file (resolved to a URI) or for
    // every open file.
    let uris: vscode.Uri[];
    if (relPath) {
      const abs = path.resolve(root, relPath);
      const rel = path.relative(root, abs);
      if (rel.startsWith("..") || path.isAbsolute(rel)) {
        return this.result(
          call,
          `Path not allowed (outside workspace): ${relPath}`,
        );
      }
      uris = [vscode.Uri.file(abs)];
    } else {
      uris = vscode.workspace.textDocuments.map((d) => d.uri);
    }

    // Two overloads: getDiagnostics(uri) -> Diagnostic[] for one file, or
    // getDiagnostics() -> [Uri, Diagnostic[]][] for every file.
    const entries: [string, vscode.Diagnostic[]][] = relPath
      ? [[uris[0].fsPath, vscode.languages.getDiagnostics(uris[0])]]
      : vscode.languages
          .getDiagnostics()
          .map(
            ([uri, diags]) =>
              [uri.fsPath, diags] as [string, vscode.Diagnostic[]],
          );

    const lines: string[] = [];
    let total = 0;
    for (const [fsPath, diags] of entries) {
      if (diags.length === 0) {
        continue;
      }
      const rel = this.toWorkspaceRelative(fsPath);
      total += diags.length;
      lines.push(`${rel}:`);
      for (const d of diags) {
        const sev = vscode.DiagnosticSeverity[d.severity];
        const range = `${d.range.start.line + 1}:${d.range.start.character + 1}`;
        const src = d.source ? ` [${d.source}]` : "";
        lines.push(`  ${sev} ${range} — ${d.message}${src}`);
      }
    }

    if (total === 0) {
      const scope = relPath ? ` in ${relPath}` : " in open files";
      return this.result(call, `No diagnostics${scope} (clean).`);
    }
    const header = relPath
      ? `Diagnostics for ${relPath} (${total}):`
      : `Diagnostics for open files (${total}):`;
    return this.result(call, header + "\n" + lines.join("\n"));
  }

  /**
   * Run a `git` command in the workspace root and return its raw output.
   * `args` are the git subcommand + flags (never user-controlled shell text —
   * they are passed as a fixed argv array, so there is no shell injection).
   * Enforces a short timeout and an output cap. Returns the trimmed stdout on
   * success, or a `git exited with code N` report on failure.
   */
  private async runGitRaw(args: string[]): Promise<string> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return "No workspace folder — cannot run git.";
    }
    const cwd = folders[0].uri.fsPath;

    return new Promise<string>((resolve) => {
      const child = spawn("git", args, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        timeout: GIT_TIMEOUT_MS,
      });
      let stdout = "";
      let stderr = "";
      let settled = false;

      const settle = (content: string) => {
        if (settled) return;
        settled = true;
        resolve(content);
      };

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
        settle(`git failed to start: ${err.message}`);
      });

      child.on("close", (code) => {
        // git exits non-zero for some benign cases (e.g. no diff); surface
        // the output either way and note the exit code only on hard failure.
        const out = stdout.trim();
        const err = stderr.trim();
        if (code === 0) {
          settle(out || "(no output)");
        } else {
          settle(
            `git exited with code ${code}.\n` +
              (out ? `stdout:\n${out}\n` : "") +
              (err ? `stderr:\n${err}` : "(no output)"),
          );
        }
      });
    });
  }

  /** Wrap a raw git result as a `ToolResult` for the given call. */
  private async runGit(call: ToolCall, args: string[]): Promise<ToolResult> {
    return this.result(call, await this.runGitRaw(args));
  }

  /** `git status` (read-only): show which files are modified/untracked. */
  private async gitStatus(call: ToolCall): Promise<ToolResult> {
    return this.runGit(call, ["status", "--short", "--branch"]);
  }

  /** `git diff` (read-only): show uncommitted changes, optionally scoped. */
  private async gitDiff(call: ToolCall, relPath?: string): Promise<ToolResult> {
    const args = ["diff"];
    if (relPath) {
      // Scope to a single file. The path is passed as a separate argv
      // element (after `--`), so it is never interpreted as a git flag.
      args.push("--", relPath);
    }
    return this.runGit(call, args);
  }

  /**
   * `git status --short` (read-only). Returns the raw status text, or `""`
   * when the working tree is clean (nothing to commit).
   */
  public async gitStatusText(): Promise<string> {
    const out = await this.runGitRaw(["status", "--short"]);
    // A clean tree yields no output (or only the "(no output)" sentinel).
    return out === "(no output)" ? "" : out;
  }

  /**
   * `git diff --staged` (read-only): the staged diff, used to scan for
   * secrets before committing.
   */
  public async gitStagedDiff(): Promise<string> {
    return this.runGitRaw(["diff", "--staged"]);
  }

  /**
   * Stage all changes and commit them with the given message (Phase 10.2).
   * Before committing, the staged diff is scanned for secret-like patterns;
   * if any are found the commit is refused (nothing is committed) and the
   * matches are reported. Returns a human-readable result string.
   */
  public async gitCommit(message: string): Promise<string> {
    const msg = message.trim();
    if (!msg) {
      return "Commit message is empty — nothing to commit.";
    }
    // Stage everything (tracked + untracked) in the workspace.
    const addOut = await this.runGitRaw(["add", "-A"]);
    if (addOut.startsWith("git exited with code")) {
      return `Failed to stage changes:\n${addOut}`;
    }
    // Nothing staged? (e.g. only ignored files.)
    const staged = await this.gitStagedDiff();
    if (staged === "(no output)" || staged.trim() === "") {
      return "No changes to commit (working tree is clean).";
    }
    // Secrets guard: refuse to commit credentials.
    const secrets = scanForSecrets(staged);
    if (secrets.length > 0) {
      const lines = secrets
        .map((s) => `  line ${s.line}: ${s.pattern} (${s.match})`)
        .join("\n");
      return (
        `Refusing to commit: the staged changes appear to contain secrets.\n` +
        `${lines}\n` +
        `Remove the secrets and try again. Nothing was committed.`
      );
    }
    // Commit. The message is passed as a single argv element (after -m), so
    // it is never interpreted as a git flag or shell text.
    const commitOut = await this.runGitRaw(["commit", "-m", msg]);
    if (commitOut.startsWith("git exited with code")) {
      return `Commit failed:\n${commitOut}`;
    }
    return `Committed: ${msg}\n${commitOut}`;
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
   * Public so the chat provider can reuse the same guard when opening a
   * file from the change footer (Phase 12.5).
   */
  public async resolveSafe(relPath: string): Promise<string | null> {
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
