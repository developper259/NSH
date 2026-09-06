const { IncrementalDocument } = require("../dist/cjs/core/IncrementalDocument");
const { Tokenizer } = require("../dist/cjs/core/Tokenizer");
const { JavaScript } = require("../dist/cjs/languages/JavaScript");

const source = Array.from({ length: 1000 }, (_, index) => `const value${index} = ${index};`).join("\n");
const document = new IncrementalDocument(new Tokenizer(new JavaScript()), source);
const update = document.updateLines(500, 1, ["const changed = 1;"]);

if (document.getLine(500).text !== "const changed = 1;" || update.retokenizedLines >= 100) {
  throw new Error("incremental benchmark smoke check failed");
}

console.log(`incremental-edit\tretokenizedLines=${update.retokenizedLines}`);
