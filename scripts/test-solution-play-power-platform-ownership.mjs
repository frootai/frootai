import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playRoot = path.join(root, "solution-plays", "08-copilot-studio-bot");

function read(relativePath) {
  return fs.readFileSync(path.join(playRoot, relativePath), "utf8");
}

function walkTextFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkTextFiles(entryPath);
    if (!entry.isFile() || entry.name.endsWith(".pyc")) return [];
    return [entryPath];
  });
}

test("T233 removes non-authoritative model and infrastructure assets", () => {
  for (const relativePath of [
    "config/openai.json",
    "config/model-comparison.json",
    "infra/main.bicep",
    "infra/parameters.json",
  ]) {
    assert.equal(fs.existsSync(path.join(playRoot, relativePath)), false, `${relativePath} must be removed`);
  }

  const prohibited = /Azure OpenAI|\bOpenAI\b|\bGPT-?4(?:o|\.1)?\b|text-embedding-3|config\/openai\.json|model-comparison\.json|infra\/main\.bicep|Bicep IaC/i;
  for (const filePath of walkTextFiles(playRoot)) {
    const source = fs.readFileSync(filePath, "utf8");
    assert.doesNotMatch(source, prohibited, path.relative(playRoot, filePath));
  }
});

test("T233 makes the Power Platform solution contract authoritative", () => {
  const spec = JSON.parse(read("spec/play-spec.json"));
  const guardrails = JSON.parse(read("config/guardrails.json"));
  const platform = JSON.parse(read("config/power-platform.json"));

  assert.equal(spec.config.power_platform, "config/power-platform.json");
  assert.equal("openai" in spec.config, false);
  assert.equal(platform.authority.platform, "copilot_studio_power_platform");
  assert.equal(platform.alm.production_artifact, "managed_solution");
  assert.deepEqual(platform.alm.promotion_order, ["development", "test", "production"]);
  assert.equal(platform.controls.dlp.required, true);
  assert.equal(platform.controls.consequential_actions.durable_approval_required, true);
  assert.equal(platform.evidence_boundary.solution_export_available, false);
  assert.equal(platform.evidence_boundary.production_import_evidenced, false);

  assert.equal(guardrails.ownership.authoritative_platform, "copilot_studio_power_platform");
  assert.equal(guardrails.ownership.platform_contract, "config/power-platform.json");
  assert.equal("openai_config_authoritative" in guardrails.ownership, false);
  assert.equal("current_bicep_authoritative_for_bot" in guardrails.ownership, false);
  assert.equal("legacy_artifact_replacement_task" in guardrails.ownership, false);
});

test("T233 removes stale IaC declarations from package metadata and evidence", () => {
  const manifest = JSON.parse(read("spec/fai-manifest.json"));
  const plugin = JSON.parse(read("spec/plugin.json"));
  const evidence = JSON.parse(read("certification/evidence.v1.json"));

  assert.equal("bicep" in (manifest.infrastructure || {}), false);
  assert.equal("template" in (manifest.infrastructure || {}), false);
  assert.equal("infra" in plugin, false);
  assert.doesNotMatch(JSON.stringify(evidence), /infra\/main\.bicep|bicep/i);

  for (const group of ["agents", "instructions", "skills"]) {
    for (const reference of manifest.primitives[group]) {
      assert.equal(fs.existsSync(path.resolve(playRoot, reference)), true, `${group}: ${reference}`);
    }
  }
  assert.equal(fs.existsSync(path.resolve(playRoot, manifest.platform.contract)), true);
});

test("T233 historical evidence validates but cannot promote current source", () => {
  const evidence = JSON.parse(read("certification/evidence.v1.json"));
  const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas", "solution-play-certification-evidence.v1.schema.json"), "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);

  assert.equal(ajv.validate(schema, evidence), true, JSON.stringify(ajv.errors));
  assert.equal(evidence.subject.iac_sha256, null);
  assert.equal(evidence.stages.designed.status, "unavailable");
  assert.equal(evidence.integrity.historical_subject_only, true);
  assert.equal(evidence.integrity.current_source_covered, false);
  assert.equal(evidence.integrity.promotion_allowed, false);
});

test("T233 public portfolio status does not exceed Play 08 evidence", () => {
  const portfolio = fs.readFileSync(path.join(root, "solution-plays", "README.md"), "utf8");
  const row = portfolio.split(/\r?\n/).find((line) => /^\| 08 \|/.test(line));
  assert.ok(row, "Play 08 portfolio row is required");
  assert.match(row, /\| Designed \|/);
  assert.doesNotMatch(row, /Ready|Verified|Operated|Production/i);
});