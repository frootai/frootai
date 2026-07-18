import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { normalizeManifest } from './solution-play-manifest-contract.mjs';

function fixture() {
  const playDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frootai-manifest-'));
  fs.mkdirSync(path.join(playDir, '.github', 'agents'), { recursive: true });
  fs.mkdirSync(path.join(playDir, '.github', 'instructions'), { recursive: true });
  fs.mkdirSync(path.join(playDir, '.github', 'skills', 'deploy-carbon-footprint-tracker'), { recursive: true });
  fs.mkdirSync(path.resolve(playDir, '..', '..', 'hooks', 'fai-secrets-scanner'), { recursive: true });
  fs.writeFileSync(path.join(playDir, '.github', 'agents', 'builder.agent.md'), '# Builder\n');
  fs.writeFileSync(path.join(playDir, '.github', 'instructions', 'carbon-footprint-tracker-patterns.instructions.md'), '# Patterns\n');
  return playDir;
}

test('normalizes play-local agent, instruction, and skill paths', () => {
  const playDir = fixture();
  const result = normalizeManifest({
    play: '69-carbon-footprint-tracker',
    primitives: {
      agents: ['builder.agent.md'],
      instructions: ['carbon-footprint-tracker-patterns.instructions.md'],
      skills: ['deploy-carbon-footprint-tracker/'],
    },
  }, playDir);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.normalized.primitives.agents, ['.github/agents/builder.agent.md']);
  assert.deepEqual(result.normalized.primitives.instructions, ['.github/instructions/carbon-footprint-tracker-patterns.instructions.md']);
  assert.deepEqual(result.normalized.primitives.skills, ['.github/skills/deploy-carbon-footprint-tracker/']);
});

test('normalizes legacy shared hook names', () => {
  const playDir = fixture();
  const result = normalizeManifest({
    play: '69-carbon-footprint-tracker',
    primitives: { hooks: ['../../hooks/frootai-secrets-scanner/'] },
  }, playDir);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.normalized.primitives.hooks, ['../../hooks/fai-secrets-scanner/']);
});

test('preserves an existing explicit path', () => {
  const playDir = fixture();
  const result = normalizeManifest({
    play: '101-pester-test-development',
    primitives: { agents: ['.github/agents/builder.agent.md'] },
  }, playDir);
  assert.deepEqual(result.normalized.primitives.agents, ['.github/agents/builder.agent.md']);
  assert.equal(result.changes.length, 0);
});

test('fails closed when no candidate exists', () => {
  const playDir = fixture();
  const result = normalizeManifest({
    play: '101-pester-test-development',
    primitives: { agents: ['missing.agent.md'] },
  }, playDir);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /missing\.agent\.md/);
});

test('supports three-digit play identifiers without changing identity', () => {
  const playDir = fixture();
  const manifest = { play: '101-pester-test-development', primitives: { agents: ['builder.agent.md'] } };
  const result = normalizeManifest(manifest, playDir);
  assert.equal(result.normalized.play, '101-pester-test-development');
});

test('derives descriptive instruction and skill names from the play slug', () => {
  const playDir = fixture();
  const result = normalizeManifest({
    play: '69-carbon-footprint-tracker',
    primitives: {
      instructions: ['69-patterns.instructions.md'],
      skills: ['deploy-69/'],
    },
  }, playDir);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.normalized.primitives.instructions, ['.github/instructions/carbon-footprint-tracker-patterns.instructions.md']);
  assert.deepEqual(result.normalized.primitives.skills, ['.github/skills/deploy-carbon-footprint-tracker/']);
});

test('normalizes obsolete knowledge identifiers to canonical modules', () => {
  const playDir = fixture();
  const result = normalizeManifest({
    play: '100-fai-meta-agent',
    context: { knowledge: ['O2-Agent-Coding', 'O3-MCP-Tools', 'R2-RAG'] },
    primitives: {},
  }, playDir);
  assert.deepEqual(result.normalized.context.knowledge, [
    'O2-AI-Agents', 'O3-MCP-Tools-Functions', 'R2-RAG-Architecture',
  ]);
});
