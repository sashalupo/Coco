// smoke-test.js — end-to-end smoke test of the LlmClient pipeline against a
// mock OpenAI-compatible server. Exercises the REAL compiled out/client.js +
// out/request.js (the same code the extension uses). The only part not covered
// is the live VS Code webview rendering (needs the VS Code extension host).
'use strict';
const http = require('http');
const path = require('path');
const { LlmClient } = require(path.join(__dirname, '..', 'out', 'client.js'));
const { buildRequestBody } = require(path.join(__dirname, '..', 'out', 'request.js'));
const { buildContextBlock } = require(path.join(__dirname, '..', 'out', 'context.js'));
const { buildCompletionPrompt, parseCompletion } = require(path.join(__dirname, '..', 'out', 'inline.js'));
const { CODE_TOOLS, toolResultMessage } = require(path.join(__dirname, '..', 'out', 'tools.js'));
const { accumulateToolCalls } = require(path.join(__dirname, '..', 'out', 'client.js'));
const { buildCodeActionPrompt, parseCodeAction } = require(path.join(__dirname, '..', 'out', 'codeaction.js'));

const PORT = 18099;

// --- Mock OpenAI-compatible engine ---
const server = http.createServer((req, res) => {
	if (req.method === 'GET' && req.url === '/health') {
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ status: 'ok', model: 'qwen3.8-27b' }));
		return;
	}
	if (req.method === 'GET' && req.url === '/v1/models') {
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({
			object: 'list',
			data: [
				{ id: 'qwen3.8-27b', object: 'model', owned_by: 'ninfer' },
				{ id: 'qwen3.8-8b', object: 'model', owned_by: 'ninfer' },
			],
		}));
		return;
	}
	if (req.method === 'POST' && req.url === '/v1/chat/completions') {
		let body = '';
		req.on('data', (c) => { body += c; });
		req.on('end', () => {
			const parsed = JSON.parse(body);
			// Echo back what we received for assertions.
			global.__lastRequest = parsed;
			res.writeHead(200, {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
			});
			const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
			if (Array.isArray(parsed.tools)) {
				// Tool-calling reply: a single tool call whose arguments are split
				// across two SSE chunks (exercises parseSseLine + accumulateToolCalls
				// reassembly through the real chatStream pipeline).
				send({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', type: 'function', function: { name: 'read_file', arguments: '{"pat' } }] } }] });
				send({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'h":"a.ts"}' } }] } }] });
				send({ choices: [{ delta: {} }], usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 } });
				res.write('data: [DONE]\n\n');
				res.end();
				return;
			}
			// Stream: reasoning_content chunks, then content chunks, then usage, then [DONE].
			const reasoning = ['Let ', 'me ', 'think ', 'about ', 'this.'];
			const content = ['The ', 'answer ', 'is ', '42.'];
			reasoning.forEach((t) => send({ choices: [{ delta: { reasoning_content: t } }] }));
			content.forEach((t) => send({ choices: [{ delta: { content: t } }] }));
			send({ choices: [{ delta: {} }], usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } });
			res.write('data: [DONE]\n\n');
			res.end();
		});
		return;
	}
	res.writeHead(404, { 'Content-Type': 'application/json' });
	res.end(JSON.stringify({ error: 'not found' }));
});

function assert(cond, label) {
	if (!cond) {
		console.error('FAIL:', label);
		process.exit(1);
	}
	console.log('PASS:', label);
}

(async () => {
	await new Promise((r) => server.listen(PORT, r));
	const settings = {
		baseUrl: `http://localhost:${PORT}`, apiKey: '', model: '', systemPrompt: '',
		temperature: 1, topP: 1, topK: 20, minP: 0, presencePenalty: 0, frequencyPenalty: 0,
		seed: '', stop: [], maxCompletionTokens: 4096, preserveThinking: false, stream: true,
		includeUsage: true, responseFormat: 'text', chatTemplateKwargs: {}, toolsEnabled: false,
	};
	const client = new LlmClient(() => settings);

	// 1) health
	const h = await client.health();
	assert(h.ok && h.status === 200, 'health() ok (200)');
	assert(h.body && h.body.status === 'ok', 'health() body.status === ok');

	// 2) listModels
	const models = await client.listModels();
	assert(models.data.length === 2, 'listModels() returns 2 models');
	assert(models.data[0].id === 'qwen3.8-27b', 'listModels() first model is qwen3.8-27b');

	// 3) buildRequestBody with thinking=high + context=32k
	const toolbar = { model: 'qwen3.8-27b', thinking: 'high', context: '32k' };
	const { body, budgetTokens } = buildRequestBody({ settings, toolbar }, [{ role: 'user', content: 'hi' }]);
	assert(body.model === 'qwen3.8-27b', 'request body model = qwen3.8-27b');
	assert(body.reasoning_effort === 'high', 'request body reasoning_effort = high');
	assert(body.enable_thinking === true, 'request body enable_thinking = true');
	assert(body.stream === true, 'request body stream = true');
	assert(budgetTokens === 32000, 'context budget = 32000');

	// 3b) buildContextBlock (Phase 2: editor context formatting)
	assert(buildContextBlock({}) === '', 'context: empty input -> empty string');
	assert(buildContextBlock({ file: undefined, selection: undefined, diagnostics: [] }) === '', 'context: empty sections -> empty string');

	const fileOnly = buildContextBlock({ file: { path: 'src/a.ts', language: 'typescript', content: 'const x = 1;' } });
	assert(fileOnly.includes('File: src/a.ts (typescript)'), 'context: file header with language');
	assert(fileOnly.includes('const x = 1;'), 'context: file content included');

	const fileNoLang = buildContextBlock({ file: { path: 'README.md', content: '# hi' } });
	assert(fileNoLang.includes('File: README.md') && !fileNoLang.includes('('), 'context: file header without language');

	const sel1 = buildContextBlock({ selection: { startLine: 3, startColumn: 5, endLine: 3, endColumn: 10, text: 'abc' } });
	assert(sel1.includes('line 3, col 5-10'), 'context: single-line selection range');
	assert(sel1.includes('abc'), 'context: selection text included');

	const sel2 = buildContextBlock({ selection: { startLine: 3, startColumn: 1, endLine: 7, endColumn: 4, text: 'multi' } });
	assert(sel2.includes('lines 3:1–7:4'), 'context: multi-line selection range');

	const diag = buildContextBlock({ diagnostics: [
		{ line: 1, column: 2, severity: 'error', message: 'cannot find name' },
		{ line: 9, column: 1, severity: 'warning', message: 'unused var' },
	] });
	assert(diag.includes('[error] 1:2 — cannot find name'), 'context: diagnostic error line');
	assert(diag.includes('[warning] 9:1 — unused var'), 'context: diagnostic warning line');

	const all = buildContextBlock({
		file: { path: 'f.ts', language: 'typescript', content: 'x' },
		selection: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2, text: 'x' },
		diagnostics: [{ line: 1, column: 1, severity: 'info', message: 'note' }],
	});
	const iFile = all.indexOf('File:'), iSel = all.indexOf('Selection'), iDiag = all.indexOf('Diagnostics:');
	assert(iFile < iSel && iSel < iDiag, 'context: stable section order (file -> selection -> diagnostics)');

	// 3c) buildCompletionPrompt + parseCompletion (Phase 3: inline completion)
	const cp = buildCompletionPrompt({ language: 'typescript', path: 'src/a.ts', prefix: 'const x = ', suffix: ';\nconsole.log(x);' });
	assert(cp.includes('Complete the following typescript code.'), 'inline: prompt includes language');
	assert(cp.includes('File: src/a.ts'), 'inline: prompt includes path');
	assert(cp.includes('const x = '), 'inline: prompt includes prefix');
	assert(cp.includes('console.log(x);'), 'inline: prompt includes suffix');
	assert(cp.includes('ONLY the completion'), 'inline: prompt asks for completion only');

	const cpNoSuffix = buildCompletionPrompt({ language: 'python', path: '', prefix: 'def f():', suffix: '' });
	assert(cpNoSuffix.includes('python'), 'inline: prompt language (no path)');
	assert(!cpNoSuffix.includes('File:'), 'inline: no File line when path empty');
	assert(!cpNoSuffix.includes('Code after the cursor'), 'inline: no suffix section when empty');

	assert(parseCompletion('') === '', 'inline: parse empty -> empty');
	assert(parseCompletion('   \n  ') === '', 'inline: parse whitespace -> empty');
	assert(parseCompletion('42') === '42', 'inline: parse plain passthrough');
	assert(parseCompletion('  42  ') === '42', 'inline: parse trims whitespace');
	assert(parseCompletion('```typescript\nconst y = 1;\n```') === 'const y = 1;', 'inline: parse strips fenced code');
	assert(parseCompletion('```\nfoo\n```') === 'foo', 'inline: parse strips fence without lang');
	assert(parseCompletion('```\n') === '', 'inline: parse fence only -> empty');
	assert(parseCompletion('const a = 1;\nconst b = 2;') === 'const a = 1;\nconst b = 2;', 'inline: parse multi-line preserved');

	// 4) chatStream (SSE with reasoning_content + content + usage + [DONE])
	let reasoning = '';
	let content = '';
	let done = false;
	let usage = null;
	for await (const chunk of client.chatStream(body)) {
		if (chunk.reasoning) reasoning += chunk.reasoning;
		if (chunk.content) content += chunk.content;
		if (chunk.usage) usage = chunk.usage;
		if (chunk.done) done = true;
	}
	assert(reasoning === 'Let me think about this.', 'chatStream reasoning reassembled');
	assert(content === 'The answer is 42.', 'chatStream content reassembled');
	assert(done === true, 'chatStream terminal done chunk');
	assert(usage && usage.total_tokens === 30, 'chatStream usage surfaced (total_tokens=30)');
	assert(global.__lastRequest.stream === true, 'engine received stream:true');
	assert(global.__lastRequest.reasoning_effort === 'high', 'engine received reasoning_effort=high');

	// 5) tools: CODE_TOOLS shape
	assert(CODE_TOOLS.length === 4, 'tools: CODE_TOOLS has 4 tools');
	assert(CODE_TOOLS.map((t) => t.function.name).join(',') === 'read_file,write_file,list_dir,search_files', 'tools: tool names in order');
	assert(CODE_TOOLS.every((t) => t.type === 'function'), 'tools: all type=function');
	assert(CODE_TOOLS.every((t) => t.function.parameters.type === 'object'), 'tools: all parameters.type=object');
	const byName = Object.fromEntries(CODE_TOOLS.map((t) => [t.function.name, t]));
	assert(byName.read_file.function.parameters.required.join(',') === 'path', 'tools: read_file required=[path]');
	assert(byName.write_file.function.parameters.required.join(',') === 'path,content', 'tools: write_file required=[path,content]');
	assert(byName.list_dir.function.parameters.required.join(',') === 'path', 'tools: list_dir required=[path]');
	assert(byName.search_files.function.parameters.required.join(',') === 'pattern', 'tools: search_files required=[pattern]');

	// 5b) toolResultMessage
	const tc = { id: 'call_123', type: 'function', function: { name: 'read_file', arguments: '{"path":"a.ts"}' } };
	const trm = toolResultMessage(tc, 'file contents');
	assert(trm.role === 'tool', 'tools: toolResultMessage role=tool');
	assert(trm.tool_call_id === 'call_123', 'tools: toolResultMessage tool_call_id matches call.id');
	assert(trm.content === 'file contents', 'tools: toolResultMessage content passthrough');

	// 5c) accumulateToolCalls (pure)
	assert(accumulateToolCalls([], []).length === 0, 'tools: accumulate empty -> empty');
	const acc1 = accumulateToolCalls([], [{ index: 0, id: 'c1', type: 'function', function: { name: 'read_file', arguments: '{"pat' } }]);
	assert(acc1.length === 1 && acc1[0].id === 'c1' && acc1[0].function.name === 'read_file', 'tools: accumulate single delta');
	const acc2 = accumulateToolCalls(acc1, [{ index: 0, function: { arguments: 'h":"a.ts"}' } }]);
	assert(acc2[0].function.arguments === '{"path":"a.ts"}', 'tools: accumulate concatenates split arguments');
	const acc3 = accumulateToolCalls([], [
		{ index: 0, id: 'a', function: { name: 'read_file', arguments: '{}' } },
		{ index: 1, id: 'b', function: { name: 'list_dir', arguments: '{}' } },
	]);
	assert(acc3.length === 2 && acc3[0].id === 'a' && acc3[1].id === 'b', 'tools: accumulate two calls by index');

	// 5d) chatStream tool-call accumulation (mock SSE with tool_calls deltas)
	const toolSettings = { ...settings, toolsEnabled: true };
	const toolBody = buildRequestBody({ settings: toolSettings, toolbar }, [{ role: 'user', content: 'read a.ts' }]).body;
	assert(Array.isArray(toolBody.tools) && toolBody.tools.length === 4, 'tools: request body carries tools when enabled');
	assert(toolBody.tool_choice === 'auto', 'tools: request body tool_choice=auto');
	let finalToolCalls = [];
	let toolDone = false;
	for await (const chunk of client.chatStream(toolBody)) {
		if (chunk.toolCalls) finalToolCalls = chunk.toolCalls;
		if (chunk.done) toolDone = true;
	}
	assert(toolDone, 'tools: chatStream terminal done chunk (tool reply)');
	assert(finalToolCalls.length === 1, 'tools: chatStream reassembled 1 tool call');
	assert(finalToolCalls[0].id === 'c1', 'tools: chatStream tool call id=c1');
	assert(finalToolCalls[0].function.name === 'read_file', 'tools: chatStream tool call name=read_file');
	assert(finalToolCalls[0].function.arguments === '{"path":"a.ts"}', 'tools: chatStream tool call arguments reassembled across chunks');

	// 6) code action: buildCodeActionPrompt + parseCodeAction (Phase 5)
	const ca = buildCodeActionPrompt({
		language: 'typescript',
		path: 'src/a.ts',
		code: 'const x = 1;\nconsole.log(x);',
		selection: { startLine: 1, endLine: 2, text: 'const x = 1;' },
		diagnostics: [{ line: 1, column: 7, severity: 'error', message: 'cannot find name' }],
	});
	assert(ca.includes('Fix or refactor the following typescript code.'), 'codeaction: prompt header with language');
	assert(ca.includes('Return ONLY the full updated code'), 'codeaction: prompt only-code instruction');
	assert(ca.includes('File: src/a.ts'), 'codeaction: prompt includes path');
	assert(ca.includes('const x = 1;'), 'codeaction: prompt includes code');
	assert(ca.includes('Selected range (lines 1–2):'), 'codeaction: prompt includes selection range');
	assert(ca.includes('[error] 1:7 — cannot find name'), 'codeaction: prompt includes diagnostic');
	const caCode = ca.indexOf('Code:'), caSel = ca.indexOf('Selected range'), caDiag = ca.indexOf('Diagnostics to address');
	assert(caCode < caSel && caSel < caDiag, 'codeaction: stable order (code -> selection -> diagnostics)');

	const caMin = buildCodeActionPrompt({ language: 'python', path: '', code: 'def f():\n    pass' });
	assert(caMin.includes('python'), 'codeaction: prompt language (minimal)');
	assert(!caMin.includes('File:'), 'codeaction: no File line when path empty');
	assert(!caMin.includes('Selected range'), 'codeaction: no selection section when absent');
	assert(!caMin.includes('Diagnostics to address'), 'codeaction: no diagnostics section when absent');

	const caSel1 = buildCodeActionPrompt({ language: 'js', path: 'b.js', code: 'x', selection: { startLine: 5, endLine: 5, text: 'x' } });
	assert(caSel1.includes('Selected range (line 5):'), 'codeaction: single-line selection range');

	assert(parseCodeAction('') === '', 'codeaction: parse empty -> empty');
	assert(parseCodeAction('   \n  ') === '', 'codeaction: parse whitespace -> empty');
	assert(parseCodeAction('const y = 1;') === 'const y = 1;', 'codeaction: parse plain passthrough');
	assert(parseCodeAction('  const y = 1;  ') === 'const y = 1;', 'codeaction: parse trims whitespace');
	assert(parseCodeAction('```typescript\nconst y = 1;\n```') === 'const y = 1;', 'codeaction: parse strips fenced code');
	assert(parseCodeAction('```\nfoo\n```') === 'foo', 'codeaction: parse strips fence without lang');
	assert(parseCodeAction('```\n') === '', 'codeaction: parse fence only -> empty');
	assert(parseCodeAction('const a = 1;\nconst b = 2;') === 'const a = 1;\nconst b = 2;', 'codeaction: parse multi-line preserved');

	console.log('\nALL SMOKE TESTS PASSED');
	server.close();
	process.exit(0);
})().catch((e) => {
	console.error('SMOKE TEST ERROR:', e);
	server.close();
	process.exit(1);
});
