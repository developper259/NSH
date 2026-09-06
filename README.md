# NSH

**NSH (NDL Syntax Highlighter)** is a fast, stateful syntax-highlighting library written in TypeScript.

It is designed for both traditional syntax highlighting and editor workloads where re-tokenizing an entire document after every keystroke would be wasteful.

It works with Node.js, Electron, and browser bundlers.

## Built for NCE

NSH was initially created as the syntax-highlighting engine for [NCE](https://github.com/developper259/NCE).

NCE requires highlighting that can keep up with interactive editing without re-tokenizing an entire document after every change.

This requirement influenced several parts of NSH's architecture:

- line-based lexical state;
- incremental document updates;
- state convergence;
- semantic token output;
- low-overhead tokenization;
- browser/Electron compatibility.

Although NSH is developed primarily for NCE, it is not coupled to NCE and can be used as a standalone syntax-highlighting library.

---

## Features

- ⚡ Fast lexical tokenization
- 🧠 Stateful multiline highlighting
- ✏️ Incremental document highlighting
- 🎨 HTML and semantic token output
- 🌐 Browser, Node.js, and Electron support
- 🔌 Optional WebSocket server
- 🧩 Custom language definitions
- 🎭 Built-in light and dark themes
- 📦 CommonJS and ESM support
- 🔎 Language detection by file extension
- 🧪 Built-in test and benchmark suites

NSH is intentionally a **lexical syntax highlighter**.

It does not build an AST and does not attempt to replace a compiler or full parser.

---

## Installation

```bash
npm install nsh
```

You can also install a specific Git revision while developing against NSH:

```bash
npm install github:developper259/NSH#<commit-sha>
```

Git installations automatically build the package through the `prepare` lifecycle.

---

## Quick Start

```ts
import { Highlighter, TypeScript } from "nsh";

const highlighter = new Highlighter(new TypeScript());

const result = highlighter.highlight(`
const message: string = "Hello from NSH";
console.log(message);
`);

console.log(result.html);
console.log(result.tokens);
```

`highlight()` returns:

```ts
{
  html: string;
  tokens: Token[];
  finalState: string[];
}
```

---

## Tokens

NSH exposes semantic tokens instead of only returning HTML.

For example:

```ts
import { Tokenizer, TypeScript } from "nsh";

const tokenizer = new Tokenizer(new TypeScript());

const tokens = tokenizer.tokenize(`const user: User = getUser();`);

console.log(tokens);
```

A token has the following structure:

```ts
interface Token {
  type: string;
  value: string;
  line: number;
  column: number;
  className?: string;
}
```

Example:

```ts
{
  type: "variable",
  value: "user",
  line: 1,
  column: 7,
  className: "nsh-variable"
}
```

Token `line` and `column` positions are **1-based**.

---

# Stateful highlighting

Many programming constructs cannot be highlighted correctly one line at a time without remembering previous lines.

Examples include:

```js
/*
  multiline comment
*/
```

```js
const text = `
  multiline template
`;
```

NSH therefore exposes tokenizer state explicitly.

```ts
import { Tokenizer, JavaScript } from "nsh";

const tokenizer = new Tokenizer(new JavaScript());

let state = ["root"];

const lines = ["/* comment", "still inside comment", "*/", "const value = 1;"];

for (let index = 0; index < lines.length; index++) {
  const result = tokenizer.tokenizeLine(lines[index], state, index);

  console.log(result.tokens);

  state = result.finalStateStack;
}
```

The state stack allows an editor to continue tokenizing from the lexical state of the previous line.

---

# Incremental highlighting

NSH includes `IncrementalDocument`, designed specifically for editors.

Instead of re-tokenizing an entire file after an edit, NSH stores the lexical state of every line and re-tokenizes forward only until the state converges again.

```ts
import { IncrementalDocument, Tokenizer, TypeScript } from "nsh";

const document = new IncrementalDocument(
  new Tokenizer(new TypeScript()),
  `const first = 1;
const second = 2;
const third = 3;`,
);
```

Update one line:

```ts
const update = document.updateLines(1, 1, ["const second = 42;"]);
```

The returned object describes the affected region:

```ts
console.log(update);

/*
{
  startLine,
  deletedLines,
  insertedLines,
  retokenizedLines,
  changedStartLine,
  changedEndLine
}
*/
```

You can then request only the lines that need to be refreshed by the editor:

```ts
const changedLines = document.getLines(
  update.changedStartLine,
  update.changedEndLine,
);
```

Other available methods include:

```ts
document.getText();

document.getLine(10);

document.getLines(10, 20);

document.getTokens();

document.getTokensForLines(10, 20);

document.getLineCount();
```

`IncrementalDocument` line indexes are **0-based**.

Range end indexes are exclusive.

---

# Highlighting a single line

For editor integrations where the state is already managed externally:

```ts
import { Highlighter, JavaScript } from "nsh";

const highlighter = new Highlighter(new JavaScript());

const result = highlighter.highlightLine("const value = 42;", ["root"], 0);

console.log(result.tokens);
console.log(result.html);
console.log(result.finalState);
```

---

# Themes

NSH currently ships with:

- `dark`
- `light`

Import the stylesheet:

```ts
import "nsh/themes/dark.css";
```

Then:

```ts
const highlighter = new Highlighter(new TypeScript(), {
  theme: "dark",
  lineNumbers: true,
});
```

The generated root element uses a scoped theme class:

```html
<div class="nsh-highlighter nsh-theme-dark">...</div>
```

This allows multiple NSH themes to coexist without globally styling unrelated code.

---

# Supported languages

NSH currently includes the following built-in language definitions:

| Language   | Typical extensions                           |
| ---------- | -------------------------------------------- |
| JavaScript | `.js`, `.mjs`                                |
| TypeScript | `.ts`                                        |
| Python     | `.py`, `.pyw`                                |
| HTML       | `.html`, `.htm`                              |
| CSS        | `.css`                                       |
| JSON       | `.json`, `.geojson`                          |
| PHP        | `.php`, `.phtml`                             |
| XML        | `.xml`, `.xsd`, `.xsl`, `.xslt`, `.svg`      |
| YAML       | `.yaml`, `.yml`                              |
| Java       | `.java`                                      |
| C          | `.c`, `.h`                                   |
| C++        | `.cpp`, `.cc`, `.cxx`, `.hpp`, `.hh`, `.hxx` |

> YAML support is currently experimental.

JSX/TSX and SCSS/Sass are not currently advertised as supported languages.

---

# Language detection

Detect a language from a file extension:

```ts
import { Highlighter } from "nsh";

Highlighter.detectLanguage(".ts");
// "typescript"

Highlighter.detectLanguage("py");
// "python"
```

List all registered languages:

```ts
Highlighter.getSupportedLanguages();
```

---

# Registering a custom language

NSH language definitions implement `LanguageDefinition`.

A minimal language can look like this:

```ts
import type { LanguageDefinition, TokenType } from "nsh";

class ExampleLanguage implements LanguageDefinition {
  name = "example";

  extensions = [".example"];

  private root: TokenType[] = [
    {
      name: "keyword",
      pattern: /\b(?:hello|world)\b/g,
      className: "nsh-keyword",
    },
    {
      name: "number",
      pattern: /\b\d+\b/g,
      className: "nsh-number",
    },
    {
      name: "variable",
      pattern: /\b[A-Za-z_][A-Za-z0-9_]*\b/g,
      className: "nsh-variable",
    },
  ];

  getTokenTypes(): TokenType[] {
    return this.root;
  }

  getStates(): Record<string, TokenType[]> {
    return {
      root: this.root,
    };
  }
}
```

Register it globally:

```ts
import { Highlighter } from "nsh";

Highlighter.registerLanguage(new ExampleLanguage());
```

Or use it directly:

```ts
const highlighter = new Highlighter(new ExampleLanguage());
```

---

# Stateful custom languages

A token rule can change lexical state:

```ts
{
  name: "comment",
  pattern: /\/\*/g,
  className: "nsh-comment",
  push: "inComment"
}
```

Then:

```ts
inComment: [
  {
    name: "comment",
    pattern: /\*\//g,
    className: "nsh-comment",
    pop: true,
  },
  {
    name: "comment",
    pattern: /(?:(?!\*\/).)+/g,
    className: "nsh-comment",
  },
];
```

Rules may use:

```ts
push?: string;
pop?: boolean;
popTo?: string;
popPrefix?: string;
context?: (
  line,
  position,
  tokens,
  stateStack
) => boolean;
```

This makes it possible to implement multiline constructs and lightweight context-sensitive highlighting without introducing a full parser.

---

# Optional WebSocket server

NSH also provides an optional Node.js WebSocket server.

Import it separately:

```ts
import { NSHServer } from "nsh/server";

const server = new NSHServer();

const port = await server.start();

console.log(`NSH server listening on port ${port}`);
```

By default:

- host: `127.0.0.1`
- port: dynamically assigned
- maximum WebSocket payload: `2 MiB`

You can configure it:

```ts
const server = new NSHServer({
  host: "127.0.0.1",
  port: 8080,
  maxPayload: 4 * 1024 * 1024,
});
```

---

## WebSocket requests

Every request requires an `id`.

Example highlighting request:

```json
{
  "id": "request-1",
  "requestType": "highlight",
  "language": "typescript",
  "code": "const value: number = 42;",
  "responseType": "both"
}
```

Supported request types:

```text
highlight
highlightLine
supportedLanguages
detectLanguage
openDocument
updateDocument
getDocumentLines
closeDocument
```

---

## Incremental documents over WebSocket

Open a document:

```json
{
  "id": "1",
  "requestType": "openDocument",
  "documentId": "editor-1",
  "language": "typescript",
  "code": "const value = 1;"
}
```

Update it:

```json
{
  "id": "2",
  "requestType": "updateDocument",
  "documentId": "editor-1",
  "startLine": 0,
  "deletedLines": 1,
  "insertedLines": ["const value = 2;"]
}
```

Request a line range:

```json
{
  "id": "3",
  "requestType": "getDocumentLines",
  "documentId": "editor-1",
  "startLine": 0,
  "endLine": 20
}
```

Close the document:

```json
{
  "id": "4",
  "requestType": "closeDocument",
  "documentId": "editor-1"
}
```

Document sessions are isolated per WebSocket connection.

---

# Package entry points

Core library:

```ts
import {
  Highlighter,
  Tokenizer,
  IncrementalDocument,
  Parser,
  LanguageRegistry,
  ThemeManager,
} from "nsh";
```

Node-only WebSocket server:

```ts
import { NSHServer } from "nsh/server";
```

Themes:

```ts
import "nsh/themes/dark.css";
import "nsh/themes/light.css";
```

The package provides both CommonJS and ESM entry points together with TypeScript declarations.

---

# Architecture

The main highlighting pipeline is intentionally small:

```text
LanguageDefinition
        │
        ▼
    Tokenizer
        │
        ├── tokens
        │
        └── lexical state
               │
               ▼
      IncrementalDocument
               │
               ▼
         editor updates
```

For standalone highlighting:

```text
LanguageDefinition
        │
        ▼
     Highlighter
        │
        ├── semantic tokens
        └── HTML
```

The optional server exposes the same functionality over WebSocket.

---

# Performance

NSH is designed around editor workloads.

The tokenizer:

- matches rules only at the current cursor position;
- uses sticky regular expressions;
- caches compiled language states;
- avoids forward regex scanning;
- carries lexical state between lines.

`IncrementalDocument` additionally stops re-tokenization once the lexical state converges with the cached document state.

Run the benchmark suite with:

```bash
npm run benchmark
```

Run the lightweight benchmark used by CI:

```bash
npm run benchmark:smoke
```

Performance should always be measured on the application and files you intend to highlight.

---

# Browser usage

The core package is browser-compatible when used through a modern bundler.

For example:

```ts
import { Highlighter, JavaScript } from "nsh";

import "nsh/themes/dark.css";

const highlighter = new Highlighter(new JavaScript(), {
  theme: "dark",
});

const result = highlighter.highlight(`console.log("Hello browser");`);

document.querySelector("#code")!.innerHTML = result.html;
```

The WebSocket server is Node-only and is intentionally exposed through the separate:

```text
nsh/server
```

entry point.

---

# Development

Clone the repository and install dependencies:

```bash
npm install
```

Type-check:

```bash
npm run typecheck
```

Run the test suite:

```bash
npm test
```

Build:

```bash
npm run build
```

Run benchmarks:

```bash
npm run benchmark
```

Run the benchmark smoke test:

```bash
npm run benchmark:smoke
```

Inspect the npm package before publishing:

```bash
npm pack --dry-run
```

---

# Design goals

NSH prioritizes:

1. **Fast editor updates**
2. **Predictable lexical state**
3. **Small and understandable language definitions**
4. **Semantic token output**
5. **No mandatory AST or compiler dependency**
6. **Node/browser interoperability**
7. **Extensibility**

---

# Limitations

NSH is a lexical syntax highlighter.

That means some constructs which require complete syntactic or semantic knowledge may only be approximated.

Examples include:

- ambiguous JavaScript regex literals versus division;
- highly context-sensitive generic/type syntax;
- complex nested language grammars;
- advanced YAML indentation semantics.

NSH intentionally uses lightweight lexical heuristics rather than running a language compiler or AST parser.

For editor use cases requiring compiler-grade semantic highlighting, NSH can be combined with a language server or parser rather than replacing one.

---

# Contributing

Contributions are welcome.

When fixing or adding syntax support:

1. reproduce the syntax case with a minimal example;
2. add a regression test;
3. keep state transitions local and predictable;
4. avoid unnecessary full-line rescanning;
5. preserve existing token semantics;
6. run the complete test suite;
7. run the benchmark smoke test.

For new languages, prefer small lexical states over increasingly complex regular expressions when multiline or contextual syntax requires it.

---

# License

NSH is distributed under the **ISC License**.

See `LICENSE` for details.
