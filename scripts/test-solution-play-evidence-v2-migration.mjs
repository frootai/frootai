import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { migrateEvidenceV1 } from './solution-play-evidence-v2-migration.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'schemas', 'solution-play-certification-evidence.v2.schema.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const hash = 'a'.repeat(64);

function evidenceV1() {
  return {
    schema_version: '1.0.0',
    subject: {
      play_id: '01',
      slug: '01-enterprise-rag',
      canonical_id: 'frootai__01-enterprise-rag',
      repository: 'https://github.com/frootai/frootai',
      commit_sha: 'b'.repeat(40),
      content_sha256: hash,
      manifest_sha256: hash,
      iac_sha256: hash,
      evaluation_dataset_sha256: null,
    },
    policy: { profile: 'flagship-v1', profile_sha256: hash },
    generated_at: '2026-08-01T00:00:00.000Z',
    stages: {
      designed: {
        status: 'passed',
        generated_at: '2026-08-01T00:00:00.000Z',
        environment: { class: 'local', tools: { node: 'v24' } },
        checks: [{ id: 'manifest', status: 'passed', blocking: true, output_sha256: hash }],
        artifacts: [{ type: 'manifest', url: 'spec/fai-manifest.json', sha256: hash, media_type: 'application/json' }],
      },
    },
  };
}

test('migration emits schema-valid evidence v2 without inventing stronger receipts', () => {
  const migrated = migrateEvidenceV1(evidenceV1(), { specSha256: hash, sourceSha256: hash });
  assert.equal(validate(migrated), true, JSON.stringify(validate.errors));
  assert.equal(migrated.stages.designed.status, 'unavailable');
  assert.equal(migrated.stages.designed.checks[0].status, 'unavailable');
  assert.equal(migrated.stages.designed.checks[0].command, 'unrecorded in evidence v1');
  assert.equal(migrated.stages.scaffold_verified.status, 'not_run');
  assert.equal(migrated.subject.iac_sha256, hash);
  assert.equal(migrated.subject.evaluation_dataset_sha256, null);
});

test('migration preserves failed status while adding explicit receipt gaps', () => {
  const source = evidenceV1();
  source.stages.designed.status = 'failed';
  source.stages.designed.checks[0].status = 'failed';
  const migrated = migrateEvidenceV1(source, { specSha256: hash, sourceSha256: hash });
  assert.equal(validate(migrated), true, JSON.stringify(validate.errors));
  assert.equal(migrated.stages.designed.status, 'failed');
  assert.equal(migrated.stages.designed.checks[0].status, 'failed');
});