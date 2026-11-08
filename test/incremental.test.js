const assert = require("node:assert/strict");
const test = require("node:test");
const { IncrementalDocument } = require("../dist/cjs/core/IncrementalDocument");
const { Tokenizer } = require("../dist/cjs/core/Tokenizer");
const { JavaScript } = require("../dist/cjs/languages/JavaScript");

test("retokenizes multiline dependents until state convergence", () => {
  const document = new IncrementalDocument(
    new Tokenizer(new JavaScript()),
    "/*\ncomment\n*/\nconst value = 1;",
  );

  const update = document.updateLines(2, 1, ["still comment", "*/"]);
  assert.ok(update.retokenizedLines >= 2);
  assert.equal(document.getLines()[4].tokens[0].type, "keyword");
});

test("supports line insertion and deletion", () => {
  const document = new IncrementalDocument(
    new Tokenizer(new JavaScript()),
    "const a = 1;",
  );
  document.updateLines(1, 0, ["const b = 2;"]);
  assert.equal(document.getLines().length, 2);
  document.updateLines(0, 1, []);
  assert.equal(document.getLines().length, 1);
  assert.equal(document.getLines()[0].tokens[1].value, "b");
});

test("converges across inserted lines without retokenizing the suffix", () => {
  const source = Array.from({ length: 1000 }, (_, index) => `const value${index} = ${index};`).join("\n");
  const document = new IncrementalDocument(new Tokenizer(new JavaScript()), source);
  const before = document.getLine(500);
  const update = document.updateLines(100, 0, ["const inserted = 1;"]);

  assert.ok(update.retokenizedLines < 10);
  assert.equal(update.changedStartLine, 100);
  assert.equal(document.getLine(501).text, before.text);
  assert.equal(document.getLine(1000).text, "const value999 = 999;");
});

test("provides targeted line and token range reads", () => {
  const document = new IncrementalDocument(new Tokenizer(new JavaScript()), "const a = 1;\nconst b = 2;\nconst c = 3;");
  assert.equal(document.getLine(1).text, "const b = 2;");
  assert.equal(document.getLines(1, 3).length, 2);
  assert.equal(document.getTokensForLines(2, 3)[0].line, 3);
});

test("character edits at the start, middle and end match full tokenization", () => {
  const lines = Array.from({ length: 8 }, (_, index) => `const value${index} = ${index};`);
  const document = new IncrementalDocument(new Tokenizer(new JavaScript()), lines.join("\n"));

  for (const index of [0, 4, 7]) {
    lines[index] = lines[index].replace("const", "const renamed");
    document.updateLines(index, 1, [lines[index]]);
    assert.deepEqual(
      document.getTokens(),
      new Tokenizer(new JavaScript()).tokenizeWithState(lines.join("\n")).tokens,
      `line ${index}`,
    );
  }
});

test("line insertions and deletions at every boundary match full tokenization", () => {
  const lines = ["const a = 1;", "const b = 2;", "const c = 3;"];
  const document = new IncrementalDocument(new Tokenizer(new JavaScript()), lines.join("\n"));

  for (const [start, deleted, inserted] of [
    [0, 0, ["const first = 0;"]],
    [lines.length, 0, ["const last = 4;"]],
    [1, 1, []],
    [0, 1, ["const replacement = 9;"]],
  ]) {
    document.updateLines(start, deleted, inserted);
    lines.splice(start, deleted, ...inserted);
    assert.deepEqual(
      document.getTokens(),
      new Tokenizer(new JavaScript()).tokenizeWithState(lines.join("\n")).tokens,
    );
  }
});

test("converges after insertion by applying the line delta", () => {
  const document = new IncrementalDocument(
    new Tokenizer(new JavaScript()),
    "const a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;",
  );
  const beforeC = document.getLine(2);
  const update = document.updateLines(1, 0, ["const x = 99;"]);
  assert.ok(update.retokenizedLines < 4, `expected few retokenized lines, got ${update.retokenizedLines}`);
  assert.equal(document.getLine(2).text, "const b = 2;");
  assert.equal(document.getLine(3).text, beforeC.text);
  assert.equal(document.getLineCount(), 5);
  assert.ok(update.changedEndLine >= 1 && update.changedEndLine <= 3);
});

test("converges after deletion by applying the negative line delta", () => {
  const document = new IncrementalDocument(
    new Tokenizer(new JavaScript()),
    "const a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;",
  );
  const update = document.updateLines(1, 1, []);
  assert.equal(document.getLineCount(), 3);
  assert.equal(document.getLine(1).text, "const c = 3;");
  assert.equal(document.getLine(2).text, "const d = 4;");
  assert.ok(update.retokenizedLines < 4, `expected few retokenized lines, got ${update.retokenizedLines}`);
});

test("A-B-C-D insertion of X converges and remaps rest of file correctly", () => {
  const document = new IncrementalDocument(new Tokenizer(new JavaScript()), "A\nB\nC\nD");
  const update = document.updateLines(1, 0, ["X"]);
  assert.equal(document.getLine(0).text, "A");
  assert.equal(document.getLine(1).text, "X");
  assert.equal(document.getLine(2).text, "B");
  assert.equal(document.getLine(3).text, "C");
  assert.equal(document.getLine(4).text, "D");
  assert.ok(update.retokenizedLines < 4);
});

test("deleting a line in the middle does not retokenize the whole file", () => {
  const source = Array.from({ length: 10000 }, (_, index) => `const value${index} = ${index};`).join("\n");
  const document = new IncrementalDocument(new Tokenizer(new JavaScript()), source);
  const update = document.updateLines(0, 1, []);
  assert.ok(update.retokenizedLines < 10, `expected small retokenization, got ${update.retokenizedLines}`);
  assert.equal(document.getLineCount(), 9999);
  assert.equal(document.getLine(0).text, "const value1 = 1;");
  assert.equal(document.getLine(9998).text, "const value9999 = 9999;");
});

test("propagating a multiline state to EOF never duplicates existing lines", () => {
  const document = new IncrementalDocument(
    new Tokenizer(new JavaScript()),
    "/*\ncomment\n*/\nconst a = 1;\nconst b = 2;",
  );
  const update = document.updateLines(2, 1, ["still comment"]);
  assert.equal(update.retokenizedLines, 3);
  assert.equal(document.getLineCount(), 5);
  assert.equal(document.getText(), "/*\ncomment\nstill comment\nconst a = 1;\nconst b = 2;");
  assert.deepEqual(document.getLines().map((line) => line.stateAfter.at(-1)), [
    "inMultiLineComment", "inMultiLineComment", "inMultiLineComment", "inMultiLineComment", "inMultiLineComment",
  ]);
});

test("does not reuse line-index-dependent tokens after a line shift", () => {
  const { CSV } = require("../dist/cjs/languages/CSV");
  let document = new IncrementalDocument(new Tokenizer(new CSV()), "a,b\n1,2");
  document.updateLines(0, 0, ["x,y"]);
  assert.deepEqual(
    document.getLines().map((line) => line.tokens.map((token) => token.type)),
    [
      ["csv-header", "delimiter", "csv-header"],
      ["string", "delimiter", "string"],
      ["number", "delimiter", "number"],
    ],
  );

  document = new IncrementalDocument(new Tokenizer(new CSV()), "a,b\n1,2");
  document.updateLines(0, 1, []);
  assert.deepEqual(
    document.getLine(0).tokens.map((token) => token.type),
    ["csv-header", "delimiter", "csv-header"],
  );
});

test("disables suffix convergence for custom index-sensitive contexts", () => {
  const language = {
    name: "index-sensitive",
    extensions: [".index-sensitive"],
    getStates: () => ({
      root: [
        {
          name: "first-line",
          pattern: /./g,
          context: (_line, _position, _tokens, _stateStack, lineIndex) =>
            lineIndex === 0,
        },
        { name: "other-line", pattern: /./g },
      ],
    }),
  };
  const document = new IncrementalDocument(new Tokenizer(language), "a\na");
  document.updateLines(0, 0, ["a"]);
  assert.deepEqual(
    document.getLines().map((line) => line.tokens[0].type),
    ["first-line", "other-line", "other-line"],
  );
});

test("reports no retokenization for no-op and identical replacement updates", () => {
  const document = new IncrementalDocument(
    new Tokenizer(new JavaScript()),
    "const a = 1;\nconst b = 2;",
  );
  assert.equal(document.updateLines(1, 0, []).retokenizedLines, 0);
  assert.equal(document.updateLines(0, 1, ["const a = 1;"]).retokenizedLines, 0);
  assert.equal(document.getText(), "const a = 1;\nconst b = 2;");
});

test("rejects inserted lines that contain newline characters", () => {
  const document = new IncrementalDocument(new Tokenizer(new JavaScript()), "a");
  assert.throws(() => document.updateLines(0, 0, ["a\nb"]), /single-line strings/);
  assert.throws(() => document.updateLines(0, 0, "a"), /array of single-line strings/);
});

test("large edits preserve structural size and converge quickly", () => {
  const source = Array.from({ length: 10000 }, (_, index) => `const value${index} = ${index};`).join("\n");
  const document = new IncrementalDocument(new Tokenizer(new JavaScript()), source);
  for (const [start, deleted, inserted, count] of [
    [0, 0, ["const first = 0;"], 10001],
    [0, 1, [], 10000],
    [5000, 1, ["const changed = 1;"], 10000],
  ]) {
    const update = document.updateLines(start, deleted, inserted);
    assert.equal(document.getLineCount(), count);
    assert.ok(update.retokenizedLines < 10);
  }
});
