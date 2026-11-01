import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildPlatformHarnessReport } from './platform-harness.js';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(t, { overdue = false, duplicate = false } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fai-platform-')));
  const profilesRoot = path.join(root, 'harness', 'profiles');
  writeJson(path.join(profilesRoot, 'base', 'v1.json'), {
    profile: 'base', version: '1.0.0', description: 'Shared fixture platform baseline.',
    context: { waf: ['security'] }, primitives: { guardrails: { safety: 0 } }, evaluation: { required: ['safety'] }
  });
  writeJson(path.join(root, 'harness', 'platform.json'), {
    schema_version: '1.0.0',
    defaults: { 'solution-play': 'base@1', agent: 'base@1', product: 'base@1', platform: 'base@1' },
    subjects_directory: 'harness/subjects',
    solution_plays: { root: 'solution-plays', manifest: 'spec/fai-manifest.json', exemptions: 'harness/exemptions.json' }
  });
  for (const [file, subject, kind, subjectRoot] of [
    ['agent.json', 'agent-catalog', 'agent', 'agents'],
    ['product.json', duplicate ? 'agent-catalog' : 'sample-product', 'product', 'products/sample']
  ]) {
    fs.mkdirSync(path.join(root, subjectRoot), { recursive: true });
    fs.writeFileSync(path.join(root, subjectRoot, 'README.md'), '# Subject\n');
    writeJson(path.join(root, 'harness', 'subjects', file), {
      subject, kind, version: '1.0.0', root: subjectRoot,
      context: { knowledge: ['F1-GenAI-Foundations'], waf: ['security'] }, primitives: {}, requires: { paths: ['README.md'] }
    });
  }
  const harnessedPlay = '01-harnessed';
  fs.mkdirSync(path.join(root, 'solution-plays', harnessedPlay), { recursive: true });
  writeJson(path.join(root, 'solution-plays', harnessedPlay, 'spec', 'fai-manifest.json'), {
    play: harnessedPlay, version: '1.0.0', extends: 'base@1',
    context: { knowledge: ['F1-GenAI-Foundations'], waf: ['security'] }, primitives: {}
  });
  const exemptPlay = '02-exempt';
  fs.mkdirSync(path.join(root, 'solution-plays', exemptPlay), { recursive: true });
  writeJson(path.join(root, 'solution-plays', exemptPlay, 'spec', 'fai-manifest.json'), {
    play: exemptPlay, version: '1.0.0', context: { knowledge: ['F1-GenAI-Foundations'], waf: ['security'] }, primitives: {}
  });
  writeJson(path.join(root, 'harness', 'exemptions.json'), {
    plays: { [exemptPlay]: { reason: 'Fixture-specific reviewed exception.', review_by: overdue ? '2026-01-01' : '2026-12-31' } }
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, profilesRoot };
}

const NOW = new Date('2026-10-09T00:00:00Z');

test('one report covers plays, agents and products with kind defaults', (t) => {
  const f = fixture(t);
  const report = buildPlatformHarnessReport(f.root, { profilesRoot: f.profilesRoot, now: NOW });
  assert.equal(report.healthy, true);
  assert.equal(report.total, 4);
  assert.equal(report.harnessed, 3);
  assert.equal(report.exempt, 1);
  assert.equal(report.failed, 0);
  assert.equal(report.systemErrors, 0);
  assert.deepEqual(report.byKind.agent, { total: 1, harnessed: 1, exempt: 0, failed: 0 });
  assert.deepEqual(report.byKind.product, { total: 1, harnessed: 1, exempt: 0, failed: 0 });
  assert.deepEqual(report.byKind['solution-play'], { total: 2, harnessed: 1, exempt: 1, failed: 0 });
  assert.equal(report.entries.find((entry) => entry.id === 'agent-catalog').profile, 'base@1');
});

test('overdue exemptions and duplicate subject IDs fail closed', (t) => {
  const overdue = fixture(t, { overdue: true });
  const overdueReport = buildPlatformHarnessReport(overdue.root, { profilesRoot: overdue.profilesRoot, now: NOW });
  assert.equal(overdueReport.healthy, false);
  assert.equal(overdueReport.failed, 1);
  assert.equal(overdueReport.systemErrors, 0);
  assert.match(overdueReport.entries.find((entry) => entry.id === '02-exempt').errors.join('\n'), /overdue/);

  const duplicate = fixture(t, { duplicate: true });
  const duplicateReport = buildPlatformHarnessReport(duplicate.root, { profilesRoot: duplicate.profilesRoot, now: NOW });
  assert.equal(duplicateReport.healthy, false);
  assert.equal(duplicateReport.failed, 0);
  assert.equal(duplicateReport.systemErrors, 1);
  assert.match(duplicateReport.errors.join('\n'), /duplicate platform subject/);
});

test('missing registry reports a system error without inventing a failed subject', (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fai-platform-missing-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const report = buildPlatformHarnessReport(root);
  assert.equal(report.healthy, false);
  assert.equal(report.total, 0);
  assert.equal(report.failed, 0);
  assert.equal(report.systemErrors, 1);
  assert.match(report.errors.join('\n'), /platform harness registry not found/);
});
