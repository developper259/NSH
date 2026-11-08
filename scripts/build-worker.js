const path = require("node:path");
const esbuild = require("esbuild");

const root = path.join(__dirname, "..");

esbuild.buildSync({
  entryPoints: [path.join(root, "src", "workerRuntime.ts")],
  outfile: path.join(root, "dist", "cjs", "workerRuntime.js"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  sourcemap: false,
  logLevel: "warning",
});
