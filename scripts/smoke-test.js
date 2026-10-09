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
			// Stream: reasoning_content chunks, then content chunks, then usage, then [DONE].
			const reasoning = ['Let ', 'me ', 'think ', 'about ', 'this.'];
			const content = ['The ', 'answer ', 'is ', '42.'];
			const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
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

	console.log('\nALL SMOKE TESTS PASSED');
	server.close();
	process.exit(0);
})().catch((e) => {
	console.error('SMOKE TEST ERROR:', e);
	server.close();
	process.exit(1);
});
