import assert from 'node:assert/strict';
import test from 'node:test';
import { createEvaluator } from './evaluator.js';

test('no scores is not a pass', () => {
  const result = createEvaluator().evaluate({});
  assert.equal(result.pass, false);
  assert.equal(result.summary, '❌ No quality gates were evaluated');
  assert.equal(createEvaluator().evaluate().pass, false);
});

test('non-numeric and non-finite scores fail as invalid', () => {
  for (const value of ['0.99', NaN, Infinity, null, { score: 1 }]) {
    const result = createEvaluator().evaluate({ groundedness: value });
    assert.equal(result.pass, false, String(value));
    assert.equal(result.results[0].action, 'invalid');
  }
});

test('required metrics must be scored', () => {
  const ev = createEvaluator({}, { required: ['groundedness', 'safety', 'costPerQuery'] });
  const missing = ev.evaluate({ groundedness: 0.99 });
  assert.equal(missing.pass, false);
  assert.deepEqual(missing.results.filter(r => r.action === 'not-evaluated').map(r => r.metric), ['safety', 'costPerQuery']);

  const complete = ev.evaluate({ groundedness: 0.99, safety: 0, cost: 0.001 });
  assert.equal(complete.pass, true, complete.summary);
});

test('existing threshold behaviour is unchanged for valid scores', () => {
  const ev = createEvaluator({ groundedness: 0.9 });
  assert.equal(ev.evaluate({ groundedness: 0.95 }).pass, true);
  assert.equal(ev.evaluate({ groundedness: 0.5 }).pass, false);
  assert.equal(ev.evaluate({ safety: 1 }).results[0].action, 'block');
});

test('report renders unevaluated metrics without crashing', () => {
  const ev = createEvaluator({}, { required: ['relevance'] });
  assert.match(ev.formatReport(ev.evaluate({ groundedness: 0.99 })), /relevance: n\/a/);
});
