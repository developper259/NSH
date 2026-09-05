const assert = require("node:assert/strict");
const test = require("node:test");
const { Tokenizer } = require("../dist/core/Tokenizer");

function languageFrom(states) {
  return {
    name: "test",
    extensions: [".test"],
    getTokenTypes: () => states.root,
    getStates: states,
  };
}

test("matches rules only at the current position", () => {
  const tokenizer = new Tokenizer(languageFrom({
    root: [
      { name: "word", pattern: /b/g, className: "custom-word" },
    ],
  }));

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
  const tokenizer = new Tokenizer(languageFrom({
    root: [{ name: "word", pattern: /word/g, className: "custom-word" }],
  }));

  assert.equal(tokenizer.tokenize("word")[0].className, "custom-word");
});
