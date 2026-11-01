import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { migratePlay, selectProfile } from './harness-migrator.js';
import { compileManifest } from './harness-resolver.js';

const NOW = new Date('2026-10-09T00:00:00Z');
const PLAY = '07-multi-agent-service';
const TEMPLATE = '# Security for {{play.title}}\n';
const HOOK = 'hooks/fai-secrets-scanner/';

function fixture(manifestOverrides = {}, { securityText = '# Security for Multi Agent Service\n', profileOverrides = {} } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fai-migrate-')));
  const profilesRoot = path.join(root, 'harness', 'profiles');
  const profileDir = path.join(profilesRoot, 'agent-standard');
  fs.mkdirSync(path.join(profileDir, 'files', '.github', 'instructions'), { recursive: true });
  fs.writeFileSync(path.join(profileDir, 'files', '.github', 'instructions', 'security.instructions.md'), TEMPLATE);
  fs.writeFileSync(path.join(profileDir, 'v1.json'), JSON.stringify({
    profile: 'agent-standard',
    version: '1.0.0',
    description: 'test baseline',
    context: { waf: ['security'] },
    primitives: { hooks: [HOOK], guardrails: { groundedness: 0.85, costPerQuery: 0.05, safety: 0 } },
    files: ['.github/instructions/security.instructions.md'],
    requires: { paths: ['evaluation/'] },
    ...profileOverrides
  }));
  fs.mkdirSync(path.join(root, HOOK), { recursive: true });

  const playDir = path.join(root, 'solution-plays', PLAY);
  fs.mkdirSync(path.join(playDir, 'spec'), { recursive: true });
  fs.mkdirSync(path.join(playDir, 'evaluation'));
  fs.mkdirSync(path.join(playDir, '.github', 'instructions'), { recursive: true });
  fs.writeFileSync(path.join(playDir, '.github', 'instructions', 'security.instructions.md'), securityText);
  const manifest = {
    play: PLAY,
    version: '1.0.0',
    context: { knowledge: ['F1-GenAI-Foundations'], waf: ['reliability'] },
    primitives: { hooks: [`../../${HOOK}`], skills: ['./x/'] },
    toolkit: { devkit: '.github/' },
    ...manifestOverrides
  };
  const manifestPath = path.join(playDir, 'spec', 'fai-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return {
    manifestPath,
    run: (write = false) => migratePlay(manifestPath, { write, now: NOW, profilesRoot, profile: 'agent-standard@1' }),
    read: () => JSON.parse(fs.readFileSync(manifestPath, 'utf8')),
    compile: () => compileManifest(manifestPath, { now: NOW, profilesRoot }),
    cleanup: () => fs.rmSync(root, { recursive: true, force: true })
  };
}

test('selectProfile picks the Azure profile for Bicep or ARM plays', () => {
  assert.equal(selectProfile({ infrastructure: { bicep: './infra/main.bicep' } }), 'azure-ai-standard@1');
  assert.equal(selectProfile({ infrastructure: { template: 'infra/main.bicep' } }), 'azure-ai-standard@1');
  assert.equal(selectProfile({}), 'agent-standard@1');
});

test('check mode reports eligibility without writing', () => {
  const f = fixture();
  try {
    const before = fs.readFileSync(f.manifestPath, 'utf8');
    const result = f.run();
    assert.equal(result.status, 'eligible');
    assert.equal(fs.readFileSync(f.manifestPath, 'utf8'), before);
  } finally {
    f.cleanup();
  }
});

test('migration adds extends after version, drops inherited hooks and keeps key order', () => {
  const f = fixture();
  try {
    assert.equal(f.run(true).status, 'migrated');
    const migrated = f.read();
    assert.deepEqual(Object.keys(migrated), ['play', 'version', 'extends', 'context', 'primitives', 'toolkit']);
    assert.equal(migrated.extends, 'agent-standard@1');
    assert.equal(migrated.primitives.hooks, undefined);
    assert.deepEqual(migrated.primitives.skills, ['./x/']);
    assert.deepEqual(f.compile().errors, []);
  } finally {
    f.cleanup();
  }
});

test('top-level guardrails move into primitives and default-equal values are inherited', () => {
  const f = fixture({ guardrails: { groundedness: 0.95, costPerQuery: 0.05, safety: 0 } });
  try {
    const result = f.run(true);
    assert.equal(result.status, 'migrated');
    assert.ok(result.changes.some(c => c.includes('moved from top level')));
    const migrated = f.read();
    assert.equal(migrated.guardrails, undefined);
    assert.deepEqual(migrated.primitives.guardrails, { groundedness: 0.95 });
    assert.deepEqual(f.compile().manifest.primitives.guardrails, { groundedness: 0.95, costPerQuery: 0.05, safety: 0 });
  } finally {
    f.cleanup();
  }
});

test('guardrails identical to the profile disappear from the manifest', () => {
  const f = fixture({ primitives: { guardrails: { groundedness: 0.85, costPerQuery: 0.05, safety: 0 } } });
  try {
    f.run(true);
    assert.equal(f.read().primitives.guardrails, undefined);
  } finally {
    f.cleanup();
  }
});

test('looser guardrails block migration instead of inventing a waiver', () => {
  const f = fixture({ guardrails: { costPerQuery: 0.5 } });
  try {
    const result = f.run(true);
    assert.equal(result.status, 'blocked');
    assert.match(result.reasons[0], /looser than agent-standard@1: costPerQuery/);
    assert.equal(f.read().extends, undefined);
  } finally {
    f.cleanup();
  }
});

test('play-specific copies of profile files block migration', () => {
  const f = fixture({}, { securityText: '# Security for Multi Agent Service\n\nHIPAA addendum\n' });
  try {
    const result = f.run(true);
    assert.equal(result.status, 'blocked');
    assert.deepEqual(result.reasons, ['.github/instructions/security.instructions.md has play-specific content']);
  } finally {
    f.cleanup();
  }
});

test('missing required artifacts block migration', () => {
  const f = fixture({}, { profileOverrides: { requires: { paths: ['evaluation/', 'config/guardrails.json'] } } });
  try {
    assert.deepEqual(f.run().reasons, ['missing required config/guardrails.json']);
  } finally {
    f.cleanup();
  }
});

test('conflicting top-level and nested guardrails block migration', () => {
  const f = fixture({ guardrails: { groundedness: 0.9 }, primitives: { guardrails: { groundedness: 0.95 } } });
  try {
    assert.ok(f.run().reasons.includes('declares different top-level and primitives guardrails'));
  } finally {
    f.cleanup();
  }
});

test('migration is idempotent', () => {
  const f = fixture();
  try {
    f.run(true);
    const once = fs.readFileSync(f.manifestPath, 'utf8');
    assert.equal(f.run(true).status, 'harnessed');
    assert.equal(fs.readFileSync(f.manifestPath, 'utf8'), once);
  } finally {
    f.cleanup();
  }
});
