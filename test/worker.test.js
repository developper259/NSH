const assert = require("node:assert/strict");
const test = require("node:test");
const {
  AsyncTokenizer,
  RegexTimeoutError,
} = require("../dist/cjs/worker");

test("worker tokenizer returns tokens and state", async () => {
  const tokenizer = new AsyncTokenizer("typescript", { timeoutMs: 5000 });
  try {
    const result = await tokenizer.tokenize("const value: number = 1;");
    assert.ok(result.tokens.some((token) => token.value === "const"));
    assert.ok(result.tokens.some((token) => token.value === "number" && token.type === "type"));
    assert.deepEqual(result.finalStateStack, ["root"]);

    const line = await tokenizer.tokenizeLine(
      "const other = 2;",
      ["root"],
      7,
    );
    assert.equal(line.tokens[0].line, 8);
  } finally {
    await tokenizer.close();
  }
});

test("worker timeout terminates a blocked tokenization", async () => {
  const tokenizer = new AsyncTokenizer("typescript", { timeoutMs: 1 });
  try {
    const line = "const value: T; ".repeat(50000);
    await assert.rejects(
      tokenizer.tokenize(line),
      (error) => error instanceof RegexTimeoutError,
    );
  } finally {
    await tokenizer.close();
  }
});

test("worker reports language and tokenizer errors", async () => {
  const missing = new AsyncTokenizer("missing-language", { timeoutMs: 5000 });
  try {
    await assert.rejects(missing.tokenize("x"), /Unsupported language/);
  } finally {
    await missing.close();
  }

  const invalid = new AsyncTokenizer("css", {
    timeoutMs: 5000,
    tokenizerOptions: { maxStateDepth: 2 },
  });
  try {
    await assert.rejects(
      invalid.tokenize("{".repeat(10)),
      /state stack exceeded maxStateDepth/,
    );
  } finally {
    await invalid.close();
  }
});
