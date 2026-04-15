#!/usr/bin/env node
/**
 * FrootAI Content Sync — Auto-update all downstream files from sources of truth.
 *
 * Sources of truth:
 *   - npm-mcp/index.js         → tool count (server.tool() calls)
 *   - npm-mcp/package.json     → MCP version, description
 *   - npm-mcp/knowledge.json   → module count
 *   - vscode-extension/package.json → extension version, command count
 *   - solution-plays/              → play count (directories)
 *
 * Downstream files updated:
 *   - README.md
 *   - npm-mcp/package.json (description counts)
 *   - vscode-extension/package.json (description counts)
 *   - functions/server.js (version refs)
 *
 * Usage: node scripts/sync-content.js
 * The "Stripe approach" — code is truth, everything else is generated.
 */

const { readFileSync, writeFileSync, existsSync, readdirSync } = require('fs');
const { join, resolve } = require('path');

const ROOT = resolve(join(__dirname, '..'));
let changes = 0;

function read(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf8');
}

function readJSON(rel) {
  const c = read(rel);
  return c ? JSON.parse(c) : null;
}

function write(rel, content) {
  writeFileSync(join(ROOT, rel), content, 'utf8');
}

function writeJSON(rel, obj) {
  write(rel, JSON.stringify(obj, null, 2) + '\n');
}

function updateFile(rel, replacer, label) {
  const content = read(rel);
  if (!content) return;
  const updated = replacer(content);
  if (updated !== content) {
    write(rel, updated);
    console.log(`  ✏️  ${label} → ${rel}`);
    changes++;
  } else {
    console.log(`  ✅ ${label} — already correct in ${rel}`);
  }
}

// ─── Gather sources of truth ───
console.log('🔍 Reading sources of truth...\n');

const mcpPkg = readJSON('npm-mcp/package.json');
const extPkg = readJSON('vscode-extension/package.json');
const mcpVersion = mcpPkg?.version || '0.0.0';
const extVersion = extPkg?.version || '0.0.0';

const mcpIndex = read('npm-mcp/index.js') || '';
const toolMatches = mcpIndex.match(/server\.tool\(/g);
const toolCount = toolMatches ? toolMatches.length : 0;

const cmdCount = extPkg?.contributes?.commands?.length || 0;

const knowledge = readJSON('npm-mcp/knowledge.json');
const moduleCount = knowledge?.modules ? Object.keys(knowledge.modules).length : 0;

const playsDir = join(ROOT, 'solution-plays');
const playCount = existsSync(playsDir)
  ? readdirSync(playsDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^\d+/.test(d.name)).length
  : 0;

console.log(`  MCP version:     ${mcpVersion}`);
console.log(`  Extension version: ${extVersion}`);
console.log(`  Tools:           ${toolCount}`);
console.log(`  Commands:        ${cmdCount}`);
console.log(`  Modules:         ${moduleCount}`);
console.log(`  Solution plays:  ${playCount}`);
console.log('');

// ─── 1. Sync README.md ───
console.log('📝 Syncing README.md...');

updateFile('README.md', (content) => {
  // Update frootai-mcp@X.Y.Z references
  content = content.replace(/frootai-mcp@\d+\.\d+\.\d+/g, `frootai-mcp@${mcpVersion}`);

  // Update "N tools" references (only where N > 10 to avoid false matches)
  content = content.replace(/\b(\d+) tools\b/g, (match, n) => {
    return parseInt(n) > 10 ? `${toolCount} tools` : match;
  });

  // Update "N MCP tools" references
  content = content.replace(/\b\d+ MCP tools\b/g, `${toolCount} MCP tools`);

  // Update "N knowledge modules" references
  content = content.replace(/\b\d+ knowledge modules\b/g, `${moduleCount} knowledge modules`);

  // Update "all N modules" references
  content = content.replace(/all \d+ modules/g, `all ${moduleCount} modules`);

  // Update "N modules" in the summary line (e.g., "18 modules · 22 MCP tools · 20 solution plays")
  content = content.replace(/(\d+) modules · (\d+) MCP tools · (\d+) solution plays/g,
    `${moduleCount} modules · ${toolCount} MCP tools · ${playCount} solution plays`);

  // Update "N solution plays" references
  content = content.replace(/\b\d+ solution plays\b/g, `${playCount} solution plays`);

  // Update "N commands" references
  content = content.replace(/\b\d+ commands\b/g, `${cmdCount} commands`);

  return content;
}, 'Version + counts');

// ─── 2. Sync MCP package.json description ───
console.log('\n📦 Syncing npm-mcp/package.json description...');

if (mcpPkg) {
  let desc = mcpPkg.description;
  const origDesc = desc;
  desc = desc.replace(/\b\d+ tools/g, `${toolCount} tools`);
  desc = desc.replace(/\b\d+ modules/g, `${moduleCount} modules`);
  desc = desc.replace(/\b\d+ solution plays/g, `${playCount} solution plays`);
  if (desc !== origDesc) {
    mcpPkg.description = desc;
    writeJSON('npm-mcp/package.json', mcpPkg);
    console.log(`  ✏️  Updated description — ${toolCount} tools, ${moduleCount} modules, ${playCount} plays`);
    changes++;
  } else {
    console.log(`  ✅ Description already correct`);
  }
}

// ─── 3. Sync Extension package.json description ───
console.log('\n🔌 Syncing vscode-extension/package.json description...');

if (extPkg) {
  let desc = extPkg.description;
  const origDesc = desc;
  desc = desc.replace(/\b\d+ MCP tools/g, `${toolCount} MCP tools`);
  desc = desc.replace(/\b\d+ modules/g, `${moduleCount} modules`);
  desc = desc.replace(/\b\d+ solution plays/g, `${playCount} solution plays`);

  // Also fix sidebar view name
  if (extPkg.contributes?.views?.frootai) {
    for (const view of extPkg.contributes.views.frootai) {
      if (view.name && view.name.includes('MCP Tools')) {
        view.name = view.name.replace(/MCP Tools \(\d+\)/, `MCP Tools (${toolCount})`);
      }
    }
  }

  if (desc !== origDesc || JSON.stringify(extPkg) !== readFileSync(join(ROOT, 'vscode-extension/package.json'), 'utf8')) {
    extPkg.description = desc;
    writeJSON('vscode-extension/package.json', extPkg);
    console.log(`  ✏️  Updated description + sidebar`);
    changes++;
  } else {
    console.log(`  ✅ Already correct`);
  }
}

// ─── 4. Sync chatbot server.js version references ───
console.log('\n🤖 Syncing functions/server.js...');

updateFile('functions/server.js', (content) => {
  // Update MCP version references like "frootai-mcp@X.Y.Z"
  content = content.replace(/frootai-mcp@\d+\.\d+\.\d+/g, `frootai-mcp@${mcpVersion}`);

  // Update extension version references like "v1.0.7" patterns
  // Be careful: only update version patterns that look like extension versions
  content = content.replace(/Extension v\d+\.\d+\.\d+/g, `Extension v${extVersion}`);
  content = content.replace(/extension v\d+\.\d+\.\d+/g, `extension v${extVersion}`);

  // Update tool count references
  content = content.replace(/\b\d+ tools\b/g, (match) => {
    const n = parseInt(match);
    return n > 10 ? `${toolCount} tools` : match;
  });

  return content;
}, 'Chatbot version refs');

// ─── 5. Sync MCP server README ───
console.log('\n📄 Syncing npm-mcp/README.md...');

updateFile('npm-mcp/README.md', (content) => {
  content = content.replace(/\b\d+ tools\b/g, (match) => {
    const n = parseInt(match);
    return n > 10 ? `${toolCount} tools` : match;
  });
  content = content.replace(/\b\d+ modules\b/g, (match) => {
    const n = parseInt(match);
    return n > 5 ? `${moduleCount} modules` : match;
  });
  content = content.replace(/\b\d+ solution plays\b/g, `${playCount} solution plays`);
  content = content.replace(/frootai-mcp@\d+\.\d+\.\d+/g, `frootai-mcp@${mcpVersion}`);
  return content;
}, 'MCP README counts + version');

// ─── 6. Sync website MCP page if it exists ───
const websiteMcpPage = 'website/docs/mcp-server.md';
if (existsSync(join(ROOT, websiteMcpPage))) {
  console.log('\n🌐 Syncing website MCP docs...');
  updateFile(websiteMcpPage, (content) => {
    content = content.replace(/\b\d+ tools\b/g, (match) => {
      const n = parseInt(match);
      return n > 10 ? `${toolCount} tools` : match;
    });
    content = content.replace(/frootai-mcp@\d+\.\d+\.\d+/g, `frootai-mcp@${mcpVersion}`);
    return content;
  }, 'Website MCP page');
}

// ─── Summary ───
console.log('\n' + '═'.repeat(50));
if (changes === 0) {
  console.log('✅ Everything is already in sync. No changes made.');
} else {
  console.log(`✏️  ${changes} file(s) updated.`);
  console.log('Run "node scripts/validate-consistency.js" to verify.');
}
