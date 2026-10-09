// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code.
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "vscode-extension-copilot" is now active!');

    // Register the hello world command
    const disposable = vscode.commands.registerCommand('extension.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from your extension!');
    });

    context.subscriptions.push(disposable);
}

export function deactivate() { }
