const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const { WebSocket } = require("ws");
const { NSHServer } = require("../dist/core/Socket");

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
