import * as vscode from 'vscode';
import * as MarkdownIt from 'markdown-it';
import * as commands from './commands/index';
import { CommandManager } from './commandManager';

let extensionPath = "";

export function getExtensionPath(): string {
	return extensionPath;
}

export function activate(context: vscode.ExtensionContext) {
	extensionPath = context.extensionPath;

	const md = new MarkdownIt({
		html: true,
	});

	const commandManager = new CommandManager();
	context.subscriptions.push(commandManager);
	commandManager.register(new commands.ShowPreviewCommand(context, md));
}
