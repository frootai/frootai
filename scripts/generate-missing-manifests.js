#!/usr/bin/env node
/**
 * FrootAI — Generate Missing fai-manifest.json for Plays 02-20
 * 
 * Play 01 and Plays 21-30 already have manifests.
 * Plays 02-20 are missing them — this script generates them.
 */

const fs = require('fs');
const path = require('path');

const PLAYS_DIR = path.join(__dirname, '..', 'solution-plays');
const PLATFORM_HARNESS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'harness', 'platform.json'), 'utf8'));

const playDefs = [
  { num: '02', slug: 'ai-landing-zone', title: 'AI Landing Zone', knowledge: ['O5-GPU-Infra', 'T3-Production-Patterns'], waf: ['security', 'reliability', 'cost-optimization', 'operational-excellence'] },
  { num: '03', slug: 'deterministic-agent', title: 'Deterministic Agent', knowledge: ['R3-Deterministic-AI', 'O2-Agent-Coding'], waf: ['security', 'reliability', 'responsible-ai'] },
  { num: '04', slug: 'call-center-voice-ai', title: 'Call Center Voice AI', knowledge: ['F1-GenAI-Foundations', 'R2-RAG-Architecture'], waf: ['security', 'reliability', 'cost-optimization', 'responsible-ai'] },
  { num: '05', slug: 'it-ticket-resolution', title: 'IT Ticket Resolution', knowledge: ['R2-RAG-Architecture', 'O1-Semantic-Kernel'], waf: ['security', 'reliability', 'cost-optimization'] },
  { num: '06', slug: 'document-intelligence', title: 'Document Intelligence', knowledge: ['F1-GenAI-Foundations', 'T3-Production-Patterns'], waf: ['security', 'reliability', 'responsible-ai'] },
  { num: '07', slug: 'multi-agent-service', title: 'Multi-Agent Service', knowledge: ['O2-Agent-Coding', 'O1-Semantic-Kernel'], waf: ['security', 'reliability', 'cost-optimization', 'performance-efficiency'] },
  { num: '08', slug: 'copilot-studio-bot', title: 'Copilot Studio Bot', knowledge: ['F4-GitHub-Agentic-OS', 'O6-Copilot-Extend'], waf: ['security', 'reliability', 'operational-excellence'] },
  { num: '09', slug: 'ai-search-portal', title: 'AI Search Portal', knowledge: ['R2-RAG-Architecture', 'F1-GenAI-Foundations'], waf: ['security', 'reliability', 'performance-efficiency', 'cost-optimization'] },
  { num: '10', slug: 'content-moderation', title: 'Content Moderation', knowledge: ['T2-Responsible-AI', 'F1-GenAI-Foundations'], waf: ['security', 'responsible-ai', 'reliability'] },
  { num: '11', slug: 'ai-landing-zone-advanced', title: 'AI Landing Zone Advanced', knowledge: ['O5-GPU-Infra', 'T3-Production-Patterns'], waf: ['security', 'reliability', 'cost-optimization', 'operational-excellence', 'performance-efficiency'] },
  { num: '12', slug: 'model-serving-aks', title: 'Model Serving AKS', knowledge: ['O5-GPU-Infra', 'T1-Fine-Tuning-MLOps', 'T3-Production-Patterns'], waf: ['security', 'reliability', 'cost-optimization', 'performance-efficiency'] },
  { num: '13', slug: 'fine-tuning-workflow', title: 'Fine-Tuning Workflow', knowledge: ['T1-Fine-Tuning-MLOps', 'F1-GenAI-Foundations'], waf: ['security', 'cost-optimization', 'operational-excellence'] },
  { num: '14', slug: 'cost-optimized-ai-gateway', title: 'Cost-Optimized AI Gateway', knowledge: ['T3-Production-Patterns', 'F2-LLM-Selection'], waf: ['cost-optimization', 'performance-efficiency', 'reliability', 'security'] },
  { num: '15', slug: 'multi-modal-docproc', title: 'Multi-Modal Document Processing', knowledge: ['F1-GenAI-Foundations', 'R2-RAG-Architecture'], waf: ['security', 'reliability', 'responsible-ai'] },
  { num: '16', slug: 'copilot-teams-extension', title: 'Copilot Teams Extension', knowledge: ['F4-GitHub-Agentic-OS', 'O6-Copilot-Extend', 'O3-MCP-Tools-Functions'], waf: ['security', 'reliability', 'operational-excellence'] },
  { num: '17', slug: 'ai-observability', title: 'AI Observability', knowledge: ['T3-Production-Patterns', 'O5-GPU-Infra'], waf: ['operational-excellence', 'reliability', 'cost-optimization'] },
  { num: '18', slug: 'prompt-management', title: 'Prompt Management', knowledge: ['R1-Prompt-Patterns', 'O1-Semantic-Kernel'], waf: ['security', 'cost-optimization', 'operational-excellence'] },
  { num: '19', slug: 'edge-ai-phi4', title: 'Edge AI Phi-4', knowledge: ['F2-LLM-Selection', 'T1-Fine-Tuning-MLOps'], waf: ['cost-optimization', 'performance-efficiency', 'security'] },
  { num: '20', slug: 'anomaly-detection', title: 'Anomaly Detection', knowledge: ['T3-Production-Patterns', 'F1-GenAI-Foundations'], waf: ['reliability', 'security', 'operational-excellence'] }
];

let created = 0;

for (const p of playDefs) {
  const dir = path.join(PLAYS_DIR, `${p.num}-${p.slug}`);
  const manifestPath = path.join(dir, 'fai-manifest.json');

  if (fs.existsSync(manifestPath)) {
    continue; // Already has manifest
  }

  if (!fs.existsSync(dir)) {
    console.log(`  ⚠️  Play dir missing: ${p.num}-${p.slug}`);
    continue;
  }

  // Check what DevKit files exist
  const agentsDir = path.join(dir, '.github', 'agents');
  const instrDir = path.join(dir, '.github', 'instructions');
  const skillsDir = path.join(dir, '.github', 'skills');

  const agents = [];
  if (fs.existsSync(agentsDir)) {
    fs.readdirSync(agentsDir).filter(f => f.endsWith('.agent.md')).forEach(f => {
      agents.push(`./.github/agents/${f}`);
    });
  }

  const instructions = [];
  if (fs.existsSync(instrDir)) {
    fs.readdirSync(instrDir).filter(f => f.endsWith('.instructions.md')).forEach(f => {
      instructions.push(`./.github/instructions/${f}`);
    });
  }

  const skills = [];
  if (fs.existsSync(skillsDir)) {
    fs.readdirSync(skillsDir).filter(f => {
      try { return fs.statSync(path.join(skillsDir, f)).isDirectory(); } catch { return false; }
    }).forEach(f => {
      skills.push(`./.github/skills/${f}/`);
    });
  }

  const hasBicep = fs.existsSync(path.join(dir, 'infra', 'main.bicep'));
  // Harness by default: hooks, guardrails and security rules are inherited from the profile.
  const manifest = {
    play: `${p.num}-${p.slug}`,
    version: '1.0.0',
    extends: hasBicep ? 'azure-ai-standard@1' : PLATFORM_HARNESS.defaults['solution-play'],
    context: {
      knowledge: p.knowledge,
      waf: p.waf,
      scope: `${p.slug}-solution`
    },
    primitives: {
      agents: agents.length > 0 ? agents : [`./.github/agents/builder.agent.md`],
      instructions: instructions.length > 0 ? instructions : [],
      skills: skills.length > 0 ? skills : []
    },
    infrastructure: {
      bicep: hasBicep ? './infra/main.bicep' : null,
      parameters: fs.existsSync(path.join(dir, 'infra', 'parameters.json')) ? './infra/parameters.json' : null
    },
    toolkit: {
      devkit: '.github/',
      tunekit: 'config/',
      speckit: 'spec/'
    }
  };

  // Remove null values
  if (!manifest.infrastructure.bicep) delete manifest.infrastructure.bicep;
  if (!manifest.infrastructure.parameters) delete manifest.infrastructure.parameters;

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  created++;
  console.log(`  ✅ ${p.num}-${p.slug} — ${agents.length} agents, ${instructions.length} instructions, ${skills.length} skills`);
}

console.log(`\nCreated: ${created} manifests`);
if (created > 0) console.log('Run npm run harness:write to generate harness-owned play files, then npm run validate:harness.');
console.log(`Total plays with manifests: ${fs.readdirSync(PLAYS_DIR).filter(f => {
  try {
    return fs.statSync(path.join(PLAYS_DIR, f)).isDirectory() &&
      /^\d{2}-/.test(f) &&
      fs.existsSync(path.join(PLAYS_DIR, f, 'fai-manifest.json'));
  } catch { return false; }
}).length}/30`);
