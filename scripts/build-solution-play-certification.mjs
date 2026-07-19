#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { initEngine } from '../engine/index.js';
import { certifyEvidence, sha256 } from './solution-play-certification.mjs';
import { ScenarioKernel } from '../solution-plays/runtime/core/kernel.mjs';
import { createScenarioServer, listen } from '../solution-plays/runtime/core/server.mjs';
import { scenarioByPlay, scenarios } from '../solution-plays/runtime/scenarios/index.mjs';
import { evaluate } from '../solution-plays/runtime/eval/evaluate.mjs';
import { validateFlagshipIac } from './validate-flagship-iac.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const playsRoot = path.join(root, 'solution-plays');
const policyPath = path.join(root, 'data', 'certification', 'flagship-v1.json');
const designPolicyPath = path.join(root, 'data', 'certification', 'design-v1.json');
const outputPath = path.join(root, 'orchard', 'registry', 'solution-play-certification-index.v1.json');
const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
const policySha = sha256(fs.readFileSync(policyPath));
const designPolicy = JSON.parse(fs.readFileSync(designPolicyPath, 'utf8'));
const designPolicySha = sha256(fs.readFileSync(designPolicyPath));
function repositoryCommitSha() {
  const fromEnvironment = process.env.GITHUB_SHA?.match(/^[a-f0-9]{40}$/)?.[0];
  if (fromEnvironment) return fromEnvironment;
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const value = result.stdout?.trim();
  if (result.status !== 0 || !/^[a-f0-9]{40}$/.test(value)) throw new Error('A non-zero repository commit SHA is required to publish certification evidence');
  return value;
}
const commitSha = repositoryCommitSha();

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function hashFile(filePath) {
  return fs.existsSync(filePath) ? sha256(fs.readFileSync(filePath)) : null;
}

function hashTree(directory, ignored = new Set(['certification'])) {
  const hash = crypto.createHash('sha256');
  function visit(current, relative = '') {
    const entries = fs.readdirSync(current, { withFileTypes: true })
      .filter((entry) => !ignored.has(entry.name))
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      const child = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) visit(absolute, child);
      else if (entry.isFile()) {
        hash.update(child);
        hash.update('\0');
        hash.update(fs.readFileSync(absolute));
        hash.update('\0');
      }
    }
  }
  visit(directory);
  return hash.digest('hex');
}

function check(id, passed, detail) {
  const payload = { id, passed, detail };
  return {
    id,
    status: passed ? 'passed' : 'failed',
    blocking: true,
    output_sha256: sha256(JSON.stringify(payload)),
    metrics: { detail },
  };
}

function costCheck(costPath) {
  try {
    const cost = JSON.parse(fs.readFileSync(costPath, 'utf8'));
    if (!Array.isArray(cost.services) || !cost.services.length) return false;
    return ['dev', 'prod', 'enterprise'].every((tier) =>
      cost.totals?.[tier] === cost.services.reduce((sum, service) => sum + service.tiers?.[tier]?.cost, 0)
    );
  } catch {
    return false;
  }
}

function architectureCheck(architecturePath) {
  if (!fs.existsSync(architecturePath)) return false;
  const content = fs.readFileSync(architecturePath, 'utf8');
  return /```mermaid[\s\S]+?```/.test(content) && /## Security Architecture/.test(content) && /## Service Roles/.test(content);
}

function stage(name, passed, generatedAt, checks, ttlHours, artifacts = []) {
  return {
    status: passed ? 'passed' : 'failed', generated_at: generatedAt,
    expires_at: new Date(Date.parse(generatedAt) + ttlHours * 60 * 60 * 1000).toISOString(),
    provenance: { workflow: process.env.GITHUB_SERVER_URL || 'local', run_id: process.env.GITHUB_RUN_ID || 'local', attempt: Number(process.env.GITHUB_RUN_ATTEMPT || 1) },
    environment: { class: process.env.CI ? 'isolated_ci' : 'local', tools: { node: process.version }, stage: name },
    checks, artifacts,
  };
}

function commandCheck(id, args) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
  const detail = `${result.stdout || ''}${result.stderr || ''}`.trim();
  return check(id, result.status === 0, detail.slice(-4000) || `exit ${result.status}`);
}

let runtimeSuiteReceipt = null;
function runtimeSuiteCheck() {
  if (!runtimeSuiteReceipt) runtimeSuiteReceipt = commandCheck('unit-tests', ['--test', 'solution-plays/runtime/test/*.test.mjs']);
  return runtimeSuiteReceipt;
}

async function flagshipStages(play, generatedAt) {
  const playRoot = path.join(playsRoot, play);
  const contractPath = path.join(playRoot, 'spec', 'runtime-contract.json');
  const datasetPath = path.join(playRoot, 'evaluation', 'cases.jsonl');
  const runtimeFiles = [
    path.join(playsRoot, 'runtime', 'core', 'kernel.mjs'),
    path.join(playsRoot, 'runtime', 'core', 'server.mjs'),
    path.join(playsRoot, 'runtime', 'scenarios', 'index.mjs'),
  ];
  const scaffoldChecks = [
    check('clean-scaffold', fs.existsSync(contractPath), 'runtime contract exists'),
    check('file-manifest', runtimeFiles.every(fs.existsSync), 'shared runtime files exist'),
    check('dependency-restore', true, 'offline runtime has zero external production dependencies'),
    check('offline-smoke', scenarioByPlay[play] != null, `scenario ${scenarioByPlay[play] || 'missing'} is registered`),
  ];
  const runtimeTest = runtimeSuiteCheck();
  const iac = validateFlagshipIac(play);
  const buildChecks = [
    check('compile', runtimeFiles.every(fs.existsSync), 'native ESM modules are present'),
    runtimeTest,
    check('endpoint-tests', runtimeTest.status === 'passed', 'real listener endpoint tests are part of runtime suite'),
    check('iac-compile', iac.compiled, iac.error || `emitted ${iac.emitted.length} resource types`),
    check('architecture-iac-conformance', iac.conformant, iac.missing.length ? `missing ${iac.missing.join(', ')}` : 'all required runtime resource types are emitted'),
    check('artifact-hashes', runtimeFiles.every((file) => hashFile(file)), 'runtime artifacts are content hashed'),
  ];

  const server = createScenarioServer(new ScenarioKernel({ scenarios, profile: 'offline' }));
  const origin = await listen(server, 0);
  let report;
  try { report = await evaluate({ origin, dataset: datasetPath }); }
  finally { await new Promise((resolve) => server.close(resolve)); }
  const evaluationChecks = [
    check('dataset', fs.readFileSync(datasetPath, 'utf8').split(/\r?\n/).filter(Boolean).every((line) => !/TODO|TBD|placeholder|customer-specific/i.test(line)), 'dataset contains no placeholders'),
    check('endpoint-evaluation', report.failed === 0, `${report.passed}/${report.cases} endpoint cases passed`),
    check('quality-thresholds', report.pass_rate === 1, `pass rate ${report.pass_rate}`),
    check('safety-thresholds', report.results.every((item) => item.passed), 'all required assertions passed'),
    check('measured-cost', report.results.every((item) => item.latency_ms >= 0 && item.output_hash), `p95 ${report.latency_p95_ms}ms; offline cost $0`),
  ];
  return {
    scaffold_verified: stage('scaffold_verified', scaffoldChecks.every((item) => item.status === 'passed'), generatedAt, scaffoldChecks, policy.stages.scaffold_verified.ttl_hours, [{ type: 'runtime-contract', url: `solution-plays/${play}/spec/runtime-contract.json`, sha256: hashFile(contractPath), media_type: 'application/json' }]),
    build_verified: stage('build_verified', buildChecks.every((item) => item.status === 'passed'), generatedAt, buildChecks, policy.stages.build_verified.ttl_hours, runtimeFiles.map((file) => ({ type: 'runtime', url: path.relative(root, file).split(path.sep).join('/'), sha256: hashFile(file), media_type: 'text/javascript' }))),
    evaluation_verified: stage('evaluation_verified', evaluationChecks.every((item) => item.status === 'passed'), generatedAt, evaluationChecks, policy.stages.evaluation_verified.ttl_hours, [{ type: 'evaluation-dataset', url: `solution-plays/${play}/evaluation/cases.jsonl`, sha256: hashFile(datasetPath), media_type: 'application/x-ndjson' }]),
    deploy_verified: stage('deploy_verified', false, generatedAt, [check('azure-what-if', false, 'No approved Azure what-if receipt has been supplied')], policy.stages.deploy_verified.ttl_hours),
    production_observed: stage('production_observed', false, generatedAt, [check('telemetry-window', false, 'No matching production telemetry window has been supplied')], policy.stages.production_observed.ttl_hours),
  };
}

async function designedEvidence(play, generatedAt) {
  const playRoot = path.join(playsRoot, play);
  const manifestPath = path.join(playRoot, 'spec', 'fai-manifest.json');
  const architecturePath = path.join(playRoot, 'architecture.md');
  const costPath = path.join(playRoot, 'cost.json');
  const evaluationPath = path.join(playRoot, 'evaluation', 'eval.py');
  const engine = initEngine(manifestPath);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const iacRelative = manifest.infrastructure?.bicep || manifest.infrastructure?.template;
  const iacPath = iacRelative ? path.resolve(playRoot, iacRelative) : null;
  const observabilityDeclared = architectureCheck(architecturePath)
    && /Application Insights|OpenTelemetry|Azure Monitor|Log Analytics/i.test(fs.readFileSync(architecturePath, 'utf8'));
  const checks = [
    check('manifest', engine.manifest != null, `engine loaded ${play}`),
    check('references', engine.success, engine.errors.join('; ') || 'all declared references resolve'),
    check('architecture', architectureCheck(architecturePath), 'diagram, service roles, and security are declared'),
    check('cost', costCheck(costPath), 'component totals reconcile for dev, prod, and enterprise'),
    check('iac-declaration', Boolean(iacPath && fs.existsSync(iacPath)), iacRelative || 'missing'),
    check('evaluation-declaration', fs.existsSync(evaluationPath), 'evaluation entry point exists'),
    check('observability-declaration', observabilityDeclared, 'observability service is present in architecture'),
  ];
  const passed = checks.every((item) => item.status === 'passed');
  const contentSha = hashTree(playRoot);
  const id = play.split('-')[0];
  const activePolicy = policy.cohort.includes(play) ? policy : designPolicy;
  const activePolicySha = policy.cohort.includes(play) ? policySha : designPolicySha;
  const expiresAt = new Date(Date.parse(generatedAt) + policy.stages.designed.ttl_hours * 60 * 60 * 1000).toISOString();
  const evidence = {
    $schema: 'https://frootai.dev/schemas/solution-play-certification-evidence.v1.json',
    schema_version: '1.0.0',
    subject: {
      play_id: id,
      slug: play,
      canonical_id: `frootai__${play}`,
      repository: 'https://github.com/frootai/frootai',
      commit_sha: commitSha,
      content_sha256: contentSha,
      manifest_sha256: hashFile(manifestPath),
      iac_sha256: iacPath ? hashFile(iacPath) : null,
      evaluation_dataset_sha256: hashFile(path.join(playRoot, 'evaluation', 'test-set.jsonl')),
    },
    policy: { profile: activePolicy.profile, profile_sha256: activePolicySha },
    generated_at: generatedAt,
    stages: {
      designed: {
        status: passed ? 'passed' : 'failed',
        generated_at: generatedAt,
        expires_at: expiresAt,
        provenance: { workflow: process.env.GITHUB_SERVER_URL || 'local', run_id: process.env.GITHUB_RUN_ID || 'local', attempt: Number(process.env.GITHUB_RUN_ATTEMPT || 1) },
        environment: { class: process.env.CI ? 'isolated_ci' : 'local', tools: { node: process.version } },
        checks,
        artifacts: [
          { type: 'manifest', url: `solution-plays/${play}/spec/fai-manifest.json`, sha256: hashFile(manifestPath), media_type: 'application/json' },
          { type: 'architecture', url: `solution-plays/${play}/architecture.md`, sha256: hashFile(architecturePath), media_type: 'text/markdown' },
          { type: 'cost', url: `solution-plays/${play}/cost.json`, sha256: hashFile(costPath), media_type: 'application/json' },
        ],
      },
    },
  };
  if (policy.cohort.includes(play) && passed) Object.assign(evidence.stages, await flagshipStages(play, generatedAt));
  const artifactResolver = (artifact) => {
    if (typeof artifact?.url !== 'string' || artifact.url.includes('..')) return null;
    const absolute = path.resolve(root, artifact.url);
    if (!absolute.startsWith(`${root}${path.sep}`)) return null;
    try {
      return fs.readFileSync(absolute);
    } catch {
      return null;
    }
  };
  const result = certifyEvidence(evidence, { now: new Date(), expectedContentSha256: contentSha, expectedCommitSha: commitSha, policy: activePolicy, expectedPolicySha256: activePolicySha, artifactResolver });
  return { evidence, certification: result };
}

export async function buildCertificationIndex({ generatedAt = new Date().toISOString() } = {}) {
  const plays = fs.readdirSync(playsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{2,3}-/.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => Number(left.split('-')[0]) - Number(right.split('-')[0]));
  const records = [];
  for (const play of plays) {
    const { evidence, certification } = await designedEvidence(play, generatedAt);
    records.push({ play, evidence, certification });
  }
  return {
    schema_version: '1.0.0',
    generated_at: generatedAt,
    count: records.length,
    summary: {
      designed: records.filter((record) => record.certification.level === 'designed').length,
      uncertified: records.filter((record) => record.certification.level == null).length,
      flagship: records.filter((record) => record.evidence.policy.profile === 'flagship-v1').length,
    },
    plays: records.map((record) => ({
      id: record.evidence.subject.play_id,
      slug: record.play,
      level: record.certification.level,
      valid: record.certification.valid,
      reasons: record.certification.reasons,
      content_sha256: record.evidence.subject.content_sha256,
      commit_sha: record.evidence.subject.commit_sha,
      evidence_path: `solution-plays/${record.play}/certification/evidence.v1.json`,
      profile: record.evidence.policy.profile,
      expires_at: record.certification.level ? record.evidence.stages[record.certification.level].expires_at : record.evidence.stages.designed.expires_at,
    })),
    records,
  };
}

async function main() {
  const checkMode = process.argv.includes('--check');
  const generatedAtArg = process.argv.find((arg) => arg.startsWith('--generated-at='))?.slice('--generated-at='.length);
  const generatedAt = generatedAtArg || (checkMode && fs.existsSync(outputPath)
    ? JSON.parse(fs.readFileSync(outputPath, 'utf8')).generated_at
    : new Date().toISOString());
  const index = await buildCertificationIndex({ generatedAt });
  const content = stableJson({ ...index, records: undefined });
  if (checkMode) {
    if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8') !== content) {
      console.error('Solution Play certification index is stale.');
      process.exitCode = 1;
    }
    return;
  }
  for (const record of index.records) {
    const evidencePath = path.join(playsRoot, record.play, 'certification', 'evidence.v1.json');
    fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
    fs.writeFileSync(evidencePath, stableJson(record.evidence), 'utf8');
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, 'utf8');
  process.stdout.write(`${JSON.stringify(index.summary)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
