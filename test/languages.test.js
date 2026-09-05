const assert = require("node:assert/strict");
const test = require("node:test");
const { Highlighter } = require("../dist/core/Highlighter");
const { Parser } = require("../dist/core/Parser");
const { Tokenizer } = require("../dist/core/Tokenizer");
const { JavaScript } = require("../dist/languages/JavaScript");
const { TypeScript } = require("../dist/languages/TypeScript");
const { Python } = require("../dist/languages/Python");
const { CSS } = require("../dist/languages/CSS");
const { JSON: Json } = require("../dist/languages/JSON");
const { PHP } = require("../dist/languages/PHP");
const { XML } = require("../dist/languages/XML");

test("JavaScript prioritizes modern numbers, spread, and division", () => {
  const tokens = new Tokenizer(new JavaScript()).tokenize("123.45 ...args a / b / c const r = /abc/g;");
  assert.equal(tokens.filter((token) => token.type === "number")[0].value, "123.45");
  assert.equal(tokens.find((token) => token.type === "spread").value, "...");
  assert.equal(tokens.filter((token) => token.type === "regex").length, 1);
});

test("TypeScript avoids greedy annotations and false generics", () => {
  const tokenizer = new Tokenizer(new TypeScript());
  const annotation = tokenizer.tokenize("const x: number, y = 1;");
  assert.equal(annotation.find((token) => token.type === "type-annotation").value, ": number");
  assert.equal(tokenizer.tokenize("a < b > c").some((token) => token.type === "generic"), false);
  assert.equal(tokenizer.tokenize("foo<Bar>()").some((token) => token.type === "generic"), true);
});

test("Python exposes f-string expressions and modern numbers", () => {
  const tokens = new Tokenizer(new Python()).tokenize('f"Hello {user.name}" 1.2e-5');
  assert.equal(tokens.some((token) => token.type === "fstring-expression"), true);
  assert.equal(tokens.some((token) => token.value === "1.2e-5"), true);
});

test("CSS, JSON, and parser preserve their basic contracts", () => {
  const cssTokens = new Tokenizer(new CSS()).tokenize("width: 50%; #fff {}");
  assert.equal(cssTokens.some((token) => token.value === "50%"), true);
  const jsonTokens = new Tokenizer(new Json()).tokenize("-1.2e-3");
  assert.equal(jsonTokens[0].value, "-1.2e-3");
  assert.equal(new Parser([]).parse().totalLines, 0);
  assert.equal(new Parser([], "\n").parse().totalLines, 2);
});

test("PHP multiline comments and XML declarations retain states/classes", () => {
  const php = new Tokenizer(new PHP()).tokenizeWithState("<?php\n/*\ncomment\n*/\nclass Test {}");
  assert.ok(php.tokens.filter((token) => token.type === "comment").length >= 3);
  const xml = new Tokenizer(new XML()).tokenize("<?xml version=\"1.0\"?>");
  assert.equal(xml[0].className, "nsh-keyword");
});

test("class conversion is non-destructive and HTML uses custom classes", () => {
  const language = {
    name: "custom-test",
    extensions: [".custom-test"],
    getTokenTypes: () => [{ name: "custom", pattern: /hello/g, className: "my-custom-class" }],
    getStates: () => ({ root: [{ name: "custom", pattern: /hello/g, className: "my-custom-class" }] }),
  };
  const highlighter = new Highlighter(language, { includeClasses: true });
  const tokens = highlighter.getToken("hello");
  const converted = highlighter.replaceByClasses(tokens);
  assert.equal(tokens[0].type, "custom");
  assert.equal(converted[0].className, "my-custom-class");
  assert.match(highlighter.getHTML("hello"), /my-custom-class/);
});
