const { NSHServer } = require("../dist/cjs/server");

const port = process.env.NSH_PORT ? Number(process.env.NSH_PORT) : 0;
const host = process.env.NSH_HOST ?? "127.0.0.1";
const token = process.env.NSH_TOKEN;

const server = new NSHServer({
  host,
  port,
  authenticate: token
    ? (request) => request.headers["authorization"] === `Bearer ${token}`
    : undefined,
});

server
  .start()
  .then((startedPort) => {
    console.log(`NSH server listening on ws://${host}:${startedPort}`);
  })
  .catch((error) => {
    console.error("Failed to start the NSH server:", error.message);
    process.exitCode = 1;
  });

const shutdown = () => {
  server.stop().finally(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
