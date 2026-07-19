#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContext } from '../engine/context-resolver.js';
import { loadManifest, resolvePaths } from '../engine/manifest-reader.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const playsRoot = path.join(root, 'solution-plays');
const sharedHookAliases = new Map([
  ['frootai-secrets-scanner', 'fai-secrets-scanner'],
  ['frootai-tool-guardian', 'fai-tool-guardian'],
  ['frootai-governance-audit', 'fai-governance-audit'],
]);
const localRoots = {
  agents: '.github/agents',
  instructions: '.github/instructions',
  skills: '.github/skills',
  workflows: '.github/workflows',
  hooks: '.github/hooks',
};
const knowledgeAliases = new Map([
  ['F2-LLM-Selection', 'F2-LLM-Landscape'],
  ['O2-Agent-Coding', 'O2-AI-Agents'],
  ['O3-MCP-Tools', 'O3-MCP-Tools-Functions'],
  ['O4-Azure-AI', 'O4-Azure-AI-Foundry'],
  ['O5-GPU-Infra', 'O5-AI-Infrastructure'],
  ['O5-Infrastructure', 'O5-AI-Infrastructure'],
  ['O6-Copilot-Extend', 'O6-Copilot-Ecosystem'],
  ['R1-Prompt-Patterns', 'R1-Prompt-Engineering'],
  ['R2-RAG', 'R2-RAG-Architecture'],
]);

function listManifests() {
  return fs.readdirSync(playsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{2,3}-/.test(entry.name))
    .map((entry) => path.join(playsRoot, entry.name, 'spec', 'fai-manifest.json'))
    .filter(fs.existsSync)
    .sort();
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function existingCandidates(playDir, playSlug, category, relative) {
  const trimmed = relative.replace(/^\.\//, '').replace(/\/$/, '');
  const base = path.basename(trimmed);
  const descriptiveSlug = playSlug.replace(/^\d{2,3}-/, '');
  const candidates = [trimmed];

  const localRoot = localRoots[category];
  if (localRoot) candidates.push(path.posix.join(localRoot, base));

  if (category === 'instructions' && (/^\d{2,3}-patterns\.instructions\.md$/.test(base) || base === 'instructions.md')) {
    candidates.push(path.posix.join(localRoot, `${descriptiveSlug}-patterns.instructions.md`));
  }
  if (category === 'instructions' && base === `${descriptiveSlug}.instructions.md`) {
    candidates.push(path.posix.join(localRoot, `${descriptiveSlug}-patterns.instructions.md`));
  }
  if (category === 'skills') {
    const role = base.match(/^(deploy|evaluate|tune)-/)?.[1];
    if (role) candidates.push(path.posix.join(localRoot, `${role}-${descriptiveSlug}`));
  }

  if (category === 'agents' && base === 'agent.md') candidates.push('agent.md');

  if (category === 'hooks') {
    const alias = sharedHookAliases.get(base);
    if (alias) candidates.push(`../../hooks/${alias}`);
  }

  return [...new Set(candidates)]
    .map((candidate) => ({
      relative: candidate + (relative.endsWith('/') ? '/' : ''),
      absolute: path.resolve(playDir, candidate),
    }))
    .filter((candidate) => fs.existsSync(candidate.absolute));
}

function repairReference(playDir, playSlug, category, relative) {
  if (typeof relative !== 'string' || !relative) return { value: relative, error: `${category} contains a non-string path` };
  const current = path.resolve(playDir, relative);
  if (fs.existsSync(current)) return { value: relative };

  const candidates = existingCandidates(playDir, playSlug, category, relative);
  if (candidates.length === 1) return { value: toPosix(candidates[0].relative), changed: true };
  if (candidates.length === 0) return { value: relative, error: `${category}: ${relative}` };
  return { value: relative, error: `${category}: ${relative} is ambiguous (${candidates.map((item) => item.relative).join(', ')})` };
}

export function normalizeManifest(manifest, playDir) {
  const normalized = structuredClone(manifest);
  const changes = [];
  const errors = [];
  normalized.primitives ||= {};

  if (Array.isArray(normalized.context?.knowledge)) {
    normalized.context.knowledge = normalized.context.knowledge.map((id) => {
      const canonical = knowledgeAliases.get(id) || id;
      if (canonical !== id) changes.push(`context.knowledge: ${id} -> ${canonical}`);
      return canonical;
    });
  }

  for (const category of Object.keys(localRoots)) {
    const values = normalized.primitives[category];
    if (!Array.isArray(values)) continue;
    normalized.primitives[category] = values.map((relative) => {
      const result = repairReference(playDir, normalized.play, category, relative);
      if (result.error) errors.push(result.error);
      if (result.changed) changes.push(`${category}: ${relative} -> ${result.value}`);
      return result.value;
    });
  }

  return { normalized, changes, errors };
}

export function auditManifest(manifestPath, { fix = false } = {}) {
  const loaded = loadManifest(manifestPath);
  if (!loaded.manifest) return { manifestPath, play: null, changed: false, errors: loaded.errors };
  const normalizedResult = normalizeManifest(loaded.manifest, loaded.playDir);
  const serialized = `${JSON.stringify(normalizedResult.normalized, null, 2)}\n`;
  const current = fs.readFileSync(manifestPath, 'utf8');
  const changed = current !== serialized;

  if (fix && changed && normalizedResult.errors.length === 0) fs.writeFileSync(manifestPath, serialized, 'utf8');

  const activeManifest = normalizedResult.normalized;
  const pathResult = resolvePaths(activeManifest, loaded.playDir);
  const contextResult = buildContext(activeManifest.context || {});
  const pathErrors = pathResult.missing;
  const errors = [...loaded.errors, ...normalizedResult.errors, ...pathErrors, ...contextResult.errors];

  return {
    manifestPath,
    play: activeManifest.play,
    changed,
    changes: normalizedResult.changes,
    errors,
    unresolved: pathErrors,
    contextErrors: contextResult.errors,
  };
}

export function auditAll({ fix = false } = {}) {
  const records = listManifests().map((manifestPath) => auditManifest(manifestPath, { fix }));
  return {
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    mode: fix ? 'fix' : 'check',
    summary: {
      manifests: records.length,
      changed: records.filter((record) => record.changed).length,
      valid: records.filter((record) => record.errors.length === 0).length,
      invalid: records.filter((record) => record.errors.length > 0).length,
      unresolved: records.reduce((sum, record) => sum + record.unresolved.length, 0),
      context_failures: records.filter((record) => record.contextErrors.length > 0).length,
    },
    records,
  };
}

function main() {
  const fix = process.argv.includes('--fix');
  const report = auditAll({ fix });
  const reportPath = path.join(root, 'reports', 'solution-play-manifest-contract.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(report.summary)}\n`);
  if (report.summary.invalid > 0 || (!fix && report.summary.changed > 0)) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
