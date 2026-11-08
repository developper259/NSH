const assert = require("node:assert/strict");
const test = require("node:test");
const { Tokenizer } = require("../dist/cjs/core/Tokenizer");
const { JSX } = require("../dist/cjs/languages/JSX");
const { TSX } = require("../dist/cjs/languages/TSX");
const { Markdown } = require("../dist/cjs/languages/Markdown");

function tokenize(language, code) {
  const tokenizer = new Tokenizer(language);
  const result = tokenizer.tokenizeWithState(code);
  assert.deepEqual(result.finalStateStack, ["root"], "tokenizer did not return to root");
  return result.tokens;
}

function assertToken(tokens, value, type) {
  const token = tokens.find((item) => item.value === value);
  assert.ok(token, `missing token ${value}`);
  if (type) assert.equal(token.type, type, `unexpected type for ${value}`);
  return token;
}

test("JSX handles tags, attributes, expressions, components, fragments and spreads", () => {
  const code = [
    "const App = () => (",
    '  <div className="app" data-id={user.id}>',
    "    <span>Hello {user.name}</span>",
    "    <img src={logo} />",
    "    <>{items.map((item) => <Item key={item.id} {...item} />)}</>",
    "  </div>",
    ");",
  ].join("\n");
  const tokens = tokenize(new JSX(), code);

  assertToken(tokens, "<div", "jsx-tag");
  assertToken(tokens, "className", "attribute");
  assertToken(tokens, "app", "string");
  assertToken(tokens, ">", "tag-bracket");
  assertToken(tokens, "</span>", "jsx-tag");
  assertToken(tokens, "<img", "jsx-tag");
  assertToken(tokens, "/>", "tag-selfclose");
  assertToken(tokens, "<>", "jsx-tag");
  assertToken(tokens, "</>", "jsx-tag");
  assertToken(tokens, "<Item", "jsx-tag");
  assertToken(tokens, "...", "spread");
  assertToken(tokens, "user", "variable");
});

test("JSX keeps comments, text and multiline tags in the right state", () => {
  const code = [
    "<div",
    '  className="app"',
    "  onClick={() => setOpen(!open)}",
    ">",
    "  {/* a comment */}",
    "  <p>Don't panic</p>",
    "</div>",
  ].join("\n");
  const tokens = tokenize(new JSX(), code);

  const comment = tokens
    .filter((token) => token.type === "comment")
    .map((token) => token.value)
    .join("");
  assert.equal(comment, "/* a comment */");
  const text = tokens.find((token) => token.type === "text" && token.value.includes("Don't panic"));
  assert.ok(text, "JSX text was split by the apostrophe");
  assertToken(tokens, "onClick", "attribute");
  assertToken(tokens, "=>", "arrow-function");
});

test("JSX does not treat comparisons or TSX generic arrows as tags", () => {
  assert.equal(
    new Tokenizer(new JSX()).tokenize("const ok = a < b;").some((token) => token.type === "jsx-tag"),
    false,
  );

  const genericArrow = new Tokenizer(new TSX()).tokenize("const f = <T,>(x: T) => x;");
  assert.equal(genericArrow.some((token) => token.type === "jsx-tag"), false);
  assert.equal(genericArrow.some((token) => token.value === "<"), true);

  const constrained = new Tokenizer(new TSX()).tokenize("const f = <T extends object>(x: T) => x;");
  assert.equal(constrained.some((token) => token.type === "jsx-tag"), false);

  const defaulted = new Tokenizer(new TSX()).tokenize("const f = <T = string>(x: T) => x;");
  assert.equal(defaulted.some((token) => token.type === "jsx-tag"), false);

  const constParameter = new Tokenizer(new TSX()).tokenize("const f = <const T,>(x: T) => x;");
  assert.equal(constParameter.some((token) => token.type === "jsx-tag"), false);
});

test("TSX supports generic arguments on component tags", () => {
  const code = [
    "const view = (value: string) => (",
    "  <Select<string>",
    "    value={value}",
    "    render={(item) => <Item<{ id: number }> value={item} />}",
    "  />",
    ");",
  ].join("\n");
  const tokens = tokenize(new TSX(), code);

  assertToken(tokens, "<Select", "jsx-tag");
  assertToken(tokens, "string", "type");
  assertToken(tokens, "render", "attribute");
  assertToken(tokens, "<Item", "jsx-tag");
  assertToken(tokens, "id", "type");
  assertToken(tokens, "/>", "tag-selfclose");
  assert.ok(tokens.some((token) => token.type === "type-separator" && token.value === "<"));
  assert.ok(tokens.some((token) => token.type === "type-separator" && token.value === ">"));
});

test("TSX types arrow parameters and keeps JSX expressions typed", () => {
  const code = "const App = (title: Props) => (<div>{title as string}</div>);";
  const tokens = tokenize(new TSX(), code);
  assertToken(tokens, "Props", "type");
  assertToken(tokens, "<div", "jsx-tag");
  assertToken(tokens, "</div>", "jsx-tag");
  assert.ok(tokens.some((token) => token.value === "string" && token.type === "type"));
});

test("Markdown highlights headings, lists, inline markup, links, tables and HTML", () => {
  const code = [
    "# Title",
    "",
    "Some **bold** and *italic* with `inline` and [link](https://example.com).",
    "",
    "![logo](img.png)",
    "",
    "> quote",
    "",
    "- item",
    "  - nested",
    "",
    "---",
    "",
    "```text",
    "const x: number = 1;",
    "# not a heading",
    "```",
    "",
    "| a | b |",
    "| --- | --- |",
    "| 1 | 2 |",
    "",
    '<div class="note">text</div>',
  ].join("\n");
  const tokens = tokenize(new Markdown(), code);

  assertToken(tokens, "# Title", "heading");
  assertToken(tokens, "**bold**", "bold");
  assertToken(tokens, "*italic*", "italic");
  assertToken(tokens, "`inline`", "inline-code");
  assertToken(tokens, "[link](https://example.com)", "link");
  assertToken(tokens, "![logo](img.png)", "image");
  assertToken(tokens, "> ", "blockquote");
  assertToken(tokens, "- ", "list-marker");
  assertToken(tokens, "  - ", "list-marker");
  assertToken(tokens, "---", "separator");
  assertToken(tokens, "```text", "code-fence");
  assertToken(tokens, "const x: number = 1;", "code-block");
  assertToken(tokens, "# not a heading", "code-block");
  assertToken(tokens, "```", "code-fence-end");
  assertToken(tokens, "| --- | --- |", "table-separator");
  assertToken(tokens, "|", "table-delimiter");
  assertToken(tokens, '<div class="note">', "tag");
  assertToken(tokens, "</div>", "tag");
});

test("Markdown code fences respect marker type and closing length", () => {
  const mismatched = tokenize(
    new Markdown(),
    ["```txt", "~~~", "still code", "```"].join("\n"),
  );
  const tildes = mismatched.find((token) => token.value === "~~~");
  assert.equal(tildes.type, "code-block");
  assert.equal(mismatched.filter((token) => token.type === "code-fence-end").length, 1);

  const longerClose = tokenize(new Markdown(), ["```", "code", "````"].join("\n"));
  assert.equal(longerClose.filter((token) => token.type === "code-fence-end").length, 1);

  const tildesFence = tokenize(new Markdown(), ["~~~text", "const x = 1;", "~~~"].join("\n"));
  assert.equal(tildesFence.filter((token) => token.type === "code-block").length, 1);
  assert.equal(tildesFence.filter((token) => token.type === "code-fence-end").length, 1);
});

test("Markdown dispatches fenced code to embedded languages", () => {
  const typescript = tokenize(
    new Markdown(),
    ["```ts", "const value: number = 1;", "```"].join("\n"),
  );
  assertToken(typescript, "const", "keyword");
  assertToken(typescript, "number", "type");
  assertToken(typescript, "```", "code-fence-end");

  const javascript = tokenize(
    new Markdown(),
    ["```js", "const re = /[a-z]+/g;", "```"].join("\n"),
  );
  assert.ok(javascript.some((token) => token.type === "regex"));

  const python = tokenize(
    new Markdown(),
    ["```python", "def f(a: int):", "    return a", "```"].join("\n"),
  );
  assertToken(python, "def", "keyword");
  assert.ok(python.some((token) => token.type === "type-hint"));

  const html = tokenize(
    new Markdown(),
    ["```html", '<div class="a">text</div>', "```"].join("\n"),
  );
  assertToken(html, "<div", "tag-open");

  const plain = tokenize(
    new Markdown(),
    ["```text", "plain content", "```"].join("\n"),
  );
  assertToken(plain, "plain content", "code-block");
});

test("Markdown fences open in blockquotes and list items", () => {
  const quoted = tokenize(
    new Markdown(),
    [
      "> ```ts",
      "> const value: number = 1;",
      "> ```",
    ].join("\n"),
  );
  assertToken(quoted, "```ts", "code-fence");
  assertToken(quoted, "> ", "blockquote");
  assertToken(quoted, "const", "keyword");
  assertToken(quoted, "number", "type");
  assert.ok(quoted.some((token) => token.type === "code-fence-end"));

  const listed = tokenize(
    new Markdown(),
    [
      "- item",
      "- ```js",
      "  const value = 1;",
      "  ```",
    ].join("\n"),
  );
  assertToken(listed, "```js", "code-fence");
  assertToken(listed, "const", "keyword");
  assert.ok(listed.some((token) => token.type === "code-fence-end"));

  const notQuoted = tokenize(
    new Markdown(),
    ["```js", "> const value = 1;", "```"].join("\n"),
  );
  assert.equal(
    notQuoted.some((token) => token.type === "blockquote"),
    false,
    "a non-quoted fence must not strip a leading > from code",
  );
  assertToken(notQuoted, ">", "operator");

  const notFence = tokenize(
    new Markdown(),
    ["text ```js", "still text"].join("\n"),
  );
  assert.equal(notFence.some((token) => token.type === "code-fence"), false);
});

test("embedded fences close even from an open language state", () => {
  const cases = [
    ["```js", "/* open comment", "```"],
    ["```bash", 'echo "unterminated', "```"],
    ["```rust", 'let value = r#"raw', "```"],
    ["```html", "<script>", "```"],
  ];
  for (const lines of cases) {
    const tokens = tokenize(new Markdown(), lines.join("\n"));
    assertToken(tokens, "```", "code-fence-end");
  }
});

test("Markdown keeps an open code fence state until a valid close", () => {
  const tokenizer = new Tokenizer(new Markdown());
  const result = tokenizer.tokenizeWithState(["```", "code"].join("\n"));
  assert.equal(result.finalStateStack.length, 2);
  assert.match(result.finalStateStack[1], /^inCodeFence:/);
});
