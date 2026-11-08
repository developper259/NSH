const assert = require("node:assert/strict");
const test = require("node:test");
const { Tokenizer } = require("../dist/cjs/core/Tokenizer");
const { Bash } = require("../dist/cjs/languages/Bash");
const { SQL } = require("../dist/cjs/languages/SQL");
const { Rust } = require("../dist/cjs/languages/Rust");
const { Go } = require("../dist/cjs/languages/Go");
const { SCSS } = require("../dist/cjs/languages/SCSS");
const { Sass } = require("../dist/cjs/languages/Sass");

function tokenize(language, code) {
  const tokenizer = new Tokenizer(language);
  const result = tokenizer.tokenizeWithState(code);
  assert.deepEqual(result.finalStateStack, ["root"], "did not return to root");
  return result.tokens;
}

function find(tokens, value, type) {
  const token = tokens.find((item) => item.value === value);
  assert.ok(token, `missing token ${value}`);
  if (type) assert.equal(token.type, type);
  return token;
}

test("Bash handles arithmetic, parameter defaults and process substitution", () => {
  const code = [
    "value=$((1 + 2))",
    "path=${HOME:-/tmp}",
    "diff <(sort a) <(sort b)",
    "setopt extended_glob",
    "echo $value",
  ].join("\n");
  const tokens = tokenize(new Bash(), code);

  find(tokens, "$((1 + 2))", "variable");
  find(tokens, "${HOME:-/tmp}", "variable");
  find(tokens, "<(", "operator");
  find(tokens, "setopt", "builtin");
});

test("Bash handles variables, interpolation, comments and heredocs", () => {
  const code = [
    "#!/bin/bash",
    'name="world"',
    'if [ -n "$name" ]; then',
    '  echo "hello $name" # greeting',
    "fi",
    "cat <<EOF",
    "hello",
    "EOF",
  ].join("\n");
  const tokens = tokenize(new Bash(), code);

  find(tokens, "#!/bin/bash", "comment");
  find(tokens, "if", "keyword");
  find(tokens, "echo", "builtin");
  find(tokens, "$name", "variable");
  find(tokens, "# greeting", "comment");
  find(tokens, "EOF", "string");
});

test("SQL supports dollar strings, dialect keywords and hash comments", () => {
  const code = [
    "# dialect note",
    "SELECT $tag$line",
    "still$tag$::text, name ILIKE 'a%'",
    "FROM users",
    "ON CONFLICT DO NOTHING",
    "RETURNING id;",
  ].join("\n");
  const result = new Tokenizer(new SQL()).tokenizeWithState(code);
  assert.deepEqual(result.finalStateStack, ["root"]);
  assert.ok(result.tokens.some((token) => token.type === "string" && token.value === "$tag$"));
  assert.ok(result.tokens.some((token) => token.value === "ILIKE" && token.type === "keyword"));
  assert.ok(result.tokens.some((token) => token.value === "CONFLICT" && token.type === "keyword"));
  assert.ok(result.tokens.some((token) => token.value === "NOTHING" && token.type === "keyword"));
  assert.ok(result.tokens.some((token) => token.value === "# dialect note" && token.type === "comment"));
});

test("SQL is case-insensitive and keeps strings/comments/parameters coherent", () => {
  const code = [
    "SELECT id, COUNT(*) AS total",
    "FROM users",
    "WHERE name = 'O''Brien' -- note",
    "  AND active = true",
    "/* block",
    "comment */",
    "  AND id = :id",
    "LIMIT 10;",
  ].join("\n");
  const tokens = tokenize(new SQL(), code);

  find(tokens, "SELECT", "keyword");
  find(tokens, "FROM", "keyword");
  find(tokens, "COUNT", "function");
  find(tokens, "'O''Brien'", "string");
  find(tokens, "-- note", "comment");
  find(tokens, ":id", "parameter");
  find(tokens, "10", "number");
  assert.ok(tokens.filter((token) => token.type === "comment").length >= 3);
});

test("Rust handles attributes, lifetimes, chars and raw strings", () => {
  const code = [
    "#[derive(Debug)]",
    "fn main<'a>(x: &'a str) -> Result<(), Error> {",
    '  let raw = r#"raw "value"#;',
    "  let ch = 'x';",
    '  println!("{}", raw);',
    "  Ok(())",
    "}",
  ].join("\n");
  const tokens = tokenize(new Rust(), code);

  find(tokens, "#[derive(Debug)]", "attribute");
  find(tokens, "fn", "keyword");
  find(tokens, "str", "type");
  find(tokens, "'a", "lifetime");
  find(tokens, "'x'", "string");
  find(tokens, 'r#"', "string");
  find(tokens, '"#', "string");
  find(tokens, "println", "builtin");
});

test("Rust block comments nest", () => {
  const code = [
    "/* outer",
    "   /* inner */",
    "   still outer",
    "*/",
    "fn main() {}",
  ].join("\n");
  const result = new Tokenizer(new Rust()).tokenizeWithState(code);
  assert.deepEqual(result.finalStateStack, ["root"]);
  assert.ok(result.tokens.filter((token) => token.type === "comment").length >= 4);
  assert.ok(result.tokens.some((token) => token.line === 5 && token.value === "fn"));
});

test("Rust raw strings stay inside their delimiter across lines", () => {
  const code = ['let value = r##"line', '"# still content', 'end"##;', "let done = 1;"].join("\n");
  const result = new Tokenizer(new Rust()).tokenizeWithState(code);
  assert.deepEqual(result.finalStateStack, ["root"]);
  assert.ok(result.tokens.some((token) => token.type === "string" && token.value.includes("still content")));
  assert.ok(result.tokens.some((token) => token.line === 4 && token.value === "done"));
});

test("Go handles raw strings, runes, comments and types", () => {
  const code = [
    "package main",
    'import "fmt"',
    "// comment",
    "func main() {",
    "  value := `raw",
    "string`",
    "  rune := 'a'",
    "  var count int = 1",
    "  fmt.Println(value, rune, count)",
    "}",
  ].join("\n");
  const tokens = tokenize(new Go(), code);

  find(tokens, "package", "keyword");
  find(tokens, "func", "keyword");
  find(tokens, "int", "type");
  assert.ok(tokens.some((token) => token.value === "fmt" && token.type === "builtin"));
  find(tokens, "'a'", "string");
  find(tokens, "// comment", "comment");
  assert.ok(tokens.filter((token) => token.type === "string").length >= 4);
});

test("SCSS handles placeholders, maps, flags and advanced directives", () => {
  const code = [
    '%button { color: red; }',
    '@use "theme" with ($primary: #333);',
    '$map: (key: value, other: 2);',
    ".card {",
    "  @extend %button;",
    "  @if $condition { margin: 0 !default; }",
    "  args: $values...;",
    "  &:focus-visible { color: $primary; }",
    "}",
  ].join("\n");
  const tokens = tokenize(new SCSS(), code);

  find(tokens, "%button", "selector-placeholder");
  find(tokens, "@use", "scss-at-rule");
  find(tokens, "$map", "scss-variable");
  find(tokens, "@extend", "scss-at-rule");
  find(tokens, "!default", "important");
  find(tokens, "...", "spread");
  find(tokens, ":focus-visible", "pseudo-class");
});

test("SCSS handles variables, at-rules, interpolation and nested selectors", () => {
  const code = [
    "// variables",
    "$primary: #333;",
    "@mixin box($size: 10px) {",
    "  width: $size;",
    "  .child { color: lighten($primary, 10%); }",
    "}",
    ".card {",
    "  @include box(20px);",
    "  &:hover { color: red; }",
    "  content: #{$primary};",
    "}",
  ].join("\n");
  const tokens = tokenize(new SCSS(), code);

  find(tokens, "$primary", "scss-variable");
  find(tokens, "@mixin", "scss-at-rule");
  find(tokens, "@include", "scss-at-rule");
  find(tokens, "// variables", "comment");
  find(tokens, ".child", "selector-class");
  find(tokens, "&", "scss-parent");
  find(tokens, "width", "property");
  assert.ok(tokens.some((token) => token.type === "scss-interpolation"));
});

test("indented Sass handles variables, directives, properties and selectors", () => {
  const code = [
    "$primary: #333",
    "@mixin box($size: 10px)",
    "  width: $size",
    "  .child",
    "    color: lighten($primary, 10%)",
    "",
    ".card",
    "  @include box(20px)",
    "  &:hover",
    "    color: $primary",
    "  content: #{$primary}",
  ].join("\n");
  const tokens = new Tokenizer(new Sass()).tokenize(code);

  find(tokens, "$primary", "variable");
  find(tokens, "@mixin", "at-rule");
  find(tokens, "@include", "at-rule");
  find(tokens, "width", "property");
  find(tokens, "color", "property");
  find(tokens, ".child", "selector-class");
  find(tokens, "&", "parent");
  find(tokens, ":hover", "pseudo-class");
  assert.ok(tokens.some((token) => token.type === "interpolation"));
  assert.ok(tokens.some((token) => token.type === "number" && token.value === "20px"));
});

test("Sass tracks indentation blocks", () => {
  const tokenizer = new Tokenizer(new Sass());
  const lines = ["a", "  color: red", "  b", "    width: 1px", "c"];
  let state = ["root"];
  const states = [];
  for (let index = 0; index < lines.length; index += 1) {
    state = tokenizer.tokenizeLine(lines[index], state, index).finalStateStack;
    states.push(state);
  }
  assert.deepEqual(states[0], ["root"]);
  assert.ok(states[1].some((name) => name.startsWith("sassBlock:2")));
  assert.ok(states[3].some((name) => name.startsWith("sassBlock:4")));
  assert.deepEqual(states[4], ["root"]);
});

test("new language extensions are detected", () => {
  const { Highlighter } = require("../dist/cjs/core/Highlighter");
  const cases = [
    [".sh", "bash"],
    [".zsh", "bash"],
    [".sql", "sql"],
    [".rs", "rust"],
    [".go", "go"],
    [".scss", "scss"],
    [".sass", "sass"],
  ];
  for (const [extension, language] of cases) {
    assert.equal(Highlighter.detectLanguage(extension), language);
  }
  const { defaultRegistry } = require("../dist/cjs/languages/Languages");
  assert.equal(defaultRegistry.getLanguage("shell").name, "bash");
  assert.equal(defaultRegistry.getLanguage("zsh").name, "bash");
});
