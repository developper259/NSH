const { NSHServer } = require("../dist/cjs/server");

const server = new NSHServer();

async function main() {
  try {
    const port = await server.start();
    console.log(`NSH server listening on ws://127.0.0.1:${port}`);
  } catch (error) {
    console.error("Failed to start the NSH server:", error);
    process.exitCode = 1;
  }
}

async function shutdown() {
  await server.stop();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
main();
