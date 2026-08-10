import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

test("workflow validation ignores generated Lean artifact siblings", () => {
  const result = spawnSync(process.execPath, ["scripts/validate-primitives.js", "workflows/"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.doesNotMatch(result.stdout, /\.lean\.md: name must be lowercase-hyphen/);
});