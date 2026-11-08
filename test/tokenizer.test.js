const assert = require("node:assert/strict");
const test = require("node:test");
const { Tokenizer } = require("../dist/cjs/core/Tokenizer");

function languageFrom(states) {
  return {
    name: "test",
    extensions: [".test"],
    getStates: () => states,
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

test("regex detection keeps statement and expression contexts distinct", () => {
  const { JavaScript } = require("../dist/cjs/languages/JavaScript");
  const tokenizer = new Tokenizer(new JavaScript());
  const regexCases = [
    "const x = 1; /* comment */ /re/.test(value);",
    "if (value) /re/.test(value);",
    "if (value) {} /re/.test(value);",
    "while (value) /re/.test(value);",
  ];
  for (const source of regexCases) {
    const tokens = tokenizer.tokenize(source);
    assert.ok(
      tokens.some((token) => token.type === "regex"),
      `expected a regex token in: ${source}`,
    );
  }

  const divisionCases = [
    "foo() / 2 / 3",
    "array[0] / 2",
    "const value = {} / 2",
    "const value = { a: 1 } / 2",
    "const value = function () {} / 2",
  ];
  for (const source of divisionCases) {
    const tokens = tokenizer.tokenize(source);
    assert.equal(
      tokens.filter((token) => token.type === "regex").length,
      0,
      `expected no regex token in: ${source}`,
    );
  }
});

test("caps the state stack only when truncation is explicitly requested", () => {
  const tokenizer = new Tokenizer(
    languageFrom({
      root: [{ name: "open", pattern: /a/g, push: "nested" }],
      nested: [{ name: "open", pattern: /a/g, push: "nested" }],
    }),
    { maxStateDepth: 10, onStateDepthExceeded: "truncate" },
  );

  const result = tokenizer.tokenizeWithState("a".repeat(100));
  assert.equal(result.tokens.length, 100);
  assert.ok(result.finalStateStack.length <= 10);
  assert.equal(tokenizer.getMaxStateDepth(), 10);
});

test("throws instead of silently truncating an overflowing state stack", () => {
  const tokenizer = new Tokenizer(
    languageFrom({
      root: [{ name: "open", pattern: /a/g, push: "nested" }],
      nested: [{ name: "open", pattern: /a/g, push: "nested" }],
    }),
    { maxStateDepth: 10 },
  );

  assert.throws(
    () => tokenizer.tokenizeWithState("a".repeat(11)),
    /exceeded maxStateDepth/,
  );
});

test("throws for an oversized initial state stack by default", () => {
  const tokenizer = new Tokenizer(
    languageFrom({
      root: [{ name: "word", pattern: /a/g }],
      nested: [],
    }),
    { maxStateDepth: 2, validate: false },
  );

  assert.throws(
    () => tokenizer.tokenizeLine("a", ["root", "nested", "nested"], 0),
    /initial lexical state stack exceeds maxStateDepth/,
  );
});

test("supports zero-length state reductions without consuming characters", () => {
  const tokenizer = new Tokenizer(
    languageFrom({
      root: [{ name: "open", pattern: /\[/g, push: "inner" }],
      inner: [{ name: "close", pattern: /^/g, pop: true }],
    }),
  );

  const result = tokenizer.tokenizeWithState("[\n]");
  assert.deepEqual(result.finalStateStack, ["root"]);
});

test("supports dynamic push targets with parameterized state lookup", () => {
  const tokenizer = new Tokenizer(
    languageFrom({
      root: [
        {
          name: "open",
          pattern: /</g,
          push: (_line, _position, _tokens, _stateStack, matched) =>
            `inner:${matched.length}`,
        },
      ],
      inner: [{ name: "close", pattern: />/g, pop: true }],
    }),
  );

  const result = tokenizer.tokenizeWithState("<x>");
  assert.deepEqual(result.finalStateStack, ["root"]);
});

test("does not skip whitespace when a rule can match it", () => {
  const tokenizer = new Tokenizer(
    languageFrom({
      root: [
        { name: "space", pattern: / +/g, className: "custom-space" },
        { name: "word", pattern: /[a-z]+/g, className: "custom-word" },
      ],
    }),
  );

  assert.equal(tokenizer.tokenize("   ").length, 1);
  const word = tokenizer.tokenize("   word").find((token) => token.type === "word");
  assert.equal(word.column, 4);
});

test("escapes keyword alternatives and rejects capturing patterns in combiners", () => {
  const { createKeywordToken, createStringToken } = require("../dist/cjs/languages/shared");
  const tokenizer = new Tokenizer(
    languageFrom({
      root: [createKeywordToken(["c++", "a|b"])],
    }),
  );

  const values = tokenizer.tokenize("c++ a|b").map((token) => token.value);
  assert.deepEqual(values, ["c++", "a|b"]);
  assert.throws(() => createStringToken([/(a)b/g]), /capturing groups/);
});

test("clearCache recompiles a mutated language definition", () => {
  let rules = [{ name: "word", pattern: /one/g }];
  const language = {
    name: "mutable",
    extensions: [".mutable"],
    getStates: () => ({ root: rules }),
  };
  const tokenizer = new Tokenizer(language);
  assert.equal(tokenizer.tokenize("one").length, 1);
  rules = [{ name: "word", pattern: /two/g }];
  assert.equal(tokenizer.tokenize("two").length, 0);
  tokenizer.clearCache();
  assert.equal(tokenizer.tokenize("two").length, 1);
});

test("a missing popTo target is rejected by default", () => {
  const tokenizer = new Tokenizer(
    languageFrom({
      root: [{ name: "open", pattern: /\[/g, push: "inner" }],
      inner: [{ name: "invalid", pattern: /x/g, popTo: "missing" }],
    }),
  );

  assert.throws(() => tokenizer.tokenizeWithState("[x"), /pops to unknown state/);
});

test("validation can be disabled for legacy lenient behavior", () => {
  const tokenizer = new Tokenizer(
    languageFrom({
      root: [{ name: "open", pattern: /\[/g, push: "inner" }],
      inner: [{ name: "invalid", pattern: /x/g, popTo: "missing" }],
    }),
    { validate: false },
  );

  const result = tokenizer.tokenizeWithState("[x");
  assert.deepEqual(result.finalStateStack, ["root", "inner"]);
});

test("rejects malformed language definitions before tokenizing", () => {
  const cases = [
    [
      "missing root",
      {},
      /missing required "root" state/,
    ],
    [
      "non-RegExp pattern",
      { root: [{ name: "word", pattern: "word" }] },
      /pattern must be a RegExp/,
    ],
    [
      "zero-width rule without reduction",
      { root: [{ name: "empty", pattern: /^/g }] },
      /can match an empty string/,
    ],
    [
      "unknown push target",
      { root: [{ name: "open", pattern: /a/g, push: "missing" }] },
      /pushes unknown state "missing"/,
    ],
    [
      "unreachable state",
      { root: [], orphan: [{ name: "word", pattern: /a/g }] },
      /state "orphan" is unreachable/,
    ],
  ];
  for (const [label, states, expected] of cases) {
    const tokenizer = new Tokenizer(languageFrom(states));
    assert.throws(() => tokenizer.tokenize("a"), expected, label);
  }
});

test("rejects obviously unsafe nested quantifiers unless validation is disabled", () => {
  const language = languageFrom({
    root: [{ name: "risky", pattern: /(a+)+/g }],
  });
  assert.throws(
    () => new Tokenizer(language).tokenize(""),
    /catastrophic backtracking/,
  );
  const tokenizer = new Tokenizer(language, { validate: false });
  assert.doesNotThrow(() => tokenizer.tokenize(""));
});

test("rejects unknown initial lexical states", () => {
  const tokenizer = new Tokenizer(
    languageFrom({ root: [{ name: "word", pattern: /a/g }] }),
  );
  assert.throws(
    () => tokenizer.tokenizeLine("a", ["missing"], 0),
    /unknown state "missing"/,
  );
});

test("rejects dynamic pushes to unknown states", () => {
  const tokenizer = new Tokenizer(
    languageFrom({
      root: [{ name: "open", pattern: /a/g, push: () => "missing" }],
    }),
  );
  assert.throws(() => tokenizer.tokenize("a"), /references unknown state "missing"/);
});

test("public validateLanguageDefinition reports errors and warnings", () => {
  const { validateLanguageDefinition } = require("../dist/cjs/core/LanguageValidation");
  const result = validateLanguageDefinition({
    name: "broken",
    extensions: [".broken"],
    getStates: () => ({
      root: [{ name: "risky", pattern: /(a+)+/g, push: "missing" }],
    }),
  });
  assert.ok(result.errors.some((error) => error.includes("pushes unknown state")));
  assert.ok(result.errors.some((error) => error.includes("backtracking")));
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
