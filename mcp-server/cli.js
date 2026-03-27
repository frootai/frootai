#!/usr/bin/env node
/**
 * FrootAI CLI — `npx frootai <command>`
 *
 * Commands:
 *   init                Interactive project scaffolding
 *   search <query>      Search FrootAI knowledge base
 *   cost <play>         Estimate costs for a solution play
 *   validate            Run consistency + config checks
 *   doctor              Health check for your FrootAI setup
 *   version             Show version info
 *
 * Usage:
 *   npx frootai init
 *   npx frootai search "RAG architecture"
 *   npx frootai doctor
 */

import { createInterface } from 'readline';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const VERSION = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8')).version;
const KNOWLEDGE = JSON.parse(readFileSync(join(__dirname, 'knowledge.json'), 'utf8'));

const args = process.argv.slice(2);
const command = args[0];

// ─── Colors ───
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function banner() {
  console.log(`
${c.green}  🌳 FrootAI™ CLI v${VERSION}${c.reset}
${c.dim}  From the Roots to the Fruits${c.reset}
`);
}

// ─── Command Router ───
switch (command) {
  case 'init':
    await cmdInit();
    break;
  case 'search':
    cmdSearch(args.slice(1).join(' '));
    break;
  case 'cost':
    cmdCost(args[1], args.includes('--scale') ? args[args.indexOf('--scale') + 1] : 'dev');
    break;
  case 'validate':
    cmdValidate();
    break;
  case 'doctor':
    cmdDoctor();
    break;
  case 'version':
  case '--version':
  case '-v':
    console.log(`frootai-mcp v${VERSION}`);
    break;
  case 'help':
  case '--help':
  case '-h':
  case undefined:
    cmdHelp();
    break;
  default:
    console.log(`${c.red}Unknown command: ${command}${c.reset}`);
    cmdHelp();
    process.exit(1);
}

// ═══════════════════════════════════════════════════
// INIT — Interactive project scaffolding
// ═══════════════════════════════════════════════════
async function cmdInit() {
  banner();
  console.log(`${c.cyan}  Let's set up your FrootAI-powered project!${c.reset}\n`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(r => rl.question(q, r));

  // Question 1: Scenario
  console.log(`${c.bold}  What are you building?${c.reset}`);
  console.log(`${c.dim}  1) Enterprise RAG (document Q&A, knowledge base)`);
  console.log(`  2) AI Agent (multi-step reasoning, tool calling)`);
  console.log(`  3) AI Gateway (API management, cost control)`);
  console.log(`  4) Content Moderation (safety, compliance)`);
  console.log(`  5) Multi-modal (vision, document intelligence)`);
  console.log(`  6) Custom (pick from 20 solution plays)${c.reset}\n`);
  const scenario = await ask(`${c.green}  Choose [1-6]: ${c.reset}`);

  const playMap = {
    '1': '01-enterprise-rag',
    '2': '03-deterministic-agent',
    '3': '14-cost-optimized-ai-gateway',
    '4': '10-content-moderation',
    '5': '15-multi-modal-docproc',
  };

  let playId = playMap[scenario];

  if (scenario === '6') {
    console.log(`\n${c.bold}  Available plays:${c.reset}`);
    const plays = [
      '01-enterprise-rag', '02-ai-landing-zone', '03-deterministic-agent',
      '04-call-center-voice-ai', '05-it-ticket-resolution', '06-document-intelligence',
      '07-multi-agent-service', '08-copilot-studio-bot', '09-ai-search-portal',
      '10-content-moderation', '11-ai-landing-zone-advanced', '12-model-serving-aks',
      '13-fine-tuning-workflow', '14-cost-optimized-ai-gateway', '15-multi-modal-docproc',
      '16-copilot-teams-extension', '17-ai-observability', '18-prompt-management',
      '19-edge-ai-phi4', '20-anomaly-detection',
    ];
    plays.forEach((p, i) => console.log(`${c.dim}  ${String(i + 1).padStart(2)}) ${p}${c.reset}`));
    const idx = await ask(`\n${c.green}  Choose [1-${plays.length}]: ${c.reset}`);
    playId = plays[parseInt(idx) - 1] || plays[0];
  }

  // Question 2: Scale
  console.log(`\n${c.bold}  Target scale?${c.reset}`);
  console.log(`${c.dim}  1) dev   — Local development, minimal cost`);
  console.log(`  2) prod  — Production, high availability${c.reset}\n`);
  const scaleChoice = await ask(`${c.green}  Choose [1-2]: ${c.reset}`);
  const scale = scaleChoice === '2' ? 'prod' : 'dev';

  // Question 3: Project name
  const projectName = await ask(`\n${c.green}  Project name [my-ai-project]: ${c.reset}`) || 'my-ai-project';

  rl.close();

  // ─── Scaffold ───
  console.log(`\n${c.cyan}  Scaffolding ${projectName} with play ${playId} (${scale})...${c.reset}\n`);

  const projectDir = resolve(projectName);

  if (existsSync(projectDir)) {
    console.log(`${c.yellow}  ⚠️  Directory ${projectName} already exists. Merging files...${c.reset}`);
  } else {
    mkdirSync(projectDir, { recursive: true });
  }

  // Create directory structure
  const dirs = [
    '.vscode',
    '.github/agents',
    '.github/instructions',
    '.github/prompts',
    'config',
    'evaluation',
    'infra',
  ];
  for (const d of dirs) {
    mkdirSync(join(projectDir, d), { recursive: true });
  }

  // .vscode/mcp.json — MCP server config
  writeIfNotExists(join(projectDir, '.vscode/mcp.json'), JSON.stringify({
    servers: {
      frootai: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', `frootai-mcp@${VERSION}`],
      },
    },
  }, null, 2));

  // Agent files
  writeIfNotExists(join(projectDir, '.github/agents/builder.agent.md'), `---
description: "Builder agent — implements features following FrootAI architecture patterns"
tools:
  - frootai
---
# Builder Agent

You are a builder agent for a ${playId} solution.
Use the FrootAI MCP server for architecture patterns, cost estimates, and best practices.
Follow the config/ values and architecture patterns from the play.
`);

  writeIfNotExists(join(projectDir, '.github/agents/reviewer.agent.md'), `---
description: "Reviewer agent — reviews code for security, quality, Azure best practices"
tools:
  - frootai
---
# Reviewer Agent

Review all code changes against:
- Security (OWASP Top 10)
- Azure best practices (Well-Architected Framework)
- Config compliance (config/*.json)
- RAG quality (if applicable)
`);

  writeIfNotExists(join(projectDir, '.github/agents/tuner.agent.md'), `---
description: "Tuner agent — validates configs, runs evaluations, ensures production readiness"
tools:
  - frootai
---
# Tuner Agent

Validate:
- config/*.json values are production-appropriate
- Evaluation thresholds are met
- Cost estimates are within budget
`);

  // Copilot instructions
  writeIfNotExists(join(projectDir, '.github/copilot-instructions.md'), `# ${projectName}

Solution Play: ${playId}
Scale: ${scale}

## Agent Workflow
1. **Build**: Implement using config/ values and FrootAI MCP architecture patterns
2. **Review**: Self-review against reviewer.agent.md checklist
3. **Tune**: Verify configs are production-appropriate

For agent handoffs, use @builder, @reviewer, or @tuner in Copilot Chat.
`);

  // Config files
  writeIfNotExists(join(projectDir, 'config/openai.json'), JSON.stringify({
    model: scale === 'prod' ? 'gpt-4o' : 'gpt-4o-mini',
    temperature: 0.1,
    max_tokens: 4096,
    api_version: '2025-01-01-preview',
  }, null, 2));

  writeIfNotExists(join(projectDir, 'config/search.json'), JSON.stringify({
    service: 'azure-ai-search',
    index: `${projectName}-index`,
    semantic_config: 'default',
    top_k: 5,
    min_score: 0.75,
  }, null, 2));

  writeIfNotExists(join(projectDir, 'config/guardrails.json'), JSON.stringify({
    max_tokens_per_request: 4096,
    blocked_categories: ['hate', 'violence', 'self-harm', 'sexual'],
    pii_detection: true,
    grounding_check: true,
  }, null, 2));

  // Evaluation template
  writeIfNotExists(join(projectDir, 'evaluation/eval-config.json'), JSON.stringify({
    metrics: ['groundedness', 'relevance', 'coherence', 'fluency'],
    thresholds: {
      groundedness: 4.0,
      relevance: 4.0,
      coherence: 4.0,
      fluency: 4.0,
    },
    dataset: 'evaluation/test-data.jsonl',
  }, null, 2));

  // README
  writeIfNotExists(join(projectDir, 'README.md'), `# ${projectName}

> Built with [FrootAI](https://frootai.dev) — Solution Play: \`${playId}\`

## Quick Start

\`\`\`bash
# Open in VS Code (MCP server auto-connects)
code .

# Or use the MCP server directly
npx frootai-mcp@${VERSION}
\`\`\`

## Architecture

Scale: **${scale}**

See \`config/\` for all configuration values.
See \`.github/agents/\` for Copilot agent definitions.

## FrootAI Commands

- Use \`@builder\` in Copilot Chat to implement features
- Use \`@reviewer\` to review code
- Use \`@tuner\` to validate configs and run evaluations

## Links

- [FrootAI Docs](https://frootai.dev)
- [MCP Server](https://www.npmjs.com/package/frootai-mcp)
- [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=pavleenbali.frootai)
`);

  // .gitignore
  writeIfNotExists(join(projectDir, '.gitignore'), `node_modules/
.env
.env.local
*.log
dist/
build/
.DS_Store
`);

  // Spec file (if --spec flag or always include as template)
  const specTemplate = {
    name: projectName,
    version: '0.1.0',
    play: playId,
    description: `${projectName} — built with FrootAI Solution Play ${playId}`,
    scale,
    architecture: {
      pattern: playId.includes('rag') ? 'rag' : playId.includes('agent') ? 'agent' : 'custom',
      data_flow: 'User → API → AI Search → OpenAI → Response',
    },
    config: { openai: `config/openai.json`, search: `config/search.json`, guardrails: `config/guardrails.json` },
    evaluation: { config: `evaluation/eval-config.json` },
    waf_alignment: {
      reliability: 'Retry + circuit breaker on all AI calls',
      security: 'Managed Identity + Key Vault + Content Safety',
      cost_optimization: scale === 'prod' ? 'Model routing (GPT-4o + GPT-4o-mini)' : 'GPT-4o-mini for dev',
      operational_excellence: 'CI/CD + consistency validation',
      performance_efficiency: 'Response caching + streaming',
      responsible_ai: 'Content safety filters + groundedness checks',
    },
  };
  mkdirSync(join(projectDir, 'spec'), { recursive: true });
  writeIfNotExists(join(projectDir, 'spec/project-spec.json'), JSON.stringify(specTemplate, null, 2));

  // WAF instruction stubs
  mkdirSync(join(projectDir, '.github/instructions'), { recursive: true });
  writeIfNotExists(join(projectDir, '.github/instructions/waf-security.instructions.md'),
    `---\napplyTo: "**/*.{ts,js,py,bicep,json}"\n---\n# Security\n\n- Use Managed Identity for all Azure service auth\n- Store secrets in Azure Key Vault\n- Enable content safety on all AI endpoints\n- Validate and sanitize all user inputs\n`);
  writeIfNotExists(join(projectDir, '.github/instructions/waf-reliability.instructions.md'),
    `---\napplyTo: "**/*.{ts,js,py,bicep,json}"\n---\n# Reliability\n\n- Retry all external API calls (3 retries, exponential backoff)\n- Expose /health endpoint on every service\n- Gracefully degrade when AI endpoints are unavailable\n`);

  console.log(`${c.green}  ✅ Project scaffolded!${c.reset}\n`);
  console.log(`${c.bold}  Created:${c.reset}`);
  console.log(`${c.dim}  ${projectName}/`);
  console.log(`  ├── .vscode/mcp.json          ← MCP server config (auto-connects)`);
  console.log(`  ├── .github/agents/           ← Builder, Reviewer, Tuner agents`);
  console.log(`  ├── .github/instructions/     ← WAF security + reliability`);
  console.log(`  ├── .github/copilot-instructions.md`);
  console.log(`  ├── config/                   ← OpenAI, Search, Guardrails configs`);
  console.log(`  ├── evaluation/               ← Eval config + thresholds`);
  console.log(`  ├── spec/project-spec.json    ← Architecture spec (SpecKit)`);
  console.log(`  ├── infra/                    ← Infrastructure templates`);
  console.log(`  └── README.md${c.reset}\n`);

  console.log(`${c.cyan}  Next steps:${c.reset}`);
  console.log(`  ${c.green}cd ${projectName}${c.reset}`);
  console.log(`  ${c.green}code .${c.reset}              ← FrootAI MCP auto-connects`);
  console.log(`  ${c.green}@builder ${c.dim}in Copilot Chat to start building${c.reset}\n`);
}

// ═══════════════════════════════════════════════════
// SEARCH — Knowledge base lookup
// ═══════════════════════════════════════════════════
function cmdSearch(query) {
  if (!query) {
    console.log(`${c.red}Usage: frootai search <query>${c.reset}`);
    console.log(`${c.dim}Example: frootai search "RAG architecture"${c.reset}`);
    process.exit(1);
  }

  banner();
  console.log(`${c.cyan}  Searching: "${query}"${c.reset}\n`);

  const results = [];
  const queryLower = query.toLowerCase();

  // Search across modules
  for (const [id, mod] of Object.entries(KNOWLEDGE.modules || {})) {
    const text = JSON.stringify(mod).toLowerCase();
    if (text.includes(queryLower)) {
      const title = mod.title || mod.name || id;
      const layer = KNOWLEDGE.layers?.[id[0]];
      const layerName = typeof layer === 'object' ? (layer.name || layer.title || id[0]) : (layer || '');
      results.push({ id, title, layer: layerName, type: 'module' });
    }
  }

  if (results.length === 0) {
    console.log(`${c.yellow}  No results found for "${query}"${c.reset}`);
    console.log(`${c.dim}  Try: "RAG", "agents", "cost optimization", "prompt engineering"${c.reset}`);
    return;
  }

  console.log(`${c.green}  Found ${results.length} result(s):${c.reset}\n`);
  for (const r of results) {
    const icon = r.type === 'module' ? '📖' : '🎯';
    console.log(`  ${icon} ${c.bold}${r.id}${c.reset} — ${r.title}`);
    if (r.layer) console.log(`     ${c.dim}Layer: ${r.layer}${c.reset}`);
  }
  console.log('');
}

// ═══════════════════════════════════════════════════
// COST — Estimate costs
// ═══════════════════════════════════════════════════
function cmdCost(play, scale) {
  banner();

  // Basic cost estimates by scenario
  const costs = {
    dev: {
      'AI Search': '$0/mo (free tier)',
      'OpenAI (GPT-4o-mini)': '~$5/mo (light usage)',
      'App Service': '$0/mo (free tier)',
      'Storage': '$0.02/GB/mo',
      'Total estimate': '~$5-15/mo',
    },
    prod: {
      'AI Search': '$250/mo (S1)',
      'OpenAI (GPT-4o)': '~$150/mo (moderate)',
      'App Service': '$55/mo (B1)',
      'Storage': '$0.02/GB/mo',
      'Cosmos DB': '$25/mo (400 RU/s)',
      'Total estimate': '~$500-800/mo',
    },
  };

  const tier = costs[scale] || costs.dev;
  console.log(`${c.cyan}  Cost Estimate: ${play || 'general'} (${scale})${c.reset}\n`);
  console.log(`  ${'Service'.padEnd(30)} | Cost`);
  console.log(`  ${'─'.repeat(30)}─┼${'─'.repeat(25)}`);
  for (const [service, cost] of Object.entries(tier)) {
    const isTotal = service.startsWith('Total');
    const prefix = isTotal ? c.bold : '';
    const suffix = isTotal ? c.reset : '';
    console.log(`  ${prefix}${service.padEnd(30)}${suffix} | ${prefix}${cost}${suffix}`);
  }
  console.log('');
  console.log(`${c.dim}  For detailed estimates, use the MCP tool: estimate_cost${c.reset}\n`);
}

// ═══════════════════════════════════════════════════
// VALIDATE — Consistency + config check
// ═══════════════════════════════════════════════════
function cmdValidate() {
  banner();
  console.log(`${c.cyan}  Running consistency checks...${c.reset}\n`);

  // Check local project structure
  const checks = [
    { file: '.vscode/mcp.json', label: 'MCP config' },
    { file: '.github/copilot-instructions.md', label: 'Copilot instructions' },
    { file: '.github/agents/builder.agent.md', label: 'Builder agent' },
    { file: '.github/agents/reviewer.agent.md', label: 'Reviewer agent' },
    { file: '.github/agents/tuner.agent.md', label: 'Tuner agent' },
    { file: 'config/openai.json', label: 'OpenAI config' },
    { file: 'config/guardrails.json', label: 'Guardrails config' },
  ];

  let passed = 0;
  for (const { file, label } of checks) {
    if (existsSync(file)) {
      console.log(`  ${c.green}✅${c.reset} ${label} — ${file}`);
      passed++;
    } else {
      console.log(`  ${c.red}❌${c.reset} ${label} — ${file} ${c.dim}(missing)${c.reset}`);
    }
  }

  // Check MCP config content
  if (existsSync('.vscode/mcp.json')) {
    try {
      const mcp = JSON.parse(readFileSync('.vscode/mcp.json', 'utf8'));
      if (mcp.servers?.frootai) {
        console.log(`  ${c.green}✅${c.reset} MCP server configured: frootai`);
        passed++;
      }
    } catch (e) {
      console.log(`  ${c.red}❌${c.reset} MCP config has JSON errors`);
    }
  }

  console.log(`\n  ${passed}/${checks.length + 1} checks passed\n`);
}

// ═══════════════════════════════════════════════════
// DOCTOR — Health check
// ═══════════════════════════════════════════════════
function cmdDoctor() {
  banner();
  console.log(`${c.cyan}  Running health checks...${c.reset}\n`);

  // Node.js version
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1));
  if (nodeMajor >= 18) {
    console.log(`  ${c.green}✅${c.reset} Node.js ${nodeVersion} (>= 18 required)`);
  } else {
    console.log(`  ${c.red}❌${c.reset} Node.js ${nodeVersion} — upgrade to 18+ required`);
  }

  // npm available
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    console.log(`  ${c.green}✅${c.reset} npm ${npmVersion}`);
  } catch (e) {
    console.log(`  ${c.red}❌${c.reset} npm not found`);
  }

  // Git available
  try {
    const gitVersion = execSync('git --version', { encoding: 'utf8' }).trim();
    console.log(`  ${c.green}✅${c.reset} ${gitVersion}`);
  } catch (e) {
    console.log(`  ${c.red}❌${c.reset} git not found`);
  }

  // VS Code available
  try {
    const codeVersion = execSync('code --version', { encoding: 'utf8' }).trim().split('\n')[0];
    console.log(`  ${c.green}✅${c.reset} VS Code ${codeVersion}`);
  } catch (e) {
    console.log(`  ${c.yellow}⚠️${c.reset}  VS Code not in PATH (optional)`);
  }

  // Check .vscode/mcp.json in current dir
  if (existsSync('.vscode/mcp.json')) {
    console.log(`  ${c.green}✅${c.reset} .vscode/mcp.json found`);
  } else {
    console.log(`  ${c.yellow}⚠️${c.reset}  No .vscode/mcp.json — run "frootai init" to set up`);
  }

  // Check .github structure
  if (existsSync('.github/agents')) {
    console.log(`  ${c.green}✅${c.reset} .github/agents/ found`);
  } else {
    console.log(`  ${c.yellow}⚠️${c.reset}  No .github/agents/ — run "frootai init" to set up`);
  }

  // MCP server reachable (just check npm registry)
  try {
    execSync('npm view frootai-mcp version', { encoding: 'utf8', timeout: 10000 });
    console.log(`  ${c.green}✅${c.reset} frootai-mcp available on npm`);
  } catch (e) {
    console.log(`  ${c.yellow}⚠️${c.reset}  Could not reach npm registry`);
  }

  console.log('');
}

// ═══════════════════════════════════════════════════
// HELP
// ═══════════════════════════════════════════════════
function cmdHelp() {
  banner();
  console.log(`${c.bold}  Usage:${c.reset} frootai <command> [options]\n`);
  console.log(`${c.bold}  Commands:${c.reset}`);
  console.log(`    ${c.green}init${c.reset}              Interactive project scaffolding`);
  console.log(`    ${c.green}search${c.reset} <query>     Search FrootAI knowledge base`);
  console.log(`    ${c.green}cost${c.reset} [play]        Cost estimate (--scale dev|prod)`);
  console.log(`    ${c.green}validate${c.reset}           Check project structure + configs`);
  console.log(`    ${c.green}doctor${c.reset}             Health check for your setup`);
  console.log(`    ${c.green}version${c.reset}            Show version info`);
  console.log(`    ${c.green}help${c.reset}               Show this help\n`);
  console.log(`${c.bold}  Examples:${c.reset}`);
  console.log(`    ${c.dim}npx frootai init${c.reset}`);
  console.log(`    ${c.dim}npx frootai search "RAG architecture"${c.reset}`);
  console.log(`    ${c.dim}npx frootai cost enterprise-rag --scale prod${c.reset}`);
  console.log(`    ${c.dim}npx frootai doctor${c.reset}\n`);
  console.log(`  ${c.dim}Docs: https://frootai.dev${c.reset}`);
  console.log(`  ${c.dim}GitHub: https://github.com/gitpavleenbali/frootai${c.reset}\n`);
}

// ─── Helpers ───
function writeIfNotExists(filepath, content) {
  if (!existsSync(filepath)) {
    writeFileSync(filepath, content, 'utf8');
  }
}
