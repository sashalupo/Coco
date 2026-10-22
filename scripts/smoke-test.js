// smoke-test.js — end-to-end smoke test of the LlmClient pipeline against a
// mock OpenAI-compatible server. Exercises the REAL compiled out/client.js +
// out/request.js (the same code the extension uses). The only part not covered
// is the live VS Code webview rendering (needs the VS Code extension host).
"use strict";
const http = require("http");
const path = require("path");
const { LlmClient } = require(path.join(__dirname, "..", "out", "client.js"));
const { buildRequestBody } = require(
  path.join(__dirname, "..", "out", "request.js"),
);
const { buildContextBlock } = require(
  path.join(__dirname, "..", "out", "context.js"),
);
const { buildCompletionPrompt, parseCompletion } = require(
  path.join(__dirname, "..", "out", "inline.js"),
);
const { CODE_TOOLS, toolResultMessage, isMutatingTool } = require(
  path.join(__dirname, "..", "out", "tools.js"),
);
const { accumulateToolCalls } = require(
  path.join(__dirname, "..", "out", "client.js"),
);
const { buildCodeActionPrompt, parseCodeAction } = require(
  path.join(__dirname, "..", "out", "codeaction.js"),
);
const { unifiedDiff, diffStats } = require(
  path.join(__dirname, "..", "out", "diff.js"),
);
const { scanForSecrets } = require(
  path.join(__dirname, "..", "out", "secrets.js"),
);
const {
  parseNotebook,
  formatNotebookForContext,
  createNotebook,
  applyNotebookEdit,
} = require(path.join(__dirname, "..", "out", "notebook.js"));

const PORT = 18099;

// --- Mock OpenAI-compatible engine ---
const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", model: "qwen3.8-27b" }));
    return;
  }
  if (req.method === "GET" && req.url === "/v1/models") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        object: "list",
        data: [
          { id: "qwen3.8-27b", object: "model", owned_by: "ninfer" },
          { id: "qwen3.8-8b", object: "model", owned_by: "ninfer" },
        ],
      }),
    );
    return;
  }
  if (req.method === "POST" && req.url === "/v1/chat/completions") {
    let body = "";
    req.on("data", (c) => {
      body += c;
    });
    req.on("end", () => {
      const parsed = JSON.parse(body);
      // Echo back what we received for assertions.
      global.__lastRequest = parsed;
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
      if (Array.isArray(parsed.tools)) {
        const lastUser = [...parsed.messages]
          .reverse()
          .find((m) => m.role === "user");
        const isEditTest =
          !!lastUser &&
          typeof lastUser.content === "string" &&
          lastUser.content.includes("EDIT_FILE_TEST");
        if (isEditTest) {
          // edit_file tool call, arguments split across two SSE chunks.
          send({
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: "e1",
                      type: "function",
                      function: {
                        name: "edit_file",
                        arguments:
                          '{"path":"sample.txt","old_string":"foo","new_st',
                      },
                    },
                  ],
                },
              },
            ],
          });
          send({
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      function: { arguments: 'ring":"bar"}' },
                    },
                  ],
                },
              },
            ],
          });
          send({
            choices: [{ delta: {} }],
            usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
          });
          res.write("data: [DONE]\n\n");
          res.end();
          return;
        }
        // Tool-calling reply: a single tool call whose arguments are split
        // across two SSE chunks (exercises parseSseLine + accumulateToolCalls
        // reassembly through the real chatStream pipeline).
        send({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "c1",
                    type: "function",
                    function: { name: "read_file", arguments: '{"pat' },
                  },
                ],
              },
            },
          ],
        });
        send({
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, function: { arguments: 'h":"a.ts"}' } },
                ],
              },
            },
          ],
        });
        send({
          choices: [{ delta: {} }],
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
        });
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }
      // Stream: reasoning_content chunks, then content chunks, then usage, then [DONE].
      const reasoning = ["Let ", "me ", "think ", "about ", "this."];
      const content = ["The ", "answer ", "is ", "42."];
      reasoning.forEach((t) =>
        send({ choices: [{ delta: { reasoning_content: t } }] }),
      );
      content.forEach((t) => send({ choices: [{ delta: { content: t } }] }));
      send({
        choices: [{ delta: {} }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      });
      res.write("data: [DONE]\n\n");
      res.end();
    });
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

function assert(cond, label) {
  if (!cond) {
    console.error("FAIL:", label);
    process.exit(1);
  }
  console.log("PASS:", label);
}

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const settings = {
    baseUrl: `http://localhost:${PORT}`,
    apiKey: "",
    model: "",
    systemPrompt: "",
    temperature: 1,
    topP: 1,
    topK: 20,
    minP: 0,
    presencePenalty: 0,
    frequencyPenalty: 0,
    seed: "",
    stop: [],
    maxCompletionTokens: 4096,
    preserveThinking: false,
    stream: true,
    includeUsage: true,
    responseFormat: "text",
    chatTemplateKwargs: {},
    toolsEnabled: false,
  };
  const client = new LlmClient(() => settings);

  // 1) health
  const h = await client.health();
  assert(h.ok && h.status === 200, "health() ok (200)");
  assert(h.body && h.body.status === "ok", "health() body.status === ok");

  // 2) listModels
  const models = await client.listModels();
  assert(models.data.length === 2, "listModels() returns 2 models");
  assert(
    models.data[0].id === "qwen3.8-27b",
    "listModels() first model is qwen3.8-27b",
  );

  // 3) buildRequestBody with thinking=high + context=32k
  const toolbar = { model: "qwen3.8-27b", thinking: "high", context: "32k" };
  const { body, budgetTokens } = buildRequestBody({ settings, toolbar }, [
    { role: "user", content: "hi" },
  ]);
  assert(body.model === "qwen3.8-27b", "request body model = qwen3.8-27b");
  assert(
    body.reasoning_effort === "high",
    "request body reasoning_effort = high",
  );
  assert(body.enable_thinking === true, "request body enable_thinking = true");
  assert(body.stream === true, "request body stream = true");
  assert(budgetTokens === 32000, "context budget = 32000");

  // 3b) buildContextBlock (Phase 2: editor context formatting)
  assert(buildContextBlock({}) === "", "context: empty input -> empty string");
  assert(
    buildContextBlock({
      file: undefined,
      selection: undefined,
      diagnostics: [],
    }) === "",
    "context: empty sections -> empty string",
  );

  const fileOnly = buildContextBlock({
    file: { path: "src/a.ts", language: "typescript", content: "const x = 1;" },
  });
  assert(
    fileOnly.includes("File: src/a.ts (typescript)"),
    "context: file header with language",
  );
  assert(fileOnly.includes("const x = 1;"), "context: file content included");

  const fileNoLang = buildContextBlock({
    file: { path: "README.md", content: "# hi" },
  });
  assert(
    fileNoLang.includes("File: README.md") && !fileNoLang.includes("("),
    "context: file header without language",
  );

  const sel1 = buildContextBlock({
    selection: {
      startLine: 3,
      startColumn: 5,
      endLine: 3,
      endColumn: 10,
      text: "abc",
    },
  });
  assert(
    sel1.includes("line 3, col 5-10"),
    "context: single-line selection range",
  );
  assert(sel1.includes("abc"), "context: selection text included");

  const sel2 = buildContextBlock({
    selection: {
      startLine: 3,
      startColumn: 1,
      endLine: 7,
      endColumn: 4,
      text: "multi",
    },
  });
  assert(sel2.includes("lines 3:1–7:4"), "context: multi-line selection range");

  const diag = buildContextBlock({
    diagnostics: [
      { line: 1, column: 2, severity: "error", message: "cannot find name" },
      { line: 9, column: 1, severity: "warning", message: "unused var" },
    ],
  });
  assert(
    diag.includes("[error] 1:2 — cannot find name"),
    "context: diagnostic error line",
  );
  assert(
    diag.includes("[warning] 9:1 — unused var"),
    "context: diagnostic warning line",
  );

  const all = buildContextBlock({
    file: { path: "f.ts", language: "typescript", content: "x" },
    selection: {
      startLine: 1,
      startColumn: 1,
      endLine: 1,
      endColumn: 2,
      text: "x",
    },
    diagnostics: [{ line: 1, column: 1, severity: "info", message: "note" }],
  });
  const iFile = all.indexOf("File:"),
    iSel = all.indexOf("Selection"),
    iDiag = all.indexOf("Diagnostics:");
  assert(
    iFile < iSel && iSel < iDiag,
    "context: stable section order (file -> selection -> diagnostics)",
  );

  // 3b-nb) tagged .ipynb files render as cells, not raw JSON (1.98-2.S5)
  const taggedNbFixture = JSON.stringify({
    cells: [
      {
        cell_type: "code",
        execution_count: 1,
        metadata: {},
        outputs: [
          {
            output_type: "stream",
            name: "stdout",
            text: ["hello\n"],
          },
        ],
        source: "print('hello')",
      },
      {
        cell_type: "markdown",
        metadata: {},
        source: "# Title",
      },
    ],
    metadata: { language_info: { name: "python" } },
    nbformat: 4,
    nbformat_minor: 5,
  });
  const taggedNb = buildContextBlock({
    taggedFiles: [{ path: "nb.ipynb", content: taggedNbFixture }],
  });
  assert(
    taggedNb.includes("Tagged file: nb.ipynb"),
    "context: tagged notebook header",
  );
  assert(
    taggedNb.includes("### Cell 0 (code)"),
    "context: tagged notebook renders cell heading",
  );
  assert(
    taggedNb.includes("print('hello')"),
    "context: tagged notebook cell source included",
  );
  assert(
    !taggedNb.includes('"cells":'),
    "context: tagged notebook has no raw JSON cells key",
  );
  const taggedTs = buildContextBlock({
    taggedFiles: [{ path: "foo.ts", content: "const y = 2;" }],
  });
  assert(
    taggedTs.includes("Tagged file: foo.ts") &&
      taggedTs.includes("```\nconst y = 2;\n```"),
    "context: non-notebook tagged file keeps raw fenced block",
  );

  // 3c) buildCompletionPrompt + parseCompletion (Phase 3: inline completion)
  const cp = buildCompletionPrompt({
    language: "typescript",
    path: "src/a.ts",
    prefix: "const x = ",
    suffix: ";\nconsole.log(x);",
  });
  assert(
    cp.includes("Complete the following typescript code."),
    "inline: prompt includes language",
  );
  assert(cp.includes("File: src/a.ts"), "inline: prompt includes path");
  assert(cp.includes("const x = "), "inline: prompt includes prefix");
  assert(cp.includes("console.log(x);"), "inline: prompt includes suffix");
  assert(
    cp.includes("ONLY the completion"),
    "inline: prompt asks for completion only",
  );

  const cpNoSuffix = buildCompletionPrompt({
    language: "python",
    path: "",
    prefix: "def f():",
    suffix: "",
  });
  assert(cpNoSuffix.includes("python"), "inline: prompt language (no path)");
  assert(!cpNoSuffix.includes("File:"), "inline: no File line when path empty");
  assert(
    !cpNoSuffix.includes("Code after the cursor"),
    "inline: no suffix section when empty",
  );

  assert(parseCompletion("") === "", "inline: parse empty -> empty");
  assert(
    parseCompletion("   \n  ") === "",
    "inline: parse whitespace -> empty",
  );
  assert(parseCompletion("42") === "42", "inline: parse plain passthrough");
  assert(parseCompletion("  42  ") === "42", "inline: parse trims whitespace");
  assert(
    parseCompletion("```typescript\nconst y = 1;\n```") === "const y = 1;",
    "inline: parse strips fenced code",
  );
  assert(
    parseCompletion("```\nfoo\n```") === "foo",
    "inline: parse strips fence without lang",
  );
  assert(parseCompletion("```\n") === "", "inline: parse fence only -> empty");
  assert(
    parseCompletion("const a = 1;\nconst b = 2;") ===
      "const a = 1;\nconst b = 2;",
    "inline: parse multi-line preserved",
  );

  // 4) chatStream (SSE with reasoning_content + content + usage + [DONE])
  let reasoning = "";
  let content = "";
  let done = false;
  let usage = null;
  for await (const chunk of client.chatStream(body)) {
    if (chunk.reasoning) reasoning += chunk.reasoning;
    if (chunk.content) content += chunk.content;
    if (chunk.usage) usage = chunk.usage;
    if (chunk.done) done = true;
  }
  assert(
    reasoning === "Let me think about this.",
    "chatStream reasoning reassembled",
  );
  assert(content === "The answer is 42.", "chatStream content reassembled");
  assert(done === true, "chatStream terminal done chunk");
  assert(
    usage && usage.total_tokens === 30,
    "chatStream usage surfaced (total_tokens=30)",
  );
  assert(global.__lastRequest.stream === true, "engine received stream:true");
  assert(
    global.__lastRequest.reasoning_effort === "high",
    "engine received reasoning_effort=high",
  );

  // 5) tools: CODE_TOOLS shape
  assert(CODE_TOOLS.length === 11, "tools: CODE_TOOLS has 11 tools");
  assert(
    CODE_TOOLS.map((t) => t.function.name).join(",") ===
      "read_file,write_file,edit_file,list_dir,search_files,run_command,get_diagnostics,git_status,git_diff,manage_todos,notebook_edit",
    "tools: tool names in order",
  );
  assert(
    CODE_TOOLS.every((t) => t.type === "function"),
    "tools: all type=function",
  );
  assert(
    CODE_TOOLS.every((t) => t.function.parameters.type === "object"),
    "tools: all parameters.type=object",
  );
  const byName = Object.fromEntries(
    CODE_TOOLS.map((t) => [t.function.name, t]),
  );
  assert(
    byName.read_file.function.parameters.required.join(",") === "path",
    "tools: read_file required=[path]",
  );
  assert(
    byName.write_file.function.parameters.required.join(",") === "path,content",
    "tools: write_file required=[path,content]",
  );
  assert(
    byName.list_dir.function.parameters.required.join(",") === "path",
    "tools: list_dir required=[path]",
  );
  assert(
    byName.search_files.function.parameters.required.join(",") === "pattern",
    "tools: search_files required=[pattern]",
  );
  assert(
    byName.notebook_edit.function.parameters.required.join(",") ===
      "path,action",
    "tools: notebook_edit required=[path,action]",
  );
  assert(
    byName.notebook_edit.function.parameters.properties.action.enum.length ===
      5,
    "tools: notebook_edit action enum has 5 values",
  );
  assert(
    byName.run_command.function.parameters.required.join(",") === "command",
    "tools: run_command required=[command]",
  );
  assert(
    !byName.get_diagnostics.function.parameters.required,
    "tools: get_diagnostics has no required params (path optional)",
  );
  assert(
    !byName.git_status.function.parameters.required,
    "tools: git_status has no required params",
  );
  assert(
    !byName.git_diff.function.parameters.required,
    "tools: git_diff has no required params (path optional)",
  );

  // 5b) toolResultMessage
  const tc = {
    id: "call_123",
    type: "function",
    function: { name: "read_file", arguments: '{"path":"a.ts"}' },
  };
  const trm = toolResultMessage(tc, "file contents");
  assert(trm.role === "tool", "tools: toolResultMessage role=tool");
  assert(
    trm.tool_call_id === "call_123",
    "tools: toolResultMessage tool_call_id matches call.id",
  );
  assert(
    trm.content === "file contents",
    "tools: toolResultMessage content passthrough",
  );

  // 5c) accumulateToolCalls (pure)
  assert(
    accumulateToolCalls([], []).length === 0,
    "tools: accumulate empty -> empty",
  );
  const acc1 = accumulateToolCalls(
    [],
    [
      {
        index: 0,
        id: "c1",
        type: "function",
        function: { name: "read_file", arguments: '{"pat' },
      },
    ],
  );
  assert(
    acc1.length === 1 &&
      acc1[0].id === "c1" &&
      acc1[0].function.name === "read_file",
    "tools: accumulate single delta",
  );
  const acc2 = accumulateToolCalls(acc1, [
    { index: 0, function: { arguments: 'h":"a.ts"}' } },
  ]);
  assert(
    acc2[0].function.arguments === '{"path":"a.ts"}',
    "tools: accumulate concatenates split arguments",
  );
  const acc3 = accumulateToolCalls(
    [],
    [
      { index: 0, id: "a", function: { name: "read_file", arguments: "{}" } },
      { index: 1, id: "b", function: { name: "list_dir", arguments: "{}" } },
    ],
  );
  assert(
    acc3.length === 2 && acc3[0].id === "a" && acc3[1].id === "b",
    "tools: accumulate two calls by index",
  );

  // 5d) chatStream tool-call accumulation (mock SSE with tool_calls deltas)
  const toolSettings = { ...settings, toolsEnabled: true };
  const toolBody = buildRequestBody({ settings: toolSettings, toolbar }, [
    { role: "user", content: "read a.ts" },
  ]).body;
  assert(
    Array.isArray(toolBody.tools) && toolBody.tools.length === 11,
    "tools: request body carries tools when enabled",
  );
  assert(
    toolBody.tool_choice === "auto",
    "tools: request body tool_choice=auto",
  );
  let finalToolCalls = [];
  let toolDone = false;
  for await (const chunk of client.chatStream(toolBody)) {
    if (chunk.toolCalls) finalToolCalls = chunk.toolCalls;
    if (chunk.done) toolDone = true;
  }
  assert(toolDone, "tools: chatStream terminal done chunk (tool reply)");
  assert(
    finalToolCalls.length === 1,
    "tools: chatStream reassembled 1 tool call",
  );
  assert(finalToolCalls[0].id === "c1", "tools: chatStream tool call id=c1");
  assert(
    finalToolCalls[0].function.name === "read_file",
    "tools: chatStream tool call name=read_file",
  );
  assert(
    finalToolCalls[0].function.arguments === '{"path":"a.ts"}',
    "tools: chatStream tool call arguments reassembled across chunks",
  );

  // 5e) edit_file end-to-end (Phase 6.4): the real chatStream reassembles an
  // edit_file tool call (args split across SSE chunks), the real ToolExecutor
  // applies it to a real file on disk, and toolResultMessage builds the
  // feedback. Exercises the full agentic-loop round-trip through compiled code.
  const Module = require("module");
  const fs = require("fs");
  const os = require("os");
  const editRoot = fs.mkdtempSync(path.join(os.tmpdir(), "llm-edit-test-"));
  const samplePath = path.join(editRoot, "sample.txt");
  fs.writeFileSync(samplePath, "line1\nfoo\nline3\n", "utf8");
  // A fake open document with diagnostics, for the get_diagnostics test.
  const diagDocPath = path.join(editRoot, "diag.ts");
  fs.writeFileSync(diagDocPath, "const x: number = 'oops';\n", "utf8");
  const diagUri = {
    fsPath: diagDocPath,
    toString: () => "file://" + diagDocPath,
  };
  const fakeDiagnostics = [
    {
      severity: 0,
      range: {
        start: { line: 0, character: 14 },
        end: { line: 0, character: 20 },
      },
      message: "Type 'string' is not assignable to type 'number'.",
      source: "ts",
    },
  ];
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === "vscode") {
      return {
        Uri: {
          file: (p) => ({ fsPath: p, toString: () => "file://" + p }),
        },
        workspace: {
          workspaceFolders: [{ uri: { fsPath: editRoot } }],
          textDocuments: [{ uri: diagUri }],
        },
        languages: {
          // Two overloads: getDiagnostics(uri) -> Diagnostic[] for one file,
          // getDiagnostics() -> [Uri, Diagnostic[]][] for every file.
          getDiagnostics: (uri) => {
            if (uri === undefined) {
              return [[diagUri, fakeDiagnostics]];
            }
            return uri.fsPath === diagDocPath ? fakeDiagnostics : [];
          },
        },
        DiagnosticSeverity: {
          0: "Error",
          1: "Warning",
          2: "Information",
          3: "Hint",
        },
      };
    }
    return originalLoad.apply(this, arguments);
  };
  const { ToolExecutor } = require(
    path.join(__dirname, "..", "out", "tools", "ToolExecutor.js"),
  );
  const executor = new ToolExecutor();

  // Full loop: engine streams an edit_file tool call -> real chatStream
  // reassembles it -> real executor applies it to the file on disk.
  const editBody = buildRequestBody({ settings: toolSettings, toolbar }, [
    { role: "user", content: "EDIT_FILE_TEST: change foo to bar" },
  ]).body;
  let editCalls = [];
  let editDone = false;
  for await (const chunk of client.chatStream(editBody)) {
    if (chunk.toolCalls) editCalls = chunk.toolCalls;
    if (chunk.done) editDone = true;
  }
  assert(editDone, "edit: chatStream terminal done chunk (edit reply)");
  assert(editCalls.length === 1, "edit: chatStream reassembled 1 tool call");
  assert(
    editCalls[0].function.name === "edit_file",
    "edit: chatStream tool call name=edit_file",
  );
  assert(
    editCalls[0].function.arguments ===
      '{"path":"sample.txt","old_string":"foo","new_string":"bar"}',
    "edit: chatStream edit_file arguments reassembled across chunks",
  );
  const editResult = await executor.execute(editCalls[0]);
  assert(
    editResult.tool_call_id === editCalls[0].id,
    "edit: result tool_call_id matches call id",
  );
  assert(
    editResult.content.includes("Replaced 1 occurrence in sample.txt"),
    "edit: result reports 1 occurrence replaced",
  );
  assert(
    editResult.content.includes("Diff:"),
    "edit: result includes diff preview",
  );
  assert(
    editResult.content.includes("-foo") && editResult.content.includes("+bar"),
    "edit: diff shows -foo and +bar",
  );
  assert(
    fs.readFileSync(samplePath, "utf8") === "line1\nbar\nline3\n",
    "edit: on-disk file changed (foo -> bar)",
  );
  const editFeedback = toolResultMessage(editCalls[0], editResult.content);
  assert(
    editFeedback.role === "tool" &&
      editFeedback.tool_call_id === editCalls[0].id,
    "edit: toolResultMessage builds feedback for the loop",
  );

  // Error cases (real executor, real files).
  const notFound = await executor.execute({
    id: "e2",
    type: "function",
    function: {
      name: "edit_file",
      arguments: '{"path":"sample.txt","old_string":"zzz","new_string":"y"}',
    },
  });
  assert(
    notFound.content.includes("old_string not found"),
    "edit: not-found error surfaced",
  );
  fs.writeFileSync(samplePath, "x x x\n", "utf8");
  const ambiguous = await executor.execute({
    id: "e3",
    type: "function",
    function: {
      name: "edit_file",
      arguments: '{"path":"sample.txt","old_string":"x","new_string":"y"}',
    },
  });
  assert(
    ambiguous.content.includes("not unique") &&
      ambiguous.content.includes("3 matches"),
    "edit: ambiguous (not unique) error surfaced",
  );
  const replaceAll = await executor.execute({
    id: "e4",
    type: "function",
    function: {
      name: "edit_file",
      arguments:
        '{"path":"sample.txt","old_string":"x","new_string":"y","replace_all":true}',
    },
  });
  assert(
    replaceAll.content.includes("Replaced 3 occurrences"),
    "edit: replace_all replaces every occurrence",
  );
  assert(
    fs.readFileSync(samplePath, "utf8") === "y y y\n",
    "edit: replace_all on-disk file changed",
  );

  // 7c) revert last edit (Phase 7.3)
  assert(executor.hasLastSnapshot, "revert: hasLastSnapshot after edit");
  const revertMsg = await executor.revertLast();
  assert(
    revertMsg.includes("Reverted sample.txt"),
    "revert: revertLast restores pre-edit content",
  );
  assert(
    fs.readFileSync(samplePath, "utf8") === "x x x\n",
    "revert: on-disk file restored to pre-edit content",
  );
  assert(!executor.hasLastSnapshot, "revert: snapshot cleared after revert");
  const noRevert = await executor.revertLast();
  assert(
    noRevert.includes("No changes to revert"),
    "revert: no snapshot -> 'No changes to revert'",
  );
  // write_file (new file) + revert (deletes the file).
  const newFilePath = path.join(editRoot, "new.txt");
  await executor.execute({
    id: "w1",
    type: "function",
    function: {
      name: "write_file",
      arguments: '{"path":"new.txt","content":"hello"}',
    },
  });
  assert(fs.existsSync(newFilePath), "revert: write_file created the file");
  const revertNew = await executor.revertLast();
  assert(
    revertNew.includes("deleted new.txt"),
    "revert: revertLast deletes newly created file",
  );
  assert(
    !fs.existsSync(newFilePath),
    "revert: newly created file deleted on revert",
  );

  // 8a) run_command (Phase 8.1): real executor runs a shell command in the
  // temp workspace and returns exit code + output.
  const echoResult = await executor.execute({
    id: "r1",
    type: "function",
    function: {
      name: "run_command",
      arguments: '{"command":"echo hello-from-test"}',
    },
  });
  assert(
    echoResult.content.includes("Exit code: 0"),
    "run_command: exit code 0 for echo",
  );
  assert(
    echoResult.content.includes("hello-from-test"),
    "run_command: stdout captured",
  );
  const failResult = await executor.execute({
    id: "r2",
    type: "function",
    function: {
      name: "run_command",
      arguments: '{"command":"exit 3"}',
    },
  });
  assert(
    failResult.content.includes("Exit code: 3"),
    "run_command: non-zero exit code captured",
  );
  const stderrResult = await executor.execute({
    id: "r3",
    type: "function",
    function: {
      name: "run_command",
      arguments: '{"command":"echo oops 1>&2"}',
    },
  });
  assert(
    stderrResult.content.includes("stderr:") &&
      stderrResult.content.includes("oops"),
    "run_command: stderr captured",
  );
  const emptyResult = await executor.execute({
    id: "r4",
    type: "function",
    function: {
      name: "run_command",
      arguments: '{"command":""}',
    },
  });
  assert(
    emptyResult.content.includes("command is empty"),
    "run_command: empty command rejected",
  );

  // 8b) get_diagnostics (Phase 8.2): real executor reads diagnostics for a
  // specific file and for all open files.
  const diagResult = await executor.execute({
    id: "d1",
    type: "function",
    function: {
      name: "get_diagnostics",
      arguments: '{"path":"diag.ts"}',
    },
  });
  assert(
    diagResult.content.includes("Diagnostics for diag.ts (1)"),
    "get_diagnostics: header with count for a file",
  );
  assert(
    diagResult.content.includes("Error 1:15"),
    "get_diagnostics: severity + 1-based position",
  );
  assert(
    diagResult.content.includes("Type 'string' is not assignable"),
    "get_diagnostics: message included",
  );
  assert(
    diagResult.content.includes("[ts]"),
    "get_diagnostics: source included",
  );
  const allDiagResult = await executor.execute({
    id: "d2",
    type: "function",
    function: {
      name: "get_diagnostics",
      arguments: "{}",
    },
  });
  assert(
    allDiagResult.content.includes("Diagnostics for open files (1)"),
    "get_diagnostics: all open files header",
  );
  const cleanDiagResult = await executor.execute({
    id: "d3",
    type: "function",
    function: {
      name: "get_diagnostics",
      arguments: '{"path":"sample.txt"}',
    },
  });
  assert(
    cleanDiagResult.content.includes("No diagnostics"),
    "get_diagnostics: clean file reports no diagnostics",
  );
  const badDiagResult = await executor.execute({
    id: "d4",
    type: "function",
    function: {
      name: "get_diagnostics",
      arguments: '{"path":"../../etc/passwd"}',
    },
  });
  assert(
    badDiagResult.content.includes("Path not allowed"),
    "get_diagnostics: path traversal rejected",
  );

  // 8c) change summary (Phase 9.3): real executor tracks per-run mutations.
  executor.clearChangeSummary();
  assert(
    executor.getChangeSummary().length === 0,
    "changes: empty after clear",
  );
  const sumPath = path.join(editRoot, "sum.txt");
  fs.writeFileSync(sumPath, "one\ntwo\nthree\n", "utf8");
  await executor.execute({
    id: "s1",
    type: "function",
    function: {
      name: "write_file",
      arguments: '{"path":"sum.txt","content":"one\\nTWO\\nthree\\nfour\\n"}',
    },
  });
  const summary = executor.getChangeSummary();
  assert(summary.length === 1, "changes: one file tracked");
  assert(summary[0].path === "sum.txt", "changes: path is workspace-relative");
  // "two" -> "TWO" (1 del + 1 ins) and "four" added (1 ins) => 2 added, 1 removed.
  assert(
    summary[0].added === 2 && summary[0].removed === 1,
    "changes: net added/removed lines correct",
  );
  // A second edit to the same file accumulates into the same entry.
  await executor.execute({
    id: "s2",
    type: "function",
    function: {
      name: "edit_file",
      arguments:
        '{"path":"sum.txt","old_string":"four","new_string":"five\\nsix"}',
    },
  });
  const summary2 = executor.getChangeSummary();
  assert(summary2.length === 1, "changes: same file not duplicated");
  // "four" -> "five\nsix" (1 del + 2 ins) => +2 added, +1 removed on top.
  assert(
    summary2[0].added === 4 && summary2[0].removed === 2,
    "changes: repeated edits accumulate",
  );

  // 8d) git_status + git_diff (Phase 10.1): real executor runs read-only git
  // commands in a temp git repo (the stubbed workspace root is editRoot).
  const { execSync } = require("child_process");
  const git = (cmd) => execSync(cmd, { cwd: editRoot, stdio: "ignore" });
  git("git init -q");
  git('git config user.email "test@test.com"');
  git('git config user.name "Test"');
  fs.writeFileSync(
    path.join(editRoot, "tracked.txt"),
    "line1\nline2\n",
    "utf8",
  );
  git("git add tracked.txt");
  git('git commit -q -m "init"');
  // Modify a tracked file and add an untracked one.
  fs.writeFileSync(
    path.join(editRoot, "tracked.txt"),
    "line1\nline2\nline3\n",
    "utf8",
  );
  fs.writeFileSync(path.join(editRoot, "untracked.txt"), "new\n", "utf8");

  const gitStatus = await executor.execute({
    id: "g1",
    type: "function",
    function: { name: "git_status", arguments: "{}" },
  });
  assert(
    gitStatus.content.includes("tracked.txt"),
    "git_status: modified tracked file listed",
  );
  assert(
    gitStatus.content.includes("untracked.txt"),
    "git_status: untracked file listed",
  );
  const gitDiff = await executor.execute({
    id: "g2",
    type: "function",
    function: { name: "git_diff", arguments: "{}" },
  });
  assert(gitDiff.content.includes("+line3"), "git_diff: shows added line");
  assert(
    gitDiff.content.includes("tracked.txt"),
    "git_diff: names the changed file",
  );
  // Scoped diff to the untracked file (not tracked) -> no diff output.
  const gitDiffScoped = await executor.execute({
    id: "g3",
    type: "function",
    function: { name: "git_diff", arguments: '{"path":"untracked.txt"}' },
  });
  assert(
    !gitDiffScoped.content.includes("+line3"),
    "git_diff: scoped diff excludes other files",
  );

  // 8e) scanForSecrets (Phase 10.2): pure secret scanner.
  assert(
    scanForSecrets("openai_key = sk-abc123def456ghi789jkl012").length > 0,
    "secrets: detects OpenAI key",
  );
  assert(
    scanForSecrets("aws_access_key_id = AKIAIOSFODNN7EXAMPLE").length > 0,
    "secrets: detects AWS access key",
  );
  assert(
    scanForSecrets(
      "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA\n-----END RSA PRIVATE KEY-----",
    ).length > 0,
    "secrets: detects private key block",
  );
  assert(
    scanForSecrets('password = "supersecretvalue123"').length > 0,
    "secrets: detects credential assignment",
  );
  assert(
    scanForSecrets("const x = 1;\nconsole.log(x);").length === 0,
    "secrets: clean text returns no matches",
  );

  // 8f) gitCommit (Phase 10.2): real executor stages + commits in the temp repo.
  // The repo currently has a modified tracked.txt and an untracked.txt.
  const commitOk = await executor.gitCommit("test: add line3");
  assert(
    commitOk.startsWith("Committed:"),
    "gitCommit: successful commit reports Committed:",
  );
  assert(
    commitOk.includes("test: add line3"),
    "gitCommit: echoes the commit message",
  );
  // Nothing left to commit now.
  const commitEmpty = await executor.gitCommit("again");
  assert(
    commitEmpty.startsWith("No changes to commit"),
    "gitCommit: reports no changes when clean",
  );
  // Stage a file containing a secret -> commit must be refused.
  fs.writeFileSync(
    path.join(editRoot, "creds.txt"),
    'api_key = "sk-abc123def456ghi789jkl012"\n',
    "utf8",
  );
  const commitSecret = await executor.gitCommit("oops: add creds");
  assert(
    commitSecret.startsWith("Refusing to commit"),
    "gitCommit: refuses to commit a secret",
  );
  // The secret file must NOT have been committed.
  const logAfter = execSync("git log --oneline -1", {
    cwd: editRoot,
    encoding: "utf8",
  });
  assert(
    !logAfter.includes("oops: add creds"),
    "gitCommit: refused commit is not recorded in history",
  );

  // Cleanup: restore Module._load and remove the temp dir.
  Module._load = originalLoad;
  fs.rmSync(editRoot, { recursive: true, force: true });

  // 6) code action: buildCodeActionPrompt + parseCodeAction (Phase 5)
  const ca = buildCodeActionPrompt({
    language: "typescript",
    path: "src/a.ts",
    code: "const x = 1;\nconsole.log(x);",
    selection: { startLine: 1, endLine: 2, text: "const x = 1;" },
    diagnostics: [
      { line: 1, column: 7, severity: "error", message: "cannot find name" },
    ],
  });
  assert(
    ca.includes("Fix or refactor the following typescript code."),
    "codeaction: prompt header with language",
  );
  assert(
    ca.includes("Return ONLY the full updated code"),
    "codeaction: prompt only-code instruction",
  );
  assert(ca.includes("File: src/a.ts"), "codeaction: prompt includes path");
  assert(ca.includes("const x = 1;"), "codeaction: prompt includes code");
  assert(
    ca.includes("Selected range (lines 1–2):"),
    "codeaction: prompt includes selection range",
  );
  assert(
    ca.includes("[error] 1:7 — cannot find name"),
    "codeaction: prompt includes diagnostic",
  );
  const caCode = ca.indexOf("Code:"),
    caSel = ca.indexOf("Selected range"),
    caDiag = ca.indexOf("Diagnostics to address");
  assert(
    caCode < caSel && caSel < caDiag,
    "codeaction: stable order (code -> selection -> diagnostics)",
  );

  const caMin = buildCodeActionPrompt({
    language: "python",
    path: "",
    code: "def f():\n    pass",
  });
  assert(caMin.includes("python"), "codeaction: prompt language (minimal)");
  assert(!caMin.includes("File:"), "codeaction: no File line when path empty");
  assert(
    !caMin.includes("Selected range"),
    "codeaction: no selection section when absent",
  );
  assert(
    !caMin.includes("Diagnostics to address"),
    "codeaction: no diagnostics section when absent",
  );

  const caSel1 = buildCodeActionPrompt({
    language: "js",
    path: "b.js",
    code: "x",
    selection: { startLine: 5, endLine: 5, text: "x" },
  });
  assert(
    caSel1.includes("Selected range (line 5):"),
    "codeaction: single-line selection range",
  );

  assert(parseCodeAction("") === "", "codeaction: parse empty -> empty");
  assert(
    parseCodeAction("   \n  ") === "",
    "codeaction: parse whitespace -> empty",
  );
  assert(
    parseCodeAction("const y = 1;") === "const y = 1;",
    "codeaction: parse plain passthrough",
  );
  assert(
    parseCodeAction("  const y = 1;  ") === "const y = 1;",
    "codeaction: parse trims whitespace",
  );
  assert(
    parseCodeAction("```typescript\nconst y = 1;\n```") === "const y = 1;",
    "codeaction: parse strips fenced code",
  );
  assert(
    parseCodeAction("```\nfoo\n```") === "foo",
    "codeaction: parse strips fence without lang",
  );
  assert(
    parseCodeAction("```\n") === "",
    "codeaction: parse fence only -> empty",
  );
  assert(
    parseCodeAction("const a = 1;\nconst b = 2;") ===
      "const a = 1;\nconst b = 2;",
    "codeaction: parse multi-line preserved",
  );

  // 7b) isMutatingTool (Phase 7.2: approval gate)
  assert(isMutatingTool("write_file"), "approval: write_file is mutating");
  assert(isMutatingTool("edit_file"), "approval: edit_file is mutating");
  assert(isMutatingTool("run_command"), "approval: run_command is mutating");
  assert(isMutatingTool("notebook_edit"), "approval: notebook_edit is mutating");
  assert(!isMutatingTool("read_file"), "approval: read_file is not mutating");
  assert(!isMutatingTool("list_dir"), "approval: list_dir is not mutating");
  assert(
    !isMutatingTool("get_diagnostics"),
    "approval: get_diagnostics is not mutating",
  );
  assert(
    !isMutatingTool("search_files"),
    "approval: search_files is not mutating",
  );
  assert(!isMutatingTool("git_status"), "approval: git_status is not mutating");
  assert(!isMutatingTool("git_diff"), "approval: git_diff is not mutating");
  assert(
    !isMutatingTool("unknown_tool"),
    "approval: unknown tool is not mutating",
  );

  // 7) diff: unifiedDiff (Phase 7.1)
  assert(unifiedDiff("", "") === "", "diff: identical -> empty");
  assert(
    unifiedDiff("a\nb\nc", "a\nb\nc") === "",
    "diff: identical multi-line -> empty",
  );
  const d1 = unifiedDiff("foo", "bar", "f.txt", "f.txt");
  assert(d1.includes("--- f.txt"), "diff: has --- header");
  assert(d1.includes("+++ f.txt"), "diff: has +++ header");
  assert(d1.includes("@@"), "diff: has hunk header");
  assert(d1.includes("-foo"), "diff: has -foo");
  assert(d1.includes("+bar"), "diff: has +bar");
  const d2 = unifiedDiff("a\nb\nc", "a\nX\nc", "f.txt", "f.txt");
  assert(d2.includes("-b"), "diff: middle change has -b");
  assert(d2.includes("+X"), "diff: middle change has +X");
  assert(d2.includes(" a"), "diff: context line a");
  assert(d2.includes(" c"), "diff: context line c");
  const d3 = unifiedDiff("", "new\nline", "f.txt", "f.txt");
  assert(d3.includes("+new"), "diff: new file has +new");
  assert(d3.includes("+line"), "diff: new file has +line");
  const d4 = unifiedDiff("old\nline", "", "f.txt", "f.txt");
  assert(d4.includes("-old"), "diff: deleted file has -old");
  assert(d4.includes("-line"), "diff: deleted file has -line");

  // 7b) diffStats (Phase 9.3): added/removed line counts
  const s0 = diffStats("a\nb\nc", "a\nb\nc");
  assert(s0.added === 0 && s0.removed === 0, "diffStats: identical -> 0/0");
  const s1 = diffStats("foo", "bar");
  assert(
    s1.added === 1 && s1.removed === 1,
    "diffStats: single-line replace -> 1/1",
  );
  const s2 = diffStats("a\nb\nc", "a\nX\nc");
  assert(s2.added === 1 && s2.removed === 1, "diffStats: middle change -> 1/1");
  const s3 = diffStats("", "new\nline");
  assert(s3.added === 2 && s3.removed === 0, "diffStats: new file -> 2/0");
  const s4 = diffStats("old\nline", "");
  assert(s4.added === 0 && s4.removed === 2, "diffStats: deleted file -> 0/2");

  // 9) command approval gate (1.98-1): static source checks that the editable
  // run_command approval feature is wired end-to-end (webview card + host gate).
  const webviewSrc = fs.readFileSync(
    path.join(__dirname, "..", "src", "chat", "webview.ts"),
    "utf8",
  );
  const hostSrc = fs.readFileSync(
    path.join(__dirname, "..", "src", "chat", "ChatViewProvider.ts"),
    "utf8",
  );
  assert(
    webviewSrc.includes("case 'command_approval':"),
    "cmd-approval: webview handles command_approval host message",
  );
  assert(
    webviewSrc.includes("type: 'commandApproval'"),
    "cmd-approval: webview posts commandApproval message type",
  );
  // 10) notebook helpers (1.98-2): pure parse/format/create in out/notebook.js
  const nbFixture = JSON.stringify({
    cells: [
      {
        cell_type: "code",
        source: "print('hi')\n",
        outputs: [
          { output_type: "stream", name: "stdout", text: "hi\n" },
          { output_type: "error", ename: "ValueError", evalue: "boom" },
        ],
      },
      {
        cell_type: "markdown",
        source: ["# Title\n", "Some text\n"],
      },
    ],
    metadata: {},
    nbformat: 4,
    nbformat_minor: 5,
  });
  const nbDoc = parseNotebook(nbFixture);
  assert(nbDoc !== null, "notebook: parseNotebook parses valid doc");
  assert(nbDoc.cells.length === 2, "notebook: parse round-trips 2 cells");
  assert(
    nbDoc.cells[0].source === "print('hi')\n",
    "notebook: string source preserved",
  );
  assert(
    nbDoc.cells[1].source === "# Title\nSome text\n",
    "notebook: string[] source joined to single string",
  );
  assert(
    nbDoc.cells[0].outputs && nbDoc.cells[0].outputs.length === 2,
    "notebook: outputs array preserved",
  );
  assert(parseNotebook("not json") === null, "notebook: bad JSON -> null");
  assert(
    parseNotebook(JSON.stringify({ metadata: {} })) === null,
    "notebook: missing cells array -> null",
  );
  const nbCtx = formatNotebookForContext(nbFixture);
  assert(
    nbCtx.includes("### Cell 0 (code)"),
    "notebook: context has Cell 0 (code) heading",
  );
  assert(
    nbCtx.includes("print('hi')"),
    "notebook: context contains source text",
  );
  assert(
    nbCtx.includes("outputs: 2 (stream, error)"),
    "notebook: context has outputs summary line",
  );
  assert(
    nbCtx.includes("outputs: none"),
    "notebook: context has outputs: none for output-less cell",
  );
  assert(
    formatNotebookForContext("not json").startsWith("Error:"),
    "notebook: context of bad JSON is an error string",
  );
  const nbCreated = createNotebook(
    "import os\n<<<CELL>>>\nprint(1)\n<<<CELL>>>\n# md cell",
  );
  const nbCreatedDoc = parseNotebook(nbCreated);
  assert(nbCreatedDoc !== null, "notebook: createNotebook output parses");
  assert(
    nbCreatedDoc.cells.length === 3,
    "notebook: createNotebook splits on <<<CELL>>> into 3 cells",
  );
  assert(
    nbCreatedDoc.cells.every((c) => c.cell_type === "code"),
    "notebook: createNotebook default cell type is code",
  );
  assert(
    nbCreatedDoc.cells[0].source === "import os\n",
    "notebook: createNotebook first cell source",
  );
  assert(
    nbCreatedDoc.cells[2].source === "# md cell",
    "notebook: createNotebook last cell source",
  );

  // 10b) applyNotebookEdit (1.98-2 S3): the 5 actions on out/notebook.js
  const nbEditFixture = JSON.stringify({
    cells: [
      {
        cell_type: "code",
        source: "print('hi')\n",
        outputs: [
          { output_type: "stream", name: "stdout", text: "hi\n" },
        ],
        execution_count: 1,
      },
      { cell_type: "markdown", source: ["# Title\n", "Some text\n"] },
    ],
    metadata: { language_info: { name: "python" } },
    nbformat: 4,
    nbformat_minor: 5,
  });

  // create
  const nbCreate = applyNotebookEdit(
    "",
    { action: "create", source: "a = 1\n<<<CELL>>>\n# md" },
  );
  assert(nbCreate.ok, "notebook-edit: create ok");
  const nbCreateDoc = parseNotebook(nbCreate.newContent);
  assert(
    nbCreateDoc && nbCreateDoc.cells.length === 2,
    "notebook-edit: create produces 2 cells",
  );
  assert(
    nbCreate.message === "Created notebook with 2 cell(s).",
    "notebook-edit: create message",
  );

  // modify_cell
  const nbModify = applyNotebookEdit(nbEditFixture, {
    action: "modify_cell",
    cellIndex: 0,
    source: "print('bye')\n",
  });
  assert(nbModify.ok, "notebook-edit: modify_cell ok");
  const nbModifyDoc = parseNotebook(nbModify.newContent);
  assert(
    nbModifyDoc &&
      nbModifyDoc.cells.length === 2 &&
      nbModifyDoc.cells[0].source === "print('bye')\n" &&
      nbModifyDoc.cells[0].cell_type === "code",
    "notebook-edit: modify_cell replaces source, keeps type/count",
  );
  assert(
    nbModify.message ===
      "Modified cell 0 (code): 13 chars of source.",
    "notebook-edit: modify_cell message",
  );
  // outputs of the modified cell are preserved (raw doc re-serialized)
  const nbModifyRaw = JSON.parse(nbModify.newContent);
  assert(
    Array.isArray(nbModifyRaw.cells[0].outputs) &&
      nbModifyRaw.cells[0].outputs.length === 1,
    "notebook-edit: modify_cell preserves outputs",
  );
  assert(
    nbModifyRaw.nbformat === 4 &&
      nbModifyRaw.metadata.language_info.name === "python",
    "notebook-edit: modify_cell preserves top-level fields",
  );

  // insert_cell (middle)
  const nbInsert = applyNotebookEdit(nbEditFixture, {
    action: "insert_cell",
    cellIndex: 1,
    cellType: "markdown",
    source: "Inserted\n",
  });
  assert(nbInsert.ok, "notebook-edit: insert_cell ok");
  const nbInsertDoc = parseNotebook(nbInsert.newContent);
  assert(
    nbInsertDoc &&
      nbInsertDoc.cells.length === 3 &&
      nbInsertDoc.cells[1].cell_type === "markdown" &&
      nbInsertDoc.cells[1].source === "Inserted\n",
    "notebook-edit: insert_cell splices at index",
  );
  assert(
    nbInsert.message ===
      "Inserted markdown cell at index 1. 3 cells total.",
    "notebook-edit: insert_cell message",
  );
  // insert_cell (append, undefined index) + code cell defaults
  const nbAppend = applyNotebookEdit(nbEditFixture, {
    action: "insert_cell",
    source: "x = 2\n",
  });
  assert(nbAppend.ok, "notebook-edit: insert_cell append ok");
  const nbAppendDoc = parseNotebook(nbAppend.newContent);
  assert(
    nbAppendDoc &&
      nbAppendDoc.cells.length === 3 &&
      nbAppendDoc.cells[2].cell_type === "code" &&
      nbAppendDoc.cells[2].source === "x = 2\n",
    "notebook-edit: insert_cell undefined index appends as code",
  );
  const nbAppendRaw = JSON.parse(nbAppend.newContent);
  assert(
    Array.isArray(nbAppendRaw.cells[2].outputs) &&
      nbAppendRaw.cells[2].outputs.length === 0 &&
      nbAppendRaw.cells[2].execution_count === null,
    "notebook-edit: inserted code cell has outputs:[] and execution_count:null",
  );

  // delete_cell
  const nbDelete = applyNotebookEdit(nbEditFixture, {
    action: "delete_cell",
    cellIndex: 1,
  });
  assert(nbDelete.ok, "notebook-edit: delete_cell ok");
  const nbDeleteDoc = parseNotebook(nbDelete.newContent);
  assert(
    nbDeleteDoc &&
      nbDeleteDoc.cells.length === 1 &&
      nbDeleteDoc.cells[0].cell_type === "code",
    "notebook-edit: delete_cell removes cell",
  );
  assert(
    nbDelete.message === "Deleted cell 1 (markdown). 1 cells remain.",
    "notebook-edit: delete_cell message",
  );

  // change_cell_type
  const nbChange = applyNotebookEdit(nbEditFixture, {
    action: "change_cell_type",
    cellIndex: 0,
    cellType: "markdown",
  });
  assert(nbChange.ok, "notebook-edit: change_cell_type ok");
  const nbChangeDoc = parseNotebook(nbChange.newContent);
  assert(
    nbChangeDoc &&
      nbChangeDoc.cells.length === 2 &&
      nbChangeDoc.cells[0].cell_type === "markdown" &&
      nbChangeDoc.cells[0].source === "print('hi')\n",
    "notebook-edit: change_cell_type switches type, keeps source",
  );
  assert(
    nbChange.message === "Changed cell 0 to markdown.",
    "notebook-edit: change_cell_type message",
  );

  // error cases
  const nbErrBadJson = applyNotebookEdit("not json", {
    action: "modify_cell",
    cellIndex: 0,
    source: "x",
  });
  assert(
    !nbErrBadJson.ok && nbErrBadJson.message.includes("Invalid notebook"),
    "notebook-edit: bad JSON -> ok:false",
  );
  const nbErrRange = applyNotebookEdit(nbEditFixture, {
    action: "modify_cell",
    cellIndex: 5,
    source: "x",
  });
  assert(
    !nbErrRange.ok && nbErrRange.message.includes("[0, 2)"),
    "notebook-edit: out-of-range cellIndex -> ok:false with range",
  );
  const nbErrNoSource = applyNotebookEdit(nbEditFixture, {
    action: "modify_cell",
    cellIndex: 0,
  });
  assert(
    !nbErrNoSource.ok && nbErrNoSource.message.includes("source"),
    "notebook-edit: modify_cell without source -> ok:false",
  );
  const nbErrUnknown = applyNotebookEdit(nbEditFixture, {
    action: "explode",
  });
  assert(
    !nbErrUnknown.ok &&
      nbErrUnknown.message === "Unknown action: explode",
    "notebook-edit: unknown action -> ok:false",
  );

  // 10c) notebook_edit through the real ToolExecutor (1.98-2 S4): the
  // executor resolves the path in the temp workspace, reads the old content,
  // applies the edit via applyNotebookEdit, writes the file, and records the
  // snapshot + change summary.
  const nbToolPath = "nb/nbtool.ipynb";
  const nbToolAbs = path.join(editRoot, "nb", "nbtool.ipynb");
  executor.clearChangeSummary();

  // create: writes a valid .ipynb into a new subdirectory.
  const nbToolCreate = await executor.execute({
    id: "nb1",
    type: "function",
    function: {
      name: "notebook_edit",
      arguments:
        '{"path":"nb/nbtool.ipynb","action":"create","source":"a = 1\\n<<<CELL>>>\\n# md"}',
    },
  });
  assert(
    nbToolCreate.content.startsWith("Wrote nb/nbtool.ipynb — Created notebook with 2 cell(s)."),
    "nb-exec: create result message",
  );
  assert(fs.existsSync(nbToolAbs), "nb-exec: create wrote the .ipynb file");
  const nbToolCreateDoc = parseNotebook(fs.readFileSync(nbToolAbs, "utf8"));
  assert(
    nbToolCreateDoc && nbToolCreateDoc.cells.length === 2,
    "nb-exec: created file parses with 2 cells",
  );
  const nbToolBefore = fs.readFileSync(nbToolAbs, "utf8");

  // modify_cell: mutates the file on disk.
  const nbToolModify = await executor.execute({
    id: "nb2",
    type: "function",
    function: {
      name: "notebook_edit",
      arguments:
        '{"path":"nb/nbtool.ipynb","action":"modify_cell","cell_index":0,"source":"a = 2\\n"}',
    },
  });
  assert(
    nbToolModify.content ===
      "Wrote nb/nbtool.ipynb — Modified cell 0 (code): 6 chars of source.",
    "nb-exec: modify_cell result message",
  );
  const nbToolModifyDoc = parseNotebook(fs.readFileSync(nbToolAbs, "utf8"));
  assert(
    nbToolModifyDoc &&
      nbToolModifyDoc.cells.length === 2 &&
      nbToolModifyDoc.cells[0].source === "a = 2\n",
    "nb-exec: modify_cell changed the file on disk",
  );

  // insert_cell: adds a markdown cell at index 1.
  const nbToolInsert = await executor.execute({
    id: "nb3",
    type: "function",
    function: {
      name: "notebook_edit",
      arguments:
        '{"path":"nb/nbtool.ipynb","action":"insert_cell","cell_index":1,"cell_type":"markdown","source":"Inserted\\n"}',
    },
  });
  assert(
    nbToolInsert.content ===
      "Wrote nb/nbtool.ipynb — Inserted markdown cell at index 1. 3 cells total.",
    "nb-exec: insert_cell result message",
  );
  const nbToolInsertDoc = parseNotebook(fs.readFileSync(nbToolAbs, "utf8"));
  assert(
    nbToolInsertDoc &&
      nbToolInsertDoc.cells.length === 3 &&
      nbToolInsertDoc.cells[1].cell_type === "markdown" &&
      nbToolInsertDoc.cells[1].source === "Inserted\n",
    "nb-exec: insert_cell spliced the file on disk",
  );

  // delete_cell: removes the inserted cell.
  const nbToolDelete = await executor.execute({
    id: "nb4",
    type: "function",
    function: {
      name: "notebook_edit",
      arguments:
        '{"path":"nb/nbtool.ipynb","action":"delete_cell","cell_index":1}',
    },
  });
  assert(
    nbToolDelete.content ===
      "Wrote nb/nbtool.ipynb — Deleted cell 1 (markdown). 2 cells remain.",
    "nb-exec: delete_cell result message",
  );
  const nbToolDeleteDoc = parseNotebook(fs.readFileSync(nbToolAbs, "utf8"));
  assert(
    nbToolDeleteDoc &&
      nbToolDeleteDoc.cells.length === 2 &&
      nbToolDeleteDoc.cells[1].cell_type === "code" &&
      nbToolDeleteDoc.cells[1].source === "# md",
    "nb-exec: delete_cell removed the cell from the file",
  );

  // change_cell_type: switches cell 0 to markdown.
  const nbToolChange = await executor.execute({
    id: "nb5",
    type: "function",
    function: {
      name: "notebook_edit",
      arguments:
        '{"path":"nb/nbtool.ipynb","action":"change_cell_type","cell_index":0,"cell_type":"markdown"}',
    },
  });
  assert(
    nbToolChange.content ===
      "Wrote nb/nbtool.ipynb — Changed cell 0 to markdown.",
    "nb-exec: change_cell_type result message",
  );
  const nbToolChangeDoc = parseNotebook(fs.readFileSync(nbToolAbs, "utf8"));
  assert(
    nbToolChangeDoc &&
      nbToolChangeDoc.cells[0].cell_type === "markdown" &&
      nbToolChangeDoc.cells[0].source === "a = 2\n",
    "nb-exec: change_cell_type switched the type on disk",
  );

  // Out-of-range cell_index: error result, file untouched, no snapshot taken.
  const nbToolBeforeRange = fs.readFileSync(nbToolAbs, "utf8");
  const nbToolRange = await executor.execute({
    id: "nb6",
    type: "function",
    function: {
      name: "notebook_edit",
      arguments:
        '{"path":"nb/nbtool.ipynb","action":"modify_cell","cell_index":99,"source":"x"}',
    },
  });
  assert(
    nbToolRange.content.includes("cellIndex out of range") &&
      nbToolRange.content.includes("[0, 2)"),
    "nb-exec: out-of-range cell_index returns the range error",
  );
  assert(
    fs.readFileSync(nbToolAbs, "utf8") === nbToolBeforeRange,
    "nb-exec: out-of-range cell_index leaves the file untouched",
  );

  // revertLast(): restores the pre-mutation content (the last successful
  // mutation was change_cell_type, so the file goes back to the post-delete
  // state: cell 0 is code again).
  const nbToolRevert = await executor.revertLast();
  assert(
    nbToolRevert.includes("Reverted nb/nbtool.ipynb"),
    "nb-exec: revertLast reports the notebook path",
  );
  const nbToolRevertDoc = parseNotebook(fs.readFileSync(nbToolAbs, "utf8"));
  assert(
    nbToolRevertDoc &&
      nbToolRevertDoc.cells.length === 2 &&
      nbToolRevertDoc.cells[0].cell_type === "code" &&
      nbToolRevertDoc.cells[0].source === "a = 2\n" &&
      nbToolRevertDoc.cells[1].cell_type === "code" &&
      nbToolRevertDoc.cells[1].source === "# md",
    "nb-exec: revertLast restored the pre-mutation content",
  );

  // getChangeSummary(): includes the .ipynb path (all 4 successful mutations
  // accumulated into one entry).
  const nbToolSummary = executor.getChangeSummary();
  assert(
    nbToolSummary.some((s) => s.path === "nb/nbtool.ipynb"),
    "nb-exec: change summary includes the .ipynb path",
  );

  assert(
    hostSrc.includes("waitForCommandApproval"),
    "cmd-approval: host has waitForCommandApproval",
  );

  console.log("\nALL SMOKE TESTS PASSED");
  server.close();
  process.exit(0);
})().catch((e) => {
  console.error("SMOKE TEST ERROR:", e);
  server.close();
  process.exit(1);
});
