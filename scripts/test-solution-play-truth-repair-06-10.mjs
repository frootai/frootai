import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const plays = [
  "06-document-intelligence",
  "07-multi-agent-service",
  "08-copilot-studio-bot",
  "09-ai-search-portal",
  "10-content-moderation",
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

test("T232 scope preserves canonical identities 06-10", () => {
  const directories = fs.readdirSync(path.join(root, "solution-plays"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^(0[6-9]|10)-/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(directories, plays);
});

test("plays 06-10 use factual line-delimited evaluation cases", () => {
  for (const play of plays) {
    const relativePath = `solution-plays/${play}/evaluation/test-set.jsonl`;
    const lines = read(relativePath).split(/\r?\n/).filter((line) => line.trim() !== "");
    assert.ok(lines.length >= 5, `${play} needs at least five factual cases`);
    for (const [index, line] of lines.entries()) {
      let item;
      try {
        item = JSON.parse(line);
      } catch (error) {
        assert.fail(`${relativePath}:${index + 1} is not JSONL: ${error.message}`);
      }
      assert.equal(typeof item.id, "string");
      assert.equal(typeof item.category, "string");
      assert.equal(typeof item.question, "string");
      assert.equal(typeof item.ground_truth, "string");
      assert.doesNotMatch(item.ground_truth, /\b(?:TODO|TBD|placeholder|customer-specific)\b/i, `${play} contains placeholder truth`);
    }
  }
});

test("plays 06-10 declare distinct domain evaluation contracts", () => {
  const signatures = new Set();
  for (const play of plays) {
    const spec = JSON.parse(read(`solution-plays/${play}/spec/play-spec.json`));
    assert.ok(spec.evaluation?.metrics?.length >= 3, `${play} needs domain metrics`);
    assert.ok(Object.keys(spec.evaluation?.thresholds || {}).length >= 2, `${play} needs zero-tolerance control thresholds`);
    signatures.add(JSON.stringify(stable({ metrics: spec.evaluation.metrics, thresholds: spec.evaluation.thresholds })));
  }
  assert.equal(signatures.size, plays.length, "evaluation contracts must not be copied across plays");
});

test("plays 06-10 root agents are domain-specific and evidence bounded", () => {
  const prohibited = /production agent|production-grade|full FAI Protocol agent specification|Build success rate \(target: >95%\)/i;
  for (const play of plays) {
    const source = read(`solution-plays/${play}/agent.md`);
    assert.match(source, new RegExp(`plays: \\["${play}"\\]`));
    assert.match(source, /## Current Evidence Boundary/);
    assert.doesNotMatch(source, prohibited, `${play} retains generic production-agent claims`);
  }
});

test("plays 06-10 guardrails expose current evidence and ownership boundaries", () => {
  const guardrails = Object.fromEntries(plays.map((play) => [play, JSON.parse(read(`solution-plays/${play}/config/guardrails.json`))]));
  for (const play of plays) {
    assert.equal(guardrails[play].evidence_boundary?.configuration_status, "designed", `${play} evidence boundary is required`);
    assert.equal(guardrails[play].evidence_boundary?.deployment_evidenced ?? false, false, `${play} must not claim deployment evidence`);
  }
  assert.equal(guardrails["06-document-intelligence"].evidence_boundary.field_provenance_evidenced, false);
  assert.equal(guardrails["07-multi-agent-service"].evidence_boundary.typed_handoffs_evidenced, false);
  assert.equal(guardrails["08-copilot-studio-bot"].ownership.openai_config_authoritative, false);
  assert.equal(guardrails["09-ai-search-portal"].evidence_boundary.acl_trimming_evidenced, false);
  assert.equal(guardrails["10-content-moderation"].ownership.openai_config_authoritative, false);
});

test("T232 infrastructure boundaries match actual declarations", () => {
  const play06 = read("solution-plays/06-document-intelligence/infra/main.bicep");
  const play08 = read("solution-plays/08-copilot-studio-bot/infra/main.bicep");
  const play09 = read("solution-plays/09-ai-search-portal/infra/main.bicep");
  const play10 = read("solution-plays/10-content-moderation/infra/main.bicep");
  assert.doesNotMatch(play06, /kind:\s*['"](?:FormRecognizer|DocumentIntelligence)['"]/i);
  assert.doesNotMatch(play09, /Microsoft\.Search\/searchServices/);
  assert.match(play08, /Legacy non-authoritative infrastructure[\s\S]*T233 owns replacement or removal/);
  assert.match(play10, /Legacy non-authoritative infrastructure[\s\S]*T234 owns replacement/);
});

test("audited public docs do not state unverified outcomes or ownership", () => {
  const checks = [
    ["06-document-intelligence", /Field extraction:.*95%|PII recall:.*99%|Form Recognizer|production-grade/i],
    ["07-multi-agent-service", /Task completion:.*90%|Cost per task:.*0\.50|Built on Container Apps with Dapr|Dapr ACLs/i],
    ["08-copilot-studio-bot", /Topic trigger accuracy:.*90%|Resolution rate:.*65%|CSAT:.*4\.0|Deploys to Teams|Azure OpenAI \(via Studio\)/i],
    ["09-ai-search-portal", /NDCG@10:.*0\.7|Zero-result rate:.*5%|Query latency p95:.*500ms|accessible only via VNet|Every query logged/i],
    ["10-content-moderation", /True positive rate:.*95%|False positive rate:.*5%|Moderation latency:.*200ms|Prompt Shields check|Every AI response passes/i],
  ];
  for (const [play, prohibited] of checks) {
    const docs = `${read(`solution-plays/${play}/README.md`)}\n${read(`solution-plays/${play}/architecture.md`)}`;
    assert.doesNotMatch(docs, prohibited, `${play} retains an unverified claim`);
  }
});
