# VS Code Extension Copilot

A sample VS Code extension project set up for development inside a Dev Container.

## Getting Started

1. Open this folder in VS Code.
2. When prompted, choose **Reopen in Container** (or run the command
   `Dev Containers: Rebuild and Reopen in Container`).
3. Wait for the container to build and `npm install` to finish.
4. Press **F5** (or use the **Run Extension** launch configuration) to start a
   development instance of VS Code with your extension loaded.
5. Run the **Say Hello** command from the Command Palette (`Ctrl/Cmd+Shift+P`)
   to verify it works.

## Project Structure

```
.
├── .devcontainer/        # Dev Container configuration
│   ├── devcontainer.json
│   └── Dockerfile
├── .vscode/              # VS Code workspace settings
│   ├── launch.json       # Debug configuration (Run Extension)
│   └── tasks.json        # Build/watch tasks
├── src/
│   └── extension.ts      # Extension entry point
├── package.json          # Extension manifest + npm scripts
└── tsconfig.json         # TypeScript configuration
```

## Useful Commands

| Command            | Description                          |
| ------------------ | ------------------------------------ |
| `npm run compile`  | Compile TypeScript to `out/`         |
| `npm run watch`    | Compile in watch mode                |
| `npm run lint`     | Run ESLint over `src/`               |
| `npm run format`   | Format code with Prettier            |
| `npm run package`  | Package the extension into a `.vsix` |

## Debugging

Use the **Run Extension** configuration in `.vscode/launch.json`. It launches a
new VS Code window with your extension loaded, so you can test it live.
