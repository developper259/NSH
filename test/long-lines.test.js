const assert = require("node:assert/strict");
const test = require("node:test");
const { Tokenizer } = require("../dist/cjs/core/Tokenizer");
const { TypeScript } = require("../dist/cjs/languages/TypeScript");
const { Python } = require("../dist/cjs/languages/Python");
const { CPP } = require("../dist/cjs/languages/CPP");
const { JavaScript } = require("../dist/cjs/languages/JavaScript");
const { JSON: JSONLanguage } = require("../dist/cjs/languages/JSON");
const { HTML } = require("../dist/cjs/languages/HTML");

function assertValidCoverage(line, tokens) {
  assert.ok(tokens.length > 0, "expected tokens");
  for (const token of tokens) {
    assert.ok(token.value.length > 0, "empty token");
    assert.ok(token.column >= 1, `invalid column ${token.column}`);
    assert.ok(
      token.column - 1 + token.value.length <= line.length,
      `token "${token.value}" exceeds the line`,
    );
  }
}

test("long TypeScript type-heavy lines stay linear and valid", () => {
  const line = "const a: T; ".repeat(5000);
  const tokens = new Tokenizer(new TypeScript()).tokenize(line);
  assertValidCoverage(line, tokens);
  assert.ok(tokens.some((token) => token.type === "type-separator"));
});

test("long TypeScript generic lines stay linear and valid", () => {
  const line = "Array<Map<string, Array<number>>> ".repeat(3000);
  const tokens = new Tokenizer(new TypeScript()).tokenize(line);
  assertValidCoverage(line, tokens);
  assert.ok(tokens.some((token) => token.type === "type"));
});

test("long Python annotation lines stay linear and valid", () => {
  const line = "a: int, ".repeat(5000);
  const tokens = new Tokenizer(new Python()).tokenize(line);
  assertValidCoverage(line, tokens);
  assert.ok(tokens.some((token) => token.type === "type-hint"));
});

test("long C++ comparison lines stay linear and valid", () => {
  const line = "a < b, ".repeat(5000);
  const tokens = new Tokenizer(new CPP()).tokenize(line);
  assertValidCoverage(line, tokens);
  assert.equal(tokens.some((token) => token.type === "generic"), false);
});

test("very long single tokens and text runs remain valid", () => {
  const cases = [
    [new JavaScript(), "a".repeat(200000)],
    [new JSONLanguage(), '{"a":1,"b":[1,2,3]},'.repeat(10000)],
    [new HTML(), "text ".repeat(40000)],
  ];
  for (const [language, line] of cases) {
    assertValidCoverage(line, new Tokenizer(language).tokenize(line));
  }
});
