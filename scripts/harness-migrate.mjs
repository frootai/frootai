#!/usr/bin/env node
// Migrate legacy plays to `extends` a harness profile. Check mode (default) only reports.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migratePlay } from '../engine/harness-migrator.js';
import { materializePlay } from '../engine/harness-materializer.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const playsRoot = path.join(root, 'solution-plays');
const exemptionsPath = path.join(root, 'harness', 'exemptions.json');
const args = process.argv.slice(2);
const write = args.includes('--write');
const json = args.includes('--json');
const selected = new Set(args.filter(arg => !arg.startsWith('--')));
const exemptions = fs.existsSync(exemptionsPath) ? JSON.parse(fs.readFileSync(exemptionsPath, 'utf8')).plays || {} : {};

const results = [];
for (const play of fs.readdirSync(playsRoot).filter(name => /^\d{2,3}-/.test(name)).sort()) {
  if (selected.size > 0 && !selected.has(play)) continue;
  const manifestPath = path.join(playsRoot, play, 'spec', 'fai-manifest.json');
  if (!fs.existsSync(manifestPath)) continue;
  const result = migratePlay(manifestPath, { write });
  if (write && result.status === 'migrated') {
    const generated = materializePlay(manifestPath, { write: true });
    if (generated.errors.length > 0) result.reasons.push(...generated.errors);
  }
  results.push({ ...result, content: undefined, exempt: exemptions[play] ?? null });
}

const summary = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
const unexplained = results.filter(r => r.status === 'blocked' && !r.exempt);
const staleExemptions = results.filter(r => r.exempt && r.status !== 'blocked').map(r => r.play);

if (json) {
  console.log(JSON.stringify({ summary, results }, null, 2));
} else {
  for (const r of results) {
    if (r.status === 'harnessed') continue;
    const mark = r.status === 'blocked' ? (r.exempt ? '○' : '✖') : write ? '↻' : '•';
    console.log(`${mark} ${r.play} ${r.status} ${r.profile ?? ''}${r.reasons.length ? ` — ${r.reasons.join('; ')}` : ''}`);
  }
  console.log(JSON.stringify(summary));
}

for (const play of staleExemptions) console.log(`✖ ${play}: exempt in harness/exemptions.json but no longer blocked; remove the exemption`);
for (const r of unexplained) if (!json) console.log(`✖ ${r.play}: blocked without an exemption`);

const today = new Date().toISOString().slice(0, 10);
const invalidExemptions = Object.entries(exemptions).filter(([play, entry]) =>
  typeof entry?.reason !== 'string' || entry.reason.length < 10
  || !/^\d{4}-\d{2}-\d{2}$/.test(entry?.review_by ?? '') || entry.review_by < today
  || (selected.size === 0 && !results.some(r => r.play === play)));
for (const [play, entry] of invalidExemptions) {
  console.log(`✖ ${play}: exemption needs a reason, a future review_by date and an existing play (review_by ${entry?.review_by ?? 'missing'})`);
}

// Harness by default: every play is harnessed or explicitly exempt with a reason.
const pending = results.filter(r => r.status === 'eligible');
if (unexplained.length > 0 || staleExemptions.length > 0 || invalidExemptions.length > 0
  || (!write && args.includes('--require-harness') && pending.length > 0)) {
  process.exitCode = 1;
}
