#!/usr/bin/env node
/**
 * FrootAI Consistency Validator v2
 * Checks that version numbers, tool counts, command counts, URLs, and copyright
 * are consistent across all 6 distribution channels.
 *
 * Channels: npm (MCP server), VS Code Extension, Docker, Website, Chatbot, GitHub README
 *
 * Usage: node scripts/validate-consistency.js [--fix]
 * Run before every release to catch drift.
 * With --fix: auto-fix issues by calling sync-content.js
 */

const { readFileSync, existsSync, readdirSync } = require('fs');
const { join, resolve } = require('path');
const { execSync } = require('child_process');

const ROOT = resolve(join(__dirname, '..'));
const FIX_MODE = process.argv.includes('--fix');

const read = (rel) => {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf8');
};
const readJSON = (rel) => {
  const content = read(rel);
  return content ? JSON.parse(content) : null;
};

let errors = 0;
let warnings = 0;
const fixable = [];

function check(label, actual, expected, fixHint) {
  if (actual !== expected) {
    console.error(`  ❌ ${label}: got "${actual}", expected "${expected}"`);
    errors++;
    if (fixHint) fixable.push({ label, fixHint });
  } else {
    console.log(`  ✅ ${label}: ${actual}`);
  }
}

function warn(label, msg) {
  console.warn(`  ⚠️  ${label}: ${msg}`);
  warnings++;
}

function section(title) {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  ${title}`);
  console.log(`${'─'.repeat(50)}`);
}

// ═══════════════════════════════════════════════════
// 1. VERSION NUMBERS
// ═══════════════════════════════════════════════════
section('📦 VERSION CONSISTENCY');

const mcpPkg = readJSON('npm-mcp/package.json');
const extPkg = readJSON('vscode-extension/package.json');
const mcpVersion = mcpPkg?.version || null;
const extVersion = extPkg?.version || null;

if (!mcpPkg) console.log('  ⏭️  npm-mcp/ not in this repo (moved to frootai-core) — skipping MCP version checks');
if (!extPkg) console.log('  ⏭️  vscode-extension/ not in this repo (moved to frootai-core) — skipping extension version checks');

if (mcpVersion) console.log(`  MCP Server version: ${mcpVersion}`);
if (extVersion) console.log(`  VS Code Extension version: ${extVersion}`);

// Check chatbot references MCP version
const chatbot = read('functions/server.js');
if (chatbot && mcpVersion) {
  if (!chatbot.includes(`@${mcpVersion}`)) {
    check('Chatbot → MCP version', 'missing', `@${mcpVersion}`, 'functions/server.js');
  } else {
    console.log(`  ✅ Chatbot references MCP @${mcpVersion}`);
  }

  if (extVersion && !chatbot.includes(`v${extVersion}`)) {
    check('Chatbot → Extension version', 'missing', `v${extVersion}`, 'functions/server.js');
  } else if (extVersion) {
    console.log(`  ✅ Chatbot references extension v${extVersion}`);
  }
}

// Check README references
const readme = read('README.md');
if (readme && mcpVersion) {
  const readmeVersionMatch = readme.match(/frootai-mcp@(\d+\.\d+\.\d+)/);
  if (readmeVersionMatch) {
    check('README → MCP version', readmeVersionMatch[1], mcpVersion, 'README.md');
  }
}

// ═══════════════════════════════════════════════════
// 2. TOOL COUNT
// ═══════════════════════════════════════════════════
section('🔧 TOOL COUNT CONSISTENCY');

const mcpIndex = read('npm-mcp/index.js');
let actualToolCount = 0;
if (mcpIndex) {
  const toolMatches = mcpIndex.match(/server\.tool\(/g);
  actualToolCount = toolMatches ? toolMatches.length : 0;
  console.log(`  Source of truth (index.js): ${actualToolCount} tools`);
} else {
  console.log('  ⏭️  npm-mcp/index.js not found — skipping tool count checks');
}

// npm description
if (mcpPkg?.description && mcpIndex) {
  const m = mcpPkg.description.match(/(\d+)\s*tools/);
  if (m) check('npm description tool count', m[1], String(actualToolCount), 'npm-mcp/package.json');
}

// Extension description
if (extPkg?.description && mcpIndex) {
  const m = extPkg.description.match(/(\d+)\s*MCP tools/);
  if (m) check('Extension description tool count', m[1], String(actualToolCount), 'vscode-extension/package.json');
}

// Extension sidebar
if (extPkg?.contributes && mcpIndex) {
  const views = JSON.stringify(extPkg.contributes);
  const m = views.match(/MCP Tools \((\d+)\)/);
  if (m) check('Extension sidebar tool count', m[1], String(actualToolCount), 'vscode-extension/package.json');
}

// README references
if (readme && mcpIndex) {
  const readmeToolRefs = readme.match(/(\d+) tools/g) || [];
  const readmeToolCounts = readmeToolRefs.map(r => parseInt(r));
  const wrongCounts = readmeToolCounts.filter(c => c !== actualToolCount && c > 10);
  if (wrongCounts.length > 0) {
    check('README tool count references', String(wrongCounts[0]), String(actualToolCount), 'README.md');
  } else if (readmeToolCounts.length > 0) {
    console.log(`  ✅ README tool count references: all say ${actualToolCount}`);
  }
}

// ═══════════════════════════════════════════════════
// 3. COMMAND COUNT
// ═══════════════════════════════════════════════════
section('⌨️  COMMAND COUNT CONSISTENCY');

const actualCmdCount = extPkg?.contributes?.commands?.length || 0;
if (extPkg) {
  console.log(`  Source of truth (extension commands): ${actualCmdCount}`);
} else {
  console.log('  ⏭️  vscode-extension/ not found — skipping command count checks');
}

if (readme && extPkg) {
  const cmdMatch = readme.match(/(\d+)\s*commands/);
  if (cmdMatch) {
    check('README command count', cmdMatch[1], String(actualCmdCount), 'README.md');
  }
}

// ═══════════════════════════════════════════════════
// 4. SOLUTION PLAY COUNT
// ═══════════════════════════════════════════════════
section('🎯 SOLUTION PLAY COUNT');

const playsDir = join(ROOT, 'solution-plays');
let actualPlayCount = 0;
if (existsSync(playsDir)) {
  actualPlayCount = readdirSync(playsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^\d+/.test(d.name))
    .length;
}
console.log(`  Source of truth (solution-plays/): ${actualPlayCount} plays`);

if (mcpPkg?.description) {
  const m = mcpPkg.description.match(/(\d+)\s*solution plays/);
  if (m) check('npm description play count', m[1], String(actualPlayCount), 'npm-mcp/package.json');
} else if (!mcpPkg) {
  console.log('  ⏭️  npm-mcp/ not found — skipping npm description play count check');
}

if (readme) {
  const playRefs = readme.match(/(\d+)\s*solution plays/g) || [];
  const playCounts = playRefs.map(r => parseInt(r));
  const wrongPlays = playCounts.filter(c => c !== actualPlayCount && c > 5);
  if (wrongPlays.length > 0) {
    check('README play count', String(wrongPlays[0]), String(actualPlayCount), 'README.md');
  } else if (playCounts.length > 0) {
    console.log(`  ✅ README play count references: all say ${actualPlayCount}`);
  }
}

// ═══════════════════════════════════════════════════
// 5. MODULE COUNT
// ═══════════════════════════════════════════════════
section('📚 MODULE COUNT');

let actualModuleCount = 0;
const knowledge = readJSON('npm-mcp/knowledge.json');
if (knowledge?.modules) {
  actualModuleCount = Object.keys(knowledge.modules).length;
  console.log(`  Source of truth (knowledge.json): ${actualModuleCount} modules`);
} else {
  console.log('  ⏭️  npm-mcp/knowledge.json not found — skipping module count checks');
}

if (mcpPkg?.description && knowledge) {
  const m = mcpPkg.description.match(/(\d+)\s*modules/);
  if (m && actualModuleCount > 0) check('npm description module count', m[1], String(actualModuleCount), 'npm-mcp/package.json');
}

// ═══════════════════════════════════════════════════
// 6. URL VALIDATION
// ═══════════════════════════════════════════════════
section('🔗 URL CONSISTENCY');

const expectedURLs = {
  'frootai.dev': 'https://frootai.dev',
  'npm package': 'https://www.npmjs.com/package/frootai-mcp',
  'GitHub repo': 'https://github.com/frootai/frootai',
  'Docker image': 'ghcr.io/frootai/frootai-mcp',
};

for (const [name, url] of Object.entries(expectedURLs)) {
  if (readme && !readme.includes(url)) {
    console.error(`  ❌ README missing URL: ${name} (${url})`);
    errors++;
  } else {
    console.log(`  ✅ README contains ${name} URL`);
  }
}

if (mcpPkg && mcpPkg?.homepage !== 'https://frootai.dev') {
  check('npm homepage', mcpPkg?.homepage || 'missing', 'https://frootai.dev', 'npm-mcp/package.json');
}

if (mcpPkg && mcpPkg?.repository?.url !== 'https://github.com/frootai/frootai') {
  check('npm repository', mcpPkg?.repository?.url || 'missing', 'https://github.com/frootai/frootai', 'npm-mcp/package.json');
}

// ═══════════════════════════════════════════════════
// 7. COPYRIGHT & LICENSE
// ═══════════════════════════════════════════════════
section('©️  COPYRIGHT & LICENSE');

const license = read('LICENSE');
if (license) {
  if (license.includes('FrootAI Contributors')) {
    console.log('  ✅ LICENSE: FrootAI Contributors');
  } else {
    console.error('  ❌ LICENSE: does not say "FrootAI Contributors"');
    errors++;
  }
}

const notice = read('NOTICE');
if (notice) {
  if (notice.includes('FrootAI Contributors')) {
    console.log('  ✅ NOTICE: FrootAI Contributors');
  } else {
    console.error('  ❌ NOTICE: does not say "FrootAI Contributors"');
    errors++;
  }
}

// ═══════════════════════════════════════════════════
// 8. MCP CONFIG
// ═══════════════════════════════════════════════════
section('🔌 MCP CONFIG CONSISTENCY');

const rootMcp = read('.vscode/mcp.json');
if (rootMcp) {
  if (rootMcp.includes('npx') && rootMcp.includes('frootai-mcp')) {
    console.log('  ✅ Root .vscode/mcp.json uses npx');
  } else {
    console.error('  ❌ Root .vscode/mcp.json does NOT use npx');
    errors++;
  }
}

// Check play mcp.json files
const playDirs = existsSync(playsDir)
  ? readdirSync(playsDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^\d+/.test(d.name))
      .map(d => d.name)
  : [];

for (const play of playDirs) {
  const playMcp = join(ROOT, `solution-plays/${play}/.vscode/mcp.json`);
  if (existsSync(playMcp)) {
    const content = readFileSync(playMcp, 'utf8');
    if (content.includes('npx') && !content.includes('npm-mcp/index')) {
      console.log(`  ✅ Play ${play} mcp.json uses npx`);
    } else {
      console.error(`  ❌ Play ${play} mcp.json has local path!`);
      errors++;
    }
  }
}

// ═══════════════════════════════════════════════════
// 9. AGENT FRONTMATTER
// ═══════════════════════════════════════════════════
section('🤖 AGENT FRONTMATTER');

for (const play of playDirs) {
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

// ═══════════════════════════════════════════════════
// 10. GITHUB ACTIONS HEALTH
// ═══════════════════════════════════════════════════
section('⚙️  GITHUB ACTIONS');

const expectedWorkflows = [
  'consistency-check.yml',
  'deploy-chatbot.yml',
  'docker-publish.yml',
  'npm-publish.yml',
  'vsce-publish.yml',
  'validate-plays.yml',
];

const workflowDir = join(ROOT, '.github/workflows');
if (existsSync(workflowDir)) {
  const actual = readdirSync(workflowDir);
  for (const wf of expectedWorkflows) {
    if (actual.includes(wf)) {
      console.log(`  ✅ ${wf} exists`);
    } else {
      console.error(`  ❌ ${wf} MISSING`);
      errors++;
    }
  }
}

// ═══════════════════════════════════════════════════
// 11. CROSS-CHANNEL VERSION MATRIX
// ═══════════════════════════════════════════════════
section('📊 CROSS-CHANNEL VERSION MATRIX');

console.log('  Channel                  | Version');
console.log('  ─────────────────────────┼──────────');
console.log(`  ${'npm (MCP Server)'.padEnd(25)} | ${mcpVersion || 'N/A (in frootai-core)'}`);
console.log(`  ${'VS Code Extension'.padEnd(25)} | ${extVersion || 'N/A (in frootai-core)'}`);
console.log(`  ${'Docker'.padEnd(25)} | ${mcpVersion ? mcpVersion + ' (follows npm)' : 'N/A'}`);
console.log(`  ${'Website'.padEnd(25)} | auto-deploy on push`);
console.log(`  ${'Chatbot API'.padEnd(25)} | auto-deploy on push`);

// ═══════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════
console.log('\n' + '═'.repeat(50));
if (errors === 0) {
  console.log(`✅ ALL CHECKS PASSED (${warnings} warnings)`);
  process.exit(0);
} else {
  console.error(`❌ ${errors} ERRORS found (${warnings} warnings)`);
  if (fixable.length > 0 && !FIX_MODE) {
    console.log('\n💡 Run with --fix to auto-repair:');
    console.log('   node scripts/validate-consistency.js --fix\n');
    for (const f of fixable) {
      console.log(`   → ${f.label} (${f.fixHint})`);
    }
  }
  if (FIX_MODE) {
    console.log('\n🔧 Running sync-content.js to auto-fix...');
    try {
      execSync('node scripts/sync-content.js', { cwd: ROOT, stdio: 'inherit' });
      console.log('✅ Auto-fix complete. Re-run validate to confirm.');
    } catch (e) {
      console.error('❌ Auto-fix failed. Manual intervention needed.');
    }
  }
  process.exit(FIX_MODE ? 0 : 1);
}
