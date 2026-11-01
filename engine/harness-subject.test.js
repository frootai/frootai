import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { compileHarnessSubject, loadHarnessSubject } from './harness-subject.js';

function fixture(t, { descriptor = {}, includeRequired = true } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fai-subject-')));
  const profilesRoot = path.join(root, 'harness', 'profiles');
  const profileDir = path.join(profilesRoot, 'base');
  const subjectDir = path.join(root, 'products', 'sample');
  const descriptorDir = path.join(root, 'harness', 'subjects');
  fs.mkdirSync(path.join(profileDir, 'files', '.github', 'instructions'), { recursive: true });
  fs.mkdirSync(subjectDir, { recursive: true });
  fs.mkdirSync(descriptorDir, { recursive: true });
  fs.writeFileSync(path.join(profileDir, 'files', '.github', 'instructions', 'base.md'), '# {{subject.title}}\n');
  fs.writeFileSync(path.join(profileDir, 'v1.json'), JSON.stringify({
    profile: 'base', version: '1.0.0', description: 'Generic test subject baseline.',
    files: ['.github/instructions/base.md'],
    requires: { paths: ['README.md'] },
    context: { waf: ['security', 'reliability'] },
    primitives: { guardrails: { safety: 0, groundedness: 0.8 } },
    evaluation: { required: ['safety'] }
  }));
  if (includeRequired) fs.writeFileSync(path.join(subjectDir, 'README.md'), '# Sample\n');
  const descriptorPath = path.join(descriptorDir, 'sample.json');
  fs.writeFileSync(descriptorPath, JSON.stringify({
    subject: 'sample-product', kind: 'product', version: '1.0.0', root: 'products/sample',
    context: { knowledge: ['F1-GenAI-Foundations'], waf: ['operational-excellence'] },
    primitives: {}, requires: { paths: ['README.md'] }, ...descriptor
  }));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, profilesRoot, descriptorPath };
}

test('platform default compiles a generic subject with inherited controls', (t) => {
  const f = fixture(t);
  const result = compileHarnessSubject(f.descriptorPath, { repoRoot: f.root, profilesRoot: f.profilesRoot, defaultProfile: 'base@1' });
  assert.deepEqual(result.errors, []);
  assert.equal(result.effective.extends, 'base@1');
  assert.deepEqual(result.effective.context.waf, ['operational-excellence', 'security', 'reliability']);
  assert.deepEqual(result.effective.primitives.guardrails, { safety: 0, groundedness: 0.8 });
  assert.deepEqual(result.harness.evaluation.required, ['safety']);
  assert.equal(result.harness.files[0].target, '.github/instructions/base.md');
  assert.equal(result.harness.requires.length, 1);
});

test('explicit profile and tighter guardrails remain deterministic', (t) => {
  const f = fixture(t, { descriptor: { extends: 'base@1', primitives: { guardrails: { groundedness: 0.9 } } } });
  const first = compileHarnessSubject(f.descriptorPath, { repoRoot: f.root, profilesRoot: f.profilesRoot });
  const second = compileHarnessSubject(f.descriptorPath, { repoRoot: f.root, profilesRoot: f.profilesRoot });
  assert.deepEqual(first.errors, []);
  assert.equal(first.effective.primitives.guardrails.groundedness, 0.9);
  assert.equal(first.harness.sha256, second.harness.sha256);
});

test('looser guardrails fail without a waiver', (t) => {
  const f = fixture(t, { descriptor: { primitives: { guardrails: { groundedness: 0.7 } } } });
  const result = compileHarnessSubject(f.descriptorPath, { repoRoot: f.root, profilesRoot: f.profilesRoot, defaultProfile: 'base@1' });
  assert.match(result.errors.join('\n'), /looser.*no waiver/);
});

test('missing profile default and required artifacts fail closed', (t) => {
  const noDefault = fixture(t);
  assert.match(compileHarnessSubject(noDefault.descriptorPath, { repoRoot: noDefault.root, profilesRoot: noDefault.profilesRoot }).errors.join('\n'), /no extends profile/);

  const missing = fixture(t, { includeRequired: false });
  const result = compileHarnessSubject(missing.descriptorPath, { repoRoot: missing.root, profilesRoot: missing.profilesRoot, defaultProfile: 'base@1' });
  assert.match(result.errors.join('\n'), /requires README\.md/);
});

test('schema rejects repository escapes before compilation', (t) => {
  const f = fixture(t, { descriptor: { root: '../outside' } });
  const loaded = loadHarnessSubject(f.descriptorPath);
  assert.match(loaded.errors.join('\n'), /must match pattern/);
});
