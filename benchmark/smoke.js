const assert = require("node:assert/strict");
const { performance } = require("node:perf_hooks");
const { Highlighter } = require("../dist/cjs/core/Highlighter");
const { IncrementalDocument } = require("../dist/cjs/core/IncrementalDocument");
const { Tokenizer } = require("../dist/cjs/core/Tokenizer");
const { CSS } = require("../dist/cjs/languages/CSS");
const { HTML } = require("../dist/cjs/languages/HTML");
const { JavaScript } = require("../dist/cjs/languages/JavaScript");

function measure(operation) {
  const start = performance.now();
  const result = operation();
  return { result, elapsed: performance.now() - start };
}

const source = Array.from(
  { length: 1000 },
  (_, index) => `const value${index} = ${index};`,
).join("\n");
const document = new IncrementalDocument(new Tokenizer(new JavaScript()), source);
const update = document.updateLines(500, 1, ["const changed = 1;"]);

assert.equal(document.getLine(500).text, "const changed = 1;");
assert.ok(update.retokenizedLines < 100, "incremental edit retokenized too many lines");

const whitespace = measure(() =>
  new Tokenizer(new JavaScript()).tokenize(" ".repeat(1000000)),
);
assert.equal(whitespace.result.length, 0, "whitespace should not emit tokens");
assert.ok(whitespace.elapsed < 1500, `whitespace tokenization took ${whitespace.elapsed}ms`);

const htmlText = measure(() =>
  new Tokenizer(new HTML()).tokenize("text ".repeat(40000)),
);
assert.ok(htmlText.result.length >= 1, "HTML text was not tokenized");
assert.ok(htmlText.elapsed < 1500, `HTML text tokenization took ${htmlText.elapsed}ms`);

const cssDocument = measure(() => {
  const lines = Array.from({ length: 5000 }, () => "{").join("\n");
  return new IncrementalDocument(new Tokenizer(new CSS()), lines);
});
assert.ok(
  cssDocument.result.getLine(4999).stateAfter.length <= 64,
  "CSS state depth exceeded the default limit",
);
assert.ok(cssDocument.elapsed < 3000, `CSS state cap took ${cssDocument.elapsed}ms`);

const highlighted = new Highlighter(new JavaScript()).highlight(source);
assert.match(highlighted.html, /nsh-keyword/, "highlight output has no keyword class");

console.log(
  `smoke ok: whitespace=${whitespace.elapsed.toFixed(1)}ms htmlText=${htmlText.elapsed.toFixed(1)}ms cssState=${cssDocument.elapsed.toFixed(1)}ms retokenized=${update.retokenizedLines}`,
);
