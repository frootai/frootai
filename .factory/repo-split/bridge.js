#!/usr/bin/env node
/**
 * FAI Factory — Cross-Repo Bridge
 * Syncs primitives from public repo to core repo for factory processing.
 *
 * Usage:
 *   node bridge.js sync      # Sync public → core
 *   node bridge.js verify    # Verify cross-repo integrity
 *   node bridge.js status    # Show sync status
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Resolve repo paths from config or environment
const PUBLIC_REPO = process.env.FROOTAI_PUBLIC_REPO || path.resolve(__dirname, '..', '..', '..', 'frootai');
const CORE_REPO = process.env.FROOTAI_CORE_REPO || path.resolve(__dirname, '..', '..');
const WEBSITE_REPO = process.env.FROOTAI_WEBSITE_REPO || path.resolve(__dirname, '..', '..', '..', 'frootai.dev');

const SYNC_FOLDERS = [
  'agents', 'instructions', 'skills', 'hooks', 'plugins', 'workflows',
  'cookbook', 'solution-plays', 'docs', 'schemas', 'engine', 'fai-protocol',
  'community-plugins', 'evaluation', 'marketplace.json', 'AGENTS.md'
];

function sync() {
  console.log('🔄 FAI Bridge — Syncing public → core');
  console.log('  Public: ' + PUBLIC_REPO);
  console.log('  Core:   ' + CORE_REPO);

  if (!fs.existsSync(PUBLIC_REPO)) {
    console.error('❌ Public repo not found at: ' + PUBLIC_REPO);
    console.error('   Set FROOTAI_PUBLIC_REPO environment variable');
    process.exit(1);
  }

  const syncDir = path.join(CORE_REPO, '.sync', 'public');
  if (!fs.existsSync(syncDir)) fs.mkdirSync(syncDir, { recursive: true });

  let synced = 0;
  for (const item of SYNC_FOLDERS) {
    const src = path.join(PUBLIC_REPO, item);
    const dst = path.join(syncDir, item);
    if (!fs.existsSync(src)) continue;

    // Use symlink for directories, copy for files
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true });
      // Create junction (Windows) or symlink (Unix)
      try {
        fs.symlinkSync(src, dst, 'junction');
        synced++;
      } catch (err) {
        console.warn('  ⚠️  Symlink failed for ' + item + ': ' + err.message);
        // Fallback: don't copy, just reference
      }
    } else {
      fs.copyFileSync(src, dst);
      synced++;
    }
  }

  console.log('  ✅ Synced ' + synced + '/' + SYNC_FOLDERS.length + ' items');

  // Write sync manifest
  const manifest = {
    syncedAt: new Date().toISOString(),
    publicRepoPath: PUBLIC_REPO,
    publicRepoHead: getGitHead(PUBLIC_REPO),
    itemsSynced: synced,
    items: SYNC_FOLDERS
  };
  fs.writeFileSync(path.join(syncDir, 'sync-manifest.json'), JSON.stringify(manifest, null, 2));
}

function verify() {
  console.log('🔍 FAI Bridge — Verifying cross-repo integrity');

  const checks = [];

  // Check public repo exists and is clean
  if (fs.existsSync(PUBLIC_REPO)) {
    checks.push({ check: 'Public repo exists', pass: true, path: PUBLIC_REPO });
    const head = getGitHead(PUBLIC_REPO);
    checks.push({ check: 'Public repo has commits', pass: !!head, detail: head });
  } else {
    checks.push({ check: 'Public repo exists', pass: false, path: PUBLIC_REPO });
  }

  // Check core repo
  if (fs.existsSync(CORE_REPO)) {
    checks.push({ check: 'Core repo exists', pass: true, path: CORE_REPO });
  } else {
    checks.push({ check: 'Core repo exists', pass: false, path: CORE_REPO });
  }

  // Check website repo
  if (fs.existsSync(WEBSITE_REPO)) {
    checks.push({ check: 'Website repo exists', pass: true, path: WEBSITE_REPO });
  } else {
    checks.push({ check: 'Website repo exists', pass: false, path: WEBSITE_REPO });
  }

  // Check key files exist in public
  const keyPublicFiles = ['schemas/fai-manifest.schema.json', 'engine/index.js', 'AGENTS.md', 'LICENSE'];
  for (const f of keyPublicFiles) {
    const exists = fs.existsSync(path.join(PUBLIC_REPO, f));
    checks.push({ check: 'Public: ' + f, pass: exists });
  }

  // Print results
  let allPass = true;
  for (const c of checks) {
    const icon = c.pass ? '✅' : '❌';
    console.log('  ' + icon + ' ' + c.check + (c.detail ? ' (' + c.detail + ')' : ''));
    if (!c.pass) allPass = false;
  }

  console.log(allPass ? '\n  ✅ All checks passed' : '\n  ❌ Some checks failed');
  return allPass;
}

function getGitHead(repoPath) {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: repoPath, encoding: 'utf8' }).trim();
  } catch { return null; }
}

// CLI
const cmd = process.argv[2] || 'status';
if (cmd === 'sync') sync();
else if (cmd === 'verify') verify();
else {
  console.log('FAI Bridge — Cross-Repo Management');
  console.log('  sync    — Sync public repo primitives to core');
  console.log('  verify  — Verify cross-repo integrity');
}
