#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cohort = ['01-enterprise-rag', '03-deterministic-agent', '06-document-intelligence', '07-multi-agent-service', '33-voice-ai-agent'];

function resourceInventory(template) {
  const types = new Set();
  const kinds = new Map();
  function visit(resources) {
    for (const resource of resources || []) {
      if (typeof resource.type === 'string') {
        types.add(resource.type);
        if (typeof resource.kind === 'string') {
          if (!kinds.has(resource.type)) kinds.set(resource.type, new Set());
          kinds.get(resource.type).add(resource.kind);
        }
      }
      visit(resource.resources);
    }
  }
  visit(template.resources);
  return {
    types: [...types].sort(),
    kinds: Object.fromEntries([...kinds.entries()].map(([type, values]) => [type, [...values].sort()])),
  };
}

export function validateFlagshipIac(play) {
  if (!cohort.includes(play)) throw new Error(`Not a flagship play: ${play}`);
  const playRoot = path.join(root, 'solution-plays', play);
  const contract = JSON.parse(fs.readFileSync(path.join(playRoot, 'spec', 'runtime-contract.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(playRoot, 'spec', 'fai-manifest.json'), 'utf8'));
  const relative = manifest.infrastructure?.bicep || manifest.infrastructure?.template;
  const source = relative ? path.resolve(playRoot, relative) : null;
  if (!source || !fs.existsSync(source)) return { play, compiled: false, conformant: false, error: 'Bicep source is missing', required: contract.infrastructure.required_resource_types, emitted: [], missing: contract.infrastructure.required_resource_types };
  const sourceDirectory = path.dirname(source);
  const sourceName = path.basename(source);
  const output = path.join(sourceDirectory, `${path.basename(sourceName, path.extname(sourceName))}.json`);
  fs.rmSync(output, { force: true });
  const build = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'az.cmd', 'bicep', 'build', '--file', sourceName], { cwd: sourceDirectory, encoding: 'utf8' })
    : spawnSync('az', ['bicep', 'build', '--file', sourceName], { cwd: sourceDirectory, encoding: 'utf8' });
  if (build.status !== 0 || !fs.existsSync(output)) {
    const error = `${build.error?.message || ''}\n${build.stdout || ''}${build.stderr || ''}`.trim();
    return { play, compiled: false, conformant: false, error, required: contract.infrastructure.required_resource_types, emitted: [], missing: contract.infrastructure.required_resource_types };
  }
  try {
    const inventory = resourceInventory(JSON.parse(fs.readFileSync(output, 'utf8')));
    const emitted = inventory.types;
    const required = contract.infrastructure.required_resource_types;
    const missing = required.filter((type) => !emitted.includes(type));
    const missingKinds = [];
    for (const [type, kinds] of Object.entries(contract.infrastructure.required_resource_kinds || {})) {
      for (const kind of kinds) if (!inventory.kinds[type]?.includes(kind)) missingKinds.push(`${type}:${kind}`);
    }
    return { play, compiled: true, conformant: missing.length === 0 && missingKinds.length === 0, required, emitted, emittedKinds: inventory.kinds, missing, missingKinds };
  } finally {
    fs.rmSync(output, { force: true });
  }
}

export function validateAllFlagshipIac() {
  const records = cohort.map(validateFlagshipIac);
  return { schema_version: '1.0.0', count: records.length, passed: records.filter((item) => item.compiled && item.conformant).length, failed: records.filter((item) => !item.compiled || !item.conformant).length, records };
}

function main() {
  const report = validateAllFlagshipIac();
  const target = path.join(root, 'reports', 'flagship-iac-conformance.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ count: report.count, passed: report.passed, failed: report.failed })}\n`);
  if (report.failed) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
