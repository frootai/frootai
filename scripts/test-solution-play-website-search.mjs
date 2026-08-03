import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { buildSearchIndex, finalizeSearchIndex, validateSearchIndex } = require("./factory/adapters/website.js");
const catalog = JSON.parse(fs.readFileSync(path.join(root, ".factory", "fai-catalog.json"), "utf8"));

test("deterministic search generation includes all canonical plays and guides", () => {
  const first = buildSearchIndex(structuredClone(catalog));
  const second = buildSearchIndex(structuredClone(catalog));
  assert.deepEqual(first, second);
  const reversed = structuredClone(catalog);
  for (const key of ["agents", "instructions", "skills", "hooks", "plugins", "workflows", "cookbook", "mcpTools"]) if (Array.isArray(reversed[key])) reversed[key].reverse();
  assert.deepEqual(buildSearchIndex(reversed), first);
  assert.deepEqual(validateSearchIndex(first), { valid: true, count: first.length });
  assert.equal(first.filter((entry) => entry.type === "play").length, 101);
  assert.equal(first.filter((entry) => entry.type === "user-guide").length, 101);
  assert.equal(new Set(first.filter((entry) => entry.type === "play").map((entry) => entry.u)).size, 101);
  assert.ok(first.filter((entry) => entry.type === "user-guide").every((entry) => /^\/solution-plays\/\d{2,3}-[a-z0-9-]+#user-guide$/.test(entry.u)));
  assert.ok(first.filter((entry) => entry.type === "play-category").length >= 20);
  const cookbookIds = new Set(catalog.cookbook.map((item) => item.id));
  const canonicalRecipeCount = catalog.cookbook.filter((item) => !item.id.endsWith(".lean") || !cookbookIds.has(item.id.slice(0, -5))).length;
  assert.equal(first.filter((entry) => entry.type === "recipe").length, canonicalRecipeCount);
});

test("play search entries use safe T227 descriptions rather than detail-page claims", () => {
  const entries = buildSearchIndex(structuredClone(catalog)).filter((entry) => ["play", "user-guide", "play-category"].includes(entry.type));
  for (const entry of entries) {
    assert.doesNotMatch(entry.b, /actual costs vary|production[- ](?:ready|grade)|enterprise[- ]grade|compliance[- ]ready|\bcompliant\b|guarantees?|satisfying|sub-?\d+\s*ms|\d+\s*%/i);
    assert.ok(entry.b.length <= 400);
  }
  assert.match(entries.find((entry) => entry.u === "/solution-plays/101-pester-test-development").b, /Pester Test Development/);
});

test("finalization sorts, coalesces exact duplicates, and rejects conflicting content", () => {
  const entries = [
    { t: "Beta", u: "/beta", b: "short", type: "page" },
    { t: "Alpha", u: "/alpha", b: "alpha", type: "page" },
    { t: "Beta", u: "/beta", b: "short", type: "page" },
  ];
  assert.deepEqual(finalizeSearchIndex(entries), [
    { t: "Alpha", u: "/alpha", b: "alpha", type: "page" },
    { t: "Beta", u: "/beta", b: "short", type: "page" },
  ]);
  assert.throws(() => finalizeSearchIndex([
    { t: "Same", u: "/same", b: "one", type: "page" },
    { t: "Same", u: "/same", b: "two", type: "page" },
  ]), /Conflicting duplicate/);
  assert.throws(() => finalizeSearchIndex([
    { t: "Same", u: "/same", b: "", type: "page" },
    { t: "Same", u: "/same", b: "different", type: "page" },
  ]), /Conflicting duplicate/);
});

test("validation rejects unknown fields, external paths, controls, oversize, and duplicate identities", () => {
  assert.throws(() => validateSearchIndex([{ t: "Bad", u: "https://example.invalid", b: "", type: "page" }]), /URL/);
  assert.throws(() => validateSearchIndex([{ t: "Bad", u: "/\\evil.example", b: "", type: "page" }]), /URL/);
  assert.throws(() => validateSearchIndex([{ t: "Bad", u: "/%2fevil.example", b: "", type: "page" }]), /URL/);
  assert.throws(() => validateSearchIndex([{ t: "Bad", u: "/ok", b: "", type: "page", extra: true }]), /unknown field/);
  assert.throws(() => validateSearchIndex([{ t: "Bad\u0000", u: "/ok", b: "", type: "page" }]), /control/);
  assert.throws(() => validateSearchIndex([{ t: "Bad", u: "/ok", b: "x".repeat(401), type: "page" }]), /body/);
  assert.throws(() => validateSearchIndex([
    { t: "Same", u: "/same", b: "one", type: "page" },
    { t: "Same", u: "/same", b: "two", type: "page" },
  ]), /Duplicate/);
});