import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { buildCertificationIndex } from './build-solution-play-certification.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'schemas', 'solution-play-certification-evidence.v1.schema.json'), 'utf8'));
const policy = JSON.parse(fs.readFileSync(path.join(root, 'data', 'certification', 'flagship-v1.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const generatedAt = '2026-07-18T12:00:00.000Z';
const index = await buildCertificationIndex({ generatedAt });

test('certification index covers all 101 plays and five flagships', () => {
  assert.equal(index.count, 101);
  assert.equal(index.plays.length, 101);
  assert.equal(index.summary.flagship, 5);
  assert.deepEqual(index.plays.filter((play) => play.profile === 'flagship-v1').map((play) => play.slug), policy.cohort);
});

test('every evidence record validates against the canonical schema', () => {
  for (const record of index.records) {
    assert.equal(validate(record.evidence), true, `${record.play}: ${ajv.errorsText(validate.errors)}`);
  }
});

test('every certification level is derived from evidence and content-bound', () => {
  for (const record of index.records) {
    assert.equal(record.evidence.subject.slug, record.play);
    assert.match(record.evidence.subject.content_sha256, /^[a-f0-9]{64}$/);
    assert.equal(record.certification.valid, record.certification.level !== null);
  }
});

test('all five flagships retain a passed Designed foundation after promotion', () => {
  const flagships = index.records.filter((record) => policy.cohort.includes(record.play));
  const failures = flagships.filter((record) => record.evidence.stages.designed.status !== 'passed')
    .map((record) => ({ play: record.play, checks: record.evidence.stages.designed.checks.filter((check) => check.status !== 'passed') }));
  assert.deepEqual(failures, []);
});

test('five flagships reach Evaluation Verified but cannot skip into Azure stages', () => {
  const flagships = index.records.filter((record) => policy.cohort.includes(record.play));
  assert.deepEqual(flagships.map((record) => record.certification.level), Array(5).fill('evaluation_verified'));
  for (const record of flagships) {
    assert.equal(record.evidence.stages.deploy_verified.status, 'failed');
    assert.equal(record.evidence.stages.production_observed.status, 'failed');
  }
});
