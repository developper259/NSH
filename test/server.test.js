const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const { WebSocket } = require("ws");
const { NSHServer } = require("../dist/cjs/core/Socket");

test("starts on a dynamic local port and accepts WebSocket connections", async () => {
  const server = new NSHServer();
  try {
    const port = await server.start();
    assert.ok(port > 0);
    assert.equal(server.getPort(), port);

    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    await once(client, "open");
    client.close();
    await once(client, "close");
  } finally {
    await server.stop();
  }
});

test("uses distinct dynamic ports and shares concurrent start", async () => {
  const first = new NSHServer();
  const second = new NSHServer();
  const shared = new NSHServer();
  try {
    const [portA, portB] = await Promise.all([first.start(), second.start()]);
    assert.notEqual(portA, portB);
    const [port1, port2] = await Promise.all([shared.start(), shared.start()]);
    assert.equal(port1, port2);
  } finally {
    await Promise.all([first.stop(), second.stop(), shared.stop()]);
  }
});

test("supports a manual port and rejects an occupied port", async () => {
  const owner = new NSHServer();
  await owner.start();
  const port = owner.getPort();
  const manual = new NSHServer(port);
  try {
    await assert.rejects(() => manual.start(), /EADDRINUSE|address already in use/i);
  } finally {
    await Promise.all([owner.stop(), manual.stop()]);
  }

  const reusable = new NSHServer(port);
  try {
    assert.equal(await reusable.start(), port);
  } finally {
    await reusable.stop();
  }
});

test("double start returns the same port and stop clears it", async () => {
  const server = new NSHServer();
  const port = await server.start();
  assert.equal(await server.start(), port);
  await server.stop();
  assert.equal(server.getPort(), null);
  assert.ok((await server.start()) > 0);
  await server.stop();
});
function createClient(server) {
  const ws = new WebSocket(`ws://127.0.0.1:${server.getPort()}`);
  return ws;
}

function connect(server) {
  const ws = createClient(server);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error("WebSocket connection timed out"));
    }, 5000);
    ws.once("open", () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function request(ws, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Request timeout")), 5000);
    ws.once("message", (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()));
    });
    ws.send(JSON.stringify(payload));
  });
}

test("stop() resolves even when a client stays connected", async () => {
  const server = new NSHServer();
  await server.start();
  const client = await connect(server);
  const closed = once(client, "close");
  await server.stop();
  await closed;
  assert.equal(server.getPort(), null);
});

test("real socket: highlight JavaScript", async () => {
  const server = new NSHServer();
  try {
    await server.start();
    const client = await connect(server);
    const response = await request(client, {
      id: "r1",
      requestType: "highlight",
      language: "javascript",
      code: "const x = 1;",
      responseType: "tokens",
    });
    assert.equal(response.success, true);
    assert.ok(response.tokens.length > 0);
    client.close();
  } finally {
    await server.stop();
  }
});

test("real socket: highlightLine JavaScript", async () => {
  const server = new NSHServer();
  try {
    await server.start();
    const client = await connect(server);
    const response = await request(client, {
      id: "r2",
      requestType: "highlightLine",
      language: "javascript",
      code: "const y = 2;",
      lineIndex: 7,
      responseType: "tokens",
    });
    assert.equal(response.success, true);
    assert.ok(response.tokens.length > 0);
    assert.equal(response.finalState.length, 1);
    client.close();
  } finally {
    await server.stop();
  }
});

test("real socket: supportedLanguages", async () => {
  const server = new NSHServer();
  try {
    await server.start();
    const client = await connect(server);
    const response = await request(client, { id: "r3", requestType: "supportedLanguages" });
    assert.equal(response.success, true);
    assert.ok(response.languages.includes("javascript"));
    assert.ok(response.languages.includes("typescript"));
    client.close();
  } finally {
    await server.stop();
  }
});

test("real socket: detectLanguage", async () => {
  const server = new NSHServer();
  try {
    await server.start();
    const client = await connect(server);
    const response = await request(client, { id: "r4", requestType: "detectLanguage", path: "/src/app.ts" });
    assert.equal(response.success, true);
    assert.equal(response.language, "typescript");
    client.close();
  } finally {
    await server.stop();
  }
});
test("real socket: invalid request returns error with id", async () => {
  const server = new NSHServer();
  try {
    await server.start();
    const client = await connect(server);
    const response = await request(client, { id: "r5", requestType: "highlight", language: "javascript" });
    assert.equal(response.success, false);
    assert.equal(response.id, "r5");
    client.close();
  } finally {
    await server.stop();
  }
});

test("real socket: invalid responseType", async () => {
  const server = new NSHServer();
  try {
    await server.start();
    const client = await connect(server);
    const response = await request(client, {
      id: "r6",
      requestType: "highlight",
      language: "javascript",
      code: "1",
      responseType: "nope",
    });
    assert.equal(response.success, false);
    assert.equal(response.id, "r6");
    client.close();
  } finally {
    await server.stop();
  }
});

test("real socket: invalid lineIndex", async () => {
  const server = new NSHServer();
  try {
    await server.start();
    const client = await connect(server);
    const response = await request(client, {
      id: "r7",
      requestType: "highlightLine",
      language: "javascript",
      code: "1",
      lineIndex: -1,
    });
    assert.equal(response.success, false);
    assert.equal(response.id, "r7");
    client.close();
  } finally {
    await server.stop();
  }
});

test("real socket: invalid document update is contained and the connection survives", async () => {
  const server = new NSHServer();
  try {
    await server.start();
    const client = await connect(server);
    assert.equal((await request(client, {
      id: "open", requestType: "openDocument", documentId: "doc", language: "javascript", code: "const a = 1;",
    })).success, true);
    const invalid = await request(client, {
      id: "bad", requestType: "updateDocument", documentId: "doc", startLine: 999999, deletedLines: 0, insertedLines: ["hello"],
    });
    assert.equal(invalid.success, false);
    assert.equal(invalid.id, "bad");
    const valid = await request(client, {
      id: "good", requestType: "updateDocument", documentId: "doc", startLine: 0, deletedLines: 1, insertedLines: ["const b = 2;"],
    });
    assert.equal(valid.success, true);
    client.close();
  } finally { await server.stop(); }
});

test("real socket: every request type requires an id", async () => {
  const server = new NSHServer();
  try {
    await server.start();
    const client = await connect(server);
    for (const payload of [
      { requestType: "supportedLanguages" },
      { requestType: "detectLanguage", ext: ".js" },
      { requestType: "closeDocument", documentId: "doc" },
      { requestType: "getDocumentLines", documentId: "doc", startLine: 0, endLine: 1 },
    ]) {
      assert.equal((await request(client, payload)).success, false);
    }
    client.close();
  } finally { await server.stop(); }
});

test("real socket: unknown language", async () => {
  const server = new NSHServer();
  try {
    await server.start();
    const client = await connect(server);
    const response = await request(client, {
      id: "r8",
      requestType: "highlight",
      language: "klingon",
      code: "1",
    });
    assert.equal(response.success, false);
    assert.equal(response.id, "r8");
    client.close();
  } finally {
    await server.stop();
  }
});

test("real socket: openDocument / updateDocument / closeDocument", async () => {
  const server = new NSHServer();
  try {
    await server.start();
    const client = await connect(server);
    const open = await request(client, {
      id: "r9",
      requestType: "openDocument",
      documentId: "doc-1",
      language: "javascript",
      code: "const a = 1;\nconst b = 2;\nconst c = 3;",
    });
    assert.equal(open.success, true);

    const update = await request(client, {
      id: "r10",
      requestType: "updateDocument",
      documentId: "doc-1",
      startLine: 1,
      deletedLines: 0,
      insertedLines: ["const x = 99;"],
    });
    assert.equal(update.success, true);
    assert.equal(update.changedStartLine, 1);
    assert.ok(Array.isArray(update.lines));
    assert.ok(update.lines.length >= 1);
    assert.equal(update.lines[0].text, "const x = 99;");

    const close = await request(client, {
      id: "r11",
      requestType: "closeDocument",
      documentId: "doc-1",
    });
    assert.equal(close.success, true);

    const after = await request(client, {
      id: "r12",
      requestType: "updateDocument",
      documentId: "doc-1",
      startLine: 0,
      deletedLines: 0,
      insertedLines: ["a"],
    });
    assert.equal(after.success, false);
    client.close();
  } finally {
    await server.stop();
  }
});

test("documents are removed when the connection closes", async () => {
  const server = new NSHServer();
  try {
    await server.start();
    const client = await connect(server);
    await request(client, {
      id: "r13",
      requestType: "openDocument",
      documentId: "doc-x",
      language: "javascript",
      code: "a",
    });
    assert.equal(server.getDocumentCount(), 1);
    client.close();
    await once(client, "close");
    await waitUntil(() => server.getDocumentCount() === 0);
    assert.equal(server.getDocumentCount(), 0);
  } finally {
    await server.stop();
  }
});

async function waitUntil(predicate, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail("condition was not met before the timeout");
}

function connectionOutcome(url, options) {
  return new Promise((resolve) => {
    const client = new WebSocket(url, options);
    client.once("open", () => {
      client.close();
      resolve("open");
    });
    client.once("unexpected-response", () => resolve("rejected"));
    client.once("error", () => resolve("error"));
  });
}

test("origin policy rejects web origins unless configured", async () => {
  const server = new NSHServer();
  try {
    const port = await server.start();
    const url = `ws://127.0.0.1:${port}`;
    assert.notEqual(await connectionOutcome(url, { origin: "http://evil.example" }), "open");
    assert.equal(await connectionOutcome(url, { origin: "http://localhost:3000" }), "open");
    assert.equal(await connectionOutcome(url), "open");
  } finally {
    await server.stop();
  }
});

test("custom origins and null origins are explicit opt-ins", async () => {
  const custom = new NSHServer({ allowedOrigins: ["https://app.example"] });
  const nullOrigin = new NSHServer({ allowNullOrigin: true });
  try {
    const customPort = await custom.start();
    const customUrl = `ws://127.0.0.1:${customPort}`;
    assert.equal(await connectionOutcome(customUrl, { origin: "https://app.example" }), "open");
    assert.notEqual(await connectionOutcome(customUrl, { origin: "http://localhost:3000" }), "open");

    const nullPort = await nullOrigin.start();
    assert.equal(
      await connectionOutcome(`ws://127.0.0.1:${nullPort}`, { origin: "null" }),
      "open",
    );
  } finally {
    await Promise.all([custom.stop(), nullOrigin.stop()]);
  }
});

test("authentication callback and connection limits are enforced", async () => {
  const server = new NSHServer({
    maxClients: 1,
    authenticate: (request) => request.headers["x-token"] === "secret",
  });
  try {
    const port = await server.start();
    const url = `ws://127.0.0.1:${port}`;
    assert.notEqual(await connectionOutcome(url, { headers: { "x-token": "wrong" } }), "open");
    const client = new WebSocket(url, { headers: { "x-token": "secret" } });
    await once(client, "open");
    assert.notEqual(
      await connectionOutcome(url, { headers: { "x-token": "secret" } }),
      "open",
    );
    client.close();
    await once(client, "close");
  } finally {
    await server.stop();
  }
});

test("requires authentication when binding beyond loopback", () => {
  assert.throws(
    () => new NSHServer({ host: "0.0.0.0" }),
    /authenticate is required/,
  );
});

test("limits documents, request rates and line ranges", async () => {
  const server = new NSHServer({
    maxDocumentsPerClient: 1,
    maxLinesPerRequest: 2,
  });
  try {
    const port = await server.start();
    const client = await connect(server);
    assert.equal(
      (await request(client, {
        id: "open-1",
        requestType: "openDocument",
        documentId: "one",
        language: "javascript",
        code: "a",
      })).success,
      true,
    );
    assert.equal(
      (await request(client, {
        id: "open-2",
        requestType: "openDocument",
        documentId: "two",
        language: "javascript",
        code: "b",
      })).success,
      false,
    );
    const largeRange = await request(client, {
      id: "range",
      requestType: "getDocumentLines",
      documentId: "one",
      startLine: 0,
      endLine: 3,
    });
    assert.equal(largeRange.success, false);
    client.close();
    await once(client, "close");
  } finally {
    await server.stop();
  }
});

test("rate limiting rejects bursts beyond the configured bucket", async () => {
  const server = new NSHServer({
    maxRequestsPerSecond: 1,
    maxRequestBurst: 1,
  });
  try {
    await server.start();
    const client = await connect(server);
    assert.equal(
      (await request(client, { id: "first", requestType: "supportedLanguages" })).success,
      true,
    );
    const limited = await request(client, {
      id: "second",
      requestType: "supportedLanguages",
    });
    assert.equal(limited.success, false);
    assert.match(limited.error, /Rate limit/);
    client.close();
    await once(client, "close");
  } finally {
    await server.stop();
  }
});

test("start and stop racing settles the start promise", async () => {
  const server = new NSHServer();
  const start = server.start();
  const stop = server.stop();
  await assert.rejects(start, /stopped before it started/);
  await stop;
  assert.equal(server.getPort(), null);
});

test("numeric ids are echoed in validation errors", async () => {
  const server = new NSHServer();
  try {
    await server.start();
    const client = await connect(server);
    const response = await request(client, { id: 42, requestType: "supportedLanguages" });
    assert.equal(response.success, false);
    assert.equal(response.id, "42");
    client.close();
    await once(client, "close");
  } finally {
    await server.stop();
  }
});

test("document budgets and truncated update responses are enforced", async () => {
  const server = new NSHServer({
    maxDocumentCharacters: 8,
    maxLinesPerRequest: 2,
  });
  try {
    await server.start();
    const client = await connect(server);
    assert.equal(
      (await request(client, {
        id: "too-large",
        requestType: "openDocument",
        documentId: "large",
        language: "javascript",
        code: "123456789",
      })).success,
      false,
    );
    assert.equal(
      (await request(client, {
        id: "ok",
        requestType: "openDocument",
        documentId: "doc",
        language: "javascript",
        code: "a\nb\nc\nd",
      })).success,
      true,
    );
    const updated = await request(client, {
      id: "state-change",
      requestType: "updateDocument",
      documentId: "doc",
      startLine: 0,
      deletedLines: 1,
      insertedLines: ["/*"],
    });
    assert.equal(updated.success, true);
    assert.equal(updated.linesTruncated, true);
    assert.equal(updated.lines.length, 2);
    client.close();
    await once(client, "close");
  } finally {
    await server.stop();
  }
});

test("server tokenizers honor the configured state depth", async () => {
  const server = new NSHServer({ maxStateDepth: 8 });
  try {
    await server.start();
    const client = await connect(server);
    const code = Array.from({ length: 200 }, () => "{").join("\n");
    assert.equal(
      (await request(client, {
        id: "open",
        requestType: "openDocument",
        documentId: "deep",
        language: "css",
        code,
      })).success,
      true,
    );
    const lines = await request(client, {
      id: "read",
      requestType: "getDocumentLines",
      documentId: "deep",
      startLine: 199,
      endLine: 200,
    });
    assert.equal(lines.success, true);
    assert.ok(lines.lines[0].stateAfter.length <= 8);
    client.close();
    await once(client, "close");
  } finally {
    await server.stop();
  }
});

test("oversized frames are closed by the payload limit", async () => {
  const server = new NSHServer({ maxPayload: 1024 });
  try {
    const port = await server.start();
    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    await once(client, "open");
    const closed = once(client, "close");
    client.send(
      JSON.stringify({
        id: "large",
        requestType: "highlight",
        language: "javascript",
        code: "a".repeat(2048),
      }),
    );
    const [code] = await closed;
    assert.equal(code, 1009);
  } finally {
    await server.stop();
  }
});

test("malformed JSON is rejected without closing the connection", async () => {
  const server = new NSHServer();
  try {
    await server.start();
    const client = await connect(server);
    const response = await new Promise((resolve) => {
      client.once("message", (data) => resolve(JSON.parse(data.toString())));
      client.send("{not-json");
    });
    assert.equal(response.success, false);
    assert.match(response.error, /Invalid JSON/);

    const alive = await request(client, {
      id: "alive",
      requestType: "supportedLanguages",
    });
    assert.equal(alive.success, true);
    client.close();
    await once(client, "close");
  } finally {
    await server.stop();
  }
});

test("documents stay isolated between connections", async () => {
  const server = new NSHServer();
  try {
    await server.start();
    const first = await connect(server);
    const second = await connect(server);
    await request(first, {
      id: "open",
      requestType: "openDocument",
      documentId: "shared-id",
      language: "javascript",
      code: "const x = 1;",
    });
    const response = await request(second, {
      id: "read",
      requestType: "getDocumentLines",
      documentId: "shared-id",
      startLine: 0,
      endLine: 1,
    });
    assert.equal(response.success, false);
    first.close();
    second.close();
    await Promise.all([once(first, "close"), once(second, "close")]);
  } finally {
    await server.stop();
  }
});

test("detectLanguage rejects non-string fields without leaking internals", async () => {
  const server = new NSHServer();
  try {
    await server.start();
    const client = await connect(server);
    const response = await request(client, {
      id: "detect",
      requestType: "detectLanguage",
      path: "/a.ts",
      ext: 123,
    });
    assert.equal(response.success, false);
    assert.match(response.error, /ext must be a string/);
    const line = await request(client, {
      id: "line",
      requestType: "highlightLine",
      language: "javascript",
      code: "x",
      initialState: Array.from({ length: 100 }, () => "root"),
    });
    assert.equal(line.success, false);
    const update = await request(client, {
      id: "update",
      requestType: "openDocument",
      documentId: "doc",
      language: "javascript",
      code: "a",
    });
    assert.equal(update.success, true);
    const invalidUpdate = await request(client, {
      id: "invalid-update",
      requestType: "updateDocument",
      documentId: "doc",
      startLine: 0,
      deletedLines: 1,
      insertedLines: ["a\nb"],
    });
    assert.equal(invalidUpdate.success, false);
    client.close();
    await once(client, "close");
  } finally {
    await server.stop();
  }
});
