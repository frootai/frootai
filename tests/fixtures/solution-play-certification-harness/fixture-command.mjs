import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [command, receipt] = process.argv.slice(2);
const root = path.resolve(import.meta.dirname, '..');
const write = (relativePath, value = { status: 'passed' }) => {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value)}\n`, 'utf8');
};

if (process.env.FROOTAI_FIXTURE_PRINT_PROTECTED) process.stdout.write(`protected=${process.env.FROOTAI_FIXTURE_PRINT_PROTECTED}\nemail=person@example.com\n`);
if (command === 'flood') {
  setInterval(() => process.stdout.write('x'.repeat(8192)), 5);
} else if (command === 'timeout') {
  const marker = process.env.FROOTAI_FIXTURE_CHILD_MARKER;
  spawn(process.execPath, ['-e', `setTimeout(() => require('fs').writeFileSync(${JSON.stringify(marker)}, 'alive'), 3000)`], { detached: false, stdio: 'ignore' });
  setInterval(() => {}, 1000);
} else {
  if (process.env.FROOTAI_FIXTURE_FAIL_COMMAND === command) process.exit(17);
  if (command === 'no-receipt') {}
  else if (process.env.FROOTAI_FIXTURE_CORRUPT_RECEIPT === command) fs.writeFileSync(path.join(root, receipt), '{corrupt', 'utf8');
  else write(receipt, { status: 'passed', command, run_id: process.env.FROOTAI_CERT_RUN_ID });
  if (command === 'setup') {
    const paths = [
      'reference/evidence/platform/residency.json', 'reference/evidence/platform/model-availability.json', 'reference/evidence/platform/fallback-model-availability.json',
      'reference/evidence/platform/quota.json', 'reference/evidence/platform/capacity.json', 'reference/evidence/platform/resource-limits.json', 'reference/evidence/platform/failover-test.json',
      'reference/evidence/cost/estimate.json', 'reference/evidence/data/restore-test.json', 'reference/evidence/alerts/availability.json',
      'reference/evidence/alerts/server-errors.json', 'reference/evidence/alerts/budget.json'
    ];
    for (const item of paths) write(item);
    write('reference/evidence/approvals/production-deploy.json', { state: 'approved', state_store: 'approval-ledger', approver_ids: ['operator-human'], approved_at: '2026-08-02T00:00:00Z', used_at: '2026-08-02T00:10:00Z' });
  }
  if (command === 'deploy') write('reference/evidence/deployment/preview.json');
  if (command === 'smoke') write('reference/evidence/deployment/smoke.json');
  if (command === 'rollback') {
    for (const item of ['reference/evidence/deployment/rollback-success.json', 'reference/evidence/deployment/rollback-partial-failure.json', 'reference/evidence/deployment/dr-success.json', 'reference/evidence/deployment/dr-partial-failure.json']) write(item);
  }
  if (command === 'cleanup') {
    for (const item of ['reference/evidence/data/deletion.json', 'reference/evidence/deployment/cleanup-success.json', 'reference/evidence/deployment/cleanup-partial-failure.json']) write(item);
    if (process.env.FROOTAI_FIXTURE_CLEANUP_MARKER) fs.writeFileSync(process.env.FROOTAI_FIXTURE_CLEANUP_MARKER, 'cleaned', 'utf8');
  }
}