import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { compileManifest, listProfiles, loadProfileChain } from './harness-resolver.js';

const NOW = new Date('2026-10-02T12:00:00Z');

function fixture({ manifest, profiles = {} }) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fai-harness-')));
  const profilesRoot = path.join(root, 'harness', 'profiles');
  for (const [reference, profile] of Object.entries(profiles)) {
    const [name, major] = reference.split('@');
    fs.mkdirSync(path.join(profilesRoot, name), { recursive: true });
    fs.writeFileSync(path.join(profilesRoot, name, `v${major}.json`), JSON.stringify(profile));
  }
  fs.mkdirSync(path.join(root, 'instructions'), { recursive: true });
  fs.writeFileSync(path.join(root, 'instructions', 'shared.instructions.md'), '# shared\n');
  const spec = path.join(root, 'solution-plays', '01-demo', 'spec');
  fs.mkdirSync(spec, { recursive: true });
  const manifestPath = path.join(spec, 'fai-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  return { root, profilesRoot, manifestPath, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

const base = {
  profile: 'base',
  version: '1.0.0',
  context: { waf: ['security', 'responsible-ai'] },
  primitives: {
    instructions: ['instructions/shared.instructions.md'],
    guardrails: { groundedness: 0.85, coherence: 0.8, relevance: 0.8, safety: 0, costPerQuery: 0.05 }
  }
};

function play(overrides = {}) {
  return {
    play: '01-demo',
    version: '1.0.0',
    extends: 'base@1',
    context: { knowledge: ['F1-GenAI-Foundations'], waf: ['reliability'] },
    primitives: {},
    ...overrides
  };
}

function compile(manifest, profiles = { 'base@1': base }) {
  const f = fixture({ manifest, profiles });
  try {
    return compileManifest(f.manifestPath, { now: NOW, profilesRoot: f.profilesRoot });
  } finally {
    f.cleanup();
  }
}

test('manifest without extends is returned unchanged with no harness', () => {
  const manifest = play();
  delete manifest.extends;
  const result = compile(manifest);
  assert.equal(result.harness, null);
  assert.deepEqual(result.manifest, manifest);
});

test('profile pillars, instructions and guardrails become the effective minimum', () => {
  const result = compile(play());
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.manifest.context.waf, ['reliability', 'security', 'responsible-ai']);
  assert.deepEqual(result.manifest.primitives.instructions, ['../../instructions/shared.instructions.md']);
  assert.equal(result.manifest.primitives.guardrails.groundedness, 0.85);
  assert.equal(result.harness.provenance['context.waf'].security, 'profile:base@1');
  assert.equal(result.harness.provenance['context.waf'].reliability, 'play');
  assert.match(result.harness.sha256, /^[0-9a-f]{64}$/);
});

test('play may tighten guardrails without a waiver', () => {
  const result = compile(play({ primitives: { guardrails: { groundedness: 0.95, costPerQuery: 0.01 } } }));
  assert.deepEqual(result.errors, []);
  assert.equal(result.manifest.primitives.guardrails.groundedness, 0.95);
  assert.equal(result.manifest.primitives.guardrails.costPerQuery, 0.01);
  assert.equal(result.harness.provenance['primitives.guardrails'].groundedness, 'play');
  assert.equal(result.harness.provenance['primitives.guardrails'].coherence, 'profile:base@1');
});

test('loosening a guardrail without a waiver is rejected', () => {
  const result = compile(play({ primitives: { guardrails: { costPerQuery: 0.2 } } }));
  assert.ok(result.errors.some(e => e.includes('guardrails.costPerQuery 0.2 is looser')), result.errors.join('\n'));
  assert.equal(result.manifest.primitives.guardrails.costPerQuery, 0.05);
});

test('a valid waiver allows loosening and is recorded', () => {
  const waiver = { rule: 'guardrails.costPerQuery', reason: 'Imagery reports need larger prompts', expires: '2026-12-31' };
  const result = compile(play({ primitives: { guardrails: { costPerQuery: 0.2 } }, waivers: [waiver] }));
  assert.deepEqual(result.errors, []);
  assert.equal(result.manifest.primitives.guardrails.costPerQuery, 0.2);
  assert.equal(result.harness.provenance['primitives.guardrails'].costPerQuery, 'waiver:2026-12-31');
  assert.deepEqual(result.harness.waivers, [waiver]);
});

test('an expired waiver is rejected', () => {
  const waiver = { rule: 'guardrails.groundedness', reason: 'Exploratory prototype only', expires: '2026-10-01' };
  const result = compile(play({ primitives: { guardrails: { groundedness: 0.5 } }, waivers: [waiver] }));
  assert.ok(result.errors.includes('waiver for guardrails.groundedness expired on 2026-10-01'), result.errors.join('\n'));
});

test('a waiver that loosens nothing is rejected as unnecessary', () => {
  const waiver = { rule: 'guardrails.coherence', reason: 'Not actually needed here', expires: '2026-12-31' };
  const result = compile(play({ waivers: [waiver] }));
  assert.ok(result.errors.includes('waiver for guardrails.coherence is not needed; remove it'), result.errors.join('\n'));
});

test('waivers without extends are rejected', () => {
  const manifest = play({ waivers: [{ rule: 'guardrails.coherence', reason: 'Not actually needed here', expires: '2026-12-31' }] });
  delete manifest.extends;
  assert.ok(compile(manifest).errors.includes('waivers require extends'));
});

test('unknown profile and unknown major are rejected', () => {
  assert.ok(compile(play({ extends: 'missing@1' })).errors.includes('profile missing@1 not found'));
  assert.ok(compile(play({ extends: 'base@2' })).errors.includes('profile base@2 not found'));
});

test('profile chains merge base first and a child profile cannot loosen its parent', () => {
  const child = { profile: 'child', version: '1.0.0', extends: 'base@1', context: { waf: ['cost-optimization'] } };
  const ok = compile(play({ extends: 'child@1' }), { 'base@1': base, 'child@1': child });
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.harness.profiles.map(p => p.reference), ['base@1', 'child@1']);
  assert.equal(ok.harness.provenance['context.waf']['cost-optimization'], 'profile:child@1');

  const loose = { ...child, primitives: { guardrails: { groundedness: 0.5 } } };
  const bad = compile(play({ extends: 'child@1' }), { 'base@1': base, 'child@1': loose });
  assert.ok(bad.errors.includes('profile child@1 loosens guardrails.groundedness inherited from profile:base@1'), bad.errors.join('\n'));
});

test('extends cycles are rejected', () => {
  const a = { profile: 'a', version: '1.0.0', extends: 'b@1' };
  const b = { profile: 'b', version: '1.0.0', extends: 'a@1' };
  const f = fixture({ manifest: play(), profiles: { 'a@1': a, 'b@1': b } });
  try {
    assert.deepEqual(loadProfileChain('a@1', f.profilesRoot).errors, ['profile a@1 creates an extends cycle']);
  } finally {
    f.cleanup();
  }
});

test('profile chains may not exceed four levels', () => {
  const profiles = { 'base@1': base };
  for (const [profile, parent] of [
    ['second', 'base@1'],
    ['third', 'second@1'],
    ['fourth', 'third@1'],
    ['fifth', 'fourth@1']
  ]) {
    profiles[`${profile}@1`] = { profile, version: '1.0.0', extends: parent };
  }
  const f = fixture({ manifest: play(), profiles });
  try {
    assert.deepEqual(loadProfileChain('fourth@1', f.profilesRoot).errors, []);
    assert.deepEqual(loadProfileChain('fifth@1', f.profilesRoot).errors, ['profile chain exceeds 4 levels at base@1']);
  } finally {
    f.cleanup();
  }
});

test('profiles with unknown fields or escaping paths are rejected', () => {
  const unknown = { ...base, tools: ['shell'] };
  assert.ok(compile(play(), { 'base@1': unknown }).errors.includes('profile base@1 has unknown field "tools"'));

  const escaping = { ...base, primitives: { instructions: ['../outside.md'] } };
  assert.ok(compile(play(), { 'base@1': escaping }).errors.some(e => e.includes('escapes the repository')));
});

test('duplicate play references to profile primitives are deduplicated', () => {
  const result = compile(play({ primitives: { instructions: ['../../instructions/shared.instructions.md'] } }));
  assert.deepEqual(result.manifest.primitives.instructions, ['../../instructions/shared.instructions.md']);
  assert.equal(result.harness.provenance['primitives.instructions']['../../instructions/shared.instructions.md'], 'profile:base@1');
});

test('top-level guardrails are rejected for extending manifests', () => {
  const result = compile(play({ guardrails: { groundedness: 0.9 } }));
  assert.ok(result.errors.some(e => e.startsWith('top-level guardrails are ignored')));
});

test('compilation is deterministic', () => {
  const first = compile(play());
  const second = compile(play());
  assert.equal(first.harness.sha256, second.harness.sha256);
});

test('required play artifacts are enforced and recorded', () => {
  const requiring = { ...base, requires: { paths: ['evaluation/', 'config/guardrails.json'] } };
  const missing = compile(play(), { 'base@1': requiring });
  assert.ok(missing.errors.includes('harness base@1 requires evaluation/ in the play'), missing.errors.join('\n'));
  assert.deepEqual(missing.harness.requires.map(r => r.path), ['evaluation/', 'config/guardrails.json']);

  const f = fixture({ manifest: play(), profiles: { 'base@1': requiring } });
  try {
    const playDir = path.dirname(path.dirname(f.manifestPath));
    fs.mkdirSync(path.join(playDir, 'evaluation'));
    fs.mkdirSync(path.join(playDir, 'config'));
    fs.writeFileSync(path.join(playDir, 'config', 'guardrails.json'), '{}');
    assert.deepEqual(compileManifest(f.manifestPath, { now: NOW, profilesRoot: f.profilesRoot }).errors, []);
  } finally {
    f.cleanup();
  }
});

test('required evaluation metrics merge across the chain', () => {
  const parent = { ...base, evaluation: { required: ['groundedness'] } };
  const child = { profile: 'child', version: '1.0.0', extends: 'base@1', evaluation: { required: ['safety', 'groundedness'] } };
  const result = compile(play({ extends: 'child@1' }), { 'base@1': parent, 'child@1': child });
  assert.deepEqual(result.harness.evaluation.required, ['groundedness', 'safety']);

  const bad = compile(play(), { 'base@1': { ...base, evaluation: { required: ['vibes'] } } });
  assert.ok(bad.errors.includes('profile base@1 evaluation.required must list known guardrail metrics'));
});

test('waivers close to expiry produce a warning, not an error', () => {
  const waiver = { rule: 'guardrails.costPerQuery', reason: 'Imagery reports need larger prompts', expires: '2026-10-10' };
  const result = compile(play({ primitives: { guardrails: { costPerQuery: 0.2 } }, waivers: [waiver] }));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, ['waiver for guardrails.costPerQuery expires on 2026-10-10 (8 day(s) left)']);
});

test('non-extending manifests warn about ignored top-level guardrails', () => {
  const manifest = play({ guardrails: { groundedness: 0.9 } });
  delete manifest.extends;
  const result = compile(manifest);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, ['top-level guardrails are ignored by the engine; declare them in primitives.guardrails']);
});

test('listProfiles reports every profile version with its parent', () => {
  const child = { profile: 'child', version: '1.0.0', description: 'child profile', extends: 'base@1' };
  const f = fixture({ manifest: play(), profiles: { 'base@1': base, 'child@1': child } });
  try {
    assert.deepEqual(listProfiles(f.profilesRoot).map(p => [p.reference, p.extends, p.errors.length]), [['base@1', null, 0], ['child@1', 'base@1', 0]]);
  } finally {
    f.cleanup();
  }
});

test('repository profiles satisfy the profile schema and resolve cleanly', async () => {
  const { default: Ajv } = await import('ajv');
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const schema = JSON.parse(fs.readFileSync(path.join(repoRoot, 'schemas', 'fai-harness-profile.schema.json'), 'utf8'));
  const validate = new Ajv({ allErrors: true, strict: true }).compile(schema);
  const profiles = listProfiles(path.join(repoRoot, 'harness', 'profiles'));
  assert.ok(profiles.length >= 2);
  for (const entry of profiles) {
    assert.deepEqual(entry.errors, [], entry.reference);
    const [name, major] = entry.reference.split('@');
    const document = JSON.parse(fs.readFileSync(path.join(repoRoot, 'harness', 'profiles', name, `v${major}.json`), 'utf8'));
    assert.ok(validate(document), `${entry.reference}: ${JSON.stringify(validate.errors)}`);
  }
});
