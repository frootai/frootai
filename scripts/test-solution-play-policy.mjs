import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { evaluateLifecyclePolicy } from './solution-play-policy.mjs';

const policy = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '..', 'data', 'certification', 'enterprise-policy.v1.json'), 'utf8'));
const request = {
  action: 'what_if', certification: 'evaluation_verified', provider: 'azure', model: 'offline/rules-v1',
  region: 'eastus2', monthlyCost: 500, environment: 'dev', networkPosture: 'private',
  managedIdentity: true, privateEndpoints: true, approvals: [],
};

test('allows a compliant non-mutating what-if request', () => {
  const result = evaluateLifecyclePolicy(policy, request);
  assert.equal(result.allowed, true);
  assert.deepEqual(result.violations, []);
});

test('blocks unsupported providers, models, and regions', () => {
  const result = evaluateLifecyclePolicy(policy, { ...request, provider: 'unknown', model: 'unapproved/model', region: 'moon' });
  assert.equal(result.allowed, false);
  assert.match(result.violations.join(' '), /provider/);
  assert.match(result.violations.join(' '), /model/);
  assert.match(result.violations.join(' '), /region/);
});

test('blocks budget and production network violations', () => {
  const result = evaluateLifecyclePolicy(policy, {
    ...request, action: 'deploy_preview', environment: 'production', monthlyCost: 12000,
    networkPosture: 'public', managedIdentity: false, privateEndpoints: false, approvals: ['founder'],
  });
  assert.equal(result.allowed, false);
  assert.match(result.violations.join(' '), /budget/);
  assert.match(result.violations.join(' '), /private network/);
  assert.match(result.violations.join(' '), /managed identity/);
  assert.match(result.violations.join(' '), /private endpoints/);
});

test('blocks actions above current contiguous certification', () => {
  const result = evaluateLifecyclePolicy(policy, { ...request, action: 'deploy_production', certification: 'evaluation_verified', approvals: ['one', 'two'] });
  assert.equal(result.allowed, false);
  assert.match(result.violations.join(' '), /certification/);
});

test('blocks mutating actions without enough distinct approvals', () => {
  const result = evaluateLifecyclePolicy(policy, { ...request, action: 'deploy_preview', approvals: [] });
  assert.equal(result.allowed, false);
  assert.match(result.violations.join(' '), /approval/);
});

test('fails closed for unknown actions or missing policy', () => {
  assert.equal(evaluateLifecyclePolicy(policy, { ...request, action: 'invent' }).allowed, false);
  assert.equal(evaluateLifecyclePolicy(null, request).allowed, false);
});
