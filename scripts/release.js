#!/usr/bin/env node
/**
 * FrootAI Release Script
 * Automates the release process using conventional commits.
 *
 * Usage:
 *   node scripts/release.js              # Auto-detect bump from commits
 *   node scripts/release.js --bump patch # Force patch bump
 *   node scripts/release.js --bump minor # Force minor bump
 *   node scripts/release.js --bump major # Force major bump
 *   node scripts/release.js --target mcp # Only bump MCP server
 *   node scripts/release.js --target ext # Only bump VS Code extension
 *   node scripts/release.js --dry-run    # Preview without making changes
 *
 * Flow:
 *   1. Analyze conventional commits since last tag
 *   2. Determine version bump (patch/minor/major)
 *   3. Update package.json versions
 *   4. Run sync-content.js to propagate
 *   5. Generate/update CHANGELOG.md
 *   6. Commit + tag + push
 */

const { readFileSync, writeFileSync, existsSync } = require('fs');
const { execSync } = require('child_process');
const { join, resolve } = require('path');

const ROOT = resolve(join(__dirname, '..'));
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE_BUMP = args.includes('--bump') ? args[args.indexOf('--bump') + 1] : null;
const TARGET = args.includes('--target') ? args[args.indexOf('--target') + 1] : 'all';

function exec(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', ...opts }).trim();
}

function readJSON(rel) {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
}

function writeJSON(rel, obj) {
  writeFileSync(join(ROOT, rel), JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function bumpVersion(version, type) {
  const [major, minor, patch] = version.split('.').map(Number);
  switch (type) {
    case 'major': return `${major + 1}.0.0`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'patch': return `${major}.${minor}.${patch + 1}`;
    default: return version;
  }
}

// ─── 1. Get last tags ───
console.log('🔍 Analyzing commit history...\n');

let lastMcpTag, lastExtTag;
try { lastMcpTag = exec('git describe --tags --match "mcp-v*" --abbrev=0'); } catch (e) { lastMcpTag = null; }
try { lastExtTag = exec('git describe --tags --match "ext-v*" --abbrev=0'); } catch (e) { lastExtTag = null; }

console.log(`  Last MCP tag: ${lastMcpTag || '(none)'}`);
console.log(`  Last Extension tag: ${lastExtTag || '(none)'}`);

// ─── 2. Collect conventional commits ───
const sinceTag = lastMcpTag || lastExtTag || '';
const logRange = sinceTag ? `${sinceTag}..HEAD` : 'HEAD~50..HEAD';
let commits;
try {
  commits = exec(`git log ${logRange} --pretty=format:"%H|%s" --no-merges`)
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [hash, ...rest] = line.split('|');
      const subject = rest.join('|');
      return { hash: hash.replace(/"/g, ''), subject: subject.replace(/"/g, '') };
    });
} catch (e) {
  commits = [];
}

console.log(`  Commits since last tag: ${commits.length}\n`);

// ─── 3. Classify commits ───
const features = [];
const fixes = [];
const breaking = [];
const docs = [];
const chores = [];

for (const { hash, subject } of commits) {
  const short = hash.substring(0, 7);
  if (subject.startsWith('feat') && (subject.includes('!:') || subject.includes('BREAKING'))) {
    breaking.push({ short, subject });
  } else if (subject.startsWith('feat')) {
    features.push({ short, subject });
  } else if (subject.startsWith('fix')) {
    fixes.push({ short, subject });
  } else if (subject.startsWith('docs')) {
    docs.push({ short, subject });
  } else {
    chores.push({ short, subject });
  }
}

// ─── 4. Determine bump type ───
let bumpType = 'patch';
if (breaking.length > 0) bumpType = 'major';
else if (features.length > 0) bumpType = 'minor';
else if (fixes.length > 0) bumpType = 'patch';

if (FORCE_BUMP) bumpType = FORCE_BUMP;

console.log(`  Features:  ${features.length}`);
console.log(`  Fixes:     ${fixes.length}`);
console.log(`  Breaking:  ${breaking.length}`);
console.log(`  Docs:      ${docs.length}`);
console.log(`  Chores:    ${chores.length}`);
console.log(`  → Bump type: ${bumpType}${FORCE_BUMP ? ' (forced)' : ''}\n`);

// ─── 5. Calculate new versions ───
const mcpPkg = readJSON('npm-mcp/package.json');
const extPkg = readJSON('vscode-extension/package.json');
const oldMcpVersion = mcpPkg.version;
const oldExtVersion = extPkg.version;
const newMcpVersion = (TARGET === 'all' || TARGET === 'mcp') ? bumpVersion(oldMcpVersion, bumpType) : oldMcpVersion;
const newExtVersion = (TARGET === 'all' || TARGET === 'ext') ? bumpVersion(oldExtVersion, bumpType) : oldExtVersion;

console.log(`  MCP Server: ${oldMcpVersion} → ${newMcpVersion}`);
console.log(`  Extension:  ${oldExtVersion} → ${newExtVersion}`);

if (DRY_RUN) {
  console.log('\n🔒 DRY RUN — no changes made.');
  generateChangelog(newMcpVersion, true);
  process.exit(0);
}

// ─── 6. Update package.json files ───
console.log('\n📦 Updating versions...');

if (TARGET === 'all' || TARGET === 'mcp') {
  mcpPkg.version = newMcpVersion;
  writeJSON('npm-mcp/package.json', mcpPkg);
  console.log(`  ✅ npm-mcp/package.json → ${newMcpVersion}`);
}

if (TARGET === 'all' || TARGET === 'ext') {
  extPkg.version = newExtVersion;
  writeJSON('vscode-extension/package.json', extPkg);
  console.log(`  ✅ vscode-extension/package.json → ${newExtVersion}`);
}

// ─── 7. Run sync-content ───
console.log('\n🔄 Syncing content across channels...');
try {
  execSync('node scripts/sync-content.js', { cwd: ROOT, stdio: 'inherit' });
} catch (e) {
  console.error('❌ sync-content.js failed');
  process.exit(1);
}

// ─── 8. Validate ───
console.log('\n✅ Validating consistency...');
try {
  execSync('node scripts/validate-consistency.js', { cwd: ROOT, stdio: 'inherit' });
} catch (e) {
  console.error('❌ Validation failed after version bump. Fix manually.');
  process.exit(1);
}

// ─── 9. Generate CHANGELOG ───
generateChangelog(newMcpVersion, false);

// ─── 10. Commit and tag ───
console.log('\n🏷️  Creating release commit and tags...');

exec('git add -A');
const commitMsg = `chore(release): MCP v${newMcpVersion}, Extension v${newExtVersion}`;
exec(`git commit -m "${commitMsg}"`);
console.log(`  ✅ Committed: ${commitMsg}`);

if (TARGET === 'all' || TARGET === 'mcp') {
  exec(`git tag mcp-v${newMcpVersion}`);
  console.log(`  🏷️  Tagged: mcp-v${newMcpVersion}`);
}

if (TARGET === 'all' || TARGET === 'ext') {
  exec(`git tag ext-v${newExtVersion}`);
  console.log(`  🏷️  Tagged: ext-v${newExtVersion}`);
}

console.log('\n' + '═'.repeat(50));
console.log('✅ Release prepared! To publish:');
console.log(`   git push origin main --tags`);
console.log('');
console.log('This will trigger:');
if (TARGET === 'all' || TARGET === 'mcp') {
  console.log(`   → npm-publish.yml (mcp-v${newMcpVersion})`);
  console.log(`   → docker-publish.yml (mcp-v${newMcpVersion})`);
}
if (TARGET === 'all' || TARGET === 'ext') {
  console.log(`   → vsce-publish.yml (ext-v${newExtVersion})`);
}

// ─── Changelog generator ───
function generateChangelog(version, preview) {
  const date = new Date().toISOString().split('T')[0];
  let entry = `## [${version}] — ${date}\n\n`;

  if (breaking.length > 0) {
    entry += '### ⚠️ Breaking Changes\n\n';
    for (const c of breaking) entry += `- ${c.subject} (\`${c.short}\`)\n`;
    entry += '\n';
  }

  if (features.length > 0) {
    entry += '### ✨ Features\n\n';
    for (const c of features) entry += `- ${c.subject} (\`${c.short}\`)\n`;
    entry += '\n';
  }

  if (fixes.length > 0) {
    entry += '### 🐛 Bug Fixes\n\n';
    for (const c of fixes) entry += `- ${c.subject} (\`${c.short}\`)\n`;
    entry += '\n';
  }

  if (docs.length > 0) {
    entry += '### 📖 Documentation\n\n';
    for (const c of docs) entry += `- ${c.subject} (\`${c.short}\`)\n`;
    entry += '\n';
  }

  if (chores.length > 0) {
    entry += '### 🔧 Maintenance\n\n';
    for (const c of chores) entry += `- ${c.subject} (\`${c.short}\`)\n`;
    entry += '\n';
  }

  if (preview) {
    console.log('\n📋 CHANGELOG preview:\n');
    console.log(entry);
    return;
  }

  const changelogPath = join(ROOT, 'CHANGELOG.md');
  const header = '# Changelog\n\nAll notable changes to FrootAI are documented here.\nFormat follows [Keep a Changelog](https://keepachangelog.com/).\n\n';

  if (existsSync(changelogPath)) {
    const existing = readFileSync(changelogPath, 'utf8');
    // Insert new entry after the header
    const headerEnd = existing.indexOf('\n## ');
    if (headerEnd > 0) {
      const updated = existing.substring(0, headerEnd) + '\n' + entry + existing.substring(headerEnd);
      writeFileSync(changelogPath, updated, 'utf8');
    } else {
      writeFileSync(changelogPath, existing + '\n' + entry, 'utf8');
    }
  } else {
    writeFileSync(changelogPath, header + entry, 'utf8');
  }
  console.log('\n📋 CHANGELOG.md updated');
}
