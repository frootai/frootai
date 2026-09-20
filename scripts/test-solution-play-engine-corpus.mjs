import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { initEngine } from '../engine/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const playsRoot = path.join(root, 'solution-plays');
const playDirectories = fs.readdirSync(playsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^\d{2,3}-/.test(entry.name))
  .map((entry) => entry.name)
  .sort((left, right) => Number(left.split('-')[0]) - Number(right.split('-')[0]));

test('all 102 canonical Solution Plays initialize successfully', () => {
  assert.equal(playDirectories.length, 102);
  const failures = [];
  for (const play of playDirectories) {
    const manifestPath = path.join(playsRoot, play, 'spec', 'fai-manifest.json');
    const engine = initEngine(manifestPath);
    if (!engine.success) failures.push({ play, errors: engine.errors });
  }
  assert.deepEqual(failures, []);
});

test('three-digit plays participate in engine initialization', () => {
  for (const play of ['100-fai-meta-agent', '101-pester-test-development', '102-azure-cost-optimizer']) {
    const engine = initEngine(path.join(playsRoot, play, 'spec', 'fai-manifest.json'));
    assert.equal(engine.success, true, `${play}: ${engine.errors.join(', ')}`);
    assert.equal(engine.manifest.play, play);
  }
});
