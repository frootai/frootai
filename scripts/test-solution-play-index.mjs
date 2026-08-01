import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { buildSolutionPlayIndex, normalizeNewlines } from "./build-solution-play-index.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = path.join(repoRoot, "orchard", "registry", "solution-play-index.json");
const schemaPath = path.join(repoRoot, "orchard", "schema", "solution-play-index.schema.json");
const examplePath = path.join(repoRoot, "orchard", "examples", "solution-play-index.example.json");
const playsReadmePath = path.join(repoRoot, "solution-plays", "README.md");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const schema = readJson(schemaPath);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

test("canonical Solution Play index is deterministic and current", () => {
  const generated = buildSolutionPlayIndex(repoRoot);
  const committed = readJson(indexPath);
  assert.deepEqual(committed, generated);
  assert.equal(committed.count, 101);
  assert.equal(committed.plays.length, 101);
});

test("canonical index and public example validate against the schema", () => {
  for (const [label, document] of [["index", readJson(indexPath)], ["example", readJson(examplePath)]]) {
    assert.equal(validate(document), true, `${label}: ${ajv.errorsText(validate.errors)}`);
    assert.equal(document.count, document.plays.length);
  }
});

test("all IDs 01-101 occur exactly once in numeric order", () => {
  const index = readJson(indexPath);
  const expected = Array.from({ length: 101 }, (_, offset) => String(offset + 1).padStart(2, "0"));
  assert.deepEqual(index.plays.map((play) => play.id), expected);
  assert.equal(new Set(index.plays.map((play) => play.slug)).size, 101);
});

test("every canonical path, README, and spec exists", () => {
  const index = readJson(indexPath);
  for (const play of index.plays) {
    for (const relativePath of [play.relative_path, play.readme_path, play.spec_path]) {
      assert.equal(fs.existsSync(path.join(repoRoot, relativePath)), true, `${play.id}: ${relativePath}`);
    }
    assert.equal(play.slug.startsWith(`${play.id}-`), true, play.slug);
    assert.equal(play.github_url.endsWith(`/solution-plays/${play.slug}`), true, play.github_url);
    assert.equal(play.detail_url.endsWith(`/solution-plays/${play.slug}`), true, play.detail_url);
  }
});

test("generator check mode has no timestamp or machine-specific fields", () => {
  const serialized = fs.readFileSync(indexPath, "utf8");
  assert.equal(serialized.includes("generated_at"), false);
  assert.equal(serialized.includes(repoRoot), false);
});

test("generator check mode treats CRLF and LF output as equivalent", () => {
  assert.equal(normalizeNewlines("{\r\n  \"count\": 101\r\n}\r\n"), "{\n  \"count\": 101\n}\n");
});

test("public Solution Plays README names the complete 101-play inventory", () => {
  const readme = fs.readFileSync(playsReadmePath, "utf8");
  assert.match(readme, /\*\*101 solution plays\./);
  assert.match(readme, /solution-play-index\.json/);
  assert.doesNotMatch(readme, /\*\*50 solution plays\./);
});
