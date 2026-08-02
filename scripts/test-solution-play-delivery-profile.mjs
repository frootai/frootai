import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateDeliveryProfile, validateDeliveryProfiles } from './validate-solution-play-delivery-profile.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = path.join(root, 'tests', 'fixtures', 'solution-play-delivery-profile');
const applicable = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'applicable.json'), 'utf8'));
const notApplicable = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'not-applicable.json'), 'utf8'));

function clone(value) {
  return structuredClone(value);
}

function snapshotTree(treeRoot, current = treeRoot, snapshot = {}) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const entryPath = path.join(current, entry.name);
    if (entry.isDirectory()) snapshotTree(treeRoot, entryPath, snapshot);
    if (entry.isFile()) {
      const relativePath = path.relative(treeRoot, entryPath).split(path.sep).join('/');
      snapshot[relativePath] = crypto.createHash('sha256').update(fs.readFileSync(entryPath)).digest('hex');
    }
  }
  return snapshot;
}

test('validates deterministic, workflow, single-agent, and multi-agent profiles', () => {
  for (const kind of ['deterministic-function', 'workflow', 'single-agent', 'multi-agent']) {
    const profile = clone(applicable);
    profile.vertical_slice.topology.kind = kind;
    assert.deepEqual(validateDeliveryProfile(profile), { valid: true, errors: [] }, kind);
  }
  assert.deepEqual(validateDeliveryProfile(notApplicable), { valid: true, errors: [] });
});

test('rejects architecture-only applicable profiles and unsafe paths', () => {
  const architectureOnly = { schema_version: '1.1.0', play: '01-enterprise-rag', applicability: 'applicable' };
  assert.equal(validateDeliveryProfile(architectureOnly).valid, false);

  const unsafe = clone(applicable);
  unsafe.vertical_slice.layout.app = '../outside';
  assert.equal(validateDeliveryProfile(unsafe).valid, false);

  for (const candidate of ['C:\\outside', '\\\\server\\share', 'reference\\app']) {
    const windowsPath = clone(applicable);
    windowsPath.vertical_slice.layout.app = candidate;
    assert.equal(validateDeliveryProfile(windowsPath).valid, false, candidate);
  }
});

test('rejects incomplete command lifecycle and non-idempotent cleanup', () => {
  const missingCleanup = clone(applicable);
  delete missingCleanup.vertical_slice.commands.cleanup;
  assert.equal(validateDeliveryProfile(missingCleanup).valid, false);

  const missingRollback = clone(applicable);
  delete missingRollback.vertical_slice.commands.rollback;
  assert.equal(validateDeliveryProfile(missingRollback).valid, false);

  const missingDeploy = clone(applicable);
  delete missingDeploy.vertical_slice.commands.deploy;
  assert.equal(validateDeliveryProfile(missingDeploy).valid, false);

  const unsafeCleanup = clone(applicable);
  unsafeCleanup.vertical_slice.commands.cleanup.idempotent = false;
  assert.equal(validateDeliveryProfile(unsafeCleanup).valid, false);

  const service = clone(applicable);
  service.vertical_slice.commands.start.mode = 'service';
  assert.equal(validateDeliveryProfile(service).valid, false);
  service.vertical_slice.commands.stop = {
    ...clone(service.vertical_slice.commands.start),
    mode: 'finite',
    arguments: ['app/stop.mjs'],
    receipt: 'reference/evidence/stop.json',
  };
  assert.equal(validateDeliveryProfile(service).valid, true);
});

test('rejects secret-bearing, privileged, interactive, unbounded, and conflated contracts', () => {
  const cases = [
    ['inline secret', 'setup', 'API_TOKEN=secret'],
    ['credential URL', 'setup', 'https://user:password@example.invalid/repo'],
    ['interactive mode', 'deploy', '--interactive'],
    ['unbounded watch', 'test', '--watch'],
  ];
  for (const [name, command, argument] of cases) {
    const profile = clone(applicable);
    profile.vertical_slice.commands[command].arguments.push(argument);
    assert.equal(validateDeliveryProfile(profile).valid, false, name);
  }

  for (const executable of ['sudo', '/usr/bin/sudo', 'runas', 'doas', 'su']) {
    const profile = clone(applicable);
    profile.vertical_slice.commands.deploy.executable = executable;
    assert.equal(validateDeliveryProfile(profile).valid, false, executable);
  }

  const conflated = clone(applicable);
  conflated.vertical_slice.layout.developer_agents = conflated.vertical_slice.layout.app;
  assert.equal(validateDeliveryProfile(conflated).valid, false);
});

test('rejects command paths and receipts outside their contract boundaries', () => {
  const outsideWorkingDirectory = clone(applicable);
  outsideWorkingDirectory.vertical_slice.commands.setup.working_directory = 'outside';
  assert.equal(validateDeliveryProfile(outsideWorkingDirectory).valid, false);

  const outsideReceipt = clone(applicable);
  outsideReceipt.vertical_slice.commands.setup.receipt = 'reference/ops/setup.json';
  assert.equal(validateDeliveryProfile(outsideReceipt).valid, false);

  const duplicateReceipt = clone(applicable);
  duplicateReceipt.vertical_slice.commands.test.receipt = duplicateReceipt.vertical_slice.commands.setup.receipt;
  assert.equal(validateDeliveryProfile(duplicateReceipt).valid, false);
});

test('read-only repository validation does not create canonical profiles', () => {
  const playsRoot = path.join(root, 'solution-plays');
  const before = snapshotTree(playsRoot);
  const report = validateDeliveryProfiles();
  const after = snapshotTree(playsRoot);
  assert.deepEqual(after, before);
  assert.deepEqual(report.summary, { profiles: 0, valid: 0, invalid: 0 });
  assert.equal(report.mode, 'read-only');
});