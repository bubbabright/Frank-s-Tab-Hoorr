import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
);
const extension = path.join(root, "extension");
const files = [];

function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(file);
    else if (
      entry.isFile() &&
      file.endsWith(".js") &&
      !file.endsWith(".min.js")
    ) {
      files.push(file);
    }
  }
}

collect(extension);
for (const file of files.sort())
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
console.log(`Checked syntax for ${files.length} JavaScript files`);
