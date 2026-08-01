import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { collectFieldTypes, inventoryContracts } from './solution-play-contract-inventory.mjs';

function writeJson(filePath, document) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`);
}

function writePlay(playsRoot, slug, { manifestSlug = slug } = {}) {
  const playRoot = path.join(playsRoot, slug);
  writeJson(path.join(playRoot, 'spec', 'play-spec.json'), {
    name: slug,
    play: slug,
    architecture: { pattern: 'workflow' },
    evaluation: { metrics: ['success'] },
  });
  writeJson(path.join(playRoot, 'spec', 'fai-manifest.json'), {
    play: manifestSlug,
    primitives: { agents: ['./agent.md'] },
  });
  writeJson(path.join(playRoot, 'certification', 'evidence.v1.json'), {
    schema_version: '1.0.0',
    subject: { slug },
    stages: {},
  });
}

test('collects nested object and array field types deterministically', () => {
  const fields = collectFieldTypes({ stages: [{ checks: [{ blocking: true }] }] });
  assert.deepEqual([...fields.get('stages')], ['array']);
  assert.deepEqual([...fields.get('stages[]')], ['object']);
  assert.deepEqual([...fields.get('stages[].checks[].blocking')], ['boolean']);
});

test('inventories contracts without changing source files', () => {
  const playsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frootai-contract-inventory-'));
  writePlay(playsRoot, '01-enterprise-rag');
  writePlay(playsRoot, '101-pester-test-development');
  const before = fs.readFileSync(path.join(playsRoot, '01-enterprise-rag', 'spec', 'play-spec.json'), 'utf8');

  const inventory = inventoryContracts({ playsRoot });

  assert.deepEqual(inventory.summary, { plays: 2, valid: 2, invalid: 0, errors: 0 });
  assert.equal(inventory.mode, 'read-only');
  assert.deepEqual(inventory.contracts.play_spec.fields['architecture.pattern'], ['string']);
  assert.deepEqual(inventory.contracts.fai_manifest.fields['primitives.agents[]'], ['string']);
  assert.equal(
    fs.readFileSync(path.join(playsRoot, '01-enterprise-rag', 'spec', 'play-spec.json'), 'utf8'),
    before,
  );
});

test('fails closed on missing files and identity drift', () => {
  const playsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frootai-contract-inventory-'));
  writePlay(playsRoot, '01-enterprise-rag', { manifestSlug: '02-wrong-play' });
  fs.rmSync(path.join(playsRoot, '01-enterprise-rag', 'certification', 'evidence.v1.json'));

  const inventory = inventoryContracts({ playsRoot });

  assert.equal(inventory.summary.invalid, 1);
  assert.equal(inventory.summary.errors, 3);
  assert.match(inventory.errors.join('\n'), /missing certification\/evidence\.v1\.json/);
  assert.match(inventory.errors.join('\n'), /fai_manifest identity/);
  assert.match(inventory.errors.join('\n'), /evidence_v1 identity/);
});