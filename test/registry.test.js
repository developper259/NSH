const assert = require("node:assert/strict");
const test = require("node:test");
const { LanguageRegistry } = require("../dist/cjs/core/LanguageRegistry");
const { Parser } = require("../dist/cjs/core/Parser");
const { Highlighter } = require("../dist/cjs/core/Highlighter");
const { defaultRegistry } = require("../dist/cjs/languages/Languages");

function customLanguage(name, extensions, aliases) {
  return {
    name,
    extensions,
    aliases,
    getStates: () => ({
      root: [{ name: "word", pattern: /[a-z]+/g, className: "nsh-variable" }],
    }),
  };
}

test("language registry resolves aliases, canonical names and extensions", () => {
  const registry = new LanguageRegistry();
  registry.registerLanguage(customLanguage("CustomLang", [".custom"], ["cl"]));

  assert.equal(registry.getLanguage("customlang").name, "CustomLang");
  assert.equal(registry.getLanguage("CL").name, "CustomLang");
  assert.equal(registry.getLanguageByExtension("CUSTOM").name, "CustomLang");
  assert.deepEqual(registry.listLanguages(), ["CustomLang"]);

  assert.equal(registry.removeLanguage("cl"), true);
  assert.equal(registry.getLanguage("customlang"), undefined);
  assert.equal(registry.getLanguageByExtension(".custom"), undefined);
  assert.equal(registry.removeLanguage("missing"), false);
});

test("language registry rejects conflicting extensions and aliases", () => {
  const registry = new LanguageRegistry();
  registry.registerLanguage(customLanguage("One", [".same"], ["o"]));
  assert.throws(
    () => registry.registerLanguage(customLanguage("Two", [".same"])),
    /Extension already registered/,
  );
  assert.throws(
    () => registry.registerLanguage(customLanguage("Three", [".three"], ["o"])),
    /name or alias already registered/,
  );
  assert.equal(registry.getLanguage("one").name, "One");
});

test("built-in aliases and detection are available", () => {
  assert.equal(defaultRegistry.getLanguage("js").name, "javascript");
  assert.equal(defaultRegistry.getLanguage("c++").name, "cpp");
  assert.equal(Highlighter.detectLanguage("ts"), "typescript");
  assert.equal(Highlighter.detectLanguage(".CSV"), "csv");
});

test("Parser refreshes its source line count after setTokens", () => {
  const parser = new Parser([], "one\ntwo\nthree\nfour\nfive");
  assert.equal(parser.parse().totalLines, 5);
  const tokens = [{ type: "variable", value: "x", line: 1, column: 1 }];
  parser.setTokens(tokens);
  assert.equal(parser.parse().totalLines, 1);
  parser.setTokens(tokens, "one\ntwo\nthree");
  assert.equal(parser.parse().totalLines, 3);
});
