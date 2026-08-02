import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { assessOperationsReadiness, operationalReceiptPaths, validateOperationsProfile, validateOperationsProfiles } from './solution-play-operations.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = path.join(root, 'tests', 'fixtures', 'solution-play-operations-profile');
const applicable = JSON.parse(fs.readFileSync(path.join(fixtures, 'applicable.json'), 'utf8'));
const notApplicable = JSON.parse(fs.readFileSync(path.join(fixtures, 'not-applicable.json'), 'utf8'));
const clone = (value) => structuredClone(value);

function snapshotTree(treeRoot, current = treeRoot, snapshot = {}) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const entryPath = path.join(current, entry.name);
    if (entry.isDirectory()) snapshotTree(treeRoot, entryPath, snapshot);
    if (entry.isFile()) snapshot[path.relative(treeRoot, entryPath).split(path.sep).join('/')] = crypto.createHash('sha256').update(fs.readFileSync(entryPath)).digest('hex');
  }
  return snapshot;
}

test('validates applicable and explicitly not-applicable operations profiles', () => {
  assert.deepEqual(validateOperationsProfile(applicable), { valid: true, errors: [] });
  assert.deepEqual(validateOperationsProfile(notApplicable), { valid: true, errors: [] });
});

test('rejects unsafe production promotion, public access, insufficient quota, scaling, and failover', () => {
  const promotion = clone(applicable);
  promotion.operations.environments.find((environment) => environment.name === 'production').promotion_from = 'development';
  assert.equal(validateOperationsProfile(promotion).valid, false);
  const publicAccess = clone(applicable);
  publicAccess.operations.environments.find((environment) => environment.name === 'production').public_access = 'enabled-approved';
  assert.equal(validateOperationsProfile(publicAccess).valid, false);
  const isolation = clone(applicable);
  isolation.operations.environments.find((environment) => environment.name === 'production').isolation = 'process';
  assert.equal(validateOperationsProfile(isolation).valid, false);
  const skippedDevelopment = clone(applicable);
  skippedDevelopment.operations.environments.find((environment) => environment.name === 'staging').promotion_from = null;
  assert.equal(validateOperationsProfile(skippedDevelopment).valid, false);
  const quota = clone(applicable);
  quota.operations.platform.quotas[0].available = 50;
  assert.equal(validateOperationsProfile(quota).valid, false);
  const scaling = clone(applicable);
  scaling.operations.platform.scaling.minimum = 21;
  assert.equal(validateOperationsProfile(scaling).valid, false);
  const failover = clone(applicable);
  failover.operations.platform.regions = ['primary-region'];
  assert.equal(validateOperationsProfile(failover).valid, false);
  const fallback = clone(applicable);
  fallback.operations.platform.models[0].fallback = 'missing-model';
  assert.equal(validateOperationsProfile(fallback).valid, false);
});

test('rejects missing alert receivers, categories, budget routing, and runbook references', () => {
  const noReceiver = clone(applicable);
  noReceiver.operations.alerts[0].receivers = [];
  assert.equal(validateOperationsProfile(noReceiver).valid, false);
  const noCostAlert = clone(applicable);
  noCostAlert.operations.alerts = noCostAlert.operations.alerts.filter((alert) => alert.category !== 'cost');
  assert.equal(validateOperationsProfile(noCostAlert).valid, false);
  const missingBudgetRoute = clone(applicable);
  missingBudgetRoute.operations.cost.budget.alert_id = 'missing-alert';
  assert.equal(validateOperationsProfile(missingBudgetRoute).valid, false);
  const missingRunbookAlert = clone(applicable);
  missingRunbookAlert.operations.runbook.alert_ids.push('missing-alert');
  assert.equal(validateOperationsProfile(missingRunbookAlert).valid, false);
});

test('rejects unsafe cost, command, evidence, rollback, and cleanup declarations', () => {
  const budget = clone(applicable);
  budget.operations.cost.budget.warning_percent = 100;
  assert.equal(validateOperationsProfile(budget).valid, false);
  const volume = clone(applicable);
  volume.operations.cost.unit_economics.monthly_volume = 1000;
  assert.equal(validateOperationsProfile(volume).valid, false);
  const command = clone(applicable);
  command.operations.deployment.rollback.command_ref = 'shell.rollback';
  assert.equal(validateOperationsProfile(command).valid, false);
  const receipt = clone(applicable);
  receipt.operations.alerts[0].test_receipt_path = 'outside/alert.json';
  assert.equal(validateOperationsProfile(receipt).valid, false);
  const deletion = clone(applicable);
  deletion.operations.data_governance.deletion.command_ref = 'commands.deploy';
  assert.equal(validateOperationsProfile(deletion).valid, false);
  const missingPartialFailure = clone(applicable);
  delete missingPartialFailure.operations.deployment.cleanup.partial_failure_test_receipt_path;
  assert.equal(validateOperationsProfile(missingPartialFailure).valid, false);
});

test('readiness requires every evidence receipt and both success and partial-failure recovery proofs', () => {
  const receipts = Object.fromEntries(operationalReceiptPaths(applicable).map((receipt) => [receipt, 'passed']));
  const resolution = { resolveNotification: () => true, resolveEscalation: () => true };
  assert.equal(assessOperationsReadiness(applicable, receipts).ready, false);
  assert.deepEqual(assessOperationsReadiness(applicable, receipts, resolution), { ready: true, blockers: [] });
  assert.match(assessOperationsReadiness(applicable, receipts, { ...resolution, resolveNotification: () => false }).blockers.join('\n'), /receiver unresolved/);
  assert.match(assessOperationsReadiness(applicable, receipts, { ...resolution, resolveEscalation: () => false }).blockers.join('\n'), /contact unresolved/);
  const failedRollback = { ...receipts, 'reference/evidence/deployment/rollback-partial-failure.json': 'failed' };
  const rollbackResult = assessOperationsReadiness(applicable, failedRollback, resolution);
  assert.equal(rollbackResult.ready, false);
  assert.match(rollbackResult.blockers.join('\n'), /rollback-partial-failure/);
  const missingAlert = { ...receipts };
  delete missingAlert['reference/evidence/alerts/availability.json'];
  assert.match(assessOperationsReadiness(applicable, missingAlert, resolution).blockers.join('\n'), /availability.json: missing/);
  const blockedCapacity = clone(applicable);
  blockedCapacity.operations.platform.capacity = { status: 'unavailable', blocker: 'Capacity evidence is not available for the required production region.', owner: 'platform-owner' };
  assert.match(assessOperationsReadiness(blockedCapacity, receipts, resolution).blockers.join('\n'), /Capacity evidence/);
});

test('allows explicitly not-applicable failover without inventing a receipt', () => {
  const profile = clone(applicable);
  profile.operations.platform.failover = { mode: 'not_applicable', reason: 'The reviewed local-only workload has no remote availability objective.' };
  profile.operations.platform.regions = ['primary-region'];
  profile.operations.platform.models = [profile.operations.platform.models[0]];
  profile.operations.platform.models[0].fallback = null;
  assert.equal(validateOperationsProfile(profile).valid, true);
  assert.equal(operationalReceiptPaths(profile).some((receipt) => receipt.includes('failover-test')), false);
});

test('read-only operations validation preserves every canonical play byte', () => {
  const playsRoot = path.join(root, 'solution-plays');
  const before = snapshotTree(playsRoot);
  const report = validateOperationsProfiles();
  const after = snapshotTree(playsRoot);
  assert.deepEqual(after, before);
  assert.deepEqual(report.summary, { profiles: 0, valid: 0, invalid: 0 });
  assert.equal(report.mode, 'read-only');
});