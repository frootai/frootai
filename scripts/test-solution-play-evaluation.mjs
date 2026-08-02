import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { datasetLineageDigest, evaluateThreshold, evaluationEvidenceEligibility, prepareEvaluationRecord, validateEvaluationProfile, validateEvaluationProfiles } from './solution-play-evaluation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = path.join(root, 'tests', 'fixtures', 'solution-play-evaluation-profile');
const applicable = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'applicable.json'), 'utf8'));
const notApplicable = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'not-applicable.json'), 'utf8'));

function clone(value) { return structuredClone(value); }
function snapshotTree(treeRoot, current = treeRoot, snapshot = {}) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const entryPath = path.join(current, entry.name);
    if (entry.isDirectory()) snapshotTree(treeRoot, entryPath, snapshot);
    if (entry.isFile()) snapshot[path.relative(treeRoot, entryPath).split(path.sep).join('/')] = crypto.createHash('sha256').update(fs.readFileSync(entryPath)).digest('hex');
  }
  return snapshot;
}

test('validates applicable and explicitly not-applicable evaluation profiles', () => {
  assert.deepEqual(validateEvaluationProfile(applicable), { valid: true, errors: [] });
  assert.deepEqual(validateEvaluationProfile(notApplicable), { valid: true, errors: [] });
});

test('requires complete collection policy, outcome states, suites, unique IDs, and valid references', () => {
  const missingContext = clone(applicable);
  missingContext.evaluation.collection.input_context.pop();
  assert.equal(validateEvaluationProfile(missingContext).valid, false);
  const missingOutcome = clone(applicable);
  missingOutcome.evaluation.outcomes.pop();
  assert.equal(validateEvaluationProfile(missingOutcome).valid, false);
  const missingSuite = clone(applicable);
  missingSuite.evaluation.suites.pop();
  assert.equal(validateEvaluationProfile(missingSuite).valid, false);
  const duplicateDataset = clone(applicable);
  duplicateDataset.evaluation.datasets.push(clone(duplicateDataset.evaluation.datasets[0]));
  assert.equal(validateEvaluationProfile(duplicateDataset).valid, false);
  const danglingReference = clone(applicable);
  danglingReference.evaluation.suites[0].evaluator_ids = ['missing-evaluator'];
  assert.equal(validateEvaluationProfile(danglingReference).valid, false);
});

test('produces deterministic dataset lineage and changes when provenance changes', () => {
  const dataset = applicable.evaluation.datasets[0];
  const first = datasetLineageDigest(dataset);
  assert.equal(datasetLineageDigest(clone(dataset)), first);
  const changed = clone(dataset);
  changed.source.commit_sha = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  assert.notEqual(datasetLineageDigest(changed), first);
  const reviewedLater = clone(dataset);
  reviewedLater.leakage_review.reviewed_at = '2026-08-03T00:00:00Z';
  assert.notEqual(datasetLineageDigest(reviewedLater), first);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test('threshold boundaries emit passed, failed, unavailable, skipped, and not_applicable outcomes', () => {
  const evaluator = applicable.evaluation.evaluators[0];
  assert.deepEqual(evaluateThreshold(evaluator, { status: 'measured', value: 0.9, sample_count: 20, samples_by_split: { test: 20 } }), { status: 'passed', blocking: false });
  assert.deepEqual(evaluateThreshold(evaluator, { status: 'measured', value: 0.89, sample_count: 20, samples_by_split: { test: 20 } }), { status: 'failed', blocking: true });
  assert.equal(evaluateThreshold(evaluator, { status: 'measured', value: 1, sample_count: 19, samples_by_split: { test: 19 } }).status, 'unavailable');
  assert.match(evaluateThreshold(evaluator, { status: 'measured', value: 1, sample_count: 20, samples_by_split: { test: 19 } }).reason, /split: test/);
  assert.deepEqual(evaluateThreshold(evaluator, { status: 'skipped' }), { status: 'skipped', blocking: false });
  assert.deepEqual(evaluateThreshold(evaluator, { status: 'not_applicable' }), { status: 'not_applicable', blocking: false });
  assert.deepEqual(evaluateThreshold(evaluator, { status: 'unavailable' }), { status: 'unavailable', blocking: false });
});

test('prepares complete evaluation records while redacting text and rejecting prohibited capture', () => {
  const record = {
    input: { query: 'email person@example.com', files: [{ path: 'input.txt', sha256: 'a'.repeat(64), content: 'owner person@example.com' }], workspace_state: { sha256: 'b'.repeat(64) }, configuration: { mode: 'test' }, environment_context: ['MODEL_NAME'] },
    output: { final_response: 'contact person@example.com', workspace_changes: [{ path: 'result.txt', before: 'person@example.com', after: '[removed]' }], generated_files: [{ path: 'report.txt', sha256: 'c'.repeat(64), content: 'person@example.com' }] },
    conversation_history: [{ role: 'user', content: 'email person@example.com' }],
  };
  const options = { redactText: (text) => text.replaceAll('person@example.com', '[REDACTED]'), containsProtectedText: (text) => text.includes('person@example.com') };
  const prepared = prepareEvaluationRecord(record, options);
  assert.equal(JSON.stringify(prepared).includes('person@example.com'), false);
  const prohibited = clone(record);
  prohibited.input.authorization_header = 'Bearer secret';
  assert.throws(() => prepareEvaluationRecord(prohibited, options), /prohibited evaluation field/);
  const rawEnvironment = clone(record);
  rawEnvironment.input.environment_context = [{ MODEL_NAME: 'secret-value' }];
  assert.throws(() => prepareEvaluationRecord(rawEnvironment, options), /variable names only/);
  const missedRedaction = clone(record);
  assert.throws(() => prepareEvaluationRecord(missedRedaction, { redactText: (text) => text, containsProtectedText: options.containsProtectedText }), /protected evaluation content remains/);
  const structuredDiff = clone(record);
  structuredDiff.output.workspace_changes[0].before = { nested: 'person@example.com' };
  const redactedDiff = prepareEvaluationRecord(structuredDiff, options);
  assert.equal(JSON.stringify(redactedDiff).includes('person@example.com'), false);
});

test('requires confidence level and immutable verification evidence for applicable overlays', () => {
  const noConfidence = clone(applicable);
  delete noConfidence.evaluation.comparison.confidence_level;
  assert.equal(validateEvaluationProfile(noConfidence).valid, false);
  const unverifiedOverlay = clone(applicable);
  unverifiedOverlay.evaluation.foundry_overlay = { applicability: 'applicable', suite_name: 'suite', suite_version: '1', remote_verified_at: '2026-08-02T00:00:00Z', generation_source: 'generated', evidence_eligibility: 'overlay-only' };
  assert.equal(validateEvaluationProfile(unverifiedOverlay).valid, false);
});

test('enforces split minima, regression evaluator references, and overlay-only evidence', () => {
  const missingSplitMinimum = clone(applicable);
  delete missingSplitMinimum.evaluation.evaluators[0].minimum_samples_by_split.test;
  assert.equal(validateEvaluationProfile(missingSplitMinimum).valid, false);
  const unknownBudget = clone(applicable);
  unknownBudget.evaluation.comparison.regression_budget[0].metric = 'missing-evaluator';
  assert.equal(validateEvaluationProfile(unknownBudget).valid, false);
  assert.deepEqual(evaluationEvidenceEligibility(applicable, { source: 'primary' }), { eligible: true, reason: null });
  assert.equal(evaluationEvidenceEligibility(applicable, { source: 'foundry-overlay' }).eligible, false);
});

test('read-only evaluation validation preserves every canonical play byte', () => {
  const playsRoot = path.join(root, 'solution-plays');
  const before = snapshotTree(playsRoot);
  const report = validateEvaluationProfiles();
  const after = snapshotTree(playsRoot);
  assert.deepEqual(after, before);
  assert.deepEqual(report.summary, { profiles: 0, valid: 0, invalid: 0 });
  assert.equal(report.mode, 'read-only');
});