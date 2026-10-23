/**
 * workspaceScaffold.ts — pure workspace-scaffold templates + prompt builder
 * (item 1.99-6.S1). No `vscode` import, no dependencies: template data and
 * prompt-string building only, so it can be unit-tested from the smoke test
 * against the compiled `out/workspaceScaffold.js`.
 */

/** A workspace template: a named set of files to scaffold. */
export interface WorkspaceTemplate {
  type: string;
  label: string;
  description: string;
  files: { path: string; content: string }[];
  launchTask?: { label: string; command: string };
}

/** The four supported workspace templates. */
export const WORKSPACE_TEMPLATES: readonly WorkspaceTemplate[] = [
  {
    type: "extension",
    label: "VS Code extension",
    description: "A minimal VS Code extension project",
    launchTask: { label: "Compile", command: "npm run compile" },
    files: [
      {
        path: "package.json",
        content: `{
  "name": "my-extension",
  "displayName": "My Extension",
  "version": "0.0.1",
  "engines": { "vscode": "^1.85.0" },
  "main": "./out/extension.js",
  "activationEvents": [],
  "scripts": {
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./"
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "typescript": "^5.4.0"
  }
}
`,
      },
      {
        path: "tsconfig.json",
        content: `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "out",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
`,
      },
      {
        path: "src/extension.ts",
        content: `import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand(
    "my-extension.hello",
    () => {
      vscode.window.showInformationMessage("Hello from My Extension!");
    },
  );
  context.subscriptions.push(disposable);
}

export function deactivate(): void {
  // nothing to clean up
}
`,
      },
      {
        path: ".vscodeignore",
        content: `src
node_modules
tsconfig.json
.gitignore
`,
      },
    ],
  },
  {
    type: "mcp-server",
    label: "MCP server",
    description: "A minimal Model Context Protocol server (stdio)",
    launchTask: { label: "Start", command: "npm start" },
    files: [
      {
        path: "package.json",
        content: `{
  "name": "my-mcp-server",
  "version": "0.0.1",
  "main": "./out/server.js",
  "scripts": {
    "compile": "tsc -p ./",
    "start": "node out/server.js"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
`,
      },
      {
        path: "tsconfig.json",
        content: `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "out",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
`,
      },
      {
        path: "src/server.ts",
        content: `import * as readline from "readline";

const rl = readline.createInterface({ input: process.stdin });

rl.on("line", (line: string) => {
  let msg: any;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method } = msg;
  if (method === "initialize") {
    respond(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "my-mcp-server", version: "0.0.1" },
    });
  } else if (method === "tools/list") {
    respond(id, {
      tools: [
        {
          name: "echo",
          description: "Echo back the input text",
          inputSchema: {
            type: "object",
            properties: { text: { type: "string" } },
            required: ["text"],
          },
        },
      ],
    });
  } else if (method === "tools/call") {
    const { name, arguments: args } = msg.params ?? {};
    if (name === "echo") {
      respond(id, { content: [{ type: "text", text: args?.text ?? "" }] });
    } else {
      respond(id, { content: [{ type: "text", text: "Unknown tool" }], isError: true });
    }
  }
});

function respond(id: unknown, result: unknown): void {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\\n");
}
`,
      },
      {
        path: "README.md",
        content: `# my-mcp-server

A minimal Model Context Protocol (MCP) server using stdio transport.

## Usage

\`\`\`bash
npm run compile
npm start
\`\`\`

The server reads newline-delimited JSON-RPC messages from stdin and writes
responses to stdout.
`,
      },
    ],
  },
  {
    type: "dev-env",
    label: "Dev environment",
    description: "A minimal TypeScript dev environment with scripts",
    launchTask: { label: "Dev", command: "npm run dev" },
    files: [
      {
        path: "package.json",
        content: `{
  "name": "my-dev-env",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc -p ./",
    "test": "node --test"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "^5.4.0"
  }
}
`,
      },
      {
        path: "tsconfig.json",
        content: `{
  "compilerOptions": {
    "module": "ESNext",
    "target": "ES2022",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
`,
      },
      {
        path: "src/index.ts",
        content: `console.log("Hello from my-dev-env!");
`,
      },
      {
        path: ".gitignore",
        content: `node_modules
dist
`,
      },
    ],
  },
  {
    type: "generic",
    label: "Generic project",
    description: "A minimal generic project scaffold",
    files: [
      {
        path: "package.json",
        content: `{
  "name": "my-project",
  "version": "0.0.1",
  "private": true
}
`,
      },
      {
        path: "README.md",
        content: `# my-project

A minimal generic project scaffold.
`,
      },
    ],
  },
];

/** Returns the list of supported workspace template types in order. */
export function listWorkspaceTypes(): string[] {
  return ["extension", "mcp-server", "dev-env", "generic"];
}

/**
 * Build a VS Code tasks.json string for the given workspace type.
 * Returns `""` for unknown types or types without a launchTask.
 */
export function buildTasksJson(type: string): string {
  const template = WORKSPACE_TEMPLATES.find((t) => t.type === type);
  if (!template || !template.launchTask) {
    return "";
  }
  const obj = {
    version: "2.0.0",
    tasks: [
      {
        label: template.launchTask.label,
        type: "shell",
        command: template.launchTask.command,
        problemMatcher: [],
      },
    ],
  };
  return JSON.stringify(obj, null, 2);
}

/**
 * Build a scaffold prompt for the given workspace type and target folder.
 * Returns `""` for unknown types.
 */
export function buildScaffoldPrompt(type: string, folder: string): string {
  const types = listWorkspaceTypes();
  if (!types.includes(type)) {
    return "";
  }
  const template = WORKSPACE_TEMPLATES.find((t) => t.type === type)!;
  const lines: string[] = [];
  lines.push(
    `Scaffold a new ${template.label} project in the folder \`${folder}\` (workspace-relative).`,
  );
  lines.push("");
  lines.push("1. Create the folder if it does not exist.");
  lines.push(
    "2. Write each file below with `write_file`, using exactly the content shown.",
  );
  lines.push("3. Verify the result with `list_dir`.");
  if (type !== "generic") {
    lines.push(
      `4. Optionally run \`npm install\` in the folder via \`run_command\`.`,
    );
  }
  lines.push("");
  for (const file of template.files) {
    lines.push(`### ${file.path}`);
    lines.push("");
    lines.push("```");
    lines.push(file.content.trimEnd());
    lines.push("```");
    lines.push("");
  }
  return lines.join("\n");
}
