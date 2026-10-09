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
      description: "Read the contents of a file in the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Workspace-relative file path.",
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
