#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { validateDeliveryProfile } from './validate-solution-play-delivery-profile.mjs';
import { validateTelemetryProfile } from './solution-play-telemetry.mjs';
import { validateEvaluationProfile } from './solution-play-evaluation.mjs';
import { evaluateApproval, validateIdentityProfile } from './solution-play-identity.mjs';
import { assessOperationsReadiness, operationalReceiptPaths, validateOperationsProfile } from './solution-play-operations.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const commandOrder = ['setup', 'start', 'test', 'evaluate', 'security', 'deploy', 'smoke', 'rollback'];
const stageNames = ['designed', 'scaffold_verified', 'build_verified', 'evaluation_verified', 'deploy_verified', 'production_observed'];
const allowedEnvironment = ['PATH', 'PATHEXT', 'SystemRoot', 'COMSPEC', 'TEMP', 'TMP', 'HOME', 'USERPROFILE'];
const toolchainLocks = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'uv.lock', 'poetry.lock', 'go.sum', 'packages.lock.json', 'toolchain.lock.json'];
const maximumCertificationTtlHours = 24;
const bundleMetadataFiles = new Set(['bundle-manifest.json', 'verdict.json']);
const profileFiles = {
  delivery: 'delivery-profile.v1.json',
  telemetry: 'telemetry-profile.v1.json',
  evaluation: 'evaluation-profile.v1.json',
  identity: 'identity-profile.v1.json',
  operations: 'operations-profile.v1.json',
};
let evidenceValidator;

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function stableJson(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, stableJson(value), { encoding: 'utf8', flag: 'wx' });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function evidenceSchemaValidator() {
  if (evidenceValidator) return evidenceValidator;
  const schema = readJson(path.join(repositoryRoot, 'schemas', 'solution-play-certification-evidence.v2.schema.json'));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  evidenceValidator = ajv.compile(schema);
  return evidenceValidator;
}

function runGit(args, cwd) {
  return runProcess({ executable: 'git', arguments: args, cwd, timeoutSeconds: 120, maximumOutputBytes: 65536, environment: {}, redactionValues: [] });
}

function redactText(value, protectedValues) {
  let result = String(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/(?:Bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/(?:password|passphrase|secret|token|api[_-]?key|authorization)\s*[=:]\s*[^\s,;]+/gi, '[REDACTED_SECRET]');
  for (const protectedValue of protectedValues.filter((candidate) => typeof candidate === 'string' && candidate.length > 0).sort((left, right) => right.length - left.length)) {
    result = result.split(protectedValue).join('[REDACTED]');
  }
  return result;
}

async function killProcessTree(child) {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { shell: false, stdio: 'ignore' });
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        try { killer.kill('SIGKILL'); } catch {}
        finish();
      }, 5000);
      killer.once('exit', finish);
      killer.once('error', finish);
    });
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch {} }
  }
}

export function runProcess({ executable, arguments: args, cwd, timeoutSeconds, maximumOutputBytes, environment, redactionValues }) {
  return new Promise((resolve) => {
    const startedAt = new Date().toISOString();
    const baseEnvironment = Object.fromEntries(allowedEnvironment.filter((name) => process.env[name] !== undefined).map((name) => [name, process.env[name]]));
    const child = spawn(executable, args, {
      cwd,
      env: { ...baseEnvironment, ...environment },
      shell: false,
      detached: process.platform !== 'win32',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let outcome = null;
    let terminating = false;
    let timer;

    const finish = (result) => {
      if (outcome) return;
      outcome = result;
      clearTimeout(timer);
      resolve({ ...result, started_at: startedAt, finished_at: new Date().toISOString(), output: redactText(output, redactionValues) });
    };
    const append = async (chunk) => {
      output += chunk.toString('utf8');
      if (Buffer.byteLength(output) > maximumOutputBytes && !outcome && !terminating) {
        terminating = true;
        await killProcessTree(child);
        finish({ status: 'failed', reason: 'output_limit', exit_code: null });
      }
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.once('error', (error) => finish({ status: 'failed', reason: `spawn_error:${error.code || error.message}`, exit_code: null }));
    child.once('exit', (code, signal) => finish({ status: code === 0 ? 'passed' : 'failed', reason: code === 0 ? null : `exit:${code ?? signal}`, exit_code: code }));
    timer = setTimeout(async () => {
      if (terminating || outcome) return;
      terminating = true;
      await killProcessTree(child);
      finish({ status: 'failed', reason: 'timeout', exit_code: null });
    }, timeoutSeconds * 1000);
  });
}

export function assertSafeTree(root) {
  const files = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.name === '.git') continue;
      const stat = fs.lstatSync(entryPath);
      if (stat.isSymbolicLink()) throw new Error(`symbolic link prohibited: ${path.relative(root, entryPath)}`);
      if (stat.isDirectory()) walk(entryPath);
      if (stat.isFile()) files.push(entryPath);
    }
  };
  walk(root);
  return files.sort();
}

function treeDigest(root) {
  const records = assertSafeTree(root).map((filePath) => {
    const relativePath = path.relative(root, filePath).split(path.sep).join('/');
    return `${relativePath}\0${sha256(fs.readFileSync(filePath))}`;
  });
  return sha256(records.join('\n'));
}

function loadProfiles(playRoot) {
  const contractRoot = path.join(playRoot, 'contracts');
  return Object.fromEntries(Object.entries(profileFiles).map(([name, file]) => [name, readJson(path.join(contractRoot, file))]));
}

function validateProfiles(profiles) {
  const results = {
    delivery: validateDeliveryProfile(profiles.delivery),
    telemetry: validateTelemetryProfile(profiles.telemetry),
    evaluation: validateEvaluationProfile(profiles.evaluation),
    identity: validateIdentityProfile(profiles.identity),
    operations: validateOperationsProfile(profiles.operations),
  };
  const errors = Object.entries(results).flatMap(([name, result]) => result.errors.map((error) => `${name}: ${error}`));
  return { valid: errors.length === 0, errors, results };
}

function verifyEvaluationArtifacts(playRoot, evaluationProfile) {
  const errors = [];
  for (const dataset of evaluationProfile.evaluation.datasets) {
    const candidates = [
      [`${dataset.id}: dataset`, dataset.path, dataset.sha256],
      [`${dataset.id}: source`, dataset.source.uri, dataset.source.source_sha256],
      [`${dataset.id}: leakage-review`, dataset.leakage_review.evidence_path, dataset.leakage_review.evidence_sha256],
    ];
    for (const [label, relativePath, expected] of candidates) {
      const filePath = path.resolve(playRoot, relativePath);
      if (!filePath.startsWith(`${playRoot}${path.sep}`) || !fs.existsSync(filePath)) errors.push(`${label} file missing or outside play root`);
      else if (sha256(fs.readFileSync(filePath)) !== expected) errors.push(`${label} hash mismatch`);
    }
  }
  return errors;
}

function commandDisplay(command) {
  return JSON.stringify([command.executable, ...command.arguments]);
}

function verifyCommandReceipt(playRoot, commandName, command, runId) {
  const receiptPath = path.resolve(playRoot, command.receipt);
  if (!receiptPath.startsWith(`${playRoot}${path.sep}`)) return { valid: false, reason: 'receipt_path_escape' };
  if (!fs.existsSync(receiptPath)) return { valid: false, reason: 'receipt_missing' };
  try {
    const bytes = fs.readFileSync(receiptPath);
    const document = JSON.parse(bytes.toString('utf8'));
    if (document.status !== 'passed' || document.command !== commandName || document.run_id !== runId) return { valid: false, reason: 'receipt_invalid' };
    return { valid: true, path: receiptPath, sha256: sha256(bytes), document };
  } catch {
    return { valid: false, reason: 'receipt_corrupt' };
  }
}

function copyArtifact(sourcePath, stagingRoot, playRoot, protectedValues, type = 'command-receipt') {
  const source = fs.readFileSync(sourcePath);
  const sourceText = source.toString('utf8');
  if (redactText(sourceText, protectedValues) !== sourceText) throw new Error(`protected content found in receipt: ${path.relative(playRoot, sourcePath)}`);
  const relative = path.relative(playRoot, sourcePath).split(path.sep).join('/');
  const target = path.join(stagingRoot, 'artifacts', relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(sourcePath, target);
  return { type, path: `artifacts/${relative}`, sha256: sha256(fs.readFileSync(target)), media_type: 'application/json' };
}

function stage(status, generatedAt, expiresAt, environment, checks = [], artifacts = []) {
  return { status, generated_at: generatedAt, expires_at: expiresAt, environment, checks, artifacts };
}

function buildEvidence({ source, policy, generatedAt, checks, artifacts }) {
  const expiresAt = new Date(Date.parse(generatedAt) + policy.ttl_hours * 3600000).toISOString();
  const environment = { class: 'local', os: process.platform, architecture: process.arch, tools: { node: process.version, git: source.git_version } };
  const byName = new Map(checks.map((check) => [check.id, check]));
  const select = (names) => names.map((name) => byName.get(name)).filter(Boolean);
  const statusFor = (selected) => selected.length > 0 && selected.every((check) => check.status === 'passed') ? 'passed' : selected.some((check) => check.status === 'failed') ? 'failed' : 'not_run';
  const artifactsFor = (names) => artifacts.filter((artifact) => names.some((name) => artifact.path.endsWith(`/${name}.json`)));
  const stages = {
    designed: stage('passed', generatedAt, expiresAt, environment, select(['contract-validation']), []),
    scaffold_verified: stage(statusFor(select(['setup', 'start'])), generatedAt, expiresAt, environment, select(['setup', 'start']), artifactsFor(['setup', 'start'])),
    build_verified: stage(statusFor(select(['test', 'security'])), generatedAt, expiresAt, environment, select(['test', 'security']), artifactsFor(['test', 'security'])),
    evaluation_verified: stage(statusFor(select(['evaluate'])), generatedAt, expiresAt, environment, select(['evaluate']), artifactsFor(['evaluate'])),
    deploy_verified: stage(statusFor(select(['deploy', 'smoke', 'rollback', 'cleanup'])), generatedAt, expiresAt, environment, select(['deploy', 'smoke', 'rollback', 'cleanup']), artifactsFor(['deploy', 'smoke', 'rollback', 'cleanup'])),
    production_observed: stage('not_run', generatedAt, expiresAt, environment, [], []),
  };
  const document = {
    $schema: 'https://frootai.dev/schemas/solution-play-certification-evidence.v2.json',
    schema_version: '2.0.0',
    subject: source.subject,
    policy: { profile: policy.profile, profile_version: policy.version, profile_sha256: policy.sha256 },
    generated_at: generatedAt,
    stages,
  };
  document.integrity = { algorithm: 'sha256', evidence_sha256: sha256(stableJson(document)) };
  const validate = evidenceSchemaValidator();
  if (!validate(document)) throw new Error(`evidence v2 invalid: ${JSON.stringify(validate.errors)}`);
  return document;
}

function checkRecord(id, status, command, startedAt, finishedAt, exitCode, output) {
  return { id, status, blocking: true, command, started_at: startedAt, finished_at: finishedAt, exit_code: exitCode, output_sha256: sha256(output) };
}

function verifyEvidenceIntegrity(document) {
  const copy = structuredClone(document);
  const expected = copy.integrity.evidence_sha256;
  delete copy.integrity;
  return expected === sha256(stableJson(copy));
}

function writeAtomicFailure(outputRoot, targetName, payload) {
  const suffix = crypto.randomUUID();
  const temp = path.join(outputRoot, `${targetName}.failure-${suffix}.tmp`);
  const final = path.join(outputRoot, `${targetName}.failure-${suffix}.json`);
  fs.writeFileSync(temp, stableJson(payload), { encoding: 'utf8', flag: 'wx' });
  fs.renameSync(temp, final);
  return final;
}

function verifySourceReceipt(receipt) {
  return fs.existsSync(receipt.path) && sha256(fs.readFileSync(receipt.path)) === receipt.sha256;
}

function resolveFixtureReference(known, reference) {
  return known.has(reference);
}

export async function certifyCleanCheckout({
  repositoryPath,
  sourceSha,
  playPath,
  outputRoot,
  generatedAt = new Date().toISOString(),
  commandEnvironment = {},
  notificationReferences = [],
  escalationReferences = [],
  maximumOutputBytes = 65536,
  holdLockMilliseconds = 0,
  injectFailure = null,
  lockTimeoutSeconds = 900,
} = {}) {
  fs.mkdirSync(outputRoot, { recursive: true });
  const targetName = `${path.basename(playPath)}-${sourceSha}`;
  const targetRoot = path.join(outputRoot, targetName);
  const lockPath = path.join(outputRoot, `${targetName}.lock`);
  let lock;
  let checkoutRoot;
  let stagingRoot;
  let cleanupAttempted = false;
  const executionChecks = [];
  const artifacts = [];
  try {
    const generatedTime = Date.parse(generatedAt);
    if (!Number.isFinite(generatedTime) || generatedTime > Date.now() + 60000) throw new Error('generated_at is invalid or exceeds clock-skew allowance');
    const invalidEnvironmentKeys = Object.keys(commandEnvironment).filter((name) => !/^FROOTAI_FIXTURE_[A-Z0-9_]+$/.test(name));
    if (invalidEnvironmentKeys.length > 0) throw new Error(`command environment key is not allowed: ${invalidEnvironmentKeys.join(', ')}`);
    if (fs.existsSync(targetRoot)) throw new Error('authoritative bundle already exists');
    for (let attempt = 0; attempt < 2 && lock === undefined; attempt += 1) {
      try {
        lock = fs.openSync(lockPath, 'wx');
        fs.writeFileSync(lock, stableJson({ pid: process.pid, acquired_at: new Date().toISOString(), source_sha: sourceSha }));
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        let existing;
        try { existing = readJson(lockPath); } catch { existing = null; }
        const age = existing ? Date.now() - Date.parse(existing.acquired_at) : Number.NaN;
        let alive = true;
        try { process.kill(existing?.pid, 0); } catch { alive = false; }
        if (attempt === 0 && existing && existing.source_sha === sourceSha && Number.isFinite(age) && age > lockTimeoutSeconds * 1000 && !alive) {
          fs.renameSync(lockPath, path.join(outputRoot, `${targetName}.stale-lock-${crypto.randomUUID()}.json`));
          continue;
        }
        const receipt = writeAtomicFailure(outputRoot, targetName, { status: 'contended', source_sha: sourceSha, lock: existing, stale: !alive });
        return { status: 'contended', failure_receipt: receipt };
      }
    }
    if (holdLockMilliseconds > 0) await new Promise((resolve) => setTimeout(resolve, holdLockMilliseconds));

    const sourceStatus = await runGit(['status', '--porcelain'], repositoryPath);
    if (sourceStatus.status !== 'passed' || sourceStatus.output.trim() !== '') throw new Error('source repository is not clean');
    checkoutRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frootai-certification-checkout-'));
    const clone = await runGit(['clone', '--shared', '--quiet', repositoryPath, checkoutRoot], outputRoot);
    if (clone.status !== 'passed') throw new Error(`clone failed: ${clone.reason}`);
    const checkout = await runGit(['checkout', '--detach', '--quiet', sourceSha], checkoutRoot);
    if (checkout.status !== 'passed') throw new Error(`checkout failed: ${checkout.reason}`);
    const head = await runGit(['rev-parse', 'HEAD'], checkoutRoot);
    if (head.status !== 'passed' || head.output.trim() !== sourceSha) throw new Error('checked out source SHA does not match request');
    const clean = await runGit(['status', '--porcelain'], checkoutRoot);
    if (clean.status !== 'passed' || clean.output.trim() !== '') throw new Error('isolated checkout is not clean');
    const lockFiles = toolchainLocks.filter((name) => fs.existsSync(path.join(checkoutRoot, name)));
    if (lockFiles.length === 0) throw new Error('committed toolchain lock is required');

    const playRoot = path.resolve(checkoutRoot, playPath);
    if (!playRoot.startsWith(`${checkoutRoot}${path.sep}`) || !fs.existsSync(playRoot)) throw new Error('play path escapes checkout or is missing');
    const contentSha = treeDigest(playRoot);
    const profiles = loadProfiles(playRoot);
    const profileValidation = validateProfiles(profiles);
    profileValidation.errors.push(...verifyEvaluationArtifacts(playRoot, profiles.evaluation));
    profileValidation.valid = profileValidation.errors.length === 0;
    if (!profileValidation.valid) throw new Error(`contract validation failed: ${profileValidation.errors.join('; ')}`);
    const manifestPath = path.join(playRoot, 'spec', 'fai-manifest.json');
    const specPath = path.join(playRoot, 'spec', 'play-spec.json');
    const policyPath = path.join(playRoot, 'contracts', 'certification-policy.json');
    const policyDocument = readJson(policyPath);
    if (policyDocument.certification_scope !== 'fixture-only' || path.basename(playPath) !== '00-certification-fixture') throw new Error('T214 accepts only the canonical fixture-only certification scope');
    if (!Number.isFinite(policyDocument.ttl_hours) || policyDocument.ttl_hours <= 0 || policyDocument.ttl_hours > maximumCertificationTtlHours) throw new Error(`certification TTL must be greater than zero and at most ${maximumCertificationTtlHours} hours`);
    if (generatedTime + policyDocument.ttl_hours * 3600000 <= Date.now()) throw new Error('generated_at produces an already expired certification');
    const gitVersion = await runGit(['--version'], checkoutRoot);
    if (gitVersion.status !== 'passed') throw new Error(`Git version discovery failed: ${gitVersion.reason}`);
    const source = {
      repository_path: path.resolve(repositoryPath), source_sha: sourceSha, clean: true, content_sha256: contentSha,
      structural_digest: sha256(stableJson({ source_sha: sourceSha, content_sha256: contentSha, profiles: Object.fromEntries(Object.entries(profileFiles).map(([name, file]) => [name, sha256(fs.readFileSync(path.join(playRoot, 'contracts', file)))])) })),
      git_version: gitVersion.output.trim(),
      toolchain_locks: Object.fromEntries(lockFiles.map((name) => [name, sha256(fs.readFileSync(path.join(checkoutRoot, name)))])),
      subject: {
        play_id: path.basename(playPath).split('-')[0], slug: path.basename(playPath), repository: policyDocument.repository,
        commit_sha: sourceSha, content_sha256: contentSha, manifest_sha256: sha256(fs.readFileSync(manifestPath)), spec_sha256: sha256(fs.readFileSync(specPath)),
        iac_sha256: null, evaluation_dataset_sha256: profiles.evaluation.evaluation.datasets[0]?.sha256 || null,
      },
    };
    const policy = { profile: policyDocument.profile, version: policyDocument.version, ttl_hours: policyDocument.ttl_hours, sha256: sha256(fs.readFileSync(policyPath)) };
    stagingRoot = path.join(outputRoot, `${targetName}.staging-${crypto.randomUUID()}`);
    fs.mkdirSync(stagingRoot, { recursive: false });
    const validationCheck = checkRecord('contract-validation', 'passed', 'internal:validate-profiles', generatedAt, generatedAt, 0, stableJson(profileValidation));
    executionChecks.push(validationCheck);

    const protectedValues = [...Object.values(commandEnvironment), ...notificationReferences, ...escalationReferences];
    const sanitizedOutputs = [];
    const commands = profiles.delivery.vertical_slice.commands;
    const runId = crypto.randomUUID();
    const failures = [];
    for (const name of commandOrder.filter((candidate) => commands[candidate])) {
      if (failures.length > 0) break;
      const command = commands[name];
      const cwd = path.resolve(playRoot, command.working_directory);
      if (!cwd.startsWith(`${playRoot}${path.sep}`) && cwd !== playRoot) throw new Error(`${name} working directory escapes play root`);
      const result = await runProcess({ executable: command.executable === 'node' ? process.execPath : command.executable, arguments: command.arguments, cwd, timeoutSeconds: command.timeout_seconds, maximumOutputBytes, environment: { ...commandEnvironment, FROOTAI_CERT_RUN_ID: runId, FROOTAI_CERT_COMMAND: name }, redactionValues: protectedValues });
      sanitizedOutputs.push(result.output);
      const receipt = result.status === 'passed' ? verifyCommandReceipt(playRoot, name, command, runId) : { valid: false, reason: result.reason };
      const status = result.status === 'passed' && receipt.valid ? 'passed' : 'failed';
      executionChecks.push(checkRecord(name, status, commandDisplay(command), result.started_at, result.finished_at, result.exit_code, result.output));
      if (receipt.valid) artifacts.push(copyArtifact(receipt.path, stagingRoot, playRoot, protectedValues));
      if (status !== 'passed') failures.push(`${name}: ${receipt.reason || result.reason}`);
    }

    const cleanup = commands.cleanup;
    if (!cleanup) throw new Error('cleanup command is required');
    const cleanupResult = await runProcess({ executable: cleanup.executable === 'node' ? process.execPath : cleanup.executable, arguments: cleanup.arguments, cwd: path.resolve(playRoot, cleanup.working_directory), timeoutSeconds: cleanup.timeout_seconds, maximumOutputBytes, environment: { ...commandEnvironment, FROOTAI_CERT_RUN_ID: runId, FROOTAI_CERT_COMMAND: 'cleanup' }, redactionValues: protectedValues });
    sanitizedOutputs.push(cleanupResult.output);
    cleanupAttempted = true;
    const cleanupReceipt = cleanupResult.status === 'passed' ? verifyCommandReceipt(playRoot, 'cleanup', cleanup, runId) : { valid: false, reason: cleanupResult.reason };
    const cleanupStatus = cleanupResult.status === 'passed' && cleanupReceipt.valid ? 'passed' : 'failed';
    executionChecks.push(checkRecord('cleanup', cleanupStatus, commandDisplay(cleanup), cleanupResult.started_at, cleanupResult.finished_at, cleanupResult.exit_code, cleanupResult.output));
    if (cleanupReceipt.valid) artifacts.push(copyArtifact(cleanupReceipt.path, stagingRoot, playRoot, protectedValues));
    if (cleanupStatus !== 'passed') failures.push(`cleanup: ${cleanupReceipt.reason || cleanupResult.reason}`);

    const productionApproval = profiles.identity.identity.approvals.policies.find((candidate) => candidate.operation === 'production-deploy');
    if (!productionApproval) throw new Error('production-deploy approval policy is required');
    const approvalPath = path.join(playRoot, productionApproval.receipt_path);
    if (!approvalPath.startsWith(`${playRoot}${path.sep}`) || !fs.existsSync(approvalPath)) throw new Error('approval evidence missing or outside play root');
    const approvalDocument = readJson(approvalPath);
    const approvalRequest = { ...approvalDocument, operation: 'production-deploy', receipt_written: true, receipt_path: productionApproval.receipt_path, receipt_sha256: sha256(fs.readFileSync(approvalPath)) };
    const approval = evaluateApproval(profiles.identity, approvalRequest, { verifyReceipt: ({ path: relativePath, sha256: expected }) => verifySourceReceipt({ path: path.join(playRoot, relativePath), sha256: expected }) });
    const operationReceipts = Object.fromEntries(operationalReceiptPaths(profiles.operations).map((relativePath) => {
      const receiptPath = path.join(playRoot, relativePath);
      if (!fs.existsSync(receiptPath)) return [relativePath, 'missing'];
      try { return [relativePath, readJson(receiptPath).status === 'passed' ? 'passed' : 'failed']; } catch { return [relativePath, 'corrupt']; }
    }));
    const operations = assessOperationsReadiness(profiles.operations, operationReceipts, {
      resolveNotification: (reference) => resolveFixtureReference(new Set(notificationReferences), reference),
      resolveEscalation: (reference) => resolveFixtureReference(new Set(escalationReferences), reference),
    });
    if (!approval.authorized) failures.push(`approval: ${approval.reason}`);
    if (!operations.ready) failures.push(`operations: ${operations.blockers.join('; ')}`);
    if (injectFailure === 'before-publish') failures.push('injected failure before publication');
    if (failures.length > 0) throw new Error(failures.join('; '));

    const operationalArtifacts = operationalReceiptPaths(profiles.operations).map((relativePath) => copyArtifact(path.join(playRoot, relativePath), stagingRoot, playRoot, protectedValues, 'operations-receipt'));
    const approvalArtifact = copyArtifact(approvalPath, stagingRoot, playRoot, protectedValues, 'approval-receipt');
    artifacts.push(...operationalArtifacts, approvalArtifact);

    const serializedOutputs = sanitizedOutputs.join('\n');
    const leakedValues = protectedValues.filter((value) => typeof value === 'string' && value.length > 0 && serializedOutputs.includes(value));
    if (leakedValues.length > 0) throw new Error('protected content remains after redaction');
    const security = { status: 'passed', leaked_values: 0, shell: false, stdin: 'closed', symlinks: 'rejected', maximum_output_bytes: maximumOutputBytes };
    const evaluation = { status: 'passed', execution_source: profiles.evaluation.evaluation.execution.source, dataset_lineage_sha256: source.subject.evaluation_dataset_sha256, foundry_overlay_eligible: false };
    const operationsReport = { status: 'passed', approval, readiness: operations, cleanup_attempted: cleanupAttempted, receipts: Object.fromEntries([...operationalArtifacts, approvalArtifact].map((artifact) => [artifact.path, artifact.sha256])) };
    const evidence = buildEvidence({ source, policy, generatedAt, checks: executionChecks, artifacts });
    if (!verifyEvidenceIntegrity(evidence)) throw new Error('evidence integrity verification failed');
    writeJson(path.join(stagingRoot, 'source.json'), source);
    writeJson(path.join(stagingRoot, 'validation.json'), { status: 'passed', profiles: profileValidation.results });
    writeJson(path.join(stagingRoot, 'execution.json'), { status: 'passed', checks: executionChecks.map((check, index) => ({ ...check, redacted_output: sanitizedOutputs[index] || '' })) });
    writeJson(path.join(stagingRoot, 'security.json'), security);
    writeJson(path.join(stagingRoot, 'evaluation.json'), evaluation);
    writeJson(path.join(stagingRoot, 'operations.json'), operationsReport);
    writeJson(path.join(stagingRoot, 'evidence.v2.json'), evidence);
    const fileNames = assertSafeTree(stagingRoot).map((filePath) => path.relative(stagingRoot, filePath).split(path.sep).join('/')).sort();
    const manifest = { schema_version: '1.0.0', files: Object.fromEntries(fileNames.map((name) => [name, sha256(fs.readFileSync(path.join(stagingRoot, name)))])) };
    const bundleSha = sha256(stableJson(manifest));
    writeJson(path.join(stagingRoot, 'bundle-manifest.json'), manifest);
    writeJson(path.join(stagingRoot, 'verdict.json'), { schema_version: '1.0.0', status: 'passed', certification_scope: 'fixture-only', public_state: 'Designed', promotion_allowed: false, source_sha: sourceSha, generated_at: generatedAt, expires_at: new Date(generatedTime + policy.ttl_hours * 3600000).toISOString(), structural_digest: source.structural_digest, bundle_sha256: bundleSha });
    fs.renameSync(stagingRoot, targetRoot);
    stagingRoot = null;
    return { status: 'passed', bundle_path: targetRoot, bundle_sha256: bundleSha, structural_digest: source.structural_digest };
  } catch (error) {
    if (stagingRoot && fs.existsSync(stagingRoot)) fs.rmSync(stagingRoot, { recursive: true, force: true });
    const failureReceipt = writeAtomicFailure(outputRoot, targetName, { status: 'failed', source_sha: sourceSha, reason: error.message, cleanup_attempted: cleanupAttempted, published: false });
    return { status: 'failed', reason: error.message, failure_receipt: failureReceipt };
  } finally {
    if (checkoutRoot && fs.existsSync(checkoutRoot)) fs.rmSync(checkoutRoot, { recursive: true, force: true });
    if (lock !== undefined) {
      fs.closeSync(lock);
      if (fs.existsSync(lockPath)) fs.rmSync(lockPath, { force: true });
    }
  }
}

export function verifyPublishedBundle(bundlePath) {
  try {
    const bundleRoot = path.resolve(bundlePath);
    const bundleStat = fs.lstatSync(bundleRoot);
    if (!bundleStat.isDirectory() || bundleStat.isSymbolicLink()) return { valid: false, reason: 'bundle root is not a safe directory' };
    const actualFiles = assertSafeTree(bundleRoot).map((filePath) => path.relative(bundleRoot, filePath).split(path.sep).join('/')).filter((name) => !bundleMetadataFiles.has(name)).sort();
    const verdict = readJson(path.join(bundlePath, 'verdict.json'));
    const manifest = readJson(path.join(bundlePath, 'bundle-manifest.json'));
    if (verdict.status !== 'passed' || verdict.certification_scope !== 'fixture-only' || verdict.promotion_allowed !== false) return { valid: false, reason: 'verdict boundary invalid' };
    const generatedAt = verdict.generated_at ? Date.parse(verdict.generated_at) : Number.NaN;
    const expiresAt = verdict.expires_at ? Date.parse(verdict.expires_at) : Number.NaN;
    if (!Number.isFinite(generatedAt) || generatedAt > Date.now() + 60000) return { valid: false, reason: 'bundle generated_at invalid' };
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return { valid: false, reason: 'bundle verdict expired' };
    const ttlMilliseconds = expiresAt - generatedAt;
    if (ttlMilliseconds <= 0 || ttlMilliseconds > maximumCertificationTtlHours * 3600000) return { valid: false, reason: 'bundle TTL invalid' };
    if (manifest.schema_version !== '1.0.0' || !manifest.files || Array.isArray(manifest.files) || typeof manifest.files !== 'object') return { valid: false, reason: 'bundle manifest invalid' };
    if (sha256(stableJson(manifest)) !== verdict.bundle_sha256) return { valid: false, reason: 'bundle manifest digest mismatch' };
    const manifestFiles = Object.keys(manifest.files).sort();
    if (JSON.stringify(manifestFiles) !== JSON.stringify(actualFiles)) return { valid: false, reason: 'bundle manifest file set mismatch' };
    for (const name of actualFiles) {
      const filePath = path.resolve(bundleRoot, name);
      if (!filePath.startsWith(`${bundleRoot}${path.sep}`) || sha256(fs.readFileSync(filePath)) !== manifest.files[name]) return { valid: false, reason: `bundle file mismatch: ${name}` };
    }
    const evidence = readJson(path.join(bundlePath, 'evidence.v2.json'));
    const source = readJson(path.join(bundlePath, 'source.json'));
    const validate = evidenceSchemaValidator();
    if (!validate(evidence) || !verifyEvidenceIntegrity(evidence)) return { valid: false, reason: 'evidence v2 invalid' };
    if (source.source_sha !== verdict.source_sha || evidence.subject.commit_sha !== verdict.source_sha) return { valid: false, reason: 'bundle source SHA mismatch' };
    if (evidence.generated_at !== verdict.generated_at) return { valid: false, reason: 'bundle generated_at mismatch' };
    for (const [name, stageDocument] of Object.entries(evidence.stages)) {
      if (stageDocument.generated_at !== verdict.generated_at) return { valid: false, reason: `stage generated_at mismatch: ${name}` };
      if (stageDocument.expires_at !== verdict.expires_at) return { valid: false, reason: `stage expiry mismatch: ${name}` };
    }
    return { valid: true, reason: null, verdict };
  } catch (error) {
    return { valid: false, reason: error.message };
  }
}