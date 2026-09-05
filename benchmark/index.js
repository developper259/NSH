const { performance } = require("node:perf_hooks");
const { Tokenizer } = require("../dist/core/Tokenizer");
const { JavaScript } = require("../dist/languages/JavaScript");
const { HTML } = require("../dist/languages/HTML");
const { XML } = require("../dist/languages/XML");
const { CSS } = require("../dist/languages/CSS");
const { PHP } = require("../dist/languages/PHP");

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
