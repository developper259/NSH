const assert = require("node:assert/strict");
const test = require("node:test");
const { Tokenizer } = require("../dist/cjs/core/Tokenizer");
const { Highlighter } = require("../dist/cjs/core/Highlighter");
const { Parser } = require("../dist/cjs/core/Parser");

const { JavaScript } = require("../dist/cjs/languages/JavaScript");
const { TypeScript } = require("../dist/cjs/languages/TypeScript");
const { Python } = require("../dist/cjs/languages/Python");
const { HTML } = require("../dist/cjs/languages/HTML");
const { CSS } = require("../dist/cjs/languages/CSS");
const { JSON: JSONLang } = require("../dist/cjs/languages/JSON");
const { YAML } = require("../dist/cjs/languages/YAML");
const { PHP } = require("../dist/cjs/languages/PHP");
const { Java } = require("../dist/cjs/languages/Java");
const { XML } = require("../dist/cjs/languages/XML");
const { CPP } = require("../dist/cjs/languages/CPP");
const { C } = require("../dist/cjs/languages/C");

function tokensFor(definition, code) {
  const language =
    typeof definition === "function" ? new definition() : definition;
  return new Tokenizer(language).tokenize(code);
}

function assertHas(definition, code, predicate, message) {
  const tokens = tokensFor(definition, code);
  assert.ok(
    tokens.some(predicate),
    message || `expected token match in: ${code}`,
  );
}

test("smoke: every registered language produces tokens on a simple example", () => {
  const cases = [
    ["JavaScript", JavaScript, "const x = 1;"],
    ["TypeScript", TypeScript, "const x: number = 1;"],
    ["Python", Python, "def f():\n    return 1"],
    ["HTML", HTML, '<div class="a">hi</div>'],
    ["CSS", CSS, "body { color: red; }"],
    ["JSON", JSONLang, '{"a": 1}'],
    ["YAML", YAML, "a: 1"],
    ["PHP", PHP, "<?php echo 1; ?>"],
    ["Java", Java, "class A { int x = 1; }"],
    ["XML", XML, '<root attr="1">text</root>'],
    ["CPP", CPP, "#include <iostream>\nint main() { return 0; }"],
    ["C", C, "#include <stdio.h>\nint main() { return 0; }"],
  ];
  for (const [name, definition, code] of cases) {
    const tokens = tokensFor(definition, code);
    assert.ok(tokens.length > 0, `expected tokens for ${name}`);
  }
});

test("TypeScript decimal numbers are a single token", () => {
  const cases = [
    "123",
    "123.45",
    "1.",
    "1e10",
    "1.5e-3",
    "0xFF",
    "0b1010",
    "0o755",
    "123n",
    "1_000",
  ];
  for (const code of cases) {
    const tokens = tokensFor(TypeScript, code);
    const numbers = tokens.filter((token) => token.type === "number");
    assert.ok(numbers.length >= 1, `expected a number token for ${code}`);
    for (const num of numbers) {
      assert.equal(num.type, "number", `fragmented number in: ${code}`);
    }
  }
});

test("TypeScript optional chaining and nullish operators are not fragmented", () => {
  const cases = [
    "foo?.bar",
    "foo?.()",
    "foo?.[index]",
    "foo ?? bar",
    "foo ??= bar",
    "value!",
  ];
  for (const code of cases) {
    const tokens = tokensFor(TypeScript, code);
    const joined = tokens.map((token) => token.value).join("");
    assert.equal(joined.replace(/\s/g, ""), code.replace(/\s/g, ""));
  }
  assertHas(
    TypeScript,
    "a ?? b",
    (token) => token.value === "??",
    "?? not tokenized",
  );
  assertHas(
    TypeScript,
    "a ??= b",
    (token) => token.value === "??=",
    "??= not tokenized",
  );
  assertHas(
    TypeScript,
    "a?.b",
    (token) => token.value === "?.",
    "?. not tokenized",
  );
});

test("TypeScript generics vs comparison", () => {
  const typed = tokensFor(TypeScript, "const x: List<string> = [];");
  assert.ok(
    typed.some((token) => token.type === "type" && token.value === "List"),
  );
  assert.ok(
    typed.some(
      (token) => token.type === "type-separator" && token.value === "<",
    ),
  );
  const tokens = tokensFor(TypeScript, "const r = a < b && c > d;");
  assert.ok(
    !tokens.some((token) => token.type === "generic"),
    "comparison wrongly marked as generic",
  );
  assert.ok(
    tokens.some((token) => token.type === "operator" && token.value === "<"),
  );
  assert.ok(
    tokens.some((token) => token.type === "operator" && token.value === ">"),
  );
});

test("TypeScript tokenizes nested type syntax structurally", () => {
  const tokens = tokensFor(
    TypeScript,
    "const CLASS_MAP: Readonly<Record<string, string>> = {",
  );
  const token = (value) => tokens.find((item) => item.value === value);
  assert.equal(token("Readonly").type, "type");
  assert.equal(token("Record").type, "type");
  assert.equal(tokens.filter((item) => item.value === "string").length, 2);
  assert.ok(
    tokens
      .filter((item) => ["<", ">", ","].includes(item.value))
      .every((item) => item.type === "type-separator"),
  );
  assert.equal(
    tokens.some(
      (item) => item.type === "generic" && item.value.includes("<Record"),
    ),
    false,
  );
  assert.equal(token("=").type, "operator");
  assert.equal(token("{").type, "bracket");
});

test("TypeScript keeps type context scoped and avoids object values", () => {
  const tokenizer = new Tokenizer(new TypeScript());
  const sources = [
    "const map: Map<string, Array<User>> = new Map();",
    "const value: Promise<Result<Map<string, User[]>>> = foo();",
    "let x: string | number;",
    "let x: Foo & Bar;",
    "let x: User[];",
    "let x: Array<User>;",
    "function f(a: string, b: number): Promise<User> { return foo(); }",
    "interface User { name: string; age?: number; metadata: Record<string, unknown>; }",
    "type Result<T> = { value: T; };",
    "type Maybe<T> = T | null;",
    "type Fn = (value: string) => number;",
    "type Nested = Readonly<Record<string, Promise<Array<User>>>>;",
    "function foo<T>(value: T): T {}",
    "function foo<T extends User, U = string>(value: T): U {}",
    "class Box<T> {}",
    "interface Api<TResponse> {}",
  ];
  for (const source of sources) {
    const result = tokenizer.tokenize(source);
    assert.equal(
      result.some((item) => item.type === "generic"),
      false,
      source,
    );
    assert.ok(
      result.some((item) => item.type === "type"),
      source,
    );
  }
  const objectTokens = tokenizer.tokenize(
    "const obj = { name: value, age: count };",
  );
  assert.equal(
    objectTokens.some((item) => item.type === "type-separator"),
    false,
  );
  for (const source of [
    "a < b > c",
    "if (a < b && c > d) {}",
    "const result = x < y ? a : b;",
    "a<B>c",
  ]) {
    assert.equal(
      tokenizer.tokenize(source).some((item) => item.type === "type-separator"),
      false,
      source,
    );
  }
});

test("Python f-strings do not break on inner quotes", () => {
  const cases = [
    'f"hello {name}"',
    "f'hello {name}'",
    'f"it\'s {name}"',
    "f'He said \"hello\" {name}'",
    'f"{value:.2f}"',
    'f"{a + b}"',
    'f"{{literal}} {value}"',
  ];
  for (const code of cases) {
    const tokens = tokensFor(Python, code);
    assert.ok(
      tokens.some((token) =>
        ["string", "fstring-expression"].includes(token.type),
      ),
      `f-string not tokenized: ${code}`,
    );
  }
});

test("Python type hints do not absorb the next parameter", () => {
  const code = "def f(a: int, b: str):\n    pass";
  const tokens = tokensFor(Python, code);
  assert.ok(
    tokens.some((token) => token.value === ","),
    "type hint swallowed the comma",
  );
  assert.ok(
    tokens.some((token) => token.value === "b"),
    "second parameter not tokenized",
  );
});

test("Python triple strings are plain strings for the beta", () => {
  const tokens = tokensFor(Python, '"""doc"""');
  assert.ok(
    tokens.some((token) => token.type === "string"),
    "triple string not string",
  );
  assert.ok(
    !tokens.some((token) => token.type === "docstring"),
    "no docstring type for beta",
  );
});
test("JavaScript prioritizes modern numbers, spread, and division", () => {
  const tokens = new Tokenizer(new JavaScript()).tokenize(
    "123.45 ...args a / b / c const r = /abc/g;",
  );
  assert.equal(
    tokens.filter((token) => token.type === "number")[0].value,
    "123.45",
  );
  assert.equal(tokens.find((token) => token.type === "spread").value, "...");
  assert.equal(tokens.filter((token) => token.type === "regex").length, 1);
});

test("TypeScript avoids greedy annotations and false generics", () => {
  const tokenizer = new Tokenizer(new TypeScript());
  const annotation = tokenizer.tokenize("const x: number, y = 1;");
  assert.ok(
    annotation.some(
      (token) => token.type === "type" && token.value === "number",
    ),
  );
  assert.ok(
    annotation.some(
      (token) => token.type === "type-separator" && token.value === ":",
    ),
  );
  assert.equal(
    tokenizer.tokenize("a < b > c").some((token) => token.type === "generic"),
    false,
  );
  assert.equal(
    tokenizer
      .tokenize("foo<Bar>()")
      .some((token) => token.type === "type-separator"),
    false,
  );
});

test("TypeScript distinguishes object values, annotations, comparisons, and non-null", () => {
  const tokenizer = new Tokenizer(new TypeScript());
  const objectTokens = tokenizer.tokenize(
    "const user = { name: value, age: count };",
  );
  assert.equal(
    objectTokens.some((token) => token.type === "type-separator"),
    false,
  );
  const annotations = tokenizer.tokenize(
    "const name: string = 'x'; let list: Array<string>; interface User { age?: number; }",
  );
  assert.ok(annotations.filter((token) => token.type === "type").length >= 3);
  assert.equal(
    tokenizer.tokenize("a < b > c").some((token) => token.type === "generic"),
    false,
  );
  assert.ok(
    tokenizer
      .tokenize("Array<string>")
      .some((token) => token.type === "type-separator"),
  );
  for (const value of ["!=", "!=="]) {
    const tokens = tokenizer.tokenize(`a ${value} b`);
    assert.ok(
      tokens.some(
        (token) => token.type === "operator" && token.value === value,
      ),
    );
    assert.equal(
      tokens.some((token) => token.type === "non-null"),
      false,
    );
  }
});

test("Python exposes f-string expressions and modern numbers", () => {
  const tokens = new Tokenizer(new Python()).tokenize(
    'f"Hello {user.name}" 1.2e-5',
  );
  assert.equal(
    tokens.some((token) => token.type === "fstring-expression"),
    true,
  );
  assert.equal(
    tokens.some((token) => token.value === "1.2e-5"),
    true,
  );
});

test("Python f-string prefixes and escaped quotes retain the f-string state", () => {
  const tokenizer = new Tokenizer(new Python());
  for (const source of [
    'f"hello \\"world\\" {name}"',
    "f'hello \\\'world\\\' {name}'",
    'F"{value}"',
    'fr"{path}"',
    'rf"{path}"',
  ]) {
    const result = tokenizer.tokenizeWithState(source);
    assert.deepEqual(result.finalStateStack, ["root"], source);
    assert.ok(
      result.tokens.some((token) => token.type === "fstring-expression"),
      source,
    );
  }
});

test("CSS, JSON, and parser preserve their basic contracts", () => {
  const cssTokens = new Tokenizer(new CSS()).tokenize(
    "body { width: 50%; color: #fff; }",
  );
  assert.equal(
    cssTokens.some((token) => token.value === "50%"),
    true,
  );
  const jsonTokens = new Tokenizer(new JSONLang()).tokenize("-1.2e-3");
  assert.equal(jsonTokens[0].value, "-1.2e-3");
  assert.equal(new Parser([]).parse().totalLines, 0);
  assert.equal(new Parser([], "\n").parse().totalLines, 2);
});

test("PHP multiline comments and XML declarations retain states/classes", () => {
  const php = new Tokenizer(new PHP()).tokenizeWithState(
    "<?php\n/*\ncomment\n*/\nclass Test {}",
  );
  assert.ok(php.tokens.filter((token) => token.type === "comment").length >= 3);
  const xml = new Tokenizer(new XML()).tokenize('<?xml version="1.0"?>');
  assert.equal(xml[0].className, "nsh-keyword");
});

test("class conversion is non-destructive and HTML uses custom classes", () => {
  const language = {
    name: "custom-test",
    extensions: [".custom-test"],
    getTokenTypes: () => [
      { name: "custom", pattern: /hello/g, className: "my-custom-class" },
    ],
    getStates: () => ({
      root: [
        { name: "custom", pattern: /hello/g, className: "my-custom-class" },
      ],
    }),
  };
  const highlighter = new Highlighter(language, { includeClasses: true });
  const tokens = highlighter.getToken("hello");
  const converted = highlighter.replaceByClasses(tokens);
  assert.equal(tokens[0].type, "custom");
  assert.equal(converted[0].className, "my-custom-class");
  assert.match(highlighter.getHTML("hello"), /my-custom-class/);
});

test("HTML exits all embedded states and JSON script state", () => {
  for (const [source, end] of [
    ["<script>\n/* comment\n</script>\n<div>Hello</div>", "script-end"],
    ["<script>\n`template\n</script>\n<div>Hello</div>", "script-end"],
    ["<style>\n/* comment\n</style>\n<div>Hello</div>", "style-end"],
    [
      '<script type="application/json">\n{"hello": true}\n</script>\n<div>AFTER</div>',
      "script-end",
    ],
  ]) {
    const result = new Tokenizer(new HTML()).tokenizeWithState(source);
    assert.ok(result.tokens.some((token) => token.type === end));
    assert.deepEqual(result.finalStateStack, ["root"]);
    assert.ok(
      result.tokens.some(
        (token) => token.type === "tag-open" && token.value === "<div",
      ),
    );
  }
});

test("PHP interpolation restores the exact HTML, JavaScript, and CSS parent state", () => {
  const tokenizer = new Tokenizer(new PHP());
  const cases = [
    ['<div title="Hello <?= $name ?> world">', ["root"]],
    ["<div class=\"<?= $active ? 'active' : '' ?>\">Hello</div>", ["root"]],
    [
      "<script>\nconst value = <?= $value ?>;\nconsole.log(value);\n</script>",
      ["root"],
    ],
    ["<style>\n.foo {\n color: <?= $color ?>;\n}\n</style>", ["root"]],
  ];
  for (const [source, expected] of cases) {
    const result = tokenizer.tokenizeWithState(source);
    assert.deepEqual(result.finalStateStack, expected, source);
    assert.ok(
      result.tokens.some((token) => token.type === "php-close"),
      source,
    );
  }
  const attribute = tokenizer.tokenizeLine(
    "<?= $name ?>",
    ["root", "inTag", "inDoubleQuote", "php_root"],
    0,
  );
  assert.deepEqual(attribute.finalStateStack, [
    "root",
    "inTag",
    "inDoubleQuote",
  ]);
  const script = tokenizer.tokenizeLine(
    "<?= $value ?>;",
    ["root", "js_root"],
    0,
  );
  assert.deepEqual(script.finalStateStack, ["root", "js_root"]);
});

test("theme and custom token classes cannot inject HTML attributes", () => {
  const language = {
    name: "unsafe",
    extensions: [".unsafe"],
    getTokenTypes: () => [
      { name: "x", pattern: /x/g, className: 'safe bad\" onclick=\"x' },
    ],
  };
  const highlighter = new Highlighter(language, {
    theme: 'dark\" onclick=\"x',
  });
  const html = highlighter.getHTML("x");
  assert.match(html, /nsh-theme-dark/);
  assert.doesNotMatch(html, /onclick/);
});
test("PHP decimal and scientific numbers are single tokens", () => {
  for (const code of [
    "<?php $value = 123.45; ?>",
    "<?php $value = 1e10; ?>",
    "<?php $value = 0xFF; ?>",
  ]) {
    const tokens = tokensFor(PHP, code);
    const numbers = tokens.filter((token) => token.type === "number");
    assert.ok(numbers.length >= 1, `expected number in ${code}`);
  }
});

test("PHP 8 attributes are not comments", () => {
  const tokens = tokensFor(PHP, "<?php\n#[Route('/test')]\nclass Test {}");
  assert.ok(
    tokens.some(
      (token) => token.type === "php-attribute" || token.value.startsWith("#["),
    ),
    "PHP attribute not detected",
  );
  assert.ok(
    !tokens.some(
      (token) => token.type === "comment" && token.value.startsWith("#["),
    ),
    "PHP attribute wrongly a comment",
  );
});

test("PHP hash comment still works", () => {
  const tokens = tokensFor(PHP, "<?php\n# normal comment");
  assert.ok(
    tokens.some(
      (token) => token.type === "comment" && token.value.startsWith("#"),
    ),
    "hash comment missed",
  );
});

test("Java generics are detected but comparisons are not", () => {
  assertHas(
    Java,
    "List<String> items;",
    (token) => token.type === "generic",
    "List<String> not generic",
  );
  assertHas(
    Java,
    "Map<String, List<Integer>> map;",
    (token) => token.type === "generic",
    "nested generic missed",
  );
  const tokens = tokensFor(Java, "a < b > c");
  assert.ok(
    !tokens.some((token) => token.type === "generic"),
    "a < b > c wrongly generic",
  );
});

test("Java text blocks are strings", () => {
  const tokens = tokensFor(Java, 'String s = """\nhello\n""";');
  assert.ok(
    tokens.some((token) => token.type === "string"),
    "text block not a string",
  );
});

test("YAML decimals are not fragmented", () => {
  const tokens = tokensFor(YAML, "version: 1.2\nprice: 12.50");
  const numbers = tokens.filter((token) => token.type === "number");
  assert.ok(numbers.length >= 1, "expected yaml number");
});

test("YAML anchors and aliases", () => {
  assertHas(
    YAML,
    "defaults: &def\n  x: 1",
    (token) => token.type === "yaml-anchor" || token.value === "&def",
    "anchor missed",
  );
  assertHas(
    YAML,
    "item: *def",
    (token) => token.type === "yaml-alias" || token.value === "*def",
    "alias missed",
  );
});

test("CSS selector #fff vs declaration color #fff", () => {
  const code = "#fff {\n  color: #fff;\n}";
  const tokens = tokensFor(CSS, code);
  const selectorTokens = tokens.filter((token) => token.type === "selector-id");
  const hexTokens = tokens.filter((token) => token.type === "hex-color");
  assert.ok(
    selectorTokens.some((token) => token.value === "#fff"),
    "selector #fff not selector-id",
  );
  assert.ok(
    hexTokens.some((token) => token.value === "#fff"),
    "declaration #fff not hex-color",
  );
});

test("CSS !important and variables", () => {
  assertHas(
    CSS,
    "body { color: red !important; }",
    (token) => token.type === "important" || token.value === "!important",
    "!important missed",
  );
  const tokens = tokensFor(CSS, "body { --color: red; color: var(--color); }");
  assert.ok(
    tokens.some((token) => token.value === "--color"),
    "CSS variable missed",
  );
});

test("CSS nested blocks retain declaration state until the matching brace", () => {
  for (const source of [
    "@media (min-width: 700px) {\n  .foo { color: red; }\n}",
    "@supports (display: grid) {\n  .foo { display: grid; }\n}",
    "@keyframes fade { from { opacity: 0; } to { opacity: 1; } }",
  ]) {
    const result = new Tokenizer(new CSS()).tokenizeWithState(source);
    assert.deepEqual(result.finalStateStack, ["root"], source);
    assert.ok(
      result.tokens.filter((token) => token.type === "property").length > 0,
      source,
    );
  }
});

test("JSON numbers: decimal, negative, exponent", () => {
  const tokens = tokensFor(JSONLang, '{"a": 12.5, "b": -3, "c": 1e-9}');
  const numbers = tokens.filter((token) => token.type === "number");
  assert.equal(numbers.length, 3, "expected three JSON numbers");
});

test("HTML application/json script content is treated as text, not JS", () => {
  const code = '<script type="application/json">{"key": "value"}</script>';
  const tokens = tokensFor(HTML, code);
  assert.ok(
    !tokens.some(
      (token) =>
        ["keyword", "variable"].includes(token.type) && token.value === "key",
    ),
    "JSON script content coloured as JS",
  );
  assert.ok(
    tokens.some(
      (token) => token.type === "json-text" || token.type === "string",
    ),
    "script content not detected",
  );
});

test("HTML embedded exit rule works inside nested JS states", () => {
  const code = "<script>\n/* comment\n</script>\nconst after = 1;\n";
  const tokens = tokensFor(HTML, code);
  assert.ok(
    tokens.some((token) => token.type === "script-end"),
    "script-end not found inside comment",
  );
});

test("XML declaration, comment, CDATA", () => {
  assertHas(
    XML,
    '<?xml version="1.0"?>',
    (token) => token.type === "xml-decl",
    "xml decl missed",
  );
  assertHas(
    XML,
    "<!-- a comment -->",
    (token) => token.type === "comment",
    "xml comment missed",
  );
  assertHas(
    XML,
    "<![CDATA[raw text]]>",
    (token) => token.type === "cdata",
    "cdata missed",
  );
});

test("JavaScript template strings and comments", () => {
  const tokens = tokensFor(
    JavaScript,
    "const t = `hello ${name}`; // trailing\n/* block */",
  );
  assert.ok(
    tokens.some((token) => token.type === "string" && token.value === "`"),
    "template not handled",
  );
  assert.ok(
    tokens.some((token) => token.type === "comment"),
    "comment missed",
  );
});

test("JavaScript template expressions tolerate nested object braces", () => {
  const tokenizer = new Tokenizer(new JavaScript());
  for (const source of ["`${{ a: 1 }.a}`", "`${foo({ a: 1 })}`"]) {
    const result = tokenizer.tokenizeWithState(source);
    assert.deepEqual(result.finalStateStack, ["root"], source);
    assert.ok(
      result.tokens.some(
        (token) => token.type === "template-expression" && token.value === "}",
      ),
      source,
    );
  }
});

test("HTML plain text, attributes, script, style", () => {
  const code =
    '<div data-x="1">text</div><style>body{color:red}</style><script>const a=1;</script>';
  const tokens = tokensFor(HTML, code);
  assert.ok(
    tokens.some((token) => token.type === "attribute"),
    "attribute missed",
  );
  assert.ok(
    tokens.some(
      (token) => token.type === "script-start" || token.type === "script-end",
    ),
    "script missed",
  );
  assert.ok(
    tokens.some(
      (token) => token.type === "style-start" || token.type === "style-end",
    ),
    "style missed",
  );
});
