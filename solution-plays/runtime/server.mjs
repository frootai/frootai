#!/usr/bin/env node
import { ScenarioKernel } from './core/kernel.mjs';
import { createScenarioServer, listen } from './core/server.mjs';
import { scenarios } from './scenarios/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateLifecyclePolicy } from '../../scripts/solution-play-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const enterprisePolicy = JSON.parse(fs.readFileSync(path.join(root, 'data', 'certification', 'enterprise-policy.v1.json'), 'utf8'));

export function createRuntime({ profile = process.env.FROOTAI_RUNTIME_PROFILE || 'offline' } = {}) {
  if (!['offline', 'azure'].includes(profile)) throw new Error(`Unsupported runtime profile: ${profile}`);
  if (profile === 'azure') throw new Error('Azure runtime adapters require an approved deployment profile and are not loaded by the offline host.');
  const kernel = new ScenarioKernel({ scenarios, profile });
  return { kernel, server: createScenarioServer(kernel, { policyEvaluator: evaluateLifecyclePolicy, policy: enterprisePolicy }) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server } = createRuntime();
  const origin = await listen(server, Number(process.env.PORT || 3107));
  process.stdout.write(`FrootAI flagship runtime listening at ${origin}\n`);
}
