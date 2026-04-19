#!/usr/bin/env node
/**
 * FAI Factory — Documentation Site Generator
 * ============================================
 * Generates a complete, production-grade documentation site from the FrootAI
 * source of truth: docs/, fai-catalog.json, schemas, MCP tools, CLI commands.
 *
 * Output: .factory/docs/ — Fumadocs/MDX-ready content tree
 *
 * Architecture inspired by: React.dev, Anthropic docs, OpenAI docs, Stripe docs
 *
 * Structure generated:
 *   docs-out/
 *   ├── getting-started/          ← Onboarding (quickstart, installation, first play)
 *   ├── concepts/                 ← Core concepts (FAI Protocol, primitives, WAF)
 *   ├── learning/                 ← 18 FROOT modules (F1-T3)
 *   ├── guides/                   ← How-to guides (tutorials, migration, enterprise)
 *   ├── solution-plays/           ← 100 play reference pages
 *   ├── primitives/               ← 860+ primitive catalog pages
 *   ├── api-reference/            ← MCP tools, CLI, schemas, Python SDK
 *   ├── specialties/              ← 12 FAI Specialties documentation
 *   ├── changelog/                ← Unified changelog
 *   └── meta.json                 ← Navigation tree for Fumadocs/Nextra
 *
 * Usage:
 *   node scripts/factory/adapters/docs.js                    # Full generation
 *   node scripts/factory/adapters/docs.js --section learning # Single section
 *   node scripts/factory/adapters/docs.js --stats            # Stats only
 *
 * @module scripts/factory/adapters/docs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const DOCS_SRC = path.join(ROOT, 'docs');
const PLAYS_DIR = path.join(ROOT, 'solution-plays');
const SCHEMAS_DIR = path.join(ROOT, 'schemas');
const PROTOCOL_DIR = path.join(ROOT, 'fai-protocol');
const CLI_DIR = path.join(ROOT, 'cli');
const OUTPUT = path.join(ROOT, '.factory', 'docs');

// ─── Configuration ────────────────────────────────────

const SITE_CONFIG = {
  title: 'FrootAI Documentation',
  description: 'The open-source AI primitive unification platform — documentation, guides, and API reference.',
  url: 'https://docs.frootai.dev',
  repo: 'https://github.com/frootai/frootai',
  editBaseUrl: 'https://github.com/frootai/frootai/edit/main/',
  version: '1.0.0',
  ogImage: 'https://frootai.dev/og-image.png',
  themeColor: '#10b981' // Emerald
};

// FROOT module ordering and metadata
const FROOT_MODULES = [
  { id: 'F1', file: 'GenAI-Foundations.md',       title: 'GenAI Foundations',    layer: 'Foundations', icon: '🧠', order: 1 },
  { id: 'F2', file: 'LLM-Landscape.md',           title: 'LLM Landscape',       layer: 'Foundations', icon: '🤖', order: 2 },
  { id: 'F3', file: 'F3-AI-Glossary-AZ.md',       title: 'AI Glossary A–Z',     layer: 'Foundations', icon: '📖', order: 3 },
  { id: 'F4', file: 'F4-GitHub-Agentic-OS.md',     title: 'GitHub Agentic OS',   layer: 'Foundations', icon: '⚙️', order: 4 },
  { id: 'R1', file: 'Prompt-Engineering.md',       title: 'Prompt Engineering',  layer: 'Reasoning',   icon: '✍️', order: 5 },
  { id: 'R2', file: 'RAG-Architecture.md',         title: 'RAG Architecture',    layer: 'Reasoning',   icon: '🔍', order: 6 },
  { id: 'R3', file: 'R3-Deterministic-AI.md',      title: 'Deterministic AI',    layer: 'Reasoning',   icon: '🎯', order: 7 },
  { id: 'O1', file: 'Semantic-Kernel.md',          title: 'Semantic Kernel',     layer: 'Orchestration', icon: '🔧', order: 8 },
  { id: 'O2', file: 'AI-Agents-Deep-Dive.md',     title: 'AI Agents Deep Dive', layer: 'Orchestration', icon: '🤖', order: 9 },
  { id: 'O3', file: 'O3-MCP-Tools-Functions.md',   title: 'MCP & Tools',         layer: 'Orchestration', icon: '🔌', order: 10 },
  { id: 'O4', file: 'Azure-AI-Foundry.md',        title: 'Azure AI Foundry',    layer: 'Operations',  icon: '☁️', order: 11 },
  { id: 'O5', file: 'AI-Infrastructure.md',        title: 'AI Infrastructure',   layer: 'Operations',  icon: '🏗️', order: 12 },
  { id: 'O6', file: 'Copilot-Ecosystem.md',        title: 'Copilot Ecosystem',   layer: 'Operations',  icon: '✈️', order: 13 },
  { id: 'T1', file: 'T1-Fine-Tuning-MLOps.md',     title: 'Fine-Tuning & MLOps', layer: 'Transformation', icon: '🔬', order: 14 },
  { id: 'T2', file: 'Responsible-AI-Safety.md',    title: 'Responsible AI',      layer: 'Transformation', icon: '🛡️', order: 15 },
  { id: 'T3', file: 'T3-Production-Patterns.md',   title: 'Production Patterns', layer: 'Transformation', icon: '🚀', order: 16 }
];

const SPECIALTY_META = [
  { id: 'S-1',  key: 'memory',     title: 'FAI Memory',            icon: '🧠' },
  { id: 'S-2',  key: 'context',    title: 'FAI Context',           icon: '🔗' },
  { id: 'S-3',  key: 'sessions',   title: 'FAI Sessions',          icon: '🔄' },
  { id: 'S-4',  key: 'reasoning',  title: 'FAI Reasoning',         icon: '🤔' },
  { id: 'S-5',  key: 'planning',   title: 'FAI Planning',          icon: '📋' },
  { id: 'S-6',  key: 'hitl',       title: 'FAI Human-in-the-Loop', icon: '👤' },
  { id: 'S-7',  key: 'replay',     title: 'FAI Replay',            icon: '🔁' },
  { id: 'S-8',  key: 'graphs',     title: 'FAI Knowledge Graphs',  icon: '📊' },
  { id: 'S-9',  key: 'coding',     title: 'FAI Agentic Coding',    icon: '💻' },
  { id: 'S-10', key: 'voice',      title: 'FAI Voice',             icon: '🎤' },
  { id: 'S-11', key: 'trust',      title: 'FAI Trust',             icon: '🔐' },
  { id: 'S-12', key: 'federation', title: 'FAI Federation',        icon: '🌐' }
];

// ─── Utilities ────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeDoc(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

function readFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** Add MDX frontmatter to a markdown document. */
function addFrontmatter(content, meta) {
  const fm = ['---'];
  fm.push(`title: "${meta.title.replace(/"/g, '\\"')}"`);
  if (meta.description) fm.push(`description: "${meta.description.replace(/"/g, '\\"')}"`);
  if (meta.icon) fm.push(`icon: "${meta.icon}"`);
  if (meta.order !== undefined) fm.push(`order: ${meta.order}`);
  if (meta.editUrl) fm.push(`editUrl: "${meta.editUrl}"`);
  if (meta.prev) fm.push(`prev: "${meta.prev}"`);
  if (meta.next) fm.push(`next: "${meta.next}"`);
  if (meta.tags) fm.push(`tags: [${meta.tags.map(t => `"${t}"`).join(', ')}]`);
  if (meta.category) fm.push(`category: "${meta.category}"`);
  fm.push('---');
  fm.push('');
  return fm.join('\n') + content;
}

/** Strip existing frontmatter from markdown. */
function stripFrontmatter(content) {
  if (!content.startsWith('---')) return content;
  const end = content.indexOf('---', 3);
  if (end === -1) return content;
  return content.substring(end + 3).trim();
}

/** Extract title from markdown (first # heading). */
function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Untitled';
}

/** Extract first paragraph as description. */
function extractDescription(content) {
  const stripped = stripFrontmatter(content);
  const lines = stripped.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('```') && !l.startsWith('|') && !l.startsWith('>'));
  if (lines.length === 0) return '';
  return lines[0].trim().substring(0, 200).replace(/"/g, "'");
}

/** Count words in content. */
function wordCount(content) {
  return content.split(/\s+/).filter(Boolean).length;
}

// ─── Stats Counter ────────────────────────────────────

const stats = {
  sections: {},
  totalPages: 0,
  totalWords: 0,
  totalBytes: 0,
  errors: []
};

function recordPage(section, file, words, bytes) {
  if (!stats.sections[section]) stats.sections[section] = { pages: 0, words: 0 };
  stats.sections[section].pages++;
  stats.sections[section].words += words;
  stats.totalPages++;
  stats.totalWords += words;
  stats.totalBytes += bytes;
}

// ─── D-0: Site Scaffold ───────────────────────────────

function generateScaffold() {
  console.log('  📁 D-0: Generating docs scaffold...');

  // Site configuration
  const siteConfig = {
    ...SITE_CONFIG,
    navigation: {
      primary: [
        { title: 'Getting Started', path: '/getting-started', icon: '🚀' },
        { title: 'Concepts', path: '/concepts', icon: '💡' },
        { title: 'Learning', path: '/learning', icon: '📚' },
        { title: 'Guides', path: '/guides', icon: '🗺️' },
        { title: 'Solution Plays', path: '/solution-plays', icon: '🎯' },
        { title: 'Primitives', path: '/primitives', icon: '🧩' },
        { title: 'API Reference', path: '/api-reference', icon: '📖' },
        { title: 'Specialties', path: '/specialties', icon: '⚡' },
        { title: 'Changelog', path: '/changelog', icon: '📝' }
      ],
      secondary: [
        { title: 'GitHub', url: 'https://github.com/frootai/frootai', external: true },
        { title: 'Community', url: 'https://frootai.dev/community', external: true },
        { title: 'frootai.dev', url: 'https://frootai.dev', external: true }
      ]
    },
    footer: {
      columns: [
        { title: 'Product', links: ['Getting Started', 'Solution Plays', 'Primitives', 'FAI Protocol'] },
        { title: 'Developers', links: ['API Reference', 'CLI', 'MCP Server', 'Python SDK'] },
        { title: 'Resources', links: ['Learning Hub', 'Guides', 'Changelog', 'Roadmap'] },
        { title: 'Community', links: ['GitHub', 'Contributing', 'Code of Conduct', 'Discord'] }
      ],
      copyright: '© 2025-2026 FrootAI. MIT License.'
    }
  };

  writeDoc(path.join(OUTPUT, 'docs-config.json'), JSON.stringify(siteConfig, null, 2));

  // Theme configuration
  const themeConfig = {
    colors: {
      primary: '#10b981',
      primaryDark: '#059669',
      accent: '#d4a853',
      background: '#0a0a0a',
      surface: '#111111',
      text: '#e5e5e5',
      muted: '#737373'
    },
    fonts: {
      heading: 'Inter, system-ui, sans-serif',
      body: 'Inter, system-ui, sans-serif',
      code: 'JetBrains Mono, Fira Code, monospace'
    },
    logo: { text: 'FrootAI', tagline: 'AI Primitive Unification', brandHtml: '<span class="text-white">Froot</span><span class="text-emerald-400">AI</span>' },
    codeTheme: 'one-dark-pro',
    defaultTheme: 'dark',
    features: { search: true, toc: true, editOnGithub: true, feedback: true, copyCode: true, breadcrumbs: true, prevNext: true, darkMode: true }
  };

  writeDoc(path.join(OUTPUT, 'theme-config.json'), JSON.stringify(themeConfig, null, 2));

  // Index page
  const indexContent = addFrontmatter(
    `# FrootAI Documentation

Welcome to the FrootAI documentation — your guide to the open-source AI primitive unification platform.

## What is FrootAI?

FrootAI provides the **FAI Protocol** — a declarative standard for wiring AI primitives (agents, instructions, skills, hooks, workflows, plugins) into coherent, evaluated, deployable systems. Think of it as the **Dockerfile for AI applications**.

## Quick Links

| Resource | Description |
|----------|-------------|
| [**Getting Started →**](/getting-started) | Set up FrootAI in 5 minutes |
| [**Concepts →**](/concepts) | Understand the FAI Protocol and primitives |
| [**Solution Plays →**](/solution-plays) | 100 production-ready AI architectures |
| [**API Reference →**](/api-reference) | MCP tools, CLI, schemas |

## How FrootAI Fits the AI Ecosystem

\`\`\`
MCP    → Tool Calling        (how agents use tools)
A2A    → Agent Delegation     (how agents talk to each other)
AG-UI  → UI Rendering         (how agents show results)
FAI    → Primitive Wiring     (how everything connects)
\`\`\`

## Distribution Channels

| Channel | Install |
|---------|---------|
| npm (MCP Server) | \`npx frootai-mcp@latest\` |
| VS Code Extension | Search "FrootAI" in Extensions |
| Python SDK | \`pip install frootai\` |
| CLI | \`npx frootai@latest\` |
| Docker | \`docker pull frootai/mcp-server\` |

---

*This documentation is auto-generated from the [FrootAI source](https://github.com/frootai/frootai) by the FAI Factory.*
`,
    { title: 'FrootAI Documentation', description: 'The open-source AI primitive unification platform', icon: '🍊', order: 0 }
  );
  writeDoc(path.join(OUTPUT, 'index.mdx'), indexContent);
  recordPage('scaffold', 'index.mdx', wordCount(indexContent), indexContent.length);

  console.log('    ✅ Scaffold: docs-config.json, theme-config.json, index.mdx');
}

// ─── D-1: Getting Started + FAI Protocol ──────────────

function generateGettingStarted() {
  console.log('  📁 D-1: Generating Getting Started + Concepts...');
  const gsDir = path.join(OUTPUT, 'getting-started');
  const conceptsDir = path.join(OUTPUT, 'concepts');

  // Getting Started index
  const gsIndex = addFrontmatter(`# Getting Started

Get up and running with FrootAI in under 5 minutes.

## Prerequisites

- **Node.js** 18+ (for MCP server and CLI)
- **Python** 3.10+ (for Python SDK, optional)
- **VS Code** (recommended IDE)
- **Azure subscription** (for cloud-deployed plays, optional)

## Installation

### Option 1: MCP Server (Recommended)

\`\`\`bash
# Works with any MCP-compatible AI assistant
npx frootai-mcp@latest
\`\`\`

### Option 2: VS Code Extension

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search "FrootAI"
4. Click Install

### Option 3: CLI

\`\`\`bash
npm install -g frootai
fai --help
\`\`\`

### Option 4: Python SDK

\`\`\`bash
pip install frootai
\`\`\`

## Your First Play

Every FrootAI solution is called a **Play** — a self-contained, deployable AI architecture.

\`\`\`bash
# Scaffold Play 01: Enterprise RAG
fai init 01-enterprise-rag

# Explore the structure
cd 01-enterprise-rag
tree .github/
\`\`\`

**What you get:**

\`\`\`
01-enterprise-rag/
├── agent.md                    # Root orchestrator agent
├── .github/
│   ├── copilot-instructions.md # Knowledge context (<150 lines)
│   ├── agents/                 # Builder, Reviewer, Tuner agents
│   ├── instructions/           # Domain-specific instructions
│   ├── skills/                 # Reusable skill definitions
│   ├── hooks/                  # Security guardrails
│   └── workflows/              # CI/CD automation
├── config/                     # Tunable AI parameters
├── infra/                      # Azure Bicep / Terraform
├── evaluation/                 # Quality evaluation pipeline
└── spec/
    └── fai-manifest.json       # FAI Protocol manifest (the glue)
\`\`\`

## Next Steps

- [**Understand the Concepts →**](/concepts) — What makes FAI unique
- [**Browse Solution Plays →**](/solution-plays) — 100 production architectures
- [**Read the Learning Hub →**](/learning) — 18 deep-dive modules
`,
    { title: 'Getting Started', description: 'Set up FrootAI in under 5 minutes', icon: '🚀', order: 1,
      tags: ['quickstart', 'installation', 'setup'] }
  );
  writeDoc(path.join(gsDir, 'index.mdx'), gsIndex);
  recordPage('getting-started', 'index.mdx', wordCount(gsIndex), gsIndex.length);

  // Concepts — FAI Protocol
  const protocolSrc = readFile(path.join(PROTOCOL_DIR, 'README.md'));
  if (protocolSrc) {
    const protocolDoc = addFrontmatter(stripFrontmatter(protocolSrc), {
      title: 'FAI Protocol',
      description: 'The declarative standard for wiring AI primitives',
      icon: '📜', order: 1, category: 'concepts',
      editUrl: 'fai-protocol/README.md',
      tags: ['protocol', 'manifest', 'standard']
    });
    writeDoc(path.join(conceptsDir, 'fai-protocol.mdx'), protocolDoc);
    recordPage('concepts', 'fai-protocol.mdx', wordCount(protocolDoc), protocolDoc.length);
  }

  // Concepts — Primitives overview
  const primitivesDoc = addFrontmatter(`# FAI Primitives

FrootAI organizes AI capabilities into **9 primitive types** — reusable building blocks that can be composed into any AI application.

## The 9 Primitive Types

| Primitive | Extension | Purpose | Count |
|-----------|-----------|---------|-------|
| **Agents** | \`.agent.md\` | Specialized AI personas with tools and model preferences | 238 |
| **Instructions** | \`.instructions.md\` | Context-specific behavioral rules (applied via glob patterns) | 176 |
| **Skills** | \`SKILL.md\` | Reusable capabilities agents can invoke | 322 |
| **Hooks** | \`hooks.json\` | Lifecycle event handlers (security, validation) | 10 |
| **Workflows** | \`.yml\` | Multi-step automated processes | 12 |
| **Plugins** | \`plugin.json\` | Distributable packages of primitives | 77 |
| **Prompts** | \`.prompt.md\` | Reusable prompt templates | — |
| **Guardrails** | In manifest | Quality thresholds (groundedness, safety, cost) | — |
| **Tools** | Via MCP | External capabilities agents can call | 25+ |

## How Primitives Connect

Primitives are standalone files — each works independently. But when wired together via \`fai-manifest.json\`, they share context, enforce quality gates, and compose into complete solutions.

\`\`\`json
{
  "play": "01-enterprise-rag",
  "version": "1.0.0",
  "context": {
    "knowledge": ["R2-RAG-Architecture"],
    "waf": ["security", "reliability"]
  },
  "primitives": {
    "agents": ["./agent.md"],
    "skills": ["./.github/skills/rag-indexer/"],
    "guardrails": { "groundedness": 0.95, "safety": 0 }
  }
}
\`\`\`

## Well-Architected Framework Alignment

Every primitive is tagged with WAF pillar alignment:

| Pillar | Focus |
|--------|-------|
| **Security** | Managed Identity, Key Vault, RBAC, content safety |
| **Reliability** | Retry, circuit breaker, health checks, degradation |
| **Cost Optimization** | Model routing, token budgets, right-sizing |
| **Operational Excellence** | CI/CD, observability, IaC |
| **Performance Efficiency** | Caching, streaming, async |
| **Responsible AI** | Content safety, groundedness, fairness |

## Browse Primitives

- [**Agents →**](/primitives/agents) — 238 specialized AI agents
- [**Skills →**](/primitives/skills) — 322 reusable capabilities
- [**Instructions →**](/primitives/instructions) — 176 behavioral rules
- [**Plugins →**](/primitives/plugins) — 77 distributable packages
`,
    { title: 'FAI Primitives', description: 'The 9 building blocks of AI applications', icon: '🧩', order: 2, category: 'concepts',
      tags: ['primitives', 'agents', 'skills', 'instructions'] }
  );
  writeDoc(path.join(conceptsDir, 'primitives.mdx'), primitivesDoc);
  recordPage('concepts', 'primitives.mdx', wordCount(primitivesDoc), primitivesDoc.length);

  // Concepts — WAF
  const wafDoc = addFrontmatter(`# Well-Architected Framework

FrootAI enforces the Azure Well-Architected Framework across all primitives and solution plays. Every agent, instruction, skill, and hook is aligned to one or more of the 6 WAF pillars.

## The 6 Pillars

### 🔒 Security
- Never hardcode secrets — use Managed Identity and Key Vault
- Private endpoints for all PaaS services in production
- Content safety filters on all AI endpoints
- Rate-limit AI API calls per user/tenant

### 🔄 Reliability
- Retry with exponential backoff on all external calls
- Circuit breaker for downstream dependencies
- Health checks on every service endpoint
- Graceful degradation when AI services are unavailable

### 💰 Cost Optimization
- Model routing: GPT-4o-mini for simple tasks, GPT-4o for complex
- Token budgets per request
- Response caching for repeated queries
- Auto-scaling with appropriate bounds

### ⚙️ Operational Excellence
- All deployments through CI/CD — no manual changes
- Structured logging with correlation IDs
- Infrastructure as Code (Bicep/Terraform)
- Automated content sync across distribution channels

### ⚡ Performance Efficiency
- Streaming responses for AI chat interfaces
- Semantic caching (similarity > 0.95)
- Async/parallel for independent operations
- CDN for static assets

### 🛡️ Responsible AI
- ALL user-facing AI responses through Content Safety
- RAG responses MUST cite sources
- AI-generated content labeled transparently
- Human-in-the-loop for critical decisions

## How WAF is Enforced

1. **Manifest**: \`context.waf\` declares which pillars apply
2. **Instructions**: \`.instructions.md\` files enforce pillar-specific rules
3. **Hooks**: Security hooks validate compliance at runtime
4. **Evaluation**: Guardrails check quality after every response

## Learn More

- [Security Instructions](/learning/waf-security)
- [Solution Plays](/solution-plays) — every play lists its WAF alignment
`,
    { title: 'Well-Architected Framework', description: 'How FrootAI enforces enterprise-grade quality', icon: '🏛️', order: 3, category: 'concepts',
      tags: ['waf', 'security', 'reliability', 'cost'] }
  );
  writeDoc(path.join(conceptsDir, 'well-architected.mdx'), wafDoc);
  recordPage('concepts', 'well-architected.mdx', wordCount(wafDoc), wafDoc.length);

  console.log(`    ✅ Getting Started: 1 page | Concepts: 3 pages`);
}

// ─── D-2: Learning Hub (18 FROOT Modules) ─────────────

function generateLearningHub() {
  console.log('  📁 D-2: Generating Learning Hub (18 FROOT modules)...');
  const learningDir = path.join(OUTPUT, 'learning');
  let count = 0;

  // Learning index
  const indexContent = addFrontmatter(`# Learning Hub

Master AI engineering through 18 comprehensive modules organized in the FROOT framework.

## The FROOT Framework

| Layer | Modules | Focus |
|-------|---------|-------|
| **F** — Foundations | F1, F2, F3, F4 | GenAI fundamentals, LLM landscape, glossary, agentic OS |
| **R** — Reasoning | R1, R2, R3 | Prompt engineering, RAG architecture, deterministic AI |
| **O** — Orchestration | O1, O2, O3 | Semantic Kernel, AI agents, MCP & tools |
| **O** — Operations | O4, O5, O6 | Azure AI Foundry, infrastructure, Copilot ecosystem |
| **T** — Transformation | T1, T2, T3 | Fine-tuning, responsible AI, production patterns |

## Recommended Learning Path

**Beginner**: F1 → F2 → R1 → R2 → O3
**Intermediate**: O1 → O2 → O4 → T2 → T3
**Advanced**: F4 → R3 → O5 → T1 → O6

Start with [F1: GenAI Foundations →](/learning/f1-genai-foundations) to begin your journey.
`,
    { title: 'Learning Hub', description: 'Master AI engineering through 18 FROOT modules', icon: '📚', order: 3 }
  );
  writeDoc(path.join(learningDir, 'index.mdx'), indexContent);
  recordPage('learning', 'index.mdx', wordCount(indexContent), indexContent.length);

  // Generate each module page
  for (let i = 0; i < FROOT_MODULES.length; i++) {
    const mod = FROOT_MODULES[i];
    const srcPath = path.join(DOCS_SRC, mod.file);
    const content = readFile(srcPath);

    if (!content) {
      stats.errors.push(`Learning: ${mod.file} not found`);
      continue;
    }

    const stripped = stripFrontmatter(content);
    const slug = slugify(`${mod.id}-${mod.title}`);

    const prev = i > 0 ? `/learning/${slugify(`${FROOT_MODULES[i-1].id}-${FROOT_MODULES[i-1].title}`)}` : null;
    const next = i < FROOT_MODULES.length - 1 ? `/learning/${slugify(`${FROOT_MODULES[i+1].id}-${FROOT_MODULES[i+1].title}`)}` : null;

    const doc = addFrontmatter(stripped, {
      title: `${mod.id}: ${mod.title}`,
      description: extractDescription(content),
      icon: mod.icon,
      order: mod.order,
      category: mod.layer,
      editUrl: `docs/${mod.file}`,
      prev, next,
      tags: [mod.layer.toLowerCase(), mod.id.toLowerCase()]
    });

    writeDoc(path.join(learningDir, `${slug}.mdx`), doc);
    recordPage('learning', `${slug}.mdx`, wordCount(doc), doc.length);
    count++;
  }

  console.log(`    ✅ Learning Hub: ${count} module pages + index`);
}

// ─── D-3: API Reference ───────────────────────────────

function generateAPIReference() {
  console.log('  📁 D-3: Generating API Reference...');
  const apiDir = path.join(OUTPUT, 'api-reference');

  // API Reference index
  const apiIndex = addFrontmatter(`# API Reference

Complete reference documentation for all FrootAI interfaces.

## MCP Tools (25+)

The FrootAI MCP Server provides 25+ tools for AI architecture guidance, evaluation, and knowledge retrieval.

\`\`\`bash
npx frootai-mcp@latest
\`\`\`

[Browse MCP Tools →](/api-reference/mcp-tools)

## CLI Commands

\`\`\`bash
npx frootai@latest --help
\`\`\`

[Browse CLI Commands →](/api-reference/cli)

## JSON Schemas

- [fai-manifest.json](/api-reference/schemas/fai-manifest) — The FAI Protocol manifest
- [fai-context.json](/api-reference/schemas/fai-context) — Lightweight context reference
- [plugin.json](/api-reference/schemas/plugin) — Plugin package manifest

[Browse Schemas →](/api-reference/schemas)

## Python SDK

\`\`\`python
from frootai import FAIEngine
engine = FAIEngine()
play = engine.load('solution-plays/01-enterprise-rag/spec/fai-manifest.json')
\`\`\`

[Python SDK Reference →](/api-reference/python-sdk)
`,
    { title: 'API Reference', description: 'Complete API documentation for MCP, CLI, schemas, and SDK', icon: '📖', order: 7 }
  );
  writeDoc(path.join(apiDir, 'index.mdx'), apiIndex);
  recordPage('api-reference', 'index.mdx', wordCount(apiIndex), apiIndex.length);

  // MCP Tools page
  const mcpToolsDoc = addFrontmatter(`# MCP Tools Reference

The FrootAI MCP Server exposes 25+ tools for AI architecture guidance, knowledge retrieval, and evaluation.

## Installation

\`\`\`bash
npx frootai-mcp@latest
\`\`\`

## Tool Categories

### 🧠 Knowledge & Search
| Tool | Description |
|------|-------------|
| \`search_knowledge\` | Search across all 18 FROOT modules for a topic |
| \`get_module\` | Get full content of a specific module (F1, R2, etc.) |
| \`lookup_term\` | Look up an AI/ML term in the glossary (200+ terms) |

### 🎯 Solution Plays
| Tool | Description |
|------|-------------|
| \`list_community_plays\` | List all 100 solution plays with status |
| \`get_play_detail\` | Get detailed architecture for a specific play |
| \`semantic_search_plays\` | Natural language search across plays |
| \`compare_plays\` | Side-by-side comparison of 2-3 plays |

### 🏗️ Architecture
| Tool | Description |
|------|-------------|
| \`get_architecture_pattern\` | Get guidance for specific scenarios (RAG, agent hosting, etc.) |
| \`generate_architecture_diagram\` | Generate Mermaid.js diagrams for any play |
| \`compare_models\` | Side-by-side AI model comparison |

### 💰 Cost & Evaluation
| Tool | Description |
|------|-------------|
| \`estimate_cost\` | Calculate monthly Azure costs for any play |
| \`get_azure_pricing\` | Azure AI pricing scenarios |
| \`run_evaluation\` | Check AI quality scores against thresholds |
| \`validate_config\` | Validate TuneKit configuration files |

### 🤖 Agent Operations
| Tool | Description |
|------|-------------|
| \`agent_build\` | Builder agent — implementation guidance |
| \`agent_review\` | Reviewer agent — security & quality review |
| \`agent_tune\` | Tuner agent — production readiness validation |

### 📦 Ecosystem
| Tool | Description |
|------|-------------|
| \`list_modules\` | List all FROOT framework modules |
| \`list_primitives\` | Browse primitives by type |
| \`get_model_catalog\` | Azure OpenAI model catalog |
| \`get_froot_overview\` | Complete FROOT framework overview |
| \`fetch_azure_docs\` | Fetch latest Azure documentation |
| \`fetch_external_mcp\` | Search for external MCP servers |
`,
    { title: 'MCP Tools', description: '25+ tools for AI architecture guidance', icon: '🔌', order: 1, category: 'api-reference',
      tags: ['mcp', 'tools', 'api'] }
  );
  writeDoc(path.join(apiDir, 'mcp-tools.mdx'), mcpToolsDoc);
  recordPage('api-reference', 'mcp-tools.mdx', wordCount(mcpToolsDoc), mcpToolsDoc.length);

  // CLI Reference
  const cliDoc = addFrontmatter(`# CLI Reference

The FrootAI CLI provides command-line access to the FAI ecosystem.

## Installation

\`\`\`bash
npm install -g frootai
# or
npx frootai@latest
\`\`\`

## Commands

| Command | Description |
|---------|-------------|
| \`fai init <play>\` | Scaffold a new solution play |
| \`fai validate\` | Validate all primitives in current directory |
| \`fai catalog\` | Generate fai-catalog.json from source |
| \`fai diff\` | Show changes since last catalog |
| \`fai harvest\` | Scan and count all primitives |
| \`fai unify\` | Run primitive unification checks |
| \`fai adapt\` | Generate framework adapters (SK, LangChain) |
| \`fai search <query>\` | Search primitives and knowledge |
| \`fai stats\` | Show repository statistics |
| \`fai doctor\` | Health check for FAI installation |

## Examples

### Scaffold a new RAG solution
\`\`\`bash
fai init 01-enterprise-rag
cd 01-enterprise-rag
fai validate
\`\`\`

### Run quality validation
\`\`\`bash
fai validate --fix      # Auto-fix common issues
fai validate --json     # JSON output for CI
\`\`\`

### Search the knowledge base
\`\`\`bash
fai search "how to reduce hallucination"
fai search "RAG chunking strategies"
\`\`\`
`,
    { title: 'CLI Reference', description: 'Command-line interface for FAI', icon: '⌨️', order: 2, category: 'api-reference',
      tags: ['cli', 'commands'] }
  );
  writeDoc(path.join(apiDir, 'cli.mdx'), cliDoc);
  recordPage('api-reference', 'cli.mdx', wordCount(cliDoc), cliDoc.length);

  // JSON Schemas
  const schemaFiles = fs.existsSync(SCHEMAS_DIR) ? fs.readdirSync(SCHEMAS_DIR).filter(f => f.endsWith('.json')) : [];
  if (schemaFiles.length > 0) {
    let schemasContent = `# JSON Schemas\n\nFAI Protocol schemas that validate manifest files, context references, and plugin packages.\n\n`;
    for (const schemaFile of schemaFiles) {
      const schema = readFile(path.join(SCHEMAS_DIR, schemaFile));
      if (!schema) continue;
      try {
        const parsed = JSON.parse(schema);
        schemasContent += `## ${parsed.title || schemaFile}\n\n`;
        schemasContent += `${parsed.description || ''}\n\n`;
        schemasContent += `**Schema ID**: \`${parsed.$id || 'N/A'}\`\n\n`;
        schemasContent += `\`\`\`json\n${schema}\n\`\`\`\n\n---\n\n`;
      } catch { /* skip malformed */ }
    }

    const schemasDoc = addFrontmatter(schemasContent, {
      title: 'JSON Schemas', description: 'FAI Protocol validation schemas', icon: '📋', order: 3, category: 'api-reference',
      tags: ['schema', 'validation', 'json']
    });
    writeDoc(path.join(apiDir, 'schemas.mdx'), schemasDoc);
    recordPage('api-reference', 'schemas.mdx', wordCount(schemasDoc), schemasDoc.length);
  }

  console.log(`    ✅ API Reference: ${Object.keys(stats.sections).filter(s => s === 'api-reference').length ? stats.sections['api-reference'].pages : 0} pages`);
}

// ─── D-4: Solution Play Pages ─────────────────────────

function generateSolutionPlays() {
  console.log('  📁 D-4: Generating Solution Play pages...');
  const playsDir = path.join(OUTPUT, 'solution-plays');
  let count = 0;

  // Solution plays index
  const indexContent = addFrontmatter(`# Solution Plays

100 production-ready AI architectures — each a self-contained, deployable solution with agents, infrastructure, evaluation, and quality guardrails.

## Browse by Category

| Category | Plays | Focus |
|----------|-------|-------|
| **RAG & Search** | 01, 09, 21, 26, 28 | Retrieval-augmented generation, search portals |
| **Multi-Agent** | 07, 22, 51 | Orchestration, swarms, agentic coding |
| **Voice & Speech** | 04, 96 | Call center AI, voice pipelines |
| **Document Processing** | 06, 15 | OCR, multi-modal analysis |
| **Infrastructure** | 02, 11, 14 | Landing zones, gateways, cost optimization |
| **Observability** | 17 | AI monitoring, KQL dashboards |
| **Security** | 10, 41 | Content moderation, red teaming |

## Play Structure

Every play follows the same structure:
\`\`\`
solution-play-NN/
├── agent.md                     # Root orchestrator
├── .github/                     # Copilot primitives
├── config/                      # Tunable parameters
├── infra/                       # Infrastructure as Code
├── evaluation/                  # Quality pipeline
└── spec/fai-manifest.json       # FAI Protocol manifest
\`\`\`
`,
    { title: 'Solution Plays', description: '100 production-ready AI architectures', icon: '🎯', order: 5 }
  );
  writeDoc(path.join(playsDir, 'index.mdx'), indexContent);
  recordPage('solution-plays', 'index.mdx', wordCount(indexContent), indexContent.length);

  // Generate individual play pages
  if (!fs.existsSync(PLAYS_DIR)) return;

  const playFolders = fs.readdirSync(PLAYS_DIR)
    .filter(f => /^\d{2,3}-/.test(f) && fs.statSync(path.join(PLAYS_DIR, f)).isDirectory())
    .sort();

  for (const folder of playFolders) {
    const playDir = path.join(PLAYS_DIR, folder);
    const readmePath = path.join(playDir, 'README.md');
    const manifestPath = path.join(playDir, 'spec', 'fai-manifest.json');

    let readme = readFile(readmePath) || `# ${folder}\n\nSolution play documentation.`;
    let manifest = null;
    try { manifest = JSON.parse(readFile(manifestPath) || '{}'); } catch { /* skip */ }

    const title = extractTitle(readme);
    const playNum = folder.match(/^(\d+)/)?.[1] || '00';
    const stripped = stripFrontmatter(readme);

    // Enrich with manifest data
    let enrichment = '';
    if (manifest && manifest.play) {
      enrichment += `\n\n## FAI Manifest\n\n`;
      enrichment += `| Field | Value |\n|-------|-------|\n`;
      enrichment += `| Play | \`${manifest.play}\` |\n`;
      enrichment += `| Version | \`${manifest.version || '1.0.0'}\` |\n`;
      if (manifest.context?.knowledge) enrichment += `| Knowledge | ${manifest.context.knowledge.join(', ')} |\n`;
      if (manifest.context?.waf) enrichment += `| WAF Pillars | ${manifest.context.waf.join(', ')} |\n`;
      if (manifest.primitives?.guardrails) {
        const g = manifest.primitives.guardrails;
        enrichment += `| Groundedness | ≥ ${((g.groundedness || 0) * 100).toFixed(0)}% |\n`;
        enrichment += `| Safety | ${g.safety} violations max |\n`;
      }
    }

    const doc = addFrontmatter(stripped + enrichment, {
      title: `Play ${playNum}: ${title}`,
      description: extractDescription(readme),
      icon: '🎯',
      order: parseInt(playNum),
      editUrl: `solution-plays/${folder}/README.md`,
      tags: ['solution-play', `play-${playNum}`]
    });

    writeDoc(path.join(playsDir, `${folder}.mdx`), doc);
    recordPage('solution-plays', `${folder}.mdx`, wordCount(doc), doc.length);
    count++;
  }

  console.log(`    ✅ Solution Plays: ${count} play pages + index`);
}

// ─── D-5: Primitive Catalogs ──────────────────────────

function generatePrimitiveCatalogs() {
  console.log('  📁 D-5: Generating Primitive catalogs...');
  const primDir = path.join(OUTPUT, 'primitives');
  const categories = ['agents', 'skills', 'instructions', 'hooks', 'plugins', 'workflows'];

  const primIndex = addFrontmatter(`# Primitives Catalog

Browse all 860+ FAI primitives — the building blocks of AI applications.

## Categories

| Category | Count | Description |
|----------|-------|-------------|
| [**Agents**](/primitives/agents) | 238 | Specialized AI personas |
| [**Skills**](/primitives/skills) | 322 | Reusable capabilities |
| [**Instructions**](/primitives/instructions) | 176 | Behavioral rules |
| [**Plugins**](/primitives/plugins) | 77 | Distributable packages |
| [**Hooks**](/primitives/hooks) | 10 | Lifecycle handlers |
| [**Workflows**](/primitives/workflows) | 12 | Multi-step processes |
`,
    { title: 'Primitives', description: '860+ reusable AI building blocks', icon: '🧩', order: 6 }
  );
  writeDoc(path.join(primDir, 'index.mdx'), primIndex);
  recordPage('primitives', 'index.mdx', wordCount(primIndex), primIndex.length);

  // Generate a page for each category listing available primitives
  for (const cat of categories) {
    const catDir = path.join(ROOT, cat === 'plugins' ? 'community-plugins' : cat);
    let items = [];

    if (fs.existsSync(catDir)) {
      const files = fs.readdirSync(catDir, { withFileTypes: true });
      for (const f of files) {
        if (cat === 'agents' && f.isFile() && f.name.endsWith('.agent.md')) {
          items.push(f.name.replace('.agent.md', ''));
        } else if (cat === 'skills' && f.isDirectory()) {
          items.push(f.name);
        } else if (cat === 'instructions' && f.isFile() && f.name.endsWith('.instructions.md')) {
          items.push(f.name.replace('.instructions.md', ''));
        } else if (cat === 'hooks' && f.isDirectory() && f.name !== 'README.md') {
          items.push(f.name);
        } else if (cat === 'plugins' && f.isDirectory() && f.name !== 'submissions' && f.name !== 'README.md') {
          items.push(f.name);
        } else if (cat === 'workflows' && f.isFile() && f.name.endsWith('.md')) {
          items.push(f.name.replace('.md', ''));
        }
      }
    }

    const catContent = addFrontmatter(`# ${cat.charAt(0).toUpperCase() + cat.slice(1)}

${items.length} ${cat} available in the FrootAI ecosystem.

## Catalog

${items.sort().map(item => `- \`${item}\``).join('\n')}

## Usage

${cat === 'agents' ? `Reference an agent in your \`fai-manifest.json\`:
\`\`\`json
{
  "primitives": {
    "agents": ["../../agents/${items[0] || 'fai-rag-architect'}.agent.md"]
  }
}
\`\`\`` : `Add ${cat} to your solution play's \`fai-manifest.json\` primitives section.`}
`,
      { title: cat.charAt(0).toUpperCase() + cat.slice(1), description: `${items.length} ${cat} in the FAI ecosystem`,
        icon: cat === 'agents' ? '🤖' : cat === 'skills' ? '⚡' : cat === 'instructions' ? '📝' : cat === 'hooks' ? '🪝' : cat === 'plugins' ? '🔌' : '🔄',
        order: categories.indexOf(cat) + 1, category: 'primitives' }
    );
    writeDoc(path.join(primDir, `${cat}.mdx`), catContent);
    recordPage('primitives', `${cat}.mdx`, wordCount(catContent), catContent.length);
  }

  console.log(`    ✅ Primitives: ${categories.length} category pages + index`);
}

// ─── D-6: Search Index ────────────────────────────────

function generateSearchIndex() {
  console.log('  📁 D-6: Generating search index...');

  const searchEntries = [];

  // Index all generated MDX files
  function walkDir(dir, basePath = '') {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath, `${basePath}/${entry.name}`);
      } else if (entry.name.endsWith('.mdx')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const title = extractTitle(content) || entry.name;
        const description = extractDescription(content);
        const route = `${basePath}/${entry.name.replace('.mdx', '')}`.replace('/index', '');

        searchEntries.push({
          title,
          description: description.substring(0, 200),
          route: route || '/',
          section: basePath.split('/')[1] || 'root',
          words: wordCount(content)
        });
      }
    }
  }

  walkDir(OUTPUT);

  writeDoc(path.join(OUTPUT, 'search-index.json'), JSON.stringify(searchEntries, null, 2));
  recordPage('search', 'search-index.json', 0, JSON.stringify(searchEntries).length);

  console.log(`    ✅ Search index: ${searchEntries.length} entries`);
}

// ─── D-7: Guides ──────────────────────────────────────

function generateGuides() {
  console.log('  📁 D-7: Generating Guides...');
  const guidesDir = path.join(OUTPUT, 'guides');

  const guides = [
    {
      slug: 'deploy-first-play',
      title: 'Deploy Your First Play',
      description: 'End-to-end tutorial: scaffold → configure → deploy → evaluate',
      icon: '🚀', order: 1,
      content: `# Deploy Your First Play

This guide walks you through deploying Play 01 (Enterprise RAG) from scratch.

## Prerequisites

- Azure subscription with Contributor access
- Azure CLI installed (\`az login\`)
- Node.js 18+

## Step 1: Scaffold the Play

\`\`\`bash
npx frootai@latest init 01-enterprise-rag
cd 01-enterprise-rag
\`\`\`

## Step 2: Configure Parameters

Edit \`config/openai.json\`:
\`\`\`json
{
  "model": "gpt-4o",
  "temperature": 0.3,
  "max_tokens": 4000,
  "top_p": 0.9
}
\`\`\`

## Step 3: Deploy Infrastructure

\`\`\`bash
# Using Azure Bicep
az deployment group create \\
  --resource-group rg-frootai \\
  --template-file infra/main.bicep \\
  --parameters infra/parameters.json

# Or using Terraform
cd infra/terraform
terraform init && terraform apply
\`\`\`

## Step 4: Run Evaluation

\`\`\`bash
# Validate the play
npx frootai validate

# Run quality evaluation
node engine/index.js spec/fai-manifest.json --eval
\`\`\`

## Step 5: Verify Quality Gates

Check that all guardrails pass:
- ✅ Groundedness ≥ 95%
- ✅ Coherence ≥ 90%
- ✅ Relevance ≥ 85%
- ✅ Safety = 0 violations
- ✅ Cost ≤ $0.01/query

## Next Steps

- [Create a Custom Agent →](/guides/create-agent)
- [Build a Plugin →](/guides/build-plugin)
- [Enterprise Deployment →](/guides/enterprise-deployment)
`
    },
    {
      slug: 'create-agent',
      title: 'Create a Custom Agent',
      description: 'Build your own specialized AI agent with tools, models, and WAF alignment',
      icon: '🤖', order: 2,
      content: `# Create a Custom Agent

Agents are the most powerful primitive in FrootAI. This guide shows you how to create production-grade agents.

## Agent File Structure

Create a file: \`my-agent.agent.md\`

\`\`\`yaml
---
description: "Expert in data pipeline design and ETL optimization"
tools: ["codebase", "terminal", "azure"]
model: ["gpt-4o", "gpt-4o-mini"]
waf: ["performance-efficiency", "cost-optimization"]
plays: ["20-real-time-analytics"]
---
\`\`\`

## Writing Agent Instructions

After the frontmatter, write detailed instructions:

\`\`\`markdown
# Data Pipeline Architect

You are a data pipeline architect specializing in Azure Data Factory,
Synapse Analytics, and real-time streaming with Event Hubs.

## Expertise
- ETL/ELT pipeline design
- Data lake architecture (Bronze/Silver/Gold)
- Real-time streaming with Apache Kafka and Event Hubs
- Data quality monitoring

## Constraints
- Always recommend managed services over self-hosted
- Include cost estimates in every architecture proposal
- Follow the medallion architecture pattern
\`\`\`

## Best Practices

1. **Description**: 10+ characters, specific to the agent's domain
2. **Tools**: Only declare tools the agent actually needs
3. **Model**: Use array for fallback (primary → secondary)
4. **WAF**: Align with relevant pillars (not all 6)
5. **Plays**: List compatible solution plays

## Testing Your Agent

\`\`\`bash
npx frootai validate --type agents
\`\`\`
`
    },
    {
      slug: 'migrate-from-langchain',
      title: 'Migrate from LangChain',
      description: 'Wrap your existing LangChain code with FAI primitives for quality gates and context wiring',
      icon: '🔄', order: 5,
      content: `# Migrate from LangChain

FrootAI doesn't replace LangChain — it wraps and enhances it. The FAI LangChain adapter translates your manifest into LCEL chain config.

## What You Keep
- ✅ All your LangChain chains, tools, and agents
- ✅ LangSmith tracing
- ✅ LCEL syntax

## What You Gain
- ✅ Protocol-level quality guardrails
- ✅ Context wiring across agents
- ✅ WAF alignment enforcement
- ✅ Infrastructure as Code integration
- ✅ Cross-framework portability

## Step 1: Add FAI Manifest

Create \`spec/fai-manifest.json\` in your project:

\`\`\`json
{
  "play": "custom-langchain-app",
  "version": "1.0.0",
  "context": {
    "knowledge": ["R2-RAG-Architecture"],
    "waf": ["security", "reliability"]
  },
  "primitives": {
    "agents": ["./agent.md"],
    "guardrails": { "groundedness": 0.90, "safety": 0 }
  }
}
\`\`\`

## Step 2: Generate LangChain Adapter Config

\`\`\`bash
npx frootai adapt --framework langchain
\`\`\`

This generates:
- \`lc-config.json\` — Chain configuration
- \`lc-tools.json\` — StructuredTool definitions
- \`lc-graph.json\` — LangGraph StateGraph nodes
- \`lc-callbacks.json\` — Quality gate callbacks

## Step 3: Wire Into Your App

\`\`\`python
from langchain.callbacks import FrootAICallback
from frootai import FAIEngine

engine = FAIEngine()
play = engine.load('spec/fai-manifest.json')

# Add FAI quality gates to your chain
chain = your_existing_chain.with_config(
    callbacks=[FrootAICallback(play.guardrails)]
)
\`\`\`
`
    },
    {
      slug: 'enterprise-deployment',
      title: 'Enterprise Deployment',
      description: 'Landing zones, RBAC, compliance, and production-grade deployment patterns',
      icon: '🏢', order: 6,
      content: `# Enterprise Deployment

Deploy FrootAI in production with enterprise-grade security, compliance, and governance.

## Architecture: AI Landing Zone

\`\`\`
Hub VNet (Shared Services)
├── Azure Firewall
├── Azure Bastion
├── Log Analytics Workspace
└── Key Vault (shared secrets)
    │
Spoke VNet (AI Workload)
├── Azure OpenAI (private endpoint)
├── Azure AI Search (private endpoint)
├── Azure Container Apps (workload)
├── Cosmos DB (state store)
└── Application Insights (telemetry)
\`\`\`

## RBAC Configuration

| Role | Scope | Purpose |
|------|-------|---------|
| Cognitive Services User | OpenAI resource | AI model access |
| Search Index Data Reader | AI Search | Read search indexes |
| Key Vault Secrets User | Key Vault | Read secrets |
| Monitoring Reader | App Insights | Read telemetry |

## Compliance Checklist

- [ ] All secrets in Azure Key Vault (never in code)
- [ ] Private endpoints for all PaaS services
- [ ] Azure Policy assignments for AI governance
- [ ] Content Safety filters on all AI endpoints
- [ ] Audit logging enabled (diagnostic settings)
- [ ] Data residency requirements met
- [ ] GDPR right-to-deletion implemented
- [ ] SOC 2 audit trail in place

## Reference Plays

- [Play 02: AI Landing Zone](/solution-plays/02-ai-landing-zone)
- [Play 11: Advanced Landing Zone](/solution-plays/11-ai-landing-zone-advanced)
- [Play 14: Cost-Optimized Gateway](/solution-plays/14-cost-optimized-ai-gateway)
`
    },
    {
      slug: 'troubleshooting',
      title: 'Troubleshooting',
      description: 'Common issues and solutions for FrootAI development',
      icon: '🔧', order: 10,
      content: `# Troubleshooting

Solutions to common issues when working with FrootAI.

## MCP Server Issues

### "Connection refused" when starting MCP server
\`\`\`bash
# Check if port is in use
netstat -ano | findstr :3000

# Try a different port
FAI_PORT=3001 npx frootai-mcp@latest
\`\`\`

### MCP tools returning stale data
The MCP server caches knowledge.json in memory. Restart to refresh:
\`\`\`bash
# Kill existing server
# Restart
npx frootai-mcp@latest
\`\`\`

## Validation Errors

### "Missing fai-manifest.json"
Ensure your play has \`spec/fai-manifest.json\`:
\`\`\`bash
npx frootai validate --verbose
\`\`\`

### "Agent description too short"
Agent frontmatter must have \`description\` with 10+ characters:
\`\`\`yaml
---
description: "Expert in RAG pipeline design and optimization"  # ✅ Good
---
\`\`\`

## Infrastructure Deployment

### Bicep deployment fails with "QuotaExceeded"
Check your Azure OpenAI quota:
\`\`\`bash
az cognitiveservices usage list --location eastus2
\`\`\`

### Terraform state lock
\`\`\`bash
terraform force-unlock <lock-id>
\`\`\`

## Getting Help

- [GitHub Issues](https://github.com/frootai/frootai/issues)
- [Community](https://frootai.dev/community)
- Ask Agent FAI: \`npx frootai-mcp@latest\` → use \`search_knowledge\` tool
`
    }
  ];

  // Guides index
  const guidesIndex = addFrontmatter(`# Guides

Step-by-step tutorials for common FrootAI tasks.

## Tutorials

${guides.map(g => `- [**${g.title}**](/guides/${g.slug}) — ${g.description}`).join('\n')}
`,
    { title: 'Guides', description: 'Step-by-step tutorials and how-to guides', icon: '🗺️', order: 4 }
  );
  writeDoc(path.join(guidesDir, 'index.mdx'), guidesIndex);
  recordPage('guides', 'index.mdx', wordCount(guidesIndex), guidesIndex.length);

  for (const guide of guides) {
    const doc = addFrontmatter(guide.content, {
      title: guide.title,
      description: guide.description,
      icon: guide.icon,
      order: guide.order,
      category: 'guides',
      tags: ['guide', slugify(guide.title)]
    });
    writeDoc(path.join(guidesDir, `${guide.slug}.mdx`), doc);
    recordPage('guides', `${guide.slug}.mdx`, wordCount(doc), doc.length);
  }

  console.log(`    ✅ Guides: ${guides.length} guide pages + index`);
}

// ─── D-Extra: Specialties Docs ────────────────────────

function generateSpecialtiesDocs() {
  console.log('  📁 D-Extra: Generating Specialties documentation...');
  const specDir = path.join(OUTPUT, 'specialties');

  const specIndex = addFrontmatter(`# FAI Specialties

12 advanced capabilities declared at the protocol level — things no competitor offers as a standard.

## The 12 Specialties

| # | Specialty | Priority | What It Does |
|---|-----------|----------|-------------|
${SPECIALTY_META.map(s => `| ${s.id} | ${s.icon} [${s.title}](/specialties/${s.key}) | P${s.id.endsWith('2') || s.id.endsWith('4') ? '0' : s.id.match(/[136]$/) ? '1' : s.id.match(/[578]$/) ? '2' : '3'} | Protocol-level ${s.title.replace('FAI ', '').toLowerCase()} |`).join('\n')}

## How Specialties Work

Specialties extend \`fai-manifest.json\` with new top-level sections. Each is optional — only configure what you need.

\`\`\`json
{
  "play": "01-enterprise-rag",
  "version": "2.0.0",
  "reasoning": { "strategy": "deterministic", "temperature": 0 },
  "memory": { "tiers": { "working": { "ttl": "15m" } } },
  "humanInTheLoop": { "gates": [{ "stage": "pre-deploy" }] }
}
\`\`\`
`,
    { title: 'FAI Specialties', description: '12 protocol-level advanced capabilities', icon: '⚡', order: 8 }
  );
  writeDoc(path.join(specDir, 'index.mdx'), specIndex);
  recordPage('specialties', 'index.mdx', wordCount(specIndex), specIndex.length);

  // Generate individual specialty pages from engine source
  for (const spec of SPECIALTY_META) {
    const enginePath = path.join(ROOT, 'engine', 'specialties', `${spec.key}.js`);
    const source = readFile(enginePath);
    let schemaBlock = '';

    if (source) {
      // Extract schema from source
      const schemaMatch = source.match(/const \w+_SCHEMA = (\{[\s\S]*?\n\});/);
      if (schemaMatch) {
        schemaBlock = `\n\n## Schema Contract\n\n\`\`\`json\n${schemaMatch[1]}\n\`\`\`\n`;
      }
    }

    const doc = addFrontmatter(`# ${spec.title}

${spec.icon} ${spec.id} — Protocol-level ${spec.title.replace('FAI ', '').toLowerCase()}.
${schemaBlock}
## Usage in Manifest

Add the \`${spec.key}\` section to your \`fai-manifest.json\`:

\`\`\`json
{
  "${spec.key}": {
    // See schema above for available options
  }
}
\`\`\`

## Engine API

\`\`\`javascript
import { createSpecialties } from './engine/specialties/index.js';
const specs = createSpecialties(manifest);
// Access via: specs.${spec.key === 'hitl' ? 'hitl' : spec.key === 'graphs' ? 'graph' : spec.key}
\`\`\`

## Source

[View source on GitHub](https://github.com/frootai/frootai/blob/main/engine/specialties/${spec.key}.js)
`,
      { title: spec.title, description: `Protocol-level ${spec.title.replace('FAI ', '')}`,
        icon: spec.icon, order: SPECIALTY_META.indexOf(spec) + 1, category: 'specialties',
        editUrl: `engine/specialties/${spec.key}.js` }
    );
    writeDoc(path.join(specDir, `${spec.key}.mdx`), doc);
    recordPage('specialties', `${spec.key}.mdx`, wordCount(doc), doc.length);
  }

  console.log(`    ✅ Specialties: ${SPECIALTY_META.length} pages + index`);
}

// ─── Navigation Tree (meta.json) ──────────────────────

function generateNavigation() {
  console.log('  📁 Generating navigation tree...');

  const nav = {
    version: '1.0.0',
    generated: new Date().toISOString(),
    tree: [
      { title: 'Getting Started', path: '/getting-started', icon: '🚀' },
      { title: 'Concepts', path: '/concepts', icon: '💡', children: [
        { title: 'FAI Protocol', path: '/concepts/fai-protocol' },
        { title: 'FAI Primitives', path: '/concepts/primitives' },
        { title: 'Well-Architected Framework', path: '/concepts/well-architected' }
      ]},
      { title: 'Learning', path: '/learning', icon: '📚', children:
        FROOT_MODULES.map(m => ({ title: `${m.id}: ${m.title}`, path: `/learning/${slugify(`${m.id}-${m.title}`)}`, layer: m.layer }))
      },
      { title: 'Guides', path: '/guides', icon: '🗺️', children: [
        { title: 'Deploy Your First Play', path: '/guides/deploy-first-play' },
        { title: 'Create a Custom Agent', path: '/guides/create-agent' },
        { title: 'Migrate from LangChain', path: '/guides/migrate-from-langchain' },
        { title: 'Enterprise Deployment', path: '/guides/enterprise-deployment' },
        { title: 'Troubleshooting', path: '/guides/troubleshooting' }
      ]},
      { title: 'Solution Plays', path: '/solution-plays', icon: '🎯' },
      { title: 'Primitives', path: '/primitives', icon: '🧩', children: [
        { title: 'Agents', path: '/primitives/agents' },
        { title: 'Skills', path: '/primitives/skills' },
        { title: 'Instructions', path: '/primitives/instructions' },
        { title: 'Hooks', path: '/primitives/hooks' },
        { title: 'Plugins', path: '/primitives/plugins' },
        { title: 'Workflows', path: '/primitives/workflows' }
      ]},
      { title: 'API Reference', path: '/api-reference', icon: '📖', children: [
        { title: 'MCP Tools', path: '/api-reference/mcp-tools' },
        { title: 'CLI', path: '/api-reference/cli' },
        { title: 'JSON Schemas', path: '/api-reference/schemas' }
      ]},
      { title: 'Specialties', path: '/specialties', icon: '⚡', children:
        SPECIALTY_META.map(s => ({ title: s.title, path: `/specialties/${s.key}`, icon: s.icon }))
      }
    ]
  };

  writeDoc(path.join(OUTPUT, 'meta.json'), JSON.stringify(nav, null, 2));
}

// ─── Main Execution ───────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const section = args.find(a => a.startsWith('--section='))?.split('=')[1];
  const statsOnly = args.includes('--stats');

  console.log('');
  console.log('📚 FAI Factory — Documentation Site Generator');
  console.log('═'.repeat(50));

  ensureDir(OUTPUT);

  const start = Date.now();

  if (!section || section === 'scaffold') generateScaffold();
  if (!section || section === 'getting-started') generateGettingStarted();
  if (!section || section === 'learning') generateLearningHub();
  if (!section || section === 'api-reference') generateAPIReference();
  if (!section || section === 'solution-plays') generateSolutionPlays();
  if (!section || section === 'primitives') generatePrimitiveCatalogs();
  if (!section || section === 'search') generateSearchIndex();
  if (!section || section === 'guides') generateGuides();
  if (!section || section === 'specialties') generateSpecialtiesDocs();
  if (!section) generateNavigation();

  const duration = Date.now() - start;

  // Print stats
  console.log('');
  console.log('─'.repeat(50));
  console.log('📊 Generation Statistics');
  console.log('─'.repeat(50));

  let totalPages = 0;
  let totalWords = 0;
  for (const [section, data] of Object.entries(stats.sections)) {
    console.log(`  ${section}: ${data.pages} pages, ${data.words.toLocaleString()} words`);
    totalPages += data.pages;
    totalWords += data.words;
  }

  console.log('─'.repeat(50));
  console.log(`  Total: ${totalPages} pages, ${totalWords.toLocaleString()} words, ${(stats.totalBytes / 1024).toFixed(0)}KB`);
  console.log(`  Output: ${OUTPUT}`);
  console.log(`  Duration: ${duration}ms`);

  if (stats.errors.length > 0) {
    console.log('');
    console.log(`  ⚠️  ${stats.errors.length} warning(s):`);
    stats.errors.forEach(e => console.log(`    • ${e}`));
  }

  console.log('═'.repeat(50));

  // Write generation manifest
  const genManifest = {
    generated: new Date().toISOString(),
    version: SITE_CONFIG.version,
    stats: { totalPages, totalWords, totalBytes: stats.totalBytes, sections: stats.sections },
    errors: stats.errors,
    duration
  };
  writeDoc(path.join(OUTPUT, 'generation-manifest.json'), JSON.stringify(genManifest, null, 2));
}

main();
