const assert = require("node:assert/strict");
const test = require("node:test");
const { Tokenizer } = require("../dist/cjs/core/Tokenizer");

function languageFrom(states) {
  return {
    name: "test",
    extensions: [".test"],
    getTokenTypes: () => states.root,
    getStates: states,
  };
}

test("matches rules only at the current position", () => {
  const tokenizer = new Tokenizer(
    languageFrom({
      root: [{ name: "word", pattern: /b/g, className: "custom-word" }],
    }),
  );

  const result = tokenizer.tokenizeLine("a", ["root"], 0);
  assert.deepEqual(result.tokens, []);
});

test("caches language states until the language changes", () => {
  let stateCalls = 0;
  const language = {
    name: "counted",
    extensions: [".counted"],
    getTokenTypes: () => [],
    getStates: () => {
      stateCalls += 1;
      return { root: [{ name: "word", pattern: /[a-z]+/g }] };
    },
  };
  const tokenizer = new Tokenizer(language);

  tokenizer.tokenizeWithState("one\ntwo");
  assert.equal(stateCalls, 1);

  tokenizer.setLanguage(language);
  tokenizer.tokenizeLine("three", ["root"], 0);
  assert.equal(stateCalls, 2);
});

test("preserves the rule class name on tokens", () => {
  const tokenizer = new Tokenizer(
    languageFrom({
      root: [{ name: "word", pattern: /word/g, className: "custom-word" }],
    }),
  );

  assert.equal(tokenizer.tokenize("word")[0].className, "custom-word");
});

test("does not throw RangeError on a huge number of tokens (no array spread in hot path)", () => {
  const tokenizer = new Tokenizer(
    languageFrom({
      root: [{ name: "digit", pattern: /\d/g, className: "nsh-number" }],
    }),
  );
  const line = "1".repeat(100000);
  let result;
  assert.doesNotThrow(() => {
    result = tokenizer.tokenizeLine(line, ["root"], 0);
  });
  assert.equal(result.tokens.length, 100000);
});

test("JavaScript-like division is not coloured as regex", () => {
  const { JavaScript } = require("../dist/cjs/languages/JavaScript");
  const tokenizer = new Tokenizer(new JavaScript());
  const cases = [
    "foo() / 2 / 3",
    "array[0] / 2",
    "true / 2",
    "null / 2",
    "this / 2",
    "x++ / 2",
  ];
  for (const source of cases) {
    const result = tokenizer.tokenize(source);
    const regexTokens = result.filter((token) => token.type === "regex");
    assert.equal(regexTokens.length, 0, `expected no regex token in: ${source}`);
  }
});

test("JavaScript regex literals are still detected in regex contexts", () => {
  const { JavaScript } = require("../dist/cjs/languages/JavaScript");
  const tokenizer = new Tokenizer(new JavaScript());
  const cases = [
    "const r = /abc/g;",
    "return /abc/.test(value);",
    "if (/abc/.test(value)) {}",
    "foo(/abc/);",
  ];
  for (const source of cases) {
    const result = tokenizer.tokenize(source);
    assert.ok(
      result.some((token) => token.type === "regex"),
      `expected a regex token in: ${source}`,
    );
  }
});

test("modern regex flags are accepted", () => {
  const { JavaScript } = require("../dist/cjs/languages/JavaScript");
  const tokenizer = new Tokenizer(new JavaScript());
  const result = tokenizer.tokenize("const r = /abc/gimsdvy;");
  const regexTokens = result.filter((token) => token.type === "regex");
  assert.equal(regexTokens.length, 1);
  assert.equal(regexTokens[0].value, "/abc/gimsdvy");
});

test("fuzz: random character soup never crashes or produces invalid tokens", () => {
  const { JavaScript } = require("../dist/cjs/languages/JavaScript");
  const tokenizer = new Tokenizer(new JavaScript());
  const alphabet = `/ \\ * ' " \` $ { } [ ] ( ) < > # @ : ; a b c 1 2 3`;
  const chars = alphabet.split(" ").filter((char) => char !== "");
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let iteration = 0; iteration < 300; iteration += 1) {
    let line = "";
    const lineLength = 1 + Math.floor(rand() * 120);
    for (let i = 0; i < lineLength; i += 1) {
      line += chars[Math.floor(rand() * chars.length)];
    }
    let tokens;
    assert.doesNotThrow(() => {
      tokens = tokenizer.tokenize(line);
    });
    for (const token of tokens) {
      assert.ok(token.value.length > 0, "empty token value");
      assert.ok(token.column >= 1, `column <= 0: ${token.column}`);
      assert.ok(token.column + token.value.length - 1 <= line.length, "token exceeds line length");
      assert.ok(Array.isArray(token.line) || token.line > 0, "token line invalid");
    }
  }
});
