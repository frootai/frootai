#!/usr/bin/env node
/**
 * FrootAI Primitive Scaffolder
 * Interactive CLI to generate new agents, skills, instructions, or hooks.
 *
 * Usage:
 *   node scripts/scaffold-primitive.js agent
 *   node scripts/scaffold-primitive.js skill
 *   node scripts/scaffold-primitive.js instruction
 *   node scripts/scaffold-primitive.js hook
 *
 * Creates properly-structured files following FrootAI naming conventions
 * and schema requirements. No external dependencies.
 */

const { mkdirSync, writeFileSync, existsSync } = require('fs');
const { join, resolve } = require('path');
const readline = require('readline');

const ROOT = resolve(join(__dirname, '..'));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function kebabCase(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const WAF_PILLARS = [
  'security', 'reliability', 'cost-optimization',
  'operational-excellence', 'performance-efficiency', 'responsible-ai'
];

async function scaffoldAgent() {
  console.log('\n🤖 Create a new FrootAI Agent\n');

  const rawName = await ask('Agent name (kebab-case, e.g. frootai-cost-optimizer): ');
  const name = kebabCase(rawName);
  const description = await ask('Description (10+ chars): ');
  const wafInput = await ask(`WAF pillars (comma-separated, from: ${WAF_PILLARS.join(', ')}): `);
  const waf = wafInput.split(',').map(s => s.trim()).filter(s => WAF_PILLARS.includes(s));

  const filePath = join(ROOT, 'agents', `${name}.agent.md`);
  if (existsSync(filePath)) {
    console.error(`❌ Agent already exists: ${filePath}`);
    process.exit(1);
  }

  const wafYaml = waf.length > 0 ? `\nwaf:\n${waf.map(w => `  - "${w}"`).join('\n')}` : '';

  const content = `---
description: "${description}"
name: "${name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}"${wafYaml}
---

# ${name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}

You are a FrootAI specialist agent. Define your expertise below.

## Core Expertise

- TODO: List key knowledge areas

## Architecture Principles

1. TODO: Define guiding principles

## WAF Guardrails Applied

| Pillar | What You Enforce |
|--------|-----------------|
${waf.map(w => `| **${w.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')}** | TODO |`).join('\n')}

## Response Format

TODO: Define how this agent structures its responses.
`;

  writeFileSync(filePath, content);
  console.log(`\n✅ Created: agents/${name}.agent.md`);

  // Create companion fai-context.json
  const ctxDir = join(ROOT, 'agents', name);
  mkdirSync(ctxDir, { recursive: true });
  const ctxPath = join(ctxDir, 'fai-context.json');
  writeFileSync(ctxPath, JSON.stringify({
    assumes: [],
    waf,
    compatiblePlays: [],
    evaluation: { groundedness: 0.95, coherence: 0.90 }
  }, null, 2) + '\n');
  console.log(`✅ Created: agents/${name}/fai-context.json`);
}

async function scaffoldSkill() {
  console.log('\n⚡ Create a new FrootAI Skill\n');

  const rawName = await ask('Skill name (kebab-case, e.g. frootai-eval-runner): ');
  const name = kebabCase(rawName);
  const description = await ask('Description (10-1024 chars): ');

  const skillDir = join(ROOT, 'skills', name);
  if (existsSync(skillDir)) {
    console.error(`❌ Skill already exists: ${skillDir}`);
    process.exit(1);
  }

  mkdirSync(skillDir, { recursive: true });

  const content = `---
name: ${name}
description: '${description}'
---

# ${name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}

TODO: Describe what this skill does and how to invoke it.

## Steps

1. TODO: First step
2. TODO: Second step
3. TODO: Verification

## Notes

- Created by FrootAI scaffolder on ${new Date().toISOString().split('T')[0]}
`;

  writeFileSync(join(skillDir, 'SKILL.md'), content);
  console.log(`\n✅ Created: skills/${name}/SKILL.md`);
}

async function scaffoldInstruction() {
  console.log('\n📝 Create a new FrootAI Instruction\n');

  const rawName = await ask('Instruction name (kebab-case, e.g. typescript-waf): ');
  const name = kebabCase(rawName);
  const description = await ask('Description (10+ chars): ');
  const applyTo = await ask('applyTo glob (e.g. **/*.ts, **/*.tsx): ');
  const wafInput = await ask(`WAF pillars (comma-separated): `);
  const waf = wafInput.split(',').map(s => s.trim()).filter(s => WAF_PILLARS.includes(s));

  const filePath = join(ROOT, 'instructions', `${name}.instructions.md`);
  if (existsSync(filePath)) {
    console.error(`❌ Instruction already exists: ${filePath}`);
    process.exit(1);
  }

  const wafYaml = waf.length > 0 ? `\nwaf:\n${waf.map(w => `  - "${w}"`).join('\n')}` : '';

  const content = `---
description: "${description}"
applyTo: "${applyTo}"${wafYaml}
---

# ${name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} — FrootAI WAF-Aligned Standards

When writing or reviewing code matching \`${applyTo}\`, enforce these standards.

## Security (WAF: Security Pillar)

- TODO: Security rules

## Reliability (WAF: Reliability Pillar)

- TODO: Reliability rules

## Code Quality

- TODO: Quality rules
`;

  writeFileSync(filePath, content);
  console.log(`\n✅ Created: instructions/${name}.instructions.md`);
}

async function scaffoldHook() {
  console.log('\n🔒 Create a new FrootAI Hook\n');

  const rawName = await ask('Hook name (kebab-case, e.g. frootai-license-checker): ');
  const name = kebabCase(rawName);
  const eventInput = await ask('Events (comma-separated: sessionStart, sessionEnd, userPromptSubmitted, preToolUse): ');
  const events = eventInput.split(',').map(s => s.trim()).filter(Boolean);
  const scriptName = await ask('Script filename (e.g. check-licenses.sh): ');

  const hookDir = join(ROOT, 'hooks', name);
  if (existsSync(hookDir)) {
    console.error(`❌ Hook already exists: ${hookDir}`);
    process.exit(1);
  }

  mkdirSync(hookDir, { recursive: true });

  // hooks.json
  const hooks = {};
  for (const event of events) {
    hooks[event] = [{
      type: 'command',
      bash: scriptName,
      cwd: '.',
      env: { MODE: 'warn' },
      timeoutSec: 30
    }];
  }
  writeFileSync(join(hookDir, 'hooks.json'), JSON.stringify({ version: 1, hooks }, null, 2) + '\n');
  console.log(`✅ Created: hooks/${name}/hooks.json`);

  // Script stub
  const script = `#!/usr/bin/env bash
# FrootAI Hook: ${name}
# Events: ${events.join(', ')}
set -euo pipefail

MODE="\${MODE:-warn}"

echo "🔒 FrootAI ${name} — running..."

# TODO: Implement hook logic

echo "✅ ${name} complete."
exit 0
`;
  writeFileSync(join(hookDir, scriptName), script);
  console.log(`✅ Created: hooks/${name}/${scriptName}`);

  // README
  const readme = `# ${name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}\n\n> TODO: Describe this hook.\n\n## Events\n\n${events.map(e => `- \`${e}\``).join('\n')}\n`;
  writeFileSync(join(hookDir, 'README.md'), readme);
  console.log(`✅ Created: hooks/${name}/README.md`);
}

// ─── Main ─────────────────────────────────────────────
const type = process.argv[2];

if (!type || !['agent', 'skill', 'instruction', 'hook'].includes(type)) {
  console.log('🍊 FrootAI Primitive Scaffolder');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/scaffold-primitive.js agent');
  console.log('  node scripts/scaffold-primitive.js skill');
  console.log('  node scripts/scaffold-primitive.js instruction');
  console.log('  node scripts/scaffold-primitive.js hook');
  process.exit(0);
}

(async () => {
  try {
    switch (type) {
      case 'agent': await scaffoldAgent(); break;
      case 'skill': await scaffoldSkill(); break;
      case 'instruction': await scaffoldInstruction(); break;
      case 'hook': await scaffoldHook(); break;
    }
    console.log('\n🎯 Run: node scripts/validate-primitives.js — to verify');

    // Auto-rebuild factory catalog
    console.log('\n🏭 Rebuilding FAI Factory catalog...');
    try {
      const { harvest } = require('./factory/harvest');
      const { catalog } = require('./factory/catalog');
      const origLog = console.log;
      const origErr = console.error;
      console.log = () => {};
      console.error = () => {};
      harvest();
      catalog();
      console.log = origLog;
      console.error = origErr;
      const catPath = join(ROOT, '.factory', 'fai-catalog.json');
      if (existsSync(catPath)) {
        const cat = JSON.parse(require('fs').readFileSync(catPath, 'utf8'));
        console.log(`   ✅ Catalog updated: ${cat.stats.totalPrimitives} primitives`);
      }
    } catch {
      console.log('   ⚠️  Factory rebuild skipped (run: npm run factory)');
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    rl.close();
  }
})();
