import assert from 'node:assert/strict';
import test from 'node:test';
import { certifyEvidence, STAGE_ORDER } from './solution-play-certification.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './solution-play-certification.mjs';

const now = new Date('2026-07-18T12:00:00.000Z');
const canonicalPolicy = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '..', 'data', 'certification', 'flagship-v1.json'), 'utf8'));
const policy = {
  ...canonicalPolicy,
  stages: Object.fromEntries(Object.keys(canonicalPolicy.stages).map((name) => [name, { ...canonicalPolicy.stages[name], required_checks: ['contract'] }])),
};
const policySha = sha256(Buffer.from(`${JSON.stringify(policy, null, 2)}\n`));

function stage(status = 'passed', overrides = {}) {
  const detail = `fixture ${status}`;
  const id = 'contract';
  return {
    status,
    generated_at: '2026-07-18T10:00:00.000Z',
    expires_at: '2026-07-19T10:00:00.000Z',
    checks: [{ id, status, blocking: true, output_sha256: sha256(JSON.stringify({ id, passed: status === 'passed', detail })), metrics: { detail } }],
    artifacts: [{ type: 'fixture', url: 'fixture.txt', sha256: sha256(Buffer.from('fixture artifact')) }],
    ...overrides,
  };
}

function evidence(overrides = {}) {
  return {
    schema_version: '1.0.0',
    subject: {
      play_id: '03', slug: '03-deterministic-agent', commit_sha: 'b'.repeat(40),
      content_sha256: 'c'.repeat(64), manifest_sha256: 'd'.repeat(64),
    },
    policy: { profile: 'flagship-v1', profile_sha256: policySha },
    generated_at: '2026-07-18T10:00:00.000Z',
    stages: { designed: stage() },
    ...overrides,
  };
}

function verify(document, overrides = {}) {
  return certifyEvidence(document, {
    now,
    expectedContentSha256: 'c'.repeat(64),
    expectedCommitSha: 'b'.repeat(40),
    policy,
    expectedPolicySha256: policySha,
    artifactResolver: () => Buffer.from('fixture artifact'),
    ...overrides,
  });
}

test('stage order is explicit and stable', () => {
  assert.deepEqual(STAGE_ORDER, [
    'designed', 'scaffold_verified', 'build_verified',
    'evaluation_verified', 'deploy_verified', 'production_observed',
  ]);
});

test('promotes to the highest contiguous passed stage', () => {
  const document = evidence({ stages: {
    designed: stage(), scaffold_verified: stage(), build_verified: stage(),
  }});
  const result = verify(document);
  assert.equal(result.level, 'build_verified');
  assert.equal(result.valid, true);
});

test('does not skip a missing stage', () => {
  const document = evidence({ stages: { designed: stage(), build_verified: stage() } });
  const result = verify(document);
  assert.equal(result.level, 'designed');
  assert.match(result.reasons.join(' '), /scaffold_verified/);
});

test('demotes on blocking failure', () => {
  const document = evidence({ stages: {
    designed: stage(), scaffold_verified: stage(), build_verified: stage('failed'),
  }});
  const result = verify(document);
  assert.equal(result.level, 'scaffold_verified');
  assert.equal(result.valid, true);
});

test('fails closed on expired evidence', () => {
  const document = evidence({ stages: {
    designed: stage('passed', { expires_at: '2026-07-18T11:00:00.000Z' }),
  }});
  const result = verify(document);
  assert.equal(result.level, null);
  assert.equal(result.valid, false);
  assert.match(result.reasons.join(' '), /expired/);
});

test('fails closed on content hash drift', () => {
  const result = verify(evidence(), { expectedContentSha256: 'f'.repeat(64) });
  assert.equal(result.level, null);
  assert.equal(result.valid, false);
  assert.match(result.reasons.join(' '), /content hash/i);
});

test('fails closed when a passed stage has no blocking checks', () => {
  const document = evidence({ stages: { designed: stage('passed', { checks: [] }) } });
  const result = verify(document);
  assert.equal(result.level, null);
  assert.equal(result.valid, false);
});

test('fails closed when a canonical artifact hash does not match', () => {
  const document = evidence({ stages: { designed: stage('passed', { artifacts: [{ type: 'manifest', url: 'manifest.json', sha256: 'f'.repeat(64) }] }) } });
  const result = verify(document, {
    artifactResolver: () => Buffer.from('actual manifest'),
  });
  assert.equal(result.level, null);
  assert.match(result.reasons.join(' '), /artifact manifest hash does not match/);
});

test('fails closed on future-dated or overlong evidence windows', () => {
  const future = evidence({
    generated_at: '2099-01-01T00:00:00.000Z',
    stages: { designed: stage('passed', { generated_at: '2099-01-01T00:00:00.000Z', expires_at: '2099-02-01T00:00:00.000Z' }) },
  });
  const futureResult = verify(future);
  assert.equal(futureResult.level, null);
  assert.match(futureResult.reasons.join(' '), /future/);

  const overlong = evidence({ stages: { designed: stage('passed', { expires_at: '2027-01-01T00:00:00.000Z' }) } });
  const overlongResult = verify(overlong);
  assert.equal(overlongResult.level, null);
  assert.match(overlongResult.reasons.join(' '), /policy TTL/);
});
