# NSH

NSH (NDL Syntax Highlighter) is a TypeScript syntax-highlighting library for editors and standalone use.

## Install

```sh
npm install nsh
```

The package ships both CommonJS and ESM entry points, including type declarations. The core entry point works in Node, Electron main, Electron renderer, and browser bundlers; the optional Node-only WebSocket server is available from `nsh/server`.

To pin a repository revision while developing NCE, install a commit from GitHub:

```sh
npm install github:developper259/NSH#<commit-sha>
```

Git installs run the `prepare` build lifecycle. Published npm packages and tarballs already contain `dist/`.

## Usage

```ts
import { Highlighter, JavaScript } from "nsh";

const highlighter = new Highlighter(new JavaScript());
const result = highlighter.highlight('const hello = "world";');
console.log(result.tokens, result.html);
```

`Tokenizer.tokenizeLine()` and `Highlighter.highlightLine()` accept a state stack for multiline constructs. `IncrementalDocument` caches line states and retokenizes only until state convergence after line edits.

`IncrementalDocument` also exposes `getLine()`, `getLines(start, end)`, and `getTokensForLines(start, end)` for targeted editor reads. The WebSocket server supports `openDocument`, `updateDocument`, `getDocumentLines`, and `closeDocument`; document sessions are scoped to their connection.

Custom languages can implement `LanguageDefinition`, then be registered with `Highlighter.registerLanguage()` or a `LanguageRegistry`. A token rule may provide its own `className`; semantic `Token.type` is preserved.

Built-in languages: JavaScript, TypeScript, Python, HTML, CSS, JSON, YAML, PHP, Java, XML, and C++. YAML support is experimental and intentionally lexical. JSX/TSX and SCSS/Sass are not advertised until their lexical support is complete.

Themes are copied to `dist/themes/` during build and are available as `nsh/themes/dark.css` and `nsh/themes/light.css`. Theme selectors are scoped by the `nsh-theme-dark` or `nsh-theme-light` class on the generated container, so both CSS files may be loaded together.

## Optional WebSocket server

```js
const { NSHServer } = require("nsh/server");

const server = new NSHServer();
const port = await server.start();
console.log(`ws://127.0.0.1:${port}`);
```

The default port is selected by the operating system and the default host is `127.0.0.1`. A port can be forced with `new NSHServer(8080)` or with `{ port, host, maxPayload }`. `stop()` returns a Promise and `getPort()` returns `null` when the server is not listening.

## Development

```sh
npm run typecheck
npm test
npm run benchmark
npm pack --dry-run
```

The highlighter is lexical, not a compiler or AST parser. Context-sensitive constructs such as JavaScript regular expressions use a small lexical heuristic and may require a real parser for complete language semantics.
