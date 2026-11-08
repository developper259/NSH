const assert = require("node:assert/strict");
const test = require("node:test");
const { Tokenizer } = require("../dist/cjs/core/Tokenizer");
const { languages } = require("../dist/cjs/languages/Languages");

const SAMPLES = {
  javascript: "const re = /[a-z]+/g; const t = `v${a}`; // c\n/* b */ function f(a) { return a / 2; }",
  typescript:
    "interface A { x: string }\nclass B<T> { v: T; m(a?: number): void {} }\ntype R = Array<Map<string, B<string>>>;",
  jsx: 'const A = () => <div className="a">{value}</div>;',
  tsx: "const A = (title: string) => <div>{title}</div>;",
  python: "def f(a: int) -> str:\n    return f\"{a}\"\n# comment",
  html: '<div class="a">text</div>\n<script>const x = 1;</script>',
  css: ".a { color: #fff; width: 50%; }\n/* c */",
  json: '{"a": 1, "b": [true, null]}',
  yaml: "a: 1\nitems:\n  - one\n  - two\n# comment",
  php: "<?php echo $value; ?>\n<div>html</div>",
  java: "class A { int x = 1; List<String> values; }",
  xml: '<?xml version="1.0"?><root id="1">text</root>',
  cpp: "#include <iostream>\nint main() { return 0; }",
  c: "#include <stdio.h>\nint main(void) { return 0; }",
  csv: "a,b,c\n1,2,3",
  markdown: "# Title\n\n**bold** `code`\n\n```ts\nconst x: number = 1;\n```",
  bash: '#!/bin/bash\necho "$HOME" # c\ncat <<EOF\nhi\nEOF',
  sql: "SELECT COUNT(*) FROM users WHERE name = 'O''Brien';",
  rust: 'fn main() { let v = r#"raw"#; println!("{}", v); }',
  go: "package main\nfunc main() { value := `raw`; _ = value }",
  scss: "$c: #333;\n.a { color: $c; &:hover { color: red; } }",
};

test("first-character filter produces the same tokens as the full scan", () => {
  for (const [name, language] of Object.entries(languages)) {
    const source = SAMPLES[name];
    assert.ok(source, `missing sample for ${name}`);
    const filtered = new Tokenizer(language, { firstCharacterFilter: true }).tokenizeWithState(source);
    const unfiltered = new Tokenizer(language, { firstCharacterFilter: false }).tokenizeWithState(source);
    assert.deepEqual(filtered.tokens, unfiltered.tokens, name);
    assert.deepEqual(filtered.finalStateStack, unfiltered.finalStateStack, name);
  }
});

test("first-character filter handles tricky first atoms conservatively", () => {
  const language = {
    name: "tricky",
    extensions: [".tricky"],
    getStates: () => ({
      root: [
        { name: "alpha", pattern: /alpha/g },
        { name: "optional", pattern: /-?\d+/g },
        { name: "group", pattern: /(?:foo|bar)/g },
        { name: "class", pattern: /[b-d]+/g },
        { name: "insensitive", pattern: /[e-g]+/gi },
        { name: "negated", pattern: /[^a-z]+/g },
        { name: "unicode", pattern: /\u00e9+/gu },
        { name: "lookahead", pattern: /(?=x)x/g },
        { name: "word", pattern: /\w+/g },
      ],
    }),
  };
  const lines = [
    "alpha -12 foo cd EF 123 x",
    "bar bbb ddd éé xyz",
    "éé foo",
  ];
  for (const line of lines) {
    const filtered = new Tokenizer(language, { firstCharacterFilter: true }).tokenize(line);
    const unfiltered = new Tokenizer(language, { firstCharacterFilter: false }).tokenize(line);
    assert.deepEqual(filtered, unfiltered, line);
  }
});

test("first-character filter matches the full scan on random JavaScript/TSX/Markdown", () => {
  let seed = 0x51ed270b;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const alphabet = [
    "/", "\\", "*", "'", '"', "`", "$", "{", "}", "[", "]", "(", ")",
    "<", ">", "#", "@", ":", ";", "a", "b", "1", "2", " ", "\t", "é",
  ];
  const options = [
    new (require("../dist/cjs/languages/JavaScript").JavaScript)(),
    new (require("../dist/cjs/languages/TSX").TSX)(),
    new (require("../dist/cjs/languages/Markdown").Markdown)(),
  ].map((language) => ({
    language,
    filtered: new Tokenizer(language, { firstCharacterFilter: true }),
    unfiltered: new Tokenizer(language, { firstCharacterFilter: false }),
  }));

  for (let iteration = 0; iteration < 120; iteration += 1) {
    let line = "";
    const length = 1 + Math.floor(random() * 100);
    for (let index = 0; index < length; index += 1) {
      line += alphabet[Math.floor(random() * alphabet.length)];
    }
    for (const option of options) {
      const filtered = option.filtered.tokenize(line);
      const unfiltered = option.unfiltered.tokenize(line);
      assert.deepEqual(
        filtered,
        unfiltered,
        `${option.language.name}: ${JSON.stringify(line)}`,
      );
    }
  }
});
