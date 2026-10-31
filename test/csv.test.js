const assert = require("node:assert/strict");
const test = require("node:test");
const { Highlighter } = require("../dist/cjs/core/Highlighter");
const { Tokenizer } = require("../dist/cjs/core/Tokenizer");
const { CSV } = require("../dist/cjs/languages/CSV");

function tokensFor(code) {
  return new Tokenizer(new CSV()).tokenize(code);
}

function dataTokensFor(code) {
  return new Tokenizer(new CSV()).tokenizeLine(code, ["root"], 1).tokens;
}

test("CSV headers are limited to the first row", () => {
  const result = new Tokenizer(new CSV()).tokenizeWithState(
    '"name","amount","status"\n"Ada",1,true',
  );
  const headers = result.tokens.filter((token) => token.line === 1);
  assert.equal(
    headers.filter((token) => token.type === "csv-header").length,
    3,
    "every first-row field must be a header, including the last one",
  );
  assert.ok(headers.some((token) => token.value === '"status"'));
  assert.equal(
    result.tokens.filter((token) => token.line === 2 && token.type === "csv-header").length,
    0,
  );
  assert.deepEqual(result.finalStateStack, ["root"]);
});

test("CSV numbers are atomic and dates stay fields", () => {
  const tokens = dataTokensFor('1.5e-3,2024-01-01,"a,b",hello,-5');
  const numbers = tokens.filter((token) => token.type === "number").map((token) => token.value);
  assert.deepEqual(numbers, ["1.5e-3", "-5"]);
  const strings = tokens.filter((token) => token.type === "string").map((token) => token.value);
  assert.deepEqual(strings, ["2024-01-01", '"a,b"', "hello"]);
  assert.equal(tokens.filter((token) => token.type === "delimiter").length, 4);
});

test("CSV quoted fields support doubled quotes and commas", () => {
  const tokens = dataTokensFor('"a""b","line, two",plain');
  assert.deepEqual(
    tokens.filter((token) => token.type === "string").map((token) => token.value),
    ['"a""b"', '"line, two"', "plain"],
  );
  assert.equal(tokens.filter((token) => token.type === "csv-header").length, 0);
});

test("CSV exposes detection and supported-language registration", () => {
  assert.equal(Highlighter.detectLanguage(".csv"), "csv");
  assert.ok(Highlighter.getSupportedLanguages().includes("csv"));
});

test("CSV does not emit dead linebreak or operator token types", () => {
  const tokens = dataTokensFor("a,b\r\nc,d");
  assert.equal(tokens.filter((token) => token.type === "linebreak").length, 0);
  assert.equal(tokens.filter((token) => token.type === "operator").length, 0);
  assert.equal(tokens.filter((token) => token.type === "delimiter").length, 2);
});
