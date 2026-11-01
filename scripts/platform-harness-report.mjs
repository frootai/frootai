#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPlatformHarnessReport } from '../engine/platform-harness.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const report = buildPlatformHarnessReport(root);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Platform harness: ${report.harnessed}/${report.total} directly harnessed (${report.coverage}%), ${report.exempt} reviewed exemptions`);
  for (const [kind, counts] of Object.entries(report.byKind)) {
    console.log(`  ${kind}: ${counts.harnessed}/${counts.total} harnessed, ${counts.exempt} exempt, ${counts.failed} failed`);
  }
  console.log(`  system errors: ${report.systemErrors}`);
  for (const error of report.errors) console.log(`x ${error}`);
  for (const entry of report.entries.filter((item) => item.errors.length > 0)) console.log(`x ${entry.id}: ${entry.errors.join('; ')}`);
  console.log(report.healthy ? 'Healthy' : 'Needs attention');
}

if (!report.healthy) process.exitCode = 1;
