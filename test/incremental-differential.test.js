const assert = require("node:assert/strict");
const test = require("node:test");
const { IncrementalDocument } = require("../dist/cjs/core/IncrementalDocument");
const { Tokenizer } = require("../dist/cjs/core/Tokenizer");
const { JavaScript } = require("../dist/cjs/languages/JavaScript");
const { TypeScript } = require("../dist/cjs/languages/TypeScript");
const { Python } = require("../dist/cjs/languages/Python");
const { HTML } = require("../dist/cjs/languages/HTML");
const { CSS } = require("../dist/cjs/languages/CSS");
const { JSON: JSONLanguage } = require("../dist/cjs/languages/JSON");
const { Markdown } = require("../dist/cjs/languages/Markdown");
const { CSV } = require("../dist/cjs/languages/CSV");
const { JSX } = require("../dist/cjs/languages/JSX");
const { TSX } = require("../dist/cjs/languages/TSX");

const SCENARIOS = [
  {
    name: "JavaScript",
    language: new JavaScript(),
    seed: 0x1a2b3c,
    snippets: [
      "const value = 1;",
      "let text = 'hello';",
      "/*",
      "multiline comment",
      "*/",
      "`template ${value}`",
      "function f(a) { return a / 2; }",
      "const re = /[a-z]+/g;",
      "if (value) {",
      "}",
      "",
    ],
  },
  {
    name: "TypeScript",
    language: new TypeScript(),
    seed: 0x2b3c4d,
    snippets: [
      "interface User {",
      "  name: string;",
      "  age?: number;",
      "}",
      "type Result<T> = { value: T };",
      "const f = (a: string): number => a.length;",
      "function g(input: Array<User>): Promise<User> {",
      "  return input[0];",
      "}",
      "/*",
      "*/",
      "",
    ],
  },
  {
    name: "Python",
    language: new Python(),
    seed: 0x3c4d5e,
    snippets: [
      "def f(a: int, b: str):",
      "    return a",
      "x: int = 1",
      '"""',
      "docstring",
      '"""',
      'text = f"value {x}"',
      "# comment",
      "",
    ],
  },
  {
    name: "HTML",
    language: new HTML(),
    seed: 0x4d5e6f,
    snippets: [
      "<div class=\"item\">",
      "  text content",
      "</div>",
      "<script>",
      "const x = 1;",
      "</script>",
      "<style>",
      ".item { color: red; }",
      "</style>",
      "<!-- comment -->",
      "",
    ],
  },
  {
    name: "CSS",
    language: new CSS(),
    seed: 0x5e6f70,
    snippets: [
      ".item {",
      "  color: #fff;",
      "  width: 50%;",
      "}",
      "/*",
      "comment",
      "*/",
      "",
    ],
  },
  {
    name: "JSON",
    language: new JSONLanguage(),
    seed: 0x6f7081,
    snippets: [
      "{",
      '  "name": "value",',
      '  "items": [1, 2, 3]',
      "}",
      '{"a": true, "b": null}',
      "",
    ],
  },
  {
    name: "Markdown",
    language: new Markdown(),
    seed: 0x708192,
    snippets: [
      "# Heading",
      "**bold** and *italic*",
      "```js",
      "const x = 1;",
      "```",
      "~~~txt",
      "plain",
      "~~~",
      "- item",
      "> quote",
      "",
    ],
  },
  {
    name: "CSV",
    language: new CSV(),
    seed: 0x8192a3,
    snippets: ["a,b,c", "1,2,3", '"quoted,value",2,3', "x,y,z", ""],
  },
  {
    name: "JSX",
    language: new JSX(),
    seed: 0x92a3b4,
    snippets: [
      "const App = () => (",
      '  <div className="app">',
      "    <span>Hello {user.name}</span>",
      "    <img src={logo} />",
      "  </div>",
      ");",
      "{/* comment */}",
      "",
    ],
  },
  {
    name: "TSX",
    language: new TSX(),
    seed: 0xa3b4c5,
    snippets: [
      "interface Props { title: string; }",
      "const App = (title: Props) => (",
      '  <div className="app">{title as string}</div>',
      ");",
      "const f = <T,>(value: T) => value;",
      "",
    ],
  },
];

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(random, values) {
  return values[Math.floor(random() * values.length)];
}

function fullTokenization(language, lines) {
  const tokenizer = new Tokenizer(language);
  let state = ["root"];
  const tokens = [];
  const lineTokens = [];
  const states = [];

  for (let index = 0; index < lines.length; index += 1) {
    const result = tokenizer.tokenizeLine(lines[index], state, index);
    tokens.push(...result.tokens);
    lineTokens.push(result.tokens);
    states.push(result.finalStateStack);
    state = result.finalStateStack;
  }

  return { tokens, lineTokens, states };
}

function assertMatchesFullTokenization(document, language, expectedLines, label) {
  assert.equal(document.getText(), expectedLines.join("\n"), `${label}: text`);
  assert.equal(document.getLineCount(), expectedLines.length, `${label}: line count`);

  const full = fullTokenization(language, expectedLines);
  assert.deepEqual(document.getTokens(), full.tokens, `${label}: tokens`);

  const lines = document.getLines();
  for (let index = 0; index < lines.length; index += 1) {
    assert.equal(lines[index].text, expectedLines[index], `${label}: line ${index} text`);
    assert.deepEqual(
      lines[index].tokens,
      full.lineTokens[index],
      `${label}: line ${index} tokens`,
    );
    assert.deepEqual(
      lines[index].stateAfter,
      full.states[index],
      `${label}: line ${index} stateAfter`,
    );
    assert.deepEqual(
      lines[index].stateBefore,
      index === 0 ? ["root"] : full.states[index - 1],
      `${label}: line ${index} stateBefore`,
    );
  }

  if (lines.length > 1) {
    for (const token of document.getTokensForLines(1, lines.length)) {
      assert.ok(token.line >= 2 && token.line <= lines.length, `${label}: token line`);
    }
  }
}

function mutateLine(line, random) {
  const operations = [
    () => line + pick(random, ["x", " ", "/*", "'", "`", "{", "}"]),
    () => line.slice(0, Math.max(0, line.length - 1)),
    () => {
      const position = Math.floor(random() * (line.length + 1));
      return line.slice(0, position) + pick(random, ["a", "1", "(", ")", "/", " "]) + line.slice(position);
    },
    () => "",
  ];
  return pick(random, operations)();
}

for (const scenario of SCENARIOS) {
  test(`incremental differential oracle: ${scenario.name}`, () => {
    const random = createRandom(scenario.seed);
    const expectedLines = Array.from(
      { length: 24 },
      () => pick(random, scenario.snippets),
    );
    const document = new IncrementalDocument(
      new Tokenizer(scenario.language),
      expectedLines.join("\n"),
    );
    assertMatchesFullTokenization(
      document,
      scenario.language,
      expectedLines,
      `${scenario.name} initial`,
    );

    for (let step = 0; step < 60; step += 1) {
      const lineCount = expectedLines.length;
      const operation = Math.floor(random() * 5);
      let startLine;
      let deletedLines;
      let insertedLines;

      if (operation === 0) {
        startLine = Math.floor(random() * lineCount);
        deletedLines = 1;
        insertedLines = [pick(random, scenario.snippets)];
      } else if (operation === 1 && lineCount > 1) {
        startLine = Math.floor(random() * lineCount);
        deletedLines = 1;
        insertedLines = [];
      } else if (operation === 2) {
        startLine = Math.floor(random() * (lineCount + 1));
        deletedLines = 0;
        insertedLines = [pick(random, scenario.snippets)];
      } else if (operation === 3) {
        startLine = Math.floor(random() * lineCount);
        deletedLines = 1;
        insertedLines = [mutateLine(expectedLines[startLine], random)];
      } else {
        startLine = Math.floor(random() * lineCount);
        const maxDelete = lineCount - startLine;
        deletedLines = Math.floor(random() * maxDelete);
        insertedLines = Array.from(
          { length: Math.floor(random() * 3) },
          () => pick(random, scenario.snippets),
        );
      }

      const update = document.updateLines(startLine, deletedLines, insertedLines);
      expectedLines.splice(startLine, deletedLines, ...insertedLines);

      assert.equal(update.changedStartLine, startLine);
      assert.ok(update.changedEndLine >= startLine);
      assert.ok(update.changedEndLine <= expectedLines.length);
      assert.ok(update.retokenizedLines <= Math.max(expectedLines.length, 1) + insertedLines.length);

      assertMatchesFullTokenization(
        document,
        scenario.language,
        expectedLines,
        `${scenario.name} step ${step}`,
      );
    }
  });
}

test("differential oracle stays correct across many edits on a larger document", () => {
  const random = createRandom(0xdeadbeef);
  const snippets = SCENARIOS[0].snippets;
  const expectedLines = Array.from(
    { length: 300 },
    () => pick(random, snippets),
  );
  const document = new IncrementalDocument(
    new Tokenizer(new JavaScript()),
    expectedLines.join("\n"),
  );

  for (let step = 0; step < 120; step += 1) {
    const startLine = Math.floor(random() * expectedLines.length);
    const deletedLines = 1;
    const insertedLines = [mutateLine(expectedLines[startLine], random)];
    document.updateLines(startLine, deletedLines, insertedLines);
    expectedLines.splice(startLine, deletedLines, ...insertedLines);
  }

  assertMatchesFullTokenization(
    document,
    new JavaScript(),
    expectedLines,
    "large document",
  );
});
