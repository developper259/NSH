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
