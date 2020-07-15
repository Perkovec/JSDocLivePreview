import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as MarkdownIt from 'markdown-it';
import * as jsdoc2md from 'jsdoc-to-markdown';
import { Command } from '../commandManager';
import { throttle } from './../util/throttle';
import { debounce } from './../util/debounce';

export class ShowPreviewCommand implements Command {
	public readonly id = 'jsdocLivePreview.showPreview';
	public readonly viewType = 'jsdocLivePreview.preview';

	private webviewPanel: vscode.WebviewPanel | null = null;
	private readonly supportedLanguages = [
		'javascript',
	];

	public constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly md: MarkdownIt
	) { }

	private getOrCreateWebviewPanel() {
		if (!this.webviewPanel) {
			const { activeTextEditor } = vscode.window;
			const viewColumn = activeTextEditor && activeTextEditor.viewColumn ? activeTextEditor.viewColumn + 1 : vscode.ViewColumn.One;
			const webviewPanel = vscode.window.createWebviewPanel(
				this.viewType,
				'JSDoc Live Preview',
				viewColumn,
				{
					enableFindWidget: true,
					enableScripts: true,
					enableCommandUris: true,
				}
			);

			webviewPanel.onDidDispose(() => {
				this.webviewPanel = null;
			}, null, this.context.subscriptions);

			this.webviewPanel = webviewPanel;
		}

		return this.webviewPanel;
	}

	private async createTempFileFromEditor(editor: vscode.TextEditor): Promise<string> {
		return new Promise((resolve, reject) => {
			const filePath = path.join(this.context.extensionPath, 'temp.js');
			const fileContent = editor.document.getText();
			fs.writeFile(filePath, fileContent, (err) => {
				if (err) { return reject(err); }

				resolve(filePath);
			});
		});
	}

	private async compileJSDoc(filePath: string): Promise<string> {
		const markdownContent = await jsdoc2md.render({
			files: filePath,
		});
		return this.md.render(markdownContent);
	}

	private wrapHTMLContentInDoc(content: string): string {
		const { extensionPath } = this.context;

		const githubMarkdownCss = vscode.Uri.file(path.join(extensionPath, 'src/assets/github-markdown.css')).with({ scheme: 'vscode-resource' });
		const globalCss = vscode.Uri.file(path.join(extensionPath, 'src/assets/global.css')).with({ scheme: 'vscode-resource' });
		const anchorJs = vscode.Uri.file(path.join(extensionPath, 'src/assets/anchors.js')).with({ scheme: 'vscode-resource' });

		return `
			<!DOCTYPE html>
			<html>
				<head>
					<link rel="stylesheet" href="${githubMarkdownCss}">
					<link rel="stylesheet" href="${globalCss}">
					<meta charset="utf-8" />
				</head>
				<body class="markdown-body">
					${content}
					<script src="${anchorJs}"></script>
				</body>
			</html> 
		`;
	}

	private isSupportedFileOpened(): boolean {
		const { activeTextEditor } = vscode.window;
		return activeTextEditor
			? this.supportedLanguages.includes(activeTextEditor.document.languageId)
			: false;
	}

	private async updatePreview(): Promise<void> {
		const activeEditor = vscode.window.activeTextEditor;

		if (!activeEditor) { return; }

		const webviewPanel = this.getOrCreateWebviewPanel();
		const tempFilePath = await this.createTempFileFromEditor(activeEditor);
		const htmlDoc = await this.compileJSDoc(tempFilePath);

		webviewPanel.webview.html = this.wrapHTMLContentInDoc(htmlDoc);
	}

	private registerEvents() {
		const throttledUpdate = throttle(this.updatePreview.bind(this), 1000);
		const debouncedUpdate = debounce(this.updatePreview.bind(this), 500);
		vscode.workspace.onDidChangeTextDocument(() => { throttledUpdate(); debouncedUpdate(); });
		vscode.window.onDidChangeActiveTextEditor(() => this.isSupportedFileOpened() && this.updatePreview());
	}

	public execute() {
		this.updatePreview();
		this.registerEvents();
	}
}

