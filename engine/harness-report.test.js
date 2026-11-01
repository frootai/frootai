import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildHarnessReport } from './harness-report.js';

function writeManifest(playsRoot, play, extra = {}) {
  const dir = path.join(playsRoot, play, 'spec');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'fai-manifest.json'), JSON.stringify({
    play,
    version: '1.0.0',
    context: { knowledge: ['F1-GenAI-Foundations'], waf: ['security'] },
    primitives: {},
    ...extra
  }));
}

function fixture(exemptions) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fai-report-')));
  const profilesRoot = path.join(root, 'harness', 'profiles');
  fs.mkdirSync(path.join(profilesRoot, 'base'), { recursive: true });
  fs.writeFileSync(path.join(profilesRoot, 'base', 'v1.json'), JSON.stringify({
    profile: 'base', version: '1.0.0', description: 'test', primitives: { guardrails: { costPerQuery: 0.05 } }
  }));
  fs.writeFileSync(path.join(root, 'harness', 'exemptions.json'), JSON.stringify({ plays: exemptions }));
  const playsRoot = path.join(root, 'solution-plays');
  writeManifest(playsRoot, '01-harnessed', {
    extends: 'base@1',
    primitives: { guardrails: { costPerQuery: 0.2 } },
    waivers: [{ rule: 'guardrails.costPerQuery', reason: 'Long imagery prompts', expires: '2026-10-20' }]
  });
  writeManifest(playsRoot, '02-exempt', { guardrails: { groundedness: 0.5 } });
  writeManifest(playsRoot, '03-loose');
  return { root, playsRoot, profilesRoot, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

const NOW = new Date('2026-10-09T00:00:00Z');

test('report counts adoption, waivers, exemptions and unharnessed plays', () => {
  const f = fixture({ '02-exempt': { reason: 'Legacy domain guidance', review_by: '2026-12-31' } });
  try {
    const report = buildHarnessReport(f.playsRoot, { now: NOW, profilesRoot: f.profilesRoot });
    assert.equal(report.plays, 3);
    assert.equal(report.harnessed, 1);
    assert.equal(report.exempt, 1);
    assert.deepEqual(report.unharnessed, ['03-loose']);
    assert.deepEqual(report.byProfile, { 'base@1': 1 });
    assert.deepEqual(report.waivers.map(w => [w.play, w.expires]), [['01-harnessed', '2026-10-20']]);
    assert.deepEqual(report.warnings.map(w => w.play), ['01-harnessed', '02-exempt']);
    assert.equal(report.coverage, 33.3);
    assert.equal(report.healthy, false);
  } finally {
    f.cleanup();
  }
});

test('overdue exemptions make the report unhealthy', () => {
  const f = fixture({
    '02-exempt': { reason: 'Legacy domain guidance', review_by: '2026-10-01' },
    '03-loose': { reason: 'Owner review pending', review_by: '2026-12-31' }
  });
  try {
    const report = buildHarnessReport(f.playsRoot, { now: NOW, profilesRoot: f.profilesRoot });
    assert.deepEqual(report.unharnessed, []);
    assert.equal(report.exemptions.find(e => e.play === '02-exempt').overdue, true);
    assert.equal(report.healthy, false);
  } finally {
    f.cleanup();
  }
});
