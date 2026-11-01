#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlatformRegistry } from '../engine/platform-harness.js';
import { materializeHarnessSubject } from '../engine/harness-subject-materializer.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = path.join(root, 'harness', 'platform.json');
const loaded = loadPlatformRegistry(registryPath);
const write = process.argv.includes('--write');
if (!loaded.registry || loaded.errors.length > 0) {
  for (const error of loaded.errors) console.log(`x ${error}`);
  process.exit(1);
}

const subjectsRoot = path.resolve(root, loaded.registry.subjects_directory);
let failed = 0;
let subjects = 0;
for (const file of fs.readdirSync(subjectsRoot).filter((name) => name.endsWith('.json')).sort()) {
  const descriptorPath = path.join(subjectsRoot, file);
  const descriptor = JSON.parse(fs.readFileSync(descriptorPath, 'utf8'));
  const result = materializeHarnessSubject(descriptorPath, {
    repoRoot: root,
    defaultProfile: loaded.registry.defaults[descriptor.kind],
    write
  });
  subjects += 1;
  const stale = result.files.filter((item) => ['missing', 'drift'].includes(item.status));
  if (result.errors.length > 0 || stale.length > 0) failed += 1;
  for (const error of result.errors) console.log(`x ${result.subject ?? file}: ${error}`);
  for (const item of result.files) console.log(`${item.status === 'unchanged' ? 'ok' : write ? 'write' : 'x'} ${result.subject}: ${item.target} ${item.status}`);
}
console.log(`${subjects} platform subject(s), ${failed} need attention${write ? '' : '; run npm run platform:harness:write to regenerate'}`);
if (failed > 0) process.exitCode = 1;
