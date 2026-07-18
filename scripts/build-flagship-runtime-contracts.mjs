#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scenarioByPlay, scenarios } from '../solution-plays/runtime/scenarios/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scenarioMap = new Map(scenarios.map((scenario) => [scenario.id, scenario]));

for (const [play, scenarioId] of Object.entries(scenarioByPlay)) {
  const scenario = scenarioMap.get(scenarioId);
  const contract = {
    schema_version: '1.0.0',
    play,
    profile: 'offline-first',
    scenario: {
      id: scenario.id,
      version: scenario.version,
      input_schema: scenario.inputSchema,
      output_schema: scenario.outputSchema,
    },
    endpoints: {
      liveness: '/health/live', readiness: '/health/ready', catalog: '/v1/scenarios',
      execute: `/v1/scenarios/${scenario.id}/runs`, status: '/v1/runs/{runId}',
    },
    adapters: { offline: 'solution-plays/runtime/scenarios/index.mjs', azure_ports: scenario.azure.ports },
    infrastructure: {
      required_resource_types: scenario.azure.resourceTypes,
      required_resource_kinds: scenario.azure.resourceKinds || {},
    },
    evidence: { deterministic_output_hash: true, endpoint_evaluation: true, unexpected_network_blocked_in_ci: true },
  };
  const target = path.join(root, 'solution-plays', play, 'spec', 'runtime-contract.json');
  fs.writeFileSync(target, `${JSON.stringify(contract, null, 2)}\n`, 'utf8');
}

process.stdout.write(`${JSON.stringify({ plays: Object.keys(scenarioByPlay).length })}\n`);
