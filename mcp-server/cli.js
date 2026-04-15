#!/usr/bin/env node
/**
 * FrootAI CLI — `npx frootai <command>`
 *
 * Commands:
 *   init                Interactive project scaffolding
 *   scaffold <play>     Scaffold a specific solution play
 *   install <play>      Download a solution play from GitHub
 *   list [keyword]      List available plugins
 *   primitives [type]   Browse 830+ FAI primitives catalog
 *   protocol            View FAI Protocol overview
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
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, copyFileSync } from 'fs';
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
  case 'scaffold':
    await cmdScaffold(args[1]);
    break;
  case 'install':
    await cmdInstall(args[1], args.includes('--dry-run'));
    break;
  case 'list':
    cmdListPlugins(args[1]);
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
  case 'primitives':
  case 'catalog':
    cmdPrimitivesCatalog(args[1]);
    break;
  case 'protocol':
    cmdProtocol();
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

  // Auto-detect existing project
  const hasExisting = existsSync('package.json') || existsSync('.github') || existsSync('infra');
  if (hasExisting) {
    console.log(`${c.yellow}  📂 Existing project detected — will merge FrootAI files alongside yours.${c.reset}`);
    if (existsSync('package.json')) console.log(`${c.dim}    Found: package.json${c.reset}`);
    if (existsSync('.github')) console.log(`${c.dim}    Found: .github/${c.reset}`);
    if (existsSync('infra')) console.log(`${c.dim}    Found: infra/${c.reset}`);
    console.log('');
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(r => rl.question(q, r));

  // Question 1: Scenario
  console.log(`${c.bold}  What are you building?${c.reset}`);
  console.log(`${c.dim}  1) Enterprise RAG (document Q&A, knowledge base)`);
  console.log(`  2) AI Agent (multi-step reasoning, tool calling)`);
  console.log(`  3) AI Gateway (API management, cost control)`);
  console.log(`  4) Content Moderation (safety, compliance)`);
  console.log(`  5) Multi-modal (vision, document intelligence)`);
  console.log(`  6) Custom (pick from 100 solution plays)${c.reset}\n`);
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
      '21-agentic-rag', '22-multi-agent-swarm', '23-browser-automation-agent',
      '24-ai-code-review-pipeline', '25-conversation-memory-layer', '26-semantic-search-engine',
      '27-ai-data-pipeline', '28-knowledge-graph-rag', '29-mcp-gateway',
      '30-ai-security-hardening', '31-low-code-ai-builder', '32-ai-powered-testing',
      '33-voice-ai-agent', '34-edge-ai-deployment', '35-ai-compliance-engine',
      '36-multimodal-agent', '37-ai-powered-devops', '38-document-understanding-v2',
      '39-ai-meeting-assistant', '40-copilot-studio-advanced', '41-ai-red-teaming',
      '42-computer-use-agent', '43-ai-video-generation', '44-foundry-local-on-device',
      '45-realtime-event-ai', '46-healthcare-clinical-ai', '47-synthetic-data-factory',
      '48-ai-model-governance', '49-creative-ai-studio', '50-financial-risk-intelligence',
      '51-autonomous-coding-agent', '52-ai-api-gateway-v2', '53-legal-document-ai',
      '54-ai-customer-support-v2', '55-supply-chain-ai', '56-semantic-code-search',
      '57-ai-translation-engine', '58-digital-twin-agent', '59-ai-recruiter-agent',
      '60-responsible-ai-dashboard', '61-content-moderation-v2', '62-federated-learning-pipeline',
      '63-fraud-detection-agent', '64-ai-sales-assistant', '65-ai-training-curriculum',
      '66-ai-infrastructure-optimizer', '67-ai-knowledge-management', '68-predictive-maintenance-ai',
      '69-carbon-footprint-tracker', '70-esg-compliance-agent', '71-smart-energy-grid-ai',
      '72-climate-risk-assessor', '73-waste-recycling-optimizer',
      '74-ai-tutoring-agent', '75-exam-generation-engine',
      '76-accessibility-learning-agent', '77-research-paper-ai',
      '78-precision-agriculture-agent', '79-food-safety-inspector-ai', '80-biodiversity-monitor',
      '81-property-valuation-ai', '82-construction-safety-ai', '83-building-energy-optimizer',
      '84-citizen-services-chatbot', '85-policy-impact-analyzer', '86-public-safety-analytics',
      '87-dynamic-pricing-engine', '88-visual-product-search', '89-retail-inventory-predictor',
      '90-network-optimization-agent', '91-customer-churn-predictor', '92-telecom-fraud-shield',
      '93-continual-learning-agent', '94-ai-podcast-generator', '95-multimodal-search-v2',
      '96-realtime-voice-agent-v2', '97-ai-data-marketplace', '98-agent-evaluation-platform',
      '99-enterprise-ai-governance-hub', '100-fai-meta-agent',
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

  // Progress tree animation
  const stages = [
    ['🌱', 'SpecKit', 'Architecture specs + WAF alignment'],
    ['🌿', 'DevKit', '.github agents + instructions + MCP config'],
    ['🌳', 'TuneKit', 'AI configs + evaluation + guardrails'],
  ];
  for (const [icon, kit, desc] of stages) {
    process.stdout.write(`  ${icon} ${c.bold}${kit}${c.reset} ${c.dim}${desc}${c.reset}`);
    await new Promise(r => setTimeout(r, 300));
    process.stdout.write(` ${c.green}✓${c.reset}\n`);
  }
  console.log('');

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
        args: ['frootai-mcp@latest'],
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
description: "Tuner agent — validates configs, runs evaluations, checks WAF alignment"
tools:
  - frootai
---
# Tuner Agent

Validate:
- config/*.json values are production-appropriate
- Evaluation thresholds are met
- WAF alignment: run \\\`npx frootai validate --waf\\\` and ensure all 6 pillars pass
- Cost estimates are within budget

## WAF Check
Before shipping, verify all 6 pillars:
1. Reliability  2. Security  3. Cost  4. Operations  5. Performance  6. Responsible AI
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

> Built with [FrootAI](https://frootai.dev) — Solution Play: \`${playId}\` | Scale: **${scale}**

## Getting Started (5 minutes)

### Step 1: Open in VS Code
\`\`\`bash
code .
\`\`\`
The MCP server auto-connects via \`.vscode/mcp.json\`. Copilot now has 22 AI architecture tools.

### Step 2: Start Building
Open **Copilot Chat** (Ctrl+Shift+I) and type:
\`\`\`
@builder Build the main application entry point for this ${playId} solution
\`\`\`

### Step 3: Review Your Code
\`\`\`
@reviewer Review the code for security, WAF alignment, and production readiness
\`\`\`

### Step 4: Validate & Tune
\`\`\`bash
npx frootai validate --waf    # Check WAF alignment (6 pillars)
\`\`\`
\`\`\`
@tuner Check if configs in config/ are production-appropriate
\`\`\`

### Step 5: Deploy
\`\`\`bash
az deployment group create --resource-group myRG --template-file infra/main.bicep
\`\`\`

## Project Structure

| Path | Kit | What |
|------|-----|------|
| \`.github/agents/\` | DevKit | Builder, Reviewer, Tuner agents |
| \`.github/instructions/\` | DevKit | WAF security + reliability rules |
| \`config/\` | TuneKit | OpenAI, guardrails, search configs |
| \`spec/\` | SpecKit | Architecture spec + WAF alignment |
| \`evaluation/\` | EvalKit | Quality thresholds + test config |
| \`infra/\` | InfraKit | Bicep templates |
| \`.vscode/mcp.json\` | MCP | Auto-connects 25 tools |

## Useful Commands

\`\`\`bash
npx frootai search "RAG architecture"   # Search knowledge base
npx frootai cost ${playId.split('-')[0]} --scale ${scale}   # Cost estimate
npx frootai validate                      # Check project structure
npx frootai doctor                        # Health check
\`\`\`

## Links

- [FrootAI](https://frootai.dev) | [npm](https://www.npmjs.com/package/frootai-mcp) | [VS Code](https://marketplace.visualstudio.com/items?itemName=frootai.frootai-vscode) | [PyPI](https://pypi.org/project/frootai/)
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

  // froot.json manifest
  writeIfNotExists(join(projectDir, 'froot.json'), JSON.stringify({
    frootai: VERSION, play: playId, scale,
    kits: {
      devkit: { files: ['.github/agents/', '.github/instructions/', '.github/copilot-instructions.md', '.vscode/mcp.json'] },
      tunekit: { files: ['config/openai.json', 'config/search.json', 'config/guardrails.json', 'evaluation/'] },
      speckit: { files: ['spec/project-spec.json'] },
      infrakit: { files: ['infra/'] },
      evalkit: { files: ['evaluation/'] },
    },
    waf: true,
  }, null, 2));

  // Post-scaffold welcome
  console.log(`${c.cyan}  ┌──────────────────────────────────────────────────────┐${c.reset}`);
  console.log(`${c.cyan}  │  🌳 Welcome to FrootAI!                              │${c.reset}`);
  console.log(`${c.cyan}  │                                                      │${c.reset}`);
  console.log(`${c.cyan}  │  Your project is WAF-aligned from day one.           │${c.reset}`);
  console.log(`${c.cyan}  │  Run ${c.green}npx frootai validate --waf${c.cyan} to check scores.    │${c.reset}`);
  console.log(`${c.cyan}  │                                                      │${c.reset}`);
  console.log(`${c.cyan}  │  It's simply Frootful. 🌱                            │${c.reset}`);
  console.log(`${c.cyan}  └──────────────────────────────────────────────────────┘${c.reset}\n`);
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

  // WAF scorecard (if --waf flag)
  if (args.includes('--waf')) {
    cmdWafScorecard();
  }
}

// ═══════════════════════════════════════════════════
// WAF SCORECARD — Well-Architected Framework check
// ═══════════════════════════════════════════════════
function cmdWafScorecard() {
  console.log(`${c.cyan}  WAF Alignment Scorecard${c.reset}\n`);

  const pillars = [
    {
      name: 'Reliability',
      checks: [
        { label: 'Health endpoint config', test: () => existsSync('config/openai.json') },
        { label: 'Retry/backoff in instructions', test: () => existsSync('.github/instructions/waf-reliability.instructions.md') },
        { label: 'Evaluation thresholds', test: () => existsSync('evaluation/eval-config.json') },
      ]
    },
    {
      name: 'Security',
      checks: [
        { label: 'Security instructions', test: () => existsSync('.github/instructions/waf-security.instructions.md') },
        { label: 'Guardrails config', test: () => existsSync('config/guardrails.json') },
        {
          label: 'No hardcoded secrets', test: () => {
            try {
              const files = ['config/openai.json', '.env'];
              for (const f of files) {
                if (existsSync(f)) {
                  const content = readFileSync(f, 'utf8');
                  if (/sk-[a-zA-Z0-9]{20,}/.test(content) || /password\s*[:=]\s*["'][^"']+["']/i.test(content)) return false;
                }
              }
              return true;
            } catch (e) { return true; }
          }
        },
      ]
    },
    {
      name: 'Cost Optimization',
      checks: [
        { label: 'Cost optimization instructions', test: () => existsSync('.github/instructions/waf-cost-optimization.instructions.md') },
        {
          label: 'Model config (temperature, max_tokens)', test: () => {
            try { const c = JSON.parse(readFileSync('config/openai.json', 'utf8')); return c.max_tokens !== undefined; } catch (e) { return false; }
          }
        },
        {
          label: 'Token budget in guardrails', test: () => {
            try { const c = JSON.parse(readFileSync('config/guardrails.json', 'utf8')); return c.max_tokens_per_request !== undefined; } catch (e) { return false; }
          }
        },
      ]
    },
    {
      name: 'Operational Excellence',
      checks: [
        { label: 'CI/CD config (.github/workflows)', test: () => existsSync('.github/workflows') },
        { label: 'Copilot instructions', test: () => existsSync('.github/copilot-instructions.md') },
        { label: 'Agent definitions', test: () => existsSync('.github/agents/builder.agent.md') },
      ]
    },
    {
      name: 'Performance',
      checks: [
        { label: 'Performance instructions', test: () => existsSync('.github/instructions/waf-performance-efficiency.instructions.md') },
        {
          label: 'Search config (top_k)', test: () => {
            try { const c = JSON.parse(readFileSync('config/search.json', 'utf8')); return c.top_k !== undefined; } catch (e) { return false; }
          }
        },
      ]
    },
    {
      name: 'Responsible AI',
      checks: [
        { label: 'RAI instructions', test: () => existsSync('.github/instructions/waf-responsible-ai.instructions.md') },
        {
          label: 'Content safety in guardrails', test: () => {
            try { const c = JSON.parse(readFileSync('config/guardrails.json', 'utf8')); return Array.isArray(c.blocked_categories); } catch (e) { return false; }
          }
        },
        {
          label: 'Grounding check enabled', test: () => {
            try { const c = JSON.parse(readFileSync('config/guardrails.json', 'utf8')); return c.grounding_check === true; } catch (e) { return false; }
          }
        },
      ]
    },
  ];

  let totalPassed = 0;
  let totalChecks = 0;

  console.log(`  ${'Pillar'.padEnd(25)} | Score  | Status`);
  console.log(`  ${'─'.repeat(25)}─┼────────┼${'─'.repeat(20)}`);

  for (const pillar of pillars) {
    const passed = pillar.checks.filter(ch => ch.test()).length;
    const total = pillar.checks.length;
    totalPassed += passed;
    totalChecks += total;
    const pct = Math.round((passed / total) * 100);
    const bar = pct >= 80 ? `${c.green}${pct}%${c.reset}` : pct >= 50 ? `${c.yellow}${pct}%${c.reset}` : `${c.red}${pct}%${c.reset}`;
    const status = pct === 100 ? `${c.green}✅ Complete${c.reset}` : pct >= 50 ? `${c.yellow}⚠️  Partial${c.reset}` : `${c.red}❌ Needs work${c.reset}`;
    console.log(`  ${pillar.name.padEnd(25)} | ${String(pct + '%').padEnd(6)} | ${status}`);
  }

  const overallPct = Math.round((totalPassed / totalChecks) * 100);
  console.log(`  ${'─'.repeat(25)}─┼────────┼${'─'.repeat(20)}`);
  console.log(`  ${'OVERALL'.padEnd(25)} | ${overallPct}%    | ${totalPassed}/${totalChecks} checks`);
  console.log('');

  // Show failing checks
  let failures = 0;
  for (const pillar of pillars) {
    for (const ch of pillar.checks) {
      if (!ch.test()) {
        if (failures === 0) console.log(`${c.dim}  Missing:${c.reset}`);
        console.log(`  ${c.red}❌${c.reset} ${pillar.name}: ${ch.label}`);
        failures++;
      }
    }
  }
  if (failures === 0) {
    console.log(`  ${c.green}All WAF checks passed!${c.reset}`);
  }
  console.log('');
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
// SCAFFOLD — One-command play scaffold
// ═══════════════════════════════════════════════════
async function cmdScaffold(playArg) {
  banner();

  const allPlays = [
    '01-enterprise-rag', '02-ai-landing-zone', '03-deterministic-agent',
    '04-call-center-voice-ai', '05-it-ticket-resolution', '06-document-intelligence',
    '07-multi-agent-service', '08-copilot-studio-bot', '09-ai-search-portal',
    '10-content-moderation', '11-ai-landing-zone-advanced', '12-model-serving-aks',
    '13-fine-tuning-workflow', '14-cost-optimized-ai-gateway', '15-multi-modal-docproc',
    '16-copilot-teams-extension', '17-ai-observability', '18-prompt-management',
    '19-edge-ai-phi4', '20-anomaly-detection',
    '21-agentic-rag', '22-multi-agent-swarm', '23-browser-automation-agent',
    '24-ai-code-review-pipeline', '25-conversation-memory-layer', '26-semantic-search-engine',
    '27-ai-data-pipeline', '28-knowledge-graph-rag', '29-mcp-gateway',
    '30-ai-security-hardening', '31-low-code-ai-builder', '32-ai-powered-testing',
    '33-voice-ai-agent', '34-edge-ai-deployment', '35-ai-compliance-engine',
    '36-multimodal-agent', '37-ai-powered-devops', '38-document-understanding-v2',
    '39-ai-meeting-assistant', '40-copilot-studio-advanced', '41-ai-red-teaming',
    '42-computer-use-agent', '43-ai-video-generation', '44-foundry-local-on-device',
    '45-realtime-event-ai', '46-healthcare-clinical-ai', '47-synthetic-data-factory',
    '48-ai-model-governance', '49-creative-ai-studio', '50-financial-risk-intelligence',
    '51-autonomous-coding-agent', '52-ai-api-gateway-v2', '53-legal-document-ai',
    '54-ai-customer-support-v2', '55-supply-chain-ai', '56-semantic-code-search',
    '57-ai-translation-engine', '58-digital-twin-agent', '59-ai-recruiter-agent',
    '60-responsible-ai-dashboard', '61-content-moderation-v2', '62-federated-learning-pipeline',
    '63-fraud-detection-agent', '64-ai-sales-assistant', '65-ai-training-curriculum',
    '66-ai-infrastructure-optimizer', '67-ai-knowledge-management', '68-predictive-maintenance-ai',
    '69-carbon-footprint-tracker', '70-esg-compliance-agent', '71-smart-energy-grid-ai',
    '72-climate-risk-assessor', '73-waste-recycling-optimizer',
    '74-ai-tutoring-agent', '75-exam-generation-engine',
    '76-accessibility-learning-agent', '77-research-paper-ai',
    '78-precision-agriculture-agent', '79-food-safety-inspector-ai', '80-biodiversity-monitor',
    '81-property-valuation-ai', '82-construction-safety-ai', '83-building-energy-optimizer',
    '84-citizen-services-chatbot', '85-policy-impact-analyzer', '86-public-safety-analytics',
    '87-dynamic-pricing-engine', '88-visual-product-search', '89-retail-inventory-predictor',
    '90-network-optimization-agent', '91-customer-churn-predictor', '92-telecom-fraud-shield',
    '93-continual-learning-agent', '94-ai-podcast-generator', '95-multimodal-search-v2',
    '96-realtime-voice-agent-v2', '97-ai-data-marketplace', '98-agent-evaluation-platform',
    '99-enterprise-ai-governance-hub', '100-fai-meta-agent',
  ];

  if (!playArg) {
    console.log(`${c.yellow}  Usage: frootai scaffold <play-id>${c.reset}`);
    console.log(`${c.dim}  Example: frootai scaffold 01-enterprise-rag${c.reset}`);
    console.log(`${c.dim}  Example: frootai scaffold play-01${c.reset}\n`);
    console.log(`${c.bold}  Available plays:${c.reset}`);
    allPlays.forEach(p => console.log(`${c.dim}    ${p}${c.reset}`));
    return;
  }

  // Resolve play ID from shorthand like "play-01" or "01"
  let playId = playArg;
  const numMatch = playArg.match(/(?:play-?)?(\d+)/i);
  if (numMatch) {
    const num = numMatch[1].padStart(2, '0');
    playId = allPlays.find(p => p.startsWith(num + '-')) || playArg;
  }

  if (!allPlays.includes(playId)) {
    console.log(`${c.red}  Unknown play: ${playArg}${c.reset}`);
    console.log(`${c.dim}  Run "frootai scaffold" to see available plays.${c.reset}`);
    return;
  }

  const projectName = playId;
  console.log(`${c.cyan}  Scaffolding play: ${playId}${c.reset}\n`);

  // Auto-detect existing project
  const hasPackageJson = existsSync('package.json');
  const hasBicep = existsSync('infra/main.bicep');
  const hasGithub = existsSync('.github');
  if (hasPackageJson || hasBicep || hasGithub) {
    console.log(`${c.yellow}  Detected existing project — merging FrootAI files alongside existing ones.${c.reset}`);
    if (hasPackageJson) console.log(`${c.dim}    Found: package.json${c.reset}`);
    if (hasBicep) console.log(`${c.dim}    Found: infra/main.bicep${c.reset}`);
    if (hasGithub) console.log(`${c.dim}    Found: .github/${c.reset}`);
    console.log('');
  }

  // Create dirs
  const dirs = ['.vscode', '.github/agents', '.github/instructions', '.github/prompts', 'config', 'evaluation', 'infra', 'spec'];
  for (const d of dirs) mkdirSync(d, { recursive: true });

  // Core files
  writeIfNotExists('.vscode/mcp.json', JSON.stringify({ servers: { frootai: { type: 'stdio', command: 'npx', args: ['frootai-mcp@latest'] } } }, null, 2));

  writeIfNotExists('.github/agents/builder.agent.md', `---\ndescription: "Builder agent — implements features following FrootAI architecture patterns"\ntools:\n  - frootai\n---\n# Builder Agent\n\nYou are a builder agent for a ${playId} solution.\nUse the FrootAI MCP server for architecture patterns, cost estimates, and best practices.\n`);
  writeIfNotExists('.github/agents/reviewer.agent.md', `---\ndescription: "Reviewer agent — reviews code for security, quality, Azure best practices"\ntools:\n  - frootai\n---\n# Reviewer Agent\n\nReview all code changes against:\n- Security (OWASP Top 10)\n- Azure best practices (Well-Architected Framework)\n- Config compliance (config/*.json)\n`);
  writeIfNotExists('.github/agents/tuner.agent.md', `---\ndescription: "Tuner agent — validates configs, runs evaluations, checks WAF alignment"\ntools:\n  - frootai\n---\n# Tuner Agent\n\nValidate:\n- config/*.json values are production-appropriate\n- Evaluation thresholds are met\n- WAF alignment: run \\\`npx frootai validate --waf\\\` and ensure all 6 pillars pass\n- Cost estimates are within budget\n\n## WAF Check\nBefore shipping, verify:\n1. Reliability: retry policies, health probes\n2. Security: managed identity, private endpoints, no API keys\n3. Cost: right-sized SKUs, token budgets\n4. Operations: diagnostics, CI/CD, agent definitions\n5. Performance: caching, streaming, connection pooling\n6. Responsible AI: content safety, guardrails, grounding\n`);

  writeIfNotExists('.github/copilot-instructions.md', `# ${playId}\n\n## Agent Workflow\n1. **Build**: Implement using config/ values and FrootAI MCP\n2. **Review**: Self-review against reviewer.agent.md\n3. **Tune**: Verify configs + WAF alignment (npx frootai validate --waf)\n`);

  writeIfNotExists('config/openai.json', JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.1, max_tokens: 4096, api_version: '2025-01-01-preview' }, null, 2));
  writeIfNotExists('config/guardrails.json', JSON.stringify({ max_tokens_per_request: 4096, blocked_categories: ['hate', 'violence', 'self-harm', 'sexual'], pii_detection: true, grounding_check: true }, null, 2));
  writeIfNotExists('config/search.json', JSON.stringify({ service: 'azure-ai-search', index: `${playId}-index`, semantic_config: 'default', top_k: 5, min_score: 0.75 }, null, 2));
  writeIfNotExists('evaluation/eval-config.json', JSON.stringify({ metrics: ['groundedness', 'relevance', 'coherence', 'fluency'], thresholds: { groundedness: 4.0, relevance: 4.0, coherence: 4.0, fluency: 4.0 }, dataset: 'evaluation/test-data.jsonl' }, null, 2));

  // SpecKit — play-spec.json
  const specData = {
    name: playId, version: '0.1.0', play: playId,
    architecture: { pattern: playId.includes('rag') ? 'rag' : playId.includes('agent') ? 'agent' : playId.includes('landing') ? 'infrastructure' : 'custom' },
    waf_alignment: {
      reliability: { score: 0, status: 'unchecked' },
      security: { score: 0, status: 'unchecked' },
      cost_optimization: { score: 0, status: 'unchecked' },
      operational_excellence: { score: 0, status: 'unchecked' },
      performance_efficiency: { score: 0, status: 'unchecked' },
      responsible_ai: { score: 0, status: 'unchecked' },
    },
    evaluation: { thresholds: { groundedness: 4.0, relevance: 4.0 } },
  };
  writeIfNotExists('spec/play-spec.json', JSON.stringify(specData, null, 2));

  // WAF instructions
  writeIfNotExists('.github/instructions/waf-security.instructions.md', `---\napplyTo: "**/*.{ts,js,py,bicep,json}"\n---\n# Security\n- Use Managed Identity for all Azure service auth\n- Store secrets in Azure Key Vault\n- Enable content safety on all AI endpoints\n`);
  writeIfNotExists('.github/instructions/waf-reliability.instructions.md', `---\napplyTo: "**/*.{ts,js,py,bicep,json}"\n---\n# Reliability\n- Retry all external API calls (3 retries, exponential backoff)\n- Expose /health endpoint on every service\n`);
  writeIfNotExists('.github/instructions/waf-cost-optimization.instructions.md', `---\napplyTo: "**/*.{ts,js,py,bicep,json}"\n---\n# Cost Optimization\n- Use GPT-4o-mini for dev, GPT-4o for prod\n- Set token budgets in guardrails.json\n- Enable autoscaling where supported\n`);
  writeIfNotExists('.github/instructions/waf-performance-efficiency.instructions.md', `---\napplyTo: "**/*.{ts,js,py,bicep,json}"\n---\n# Performance\n- Enable response caching for repeated queries\n- Use streaming for real-time responses\n- Set appropriate top_k values in search config\n`);
  writeIfNotExists('.github/instructions/waf-responsible-ai.instructions.md', `---\napplyTo: "**/*.{ts,js,py,bicep,json}"\n---\n# Responsible AI\n- Enable Azure Content Safety on all endpoints\n- Validate groundedness of AI responses\n- Monitor for bias and fairness\n`);

  // froot.json — play manifest
  const frootManifest = {
    frootai: VERSION, play: playId,
    kits: {
      devkit: { files: ['.github/agents/', '.github/instructions/', '.github/copilot-instructions.md', '.vscode/mcp.json'] },
      tunekit: { files: ['config/openai.json', 'config/search.json', 'config/guardrails.json', 'evaluation/'] },
      speckit: { files: ['spec/play-spec.json'] },
      infrakit: { files: ['infra/'] },
      evalkit: { files: ['evaluation/'] },
    },
    waf: true,
  };
  writeIfNotExists('froot.json', JSON.stringify(frootManifest, null, 2));

  // Print summary
  console.log(`${c.green}  ✅ Play scaffolded: ${playId}${c.reset}\n`);
  console.log(`  ${c.bold}Files created:${c.reset}`);
  console.log(`${c.dim}  .vscode/mcp.json             ← MCP auto-connect`);
  console.log(`  .github/agents/              ← Builder + Reviewer + Tuner`);
  console.log(`  .github/instructions/        ← 5 WAF instruction files`);
  console.log(`  config/                      ← OpenAI + Search + Guardrails`);
  console.log(`  evaluation/                  ← Eval config + thresholds`);
  console.log(`  spec/play-spec.json          ← SpecKit (WAF alignment)`);
  console.log(`  froot.json                   ← Play manifest (5 kits)${c.reset}\n`);

  // ─── Post-scaffold welcome ───
  console.log(`${c.cyan}  ┌─────────────────────────────────────────────────────┐${c.reset}`);
  console.log(`${c.cyan}  │  🌳 Welcome to FrootAI!                             │${c.reset}`);
  console.log(`${c.cyan}  │                                                     │${c.reset}`);
  console.log(`${c.cyan}  │  Your project is WAF-aligned from day one.          │${c.reset}`);
  console.log(`${c.cyan}  │  Run ${c.green}npx frootai validate --waf${c.cyan} to check scores.   │${c.reset}`);
  console.log(`${c.cyan}  │                                                     │${c.reset}`);
  console.log(`${c.cyan}  │  Quick start:                                       │${c.reset}`);
  console.log(`${c.cyan}  │    ${c.green}code .${c.cyan}          ← MCP auto-connects             │${c.reset}`);
  console.log(`${c.cyan}  │    ${c.green}@builder${c.cyan}        ← Start building in Copilot     │${c.reset}`);
  console.log(`${c.cyan}  │    ${c.green}@tuner${c.cyan}          ← Validate WAF + configs        │${c.reset}`);
  console.log(`${c.cyan}  │                                                     │${c.reset}`);
  console.log(`${c.cyan}  │  It's simply Frootful. 🌱                           │${c.reset}`);
  console.log(`${c.cyan}  └─────────────────────────────────────────────────────┘${c.reset}\n`);
}

// ═══════════════════════════════════════════════════
// HELP
// ═══════════════════════════════════════════════════
// INSTALL — Download a solution play from GitHub
// ═══════════════════════════════════════════════════
async function cmdInstall(playInput, dryRun = false) {
  banner();

  if (!playInput) {
    console.log(`${c.red}  Error: Play name or ID required.${c.reset}`);
    console.log(`${c.dim}  Usage: frootai install <play-name|play-id> [--dry-run] [--kit devkit|tunekit|speckit]${c.reset}`);
    console.log(`${c.dim}  Examples:${c.reset}`);
    console.log(`    ${c.green}frootai install 01-enterprise-rag${c.reset}`);
    console.log(`    ${c.green}frootai install 01${c.reset}`);
    console.log(`    ${c.green}frootai install enterprise-rag${c.reset}`);
    console.log(`    ${c.green}frootai install 01 --kit devkit${c.reset}\n`);
    process.exit(1);
  }

  // Resolve play directory name
  const allPlays = [
    '01-enterprise-rag', '02-ai-landing-zone', '03-deterministic-agent',
    '04-call-center-voice-ai', '05-it-ticket-resolution', '06-document-intelligence',
    '07-multi-agent-service', '08-copilot-studio-bot', '09-ai-search-portal',
    '10-content-moderation', '11-ai-landing-zone-advanced', '12-model-serving-aks',
    '13-fine-tuning-workflow', '14-cost-optimized-ai-gateway', '15-multi-modal-docproc',
    '16-copilot-teams-extension', '17-ai-observability', '18-prompt-management',
    '19-edge-ai-phi4', '20-anomaly-detection', '21-agentic-rag',
    '22-multi-agent-swarm', '23-browser-automation-agent', '24-ai-code-review-pipeline',
    '25-conversation-memory-layer', '26-semantic-search-engine', '27-ai-data-pipeline',
    '28-knowledge-graph-rag', '29-mcp-gateway', '30-ai-security-hardening',
    '31-low-code-ai-builder', '32-ai-powered-testing', '33-voice-ai-agent',
    '34-edge-ai-deployment', '35-ai-compliance-engine', '36-multimodal-agent',
    '37-ai-powered-devops', '38-document-understanding-v2', '39-ai-meeting-assistant',
    '40-copilot-studio-advanced', '41-ai-red-teaming', '42-computer-use-agent',
    '43-ai-video-generation', '44-foundry-local-on-device', '45-realtime-event-ai',
    '46-healthcare-clinical-ai', '47-synthetic-data-factory', '48-ai-model-governance',
    '49-creative-ai-studio', '50-financial-risk-intelligence', '51-autonomous-coding-agent',
    '52-ai-api-gateway-v2', '53-legal-document-ai', '54-ai-customer-support-v2',
    '55-supply-chain-ai', '56-semantic-code-search', '57-ai-translation-engine',
    '58-digital-twin-agent', '59-ai-recruiter-agent', '60-responsible-ai-dashboard',
    '61-content-moderation-v2', '62-federated-learning-pipeline', '63-fraud-detection-agent',
    '64-ai-sales-assistant', '65-ai-training-curriculum', '66-ai-infrastructure-optimizer',
    '67-ai-knowledge-management', '68-predictive-maintenance-ai', '69-carbon-footprint-tracker',
    '70-esg-compliance-agent', '71-smart-energy-grid-ai', '72-climate-risk-assessor',
    '73-waste-recycling-optimizer', '74-ai-tutoring-agent', '75-exam-generation-engine',
    '76-accessibility-learning-agent', '77-research-paper-ai', '78-precision-agriculture-agent',
    '79-food-safety-inspector-ai', '80-biodiversity-monitor', '81-property-valuation-ai',
    '82-construction-safety-ai', '83-building-energy-optimizer', '84-citizen-services-chatbot',
    '85-policy-impact-analyzer', '86-public-safety-analytics', '87-dynamic-pricing-engine',
    '88-visual-product-search', '89-retail-inventory-predictor', '90-network-optimization-agent',
    '91-customer-churn-predictor', '92-telecom-fraud-shield', '93-continual-learning-agent',
    '94-ai-podcast-generator', '95-multimodal-search-v2', '96-realtime-voice-agent-v2',
    '97-ai-data-marketplace', '98-agent-evaluation-platform', '99-enterprise-ai-governance-hub',
    '100-fai-meta-agent', '101-pester-test-development',
  ];

  let playDir = playInput;
  // Resolve play: exact match, number prefix, or fuzzy name match
  const exactMatch = allPlays.find(p => p === playDir);
  if (exactMatch) {
    playDir = exactMatch;
  } else {
    // Try matching by number prefix (e.g., "01" → "01-enterprise-rag")
    const num = playInput.replace(/^play-?/i, '').replace(/^0*(\d+)/, (_, d) => d);
    const padded = num.padStart(2, '0');
    const numMatch = allPlays.find(p => p.startsWith(padded + '-'));
    if (numMatch) {
      playDir = numMatch;
    } else {
      // Try fuzzy match on name part (e.g., "enterprise-rag" → "01-enterprise-rag")
      const slug = playInput.toLowerCase().replace(/\s+/g, '-');
      const fuzzy = allPlays.find(p => p.includes(slug));
      if (fuzzy) {
        playDir = fuzzy;
      } else {
        console.log(`${c.red}  Play not found: ${playInput}${c.reset}`);
        console.log(`${c.dim}  Try: frootai install 01 or frootai install enterprise-rag${c.reset}\n`);
        process.exit(1);
      }
    }
  }

  // Determine which kit to install
  const kitArg = process.argv.find(a => a.startsWith('--kit'));
  const kitValue = kitArg ? process.argv[process.argv.indexOf(kitArg) + 1] : 'all';

  // Define files per kit
  const devkitFiles = [
    'agent.md', '.github/copilot-instructions.md',
    '.github/agents/builder.agent.md', '.github/agents/reviewer.agent.md', '.github/agents/tuner.agent.md',
    '.github/hooks/guardrails.json',
    '.github/prompts/deploy.prompt.md', '.github/prompts/test.prompt.md',
    '.github/prompts/review.prompt.md', '.github/prompts/evaluate.prompt.md',
    '.vscode/mcp.json', '.vscode/settings.json',
    'spec/fai-manifest.json', 'infra/main.bicep', 'infra/parameters.json',
  ];
  const tunekitFiles = [
    'config/openai.json', 'config/guardrails.json', 'config/search.json',
    'config/chunking.json', 'config/agents.json', 'config/model-comparison.json',
    'evaluation/eval.py', 'evaluation/test-set.jsonl',
  ];
  const speckitFiles = [
    'spec/play-spec.json', 'spec/plugin.json', 'spec/CHANGELOG.md', 'spec/README.md', 'spec/fai-manifest.json',
  ];

  let filesToDownload = [];
  if (kitValue === 'devkit') filesToDownload = devkitFiles;
  else if (kitValue === 'tunekit') filesToDownload = tunekitFiles;
  else if (kitValue === 'speckit') filesToDownload = speckitFiles;
  else filesToDownload = [...new Set([...devkitFiles, ...tunekitFiles, ...speckitFiles])];

  // Also try to discover play-specific instructions, skills, workflows from GitHub
  const dynamicFiles = [];
  const playSlug = playDir.replace(/^\d+-/, '');
  dynamicFiles.push(
    `.github/instructions/${playSlug}-patterns.instructions.md`,
    `.github/instructions/azure-coding.instructions.md`,
    `.github/instructions/security.instructions.md`,
    `.github/skills/deploy-${playSlug}/SKILL.md`,
    `.github/skills/evaluate-${playSlug}/SKILL.md`,
    `.github/skills/tune-${playSlug}/SKILL.md`,
    `.github/workflows/${playSlug}-ci-github.yml`,
    `.github/workflows/${playSlug}-review-github.yml`,
  );
  if (kitValue === 'all' || kitValue === 'devkit') {
    filesToDownload.push(...dynamicFiles);
  }

  console.log(`${c.cyan}  Installing: ${c.bold}${playDir}${c.reset}`);
  console.log(`${c.dim}  Kit: ${kitValue} | Files: ${filesToDownload.length}${c.reset}`);
  if (dryRun) console.log(`${c.yellow}  DRY RUN — no files will be written${c.reset}`);
  console.log('');

  const targetDir = process.cwd();
  let downloaded = 0, skipped = 0, failed = 0;

  for (const f of filesToDownload) {
    const url = `https://raw.githubusercontent.com/frootai/frootai/main/solution-plays/${playDir}/${f}`;
    const destPath = join(targetDir, f);

    if (existsSync(destPath)) {
      console.log(`  ${c.dim}⏭  ${f} (exists)${c.reset}`);
      skipped++;
      continue;
    }

    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'FrootAI-CLI' } });
      if (!res.ok) { failed++; continue; }
      const content = await res.text();

      if (!dryRun) {
        const dir = join(targetDir, f.split('/').slice(0, -1).join('/'));
        if (dir !== targetDir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(destPath, content, 'utf-8');
      }
      console.log(`  ${c.green}✅ ${f}${c.reset}`);
      downloaded++;
    } catch {
      failed++;
    }
  }

  // Always write the simple working mcp.json
  if (!dryRun && (kitValue === 'all' || kitValue === 'devkit')) {
    const mcpPath = join(targetDir, '.vscode', 'mcp.json');
    const mcpDir = join(targetDir, '.vscode');
    if (!existsSync(mcpDir)) mkdirSync(mcpDir, { recursive: true });
    writeFileSync(mcpPath, JSON.stringify({ servers: { frootai: { type: 'stdio', command: 'npx', args: ['frootai-mcp@latest'] } } }, null, 2), 'utf-8');
  }

  console.log(`\n  ${c.bold}${c.green}Downloaded: ${downloaded}${c.reset} | ${c.dim}Skipped: ${skipped} | Not found: ${failed}${c.reset}`);
  console.log(`  ${c.dim}Files installed to: ${targetDir}${c.reset}`);

  if (downloaded > 0 && !dryRun) {
    console.log(`\n  ${c.cyan}Next steps:${c.reset}`);
    console.log(`    1. ${c.dim}code .${c.reset}  — Open in VS Code (Copilot auto-reads agent.md)`);
    console.log(`    2. ${c.dim}@builder${c.reset} in Copilot Chat to start implementing`);
    console.log(`    3. ${c.dim}frootai validate --waf${c.reset} to check WAF alignment\n`);
  }
  if (dryRun) console.log(`\n  ${c.yellow}Run without --dry-run to install.${c.reset}\n`);
}

function copyDirRecursive(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

// ═══════════════════════════════════════════════════
// LIST — List available plugins
// ═══════════════════════════════════════════════════
function cmdListPlugins(category) {
  banner();

  const repoRoot = resolve(__dirname, '..');
  const pluginsDir = join(repoRoot, 'plugins');

  if (!existsSync(pluginsDir)) {
    console.log(`${c.red}  Plugins directory not found.${c.reset}\n`);
    process.exit(1);
  }

  const plugins = readdirSync(pluginsDir)
    .filter(f => {
      try { return statSync(join(pluginsDir, f)).isDirectory() && existsSync(join(pluginsDir, f, 'plugin.json')); }
      catch { return false; }
    })
    .map(f => {
      const data = JSON.parse(readFileSync(join(pluginsDir, f, 'plugin.json'), 'utf8'));
      const items = (data.agents || []).length + (data.instructions || []).length +
        (data.skills || []).length + (data.hooks || []).length;
      return { name: data.name, description: data.description, items, plays: data.plays || [], keywords: data.keywords || [] };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Filter by category keyword if provided
  const filtered = category
    ? plugins.filter(p => p.keywords.some(k => k.includes(category.toLowerCase())) || p.name.includes(category.toLowerCase()))
    : plugins;

  console.log(`${c.bold}  FAI Marketplace — ${filtered.length} plugins${category ? ` matching "${category}"` : ''}${c.reset}\n`);

  for (const p of filtered) {
    const playsStr = p.plays.length > 0 ? `${c.cyan}[${p.plays.join(', ')}]${c.reset}` : '';
    console.log(`  ${c.green}${p.name}${c.reset} ${c.dim}(${p.items} items)${c.reset} ${playsStr}`);
    console.log(`    ${c.dim}${p.description.substring(0, 100)}${p.description.length > 100 ? '...' : ''}${c.reset}`);
  }

  console.log(`\n  ${c.bold}Install:${c.reset} frootai install <play-name|play-id> [--kit devkit|tunekit|speckit]`);
  console.log(`  ${c.bold}Filter:${c.reset}  frootai list <keyword>\n`);
}

function cmdHelp() {
  banner();
  console.log(`${c.bold}  Usage:${c.reset} frootai <command> [options]\n`);
  console.log(`${c.bold}  Commands:${c.reset}`);
  console.log(`    ${c.green}init${c.reset}              Interactive project scaffolding`);
  console.log(`    ${c.green}scaffold${c.reset} <play>    One-command play scaffold (e.g. play-01)`);
  console.log(`    ${c.green}install${c.reset} <play>     Download a solution play from GitHub`);
  console.log(`    ${c.green}list${c.reset} [keyword]     Browse all 77 plugins in the FAI Marketplace`);
  console.log(`    ${c.green}search${c.reset} <query>     Search FrootAI knowledge base`);
  console.log(`    ${c.green}cost${c.reset} [play]        Cost estimate (--scale dev|prod)`);
  console.log(`    ${c.green}validate${c.reset}           Check project structure + configs`);
  console.log(`    ${c.green}validate --waf${c.reset}     WAF alignment scorecard (6 pillars)`);
  console.log(`    ${c.green}doctor${c.reset}             Health check for your setup`);
  console.log(`    ${c.green}version${c.reset}            Show version info`);
  console.log(`    ${c.green}help${c.reset}               Show this help\n`);
  console.log(`${c.bold}  Examples:${c.reset}`);
  console.log(`    ${c.dim}npx frootai init${c.reset}`);
  console.log(`    ${c.dim}npx frootai install 01-enterprise-rag${c.reset}`);
  console.log(`    ${c.dim}npx frootai install 01 --kit devkit${c.reset}`);
  console.log(`    ${c.dim}npx frootai install enterprise-rag --dry-run${c.reset}`);
  console.log(`    ${c.dim}npx frootai list azure${c.reset}`);
  console.log(`    ${c.dim}npx frootai scaffold 01-enterprise-rag${c.reset}`);
  console.log(`    ${c.dim}npx frootai search "RAG architecture"${c.reset}`);
  console.log(`    ${c.dim}npx frootai cost enterprise-rag --scale prod${c.reset}`);
  console.log(`    ${c.dim}npx frootai validate --waf${c.reset}`);
  console.log(`    ${c.dim}npx frootai doctor${c.reset}\n`);
  console.log(`  ${c.dim}Docs: https://frootai.dev${c.reset}`);
  console.log(`  ${c.dim}GitHub: https://github.com/frootai/frootai${c.reset}\n`);
}

// ═══════════════════════════════════════════════════
// PRIMITIVES — Browse the 830+ LEGO blocks catalog
// ═══════════════════════════════════════════════════
function cmdPrimitivesCatalog(filter) {
  banner();
  const catalog = [
    { type: "Agents", count: 238, icon: "🤖", path: "agents/", ext: ".agent.md", install: "vscode://github.copilot-chat/createAgent?url=<raw>" },
    { type: "Instructions", count: 176, icon: "📝", path: "instructions/", ext: ".instructions.md", install: "Copy to .github/instructions/" },
    { type: "Skills", count: 322, icon: "🔧", path: "skills/", ext: "/SKILL.md", install: "Copy folder to .github/skills/" },
    { type: "Hooks", count: 10, icon: "🛡️", path: "hooks/", ext: "/hooks.json", install: "Copy folder to .github/hooks/" },
    { type: "Plugins", count: 77, icon: "📦", path: "plugins/", ext: "/plugin.json", install: "npx frootai install <name>" },
    { type: "Workflows", count: 12, icon: "🔄", path: "workflows/", ext: ".md", install: "Copy to .github/workflows/" },
    { type: "Cookbook", count: 16, icon: "📖", path: "cookbook/", ext: ".md", install: "Follow recipe steps" },
  ];

  const total = catalog.reduce((s, c) => s + c.count, 0);
  console.log(`${c.cyan}  FAI Primitives Catalog — ${total}+ LEGO Blocks${c.reset}\n`);
  console.log(`  ${"Type".padEnd(16)} | ${"Count".padEnd(6)} | Install Method`);
  console.log(`  ${"─".repeat(16)}─┼${"─".repeat(7)}┼${"─".repeat(45)}`);

  for (const cat of catalog) {
    if (filter && !cat.type.toLowerCase().includes(filter.toLowerCase())) continue;
    console.log(`  ${cat.icon} ${cat.type.padEnd(14)} | ${String(cat.count).padEnd(6)} | ${c.dim}${cat.install}${c.reset}`);
  }

  console.log(`\n${c.bold}  Total: ${total}+ primitives across 7 categories${c.reset}`);
  console.log(`\n  ${c.dim}FAI Protocol binds these LEGO blocks together:`);
  console.log(`  fai-manifest.json → auto-wires primitives + context + WAF + evaluation`);
  console.log(`  Standalone mode: any primitive works alone`);
  console.log(`  Wired mode: inside a play, shared context propagates automatically${c.reset}`);
  console.log(`\n  ${c.dim}Browse online: https://frootai.dev/primitives${c.reset}\n`);
}

// ═══════════════════════════════════════════════════
// PROTOCOL — FAI Protocol overview
// ═══════════════════════════════════════════════════
function cmdProtocol() {
  banner();
  console.log(`${c.cyan}  FAI Protocol — The Binding Glue${c.reset}\n`);

  const layers = [
    { name: "FAI Protocol", desc: "fai-manifest.json — the specification", icon: "📋" },
    { name: "FAI Layer", desc: "The conceptual binding glue — context wiring", icon: "🔗" },
    { name: "FAI Engine", desc: "Runtime: 7 modules, 42 tests, 12ms load", icon: "⚙️" },
    { name: "FAI Factory", desc: "CI/CD: validate → build → test → publish", icon: "🏭" },
    { name: "FAI Packages", desc: "npm + PyPI + VS Code + Docker", icon: "📦" },
    { name: "FAI Marketplace", desc: "77 plugins, 1,008 items, npx frootai install", icon: "🏪" },
  ];

  for (const layer of layers) {
    console.log(`  ${layer.icon} ${c.bold}${layer.name}${c.reset}`);
    console.log(`     ${c.dim}${layer.desc}${c.reset}\n`);
  }

  console.log(`${c.bold}  Key Files:${c.reset}`);
  console.log(`  ${c.dim}fai-manifest.json${c.reset}  — Full play wiring (context + primitives + infra + toolkit)`);
  console.log(`  ${c.dim}fai-context.json${c.reset}   — Lightweight LEGO block context (WAF + compatible plays)`);
  console.log(`  ${c.dim}7 JSON schemas${c.reset}     — agent, instruction, skill, hook, plugin, manifest, context`);

  console.log(`\n${c.bold}  How It Works:${c.reset}`);
  console.log(`  ${c.dim}1. Create fai-manifest.json in your solution play`);
  console.log(`  2. Reference primitives (agents, skills, hooks)`);
  console.log(`  3. FAI Engine auto-resolves: knowledge → WAF → context → wiring`);
  console.log(`  4. All primitives share context — no manual configuration${c.reset}`);
  console.log(`\n  ${c.dim}Learn more: https://frootai.dev/fai-protocol${c.reset}\n`);
}

// ─── Helpers ───
function writeIfNotExists(filepath, content) {
  if (!existsSync(filepath)) {
    writeFileSync(filepath, content, 'utf8');
  }
}
