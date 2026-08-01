#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stageNames = [
  'designed',
  'scaffold_verified',
  'build_verified',
  'evaluation_verified',
  'deploy_verified',
  'production_observed',
];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function migratedStatus(status) {
  if (status === 'failed' || status === 'expired' || status === 'not_run') return status;
  return 'unavailable';
}

function migrateEnvironment(environment = {}) {
  const migrated = {
    class: environment.class || 'local',
    os: environment.os || 'unrecorded-v1',
    architecture: environment.architecture || 'unrecorded-v1',
    tools: Object.fromEntries(
      Object.entries(environment.tools || {}).map(([tool, version]) => [tool, String(version)]),
    ),
  };
  if (environment.region) migrated.region = environment.region;
  if (environment.tenant_hash) migrated.tenant_hash = environment.tenant_hash;
  return migrated;
}

function migrateCheck(check, generatedAt) {
  return {
    id: check.id,
    status: migratedStatus(check.status),
    blocking: check.blocking,
    command: 'unrecorded in evidence v1',
    started_at: generatedAt,
    finished_at: generatedAt,
    exit_code: null,
    output_sha256: check.output_sha256,
    ...(check.metrics ? { metrics: { ...check.metrics, migrated_v1_status: check.status } } : {
      metrics: { migrated_v1_status: check.status },
    }),
  };
}

function migrateArtifact(artifact) {
  return {
    type: artifact.type,
    path: artifact.path || artifact.url,
    sha256: artifact.sha256,
    media_type: artifact.media_type || 'application/octet-stream',
  };
}

function migrateStage(stage, generatedAt) {
  if (!stage) {
    return {
      status: 'not_run',
      generated_at: generatedAt,
      expires_at: null,
      environment: migrateEnvironment(),
      checks: [],
      artifacts: [],
    };
  }
  return {
    status: migratedStatus(stage.status),
    generated_at: stage.generated_at || generatedAt,
    expires_at: stage.expires_at ?? null,
    environment: migrateEnvironment(stage.environment),
    checks: (stage.checks || []).map((check) => migrateCheck(check, stage.generated_at || generatedAt)),
    artifacts: (stage.artifacts || []).map(migrateArtifact),
  };
}

export function migrateEvidenceV1(document, { specSha256, sourceSha256 }) {
  const subject = {
    play_id: document.subject.play_id,
    slug: document.subject.slug,
    ...(document.subject.canonical_id ? { canonical_id: document.subject.canonical_id } : {}),
    repository: document.subject.repository,
    commit_sha: document.subject.commit_sha,
    content_sha256: document.subject.content_sha256,
    manifest_sha256: document.subject.manifest_sha256,
    spec_sha256: specSha256,
    ...(Object.hasOwn(document.subject, 'iac_sha256') ? { iac_sha256: document.subject.iac_sha256 } : {}),
    ...(Object.hasOwn(document.subject, 'evaluation_dataset_sha256')
      ? { evaluation_dataset_sha256: document.subject.evaluation_dataset_sha256 }
      : {}),
  };
  const stages = Object.fromEntries(
    stageNames.map((stageName) => [stageName, migrateStage(document.stages?.[stageName], document.generated_at)]),
  );
  const migrated = {
    $schema: 'https://frootai.dev/schemas/solution-play-certification-evidence.v2.json',
    schema_version: '2.0.0',
    subject,
    policy: {
      profile: document.policy.profile,
      profile_version: '1.0.0',
      profile_sha256: document.policy.profile_sha256,
    },
    generated_at: document.generated_at,
    migrated_from: {
      schema_version: '1.0.0',
      source: 'certification/evidence.v1.json',
      sha256: sourceSha256,
    },
    stages,
    ...(document.cost ? { cost: document.cost } : {}),
    ...(document.integrity ? { legacy: { integrity: document.integrity } } : {}),
  };
  migrated.integrity = { algorithm: 'sha256', evidence_sha256: sha256(JSON.stringify(migrated)) };
  return migrated;
}

function createValidator() {
  const schemaPath = path.join(repositoryRoot, 'schemas', 'solution-play-certification-evidence.v2.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv.compile(schema);
}

export function previewAllEvidenceMigrations({ playsRoot = path.join(repositoryRoot, 'solution-plays') } = {}) {
  const validate = createValidator();
  const records = fs.readdirSync(playsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{2,3}-[a-z0-9-]+$/.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => {
      const playRoot = path.join(playsRoot, entry.name);
      const evidencePath = path.join(playRoot, 'certification', 'evidence.v1.json');
      const specPath = path.join(playRoot, 'spec', 'play-spec.json');
      try {
        const evidenceSource = fs.readFileSync(evidencePath, 'utf8');
        const specSource = fs.readFileSync(specPath);
        const candidate = migrateEvidenceV1(JSON.parse(evidenceSource), {
          specSha256: sha256(specSource),
          sourceSha256: sha256(evidenceSource),
        });
        const valid = validate(candidate);
        return {
          slug: entry.name,
          valid,
          errors: valid ? [] : structuredClone(validate.errors || []),
          candidate,
        };
      } catch (error) {
        return { slug: entry.name, valid: false, errors: [{ message: error.message }], candidate: null };
      }
    });
  return {
    schema_version: '1.0.0',
    mode: 'read-only',
    summary: {
      plays: records.length,
      valid: records.filter((record) => record.valid).length,
      invalid: records.filter((record) => !record.valid).length,
    },
    records,
  };
}

function main() {
  const preview = previewAllEvidenceMigrations();
  process.stdout.write(`${JSON.stringify(preview.summary)}\n`);
  if (preview.summary.invalid > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();