import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertSafeTree, certifyCleanCheckout, sha256, verifyPublishedBundle } from './solution-play-certification-harness.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureCommand = path.join(root, 'tests', 'fixtures', 'solution-play-certification-harness', 'fixture-command.mjs');
const profileFixtureRoot = path.join(root, 'tests', 'fixtures');
const play = '00-certification-fixture';
const generatedAt = new Date().toISOString();
const notificationReferences = ['$notification.ONCALL_PRIMARY', '$notification.PAGER_PRIMARY', '$notification.FINOPS_EMAIL'];
const escalationReferences = ['oncall-primary', 'service-owner'];

function readFixture(folder, file = 'applicable.json') {
  return JSON.parse(fs.readFileSync(path.join(profileFixtureRoot, folder, file), 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function stableJson(value) {
  const stable = (candidate) => Array.isArray(candidate)
    ? candidate.map(stable)
    : candidate && typeof candidate === 'object'
      ? Object.fromEntries(Object.keys(candidate).sort().map((key) => [key, stable(candidate[key])]))
      : candidate;
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

function git(repository, ...args) {
  return execFileSync('git', args, { cwd: repository, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function snapshotTree(treeRoot, current = treeRoot, snapshot = {}) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const entryPath = path.join(current, entry.name);
    if (entry.isDirectory()) snapshotTree(treeRoot, entryPath, snapshot);
    if (entry.isFile()) snapshot[path.relative(treeRoot, entryPath).split(path.sep).join('/')] = sha256(fs.readFileSync(entryPath));
  }
  return snapshot;
}

function fixtureRepository(t, { mutateProfiles, mutateFiles } = {}) {
  const repository = fs.mkdtempSync(path.join(os.tmpdir(), 'frootai-cert-source-'));
  fs.writeFileSync(path.join(repository, '.gitattributes'), '* -text\n', 'utf8');
  const playRoot = path.join(repository, play);
  const reference = path.join(playRoot, 'reference');
  for (const folder of ['app', 'tests', 'evals', 'ops', 'observability', 'evidence', 'developer-agents', 'infra']) {
    fs.mkdirSync(path.join(reference, folder), { recursive: true });
    fs.writeFileSync(path.join(reference, folder, '.gitkeep'), '', 'utf8');
  }
  fs.copyFileSync(fixtureCommand, path.join(reference, 'fixture-command.mjs'));
  fs.writeFileSync(path.join(reference, 'app', 'main.mjs'), 'process.stdout.write("fixture-ready\\n");\n', 'utf8');
  fs.writeFileSync(path.join(reference, 'ops', 'runbook.md'), '# Fixture runbook\n', 'utf8');

  const profiles = {
    delivery: readFixture('solution-play-delivery-profile'),
    telemetry: readFixture('solution-play-telemetry-profile'),
    evaluation: readFixture('solution-play-evaluation-profile'),
    identity: readFixture('solution-play-identity-profile'),
    operations: readFixture('solution-play-operations-profile'),
  };
  for (const profile of Object.values(profiles)) profile.play = play;
  for (const [name, command] of Object.entries(profiles.delivery.vertical_slice.commands)) {
    command.executable = 'node';
    command.arguments = ['fixture-command.mjs', name, command.receipt];
    command.working_directory = 'reference';
    command.timeout_seconds = 15;
    command.mode = 'finite';
    command.stdin = 'closed';
  }

  for (const dataset of profiles.evaluation.evaluation.datasets) {
    const datasetPath = path.join(playRoot, dataset.path);
    const sourcePath = path.join(playRoot, dataset.source.uri);
    const reviewPath = path.join(playRoot, dataset.leakage_review.evidence_path);
    fs.mkdirSync(path.dirname(datasetPath), { recursive: true });
    fs.writeFileSync(datasetPath, `${JSON.stringify({ query: dataset.id, expected_behavior: 'fixture behavior' })}\n`, 'utf8');
    writeJson(sourcePath, { id: dataset.id, license: dataset.source.license });
    writeJson(reviewPath, { id: dataset.id, status: 'passed' });
    dataset.sha256 = sha256(fs.readFileSync(datasetPath));
    dataset.source.source_sha256 = sha256(fs.readFileSync(sourcePath));
    dataset.leakage_review.evidence_sha256 = sha256(fs.readFileSync(reviewPath));
  }
  if (mutateProfiles) mutateProfiles(profiles);

  const contracts = path.join(playRoot, 'contracts');
  writeJson(path.join(contracts, 'delivery-profile.v1.json'), profiles.delivery);
  writeJson(path.join(contracts, 'developer-profile.v1.json'), { schema_version: '1.1.0', play, applicability: 'not_applicable', reason: 'The certification fixture exercises runtime evidence without developer adapters.' });
  writeJson(path.join(contracts, 'telemetry-profile.v1.json'), profiles.telemetry);
  writeJson(path.join(contracts, 'evaluation-profile.v1.json'), profiles.evaluation);
  writeJson(path.join(contracts, 'identity-profile.v1.json'), profiles.identity);
  writeJson(path.join(contracts, 'operations-profile.v1.json'), profiles.operations);
  writeJson(path.join(contracts, 'certification-policy.json'), { profile: 'fixture-v1', version: '1.0.0', certification_scope: 'fixture-only', ttl_hours: 24, repository: 'https://github.com/frootai/certification-fixture' });
  writeJson(path.join(playRoot, 'spec', 'fai-manifest.json'), { schema_version: '2.0.0', play });
  writeJson(path.join(playRoot, 'spec', 'play-spec.json'), {
    schema_version: '2.3.0', play, version: '1.0.0', title: 'Certification Fixture', description: 'A fixture-only clean-checkout certification workload for harness validation.',
    architecture: { runtime: { pattern: 'deterministic-function', description: 'A deterministic fixture process exercises bounded certification lifecycle commands.' }, developer_agents: { topology: 'none', rationale: 'Developer agents are intentionally not applicable to this harness fixture.' } },
    contracts: { delivery_profile: 'contracts/delivery-profile.v1.json', developer_profile: 'contracts/developer-profile.v1.json', telemetry: 'contracts/telemetry-profile.v1.json', evaluation: 'contracts/evaluation-profile.v1.json', identity: 'contracts/identity-profile.v1.json', operations: 'contracts/operations-profile.v1.json', context: 'contracts/context.v1.json', handoff: 'contracts/handoff.v1.json', loop: 'contracts/loop.v1.json', memory: 'contracts/memory.v1.json', evidence: 'contracts/evidence.v2.json' },
    official_sources: [{ url: 'https://example.com/fixture', retrieved_at: generatedAt, status: 'ga', tested_version: '1.0.0', claim: 'Fixture-only harness validation source' }]
  });
  if (mutateFiles) mutateFiles({ repository, playRoot, profiles });
  writeJson(path.join(repository, 'toolchain.lock.json'), { node: process.version, git: git(root, '--version') });
  git(repository, 'init', '--quiet');
  git(repository, 'config', 'user.name', 'T214 Fixture');
  git(repository, 'config', 'user.email', 'fixture@frootai.dev');
  git(repository, 'add', '.');
  git(repository, 'commit', '--quiet', '-m', 'fixture');
  const sourceSha = git(repository, 'rev-parse', 'HEAD');
  t.after(() => fs.rmSync(repository, { recursive: true, force: true }));
  return { repository, sourceSha, playRoot };
}

function outputRoot(t) {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'frootai-cert-output-'));
  t.after(() => fs.rmSync(output, { recursive: true, force: true }));
  return output;
}

function options(t, overrides = {}) {
  const source = fixtureRepository(t, overrides);
  const output = outputRoot(t);
  const cleanupMarker = path.join(output, `cleanup-${crypto.randomUUID()}.txt`);
  return {
    repositoryPath: source.repository, sourceSha: source.sourceSha, playPath: play, outputRoot: output, generatedAt,
    notificationReferences, escalationReferences,
    commandEnvironment: { FROOTAI_FIXTURE_CLEANUP_MARKER: cleanupMarker, FROOTAI_FIXTURE_PRINT_PROTECTED: 'fixture-secret-value' },
    cleanupMarker,
    ...overrides.options,
  };
}

test('publishes a strict fixture-only evidence bundle atomically from an exact clean SHA', async (t) => {
  const before = snapshotTree(path.join(root, 'solution-plays'));
  const config = options(t);
  const result = await certifyCleanCheckout(config);
  assert.equal(result.status, 'passed', result.reason);
  assert.equal(fs.existsSync(config.cleanupMarker), true);
  assert.equal(fs.existsSync(`${result.bundle_path}.lock`), false);
  assert.equal(fs.readdirSync(config.outputRoot).some((name) => name.includes('.staging-')), false);
  const verified = verifyPublishedBundle(result.bundle_path);
  assert.equal(verified.valid, true, verified.reason);
  assert.equal(verified.verdict.public_state, 'Designed');
  assert.equal(verified.verdict.promotion_allowed, false);
  assert.equal(readJson(path.join(result.bundle_path, 'security.json')).leaked_values, 0);
  assert.deepEqual(snapshotTree(path.join(root, 'solution-plays')), before);
});

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }

test('detects bundle tampering and preserves deterministic structural identity across reruns', async (t) => {
  const first = options(t);
  const secondOutput = outputRoot(t);
  const firstResult = await certifyCleanCheckout(first);
  const secondResult = await certifyCleanCheckout({ ...first, outputRoot: secondOutput, commandEnvironment: { ...first.commandEnvironment, FROOTAI_FIXTURE_CLEANUP_MARKER: path.join(secondOutput, 'cleanup.txt') } });
  assert.equal(firstResult.status, 'passed');
  assert.equal(secondResult.status, 'passed');
  assert.equal(firstResult.structural_digest, secondResult.structural_digest);
  const sourcePath = path.join(firstResult.bundle_path, 'source.json');
  const sourceBytes = fs.readFileSync(sourcePath);
  fs.appendFileSync(sourcePath, 'tampered');
  assert.equal(verifyPublishedBundle(firstResult.bundle_path).valid, false);
  fs.writeFileSync(sourcePath, sourceBytes);

  const evidence = readJson(path.join(secondResult.bundle_path, 'evidence.v2.json'));
  const retainedArtifact = Object.values(evidence.stages).flatMap((stage) => stage.artifacts).at(0).path;
  fs.appendFileSync(path.join(secondResult.bundle_path, retainedArtifact), 'tampered');
  assert.match(verifyPublishedBundle(secondResult.bundle_path).reason, /bundle file mismatch/);

  const outsidePath = path.join(path.dirname(firstResult.bundle_path), 'outside.json');
  fs.writeFileSync(outsidePath, 'external', 'utf8');
  const manifestPath = path.join(firstResult.bundle_path, 'bundle-manifest.json');
  const manifest = readJson(manifestPath);
  manifest.files['../outside.json'] = sha256(fs.readFileSync(outsidePath));
  fs.writeFileSync(manifestPath, stableJson(manifest), 'utf8');
  const verdictPath = path.join(firstResult.bundle_path, 'verdict.json');
  const verdict = readJson(verdictPath);
  verdict.bundle_sha256 = sha256(stableJson(manifest));
  fs.writeFileSync(verdictPath, stableJson(verdict), 'utf8');
  assert.equal(verifyPublishedBundle(firstResult.bundle_path).reason, 'bundle manifest file set mismatch');
});

test('failure and corrupt receipts never publish a pass and always attempt cleanup', async (t) => {
  for (const environment of [{ FROOTAI_FIXTURE_FAIL_COMMAND: 'security' }, { FROOTAI_FIXTURE_CORRUPT_RECEIPT: 'security' }]) {
    const config = options(t);
    config.commandEnvironment = { ...config.commandEnvironment, ...environment };
    const result = await certifyCleanCheckout(config);
    assert.equal(result.status, 'failed');
    assert.equal(fs.existsSync(config.cleanupMarker), true);
    assert.equal(fs.existsSync(path.join(config.outputRoot, `${play}-${config.sourceSha}`)), false);
    assert.equal(readJson(result.failure_receipt).published, false);
  }
});

test('timeout kills the process tree and output limits stop unbounded commands', async (t) => {
  const markerRoot = outputRoot(t);
  const childMarker = path.join(markerRoot, 'child-alive.txt');
  const timeoutConfig = options(t, { mutateProfiles: (profiles) => {
    profiles.delivery.vertical_slice.commands.security.arguments = ['fixture-command.mjs', 'timeout', profiles.delivery.vertical_slice.commands.security.receipt];
    profiles.delivery.vertical_slice.commands.security.timeout_seconds = 1;
  } });
  timeoutConfig.commandEnvironment = { ...timeoutConfig.commandEnvironment, FROOTAI_FIXTURE_CHILD_MARKER: childMarker };
  const timeoutResult = await certifyCleanCheckout(timeoutConfig);
  assert.equal(timeoutResult.status, 'failed');
  assert.match(timeoutResult.reason, /security/);
  await new Promise((resolve) => setTimeout(resolve, 3500));
  assert.equal(fs.existsSync(childMarker), false);

  const floodConfig = options(t, { mutateProfiles: (profiles) => {
    profiles.delivery.vertical_slice.commands.security.arguments = ['fixture-command.mjs', 'flood', profiles.delivery.vertical_slice.commands.security.receipt];
  }, options: { maximumOutputBytes: 1024 } });
  const floodResult = await certifyCleanCheckout(floodConfig);
  assert.equal(floodResult.status, 'failed');
  assert.match(floodResult.reason, /security/);
});

test('pre-publication failure, dirty source, and wrong SHA retain failure receipts without partial bundles', async (t) => {
  const injected = options(t, { options: { injectFailure: 'before-publish' } });
  const injectedResult = await certifyCleanCheckout(injected);
  assert.equal(injectedResult.status, 'failed');
  assert.equal(fs.readdirSync(injected.outputRoot).some((name) => name.includes('.staging-')), false);

  const dirty = options(t);
  fs.writeFileSync(path.join(dirty.repositoryPath, 'dirty.txt'), 'dirty', 'utf8');
  const dirtyResult = await certifyCleanCheckout(dirty);
  assert.match(dirtyResult.reason, /not clean/);

  const mismatch = options(t);
  mismatch.sourceSha = 'f'.repeat(40);
  const mismatchResult = await certifyCleanCheckout(mismatch);
  assert.equal(mismatchResult.status, 'failed');
  assert.match(mismatchResult.reason, /checkout failed/);
});

test('concurrent writers produce one authoritative winner and explicit loser receipt', async (t) => {
  const config = options(t, { options: { holdLockMilliseconds: 300 } });
  const [left, right] = await Promise.all([certifyCleanCheckout(config), certifyCleanCheckout(config)]);
  const statuses = [left.status, right.status].sort();
  assert.deepEqual(statuses, ['contended', 'passed']);
  const loser = left.status === 'contended' ? left : right;
  assert.equal(readJson(loser.failure_receipt).status, 'contended');
  const winner = left.status === 'passed' ? left : right;
  assert.equal(verifyPublishedBundle(winner.bundle_path).valid, true);
});

test('dead-PID stale locks are archived before certification proceeds', async (t) => {
  const config = options(t);
  const target = `${play}-${config.sourceSha}`;
  const lockPath = path.join(config.outputRoot, `${target}.lock`);
  writeJson(lockPath, { pid: 999999, acquired_at: '2020-01-01T00:00:00Z', source_sha: config.sourceSha });
  const result = await certifyCleanCheckout(config);
  assert.equal(result.status, 'passed', result.reason);
  assert.equal(fs.existsSync(lockPath), false);
  assert.equal(fs.readdirSync(config.outputRoot).some((name) => name.includes('.stale-lock-')), true);
});

test('a stale lock for a different source SHA is preserved as contention evidence', async (t) => {
  const config = options(t);
  const target = `${play}-${config.sourceSha}`;
  const lockPath = path.join(config.outputRoot, `${target}.lock`);
  writeJson(lockPath, { pid: 999999, acquired_at: '2020-01-01T00:00:00Z', source_sha: 'f'.repeat(40) });
  const result = await certifyCleanCheckout(config);
  assert.equal(result.status, 'contended');
  assert.equal(fs.existsSync(lockPath), true);
});

test('rejects symbolic links when the host supports creating them', (t) => {
  const tree = fs.mkdtempSync(path.join(os.tmpdir(), 'frootai-cert-symlink-'));
  t.after(() => fs.rmSync(tree, { recursive: true, force: true }));
  const outside = path.join(tree, 'outside.txt');
  fs.writeFileSync(outside, 'outside', 'utf8');
  try { fs.symlinkSync(outside, path.join(tree, 'link.txt')); }
  catch (error) {
    if (error.code === 'EPERM') return t.skip('symbolic link creation requires host privilege');
    throw error;
  }
  assert.throws(() => assertSafeTree(tree), /symbolic link prohibited/);
});

test('rejects invalid future clock and missing committed toolchain lock', async (t) => {
  const clock = options(t);
  clock.generatedAt = '2999-01-01T00:00:00Z';
  assert.match((await certifyCleanCheckout(clock)).reason, /clock-skew/);

  const noLock = options(t);
  fs.rmSync(path.join(noLock.repositoryPath, 'toolchain.lock.json'));
  git(noLock.repositoryPath, 'add', '-A');
  git(noLock.repositoryPath, 'commit', '--quiet', '-m', 'remove lock');
  noLock.sourceSha = git(noLock.repositoryPath, 'rev-parse', 'HEAD');
  assert.match((await certifyCleanCheckout(noLock)).reason, /toolchain lock/);

  const excessiveTtl = options(t, { mutateFiles: ({ playRoot }) => {
    const policyPath = path.join(playRoot, 'contracts', 'certification-policy.json');
    const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
    policy.ttl_hours = 25;
    writeJson(policyPath, policy);
  } });
  assert.match((await certifyCleanCheckout(excessiveTtl)).reason, /certification TTL/);
});

test('rejects environment injection and expired bundle reuse', async (t) => {
  const injectedEnvironment = options(t);
  injectedEnvironment.commandEnvironment.PATH = 'attacker-controlled';
  assert.match((await certifyCleanCheckout(injectedEnvironment)).reason, /environment key is not allowed/);

  const config = options(t);
  const result = await certifyCleanCheckout(config);
  assert.equal(result.status, 'passed', result.reason);
  const verdictPath = path.join(result.bundle_path, 'verdict.json');
  const verdict = readJson(verdictPath);
  verdict.expires_at = '2020-01-01T00:00:00Z';
  fs.writeFileSync(verdictPath, `${JSON.stringify(verdict, null, 2)}\n`, 'utf8');
  assert.match(verifyPublishedBundle(result.bundle_path).reason, /expired|mismatch/);
  verdict.expires_at = 'not-a-date';
  fs.writeFileSync(verdictPath, `${JSON.stringify(verdict, null, 2)}\n`, 'utf8');
  assert.equal(verifyPublishedBundle(result.bundle_path).reason, 'bundle verdict expired');
});

test('rejects a stale hand-authored pass receipt that was not produced by this run', async (t) => {
  const config = options(t, {
    mutateProfiles: (profiles) => {
      const command = profiles.delivery.vertical_slice.commands.security;
      command.arguments = ['fixture-command.mjs', 'no-receipt', command.receipt];
    },
    mutateFiles: ({ playRoot, profiles }) => {
      writeJson(path.join(playRoot, profiles.delivery.vertical_slice.commands.security.receipt), { status: 'passed', command: 'security', run_id: 'forged-run' });
    },
  });
  const result = await certifyCleanCheckout(config);
  assert.equal(result.status, 'failed');
  assert.match(result.reason, /receipt_invalid/);
});