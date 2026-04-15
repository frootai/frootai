#!/usr/bin/env node
/**
 * FrootAI — Auto-Generate README Tables
 * 
 * Scans all primitive folders and regenerates the inventory tables in README.md.
 * Run this after adding primitives to keep documentation in sync.
 * 
 * What it updates:
 *   - Agent count + table in agents/README.md
 *   - Instruction count in instructions/README.md
 *   - Skill count in skills/README.md
 *   - Hook count in hooks/README.md
 *   - Plugin count in plugins/README.md
 *   - Workflow count in workflows/README.md
 *   - Main README.md primitive inventory section
 * 
 * Usage:
 *   node scripts/update-readme.js           # Update all READMEs
 *   node scripts/update-readme.js --dry-run # Preview changes
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

let updated = 0;

function countFiles(dir, filter) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter(filter).length;
}

function updateBadge(readmePath, label, count) {
  if (!fs.existsSync(readmePath)) return;

  let content = fs.readFileSync(readmePath, 'utf8');

  // Update shield.io badge pattern: ![Agents](https://img.shields.io/badge/Agents-238-...)
  const badgeRegex = new RegExp(`(img\\.shields\\.io/badge/${label}-)\\d+(-[^)]+)`, 'g');
  const newContent = content.replace(badgeRegex, `$1${count}$2`);

  // Update inline count pattern: **238 agents** or *238 agents*
  const countRegex = new RegExp(`\\*\\*\\d+ ${label.toLowerCase()}s?\\*\\*`, 'gi');
  const finalContent = newContent.replace(countRegex, `**${count} ${label.toLowerCase()}${count !== 1 ? 's' : ''}**`);

  if (finalContent !== content) {
    if (!DRY_RUN) fs.writeFileSync(readmePath, finalContent);
    console.log(`  ✅ ${path.relative(ROOT, readmePath)} — ${label}: ${count}`);
    updated++;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`🍊 FrootAI README Updater${DRY_RUN ? ' (DRY RUN)' : ''}`);

const agents = countFiles(path.join(ROOT, 'agents'), f => f.endsWith('.agent.md'));
const instructions = countFiles(path.join(ROOT, 'instructions'), f => f.endsWith('.instructions.md'));
const skills = countFiles(path.join(ROOT, 'skills'), f => {
  try { return fs.statSync(path.join(ROOT, 'skills', f)).isDirectory(); } catch { return false; }
});
const hooks = countFiles(path.join(ROOT, 'hooks'), f => {
  try { return fs.statSync(path.join(ROOT, 'hooks', f)).isDirectory(); } catch { return false; }
});
const plugins = countFiles(path.join(ROOT, 'plugins'), f => {
  try { return fs.statSync(path.join(ROOT, 'plugins', f)).isDirectory(); } catch { return false; }
});
const workflows = countFiles(path.join(ROOT, 'workflows'), f => f.endsWith('.md') && f !== 'README.md');
const cookbook = countFiles(path.join(ROOT, 'cookbook'), f => f.endsWith('.md') && f !== 'README.md');

console.log(`\n  Inventory:`);
console.log(`    Agents:       ${agents}`);
console.log(`    Instructions: ${instructions}`);
console.log(`    Skills:       ${skills}`);
console.log(`    Hooks:        ${hooks}`);
console.log(`    Plugins:      ${plugins}`);
console.log(`    Workflows:    ${workflows}`);
console.log(`    Cookbook:      ${cookbook}`);

// Update folder READMEs
updateBadge(path.join(ROOT, 'README.md'), 'Agent', agents);
updateBadge(path.join(ROOT, 'README.md'), 'Instruction', instructions);
updateBadge(path.join(ROOT, 'README.md'), 'Skill', skills);
updateBadge(path.join(ROOT, 'README.md'), 'Hook', hooks);
updateBadge(path.join(ROOT, 'README.md'), 'Plugin', plugins);
updateBadge(path.join(ROOT, 'README.md'), 'Workflow', workflows);

console.log(`\n  Updated: ${updated} files${DRY_RUN ? ' (dry run)' : ''}\n`);
