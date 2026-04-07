#!/usr/bin/env node
/**
 * FrootAI Primitive Validator
 * Validates all agents, instructions, skills, hooks, plugins, and FAI protocol files
 * against the JSON schemas in schemas/.
 *
 * Zero external dependencies — uses Node.js built-in fs/path only.
 * Validates structure, naming conventions, and required fields.
 *
 * Usage:
 *   node scripts/validate-primitives.js              # Validate everything
 *   node scripts/validate-primitives.js agents/      # Validate specific folder
 *   node scripts/validate-primitives.js --verbose     # Show passing checks too
 *
 * Exit codes: 0 = all pass, 1 = errors found
 */

const { readFileSync, existsSync, readdirSync, statSync } = require('fs');
const { join, resolve, basename, extname, relative } = require('path');

const ROOT = resolve(join(__dirname, '..'));
const VERBOSE = process.argv.includes('--verbose');
const TARGET = process.argv.find(a => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1]);

let errors = 0;
let warnings = 0;
let passed = 0;

// ─── Helpers ──────────────────────────────────────────

function read(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf8');
}

function readJSON(rel) {
  const content = read(rel);
  if (!content) return null;
  try { return JSON.parse(content); }
  catch { return null; }
}

function pass(label) {
  passed++;
  if (VERBOSE) console.log(`  ✅ ${label}`);
}

function fail(label, msg) {
  errors++;
  console.error(`  ❌ ${label}: ${msg}`);
}

function warn(label, msg) {
  warnings++;
  console.warn(`  ⚠️  ${label}: ${msg}`);
}

function section(title) {
  console.log(`\n${'─'.repeat(56)}`);
  console.log(`  ${title}`);
  console.log(`${'─'.repeat(56)}`);
}

function listDir(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return [];
  return readdirSync(p).filter(f => !f.startsWith('.'));
}

function isDir(rel) {
  const p = join(ROOT, rel);
  return existsSync(p) && statSync(p).isDirectory();
}

/**
 * Parse YAML frontmatter from a markdown file.
 * Simple parser — handles key: value, key: "value", key: 'value',
 * key: [array], and key: number. No external yaml library needed.
 */
function parseFrontmatter(content) {
  if (!content || !content.startsWith('---')) return null;
  const end = content.indexOf('---', 3);
  if (end === -1) return null;
  const yaml = content.substring(3, end).trim();
  const result = {};
  for (const line of yaml.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.substring(0, colonIdx).trim();
    let val = trimmed.substring(colonIdx + 1).trim();
    // Remove quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // Parse arrays: ['item1', 'item2'] or [item1, item2]
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    }
    result[key] = val;
  }
  return result;
}

const KEBAB_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const WAF_PILLARS = ['security', 'reliability', 'cost-optimization', 'operational-excellence', 'performance-efficiency', 'responsible-ai'];

// ─── Agent Validation ─────────────────────────────────

function validateAgents() {
  section('🤖 AGENTS');
  const files = listDir('agents').filter(f => f.endsWith('.agent.md'));
  if (files.length === 0) {
    pass('agents/ — no agent files yet (OK for empty folder)');
    return;
  }

  for (const file of files) {
    const content = read(`agents/${file}`);
    const fm = parseFrontmatter(content);
    const name = file.replace('.agent.md', '');

    // Naming convention
    if (KEBAB_RE.test(name)) pass(`${file} — kebab-case name`);
    else fail(file, `name "${name}" must be lowercase-hyphen (kebab-case)`);

    // Frontmatter exists
    if (!fm) { fail(file, 'missing YAML frontmatter (---)'); continue; }

    // Required: description
    if (fm.description && fm.description.length >= 10) pass(`${file} — description present (${fm.description.length} chars)`);
    else fail(file, 'description is required (min 10 chars)');

    // Optional: waf pillar validation
    if (fm.waf && Array.isArray(fm.waf)) {
      const invalid = fm.waf.filter(w => !WAF_PILLARS.includes(w));
      if (invalid.length > 0) fail(file, `invalid WAF pillars: ${invalid.join(', ')}`);
      else pass(`${file} — WAF pillars valid`);
    }

    // Check for companion fai-context.json
    const ctxPath = `agents/${name}/fai-context.json`;
    if (existsSync(join(ROOT, ctxPath))) {
      validateFaiContext(ctxPath, file);
    }
  }
}

// ─── Instruction Validation ───────────────────────────

function validateInstructions() {
  section('📝 INSTRUCTIONS');
  const files = listDir('instructions').filter(f => f.endsWith('.instructions.md'));
  if (files.length === 0) {
    pass('instructions/ — no instruction files yet (OK for empty folder)');
    return;
  }

  for (const file of files) {
    const content = read(`instructions/${file}`);
    const fm = parseFrontmatter(content);
    const name = file.replace('.instructions.md', '');

    // Naming convention
    if (KEBAB_RE.test(name)) pass(`${file} — kebab-case name`);
    else fail(file, `name "${name}" must be lowercase-hyphen`);

    if (!fm) { fail(file, 'missing YAML frontmatter (---)'); continue; }

    // Required: description
    if (fm.description && fm.description.length >= 10) pass(`${file} — description present`);
    else fail(file, 'description is required (min 10 chars)');

    // Required: applyTo
    if (fm.applyTo && fm.applyTo.length >= 1) pass(`${file} — applyTo: "${fm.applyTo}"`);
    else fail(file, 'applyTo glob pattern is required');
  }
}

// ─── Skill Validation ─────────────────────────────────

function validateSkills() {
  section('⚡ SKILLS');
  const folders = listDir('skills').filter(f => isDir(`skills/${f}`) && f !== 'README.md');
  if (folders.length === 0) {
    pass('skills/ — no skill folders yet (OK for empty folder)');
    return;
  }

  for (const folder of folders) {
    const skillPath = `skills/${folder}/SKILL.md`;

    // Naming convention
    if (KEBAB_RE.test(folder)) pass(`${folder}/ — kebab-case folder name`);
    else fail(folder, `folder name must be lowercase-hyphen`);

    // SKILL.md must exist
    if (!existsSync(join(ROOT, skillPath))) {
      fail(folder, 'missing SKILL.md');
      continue;
    }

    const content = read(skillPath);
    const fm = parseFrontmatter(content);
    if (!fm) { fail(`${folder}/SKILL.md`, 'missing YAML frontmatter (---)'); continue; }

    // Required: name must match folder
    if (fm.name === folder) pass(`${folder}/SKILL.md — name matches folder`);
    else fail(`${folder}/SKILL.md`, `name "${fm.name}" must match folder name "${folder}"`);

    // Required: description 10-1024 chars
    if (fm.description && fm.description.length >= 10 && fm.description.length <= 1024) {
      pass(`${folder}/SKILL.md — description (${fm.description.length} chars)`);
    } else {
      fail(`${folder}/SKILL.md`, `description must be 10-1024 chars (got ${fm.description ? fm.description.length : 0})`);
    }

    // Check bundled assets size
    const refsDir = `skills/${folder}/references`;
    if (isDir(refsDir)) {
      const refFiles = readdirSync(join(ROOT, refsDir));
      let totalSize = 0;
      for (const rf of refFiles) {
        totalSize += statSync(join(ROOT, refsDir, rf)).size;
      }
      const sizeMB = totalSize / (1024 * 1024);
      if (sizeMB <= 5) pass(`${folder}/references/ — ${sizeMB.toFixed(1)} MB (under 5 MB limit)`);
      else fail(`${folder}/references/`, `bundled assets ${sizeMB.toFixed(1)} MB exceeds 5 MB limit`);
    }

    // Check for fai-context.json
    const ctxPath = `skills/${folder}/fai-context.json`;
    if (existsSync(join(ROOT, ctxPath))) {
      validateFaiContext(ctxPath, `${folder}/SKILL.md`);
    }
  }
}

// ─── Hook Validation ──────────────────────────────────

function validateHooks() {
  section('🔒 HOOKS');
  const folders = listDir('hooks').filter(f => isDir(`hooks/${f}`));
  if (folders.length === 0) {
    pass('hooks/ — no hook folders yet (OK for empty folder)');
    return;
  }

  const VALID_EVENTS = ['sessionStart', 'sessionEnd', 'userPromptSubmitted', 'preToolUse'];

  for (const folder of folders) {
    // Naming convention
    if (KEBAB_RE.test(folder)) pass(`${folder}/ — kebab-case folder name`);
    else fail(folder, `folder name must be lowercase-hyphen`);

    // hooks.json must exist
    const hooksJsonPath = `hooks/${folder}/hooks.json`;
    if (!existsSync(join(ROOT, hooksJsonPath))) {
      fail(folder, 'missing hooks.json');
      continue;
    }

    const hooksJson = readJSON(hooksJsonPath);
    if (!hooksJson) { fail(`${folder}/hooks.json`, 'invalid JSON'); continue; }

    // version must be 1
    if (hooksJson.version === 1) pass(`${folder}/hooks.json — version: 1`);
    else fail(`${folder}/hooks.json`, `version must be 1 (got ${hooksJson.version})`);

    // hooks object must have at least one valid event
    if (!hooksJson.hooks || typeof hooksJson.hooks !== 'object') {
      fail(`${folder}/hooks.json`, 'missing "hooks" object');
      continue;
    }

    const events = Object.keys(hooksJson.hooks);
    if (events.length === 0) {
      fail(`${folder}/hooks.json`, 'hooks object must have at least one event');
      continue;
    }

    for (const event of events) {
      if (!VALID_EVENTS.includes(event)) {
        fail(`${folder}/hooks.json`, `invalid event "${event}" — must be one of: ${VALID_EVENTS.join(', ')}`);
        continue;
      }
      pass(`${folder}/hooks.json — event: ${event}`);

      const commands = hooksJson.hooks[event];
      if (!Array.isArray(commands) || commands.length === 0) {
        fail(`${folder}/hooks.json`, `event "${event}" must have at least one command`);
        continue;
      }

      for (const cmd of commands) {
        if (cmd.type !== 'command') {
          fail(`${folder}/hooks.json`, `command type must be "command" (got "${cmd.type}")`);
        }
        if (!cmd.bash || cmd.bash.length === 0) {
          fail(`${folder}/hooks.json`, `command missing "bash" script path`);
        } else {
          // Verify the bash script exists
          const scriptPath = `hooks/${folder}/${cmd.bash}`;
          if (existsSync(join(ROOT, scriptPath))) {
            pass(`${folder}/${cmd.bash} — script exists`);
          } else {
            fail(`${folder}/hooks.json`, `script "${cmd.bash}" not found at ${scriptPath}`);
          }
        }
        if (cmd.timeoutSec !== undefined) {
          if (cmd.timeoutSec < 1 || cmd.timeoutSec > 120) {
            fail(`${folder}/hooks.json`, `timeoutSec must be 1-120 (got ${cmd.timeoutSec})`);
          }
        }
      }
    }

    // README.md should exist
    if (existsSync(join(ROOT, `hooks/${folder}/README.md`))) {
      pass(`${folder}/README.md — present`);
    } else {
      warn(folder, 'missing README.md (recommended)');
    }
  }
}

// ─── Plugin Validation ────────────────────────────────

function validatePlugins() {
  section('📦 PLUGINS');
  const pluginsDir = 'plugins';
  if (!isDir(pluginsDir)) {
    pass('plugins/ — folder not yet created (OK)');
    return;
  }

  const folders = listDir(pluginsDir).filter(f => isDir(`${pluginsDir}/${f}`));
  if (folders.length === 0) {
    pass('plugins/ — no plugin folders yet (OK for empty folder)');
    return;
  }

  for (const folder of folders) {
    if (KEBAB_RE.test(folder)) pass(`${folder}/ — kebab-case name`);
    else fail(folder, 'folder name must be lowercase-hyphen');

    // Find plugin.json (may be at root or .github/plugin/)
    let pluginJsonPath = `${pluginsDir}/${folder}/plugin.json`;
    if (!existsSync(join(ROOT, pluginJsonPath))) {
      pluginJsonPath = `${pluginsDir}/${folder}/.github/plugin/plugin.json`;
    }
    if (!existsSync(join(ROOT, pluginJsonPath))) {
      fail(folder, 'missing plugin.json');
      continue;
    }

    const pj = readJSON(pluginJsonPath);
    if (!pj) { fail(`${folder}/plugin.json`, 'invalid JSON'); continue; }

    // Required fields
    for (const field of ['name', 'description', 'version', 'author', 'license']) {
      if (pj[field]) pass(`${folder}/plugin.json — ${field} present`);
      else fail(`${folder}/plugin.json`, `missing required field "${field}"`);
    }

    // Name must match folder
    if (pj.name && pj.name !== folder) {
      fail(`${folder}/plugin.json`, `name "${pj.name}" must match folder "${folder}"`);
    }

    // Semver pattern
    if (pj.version && /^[0-9]+\.[0-9]+\.[0-9]+/.test(pj.version)) {
      pass(`${folder}/plugin.json — version ${pj.version}`);
    } else if (pj.version) {
      fail(`${folder}/plugin.json`, `version "${pj.version}" must be semver`);
    }

    // Author must have name
    if (pj.author && pj.author.name) pass(`${folder}/plugin.json — author: ${pj.author.name}`);
    else if (pj.author) fail(`${folder}/plugin.json`, 'author must have "name"');
  }
}

// ─── FAI Manifest Validation ──────────────────────────

function validateFaiManifests() {
  section('🔗 FAI MANIFESTS');

  // Search for fai-manifest.json in solution-plays/
  const plays = listDir('solution-plays').filter(f => isDir(`solution-plays/${f}`));
  let found = 0;

  for (const play of plays) {
    const manifestPath = `solution-plays/${play}/fai-manifest.json`;
    if (!existsSync(join(ROOT, manifestPath))) continue;
    found++;

    const manifest = readJSON(manifestPath);
    if (!manifest) { fail(manifestPath, 'invalid JSON'); continue; }

    // Required: play
    if (manifest.play && /^[0-9]{2,3}-[a-z0-9-]+$/.test(manifest.play)) {
      pass(`${manifestPath} — play: ${manifest.play}`);
    } else {
      fail(manifestPath, `play must match pattern "NN-kebab-case" (got "${manifest.play}")`);
    }

    // Required: version
    if (manifest.version && /^[0-9]+\.[0-9]+\.[0-9]+/.test(manifest.version)) {
      pass(`${manifestPath} — version: ${manifest.version}`);
    } else {
      fail(manifestPath, 'missing or invalid version (semver required)');
    }

    // Required: context
    if (manifest.context) {
      if (manifest.context.knowledge && manifest.context.knowledge.length > 0) {
        pass(`${manifestPath} — context.knowledge: ${manifest.context.knowledge.length} modules`);
      } else {
        fail(manifestPath, 'context.knowledge must have at least one module');
      }
      if (manifest.context.waf && manifest.context.waf.length > 0) {
        const invalid = manifest.context.waf.filter(w => !WAF_PILLARS.includes(w));
        if (invalid.length > 0) fail(manifestPath, `invalid WAF pillars: ${invalid.join(', ')}`);
        else pass(`${manifestPath} — context.waf: ${manifest.context.waf.join(', ')}`);
      } else {
        fail(manifestPath, 'context.waf must have at least one pillar');
      }
    } else {
      fail(manifestPath, 'missing context object');
    }

    // Required: primitives
    if (manifest.primitives) {
      pass(`${manifestPath} — primitives object present`);
      // Validate guardrails if present
      if (manifest.primitives.guardrails) {
        const g = manifest.primitives.guardrails;
        if (g.groundedness !== undefined && (g.groundedness < 0 || g.groundedness > 1)) {
          fail(manifestPath, `guardrails.groundedness must be 0-1 (got ${g.groundedness})`);
        }
        if (g.safety !== undefined && g.safety !== 0) {
          fail(manifestPath, `guardrails.safety must be 0 for production (got ${g.safety})`);
        }
      }
    } else {
      fail(manifestPath, 'missing primitives object');
    }
  }

  if (found === 0) pass('No fai-manifest.json files found yet (OK — created in K3)');
  else console.log(`  📊 Found ${found} manifest(s) in solution-plays/`);
}

// ─── FAI Context Validation ───────────────────────────

function validateFaiContext(relPath, parentLabel) {
  const ctx = readJSON(relPath);
  if (!ctx) { fail(`${relPath}`, 'invalid JSON'); return; }

  // Validate WAF pillars if present
  if (ctx.waf && Array.isArray(ctx.waf)) {
    const invalid = ctx.waf.filter(w => !WAF_PILLARS.includes(w));
    if (invalid.length > 0) fail(relPath, `invalid WAF pillars: ${invalid.join(', ')}`);
    else pass(`${relPath} — WAF pillars valid`);
  }

  // Validate compatiblePlays pattern
  if (ctx.compatiblePlays && Array.isArray(ctx.compatiblePlays)) {
    for (const p of ctx.compatiblePlays) {
      if (!/^[0-9]{2,3}(-[a-z0-9-]+)?$/.test(p)) {
        fail(relPath, `invalid play ID "${p}" — must be "NN" or "NN-kebab-case"`);
      }
    }
    pass(`${relPath} — ${ctx.compatiblePlays.length} compatible plays`);
  }

  // Validate evaluation thresholds
  if (ctx.evaluation) {
    for (const [key, val] of Object.entries(ctx.evaluation)) {
      if (typeof val === 'number' && key !== 'costPerQuery' && (val < 0 || val > 1)) {
        fail(relPath, `evaluation.${key} must be 0-1 (got ${val})`);
      }
    }
  }
}

// ─── Standalone FAI Context Files ─────────────────────

function findStandaloneFaiContexts() {
  section('🌐 FAI CONTEXT FILES');
  let found = 0;

  for (const dir of ['agents', 'skills']) {
    const items = listDir(dir).filter(f => isDir(`${dir}/${f}`));
    for (const item of items) {
      const ctxPath = `${dir}/${item}/fai-context.json`;
      if (existsSync(join(ROOT, ctxPath))) {
        found++;
        validateFaiContext(ctxPath, `${dir}/${item}`);
      }
    }
  }

  if (found === 0) pass('No standalone fai-context.json files yet (OK — created in K3)');
  else console.log(`  📊 Found ${found} context file(s)`);
}

// ─── Workflows Validation ─────────────────────────────

function validateWorkflows() {
  section('⚙️  WORKFLOWS');
  const files = listDir('workflows').filter(f => f.endsWith('.md') && f !== 'README.md');
  if (files.length === 0) {
    pass('workflows/ — no workflow files yet (OK for empty folder)');
    return;
  }

  for (const file of files) {
    const content = read(`workflows/${file}`);
    const fm = parseFrontmatter(content);
    const name = file.replace('.md', '');

    if (KEBAB_RE.test(name)) pass(`${file} — kebab-case name`);
    else fail(file, `name must be lowercase-hyphen`);

    if (!fm) { fail(file, 'missing YAML frontmatter (---)'); continue; }

    if (fm.name) pass(`${file} — name: "${fm.name}"`);
    else fail(file, 'frontmatter must have "name"');

    if (fm.description) pass(`${file} — description present`);
    else fail(file, 'frontmatter must have "description"');
  }
}

// ─── Main ─────────────────────────────────────────────

console.log('🍊 FrootAI Primitive Validator');
console.log(`   Root: ${ROOT}`);
if (TARGET) console.log(`   Target: ${TARGET}`);
console.log('');

const shouldRun = (name) => !TARGET || TARGET.startsWith(name) || TARGET === name + '/';

if (shouldRun('agents'))       validateAgents();
if (shouldRun('instructions')) validateInstructions();
if (shouldRun('skills'))       validateSkills();
if (shouldRun('hooks'))        validateHooks();
if (shouldRun('plugins'))      validatePlugins();
if (shouldRun('workflows'))    validateWorkflows();
if (!TARGET) {
  validateFaiManifests();
  findStandaloneFaiContexts();
}

// ─── Summary ──────────────────────────────────────────

section('📊 VALIDATION SUMMARY');
console.log(`  ✅ Passed:   ${passed}`);
if (warnings > 0) console.log(`  ⚠️  Warnings: ${warnings}`);
if (errors > 0) {
  console.log(`  ❌ Errors:   ${errors}`);
  console.log(`\n  VALIDATION FAILED — fix ${errors} error(s) above.`);
  process.exit(1);
} else {
  console.log(`\n  ALL CHECKS PASSED ✅`);
  process.exit(0);
}
