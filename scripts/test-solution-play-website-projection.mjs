import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { buildSolutionPlayProjection, renderSolutionPlayProjection } = require("./factory/adapters/website.js");
const index = JSON.parse(fs.readFileSync(path.join(root, "orchard", "registry", "solution-play-index.json"), "utf8"));

test("generates a deterministic typed projection for all 101 canonical identities", () => {
  const first = buildSolutionPlayProjection(structuredClone(index));
  const second = buildSolutionPlayProjection(structuredClone(index));
  assert.deepEqual(first, second);
  assert.equal(first.count, 101);
  assert.equal(new Set(first.plays.map((play) => play.id)).size, 101);
  assert.equal(new Set(first.plays.map((play) => play.slug)).size, 101);
  assert.deepEqual(first.plays.map((play) => play.slug), index.plays.map((play) => play.slug));
  assert.deepEqual(first.plays.map((play) => play.description), index.plays.map((play) => play.description));
});

test("projection contains only source-backed content and deterministic presentation fields", () => {
  const projection = buildSolutionPlayProjection(structuredClone(index));
  const allowed = ["category", "description", "detailUrl", "githubUrl", "icon", "id", "name", "numericId", "slug", "specVersion"];
  for (const play of projection.plays) assert.deepEqual(Object.keys(play).sort(), allowed);
  assert.equal("status" in projection.plays[0], false);
  assert.equal("infrastructure" in projection.plays[0], false);
  assert.equal("tuning" in projection.plays[0], false);
  assert.match(renderSolutionPlayProjection(projection), /as const satisfies/);
  assert.equal(projection.plays.find((play) => play.id === "48").category, "mlops");
  for (const play of projection.plays) assert.doesNotMatch(play.description, /actual costs vary|^\s*>|production[- ](?:ready|grade)|enterprise[- ]grade|compliance[- ]ready|\bcompliant\b|guarantees?|satisfying|sub-?\d+\s*ms|\d+\s*%/i);
});

test("fails closed on count, identity, duplicate, and link drift", () => {
  const missing = structuredClone(index);
  missing.plays.pop();
  assert.throws(() => buildSolutionPlayProjection(missing), /exactly 101/);

  const duplicate = structuredClone(index);
  duplicate.plays[1].id = duplicate.plays[0].id;
  assert.throws(() => buildSolutionPlayProjection(duplicate), /identity|Duplicate/);

  const link = structuredClone(index);
  link.plays[0].github_url = "https://example.invalid/play";
  assert.throws(() => buildSolutionPlayProjection(link), /links do not match/);

  const claim = structuredClone(index);
  claim.plays[0].description = "Production-grade architecture.";
  assert.throws(() => buildSolutionPlayProjection(claim), /unsupported public claims/);
});

test("rendered TypeScript is stable and excludes unsupported readiness claims", () => {
  const source = renderSolutionPlayProjection(buildSolutionPlayProjection(structuredClone(index)));
  assert.equal(source, renderSolutionPlayProjection(buildSolutionPlayProjection(structuredClone(index))));
  assert.equal(source.includes('status: "Ready"'), false);
  assert.doesNotMatch(source, /production[- ](?:ready|grade)/i);
  assert.match(source, /export const solutionPlays = solutionPlayProjection\.plays/);
});