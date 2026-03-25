#!/usr/bin/env node
/**
 * FrootAI Consistency Validator
 * Checks that version numbers, tool counts, command counts, and copyright
 * are consistent across all distribution channels.
 * 
 * Usage: node scripts/validate-consistency.js
 * Run before every release to catch drift.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const readJSON = (rel) => JSON.parse(read(rel));

let errors = 0;
let warnings = 0;

function check(label, actual, expected) {
  if (actual !== expected) {
    console.error(`  ❌ ${label}: got "${actual}", expected "${expected}"`);
    errors++;
  } else {
    console.log(`  ✅ ${label}: ${actual}`);
  }
}

function warn(label, msg) {
  console.warn(`  ⚠️  ${label}: ${msg}`);
  warnings++;
}

// ─── 1. Version Numbers ───
console.log('\n📦 VERSION CONSISTENCY');

const mcpVersion = readJSON('mcp-server/package.json').version;
const extVersion = readJSON('vscode-extension/package.json').version;
console.log(`  MCP Server: ${mcpVersion}`);
console.log(`  VS Code Extension: ${extVersion}`);

// Check chatbot references
const chatbot = read('functions/server.js');
if (!chatbot.includes(`@${mcpVersion}`)) {
  console.error(`  ❌ Chatbot server.js does not reference frootai-mcp@${mcpVersion}`);
  errors++;
} else {
  console.log(`  ✅ Chatbot references MCP @${mcpVersion}`);
}

if (!chatbot.includes(`v${extVersion}`)) {
  console.error(`  ❌ Chatbot server.js does not reference extension v${extVersion}`);
  errors++;
} else {
  console.log(`  ✅ Chatbot references extension v${extVersion}`);
}

// ─── 2. Tool Count ───
console.log('\n🔧 TOOL COUNT CONSISTENCY');

const mcpIndex = read('mcp-server/index.js');
const toolMatches = mcpIndex.match(/server\.tool\(/g);
const actualToolCount = toolMatches ? toolMatches.length : 0;
console.log(`  Actual tools in index.js: ${actualToolCount}`);

// Check MCP package.json description
const mcpDesc = readJSON('mcp-server/package.json').description;
const descToolMatch = mcpDesc.match(/(\d+)\s*tools/);
if (descToolMatch) {
  check('npm description tool count', descToolMatch[1], String(actualToolCount));
}

// Check extension description
const extDesc = readJSON('vscode-extension/package.json').description;
const extToolMatch = extDesc.match(/(\d+)\s*MCP tools/);
if (extToolMatch) {
  check('Extension description tool count', extToolMatch[1], String(actualToolCount));
}

// ─── 3. Command Count ───
console.log('\n⌨️  COMMAND COUNT CONSISTENCY');

const extPkg = readJSON('vscode-extension/package.json');
const actualCmdCount = extPkg.contributes?.commands?.length || 0;
console.log(`  Actual commands in extension: ${actualCmdCount}`);

// ─── 4. Copyright ───
console.log('\n©️  COPYRIGHT CONSISTENCY');

const license = read('LICENSE');
if (license.includes('FrootAI Contributors')) {
  console.log('  ✅ LICENSE: FrootAI Contributors');
} else {
  console.error('  ❌ LICENSE: does not say "FrootAI Contributors"');
  errors++;
}

const notice = read('NOTICE');
if (notice.includes('FrootAI Contributors')) {
  console.log('  ✅ NOTICE: FrootAI Contributors');
} else {
  console.error('  ❌ NOTICE: does not say "FrootAI Contributors"');
  errors++;
}

// ─── 5. MCP Config ───
console.log('\n🔌 MCP CONFIG CONSISTENCY');

const rootMcp = read('.vscode/mcp.json');
if (rootMcp.includes('npx') && rootMcp.includes('frootai-mcp')) {
  console.log('  ✅ Root .vscode/mcp.json uses npx');
} else {
  console.error('  ❌ Root .vscode/mcp.json does NOT use npx — has local path');
  errors++;
}

// Check a sample of play mcp.json files
for (const play of ['01-enterprise-rag', '10-content-moderation', '20-anomaly-detection']) {
  const playMcp = join(ROOT, `solution-plays/${play}/.vscode/mcp.json`);
  if (existsSync(playMcp)) {
    const content = readFileSync(playMcp, 'utf8');
    if (content.includes('npx') && !content.includes('mcp-server/index')) {
      console.log(`  ✅ Play ${play} mcp.json uses npx`);
    } else {
      console.error(`  ❌ Play ${play} mcp.json has local path!`);
      errors++;
    }
  }
}

// ─── 6. Agent Frontmatter ───
console.log('\n🤖 AGENT FRONTMATTER');

for (const play of ['01-enterprise-rag', '10-content-moderation', '20-anomaly-detection']) {
  for (const agent of ['builder', 'reviewer', 'tuner']) {
    const agentFile = join(ROOT, `solution-plays/${play}/.github/agents/${agent}.agent.md`);
    if (existsSync(agentFile)) {
      const content = readFileSync(agentFile, 'utf8');
      if (content.startsWith('---')) {
        console.log(`  ✅ ${play}/${agent}: has YAML frontmatter`);
      } else {
        console.error(`  ❌ ${play}/${agent}: MISSING YAML frontmatter`);
        errors++;
      }
    }
  }
}

// ─── Summary ───
console.log('\n' + '═'.repeat(50));
if (errors === 0) {
  console.log(`✅ ALL CHECKS PASSED (${warnings} warnings)`);
  process.exit(0);
} else {
  console.error(`❌ ${errors} ERRORS found (${warnings} warnings)`);
  console.error('Fix the above issues before releasing.');
  process.exit(1);
}
