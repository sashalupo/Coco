// webview.ts — builds the chat panel's HTML/CSS/JS shell.
//
// `buildWebviewHtml()` returns a single self-contained HTML document (inline
// CSS + JS, no external assets). This is the static shell: the message list,
// input box, Model/Thinking/Context toolbar, and the collapsible thinking
// block. The chat/toolbar *logic* is wired in later steps (S7–S11); the DOM
// builders and host-messaging hooks are provided here so those steps can
// build on a stable structure.

import { CONTEXT_LEVELS, THINKING_LEVELS } from "../presets";

/** Initial toolbar state passed into the webview (all optional). */
export interface WebviewInit {
  /** Model IDs from `GET /v1/models`. */
  models: string[];
  /** Selected model override (`''` = placeholder, `'__manual__'` = manual entry). */
  model: string;
  /** Selected thinking preset. */
  thinking: string;
  /** Selected context preset. */
  context: string;
  /** Which editor-context sections to inject (file/selection/diagnostics). */
  contextFlags?: {
    includeFile: boolean;
    includeSelection: boolean;
    includeDiagnostics: boolean;
  };
}

/** Escape a string for safe inclusion in an HTML attribute/text node. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Build the chat webview HTML.
 *
 * @param init Optional initial toolbar state (models + selected values).
 *             Defaults to an empty model list and the default presets.
 */
export function buildWebviewHtml(init?: Partial<WebviewInit>): string {
  const models = init?.models ?? [];
  const thinkingOptions = THINKING_LEVELS.map(
    (l) => `<option value="${l}">${l}</option>`,
  ).join("");
  const contextOptions = CONTEXT_LEVELS.map(
    (l) => `<option value="${l}">${l}</option>`,
  ).join("");
  const modelOptions = [
    '<option value="">Select model…</option>',
    ...models.map(
      (m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`,
    ),
    '<option value="__manual__">manual…</option>',
  ].join("");

  const initialState = {
    model: init?.model ?? "",
    thinking: init?.thinking ?? "off",
    context: init?.context ?? "auto",
    contextFlags: init?.contextFlags ?? {
      includeFile: true,
      includeSelection: true,
      includeDiagnostics: true,
    },
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
	:root {
		--bg: var(--vscode-editor-background, #1e1e1e);
		--fg: var(--vscode-foreground, #cccccc);
		--muted: var(--vscode-descriptionForeground, #8b8b8b);
		--border: var(--vscode-panel-border, #333333);
		--input-bg: var(--vscode-input-background, #3c3c3c);
		--input-border: var(--vscode-input-border, #3c3c3c);
		--focus: var(--vscode-focusBorder, #007fd4);
		--btn-bg: var(--vscode-button-background, #0e639c);
		--btn-fg: var(--vscode-button-foreground, #ffffff);
		--user-bg: var(--vscode-chat-user-background, rgba(0, 127, 212, 0.12));
		--think-bg: var(--vscode-textBlockQuote-background, rgba(0, 0, 0, 0.15));
	}
	* { box-sizing: border-box; }
	html, body {
		margin: 0;
		height: 100%;
		background: var(--bg);
		color: var(--fg);
		font-family: var(--vscode-font-family, sans-serif);
		font-size: var(--vscode-font-size, 13px);
	}
	body {
		display: flex;
		flex-direction: column;
		height: 100vh;
	}

	/* Toolbar */
	.toolbar {
		display: flex;
		gap: 8px;
		padding: 8px;
		border-bottom: 1px solid var(--border);
		flex-wrap: wrap;
		align-items: center;
	}
	.toolbar label {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		color: var(--muted);
	}
	.toolbar select {
		background: var(--input-bg);
		color: var(--fg);
		border: 1px solid var(--input-border);
		border-radius: 2px;
		padding: 2px 4px;
		font-size: 12px;
		max-width: 160px;
	}
	.toolbar select:focus { outline: 1px solid var(--focus); }
	#model-manual-wrap { display: none; }
	#model-manual {
		background: var(--input-bg);
		color: var(--fg);
		border: 1px solid var(--input-border);
		border-radius: 2px;
		padding: 2px 4px;
		font-size: 12px;
		width: 140px;
	}
	#model-manual:focus { outline: 1px solid var(--focus); }
	.ctx-toggles {
		display: flex;
		gap: 6px;
		margin-left: auto;
	}
	.ctx-toggles label {
		display: flex;
		align-items: center;
		gap: 3px;
		font-size: 11px;
		color: var(--muted);
		cursor: pointer;
	}
	.ctx-toggles input { margin: 0; }

	/* Messages */
	.messages {
		flex: 1 1 auto;
		overflow-y: auto;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.message { display: flex; flex-direction: column; gap: 4px; }
	.message .role {
		font-size: 11px;
		font-weight: 600;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.message .content {
		white-space: pre-wrap;
		word-break: break-word;
		line-height: 1.5;
	}
	.message.user .content {
		background: var(--user-bg);
		border-radius: 4px;
		padding: 6px 8px;
	}
	.message.assistant .content {
		border-left: 2px solid var(--border);
		padding-left: 8px;
	}
	/* Markdown rendering (assistant content) */
	.message.assistant .content { white-space: normal; }
	.message.assistant .content p { margin: 0 0 8px; }
	.message.assistant .content p:last-child { margin-bottom: 0; }
	.message.assistant .content pre {
		background: var(--think-bg);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 8px;
		overflow-x: auto;
		margin: 8px 0;
		font-size: 12px;
		line-height: 1.4;
	}
	.message.assistant .content code {
		background: var(--think-bg);
		border-radius: 3px;
		padding: 1px 4px;
		font-size: 12px;
		font-family: var(--vscode-editor-font-family, monospace);
	}
	.message.assistant .content pre code {
		background: none;
		padding: 0;
		border-radius: 0;
	}
	.message.assistant .content h1, .message.assistant .content h2,
	.message.assistant .content h3, .message.assistant .content h4 {
		margin: 12px 0 6px;
		font-weight: 600;
	}
	.message.assistant .content h1 { font-size: 1.3em; }
	.message.assistant .content h2 { font-size: 1.15em; }
	.message.assistant .content h3 { font-size: 1.05em; }
	.message.assistant .content ul, .message.assistant .content ol {
		margin: 4px 0;
		padding-left: 20px;
	}
	.message.assistant .content li { margin: 2px 0; }
	.message.assistant .content a {
		color: var(--vscode-textLink-foreground, #3794ff);
		text-decoration: none;
	}
	.message.assistant .content a:hover { text-decoration: underline; }
	.message.assistant .content blockquote {
		border-left: 3px solid var(--border);
		padding-left: 10px;
		margin: 8px 0;
		color: var(--muted);
	}
	.usage-badge {
		margin-top: 6px;
		font-size: 10px;
		color: var(--muted);
		letter-spacing: 0.02em;
	}
	.message.error .role { color: var(--vscode-errorForeground, #f48771); }
	.message.error .content {
		border-left: 2px solid var(--vscode-errorForeground, #f48771);
		padding-left: 8px;
		color: var(--vscode-errorForeground, #f48771);
	}

	/* Collapsible thinking block */
	.thinking {
		margin: 0;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--think-bg);
	}
	.thinking summary {
		cursor: pointer;
		padding: 4px 8px;
		font-size: 11px;
		color: var(--muted);
		user-select: none;
	}
	.thinking[open] summary { border-bottom: 1px solid var(--border); }
	.thinking .thinking-content {
		padding: 6px 8px;
		font-size: 12px;
		color: var(--muted);
		white-space: pre-wrap;
		word-break: break-word;
		line-height: 1.5;
	}

	/* Context-trimmed indicator */
	.context-indicator {
		padding: 4px 12px;
		font-size: 11px;
		color: var(--muted);
		border-top: 1px solid var(--border);
		background: var(--think-bg);
	}

	/* Input row */
	.input-row {
		display: flex;
		gap: 8px;
		padding: 8px;
		border-top: 1px solid var(--border);
		align-items: flex-end;
	}
	#input {
		flex: 1 1 auto;
		resize: none;
		background: var(--input-bg);
		color: var(--fg);
		border: 1px solid var(--input-border);
		border-radius: 4px;
		padding: 6px 8px;
		font-family: inherit;
		font-size: 13px;
		line-height: 1.4;
		min-height: 34px;
		max-height: 160px;
	}
	#input:focus { outline: 1px solid var(--focus); }
	#send {
		background: var(--btn-bg);
		color: var(--btn-fg);
		border: none;
		border-radius: 4px;
		padding: 6px 14px;
		font-size: 13px;
		cursor: pointer;
	}
	#send:hover { filter: brightness(1.1); }
	#send:disabled { opacity: 0.5; cursor: default; }
	#stop {
		background: var(--vscode-inputValidation-errorBackground, #5a1d1a);
		color: var(--btn-fg);
		border: none;
		border-radius: 4px;
		padding: 6px 14px;
		font-size: 13px;
		cursor: pointer;
		display: none;
	}
	#stop:hover { filter: brightness(1.15); }
	#new-chat {
		background: transparent;
		color: var(--muted);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 2px 8px;
		font-size: 11px;
		cursor: pointer;
	}
	#new-chat:hover { color: var(--fg); border-color: var(--focus); }
	#conv-select {
		background: var(--input-bg);
		color: var(--fg);
		border: 1px solid var(--input-border);
		border-radius: 2px;
		padding: 2px 4px;
		font-size: 11px;
		max-width: 180px;
		margin-left: auto;
	}
	#conv-select:focus { outline: 1px solid var(--focus); }
</style>
</head>
<body>
	<div class="toolbar">
		<label>Model
			<select id="model-select">${modelOptions}</select>
		</label>
		<span id="model-manual-wrap">
			<input id="model-manual" type="text" placeholder="model id" spellcheck="false">
		</span>
		<label>Thinking
			<select id="thinking-select">${thinkingOptions}</select>
		</label>
		<label>Context
			<select id="context-select">${contextOptions}</select>
		</label>
		<span class="ctx-toggles" title="Editor context injected into the request">
			<label><input type="checkbox" id="ctx-file" checked>file</label>
			<label><input type="checkbox" id="ctx-selection" checked>sel</label>
			<label><input type="checkbox" id="ctx-diagnostics" checked>diag</label>
		</span>
		<select id="conv-select" title="Switch conversation"><option value="">History…</option></select>
		<button id="new-chat" title="Start a new conversation">New Chat</button>
	</div>

	<div id="messages" class="messages"></div>

	<div id="context-indicator" class="context-indicator" hidden>Context trimmed to fit budget</div>

	<div class="input-row">
		<textarea id="input" placeholder="Ask anything… (Enter to send, Shift+Enter for newline)" rows="1"></textarea>
		<button id="send">Send</button>
		<button id="stop" title="Stop generating">Stop</button>
	</div>

	<script>window.__llmInitial = ${JSON.stringify(initialState)};</script>
	<script>
	(function () {
		var vscode = (typeof acquireVsCodeApi === 'function') ? acquireVsCodeApi() : null;
		var modelSelect = document.getElementById('model-select');
		var manualWrap = document.getElementById('model-manual-wrap');
		var manualInput = document.getElementById('model-manual');
		var thinkingSelect = document.getElementById('thinking-select');
		var contextSelect = document.getElementById('context-select');
		var messagesEl = document.getElementById('messages');
		var inputEl = document.getElementById('input');
		var sendBtn = document.getElementById('send');
		var stopBtn = document.getElementById('stop');
		var contextIndicator = document.getElementById('context-indicator');
		var ctxFile = document.getElementById('ctx-file');
		var ctxSelection = document.getElementById('ctx-selection');
		var ctxDiagnostics = document.getElementById('ctx-diagnostics');
		var newChatBtn = document.getElementById('new-chat');
		var convSelect = document.getElementById('conv-select');

		function syncManual() {
			manualWrap.style.display = (modelSelect.value === '__manual__') ? 'inline' : 'none';
		}
		modelSelect.addEventListener('change', function () {
			syncManual();
			postToolbar();
		});
		manualInput.addEventListener('change', postToolbar);
		thinkingSelect.addEventListener('change', postToolbar);
		contextSelect.addEventListener('change', postToolbar);
		ctxFile.addEventListener('change', postToolbar);
		ctxSelection.addEventListener('change', postToolbar);
		ctxDiagnostics.addEventListener('change', postToolbar);
		newChatBtn.addEventListener('click', function () {
			if (streaming) { return; }
			if (vscode) { vscode.postMessage({ type: 'newChat' }); }
		});
		convSelect.addEventListener('change', function () {
			if (streaming || !convSelect.value) { return; }
			if (vscode) { vscode.postMessage({ type: 'switchConversation', id: convSelect.value }); }
		});

		function postToolbar() {
			if (!vscode) { return; }
			var state = getToolbar();
			vscode.postMessage({
				type: 'toolbar',
				model: state.model,
				thinking: state.thinking,
				context: state.context,
				contextFlags: state.contextFlags
			});
		}

		var streaming = false;
		var currentAssistant = null;
		var lastSentText = '';

		function doSend() {
			var text = inputEl.value.trim();
			if (!text || streaming) { return; }
			lastSentText = text;
			inputEl.value = '';
			inputEl.focus();
			if (vscode) {
				vscode.postMessage({ type: 'send', text: text });
			}
		}
		sendBtn.addEventListener('click', doSend);
		stopBtn.addEventListener('click', function () {
			if (vscode) { vscode.postMessage({ type: 'stop' }); }
		});
		inputEl.addEventListener('keydown', function (e) {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				doSend();
			}
		});

		// --- Lightweight Markdown renderer (no external deps) ---
		function escapeHtml(s) {
			return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
		}
		function renderMarkdown(src) {
			if (!src) { return ''; }
			// Extract fenced code blocks first so their content is not processed.
			var codeBlocks = [];
			var BT = String.fromCharCode(96);
			var fenceRe = new RegExp(BT + BT + BT + '(\\w*)\\n([\\s\\S]*?)' + BT + BT + BT, 'g');
			src = src.replace(fenceRe, function (_, lang, code) {
				var idx = codeBlocks.length;
				codeBlocks.push({ lang: lang, code: code.replace(/\n$/, '') });
				return '\x00CODEBLOCK' + idx + '\x00';
			});
			// Escape HTML in the remaining text.
			src = escapeHtml(src);
			// Inline code.
			var inlineCodeRe = new RegExp(BT + '([^' + BT + ']+)' + BT, 'g');
			src = src.replace(inlineCodeRe, '<code>$1</code>');
			// Bold.
			src = src.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
			// Italic (single *).
			src = src.replace(/\*(.+?)\*/g, '<em>$1</em>');
			// Links: [text](url).
			src = src.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
			// Headings.
			src = src.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
			src = src.replace(/^### (.+)$/gm, '<h3>$1</h3>');
			src = src.replace(/^## (.+)$/gm, '<h2>$1</h2>');
			src = src.replace(/^# (.+)$/gm, '<h1>$1</h1>');
			// Blockquote.
			src = src.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
			// Unordered lists: consecutive lines starting with - or *.
			src = src.replace(/^(?:[-*] .+\n?)+/gm, function (block) {
				var items = block.trim().split('\n').map(function (l) {
					return '<li>' + l.replace(/^[-*] /, '') + '</li>';
				}).join('');
				return '<ul>' + items + '</ul>';
			});
			// Ordered lists: consecutive lines starting with a number.
			src = src.replace(/^(?:\d+\. .+\n?)+/gm, function (block) {
				var items = block.trim().split('\n').map(function (l) {
					return '<li>' + l.replace(/^\d+\. /, '') + '</li>';
				}).join('');
				return '<ol>' + items + '</ol>';
			});
			// Paragraphs: split on double newlines, wrap non-block elements in <p>.
			var blocks = src.split(/\n{2,}/);
			src = blocks.map(function (b) {
				b = b.trim();
				if (!b) { return ''; }
				// Already a block element? Leave as-is.
				if (/^<(h[1-4]|ul|ol|pre|blockquote|\x00)/.test(b)) { return b; }
				// Single newline → <br>.
				b = b.replace(/\n/g, '<br>');
				return '<p>' + b + '</p>';
			}).join('\n');
			// Restore code blocks.
			src = src.replace(/\x00CODEBLOCK(\d+)\x00/g, function (_, idx) {
				var cb = codeBlocks[parseInt(idx, 10)];
				var langAttr = cb.lang ? ' class="lang-' + cb.lang + '"' : '';
				return '<pre' + langAttr + '><code>' + escapeHtml(cb.code) + '</code></pre>';
			});
			return src;
		}

		// --- DOM builders (used by S9/S11) ---
		window.addUserMessage = function (text) {
			var el = document.createElement('div');
			el.className = 'message user';
			el.innerHTML = '<div class="role">You</div><div class="content"></div>';
			el.querySelector('.content').textContent = text;
			messagesEl.appendChild(el);
			messagesEl.scrollTop = messagesEl.scrollHeight;
			return el;
		};
		window.addAssistantMessage = function () {
			var el = document.createElement('div');
			el.className = 'message assistant';
			el.innerHTML =
				'<div class="role">Assistant</div>' +
				'<details class="thinking" hidden><summary>Thinking</summary><div class="thinking-content"></div></details>' +
				'<div class="content"></div>' +
				'<div class="usage-badge" hidden></div>';
			messagesEl.appendChild(el);
			messagesEl.scrollTop = messagesEl.scrollHeight;
			return {
				el: el,
				content: el.querySelector('.content'),
				thinking: el.querySelector('.thinking-content'),
				thinkingBlock: el.querySelector('.thinking'),
				usage: el.querySelector('.usage-badge'),
				rawContent: ''
			};
		};
		// Reveal + open the thinking block the first time reasoning arrives.
		function revealThinking(block) {
			if (block.hidden) {
				block.hidden = false;
				block.open = true;
			}
		}
		// Collapse the thinking block at rest (collapsed by default).
		function collapseThinking(block) {
			if (block && !block.hidden) {
				block.open = false;
			}
		}
		window.setContextTrimmed = function (trimmed) {
			contextIndicator.hidden = !trimmed;
		};
		window.setStreaming = function (streaming) {
			sendBtn.disabled = !!streaming;
			stopBtn.style.display = streaming ? 'inline-block' : 'none';
		};

		// --- Toolbar state access (used by S10) ---
		window.getToolbar = function () {
			return {
				model: (modelSelect.value === '__manual__') ? manualInput.value : modelSelect.value,
				thinking: thinkingSelect.value,
				context: contextSelect.value,
				contextFlags: {
					includeFile: ctxFile.checked,
					includeSelection: ctxSelection.checked,
					includeDiagnostics: ctxDiagnostics.checked
				}
			};
		};
		window.setToolbar = function (state) {
			if (!state) { return; }
			if (state.model != null) {
				if (state.model === '__manual__') {
					modelSelect.value = '__manual__';
					syncManual();
				} else {
					modelSelect.value = state.model;
					syncManual();
				}
			}
			if (state.thinking != null) { thinkingSelect.value = state.thinking; }
			if (state.context != null) { contextSelect.value = state.context; }
			if (state.contextFlags) {
				ctxFile.checked = state.contextFlags.includeFile !== false;
				ctxSelection.checked = state.contextFlags.includeSelection !== false;
				ctxDiagnostics.checked = state.contextFlags.includeDiagnostics !== false;
			}
		};

		// Rebuild the model dropdown from a fresh list (keeps the manual entry).
		function setModelOptions(ids) {
			var current = modelSelect.value;
			var opts = ['<option value="">Select model…</option>'];
			(ids || []).forEach(function (id) {
				var safe = String(id).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
				opts.push('<option value="' + safe + '">' + safe + '</option>');
			});
			opts.push('<option value="__manual__">manual…</option>');
			modelSelect.innerHTML = opts.join('');
			// Restore the previous selection if it still exists.
			if (current) {
				for (var i = 0; i < modelSelect.options.length; i++) {
					if (modelSelect.options[i].value === current) {
						modelSelect.value = current;
						break;
					}
				}
			}
			syncManual();
		}

		// --- Host → webview messages (S8: models/clear; S9: streaming; S10: toolbar) ---
		// VS Code delivers host→webview messages via acquireVsCodeApi().onDidReceiveMessage in
		// standard builds. In some builds (e.g. the current dev-container VS Code) the API
		// object only exposes postMessage/getState/setState and host messages arrive as a
		// native DOM "message" event on window. Support BOTH: prefer onDidReceiveMessage,
		// else fall back to a window "message" listener.

		function handleHostMessage(msg) {
			if (!msg || typeof msg !== 'object' || !msg.type) { return; }
			switch (msg.type) {
				case 'models':
					setModelOptions(msg.models);
					break;
				case 'toolbar':
					setToolbar({
						model: msg.model,
						thinking: msg.thinking,
						context: msg.context,
						contextFlags: msg.contextFlags
					});
					break;
				case 'clear':
					messagesEl.innerHTML = '';
					contextIndicator.hidden = true;
					streaming = false;
					currentAssistant = null;
					setStreaming(false);
					break;
				case 'restore':
					messagesEl.innerHTML = '';
					(msg.messages || []).forEach(function (m) {
						if (m.role === 'user') {
							addUserMessage(m.content);
						} else if (m.role === 'assistant') {
							var a = addAssistantMessage();
						a.rawContent = m.content;
						a.content.innerHTML = renderMarkdown(m.content);
							if (m.reasoning_content) {
								a.thinking.textContent = m.reasoning_content;
								a.thinkingBlock.hidden = false;
								a.thinkingBlock.open = false;
							}
						}
					});
					messagesEl.scrollTop = messagesEl.scrollHeight;
					// Update the conversation dropdown.
					if (msg.conversations) {
						var opts = ['<option value="">History…</option>'];
						msg.conversations.forEach(function (c) {
							var safe = String(c.title).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
							opts.push('<option value="' + c.id + '">' + safe + '</option>');
						});
						convSelect.innerHTML = opts.join('');
						if (msg.activeId) { convSelect.value = msg.activeId; }
					}
					break;
				case 'stream_start':
					addUserMessage(lastSentText);
					currentAssistant = addAssistantMessage();
					setContextTrimmed(!!msg.trimmed);
					streaming = true;
					setStreaming(true);
					break;
				case 'delta':
					if (!currentAssistant) { break; }
					if (msg.reasoning) {
						currentAssistant.thinking.textContent += msg.reasoning;
						revealThinking(currentAssistant.thinkingBlock);
					}
					if (msg.content) {
						currentAssistant.rawContent += msg.content;
						currentAssistant.content.innerHTML = renderMarkdown(currentAssistant.rawContent);
					}
					messagesEl.scrollTop = messagesEl.scrollHeight;
					break;
				case 'stream_end':
					streaming = false;
					if (currentAssistant) {
						collapseThinking(currentAssistant.thinkingBlock);
						if (msg.usage && currentAssistant.usage) {
							var u = msg.usage;
							var parts = [];
							if (u.prompt_tokens != null) { parts.push(u.prompt_tokens + ' in'); }
							if (u.completion_tokens != null) { parts.push(u.completion_tokens + ' out'); }
							if (u.total_tokens != null) { parts.push(u.total_tokens + ' total'); }
							if (parts.length) {
								currentAssistant.usage.textContent = '⚡ ' + parts.join(' · ');
								currentAssistant.usage.hidden = false;
							}
						}
					}
					currentAssistant = null;
					setStreaming(false);
					inputEl.focus();
					break;
				case 'error':
					streaming = false;
					if (currentAssistant) { collapseThinking(currentAssistant.thinkingBlock); }
					currentAssistant = null;
					setStreaming(false);
					var errEl = document.createElement('div');
					errEl.className = 'message error';
					errEl.innerHTML = '<div class="role">Error</div><div class="content"></div>';
					errEl.querySelector('.content').textContent = msg.message || 'Unknown error';
					messagesEl.appendChild(errEl);
					messagesEl.scrollTop = messagesEl.scrollHeight;
					break;
				default:
					break;
			}
		}

		if (vscode && typeof vscode.onDidReceiveMessage === 'function') {
			vscode.onDidReceiveMessage(handleHostMessage);
		} else {
			// Fallback: host messages arrive as a native DOM "message" event.
			window.addEventListener('message', function (event) {
				handleHostMessage(event.data);
			});
		}

		// Apply the initial toolbar state, then announce readiness to the host.
		window.setToolbar(window.__llmInitial || {});
		if (vscode) {
			vscode.postMessage({ type: 'ready' });
		}
	})();
	</script>
</body>
</html>`;
}
