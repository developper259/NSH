const { NSHServer } = require("../dist/cjs/core/Socket");

const nsh = new NSHServer();

async function main() {
  try {
    const port = await nsh.start();
    console.log(`NSH lancé sur le port dynamique : ${port}`);
    console.log(`URL : ws://127.0.0.1:${port}`);
  } catch (error) {
    console.error("Impossible de démarrer NSH :", error);
    process.exitCode = 1;
  }
}

async function shutdown() {
  await nsh.stop();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
main();
