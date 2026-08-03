import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const plays = [
  "01-enterprise-rag",
  "02-ai-landing-zone",
  "03-deterministic-agent",
  "04-call-center-voice-ai",
  "05-it-ticket-resolution",
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

test("T231 scope preserves the first five canonical identities", () => {
  const directories = fs.readdirSync(path.join(root, "solution-plays"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^0[1-5]-/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(directories, plays);
});

test("plays 01-05 use factual line-delimited evaluation cases", () => {
  for (const play of plays) {
    const relativePath = `solution-plays/${play}/evaluation/test-set.jsonl`;
    const lines = read(relativePath).split(/\r?\n/).filter((line) => line.trim() !== "");
    assert.ok(lines.length >= 5, `${play} needs at least five factual cases`);
    const cases = lines.map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        assert.fail(`${relativePath}:${index + 1} is not JSONL: ${error.message}`);
      }
    });
    for (const item of cases) {
      assert.equal(typeof item.id, "string", `${play} case id is required`);
      assert.equal(typeof item.category, "string", `${play} case category is required`);
      assert.equal(typeof item.question, "string", `${play} case question is required`);
      assert.equal(typeof item.ground_truth, "string", `${play} case ground_truth is required`);
      assert.doesNotMatch(item.ground_truth, /\b(?:TODO|TBD|placeholder|customer-specific)\b/i, `${play} contains placeholder truth`);
    }
  }
});

test("plays 01-05 declare distinct play-specific evaluation contracts", () => {
  const signatures = new Set();
  for (const play of plays) {
    const spec = JSON.parse(read(`solution-plays/${play}/spec/play-spec.json`));
    assert.ok(spec.evaluation?.metrics?.length >= 3, `${play} needs play-specific metrics`);
    assert.ok(Object.keys(spec.evaluation?.thresholds || {}).length >= 2, `${play} needs explicit target thresholds`);
    signatures.add(JSON.stringify(stable({ metrics: spec.evaluation.metrics, thresholds: spec.evaluation.thresholds })));
  }
  assert.equal(signatures.size, plays.length, "evaluation contracts must not be copied across plays");
});

test("plays 01-05 agent contracts are play-specific and evidence bounded", () => {
  const prohibited = /production agent|production-grade|full FAI Protocol agent specification|builder . reviewer . tuner . production ready|Build success rate \(target: >95%\)/i;
  for (const play of plays) {
    const source = read(`solution-plays/${play}/agent.md`);
    assert.match(source, new RegExp(`plays: \\["${play}"\\]`));
    assert.match(source, /## Current Evidence Boundary/);
    assert.doesNotMatch(source, prohibited, `${play} retains generic production-agent claims`);
  }
});

test("plays 01-05 guardrails distinguish configured intent from evidence", () => {
  const guardrails = Object.fromEntries(plays.map((play) => [
    play,
    JSON.parse(read(`solution-plays/${play}/config/guardrails.json`)),
  ]));
  for (const play of plays) {
    assert.equal(guardrails[play].evidence_boundary?.configuration_status, "designed", `${play} evidence boundary is required`);
    assert.equal(guardrails[play].evidence_boundary?.deployment_evidenced ?? false, false, `${play} must not claim deployment evidence`);
  }
  assert.equal(guardrails["01-enterprise-rag"].evidence_boundary.acl_enforcement_evidenced, false);
  assert.equal(guardrails["02-ai-landing-zone"].network_security.private_endpoints_provisioned_by_current_bicep, false);
  assert.equal(guardrails["02-ai-landing-zone"].governance.policy_assignments_provisioned_by_current_bicep, false);
  assert.equal(guardrails["03-deterministic-agent"].determinism.model_output_deterministic, false);
  assert.equal(guardrails["04-call-center-voice-ai"].evidence_boundary.recording_consent_enforcement_evidenced, false);
  assert.equal(guardrails["05-it-ticket-resolution"].ticket_specific.automatic_actions_enabled, false);
  assert.equal(guardrails["05-it-ticket-resolution"].evidence_boundary.connector_idempotency_evidenced, false);
});

test("audited public docs do not state unverified implemented outcomes", () => {
  const checks = [
    ["01-enterprise-rag", /REST API \+ Streaming|Caching \+ streaming/i],
    ["02-ai-landing-zone", /keeps traffic off the public internet|exposed only via private IPs|ensuring every AI service|all PaaS services accessible only|Policy denies public|PE_AOI\[Private Endpoint/i],
    ["03-deterministic-agent", /deterministic model output|guaranteed identical|100% reproducib/i],
    ["04-call-center-voice-ai", /all streaming in real time|under 2 seconds round-trip|Intent accuracy:.*95%|Resolution rate:.*70%|Streaming pipeline/i],
    ["05-it-ticket-resolution", /Auto-resolution:.*60%|SLA compliance:.*95%|production-grade/i],
  ];
  for (const [play, prohibited] of checks) {
    const docs = `${read(`solution-plays/${play}/README.md`)}\n${read(`solution-plays/${play}/architecture.md`)}`;
    assert.doesNotMatch(docs, prohibited, `${play} retains an unverified outcome claim`);
  }
});

test("pre-commit leaves provenance-bound website generation to clean factory sync", () => {
  const hook = read(".husky/pre-commit");
  assert.doesNotMatch(hook, /^node scripts\/factory\/transform\.js\s*$/m);
  assert.match(hook, /for channel in npm-mcp vscode python-mcp npm-sdk python-sdk/);
  assert.doesNotMatch(hook, /--channel\s+["']?website/);
});
