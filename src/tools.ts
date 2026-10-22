// tools.ts — pure tool (function-calling) schemas + message shaping.
//
// No `vscode` import, no network: this module defines the OpenAI
// function-calling tool schemas the extension exposes to the engine, the
// shape of a tool call the engine returns, and the helper that builds the
// `role: 'tool'` result message. The vscode-specific execution of the tools
// lives in `tools/ToolExecutor.ts`.

import type { ChatMessage } from "./request";

/** An OpenAI function-calling tool schema. */
export interface Tool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

/** A tool call the engine asks the extension to perform. */
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    /** JSON-encoded arguments string (as the engine sends it). */
    arguments: string;
  };
}

/** The result of executing a tool call, fed back to the engine. */
export interface ToolResult {
  /** Matches the `id` of the `ToolCall` being answered. */
  tool_call_id: string;
  /** The result text (or an error message) for the engine to read. */
  content: string;
}

/**
 * The workspace tools exposed to the engine. The model can call these to
 * read, write, list, and search files in the workspace.
 */
export const CODE_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read the contents of a file in the workspace. Optionally read a " +
        "line range (1-based, inclusive) to read large files in chunks.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Workspace-relative file path.",
          },
          start_line: {
            type: "number",
            description:
              "Optional 1-based line number to start reading from (inclusive).",
          },
          end_line: {
            type: "number",
            description:
              "Optional 1-based line number to stop reading at (inclusive).",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write (create or overwrite) a file in the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Workspace-relative file path.",
          },
          content: {
            type: "string",
            description: "The full file contents to write.",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description:
        "Make a targeted edit to a file by replacing an exact text match. " +
        "old_string must match the file contents EXACTLY (including whitespace " +
        "and indentation) and must be UNIQUE in the file unless replace_all is " +
        "true. Include enough surrounding context (a few lines before and after) " +
        "to make old_string unambiguous. If old_string is not found or is not " +
        "unique, the edit fails — re-read the file and copy the exact text.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Workspace-relative file path.",
          },
          old_string: {
            type: "string",
            description:
              "The exact text to replace, including surrounding context to make " +
              "it unique. Must match the file byte-for-byte (whitespace and " +
              "indentation included).",
          },
          new_string: {
            type: "string",
            description: "The replacement text.",
          },
          replace_all: {
            type: "boolean",
            description:
              "When true, replace every occurrence of old_string. When false " +
              "(default), old_string must be unique or the edit fails.",
          },
        },
        required: ["path", "old_string", "new_string"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_dir",
      description:
        "List the files and subdirectories in a workspace directory.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Workspace-relative directory path.",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description: "Search file contents in the workspace for a text pattern.",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "Text (or regex) pattern to search for.",
          },
          path: {
            type: "string",
            description:
              "Optional workspace-relative directory to scope the search.",
          },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description:
        "Run a shell command in the workspace root and return its exit code " +
        "and output (stdout + stderr). Use this to run builds, tests, linters, " +
        "or other commands to verify changes. The command is run with a 60-second " +
        "timeout (configurable) and its output is capped.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description:
              "The shell command to run (e.g. 'npm test', 'npx tsc --noEmit').",
          },
          timeout_ms: {
            type: "number",
            description:
              "Optional timeout in milliseconds (default 60000, max 60000).",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_diagnostics",
      description:
        "Return compiler/linter diagnostics (errors and warnings) for a file " +
        "or for all open files. Use this to verify that your edits compile. " +
        "Omit path to get diagnostics for every open file.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Optional workspace-relative file path. When omitted, returns " +
              "diagnostics for all open files.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_status",
      description:
        "Show the git status of the workspace (which files are modified, " +
        "added, deleted, or untracked). Read-only: does not change anything. " +
        "Use this to inspect the current state of the repository.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_diff",
      description:
        "Show the git diff of the workspace (uncommitted changes to tracked " +
        "files). Read-only: does not change anything. Optionally scope the " +
        "diff to a single file.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Optional workspace-relative file path to scope the diff to.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "manage_todos",
      description:
        "Create or update a task list to track progress on a multi-step task. " +
        "Call this at the start of a task to plan the steps, and after " +
        "completing each step to mark it done. The list is displayed to the " +
        "user as a live checklist. Always send the COMPLETE list (it replaces " +
        "the previous one).",
      parameters: {
        type: "object",
        properties: {
          todos: {
            type: "array",
            description:
              "The complete list of todos (replaces the previous list).",
            items: {
              type: "object",
              properties: {
                id: {
                  type: "number",
                  description: "Unique sequential id (1, 2, 3, …).",
                },
                title: {
                  type: "string",
                  description:
                    "Short action-oriented label (3–7 words).",
                },
                status: {
                  type: "string",
                  enum: ["not-started", "in-progress", "completed"],
                  description:
                    "Current status of this todo.",
                },
              },
              required: ["id", "title", "status"],
            },
          },
        },
        required: ["todos"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "notebook_edit",
      description:
        "Edit a Jupyter notebook (.ipynb) file. Actions: `create` (create a " +
        "new notebook with the given cells), `modify_cell` (replace a cell's " +
        "source), `insert_cell` (insert a new cell at cell_index), " +
        "`delete_cell` (remove a cell), `change_cell_type` (switch a cell " +
        "between `code` and `markdown`). Cell indices are 0-based. Use this " +
        "instead of write_file/edit_file for .ipynb files.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Workspace-relative .ipynb file path.",
          },
          action: {
            type: "string",
            enum: [
              "create",
              "modify_cell",
              "insert_cell",
              "delete_cell",
              "change_cell_type",
            ],
            description: "The notebook operation to perform.",
          },
          cell_index: {
            type: "number",
            description:
              "0-based cell index. Required for modify_cell, delete_cell, " +
              "and change_cell_type; for insert_cell the new cell takes this " +
              "index.",
          },
          cell_type: {
            type: "string",
            enum: ["code", "markdown"],
            description:
              "Cell type. Used for create, insert_cell, and change_cell_type.",
          },
          source: {
            type: "string",
            description:
              "Cell source text. For create, multiple cells are separated by " +
              "the marker line <<<CELL>>>.",
          },
        },
        required: ["path", "action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "think",
      description:
        "Record a thought or reasoning step between tool calls. Use this to " +
        "plan, reflect, or work through complex multi-step problems before " +
        "acting. Takes a single 'thought' string; the thought is recorded and " +
        "echoed back. It has no side effects and changes nothing.",
      parameters: {
        type: "object",
        properties: {
          thought: {
            type: "string",
            description: "The reasoning or plan to record.",
          },
        },
        required: ["thought"],
      },
    },
  },
];

/**
 * Build the `role: 'tool'` message that feeds a tool result back to the
 * engine. The `tool_call_id` must match the `id` of the `ToolCall` being
 * answered.
 */
export function toolResultMessage(
  call: ToolCall,
  content: string,
): ChatMessage {
  return {
    role: "tool",
    tool_call_id: call.id,
    content,
  };
}

/**
 * Whether a tool call mutates workspace state (and therefore may require
 * user approval when `llm.tools.requireApproval` is on). Read-only tools
 * (`read_file`, `list_dir`, `search_files`) never mutate.
 */
export function isMutatingTool(name: string): boolean {
  return (
    name === "write_file" ||
    name === "edit_file" ||
    name === "run_command" ||
    name === "notebook_edit"
  );
}
