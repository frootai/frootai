import assert from 'node:assert/strict';
import test from 'node:test';
import { ScenarioKernel } from '../core/kernel.mjs';
import { createScenarioServer, listen } from '../core/server.mjs';
import { scenarioByPlay, scenarios } from '../scenarios/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateLifecyclePolicy } from '../../../scripts/solution-play-policy.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const policy = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'certification', 'enterprise-policy.v1.json'), 'utf8'));

function kernel() {
  return new ScenarioKernel({ scenarios, profile: 'offline' });
}

const cases = [
  ['01-enterprise-rag', { question: 'How does retrieval use citations?' }, (output) => output.grounded && output.citations.length === 1],
  ['03-deterministic-agent', { request: 'Delete production data', facts: { approved: false } }, (output) => output.decision === 'requires_human_approval'],
  ['06-document-intelligence', { text: 'Invoice 42 Total: 125.50' }, (output) => output.fields.total === '125.50'],
  ['07-multi-agent-service', { task: 'Analyze sales data', maxHops: 3 }, (output) => output.route === 'analyst' && output.hopCount <= 3],
  ['33-voice-ai-agent', { transcript: 'I need a human agent', interrupted: true }, (output) => output.sessionState === 'escalated'],
];

test('all five flagship scenarios execute deterministically offline', async () => {
  for (const [play, input, assertion] of cases) {
    const first = await kernel().execute(scenarioByPlay[play], input);
    const second = await kernel().execute(scenarioByPlay[play], input);
    assert.equal(first.status, 'succeeded', play);
    assert.equal(first.canonicalOutputHash, second.canonicalOutputHash, `${play} output hash`);
    assert.equal(assertion(first.output), true, play);
    assert.ok(first.events.length >= 2, `${play} emits evidence events`);
  }
});

test('invalid input fails closed without exposing internal errors', async () => {
  await assert.rejects(() => kernel().execute('rag.query', {}), (error) => error.code === 'invalid_input' && error.status === 400);
  await assert.rejects(() => kernel().execute('missing.scenario', {}), (error) => error.code === 'scenario_not_found' && error.status === 404);
});

test('real HTTP listener exposes health, catalog, schema, execution, and run status', async () => {
  const runtime = kernel();
  const server = createScenarioServer(runtime);
  const origin = await listen(server, 0);
  try {
    const live = await fetch(`${origin}/health/live`).then((response) => response.json());
    const ready = await fetch(`${origin}/health/ready`).then((response) => response.json());
    const catalog = await fetch(`${origin}/v1/scenarios`).then((response) => response.json());
    const schema = await fetch(`${origin}/v1/scenarios/deterministic.execute/schema`).then((response) => response.json());
    const response = await fetch(`${origin}/v1/scenarios/deterministic.execute/runs`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-correlation-id': 'test-correlation' },
      body: JSON.stringify({ request: 'Review this change' }),
    });
    const run = await response.json();
    const status = await fetch(`${origin}/v1/runs/${run.runId}`).then((item) => item.json());
    assert.equal(live.status, 'live');
    assert.equal(ready.status, 'ready');
    assert.equal(catalog.scenarios.length, 5);
    assert.deepEqual(schema.input.required, ['request']);
    assert.equal(response.status, 200);
    assert.equal(run.status, 'succeeded');
    assert.equal(status.canonicalOutputHash, run.canonicalOutputHash);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Azure contracts name required adapter ports and resources for each flagship', () => {
  for (const scenario of scenarios) {
    assert.ok(scenario.azure.ports.length >= 4, scenario.id);
    assert.ok(scenario.azure.resourceTypes.includes('Microsoft.App/containerApps'), scenario.id);
  }
});

test('policy endpoint allows what-if and blocks unverified production deployment', async () => {
  const server = createScenarioServer(kernel(), { policyEvaluator: evaluateLifecyclePolicy, policy });
  const origin = await listen(server, 0);
  try {
    const base = {
      provider: 'azure', model: 'offline/rules-v1', region: 'eastus2', monthlyCost: 500,
      environment: 'dev', networkPosture: 'private', managedIdentity: true, privateEndpoints: true, approvals: [],
    };
    const whatIf = await fetch(`${origin}/v1/policy/check`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...base, action: 'what_if', certification: 'evaluation_verified' }) });
    const deploy = await fetch(`${origin}/v1/policy/check`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...base, action: 'deploy_production', certification: 'evaluation_verified', approvals: ['one', 'two'] }) });
    assert.equal(whatIf.status, 200);
    assert.equal(deploy.status, 403);
    assert.match(JSON.stringify(await deploy.json()), /certification/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
