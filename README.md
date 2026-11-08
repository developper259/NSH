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
- 🧩 Custom language definitions with validation
- 📝 JSX, TSX and Markdown definitions
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

## Convergence and line-index sensitivity

After an edit, NSH re-tokenizes forward and stops as soon as the cached line state
is provably unchanged:

- the line text is identical;
- the incoming state stack is identical;
- the resulting state stack is identical;
- absolute line indexes are unchanged **when the language depends on them**.

Rule `context` callbacks receive an absolute `lineIndex`. A language declares
`lineIndexSensitive: false` only after verifying that all of its contexts ignore
that argument. When the flag is omitted, NSH assumes sensitivity as soon as any
rule declares a `context`. For sensitive languages (currently CSV), inserting or
deleting lines disables suffix reuse and retokenizes to the end of the document;
replacing lines without shifting indexes still converges normally.

This is a correctness guarantee, not a heuristic: reusing tokens produced with a
different absolute line index would be unsafe for rules such as CSV header
detection.

`updateLines()` validates that `insertedLines` is an array of single-line strings
and reports `retokenizedLines: 0` for no-op or identical replacement edits.

Internally only `stateAfter` is stored per line. `stateBefore` is derived from the
previous line (or `["root"]` for the first line), which avoids duplicating every
state stack while keeping the public `CachedLineState` shape unchanged.

The line array remains contiguous. A local edit that changes states rebuilds the
array of line references in O(N) pointer copies. Measured on the benchmark
environment, this costs roughly 0.5–4 ms at 100,000 lines; an in-place `splice`
implementation was not faster. NSH therefore keeps the simpler structure rather
than introducing a block/chunk tree without a measured benefit.

Token retrieval returns fresh token objects with current line numbers, so
`getTokens()` and `getTokensForLines()` are O(number of returned tokens) and
allocate. For editor refreshes, prefer `getLines()` or a narrow
`getTokensForLines()` range over `getTokens()` on the full document.

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
| JSX        | `.jsx`                                       |
| TSX        | `.tsx`                                       |
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
| CSV        | `.csv`                                       |
| Markdown   | `.md`, `.markdown`                           |
| Bash       | `.sh`, `.bash`, `.zsh`                       |
| SQL        | `.sql`                                       |
| Rust       | `.rs`                                        |
| Go         | `.go`                                        |
| SCSS       | `.scss`                                      |
| Sass       | `.sass`                                      |

> YAML support is currently experimental.

JSX and TSX support tags, attributes, fragments, children, embedded expressions and
nested JavaScript/TypeScript. Angle-bracket syntax remains lexically ambiguous in
some TSX cases (notably generic arrow functions with constraints); NSH uses
heuristics and documents the remaining limits below.

Markdown supports headings, lists, blockquotes, separators, inline markup, links,
images, tables, embedded HTML and fenced code blocks. Fenced code with a recognized
info string is dispatched to an embedded language definition. Supported fence names
include `js`, `ts`, `jsx`, `tsx`, `py`, `html`, `css`, `json`, `yaml`, `sh`, `sql`,
`rust`, `go`, `scss` and `sass`; aliases such as `javascript`, `python`, `bash` and
`rs` also work. Unknown info strings fall back to plain code-block highlighting.
Fences may be opened inside blockquotes and list items; blockquote prefixes are
preserved as tokens while the remaining code is tokenized by the embedded language.

SCSS and indented Sass are supported. Sass is highlighted lexically by line and
indentation; it does not build a structural indentation parser.

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

`LanguageRegistry` also resolves aliases (`js`, `ts`, `py`, `c++`, ...), indexes extensions for lookup, and supports removal.

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
push?: string | StatePushResolver;
pop?: boolean;
popTo?: string;
popPrefix?: string;
context?: (
  line,
  position,
  tokens,
  stateStack,
  lineIndex
) => boolean;
```

This makes it possible to implement multiline constructs and lightweight context-sensitive highlighting without introducing a full parser.

A language also declares whether its contexts depend on the absolute line index:

```ts
interface LanguageDefinition {
  // ...
  lineIndexSensitive?: boolean;
}
```

When omitted, the tokenizer treats the language as line-index sensitive as soon as
one rule declares `context`. Set it to `false` only after auditing every context,
because incremental suffix reuse depends on this declaration.

Context callbacks must be deterministic functions of the line, position, tokens,
state stack and (when declared safe to ignore) the line index. They must not depend
on mutable external state, otherwise incremental convergence cannot be guaranteed.

## Definition validation

The first tokenization compiles and validates the definition. Invalid definitions
throw a `LanguageValidationError` whose message lists the concrete issues:

- missing `root` state;
- non-`RegExp` patterns;
- pushes or `popTo` targets that reference unknown states;
- empty-match rules without `pop`, `popTo` or `popPrefix` (these cannot make
  progress);
- states that are unreachable from `root` when all pushes are static;
- obviously nested quantifiers such as `(a+)+` that can trigger catastrophic
  backtracking;
- unknown initial state names or dynamic push targets at runtime.

An empty-match rule is allowed when it performs a state reduction, which is how
languages implement zero-width state exits. The tokenizer also guarantees progress
when a rule matches zero characters: it either changes state or advances one
character.

Validate a definition explicitly, for example in CI:

```ts
import { validateLanguageDefinition } from "nsh";

const result = validateLanguageDefinition(new MyLanguage());

console.log(result.errors);
console.log(result.warnings);
```

`Tokenizer.getValidationWarnings()` exposes non-blocking warnings. Obvious nested
quantifiers are rejected as errors before tokenization starts. JavaScript cannot
interrupt a synchronous regular expression that is already backtracking, so NSH
does not claim a runtime regex timeout; keep patterns bounded and prefer lexical
states for complex syntax. A true timeout would require running the tokenizer in an
asynchronous Worker/Web Worker. `validate: false` bypasses these checks and should
only be used for audited legacy definitions.

Validation can be disabled for legacy definitions:

```ts
new Tokenizer(language, { validate: false });
```

Rules are filtered by their provable first characters by default. Disable that
filter only when debugging a custom pattern whose first atom is unusual:

```ts
new Tokenizer(language, { firstCharacterFilter: false });
```

Language definitions are treated as immutable after a tokenizer compiles them. If a definition is mutated in place, call `tokenizer.setLanguage(language)` or `tokenizer.clearCache()` before tokenizing again.

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
- browser origins: loopback only (`localhost`, `127.0.0.1`, `::1`)
- missing `Origin`: allowed for native clients
- per-client limits: 64 connections, 32 documents, 1 MiB per document, 4 MiB of documents
- request rate: 120 requests/second with a burst of 240
- line ranges: 5,000 lines per request
- lexical state depth: 64
- heartbeat: every 30 seconds

Documents whose lexical state stack would exceed the configured depth are rejected
with an explicit error instead of being tokenized with a truncated stack.

You can configure and harden it:

```ts
const server = new NSHServer({
  host: "127.0.0.1",
  port: 8080,
  maxPayload: 4 * 1024 * 1024,
  allowedOrigins: ["https://app.example"],
  authenticate: (request) => request.headers["x-token"] === "secret",
  maxClients: 16,
  maxDocumentsPerClient: 8,
  maxDocumentCharacters: 512 * 1024,
  maxRequestsPerSecond: 60,
  maxLinesPerRequest: 2000,
});
```

`authenticate` is required when the server binds to a non-loopback host. Use
`allowNullOrigin: true` only when a trusted `file://` client needs it. The
server also exposes `getConnectionCount()`, `getDocumentCount()` and
`getLastError()` for diagnostics.

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
  validateLanguageDefinition,
  LanguageValidationError,
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
- caches compiled and validated language states;
- avoids forward regex scanning;
- runs context callbacks only after a cheap first-character guard;
- skips rules whose ASCII first character is provably impossible at the current position;
- bounds contextual lookahead (see the limits above);
- skips whitespace runs when no rule can consume them;
- bounds lexical state depth to prevent pathological memory growth;
- carries lexical state between lines.

`IncrementalDocument` additionally stops re-tokenization once the lexical state
converges with the cached document state. Convergence is skipped when absolute
line indexes shift for a line-index-sensitive language, so cached tokens are never
reused across an unsafe index change.

Rule priority is unchanged: rules are still evaluated in declaration order. Rules
whose first consuming atom is a literal, an ASCII character class or a simple
escape are skipped when the current character cannot start them. The derivation is
conservative: groups, top-level alternations, optional leading atoms, Unicode
classes and case-insensitive patterns are always tested. Interleaved measurements
on 10,000-line documents showed roughly 6–50% tokenizer improvement depending on
language and line shape, with larger gains on long single lines. Rules should still
be ordered from most specific to most general.

`TokenizerOptions.firstCharacterFilter` disables this optimization for debugging
custom rules; it should not be needed in normal use.

Run the benchmark suite with:

```bash
npm run benchmark
```

Run the correctness/performance smoke check:

```bash
npm run benchmark:smoke
```

Performance should always be measured on the application and files you intend to highlight.

## Sample run

The following sample was produced by `node --expose-gc benchmark/index.js` with
`NSH_BENCH_SAMPLES=3` and one warmup, on Node v22.12.0, macOS x64, 4 CPUs
(2026-11-08). Numbers are hardware- and content-dependent and are not contractual
thresholds.

Initial tokenization:

| Language   | Lines  | Chars    | Tokens   | Median ms | p95 ms |
| ---------- | ------ | -------- | -------- | --------- | ------ |
| JavaScript | 1,000  | 25,749   | 7,250    | 8.97      | 30.50  |
| JavaScript | 10,000 | 257,499  | 72,500   | 107.17    | 225.01 |
| JavaScript | 50,000 | 1,287,499| 362,500  | 418.81    | 487.27 |
| JavaScript | 100,000| 2,574,999| 725,000  | 818.90    | 1,006.41 |
| TypeScript | 10,000 | 417,499  | 127,500  | 285.88    | 444.85 |
| TypeScript | 100,000| 4,174,999| 1,275,000| 2,433.25  | 3,416.28 |
| Python     | 10,000 | 174,999  | 60,000   | 206.90    | 266.15 |
| HTML       | 10,000 | 279,999  | 75,000   | 79.45     | 112.34 |
| CSS        | 10,000 | 349,999  | 110,000  | 167.35    | 176.45 |
| JSON       | 10,000 | 429,999  | 130,000  | 128.64    | 132.30 |
| Markdown   | 10,000 | 147,499  | 17,500   | 67.33     | 69.53  |
| Bash       | 10,000 | 165,999  | 44,000   | 44.72     | 49.84  |
| SQL        | 10,000 | 223,338  | 56,668   | 88.44     | 90.46  |
| Rust       | 10,000 | 142,499  | 52,500   | 107.45    | 411.40 |
| Go         | 10,000 | 109,999  | 28,000   | 42.44     | 49.94  |
| SCSS       | 10,000 | 141,999  | 38,000   | 69.13     | 71.27  |
| Sass       | 10,000 | 127,999  | 24,000   | 78.80     | 190.06 |

Incremental updates on 100,000-line documents:

| Language   | Edit          | Retokenized lines | Median ms | p95 ms |
| ---------- | ------------- | ----------------- | --------- | ------ |
| JavaScript | middle        | 2                 | 0.99      | 1.04   |
| JavaScript | insert start  | 2                 | 0.95      | 0.99   |
| JavaScript | insert end    | 1                 | 0.98      | 1.87   |
| JavaScript | delete start  | 1                 | 0.93      | 1.11   |
| JavaScript | multiline     | 50,000            | 68.19     | 76.08  |
| TypeScript | middle        | 2                 | 0.99      | 1.13   |
| TypeScript | insert start  | 2                 | 1.01      | 1.05   |
| TypeScript | insert end    | 1                 | 1.43      | 1.77   |
| TypeScript | delete start  | 1                 | 0.92      | 1.20   |
| TypeScript | multiline     | 50,000            | 75.18     | 76.31  |

Reads, HTML and long lines:

| Metric                    | Size                | Median ms | p95 ms |
| ------------------------- | ------------------- | --------- | ------ |
| `getLine`                 | 100,000 lines       | 0.02      | 0.02   |
| `getLines(100)`           | 100,000 lines       | 0.14      | 0.16   |
| `getTokensForLines(100)`  | 100,000 lines       | 0.11      | 0.18   |
| `getTokens()`             | 100,000 lines       | 125.46    | 148.36 |
| `getHTML()`               | 10,000 lines        | 211.01    | 238.97 |
| `highlight()`             | 10,000 lines        | 177.73    | 178.88 |
| `getHTML()`               | 100,000 lines       | 2,070.54  | 2,131.56 |
| TypeScript colons         | 120,000 characters  | 71.81     | 77.56  |
| TypeScript generics       | 272,000 characters  | 101.92    | 107.38 |
| Python annotations        | 96,000 characters   | 73.21     | 76.21  |
| C++ angle brackets        | 105,000 characters  | 250.09    | 309.16 |
| JavaScript symbols        | 500,000 characters  | 283.83    | 284.39 |
| Minified JSON             | 500,000 characters  | 387.34    | 401.91 |
| HTML text                 | 500,000 characters  | 0.46      | 0.53   |

Document construction memory (JavaScript):

| Lines   | Chars     | Tokens  | Heap delta | Bytes/char |
| ------- | --------- | ------- | ---------- | ---------- |
| 10,000  | 257,499   | 72,500  | 8.16 MiB   | 33.21      |
| 50,000  | 1,287,499 | 362,500 | 31.95 MiB  | 26.02      |
| 100,000 | 2,574,999 | 725,000 | 39.09 MiB  | 15.92      |

## Memory retention

An `IncrementalDocument` retains:

- one string per source line;
- its token objects;
- one `stateAfter` stack per line (`stateBefore` is derived);
- the tokenizer's compiled language states.

There is no global document cache. Releasing the document releases its lines,
tokens and states. The optional WebSocket server additionally bounds documents and
characters per client.

Storing `stateBefore` again was removed after measurement: for 100,000 unique
JavaScript lines (2.58M characters, 500,000 tokens), heap usage after GC dropped
from 71.20 MiB to 67.44 MiB (about 5%). Full token retrieval still allocates fresh
token objects so callers cannot mutate the cache.

## HTML generation

`Highlighter.getHTML()` and `highlight()` emit one
`<div class="nsh-line">...</div>` per source line. Line breaks are represented by
those line elements; newline characters are not emitted as text between them.
Spaces, tabs and all other characters inside a line are preserved exactly, and
token values are HTML-escaped.

Generating HTML for an entire document is O(source + tokens) and builds one large
string. For a 100,000-line JavaScript document, the benchmark emits tens of
megabytes of HTML. For editor refreshes, prefer:

- `highlightLine()` / `getHTMLLine()` for visible lines with an externally managed
  state;
- `IncrementalDocument.getLines()` and the semantic tokens for the changed range;
- full-document `getHTML()` only when the consumer actually needs the complete
  string.

The Highlighter is not a document renderer and does not perform syntax-aware range
generation; range HTML is obtained by highlighting the relevant lines.

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

The suite covers tokenizer rules and validation, seeded differential tests that
compare incremental tokenization against a full retokenization across languages,
first-character-filter equivalence tests, long-line regressions, Highlighter
escaping/text preservation, the registry, the WebSocket server, browser bundling
and npm packaging.

Run only the packaging checks:

```bash
npm run test:package
```

Build:

```bash
npm run build
```

Build the ESM wrappers from a clean tree:

```bash
npm run build:esm
```

Start a local WebSocket server:

```bash
NSH_TOKEN=secret NSH_PORT=0 npm start
```

Run benchmarks:

```bash
npm run benchmark
```

The benchmark performs a warmup, repeats measurements, and reports the median and
p95. It covers initial tokenization, incremental edits at several document
positions, token retrieval, HTML generation, long single lines and document
memory. Use these environment variables to change the sampling:

```bash
NSH_BENCH_SAMPLES=5 NSH_BENCH_WARMUP=2 npm run benchmark
```

Memory measurement requires the `--expose-gc` flag, which the npm script already
provides. Run the script directly if you need another invocation:

```bash
node --expose-gc benchmark/index.js
```

Run the benchmark smoke test:

```bash
npm run benchmark:smoke
```

The smoke test checks correctness and reports timings without imposing fixed
performance thresholds.

Run the real-corpus benchmark:

```bash
npm run benchmark:corpus
# NSH_CORPUS_SAMPLES=5 by default; the npm script enables --expose-gc
```

It tokenizes the repository's source, tests, README, theme files and the
`benchmark/corpus` fixtures, and compares each file against
`benchmark/corpus-baseline.json`. Token-count ratios expose structural
regressions deterministically; timing ratios are informational and depend on the
machine. CI runs it as a **non-blocking** step: ratios are reported but never fail
the build. Refresh the baseline explicitly on a representative machine:

```bash
npm run benchmark:corpus:update
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

- ambiguous JavaScript regex literals versus division, especially across line boundaries;
- highly context-sensitive generic/type syntax;
- CSV quoted fields spanning physical lines (tokens are line-based);
- YAML block-scalar indentation beyond the supported heuristic;
- complex nested language grammars;
- advanced YAML indentation semantics;
- some deeply nested TypeScript type constructs;
- JSX/TSX angle-bracket ambiguity between generics, type parameters and tags;
- Markdown headings, blockquotes and table headers are line-level constructs rather than nested inline parses;
- JSX closing tags must terminate on the same physical line;
- Bash/SCSS/Sass/SQL/Rust/Go support is lexical and intentionally does not attempt full language validation;
- Sass indentation is lexically highlighted rather than structurally parsed;
- SQL dialects and Bash grammar variants are approximated.

Generic detection no longer uses fixed character windows. TypeScript, Java and C++
locate the matching `>` through a per-line angle-bracket cache, so long generic
lists are classified without an arbitrary cutoff. Extremely deeply nested
single-line generics still cost more because their matched span is inspected;
ordinary long lines remain linear. JSX/TSX component tags now accept type
arguments such as `<Select<string>>`.

Lexical state depth is bounded by `maxStateDepth` (64 by default). By default, a
push that would exceed the limit throws a `RangeError` instead of silently losing
lexical state. For the legacy capped behavior, opt in explicitly:

```ts
new Tokenizer(language, {
  maxStateDepth: 64,
  onStateDepthExceeded: "truncate",
});
```

Increase `maxStateDepth` when a language legitimately needs a deeper stack.

NSH cannot interrupt a synchronous regular expression that has already entered
catastrophic backtracking. This is a JavaScript runtime limitation: there is no
portable way to abort a blocked native regex call from the same thread. Validation
rejects structural mistakes and reports obvious nested quantifiers as warnings;
authors must keep regexes bounded and prefer lexical states for complex syntax.
An asynchronous Worker/Web Worker tokenizer would be required for a true timeout.

Full-document `getTokens()` and `getHTML()` are O(source + tokens) and allocate
their outputs. For editor refreshes, use line or range APIs instead.

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
