import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertSolutionPlayQuality,
  auditSolutionPlayQuality,
  buildQualityBaseline,
  compareQualityBaseline,
} from './solution-play-quality-gate.mjs';

function writeJson(filePath, document) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`);
}

function writePlay(repoRoot, slug, { brokenReference = false, unsupportedClaim = false } = {}) {
  const playRoot = path.join(repoRoot, 'solution-plays', slug);
  fs.mkdirSync(playRoot, { recursive: true });
  fs.writeFileSync(path.join(playRoot, 'README.md'), `# ${slug}\n\nTODO: replace placeholder outcome.\n`);
  fs.writeFileSync(path.join(playRoot, 'agent.md'), '# Agent\n');
  writeJson(path.join(playRoot, 'spec', 'play-spec.json'), {
    ...(unsupportedClaim ? {
      schema_version: '2.0.0',
      official_sources: [{ url: 'https://example.test/docs', status: 'deprecated', tested_version: 'latest' }],
    } : {}),
    name: slug,
    play: slug,
    evaluation: { metrics: ['groundedness'], thresholds: { groundedness: 4 } },
  });
  writeJson(path.join(playRoot, 'spec', 'fai-manifest.json'), {
    play: slug,
    primitives: { agents: [brokenReference ? './missing.agent.md' : './agent.md'] },
  });
}

function fixture() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'frootai-quality-'));
  writePlay(repoRoot, '01-first-play', { brokenReference: true, unsupportedClaim: true });
  writePlay(repoRoot, '01-duplicate-play');
  return repoRoot;
}

test('detects all deterministic quality rule classes', () => {
  const report = auditSolutionPlayQuality({ repoRoot: fixture() });
  assert.deepEqual(report.summary, {
    'placeholder-marker': 4,
    'copied-metrics': 1,
    'broken-reference': 1,
    'duplicate-id': 1,
    'unsupported-claim': 3,
  });
});

test('reviewed baseline passes unchanged and fails closed on changed debt', () => {
  const repoRoot = fixture();
  const initial = auditSolutionPlayQuality({ repoRoot });
  const baseline = buildQualityBaseline(initial);
  const baselinePath = path.join(repoRoot, 'data', 'solution-play-quality-baseline.v1.json');
  writeJson(baselinePath, baseline);
  assert.deepEqual(compareQualityBaseline(initial, baseline).violations, []);
  assert.doesNotThrow(() => assertSolutionPlayQuality({ repoRoot, baselinePath }));

  fs.appendFileSync(path.join(repoRoot, 'solution-plays', '01-first-play', 'README.md'), 'TBD: another gap.\n');
  const changed = auditSolutionPlayQuality({ repoRoot });
  assert.deepEqual(compareQualityBaseline(changed, baseline).violations, [
    'placeholder-marker debt changed: baseline=4 current=5',
  ]);
  assert.throws(
    () => assertSolutionPlayQuality({ repoRoot, baselinePath }),
    /placeholder-marker debt changed: baseline=4 current=5/,
  );
});

test('quality fingerprints are deterministic across repeated audits', () => {
  const repoRoot = fixture();
  assert.deepEqual(
    buildQualityBaseline(auditSolutionPlayQuality({ repoRoot })),
    buildQualityBaseline(auditSolutionPlayQuality({ repoRoot })),
  );
});