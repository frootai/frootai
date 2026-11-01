#!/usr/bin/env node
// Portfolio harness report: adoption by profile, exemptions, waivers and warnings.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHarnessReport } from '../engine/harness-report.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const report = buildHarnessReport(path.join(root, 'solution-plays'));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Harness coverage: ${report.harnessed}/${report.plays} plays (${report.coverage}%), ${report.exempt} exempt`);
  for (const [profile, count] of Object.entries(report.byProfile)) console.log(`  ${profile}: ${count}`);
  if (report.waivers.length > 0) {
    console.log('Waivers:');
    for (const w of report.waivers) console.log(`  ${w.expires} ${w.play} ${w.rule}`);
  }
  console.log('Exemptions (next review first):');
  for (const e of report.exemptions) console.log(`  ${e.review_by}${e.overdue ? ' OVERDUE' : ''} ${e.play}: ${e.reason}`);
  console.log(`Warnings: ${report.warnings.length} across ${new Set(report.warnings.map(w => w.play)).size} play(s)`);
  for (const f of report.failing) console.log(`✖ ${f.play}: ${f.errors.join('; ')}`);
  for (const play of report.unharnessed) console.log(`✖ ${play}: not harnessed and not exempt`);
  console.log(report.healthy ? 'Healthy' : 'Needs attention');
}

if (!report.healthy) process.exitCode = 1;
