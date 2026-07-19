import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ScenarioKernel } from '../core/kernel.mjs';
import { createScenarioServer, listen } from '../core/server.mjs';
import { scenarios } from '../scenarios/index.mjs';
import { evaluate } from '../eval/evaluate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const plays = ['01-enterprise-rag', '03-deterministic-agent', '06-document-intelligence', '07-multi-agent-service', '33-voice-ai-agent'];

test('all flagship datasets are valid JSONL with no placeholder ground truth', () => {
  for (const play of plays) {
    const dataset = path.join(root, play, 'evaluation', 'cases.jsonl');
    const lines = fs.readFileSync(dataset, 'utf8').split(/\r?\n/).filter(Boolean);
    assert.ok(lines.length >= 2, play);
    for (const line of lines) {
      const item = JSON.parse(line);
      assert.ok(item.id && item.scenario && item.input && item.expected, play);
      assert.doesNotMatch(line, /TODO|TBD|placeholder|customer-specific/i, play);
    }
  }
});

test('endpoint evaluation measures and passes every flagship case', async () => {
  const server = createScenarioServer(new ScenarioKernel({ scenarios, profile: 'offline' }));
  const origin = await listen(server, 0);
  try {
    for (const play of plays) {
      const report = await evaluate({ origin, dataset: path.join(root, play, 'evaluation', 'cases.jsonl') });
      assert.equal(report.failed, 0, `${play}: ${JSON.stringify(report.results.filter((item) => !item.passed))}`);
      assert.equal(report.pass_rate, 1, play);
      assert.ok(Number.isFinite(report.latency_p95_ms), play);
      assert.ok(report.results.every((item) => /^[a-f0-9]{64}$/.test(item.output_hash)), play);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
