#!/usr/bin/env node
/**
 * FrootAI CLI — `npx frootai <command>`
 *
 * Commands:
 *   init                Interactive project scaffolding (alias for scaffold -i)
 *   scaffold <play>     Scaffold a play — downloads from GitHub + generates templates
 *   install <play>      Download play files into current directory
 *   deploy              Deploy infra/main.bicep to Azure (guided wizard)
 *   info <play>         Show play details, cost, and architecture
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
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const VERSION = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8')).version;
const KNOWLEDGE = require('frootai-mcp/knowledge.json');

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

// ─── String similarity (Levenshtein-based) ───
function similarity(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  if (a === b) return 1;
  const len = Math.max(a.length, b.length);
  if (!len) return 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => {
    const row = Array(b.length + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] !== b[j-1] ? 1 : 0));
  return 1 - d[a.length][b.length] / len;
}

function banner() {
  console.log(`
${c.green}  🌳 FrootAI™ CLI v${VERSION}${c.reset}
${c.dim}  From the Roots to the Fruits${c.reset}
`);
}

// ─── Shared Play Index ───
const ALL_PLAYS = [
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

function resolvePlay(input) {
  if (!input) return null;
  const exact = ALL_PLAYS.find(p => p === input);
  if (exact) return exact;
  const num = input.replace(/^play-?/i, '').replace(/^0*(\d+)/, (_, d) => d);
  const padded = num.padStart(2, '0');
  const numMatch = ALL_PLAYS.find(p => p.startsWith(padded + '-'));
  if (numMatch) return numMatch;
  const slug = input.toLowerCase().replace(/\s+/g, '-');
  return ALL_PLAYS.find(p => p.includes(slug)) || null;
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
  case 'info':
    await cmdInfo(args[1]);
    break;
  case 'deploy':
    await cmdDeploy(args[1]);
    break;
  case 'diff':
    await cmdDiff();
    break;
  case 'update':
    await cmdUpdate();
    break;
  case 'validate':
    cmdValidate();
    break;
  case 'doctor':
    cmdDoctor();
    break;
  case 'status':
    cmdStatus();
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
    console.log(`  frootai     v${VERSION}`);
    try {
      const mcpPkg = require('frootai-mcp/package.json');
      console.log(`  frootai-mcp v${mcpPkg.version}`);
    } catch { /* frootai-mcp not resolvable */ }
    console.log(`  node        ${process.version}`);
    console.log(`  platform    ${process.platform} ${process.arch}`);
    break;
  case 'help':
  case '--help':
  case '-h':
  case undefined:
    cmdHelp();
    break;
  default: {
    const commands = ['init', 'scaffold', 'install', 'deploy', 'info', 'list', 'search', 'cost', 'validate', 'doctor', 'status', 'update', 'version', 'help', 'primitives', 'protocol', 'diff'];
    const suggestion = commands
      .map(cmd => ({ cmd, score: similarity(command, cmd) }))
      .sort((a, b) => b.score - a.score)[0];
    console.log(`\n  ${c.red}Unknown command: ${command}${c.reset}`);
    if (suggestion.score > 0.4) {
      console.log(`  ${c.dim}Did you mean ${c.cyan}frootai ${suggestion.cmd}${c.dim}?${c.reset}\n`);
    } else {
      console.log(`  ${c.dim}Run ${c.cyan}frootai help${c.dim} to see all commands.${c.reset}\n`);
    }
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════
// INIT — Interactive project scaffolding (delegates to scaffold -i)
// ═══════════════════════════════════════════════════
async function cmdInit() {
  // init is just scaffold in interactive mode
  args.push('--interactive');
  await cmdScaffold(null);
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
// INFO — Show detailed play information
// ═══════════════════════════════════════════════════
async function cmdInfo(playInput) {
  banner();

  if (!playInput) {
    console.log(`${c.red}  Error: Play name or ID required.${c.reset}`);
    console.log(`${c.dim}  Usage: frootai info <play-name|play-id>${c.reset}`);
    console.log(`${c.dim}  Examples: frootai info 01  |  frootai info enterprise-rag${c.reset}\n`);
    process.exit(1);
  }

  const playDir = resolvePlay(playInput);
  if (!playDir) {
    console.log(`${c.red}  Play not found: ${playInput}${c.reset}`);
    console.log(`${c.dim}  Try: frootai info 01 or frootai info enterprise-rag${c.reset}\n`);
    process.exit(1);
  }

  const playNum = playDir.split('-')[0];
  const playName = playDir.replace(/^\d+-/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    .replace(/\bAi\b/g, 'AI').replace(/\bRag\b/g, 'RAG').replace(/\bAks\b/g, 'AKS')
    .replace(/\bMcp\b/g, 'MCP').replace(/\bApi\b/g, 'API').replace(/\bIt\b/g, 'IT')
    .replace(/\bEsg\b/g, 'ESG').replace(/\bIac\b/g, 'IaC').replace(/\bSdk\b/g, 'SDK')
    .replace(/\bV2\b/g, 'v2').replace(/\bPhi4\b/g, 'Phi-4').replace(/\bFai\b/g, 'FAI');

  const ghBase = `https://raw.githubusercontent.com/frootai/frootai/main/solution-plays/${playDir}`;
  const ghPage = `https://github.com/frootai/frootai/tree/main/solution-plays/${playDir}`;
  const webPage = `https://frootai.dev/solution-plays/${playDir}`;

  // Header
  console.log(`  ${c.bold}${c.cyan}Play ${playNum} — ${playName}${c.reset}`);
  console.log(`  ${'─'.repeat(50)}`);

  // Fetch README first line (description)
  try {
    const readmeRes = await fetch(`${ghBase}/README.md`, { headers: { 'User-Agent': 'FrootAI-CLI' } });
    if (readmeRes.ok) {
      const readme = await readmeRes.text();
      const lines = readme.split('\n').filter(l => l.trim() && !l.startsWith('#'));
      const desc = lines.find(l => l.startsWith('>'));
      const detail = lines.find(l => !l.startsWith('>') && !l.startsWith('```') && l.length > 20);
      if (desc) console.log(`\n  ${c.dim}${desc.replace(/^>\s*/, '')}${c.reset}`);
      if (detail) console.log(`  ${detail.trim()}`);
    }
  } catch { /* offline fallback below */ }

  // Fetch cost.json for real pricing
  let costData = null;
  try {
    const costRes = await fetch(`${ghBase}/cost.json`, { headers: { 'User-Agent': 'FrootAI-CLI' } });
    if (costRes.ok) costData = await costRes.json();
  } catch { /* offline */ }

  if (costData) {
    console.log(`\n  ${c.bold}Cost Estimate${c.reset}  ${c.dim}(monthly, USD)${c.reset}\n`);
    console.log(`  ${'Service'.padEnd(28)} | ${'Dev'.padEnd(12)} | ${'Prod'.padEnd(12)} | Enterprise`);
    console.log(`  ${'─'.repeat(28)}─┼${'─'.repeat(13)}┼${'─'.repeat(13)}┼${'─'.repeat(13)}`);

    let devTotal = 0, prodTotal = 0, entTotal = 0;
    for (const svc of costData.services) {
      const dev = svc.tiers?.dev?.cost ?? '—';
      const prod = svc.tiers?.prod?.cost ?? '—';
      const ent = svc.tiers?.enterprise?.cost ?? '—';
      if (typeof dev === 'number') devTotal += dev;
      if (typeof prod === 'number') prodTotal += prod;
      if (typeof ent === 'number') entTotal += ent;
      const fmtDev = typeof dev === 'number' ? `$${dev}` : dev;
      const fmtProd = typeof prod === 'number' ? `$${prod}` : prod;
      const fmtEnt = typeof ent === 'number' ? `$${ent}` : ent;
      console.log(`  ${svc.name.padEnd(28)} | ${fmtDev.padEnd(12)} | ${fmtProd.padEnd(12)} | ${fmtEnt}`);
    }
    console.log(`  ${'─'.repeat(28)}─┼${'─'.repeat(13)}┼${'─'.repeat(13)}┼${'─'.repeat(13)}`);
    console.log(`  ${c.bold}${'TOTAL'.padEnd(28)}${c.reset} | ${c.bold}${'$' + devTotal}${c.reset}${' '.repeat(Math.max(0, 12 - ('$' + devTotal).length))} | ${c.bold}${'$' + prodTotal}${c.reset}${' '.repeat(Math.max(0, 12 - ('$' + prodTotal).length))} | ${c.bold}${'$' + entTotal}${c.reset}`);

    if (costData.optimization_tips?.length > 0) {
      console.log(`\n  ${c.yellow}💡 Tips:${c.reset}`);
      costData.optimization_tips.slice(0, 3).forEach(t => console.log(`  ${c.dim}  • ${t}${c.reset}`));
    }
  }

  // Key services
  if (costData?.services) {
    const cats = [...new Set(costData.services.map(s => s.category))];
    console.log(`\n  ${c.bold}Azure Services${c.reset}  ${c.dim}(${costData.services.length} total)${c.reset}`);
    for (const cat of cats) {
      const svcs = costData.services.filter(s => s.category === cat);
      console.log(`  ${c.cyan}${cat}:${c.reset} ${svcs.map(s => s.name).join(', ')}`);
    }
  }

  // Links
  console.log(`\n  ${c.bold}Links${c.reset}`);
  console.log(`  ${c.dim}GitHub:${c.reset}       ${ghPage}`);
  console.log(`  ${c.dim}Architecture:${c.reset} ${ghPage}/architecture.md`);
  console.log(`  ${c.dim}Web:${c.reset}          ${webPage}`);

  // Quick actions
  console.log(`\n  ${c.bold}Quick Start${c.reset}`);
  console.log(`  ${c.green}npx frootai install ${playDir}${c.reset}           ${c.dim}# Download all files${c.reset}`);
  console.log(`  ${c.green}npx frootai install ${playDir} --kit devkit${c.reset}  ${c.dim}# DevKit only${c.reset}`);
  console.log(`  ${c.green}npx frootai cost ${playDir}${c.reset}              ${c.dim}# Detailed cost${c.reset}\n`);
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
    const mcpLatest = execSync('npm view frootai-mcp version', { encoding: 'utf8', timeout: 10000 }).trim();
    console.log(`  ${c.green}✅${c.reset} frootai-mcp@${mcpLatest} on npm`);
  } catch (e) {
    console.log(`  ${c.yellow}⚠️${c.reset}  Could not reach npm registry`);
  }

  // CLI package on npm
  try {
    const cliLatest = execSync('npm view frootai version', { encoding: 'utf8', timeout: 10000 }).trim();
    const upToDate = cliLatest === VERSION;
    if (upToDate) {
      console.log(`  ${c.green}✅${c.reset} frootai@${VERSION} (latest)`);
    } else {
      console.log(`  ${c.yellow}⚠️${c.reset}  frootai@${VERSION} installed — ${cliLatest} available (run: npm i -g frootai@latest)`);
    }
  } catch (e) {
    console.log(`  ${c.yellow}⚠️${c.reset}  Could not check frootai version on npm`);
  }

  console.log('');
}

// ═══════════════════════════════════════════════════
// SCAFFOLD — One-command play scaffold
// ═══════════════════════════════════════════════════
async function cmdScaffold(playArg) {
  banner();

  // ─── Parse flags ───
  const kitIdx = args.indexOf('--kit');
  const kitValue = kitIdx !== -1 ? args[kitIdx + 1] : 'all';
  const dryRun = args.includes('--dry-run');
  const interactive = args.includes('--interactive') || args.includes('-i');

  // ─── Resolve play (interactive if no arg) ───
  let playDir = playArg ? resolvePlay(playArg) : null;

  if (!playDir && !interactive) {
    // No play arg and not interactive — show usage
    if (!playArg) {
      console.log(`${c.cyan}  Scaffold a new FrootAI project from any of 101 solution plays.${c.reset}`);
      console.log(`${c.dim}  Downloads real play files from GitHub, generates templates for the rest.\n${c.reset}`);
      console.log(`${c.bold}  Usage:${c.reset}`);
      console.log(`    ${c.green}frootai scaffold <play>${c.reset}                    Full scaffold`);
      console.log(`    ${c.green}frootai scaffold <play> --kit devkit${c.reset}        DevKit only`);
      console.log(`    ${c.green}frootai scaffold <play> --kit tunekit${c.reset}       TuneKit only`);
      console.log(`    ${c.green}frootai scaffold <play> --kit speckit${c.reset}       SpecKit only`);
      console.log(`    ${c.green}frootai scaffold <play> --dry-run${c.reset}           Preview only`);
      console.log(`    ${c.green}frootai scaffold -i${c.reset}                         Interactive mode\n`);
      console.log(`${c.bold}  Examples:${c.reset}`);
      console.log(`    ${c.dim}frootai scaffold 01-enterprise-rag${c.reset}`);
      console.log(`    ${c.dim}frootai scaffold 01${c.reset}`);
      console.log(`    ${c.dim}frootai scaffold enterprise-rag${c.reset}\n`);
      return;
    }
    console.log(`${c.red}  Play not found: ${playArg}${c.reset}`);
    console.log(`${c.dim}  Try: frootai scaffold 01 or frootai scaffold enterprise-rag${c.reset}\n`);
    return;
  }

  // ─── Interactive mode ───
  let projectName, selectedKits;
  if (interactive || !playDir) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise(r => rl.question(q, r));

    // Q1: Pick a play category
    console.log(`${c.bold}  What are you building?${c.reset}`);
    console.log(`${c.dim}  1) Enterprise RAG (document Q&A, knowledge base)`);
    console.log(`  2) AI Agent (multi-step reasoning, tool calling)`);
    console.log(`  3) AI Gateway (API management, cost control)`);
    console.log(`  4) Content Moderation (safety, compliance)`);
    console.log(`  5) Multi-modal (vision, document intelligence)`);
    console.log(`  6) Custom (browse all 101 plays)${c.reset}\n`);
    const scenario = await ask(`${c.green}  Choose [1-6]: ${c.reset}`);
    const quickMap = { '1': '01-enterprise-rag', '2': '03-deterministic-agent', '3': '14-cost-optimized-ai-gateway', '4': '10-content-moderation', '5': '15-multi-modal-docproc' };
    playDir = quickMap[scenario];

    if (scenario === '6' || !playDir) {
      console.log(`\n${c.bold}  Top 20 plays:${c.reset}`);
      ALL_PLAYS.slice(0, 20).forEach((p, i) => console.log(`${c.dim}  ${String(i + 1).padStart(2)}) ${p}${c.reset}`));
      console.log(`${c.dim}  ...or type a play number/name (e.g., 28 or knowledge-graph)${c.reset}`);
      const choice = await ask(`\n${c.green}  Play: ${c.reset}`);
      const idx = parseInt(choice);
      playDir = (idx >= 1 && idx <= 20) ? ALL_PLAYS[idx - 1] : resolvePlay(choice);
      if (!playDir) { console.log(`${c.red}  Play not found.${c.reset}`); rl.close(); return; }
    }

    // Q2: Which kits?
    console.log(`\n${c.bold}  Which kits to include?${c.reset}`);
    console.log(`${c.dim}  1) All (DevKit + TuneKit + SpecKit)  ${c.green}← recommended${c.reset}`);
    console.log(`${c.dim}  2) DevKit only (agents, instructions, MCP config)`);
    console.log(`  3) TuneKit only (AI configs, evaluation)`);
    console.log(`  4) SpecKit only (metadata, manifest)${c.reset}\n`);
    const kitChoice = await ask(`${c.green}  Choose [1-4]: ${c.reset}`);
    selectedKits = { '2': 'devkit', '3': 'tunekit', '4': 'speckit' }[kitChoice] || 'all';

    // Q3: Project name
    const defaultName = playDir;
    projectName = await ask(`\n${c.green}  Project directory [${defaultName}]: ${c.reset}`) || defaultName;
    rl.close();
  } else {
    // Non-interactive: use play name as project dir
    projectName = playDir;
    selectedKits = kitValue;
  }

  console.log(`\n${c.cyan}  Scaffolding: ${c.bold}${playDir}${c.reset}`);
  console.log(`${c.dim}  Directory: ./${projectName}  |  Kits: ${selectedKits}${c.reset}`);
  if (dryRun) console.log(`${c.yellow}  DRY RUN — no files will be written${c.reset}`);
  console.log('');

  // ─── Create project directory ───
  const projectDir = resolve(projectName);
  if (!dryRun) {
    if (existsSync(projectDir)) {
      console.log(`${c.yellow}  ⚠  Directory exists — merging files (won't overwrite)${c.reset}\n`);
    } else {
      mkdirSync(projectDir, { recursive: true });
    }
  }

  // ─── Phase 1: Download REAL files from GitHub ───
  console.log(`  ${c.bold}Phase 1: Downloading play files from GitHub...${c.reset}`);

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

  // Dynamic files (play-specific instructions/skills/workflows)
  const playSlug = playDir.replace(/^\d+-/, '');
  const dynamicDevkitFiles = [
    `.github/instructions/${playSlug}-patterns.instructions.md`,
    `.github/instructions/azure-coding.instructions.md`,
    `.github/instructions/security.instructions.md`,
    `.github/skills/deploy-${playSlug}/SKILL.md`,
    `.github/skills/evaluate-${playSlug}/SKILL.md`,
    `.github/skills/tune-${playSlug}/SKILL.md`,
    `.github/workflows/${playSlug}-ci-github.yml`,
    `.github/workflows/${playSlug}-review-github.yml`,
  ];

  let filesToDownload = [];
  if (selectedKits === 'devkit') filesToDownload = [...devkitFiles, ...dynamicDevkitFiles];
  else if (selectedKits === 'tunekit') filesToDownload = tunekitFiles;
  else if (selectedKits === 'speckit') filesToDownload = speckitFiles;
  else filesToDownload = [...new Set([...devkitFiles, ...dynamicDevkitFiles, ...tunekitFiles, ...speckitFiles])];

  let downloaded = 0, ghSkipped = 0, ghMissing = 0;
  const downloadedFiles = new Set();

  for (const f of filesToDownload) {
    const destPath = join(projectDir, f);
    if (!dryRun && existsSync(destPath)) {
      ghSkipped++;
      continue;
    }
    const url = `https://raw.githubusercontent.com/frootai/frootai/main/solution-plays/${playDir}/${f}`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'FrootAI-CLI' } });
      if (!res.ok) { ghMissing++; continue; }
      const content = await res.text();
      if (!dryRun) {
        const dir = dirname(destPath);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(destPath, content, 'utf-8');
      }
      console.log(`    ${c.green}✅ ${f}${c.reset}`);
      downloaded++;
      downloadedFiles.add(f);
    } catch { ghMissing++; }
  }

  console.log(`${c.dim}    GitHub: ${downloaded} downloaded, ${ghSkipped} skipped, ${ghMissing} not on GitHub${c.reset}\n`);

  // ─── Phase 2: Generate templates for missing files ───
  console.log(`  ${c.bold}Phase 2: Generating templates for missing files...${c.reset}`);
  let generated = 0;

  function generateIfMissing(relPath, content) {
    if (downloadedFiles.has(relPath)) return;
    const destPath = join(projectDir, relPath);
    if (!dryRun && existsSync(destPath)) return;
    if (!dryRun) {
      const dir = dirname(destPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(destPath, content, 'utf-8');
    }
    console.log(`    ${c.yellow}📝 ${relPath}${c.dim} (generated)${c.reset}`);
    generated++;
  }

  const playNum = playDir.split('-')[0];
  const playTitle = playDir.replace(/^\d+-/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  // MCP config (always golden standard)
  if (selectedKits === 'all' || selectedKits === 'devkit') {
    generateIfMissing('.vscode/mcp.json', JSON.stringify({
      servers: { frootai: { type: 'stdio', command: 'npx', args: ['-y', 'frootai-mcp@latest'] } }
    }, null, 2));

    generateIfMissing('.github/copilot-instructions.md', `# Play ${playNum}: ${playTitle}\n\n## Architecture\nThis project implements the ${playTitle} pattern.\nRefer to config/*.json for AI model settings and guardrails.\n\n## Agent Workflow\n1. **@builder** — Implement features following architecture patterns\n2. **@reviewer** — Review for security, WAF alignment, production readiness\n3. **@tuner** — Validate configs + evaluation thresholds\n`);

    generateIfMissing('.github/agents/builder.agent.md', `---\ndescription: "Builder agent for ${playTitle} — implements features following FrootAI architecture patterns"\ntools:\n  - frootai\n---\n# Builder Agent — ${playTitle}\n\nYou are a builder agent for Play ${playNum}: ${playTitle}.\nUse the FrootAI MCP server for architecture patterns, cost estimates, and best practices.\nFollow config/ values. Check architecture.md for the system design.\n`);

    generateIfMissing('.github/agents/reviewer.agent.md', `---\ndescription: "Reviewer agent — reviews code for security, quality, Azure WAF best practices"\ntools:\n  - frootai\n---\n# Reviewer Agent\n\nReview all code changes against:\n- Security (OWASP LLM Top 10)\n- Azure Well-Architected Framework (6 pillars)\n- Config compliance (config/*.json)\n- Content safety and responsible AI\n`);

    generateIfMissing('.github/agents/tuner.agent.md', `---\ndescription: "Tuner agent — validates configs, runs evaluations, checks WAF alignment"\ntools:\n  - frootai\n---\n# Tuner Agent\n\nValidate:\n- config/*.json values are production-appropriate\n- Evaluation thresholds are met (groundedness ≥ 4.0)\n- WAF alignment: run \\\`npx frootai validate --waf\\\`\n- Cost estimates are within budget: run \\\`npx frootai cost ${playNum}\\\`\n`);

    generateIfMissing('agent.md', `---\ndescription: "Root orchestrator for Play ${playNum}: ${playTitle}"\ntools:\n  - frootai\n---\n# ${playTitle}\n\nThis is the root agent for Solution Play ${playNum}: ${playTitle}.\n\n## Workflow\n1. @builder — Implement the solution\n2. @reviewer — Review for security + WAF\n3. @tuner — Validate configs + evaluation\n\n## Quick Commands\n- \\\`npx frootai info ${playNum}\\\` — Play overview + cost\n- \\\`npx frootai validate --waf\\\` — WAF scorecard\n`);

    // WAF instructions
    generateIfMissing('.github/instructions/waf-security.instructions.md', `---\napplyTo: "**/*.{ts,js,py,bicep,json}"\n---\n# Security\n- Use Managed Identity for all Azure service auth\n- Store secrets in Azure Key Vault\n- Enable content safety on all AI endpoints\n- Validate and sanitize all user inputs\n`);
    generateIfMissing('.github/instructions/waf-reliability.instructions.md', `---\napplyTo: "**/*.{ts,js,py,bicep,json}"\n---\n# Reliability\n- Retry all external API calls (3 retries, exponential backoff)\n- Expose /health endpoint on every service\n- Gracefully degrade when AI endpoints are unavailable\n`);
  }

  if (selectedKits === 'all' || selectedKits === 'tunekit') {
    generateIfMissing('config/openai.json', JSON.stringify({
      model: 'gpt-4o-mini', temperature: 0.1, max_tokens: 4096, api_version: '2025-01-01-preview'
    }, null, 2));
    generateIfMissing('config/guardrails.json', JSON.stringify({
      max_tokens_per_request: 4096, blocked_categories: ['hate', 'violence', 'self-harm', 'sexual'],
      pii_detection: true, grounding_check: true
    }, null, 2));
    generateIfMissing('config/search.json', JSON.stringify({
      service: 'azure-ai-search', index: `${playDir}-index`, semantic_config: 'default', top_k: 5, min_score: 0.75
    }, null, 2));
    generateIfMissing('evaluation/eval-config.json', JSON.stringify({
      metrics: ['groundedness', 'relevance', 'coherence', 'fluency'],
      thresholds: { groundedness: 4.0, relevance: 4.0, coherence: 4.0, fluency: 4.0 },
      dataset: 'evaluation/test-data.jsonl'
    }, null, 2));
  }

  if (selectedKits === 'all' || selectedKits === 'speckit') {
    generateIfMissing('spec/play-spec.json', JSON.stringify({
      name: playDir, version: '0.1.0', play: playDir,
      architecture: { pattern: playDir.includes('rag') ? 'rag' : playDir.includes('agent') ? 'agent' : 'custom' },
      waf_alignment: {
        reliability: { score: 0, status: 'unchecked' }, security: { score: 0, status: 'unchecked' },
        cost_optimization: { score: 0, status: 'unchecked' }, operational_excellence: { score: 0, status: 'unchecked' },
        performance_efficiency: { score: 0, status: 'unchecked' }, responsible_ai: { score: 0, status: 'unchecked' },
      },
    }, null, 2));
  }

  // Always generate README + .gitignore + froot.json
  if (selectedKits === 'all') {
    generateIfMissing('README.md', `# ${playTitle}\n\n> Built with [FrootAI](https://frootai.dev) — Solution Play ${playNum}\n\n## Quick Start\n\n\`\`\`bash\ncode .                             # MCP auto-connects\n@builder Build the main entry point  # In Copilot Chat\nnpx frootai validate --waf          # Check WAF alignment\n\`\`\`\n\n## Project Structure\n\n| Path | Kit | Purpose |\n|------|-----|---------|\n| \`.github/agents/\` | DevKit | Builder, Reviewer, Tuner agents |\n| \`config/\` | TuneKit | OpenAI, guardrails, search configs |\n| \`evaluation/\` | TuneKit | Quality thresholds + test data |\n| \`spec/\` | SpecKit | Architecture spec + WAF alignment |\n| \`infra/\` | Infra | Bicep templates |\n\n## Commands\n\n\`\`\`bash\nnpx frootai info ${playNum}            # Play details + cost\nnpx frootai validate --waf     # WAF scorecard\nnpx frootai search "query"     # Search knowledge base\nnpx frootai cost ${playNum}            # Cost estimate\n\`\`\`\n\n## Links\n- [FrootAI](https://frootai.dev) | [npm](https://www.npmjs.com/package/frootai-mcp) | [GitHub](https://github.com/frootai/frootai)\n`);

    generateIfMissing('.gitignore', `node_modules/\n.env\n.env.local\n*.log\ndist/\nbuild/\n.DS_Store\n__pycache__/\n`);

    generateIfMissing('froot.json', JSON.stringify({
      frootai: VERSION, play: playDir,
      kits: {
        devkit: { files: ['.github/agents/', '.github/instructions/', '.github/copilot-instructions.md', '.vscode/mcp.json'] },
        tunekit: { files: ['config/', 'evaluation/'] },
        speckit: { files: ['spec/'] },
      },
      waf: true,
    }, null, 2));
  }

  console.log(`${c.dim}    Templates: ${generated} generated${c.reset}\n`);

  // ─── Summary ───
  const total = downloaded + generated;
  console.log(`  ${c.bold}${c.green}✅ Scaffold complete: ${playDir}${c.reset}`);
  console.log(`  ${c.dim}Directory: ./${projectName}${c.reset}`);
  console.log(`  ${c.green}${downloaded} from GitHub${c.reset} + ${c.yellow}${generated} generated${c.reset} = ${c.bold}${total} files${c.reset}\n`);

  if (!dryRun && total > 0) {
    console.log(`${c.cyan}  ┌──────────────────────────────────────────────────────┐${c.reset}`);
    console.log(`${c.cyan}  │  🌳 Welcome to FrootAI!                              │${c.reset}`);
    console.log(`${c.cyan}  │                                                      │${c.reset}`);
    console.log(`${c.cyan}  │  Next steps:                                         │${c.reset}`);
    console.log(`${c.cyan}  │    ${c.green}cd ${projectName.length > 30 ? projectName.slice(0, 27) + '...' : projectName.padEnd(30)}${c.cyan}                  │${c.reset}`);
    console.log(`${c.cyan}  │    ${c.green}code .${c.cyan}              ← MCP auto-connects          │${c.reset}`);
    console.log(`${c.cyan}  │    ${c.green}@builder${c.cyan}            ← Start building in Copilot  │${c.reset}`);
    console.log(`${c.cyan}  │    ${c.green}@tuner${c.cyan}              ← Validate WAF + configs     │${c.reset}`);
    console.log(`${c.cyan}  │                                                      │${c.reset}`);
    console.log(`${c.cyan}  │  It's simply Frootful. 🌱                            │${c.reset}`);
    console.log(`${c.cyan}  └──────────────────────────────────────────────────────┘${c.reset}\n`);
  }
  if (dryRun) console.log(`  ${c.yellow}Run without --dry-run to scaffold.${c.reset}\n`);
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
  const playDir = resolvePlay(playInput);
  if (!playDir) {
    console.log(`${c.red}  Play not found: ${playInput}${c.reset}`);
    console.log(`${c.dim}  Try: frootai install 01 or frootai install enterprise-rag${c.reset}\n`);
    process.exit(1);
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
    writeFileSync(mcpPath, JSON.stringify({ servers: { frootai: { type: 'stdio', command: 'npx', args: ['-y', 'frootai-mcp@latest'] } } }, null, 2), 'utf-8');
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

// ═══════════════════════════════════════════════════
// DEPLOY — Guided Azure deployment from infra/ Bicep
// ═══════════════════════════════════════════════════
async function cmdDeploy(playArg) {
  banner();
  const dryRun = args.includes('--dry-run');
  const skipConfirm = args.includes('--yes') || args.includes('-y');

  // ── Step 1: Detect infra files ────────────────────────────────
  const cwd = process.cwd();
  let infraDir = join(cwd, 'infra');
  let bicepFile = join(infraDir, 'main.bicep');
  let paramsFile = join(infraDir, 'parameters.json');

  // If user provided a play argument, try to find it in solution-plays
  if (playArg && playArg !== '--dry-run' && playArg !== '--yes' && playArg !== '-y') {
    const playDir = resolvePlay(playArg);
    if (playDir) {
      // Check if play files exist locally (user did install/scaffold first)
      if (!existsSync(bicepFile)) {
        console.log(`  ${c.yellow}⚠${c.reset}  No infra/ folder found in current directory.`);
        console.log(`  ${c.dim}Run ${c.cyan}frootai install ${playDir} --kit devkit${c.reset}${c.dim} first, or cd into your project.${c.reset}\n`);
        process.exit(1);
      }
    } else {
      console.log(`  ${c.red}✗${c.reset}  Play "${playArg}" not found.\n`);
      process.exit(1);
    }
  }

  if (!existsSync(bicepFile)) {
    console.log(`  ${c.red}✗${c.reset}  No ${c.cyan}infra/main.bicep${c.reset} found in current directory.`);
    console.log(`  ${c.dim}Make sure you're in a FrootAI project directory with an infra/ folder.${c.reset}`);
    console.log(`  ${c.dim}Or run: ${c.cyan}frootai scaffold <play>${c.reset}${c.dim} to create one.${c.reset}\n`);
    process.exit(1);
  }

  console.log(`  ${c.green}✓${c.reset}  Found ${c.cyan}infra/main.bicep${c.reset}`);
  if (existsSync(paramsFile)) {
    console.log(`  ${c.green}✓${c.reset}  Found ${c.cyan}infra/parameters.json${c.reset}`);
  } else {
    console.log(`  ${c.yellow}⚠${c.reset}  No parameters.json — deploying with defaults`);
    paramsFile = null;
  }

  // ── Step 2: Check Azure CLI ───────────────────────────────────
  let azVersion;
  try {
    azVersion = execSync('az version --output tsv 2>&1', { encoding: 'utf8', timeout: 15000 }).trim().split('\n')[0];
    console.log(`  ${c.green}✓${c.reset}  Azure CLI found (${c.dim}${azVersion.substring(0, 30)}${c.reset})`);
  } catch {
    console.log(`\n  ${c.red}✗${c.reset}  Azure CLI (${c.cyan}az${c.reset}) not found.`);
    console.log(`  ${c.dim}Install: https://aka.ms/installazurecli${c.reset}\n`);
    process.exit(1);
  }

  // Check login status
  let account;
  try {
    account = JSON.parse(execSync('az account show --output json 2>&1', { encoding: 'utf8', timeout: 15000 }));
    console.log(`  ${c.green}✓${c.reset}  Logged in as ${c.cyan}${account.user?.name || 'unknown'}${c.reset}`);
    console.log(`  ${c.dim}   Subscription: ${account.name} (${account.id})${c.reset}`);
  } catch {
    console.log(`\n  ${c.yellow}⚠${c.reset}  Not logged in to Azure.`);
    console.log(`  ${c.dim}Run: ${c.cyan}az login${c.reset}\n`);
    process.exit(1);
  }

  // ── Step 3: Parse Bicep parameters for display ────────────────
  let existingParams = {};
  if (paramsFile) {
    try {
      const p = JSON.parse(readFileSync(paramsFile, 'utf8'));
      existingParams = p.parameters || {};
    } catch { /* ignore parse errors */ }
  }

  const envParam = existingParams.environment?.value || 'dev';
  const locationParam = existingParams.location?.value || 'eastus2';
  const projectParam = existingParams.projectName?.value || existingParams.prefix?.value || 'frootai';

  // ── Step 4: Interactive prompts ───────────────────────────────
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(r => rl.question(q, r));

  let resourceGroup, location, environment;

  console.log(`\n${c.bold}  Deployment Configuration${c.reset}\n`);

  // Resource group
  const defaultRg = `rg-${projectParam}-${envParam}`;
  if (skipConfirm || dryRun) {
    resourceGroup = args.includes('--resource-group') ? args[args.indexOf('--resource-group') + 1] : defaultRg;
    location = args.includes('--location') ? args[args.indexOf('--location') + 1] : locationParam;
    environment = args.includes('--env') ? args[args.indexOf('--env') + 1] : envParam;
  } else {
    resourceGroup = await ask(`  ${c.cyan}Resource group${c.reset} [${c.dim}${defaultRg}${c.reset}]: `);
    resourceGroup = resourceGroup.trim() || defaultRg;

    location = await ask(`  ${c.cyan}Location${c.reset} [${c.dim}${locationParam}${c.reset}]: `);
    location = location.trim() || locationParam;

    environment = await ask(`  ${c.cyan}Environment${c.reset} (dev/staging/prod) [${c.dim}${envParam}${c.reset}]: `);
    environment = environment.trim() || envParam;
  }

  // ── Step 5: Show deployment plan ──────────────────────────────
  console.log(`\n${c.bold}  Deployment Plan${c.reset}`);
  console.log(`  ─────────────────────────────────────────`);
  console.log(`  ${c.cyan}Subscription:${c.reset}   ${account.name}`);
  console.log(`  ${c.cyan}Resource Group:${c.reset} ${resourceGroup}`);
  console.log(`  ${c.cyan}Location:${c.reset}       ${location}`);
  console.log(`  ${c.cyan}Environment:${c.reset}    ${environment}`);
  console.log(`  ${c.cyan}Bicep:${c.reset}          infra/main.bicep`);
  if (paramsFile) {
    console.log(`  ${c.cyan}Parameters:${c.reset}     infra/parameters.json`);
  }
  console.log(`  ─────────────────────────────────────────`);

  if (dryRun) {
    console.log(`\n  ${c.yellow}DRY RUN${c.reset} — no deployment will be executed.\n`);
    rl.close();
    return;
  }

  // ── Step 6: Confirm ───────────────────────────────────────────
  if (!skipConfirm) {
    const confirm = await ask(`\n  ${c.yellow}Deploy to Azure?${c.reset} (y/N): `);
    if (!confirm.trim().toLowerCase().startsWith('y')) {
      console.log(`  ${c.dim}Deployment cancelled.${c.reset}\n`);
      rl.close();
      return;
    }
  }
  rl.close();

  // ── Step 7: Create resource group if needed ───────────────────
  console.log(`\n  ${c.cyan}▸${c.reset} Ensuring resource group ${c.bold}${resourceGroup}${c.reset} exists...`);
  try {
    execSync(`az group create --name "${resourceGroup}" --location "${location}" --output none 2>&1`, {
      encoding: 'utf8', timeout: 30000
    });
    console.log(`  ${c.green}✓${c.reset} Resource group ready`);
  } catch (e) {
    console.log(`  ${c.red}✗${c.reset} Failed to create resource group: ${e.message?.split('\n')[0] || 'Unknown error'}`);
    console.log(`  ${c.dim}Check your subscription permissions.${c.reset}\n`);
    process.exit(1);
  }

  // ── Step 8: Run Bicep deployment ──────────────────────────────
  const deployName = `frootai-${Date.now()}`;
  let azCmd = `az deployment group create --name "${deployName}" --resource-group "${resourceGroup}" --template-file "${bicepFile}"`;
  if (paramsFile) {
    azCmd += ` --parameters "@${paramsFile}"`;
  }
  // Override environment and location if user changed them
  azCmd += ` --parameters environment="${environment}" location="${location}"`;
  azCmd += ' --output json';

  console.log(`  ${c.cyan}▸${c.reset} Deploying Bicep template...\n`);
  console.log(`  ${c.dim}$ ${azCmd.replace(bicepFile, 'infra/main.bicep').replace(paramsFile || '', 'infra/parameters.json')}${c.reset}\n`);

  const startTime = Date.now();

  // Use spawn for live output streaming
  const { spawn } = await import('child_process');

  const proc = spawn('az', [
    'deployment', 'group', 'create',
    '--name', deployName,
    '--resource-group', resourceGroup,
    '--template-file', bicepFile,
    ...(paramsFile ? ['--parameters', `@${paramsFile}`] : []),
    '--parameters', `environment=${environment}`, `location=${location}`,
    '--output', 'json',
    '--no-prompt'
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32'
  });

  let stdout = '';
  let stderr = '';
  proc.stdout.on('data', d => { stdout += d.toString(); });
  proc.stderr.on('data', d => {
    const line = d.toString().trim();
    stderr += line + '\n';
    // Stream progress lines to user (az CLI outputs progress to stderr)
    if (line && !line.startsWith('{') && !line.startsWith('"')) {
      console.log(`  ${c.dim}${line}${c.reset}`);
    }
  });

  const exitCode = await new Promise(r => proc.on('close', r));
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // ── Step 9: Show results ──────────────────────────────────────
  if (exitCode === 0) {
    console.log(`\n  ${c.green}✓${c.reset}  ${c.bold}Deployment succeeded${c.reset} (${elapsed}s)\n`);

    // Parse deployment outputs
    try {
      const result = JSON.parse(stdout);
      const outputs = result.properties?.outputs;
      if (outputs && Object.keys(outputs).length > 0) {
        console.log(`  ${c.bold}Outputs:${c.reset}`);
        for (const [key, val] of Object.entries(outputs)) {
          const display = typeof val.value === 'object' ? JSON.stringify(val.value) : val.value;
          console.log(`    ${c.cyan}${key}${c.reset}: ${display}`);
        }
        console.log();
      }

      // Show provisioned resources
      const resources = result.properties?.outputResources;
      if (resources?.length > 0) {
        console.log(`  ${c.bold}Provisioned Resources (${resources.length}):${c.reset}`);
        for (const res of resources) {
          const parts = res.id.split('/');
          const type = parts.slice(-2, -1)[0] || '';
          const name = parts.slice(-1)[0] || '';
          console.log(`    ${c.green}✓${c.reset} ${c.dim}${type}/${c.reset}${c.cyan}${name}${c.reset}`);
        }
        console.log();
      }
    } catch { /* stdout wasn't valid JSON — that's okay */ }

    console.log(`  ${c.bold}Next Steps:${c.reset}`);
    console.log(`    ${c.dim}1.${c.reset} View in portal:  ${c.cyan}https://portal.azure.com/#@/resource/subscriptions/${account.id}/resourceGroups/${resourceGroup}${c.reset}`);
    console.log(`    ${c.dim}2.${c.reset} Check status:    ${c.dim}az deployment group show -n ${deployName} -g ${resourceGroup} --query properties.provisioningState${c.reset}`);
    console.log(`    ${c.dim}3.${c.reset} Delete later:    ${c.dim}az group delete -n ${resourceGroup} --yes --no-wait${c.reset}\n`);
  } else {
    console.log(`\n  ${c.red}✗${c.reset}  ${c.bold}Deployment failed${c.reset} (${elapsed}s)\n`);

    // Extract meaningful error from stderr
    const errorLines = stderr.split('\n').filter(l => l.includes('ERROR') || l.includes('error') || l.includes('Code:') || l.includes('Message:'));
    if (errorLines.length > 0) {
      console.log(`  ${c.bold}Error Details:${c.reset}`);
      for (const line of errorLines.slice(0, 8)) {
        console.log(`    ${c.red}${line.trim()}${c.reset}`);
      }
      console.log();
    }

    console.log(`  ${c.bold}Troubleshooting:${c.reset}`);
    console.log(`    ${c.dim}1.${c.reset} Check quotas:    ${c.dim}az deployment group show -n ${deployName} -g ${resourceGroup}${c.reset}`);
    console.log(`    ${c.dim}2.${c.reset} View full error: ${c.dim}az deployment operation list -n ${deployName} -g ${resourceGroup}${c.reset}`);
    console.log(`    ${c.dim}3.${c.reset} Validate first:  ${c.dim}az deployment group validate -g ${resourceGroup} -f infra/main.bicep${c.reset}\n`);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════
// DIFF — Compare local play files vs GitHub
// ═══════════════════════════════════════════════════

async function cmdDiff() {
  banner();

  // Detect play
  let playId = null;
  if (existsSync('spec/fai-manifest.json')) {
    try {
      const manifest = JSON.parse(readFileSync('spec/fai-manifest.json', 'utf8'));
      playId = manifest.play;
    } catch { /* ignore */ }
  }
  if (!playId) {
    const dirName = resolve('.').split(/[\\/]/).pop();
    const match = dirName.match(/^(\d{2,3}-.+)/);
    if (match) playId = match[1];
  }
  if (!playId) {
    console.log(`  ${c.red}✗${c.reset} No FrootAI play detected. Run from a play directory.\n`);
    return;
  }

  const resolved = resolvePlay(playId);
  if (!resolved) {
    console.log(`  ${c.red}✗${c.reset} Unknown play: ${playId}\n`);
    return;
  }

  const playName = resolved; // resolvePlay returns a string like "01-enterprise-rag"
  const playNum = playName.replace(/-.*/, '');
  const playTitle = playName.replace(/^\d+-/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  console.log(`  ${c.bold}Drift Detection:${c.reset} Play ${playNum} — ${playTitle}\n`);

  const ghBase = `https://raw.githubusercontent.com/frootai/frootai/main/solution-plays/${playName}`;
  const filesToCheck = [];

  // Scan local files in key directories
  const dirs = ['.github', 'config', 'evaluation', 'spec', 'infra'];
  for (const d of dirs) {
    if (existsSync(d)) {
      (function scan(base) {
        for (const f of readdirSync(base)) {
          const fp = join(base, f);
          try {
            if (statSync(fp).isDirectory()) scan(fp);
            else filesToCheck.push(fp.replace(/\\/g, '/'));
          } catch { /* skip */ }
        }
      })(d);
    }
  }
  // Also check root files
  for (const f of ['agent.md', 'README.md', 'architecture.md']) {
    if (existsSync(f)) filesToCheck.push(f);
  }

  if (filesToCheck.length === 0) {
    console.log(`  ${c.dim}No play files found to compare.${c.reset}\n`);
    return;
  }

  let same = 0, changed = 0, localOnly = 0, errors = 0;

  for (const file of filesToCheck) {
    try {
      const url = `${ghBase}/${file}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'FrootAI-CLI' } });
      if (res.status === 404) {
        localOnly++;
        console.log(`  ${c.cyan}+${c.reset} ${file} ${c.dim}(local only)${c.reset}`);
        continue;
      }
      if (!res.ok) { errors++; continue; }

      const remote = await res.text();
      const local = readFileSync(file, 'utf8');

      if (local.trim() === remote.trim()) {
        same++;
      } else {
        changed++;
        const localLines = local.split('\n').length;
        const remoteLines = remote.split('\n').length;
        const diff = localLines - remoteLines;
        const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
        console.log(`  ${c.yellow}~${c.reset} ${file} ${c.dim}(${diffStr} lines)${c.reset}`);
      }
    } catch {
      errors++;
    }
  }

  console.log(`\n  ${c.bold}Summary:${c.reset} ${same} identical, ${changed} modified, ${localOnly} local-only, ${errors} errors`);
  if (changed === 0 && localOnly === 0) {
    console.log(`  ${c.green}✅ Project is in sync with GitHub.${c.reset}`);
  } else if (changed > 0) {
    console.log(`  ${c.dim}Run ${c.cyan}npx frootai install ${playNum}${c.dim} to pull latest from GitHub.${c.reset}`);
  }
  console.log('');
}

// ═══════════════════════════════════════════════════
// STATUS — Show current project context
// ═══════════════════════════════════════════════════

function cmdStatus() {
  banner();

  // Detect play from current directory
  let detectedPlay = null;
  let playNum = null;
  let playTitle = null;

  // Check fai-manifest.json
  if (existsSync('spec/fai-manifest.json')) {
    try {
      const manifest = JSON.parse(readFileSync('spec/fai-manifest.json', 'utf8'));
      detectedPlay = manifest.play || null;
      if (detectedPlay) {
        const match = detectedPlay.match(/^(\d+)/);
        playNum = match ? match[1] : null;
        playTitle = detectedPlay.replace(/^\d+-/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
    } catch { /* ignore */ }
  }

  // Fallback: check directory name
  if (!detectedPlay) {
    const dirName = resolve('.').split(/[\\/]/).pop();
    const match = dirName.match(/^(\d{2,3})-(.+)/);
    if (match) {
      playNum = match[1];
      playTitle = match[2].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      detectedPlay = dirName;
    }
  }

  if (detectedPlay) {
    console.log(`  ${c.bold}Play:${c.reset} ${playNum} — ${playTitle}`);
    console.log(`  ${c.bold}Dir:${c.reset}  ${resolve('.')}\n`);
  } else {
    console.log(`  ${c.dim}No FrootAI play detected in current directory.${c.reset}`);
    console.log(`  ${c.dim}Run ${c.cyan}frootai scaffold <play>${c.dim} to get started.${c.reset}\n`);
    return;
  }

  // Check what's installed
  const kits = {
    DevKit: [
      { path: '.github/agents', label: 'Agents' },
      { path: '.github/copilot-instructions.md', label: 'Instructions' },
      { path: '.vscode/mcp.json', label: 'MCP config' },
      { path: 'agent.md', label: 'Root agent' },
    ],
    TuneKit: [
      { path: 'config/openai.json', label: 'OpenAI config' },
      { path: 'config/guardrails.json', label: 'Guardrails' },
      { path: 'evaluation', label: 'Evaluation pipeline' },
    ],
    SpecKit: [
      { path: 'spec/fai-manifest.json', label: 'FAI Manifest' },
      { path: 'spec/architecture.md', label: 'Architecture spec' },
    ],
    Infra: [
      { path: 'infra/main.bicep', label: 'Bicep template' },
      { path: 'infra/parameters.json', label: 'Parameters' },
    ],
  };

  console.log(`  ${c.bold}Installed Kits:${c.reset}`);
  for (const [kitName, items] of Object.entries(kits)) {
    const found = items.filter(i => existsSync(i.path));
    const total = items.length;
    const icon = found.length === total ? `${c.green}✅` : found.length > 0 ? `${c.yellow}⚠️` : `${c.dim}⬜`;
    console.log(`    ${icon}${c.reset} ${kitName.padEnd(10)} ${found.length}/${total} — ${found.map(f => f.label).join(', ') || 'not installed'}`);
  }

  // Count total files in key dirs
  const dirs = ['.github', 'config', 'evaluation', 'spec', 'infra', '.vscode'];
  let totalFiles = 0;
  for (const d of dirs) {
    if (existsSync(d)) {
      try {
        const count = (function countDir(p) {
          let n = 0;
          for (const f of readdirSync(p)) {
            const fp = join(p, f);
            try { n += statSync(fp).isDirectory() ? countDir(fp) : 1; } catch { /* skip */ }
          }
          return n;
        })(d);
        totalFiles += count;
      } catch { /* skip */ }
    }
  }

  console.log(`\n  ${c.bold}Total project files:${c.reset} ${totalFiles}`);

  // Quick actions
  console.log(`\n  ${c.bold}Quick Actions:${c.reset}`);
  if (!existsSync('infra/main.bicep')) {
    console.log(`    ${c.dim}npx frootai install ${playNum} --kit infra${c.reset}   # Add infrastructure`);
  } else {
    console.log(`    ${c.dim}npx frootai deploy${c.reset}                        # Deploy to Azure`);
  }
  if (!existsSync('evaluation')) {
    console.log(`    ${c.dim}npx frootai install ${playNum} --kit tunekit${c.reset} # Add evaluation`);
  }
  console.log(`    ${c.dim}npx frootai validate --waf${c.reset}                # WAF scorecard`);
  console.log(`    ${c.dim}npx frootai info ${playNum}${c.reset}                      # Play details\n`);
}

// ═══════════════════════════════════════════════════
// UPDATE — Self-update + check for latest versions
// ═══════════════════════════════════════════════════

async function cmdUpdate() {
  banner();
  console.log(`  ${c.bold}Checking for updates...${c.reset}\n`);

  // Check frootai CLI version
  try {
    const latest = execSync('npm view frootai version', { encoding: 'utf8', timeout: 10000 }).trim();
    if (latest === VERSION) {
      console.log(`  ${c.green}✅${c.reset} frootai@${VERSION} is up to date`);
    } else {
      console.log(`  ${c.yellow}⬆️${c.reset}  frootai ${VERSION} → ${latest} available`);
      console.log(`     Run: ${c.cyan}npm i -g frootai@latest${c.reset}`);
      console.log(`     Or:  ${c.cyan}npx frootai@latest <command>${c.reset}`);
    }
  } catch {
    console.log(`  ${c.yellow}⚠️${c.reset}  Could not check frootai version`);
  }

  // Check frootai-mcp version
  try {
    const mcpPkg = require('frootai-mcp/package.json');
    const mcpLatest = execSync('npm view frootai-mcp version', { encoding: 'utf8', timeout: 10000 }).trim();
    if (mcpLatest === mcpPkg.version) {
      console.log(`  ${c.green}✅${c.reset} frootai-mcp@${mcpPkg.version} is up to date`);
    } else {
      console.log(`  ${c.yellow}⬆️${c.reset}  frootai-mcp ${mcpPkg.version} → ${mcpLatest} available`);
      console.log(`     Run: ${c.cyan}npm i -g frootai@latest${c.reset} (updates dependency)`);
    }
  } catch {
    console.log(`  ${c.yellow}⚠️${c.reset}  Could not check frootai-mcp version`);
  }

  // Check Node.js version
  const nodeVer = process.version.replace('v', '');
  const nodeMajor = parseInt(nodeVer.split('.')[0]);
  try {
    const latestLts = execSync('npm view node version', { encoding: 'utf8', timeout: 10000 }).trim();
    const ltsMajor = parseInt(latestLts.split('.')[0]);
    if (nodeMajor >= ltsMajor) {
      console.log(`  ${c.green}✅${c.reset} Node.js ${process.version} is current`);
    } else if (nodeMajor >= 18) {
      console.log(`  ${c.dim}ℹ️${c.reset}  Node.js ${process.version} (${latestLts} available)`);
    } else {
      console.log(`  ${c.red}❌${c.reset} Node.js ${process.version} — upgrade to 18+ required`);
    }
  } catch {
    console.log(`  ${c.green}✅${c.reset} Node.js ${process.version}`);
  }

  console.log('');
}

function cmdHelp() {
  banner();
  console.log(`${c.bold}  Usage:${c.reset} frootai <command> [options]\n`);
  console.log(`${c.bold}  Commands:${c.reset}`);
  console.log(`    ${c.green}init${c.reset}              Interactive project scaffolding wizard`);
  console.log(`    ${c.green}scaffold${c.reset} <play>    New project — GitHub download + template generation`);
  console.log(`    ${c.green}install${c.reset} <play>     Download play files into current directory`);
  console.log(`    ${c.green}deploy${c.reset}             Deploy infra/main.bicep to Azure (guided wizard)`);
  console.log(`    ${c.green}info${c.reset} <play>        Show play details, cost, services, links`);
  console.log(`    ${c.green}list${c.reset} [keyword]     Browse all 77 plugins in the FAI Marketplace`);
  console.log(`    ${c.green}search${c.reset} <query>     Search FrootAI knowledge base`);
  console.log(`    ${c.green}cost${c.reset} [play]        Cost estimate (--scale dev|prod)`);
  console.log(`    ${c.green}validate${c.reset}           Check project structure + configs`);
  console.log(`    ${c.green}validate --waf${c.reset}     WAF alignment scorecard (6 pillars)`);
  console.log(`    ${c.green}doctor${c.reset}             Health check for your setup`);
  console.log(`    ${c.green}status${c.reset}             Show current project context`);
  console.log(`    ${c.green}diff${c.reset}               Compare local vs GitHub (drift detection)`);
  console.log(`    ${c.green}update${c.reset}             Check for latest versions`);
  console.log(`    ${c.green}version${c.reset}            Show version info`);
  console.log(`    ${c.green}help${c.reset}               Show this help\n`);
  console.log(`${c.bold}  Examples:${c.reset}`);
  console.log(`    ${c.dim}npx frootai init${c.reset}`);
  console.log(`    ${c.dim}npx frootai scaffold 01-enterprise-rag${c.reset}`);
  console.log(`    ${c.dim}npx frootai scaffold 01 --kit devkit${c.reset}`);
  console.log(`    ${c.dim}npx frootai scaffold -i${c.reset}                    ${c.dim}# interactive${c.reset}`);
  console.log(`    ${c.dim}npx frootai install 01 --kit tunekit${c.reset}`);
  console.log(`    ${c.dim}npx frootai deploy${c.reset}                         ${c.dim}# guided Azure deploy${c.reset}`);
  console.log(`    ${c.dim}npx frootai deploy --dry-run${c.reset}               ${c.dim}# preview only${c.reset}`);
  console.log(`    ${c.dim}npx frootai deploy -y --resource-group myRG${c.reset}`);
  console.log(`    ${c.dim}npx frootai info 01${c.reset}`);
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
