const fs = require("node:fs");
const path = require("node:path");

const source = path.join(__dirname, "..", "src", "themes");
const destination = path.join(__dirname, "..", "dist", "themes");
fs.mkdirSync(destination, { recursive: true });
for (const file of fs.readdirSync(source)) {
  if (file.endsWith(".css"))
    fs.copyFileSync(path.join(source, file), path.join(destination, file));
}
