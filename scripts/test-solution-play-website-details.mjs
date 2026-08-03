import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { buildSolutionPlayDetails, renderSolutionPlayDetails, validateSolutionPlayDetail } = require("./factory/adapters/website.js");
const index = JSON.parse(fs.readFileSync(path.join(root, "orchard", "registry", "solution-play-index.json"), "utf8"));
const catalog = JSON.parse(fs.readFileSync(path.join(root, ".factory", "fai-catalog.json"), "utf8"));

test("generates exactly 101 compact details and five bounded runtime summaries", () => {
  const data = buildSolutionPlayDetails(structuredClone(index), structuredClone(catalog));
  assert.equal(data.count, 101);
  assert.equal(data.runtimeContractCount, 5);
  assert.equal(data.details.filter((detail) => detail.runtime !== null).length, 5);
  assert.deepEqual(data.details.filter((detail) => detail.runtime !== null).map((detail) => [detail.slug, detail.runtime.scenarioId]), [
    ["01-enterprise-rag", "rag.query"],
    ["03-deterministic-agent", "deterministic.execute"],
    ["06-document-intelligence", "document.process"],
    ["07-multi-agent-service", "agents.execute"],
    ["33-voice-ai-agent", "voice.simulate-turn"],
  ]);
  assert.deepEqual(data.details.map((detail) => detail.slug), index.plays.map((play) => play.slug));
  for (const detail of data.details) assert.equal(validateSolutionPlayDetail(detail), true);
});

test("details expose source inventory without README, cost, readiness, or service claims", () => {
  const data = buildSolutionPlayDetails(structuredClone(index), structuredClone(catalog));
  const source = renderSolutionPlayDetails(data);
  assert.doesNotMatch(source, /costDev|costProd|production[- ](?:ready|grade)|tuningParams|services:/i);
  assert.ok(Buffer.byteLength(source, "utf8") < 100000);
  const runtime = data.details.find((detail) => detail.slug === "01-enterprise-rag").runtime;
  assert.equal(runtime.scenarioId, "rag.query");
  assert.deepEqual(runtime.inputSchema.required, ["question"]);
  assert.deepEqual(runtime.outputSchema.required, ["answer", "citations", "grounded"]);
  assert.ok(runtime.requiredResourceTypes.includes("Microsoft.Search/searchServices"));
  assert.deepEqual(runtime.requiredResourceKinds, {});
  assert.equal(data.details.find((detail) => detail.slug === "01-enterprise-rag").guardrails.groundedness, 0.95);
  assert.equal(data.details.find((detail) => detail.slug === "05-it-ticket-resolution").runtime, null);
});

test("detail generation is invariant to catalog order and fails on drift", () => {
  const first = buildSolutionPlayDetails(structuredClone(index), structuredClone(catalog));
  const reversed = structuredClone(catalog);
  reversed.plays.reverse();
  assert.deepEqual(buildSolutionPlayDetails(structuredClone(index), reversed), first);
  const missing = structuredClone(catalog);
  missing.plays.pop();
  assert.throws(() => buildSolutionPlayDetails(structuredClone(index), missing), /missing/);
  const traversal = structuredClone(index);
  traversal.plays[0].slug = "01-safe/../../../outside";
  traversal.plays[0].github_url = `https://github.com/frootai/frootai/tree/main/solution-plays/${traversal.plays[0].slug}`;
  traversal.plays[0].detail_url = `https://frootai.dev/solution-plays/${traversal.plays[0].slug}`;
  assert.throws(() => buildSolutionPlayDetails(traversal, structuredClone(catalog)), /slug|escapes/);
});

test("detail validator rejects oversized and prohibited content", () => {
  const detail = buildSolutionPlayDetails(structuredClone(index), structuredClone(catalog)).details[0];
  assert.throws(() => validateSolutionPlayDetail({ ...detail, description: "Production-ready system" }), /prohibited/);
  assert.throws(() => validateSolutionPlayDetail({ ...detail, status: "Ready" }), /prohibited field/);
  assert.throws(() => validateSolutionPlayDetail({ ...detail, architecturePattern: "bad pattern" }), /architecture/);
});