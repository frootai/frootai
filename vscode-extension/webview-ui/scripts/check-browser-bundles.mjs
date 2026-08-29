import fs from "node:fs";
import path from "node:path";

const outputDirectory = path.resolve(import.meta.dirname, "../../out/webview");
const failures = [];
for (const name of ["main.js", "sidebar.js"]) {
  const file = path.join(outputDirectory, name);
  const source = fs.readFileSync(file, "utf8");
  if (/\brequire\s*\(/.test(source)) failures.push(`${name} contains a runtime CommonJS require()`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("[webview] Browser bundles contain no runtime CommonJS require().");