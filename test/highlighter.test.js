const assert = require("node:assert/strict");
const test = require("node:test");
const { Highlighter } = require("../dist/cjs/core/Highlighter");
const { JavaScript } = require("../dist/cjs/languages/JavaScript");
const { HTML } = require("../dist/cjs/languages/HTML");
const { Markdown } = require("../dist/cjs/languages/Markdown");

function extractText(html) {
  const lines = [];
  const pattern = /<div class="nsh-line">([\s\S]*?)<\/div>/g;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    lines.push(
      match[1]
        .replace(/<span class="nsh-line-number">\d+<\/span>/g, "")
        .replace(/<span class="[^"]*">|<\/span>/g, "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&"),
    );
  }
  return lines.join("\n");
}

test("Highlighter preserves the exact source text and escapes markup", () => {
  const code = [
    'const html = "<div class=\\"x\\">&amp; \'q\'</div>";',
    "",
    "\tif (a < b && c > d) {",
    "  return `x ${a}`;",
    "}",
  ].join("\n");
  const result = new Highlighter(new JavaScript()).highlight(code);

  assert.equal(extractText(result.html), code);
  assert.ok(result.html.includes("&lt;div"));
  assert.ok(result.html.includes("&amp;amp;"));
  assert.equal(result.html.includes('<div class="x">'), false);
});

test("Highlighter handles empty documents and empty lines", () => {
  const highlighter = new Highlighter(new JavaScript());
  const empty = highlighter.highlight("");

  assert.deepEqual(empty.tokens, []);
  assert.deepEqual(empty.finalState, ["root"]);
  assert.equal(
    empty.html,
    '<div class="nsh-highlighter nsh-theme-dark"><div class="nsh-line"></div></div>',
  );

  const html = highlighter.getHTML("a\n\nb");
  assert.equal((html.match(/class="nsh-line"/g) || []).length, 3);
  assert.equal(extractText(html), "a\n\nb");
});

test("Highlighter preserves tabs, spaces and line numbers", () => {
  const code = "\t  const  x = 1;  ";
  const highlighter = new Highlighter(new JavaScript(), {
    lineNumbers: true,
    theme: "light",
  });
  const html = highlighter.getHTML(code);

  assert.ok(html.includes("\t  "));
  assert.equal(extractText(html), code);
  assert.match(html, /nsh-theme-light/);
  assert.match(html, /nsh-line-number">1<\/span>/);
});

test("highlightLine uses the provided line index and state", () => {
  const highlighter = new Highlighter(new JavaScript(), { lineNumbers: true });
  const result = highlighter.highlightLine("const x = 1;", ["root"], 41);

  assert.match(result.html, /nsh-line-number">42<\/span>/);
  assert.deepEqual(result.finalState, ["root"]);
  assert.ok(result.tokens.some((token) => token.value === "const"));
});

test("includeClasses only adds mapped classes to returned tokens", () => {
  const language = {
    name: "classless",
    extensions: [".classless"],
    getStates: () => ({
      root: [{ name: "variable", pattern: /[a-z]+/g }],
    }),
  };
  const plain = new Highlighter(language).highlight("value");
  const withClasses = new Highlighter(language, { includeClasses: true }).highlight("value");

  assert.equal(plain.tokens[0].className, undefined);
  assert.equal(withClasses.tokens[0].className, "nsh-variable");
  assert.equal(language.getStates().root[0].className, undefined);
});

test("token class names and themes cannot inject HTML", () => {
  const language = {
    name: "injecting",
    extensions: [".injecting"],
    getStates: () => ({
      root: [
        {
          name: "payload",
          pattern: /x/g,
          className: '"><script>alert(1)</script>',
        },
      ],
    }),
  };
  const highlighter = new Highlighter(language, { theme: 'evil" onclick="x' });
  const result = highlighter.highlight("x");

  assert.equal(result.html.includes("<script>"), false);
  assert.equal(result.html.includes("onclick"), false);
  assert.ok(result.html.includes(">x<"));
  assert.equal(highlighter.getThemeName(), "dark");
  highlighter.setTheme("light");
  assert.equal(highlighter.getThemeName(), "light");
  highlighter.setTheme("bad theme");
  assert.equal(highlighter.getThemeName(), "dark");
});

test("getHTML, getToken and highlight agree on the same source", () => {
  const code = "const value = 1;";
  const highlighter = new Highlighter(new JavaScript());

  assert.equal(highlighter.getHTML(code), highlighter.highlight(code).html);
  assert.deepEqual(highlighter.getToken(code), highlighter.highlight(code).tokens);
});

test("HTML text and Markdown headings expose stable classes", () => {
  const htmlResult = new Highlighter(new HTML()).highlight("plain text");
  assert.ok(htmlResult.tokens.some((token) => token.type === "text"));
  assert.equal(extractText(htmlResult.html), "plain text");

  const markdown = new Highlighter(new Markdown()).highlight("# Title");
  assert.ok(markdown.tokens.some((token) => token.type === "heading"));
  assert.match(markdown.html, /nsh-keyword/);
});
