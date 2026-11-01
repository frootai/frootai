#!/usr/bin/env node
// Check (default) or regenerate profile-owned files for every play that declares `extends`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { materializePlay } from '../engine/harness-materializer.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const playsRoot = path.join(root, 'solution-plays');
const args = process.argv.slice(2);
const write = args.includes('--write');
const selected = new Set(args.filter(arg => !arg.startsWith('--')));

const plays = fs.readdirSync(playsRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && /^\d{2,3}-/.test(entry.name) && (selected.size === 0 || selected.has(entry.name)))
  .map(entry => entry.name)
  .sort();

let harnessed = 0;
let failed = 0;
for (const play of plays) {
  const manifestPath = path.join(playsRoot, play, 'spec', 'fai-manifest.json');
  if (!fs.existsSync(manifestPath)) continue;
  const result = materializePlay(manifestPath, { write });
  if (!result.extends) continue;
  harnessed++;
  const stale = result.files.filter(file => file.status === 'drift' || file.status === 'missing');
  if (result.errors.length > 0 || stale.length > 0) failed++;
  for (const error of result.errors) console.log(`✖ ${play}: ${error}`);
  for (const file of result.files) console.log(`${file.status === 'unchanged' ? '✔' : write ? '↻' : '✖'} ${play}: ${file.target} ${file.status}`);
}

console.log(`${harnessed} harnessed play(s), ${failed} need attention${write ? '' : '; run npm run harness:write to regenerate'}`);
if (failed > 0) process.exitCode = 1;
