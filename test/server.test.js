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
    await assert.rejects(() => manual.start());
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
  return new Promise((resolve) => {
    ws.on("open", () => resolve(ws));
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
  await server.stop();
  assert.equal(server.getPort(), null);
  client.terminate();
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
    client.close();
    await once(client, "close");
    assert.equal(server.documentsSize(), 0);
  } finally {
    await server.stop();
  }
});
