const assert = require("node:assert/strict");
const test = require("node:test");
const { IncrementalDocument } = require("../dist/core/IncrementalDocument");
const { Tokenizer } = require("../dist/core/Tokenizer");
const { JavaScript } = require("../dist/languages/JavaScript");

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
  const document = new IncrementalDocument(new Tokenizer(new JavaScript()), "const a = 1;");
  document.updateLines(1, 0, ["const b = 2;"]);
  assert.equal(document.getLines().length, 2);
  document.updateLines(0, 1, []);
  assert.equal(document.getLines().length, 1);
  assert.equal(document.getLines()[0].tokens[1].value, "b");
});
