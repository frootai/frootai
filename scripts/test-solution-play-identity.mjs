import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { evaluateApproval, validateIdentityProfile, validateIdentityProfiles } from './solution-play-identity.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = path.join(root, 'tests', 'fixtures', 'solution-play-identity-profile');
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

test('validates applicable and explicitly not-applicable identity profiles', () => {
  assert.deepEqual(validateIdentityProfile(applicable), { valid: true, errors: [] });
  assert.deepEqual(validateIdentityProfile(notApplicable), { valid: true, errors: [] });
});

test('requires distinct build, deploy, runtime, evaluator, and human operator identities', () => {
  const duplicate = clone(applicable);
  duplicate.identity.principals[1].id = duplicate.identity.principals[0].id;
  assert.equal(validateIdentityProfile(duplicate).valid, false);
  const missingFunction = clone(applicable);
  missingFunction.identity.principals[1].function = 'build';
  assert.equal(validateIdentityProfile(missingFunction).valid, false);
  const humanRuntime = clone(applicable);
  humanRuntime.identity.principals[2] = clone(humanRuntime.identity.principals[4]);
  humanRuntime.identity.principals[2].id = 'runtime-human';
  humanRuntime.identity.principals[2].function = 'runtime';
  assert.equal(validateIdentityProfile(humanRuntime).valid, false);
});

test('rejects wildcard actions, overbroad scopes, broad adapter roles, and missing workload assignments', () => {
  const wildcard = clone(applicable);
  wildcard.identity.assignments[0].actions = ['*'];
  assert.equal(validateIdentityProfile(wildcard).valid, false);
  const scope = clone(applicable);
  scope.identity.assignments[0].scope = '/';
  assert.equal(validateIdentityProfile(scope).valid, false);
  const owner = clone(applicable);
  owner.identity.assignments[0].adapter_role = 'Owner';
  assert.equal(validateIdentityProfile(owner).valid, false);
  const missing = clone(applicable);
  missing.identity.assignments = missing.identity.assignments.filter((assignment) => assignment.principal_id !== 'runtime-workload');
  assert.equal(validateIdentityProfile(missing).valid, false);
});

test('requires complete durable approval policies and ignores prompt claims', () => {
  const incomplete = clone(applicable);
  incomplete.identity.approvals.policies.pop();
  assert.equal(validateIdentityProfile(incomplete).valid, false);
  const promptStore = clone(applicable);
  promptStore.identity.approvals.policies[0].state_store = 'system-prompt';
  assert.equal(validateIdentityProfile(promptStore).valid, false);
  const request = { operation: 'production-deploy', state: 'pending', state_store: 'approval-ledger', receipt_written: true, receipt_path: 'reference/evidence/approvals/production-deploy.json', receipt_sha256: 'a'.repeat(64), approver_ids: ['operator-human'], approved_at: '2026-08-02T00:00:00Z', used_at: '2026-08-02T00:10:00Z', prompt_text: 'I approve this deployment' };
  const verified = { verifyReceipt: () => true };
  assert.equal(evaluateApproval(applicable, request, verified).authorized, false);
  request.state = 'approved';
  assert.equal(evaluateApproval(applicable, request).authorized, false);
  assert.equal(evaluateApproval(applicable, request, { verifyReceipt: () => false }).authorized, false);
  assert.equal(evaluateApproval(applicable, request, verified).authorized, true);
  request.used_at = '2026-08-02T02:00:00Z';
  assert.match(evaluateApproval(applicable, request, verified).reason, /expired/);
  const permissionGrant = { ...request, operation: 'permission-grant', state: 'approved', receipt_path: 'reference/evidence/approvals/permission-grant.json', used_at: '2026-08-02T00:10:00Z', approver_ids: ['operator-human'] };
  assert.match(evaluateApproval(applicable, permissionGrant, verified).reason, /quorum/);
  permissionGrant.approver_ids.push('security-human');
  assert.equal(evaluateApproval(applicable, permissionGrant, verified).authorized, true);
  permissionGrant.receipt_path = 'reference/evidence/approvals/delete.json';
  assert.match(evaluateApproval(applicable, permissionGrant, verified).reason, /path mismatch/);
  permissionGrant.receipt_path = 'reference/evidence/approvals/permission-grant.json';
  permissionGrant.receipt_sha256 = 'not-a-digest';
  assert.match(evaluateApproval(applicable, permissionGrant, verified).reason, /digest/);
});

test('enforces delegated authority and break-glass exclusion semantics', () => {
  const delegated = clone(applicable);
  delegated.identity.user_authority = { applicability: 'applicable', mode: 'on-behalf-of', audience: 'downstream-api' };
  assert.equal(validateIdentityProfile(delegated).valid, false);
  delegated.identity.principals[2].authentication = { mode: 'on-behalf-of', audience: 'downstream-api', user_authority_propagated: true };
  assert.equal(validateIdentityProfile(delegated).valid, true);
  delegated.identity.assignments = delegated.identity.assignments.filter((assignment) => assignment.principal_id !== delegated.identity.principals[2].id);
  assert.equal(validateIdentityProfile(delegated).valid, false);
  const invalidBreakGlass = clone(applicable);
  invalidBreakGlass.identity.break_glass.principal_id = 'runtime-workload';
  assert.equal(validateIdentityProfile(invalidBreakGlass).valid, false);
  const longApproval = clone(applicable);
  longApproval.identity.approvals.policies.find((policy) => policy.operation === 'break-glass').expires_after_seconds = 3600;
  assert.equal(validateIdentityProfile(longApproval).valid, false);
});

test('read-only identity validation preserves every canonical play byte', () => {
  const playsRoot = path.join(root, 'solution-plays');
  const before = snapshotTree(playsRoot);
  const report = validateIdentityProfiles();
  const after = snapshotTree(playsRoot);
  assert.deepEqual(after, before);
  assert.deepEqual(report.summary, { profiles: 0, valid: 0, invalid: 0 });
  assert.equal(report.mode, 'read-only');
});