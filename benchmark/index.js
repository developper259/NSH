const { performance } = require("node:perf_hooks");
const { Tokenizer } = require("../dist/cjs/core/Tokenizer");
const { IncrementalDocument } = require("../dist/cjs/core/IncrementalDocument");
const { Highlighter } = require("../dist/cjs/core/Highlighter");
const { JavaScript } = require("../dist/cjs/languages/JavaScript");
const { HTML } = require("../dist/cjs/languages/HTML");
const { XML } = require("../dist/cjs/languages/XML");
const { CSS } = require("../dist/cjs/languages/CSS");
const { PHP } = require("../dist/cjs/languages/PHP");

const cases = [
  ["javascript", new JavaScript(), 1000, "const value = 123.45;\n"],
  ["javascript", new JavaScript(), 10000, "const value = 123.45;\n"],
  ["html", new HTML(), 1000, '<div class="item">text content</div>\n'],
  ["html-plain-text", new HTML(), 1, "x".repeat(20000)],
  ["xml", new XML(), 1000, '<item id="1">text</item>\n'],
  ["css", new CSS(), 1000, ".item { width: 50%; color: #fff; }\n"],
  ["php", new PHP(), 1000, "<?php echo $value; ?>\n<div>html</div>\n"],
  ["whitespace", new JavaScript(), 1, " ".repeat(20000)],
];

console.log("language\tsize\titerations\ttotal time\tms/iteration\ttokens");
for (const [language, definition, repetitions, line] of cases) {
  const source = line.repeat(repetitions);
  const tokenizer = new Tokenizer(definition);
  const iterations = 3;
  let tokens = 0;
  const start = performance.now();
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    tokens = tokenizer.tokenize(source).length;
  }
  const total = performance.now() - start;
  console.log(
    `${language}\t${source.length}\t${iterations}\t${total.toFixed(2)} ms\t${(total / iterations).toFixed(2)}\t${tokens}`,
  );
}

for (const size of [10000, 50000, 100000]) {
  const source = Array.from({ length: size }, (_, index) => `const value${index} = ${index};`).join("\n");
  for (const [operation, startLine, deletedLines, insertedLines] of [
    ["edit-middle", Math.floor(size / 2), 1, ["const changed = 1;"]],
    ["insert-start", 0, 0, ["const inserted = 1;"]],
    ["delete-start", 0, 1, []],
  ]) {
    const document = new IncrementalDocument(new Tokenizer(new JavaScript()), source);
    const start = performance.now();
    const update = document.updateLines(startLine, deletedLines, insertedLines);
    console.log(`incremental-${operation}\tlines=${size}\t${(performance.now() - start).toFixed(2)} ms\tretokenizedLines=${update.retokenizedLines}`);
  }
}

const highlighter = new Highlighter(new JavaScript());
const socketLikeStart = performance.now();
for (let index = 0; index < 1000; index += 1) {
  highlighter.highlightLine("const value = 1;", ["root"], index);
}
console.log(`highlightLine-1000\t${(performance.now() - socketLikeStart).toFixed(2)} ms`);
