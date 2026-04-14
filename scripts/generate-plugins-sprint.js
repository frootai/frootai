#!/usr/bin/env node
/**
 * FrootAI Plugin Sprint — Generate 68 new plugins (9 existing → 77 total)
 * 
 * Every plugin wires REAL existing agents, instructions, skills, and hooks.
 * This is FrootAI's differentiator: plugins that wire all 9 primitives into a
 * play context — not just a loose collection.
 * 
 * Categories:
 * - Per-Play Plugins (19 new) — Each play becomes an installable bundle
 * - MCP Language Plugins (10) — Per-language MCP server toolkits
 * - Azure Specialized (8) — Azure service domain bundles
 * - Language/Framework (8) — Full-stack development bundles
 * - AI/ML (6) — Evaluation, prompt engineering, responsible AI
 * - Architecture/Planning (4) — Architecture, docs, design, planning
 * - DevOps/Infrastructure (5) — CI/CD, K8s, Terraform, Docker, incident
 * - Testing/Quality (2) — Security hardening, code quality
 * - Meta/Discovery (3) — FAI Protocol starter, discovery, context engineering
 * - Community/Integration (3) — Salesforce, Oracle migration, Power BI analytics
 */

const fs = require('fs');
const path = require('path');

const PLUGINS_DIR = path.join(__dirname, '..', 'plugins');
const AUTHOR = { name: 'FrootAI Contributors', url: 'https://frootai.dev' };
const REPO = 'https://github.com/frootai/frootai';
const LICENSE = 'MIT';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const agentRef = (name) => `../../agents/frootai-${name}.agent.md`;
const instrRef = (name) => `../../instructions/${name}.instructions.md`;
const skillRef = (name) => `../../skills/frootai-${name}/`;
const hookRef = (name) => `../../hooks/frootai-${name}/`;

// Common hook sets
const CORE_HOOKS = [hookRef('secrets-scanner'), hookRef('tool-guardian'), hookRef('governance-audit')];
const SECURITY_HOOKS = [...CORE_HOOKS, hookRef('waf-compliance')];
const FULL_HOOKS = [...CORE_HOOKS, hookRef('output-validator'), hookRef('token-budget-enforcer')];
const ALL_HOOKS = [
  hookRef('secrets-scanner'), hookRef('tool-guardian'), hookRef('governance-audit'),
  hookRef('waf-compliance'), hookRef('cost-tracker'), hookRef('pii-redactor'),
  hookRef('output-validator'), hookRef('token-budget-enforcer'), hookRef('session-logger'),
  hookRef('license-checker')
];

// Common play agent set
const playAgents = (num) => [
  agentRef(`play-${num}-builder`),
  agentRef(`play-${num}-reviewer`),
  agentRef(`play-${num}-tuner`)
];

// Common play skill set
const playSkills = (num, slug) => [
  skillRef(`deploy-${num}-${slug}`),
  skillRef(`evaluate-${num}-${slug}`),
  skillRef(`tune-${num}-${slug}`)
];

let created = 0;
let skipped = 0;

function createPlugin(name, data) {
  const dir = path.join(PLUGINS_DIR, name);
  const file = path.join(dir, 'plugin.json');
  
  if (fs.existsSync(file)) {
    skipped++;
    return;
  }

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const plugin = {
    name,
    description: data.description || data.desc,
    version: '1.0.0',
    author: AUTHOR,
    repository: REPO,
    license: LICENSE,
    keywords: data.keywords,
    ...(data.agents && data.agents.length > 0 && { agents: data.agents }),
    ...(data.instructions && data.instructions.length > 0 && { instructions: data.instructions }),
    ...(data.skills && data.skills.length > 0 && { skills: data.skills }),
    ...(data.hooks && data.hooks.length > 0 && { hooks: data.hooks }),
    ...(data.plays && data.plays.length > 0 && { plays: data.plays })
  };

  fs.writeFileSync(file, JSON.stringify(plugin, null, 2) + '\n');
  created++;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PER-PLAY PLUGINS (19 new — plays 02-20)
// ═══════════════════════════════════════════════════════════════════════════════

const playPlugins = [
  // Play 02
  {
    name: 'ai-landing-zone',
    desc: 'Azure AI Landing Zone — subscription vending, network topology, RBAC, policy enforcement, and hub-spoke architecture for enterprise AI workloads. Includes Bicep IaC modules validated against all 6 WAF pillars.',
    keywords: ['azure', 'landing-zone', 'bicep', 'rbac', 'policy', 'hub-spoke', 'enterprise', 'iac', 'waf-aligned'],
    play: '02-ai-landing-zone',
    slug: 'ai-landing-zone',
    num: '02',
    extraAgents: [agentRef('landing-zone'), agentRef('architect')],
    extraInstr: [instrRef('bicep-waf'), instrRef('security-bicep')],
    extraSkills: [skillRef('build-bicep-module'), skillRef('architecture-blueprint')],
    hooks: SECURITY_HOOKS
  },
  // Play 03
  {
    name: 'deterministic-agent',
    desc: 'Deterministic AI Agent — finite state machines, rule-based routing, guardrailed tool use, and reproducible conversation flows. Build agents that produce consistent outputs regardless of LLM temperature.',
    keywords: ['deterministic', 'finite-state-machine', 'guardrails', 'reproducible', 'rule-based', 'agent', 'waf-aligned'],
    play: '03-deterministic-agent',
    slug: 'deterministic-agent',
    num: '03',
    extraAgents: [agentRef('deterministic-expert')],
    extraInstr: [instrRef('python-waf'), instrRef('agent-safety')],
    extraSkills: [skillRef('deterministic-agent-skill'), skillRef('guardrails-policy')],
    hooks: [...CORE_HOOKS, hookRef('output-validator')]
  },
  // Play 04
  {
    name: 'call-center-voice-ai',
    desc: 'Call Center Voice AI — real-time speech-to-text, intent classification, sentiment analysis, and AI-assisted agent coaching. Integrates Azure AI Speech, Azure Communication Services, and GPT-4o for voice-driven customer service.',
    keywords: ['voice-ai', 'call-center', 'speech-to-text', 'sentiment', 'azure-communication-services', 'real-time', 'customer-service'],
    play: '04-call-center-voice-ai',
    slug: 'call-center-voice-ai',
    num: '04',
    extraAgents: [agentRef('streaming-expert')],
    extraInstr: [instrRef('python-waf'), instrRef('rai-content-safety')],
    extraSkills: [skillRef('build-genai-rag')],
    hooks: [...CORE_HOOKS, hookRef('pii-redactor'), hookRef('cost-tracker')]
  },
  // Play 05
  {
    name: 'it-ticket-resolution',
    desc: 'IT Ticket Resolution — automated incident classification, knowledge base search, resolution suggestion, and escalation routing. Uses RAG over IT documentation with Azure AI Search and Semantic Kernel orchestration.',
    keywords: ['it-service-management', 'incident-resolution', 'rag', 'knowledge-base', 'semantic-kernel', 'escalation', 'waf-aligned'],
    play: '05-it-ticket-resolution',
    slug: 'it-ticket-resolution',
    num: '05',
    extraAgents: [agentRef('rag-expert'), agentRef('semantic-kernel-expert')],
    extraInstr: [instrRef('python-waf'), instrRef('semantic-kernel')],
    extraSkills: [skillRef('build-genai-rag'), skillRef('contextual-rag')],
    hooks: [...CORE_HOOKS, hookRef('pii-redactor')]
  },
  // Play 06
  {
    name: 'document-intelligence',
    desc: 'Document Intelligence — OCR, form extraction, table recognition, and intelligent document processing. Uses Azure AI Document Intelligence with custom models for invoices, receipts, contracts, and domain-specific forms.',
    keywords: ['document-intelligence', 'ocr', 'form-extraction', 'table-recognition', 'azure-ai', 'invoice', 'contract', 'waf-aligned'],
    play: '06-document-intelligence',
    slug: 'document-intelligence',
    num: '06',
    extraAgents: [agentRef('data-engineer')],
    extraInstr: [instrRef('python-waf'), instrRef('azure-ai-document-intelligence-waf')],
    extraSkills: [skillRef('build-etl-pipeline')],
    hooks: [...CORE_HOOKS, hookRef('pii-redactor')]
  },
  // Play 07
  {
    name: 'multi-agent-service',
    desc: 'Multi-Agent Service — orchestrated agent teams with supervisor patterns, tool delegation, shared memory, and conflict resolution. Build production agent services on Azure Container Apps with Semantic Kernel or AutoGen.',
    keywords: ['multi-agent', 'orchestration', 'supervisor', 'autogen', 'semantic-kernel', 'shared-memory', 'container-apps'],
    play: '07-multi-agent-service',
    slug: 'multi-agent-service',
    num: '07',
    extraAgents: [agentRef('swarm-supervisor'), agentRef('semantic-kernel-expert')],
    extraInstr: [instrRef('python-waf'), instrRef('agent-coding-patterns')],
    extraSkills: [skillRef('build-agentic-loops'), skillRef('human-in-the-loop')],
    hooks: FULL_HOOKS
  },
  // Play 08
  {
    name: 'copilot-studio-bot',
    desc: 'Copilot Studio Bot — custom copilot experiences with Microsoft Copilot Studio, Power Virtual Agents, and Teams integration. Build conversational AI with enterprise SSO, Dataverse, and multi-channel deployment.',
    keywords: ['copilot-studio', 'power-virtual-agents', 'teams', 'dataverse', 'conversational-ai', 'sso', 'enterprise'],
    play: '08-copilot-studio-bot',
    slug: 'copilot-studio-bot',
    num: '08',
    extraAgents: [agentRef('power-platform-expert'), agentRef('copilot-ecosystem-expert')],
    extraInstr: [instrRef('copilot-studio-waf'), instrRef('dataverse-waf')],
    extraSkills: [skillRef('copilot-sdk-integration'), skillRef('power-platform-connector')],
    hooks: SECURITY_HOOKS
  },
  // Play 09
  {
    name: 'ai-search-portal',
    desc: 'AI Search Portal — full-text and vector hybrid search with semantic ranking, faceted navigation, autocomplete, and personalized results. Build a production search experience on Azure AI Search with RAG integration.',
    keywords: ['ai-search', 'vector-search', 'semantic-ranking', 'hybrid-search', 'faceted-navigation', 'azure-ai-search', 'rag'],
    play: '09-ai-search-portal',
    slug: 'ai-search-portal',
    num: '09',
    extraAgents: [agentRef('azure-ai-search-expert'), agentRef('embedding-expert')],
    extraInstr: [instrRef('python-waf'), instrRef('nextjs-waf')],
    extraSkills: [skillRef('azure-ai-search-index'), skillRef('build-semantic-search')],
    hooks: CORE_HOOKS
  },
  // Play 10
  {
    name: 'content-moderation',
    desc: 'Content Moderation — real-time text, image, and multi-modal content safety with Azure AI Content Safety. Includes severity scoring, blocklist management, custom categories, and human-in-the-loop review workflows.',
    keywords: ['content-moderation', 'content-safety', 'azure-ai', 'image-moderation', 'text-moderation', 'blocklist', 'responsible-ai'],
    play: '10-content-moderation',
    slug: 'content-moderation',
    num: '10',
    extraAgents: [agentRef('content-safety-expert'), agentRef('responsible-ai-reviewer')],
    extraInstr: [instrRef('rai-content-safety'), instrRef('rai-bias-testing')],
    extraSkills: [skillRef('content-safety-review'), skillRef('human-in-the-loop')],
    hooks: [...CORE_HOOKS, hookRef('pii-redactor'), hookRef('output-validator')]
  },
  // Play 11
  {
    name: 'ai-landing-zone-advanced',
    desc: 'Advanced AI Landing Zone — multi-region deployment, private endpoints, Azure Firewall, DDoS protection, sovereign cloud patterns, and compliance-ready infrastructure for regulated industries.',
    keywords: ['landing-zone', 'multi-region', 'private-endpoints', 'firewall', 'compliance', 'sovereign-cloud', 'regulated', 'enterprise'],
    play: '11-ai-landing-zone-advanced',
    slug: 'ai-landing-zone-advanced',
    num: '11',
    extraAgents: [agentRef('landing-zone'), agentRef('azure-networking-expert'), agentRef('compliance-expert')],
    extraInstr: [instrRef('bicep-waf'), instrRef('security-bicep'), instrRef('azure-front-door-waf')],
    extraSkills: [skillRef('build-bicep-module'), skillRef('threat-model')],
    hooks: [...SECURITY_HOOKS, hookRef('cost-tracker')]
  },
  // Play 12
  {
    name: 'model-serving-aks',
    desc: 'Model Serving on AKS — GPU-accelerated inference, autoscaling with KEDA, model versioning, A/B deployment, and canary rollouts. Deploy open-source LLMs (Phi-4, Llama, Mistral) on Azure Kubernetes Service.',
    keywords: ['model-serving', 'aks', 'kubernetes', 'gpu', 'keda', 'inference', 'llm-deployment', 'canary', 'autoscaling'],
    play: '12-model-serving-aks',
    slug: 'model-serving-aks',
    num: '12',
    extraAgents: [agentRef('azure-aks-expert'), agentRef('kubernetes-expert'), agentRef('ml-engineer')],
    extraInstr: [instrRef('kubernetes-waf'), instrRef('docker-waf')],
    extraSkills: [skillRef('build-kubernetes-manifest'), skillRef('multi-stage-docker'), skillRef('inference-optimization')],
    hooks: [...CORE_HOOKS, hookRef('cost-tracker'), hookRef('token-budget-enforcer')]
  },
  // Play 13
  {
    name: 'fine-tuning-workflow',
    desc: 'Fine-Tuning Workflow — dataset preparation, training job orchestration, evaluation pipelines, model registry, and deployment automation. Fine-tune GPT, Phi, and open-source models on Azure AI Foundry.',
    keywords: ['fine-tuning', 'mlops', 'dataset-preparation', 'model-registry', 'azure-ai-foundry', 'evaluation', 'training'],
    play: '13-fine-tuning-workflow',
    slug: 'fine-tuning-workflow',
    num: '13',
    extraAgents: [agentRef('fine-tuning-expert'), agentRef('ml-engineer')],
    extraInstr: [instrRef('python-waf'), instrRef('fine-tuning-data')],
    extraSkills: [skillRef('fine-tune-llm'), skillRef('build-llm-evaluator')],
    hooks: [...CORE_HOOKS, hookRef('cost-tracker')]
  },
  // Play 14
  {
    name: 'cost-optimized-ai-gateway',
    desc: 'Cost-Optimized AI Gateway — intelligent model routing, token budget enforcement, request caching, rate limiting, and usage analytics. Route between GPT-4o, GPT-4o-mini, and Phi models based on complexity and cost.',
    keywords: ['cost-optimization', 'ai-gateway', 'model-routing', 'token-budget', 'caching', 'rate-limiting', 'apim', 'usage-analytics'],
    play: '14-cost-optimized-ai-gateway',
    slug: 'cost-optimized-ai-gateway',
    num: '14',
    extraAgents: [agentRef('cost-optimizer'), agentRef('cost-gateway'), agentRef('azure-apim-expert')],
    extraInstr: [instrRef('cost-python'), instrRef('cost-typescript')],
    extraSkills: [skillRef('cost-estimator'), skillRef('az-cost-optimize'), skillRef('model-recommendation')],
    hooks: [...CORE_HOOKS, hookRef('cost-tracker'), hookRef('token-budget-enforcer')]
  },
  // Play 15
  {
    name: 'multi-modal-docproc',
    desc: 'Multi-Modal Document Processing — combine OCR, vision, speech, and text analysis for complex document workflows. Extract structured data from PDFs, images, audio, and video using Azure AI multi-modal capabilities.',
    keywords: ['multi-modal', 'document-processing', 'ocr', 'vision', 'speech', 'pdf-extraction', 'azure-ai', 'structured-data'],
    play: '15-multi-modal-docproc',
    slug: 'multi-modal-docproc',
    num: '15',
    extraAgents: [agentRef('data-engineer')],
    extraInstr: [instrRef('python-waf'), instrRef('azure-ai-vision-waf'), instrRef('azure-ai-speech-waf')],
    extraSkills: [skillRef('build-etl-pipeline')],
    hooks: [...CORE_HOOKS, hookRef('pii-redactor')]
  },
  // Play 16
  {
    name: 'copilot-teams-extension',
    desc: 'Copilot for Teams Extension — declarative agents, API plugins, message extensions, and adaptive cards for Microsoft 365 Copilot. Build custom AI experiences that surface inside Teams, Outlook, and M365 apps.',
    keywords: ['teams', 'copilot-extension', 'declarative-agent', 'api-plugin', 'message-extension', 'adaptive-cards', 'm365'],
    play: '16-copilot-teams-extension',
    slug: 'copilot-teams-extension',
    num: '16',
    extraAgents: [agentRef('copilot-ecosystem-expert')],
    extraInstr: [instrRef('typescript-waf'), instrRef('copilot-extensibility')],
    extraSkills: [skillRef('copilot-sdk-integration')],
    hooks: SECURITY_HOOKS
  },
  // Play 17
  {
    name: 'ai-observability',
    desc: 'AI Observability — distributed tracing for LLM calls, token usage dashboards, latency monitoring, evaluation score tracking, and alerting. Build full observability for AI workloads with Azure Monitor and OpenTelemetry.',
    keywords: ['observability', 'monitoring', 'tracing', 'opentelemetry', 'azure-monitor', 'token-usage', 'latency', 'dashboards'],
    play: '17-ai-observability',
    slug: 'ai-observability',
    num: '17',
    extraAgents: [agentRef('azure-monitor-expert'), agentRef('performance-profiler')],
    extraInstr: [instrRef('opex-monitoring'), instrRef('python-waf')],
    extraSkills: [skillRef('copilot-usage-metrics')],
    hooks: [...CORE_HOOKS, hookRef('session-logger'), hookRef('cost-tracker')]
  },
  // Play 18
  {
    name: 'prompt-management',
    desc: 'Prompt Management — version-controlled prompt templates, A/B testing, evaluation pipelines, and dynamic prompt assembly. Manage hundreds of prompts across models with Semantic Kernel prompt functions.',
    keywords: ['prompt-management', 'prompt-engineering', 'template', 'ab-testing', 'evaluation', 'semantic-kernel', 'versioning'],
    play: '18-prompt-management',
    slug: 'prompt-management',
    num: '18',
    extraAgents: [agentRef('prompt-engineer'), agentRef('semantic-kernel-expert')],
    extraInstr: [instrRef('prompt-engineering'), instrRef('python-waf')],
    extraSkills: [skillRef('prompt-builder'), skillRef('dynamic-prompt'), skillRef('basic-prompt-optimization')],
    hooks: [...CORE_HOOKS, hookRef('output-validator')]
  },
  // Play 19
  {
    name: 'edge-ai-phi4',
    desc: 'Edge AI with Phi-4 — deploy small language models on edge devices, IoT hubs, and local inference servers. Quantization, ONNX optimization, and offline-capable AI with Microsoft Phi-4 models.',
    keywords: ['edge-ai', 'phi-4', 'onnx', 'quantization', 'iot', 'local-inference', 'small-language-model', 'offline'],
    play: '19-edge-ai-phi4',
    slug: 'edge-ai-phi4',
    num: '19',
    extraAgents: [agentRef('ml-engineer')],
    extraInstr: [instrRef('python-waf'), instrRef('docker-waf')],
    extraSkills: [skillRef('inference-optimization'), skillRef('multi-stage-docker')],
    hooks: [...CORE_HOOKS, hookRef('cost-tracker')]
  },
  // Play 20
  {
    name: 'anomaly-detection',
    desc: 'Anomaly Detection — real-time and batch anomaly detection for time-series, metrics, and log data. Uses Azure AI Anomaly Detector, custom ML models, and event-driven alerting with Azure Event Hubs.',
    keywords: ['anomaly-detection', 'time-series', 'metrics', 'alerting', 'event-hubs', 'azure-ai', 'real-time', 'ml'],
    play: '20-anomaly-detection',
    slug: 'anomaly-detection',
    num: '20',
    extraAgents: [agentRef('data-engineer'), agentRef('ml-engineer')],
    extraInstr: [instrRef('python-waf'), instrRef('opex-monitoring')],
    extraSkills: [skillRef('build-etl-pipeline')],
    hooks: [...CORE_HOOKS, hookRef('session-logger')]
  }
];

for (const p of playPlugins) {
  createPlugin(p.name, {
    description: p.desc,
    keywords: p.keywords,
    agents: [...playAgents(p.num), ...p.extraAgents],
    instructions: [instrRef(`play-${p.num}-${p.slug}-patterns`), ...p.extraInstr],
    skills: [...playSkills(p.num, p.slug), ...p.extraSkills],
    hooks: p.hooks,
    plays: [p.play]
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. MCP LANGUAGE PLUGINS (10)
// ═══════════════════════════════════════════════════════════════════════════════

const mcpLangs = [
  { lang: 'csharp', keywords: ['csharp', 'dotnet', 'mcp', 'aspnet', 'sdk'], desc: 'C# MCP Development — build Model Context Protocol servers in C# with .NET SDK, ASP.NET Core hosting, dependency injection, and Azure deployment patterns.' },
  { lang: 'go', keywords: ['go', 'golang', 'mcp', 'gin', 'grpc'], desc: 'Go MCP Development — build high-performance MCP servers in Go with goroutine concurrency, gRPC transport, and minimal memory footprint for edge deployment.' },
  { lang: 'java', keywords: ['java', 'spring-boot', 'mcp', 'maven', 'reactor'], desc: 'Java MCP Development — build MCP servers in Java with Spring Boot, reactive streams, Maven/Gradle builds, and enterprise middleware integration.' },
  { lang: 'kotlin', keywords: ['kotlin', 'ktor', 'mcp', 'coroutines', 'multiplatform'], desc: 'Kotlin MCP Development — build MCP servers in Kotlin with Ktor, coroutines, multiplatform support, and Android-compatible tool implementations.' },
  { lang: 'php', keywords: ['php', 'laravel', 'mcp', 'composer', 'swoole'], desc: 'PHP MCP Development — build MCP servers in PHP with Laravel integration, Composer packaging, Swoole async runtime, and WordPress compatibility.' },
  { lang: 'python', keywords: ['python', 'fastmcp', 'mcp', 'asyncio', 'pydantic'], desc: 'Python MCP Development — build MCP servers in Python with FastMCP, asyncio, Pydantic models, type-safe tool schemas, and Azure Functions hosting.' },
  { lang: 'ruby', keywords: ['ruby', 'rails', 'mcp', 'rack', 'sorbet'], desc: 'Ruby MCP Development — build MCP servers in Ruby with Rails integration, Rack middleware, Sorbet typing, and Bundler gem packaging.' },
  { lang: 'rust', keywords: ['rust', 'tokio', 'mcp', 'rmcp', 'wasm'], desc: 'Rust MCP Development — build blazing-fast MCP servers in Rust with Tokio async runtime, RMCP SDK, WASM compilation, and zero-allocation tool handlers.' },
  { lang: 'swift', keywords: ['swift', 'mcp', 'ios', 'macos', 'vapor', 'swiftui'], desc: 'Swift MCP Development — build MCP servers in Swift with Vapor framework, SwiftUI tool previews, iOS/macOS native integration, and Apple silicon optimization.' },
  { lang: 'typescript', keywords: ['typescript', 'nodejs', 'mcp', 'express', 'zod'], desc: 'TypeScript MCP Development — build MCP servers in TypeScript with Node.js, Express/Fastify hosting, Zod schema validation, and npm package distribution.' }
];

for (const m of mcpLangs) {
  createPlugin(`${m.lang}-mcp-development`, {
    description: m.desc,
    keywords: [...m.keywords, 'model-context-protocol', 'tool-server'],
    agents: [agentRef(`${m.lang}-mcp-expert`), agentRef(`${m.lang}-expert`)],
    instructions: [instrRef(`${m.lang}-mcp-development`), instrRef(`${m.lang}-waf`)],
    skills: [skillRef(`mcp-${m.lang}-scaffold`), skillRef(`mcp-${m.lang}-generator`)],
    hooks: CORE_HOOKS,
    plays: []
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. AZURE SPECIALIZED PLUGINS (8)
// ═══════════════════════════════════════════════════════════════════════════════

const azurePlugins = [
  {
    name: 'azure-ai-services',
    desc: 'Azure AI Services — OpenAI, AI Search, Document Intelligence, Language, Speech, Vision, and Content Safety integration patterns. Production-ready wrappers with retry, circuit breaker, and cost tracking.',
    keywords: ['azure', 'ai-services', 'openai', 'ai-search', 'document-intelligence', 'language', 'speech', 'vision', 'content-safety'],
    agents: [agentRef('azure-openai-expert'), agentRef('azure-ai-search-expert'), agentRef('azure-ai-foundry-expert'), agentRef('content-safety-expert'), agentRef('embedding-expert')],
    instructions: [instrRef('azure-ai-document-intelligence-waf'), instrRef('azure-ai-language-waf'), instrRef('azure-ai-speech-waf'), instrRef('azure-ai-vision-waf')],
    skills: [skillRef('azure-openai-integration'), skillRef('azure-ai-search-index'), skillRef('azure-ai-foundry-setup'), skillRef('azure-cognitive-services'), skillRef('content-safety-review')],
    hooks: [...CORE_HOOKS, hookRef('cost-tracker'), hookRef('token-budget-enforcer')]
  },
  {
    name: 'azure-infrastructure',
    desc: 'Azure Infrastructure — landing zones, hub-spoke networking, private endpoints, Azure Policy, RBAC, and subscription vending. Enterprise-grade Bicep IaC for AI workloads validated against all 6 WAF pillars.',
    keywords: ['azure', 'infrastructure', 'landing-zone', 'bicep', 'networking', 'policy', 'rbac', 'private-endpoints', 'hub-spoke'],
    agents: [agentRef('landing-zone'), agentRef('architect'), agentRef('azure-networking-expert'), agentRef('azure-policy-expert'), agentRef('azure-identity-expert')],
    instructions: [instrRef('bicep-waf'), instrRef('security-bicep'), instrRef('bicep-code-best-practices'), instrRef('azure-bicep-avm'), instrRef('azure-front-door-waf')],
    skills: [skillRef('build-bicep-module'), skillRef('architecture-blueprint'), skillRef('azure-resource-visualizer'), skillRef('threat-model'), skillRef('import-iac')],
    hooks: SECURITY_HOOKS
  },
  {
    name: 'azure-data-services',
    desc: 'Azure Data Services — Cosmos DB, SQL Database, Blob Storage, Data Explorer, and Redis Cache patterns. Schema design, partition strategies, query optimization, and data lifecycle management.',
    keywords: ['azure', 'cosmos-db', 'sql-database', 'storage', 'data-explorer', 'redis', 'data-services', 'schema-design'],
    agents: [agentRef('azure-cosmos-db-expert'), agentRef('azure-sql-expert'), agentRef('azure-storage-expert'), agentRef('data-engineer'), agentRef('redis-expert')],
    instructions: [instrRef('azure-cosmos-waf'), instrRef('azure-redis-waf'), instrRef('sql-optimization-waf'), instrRef('mongodb-waf')],
    skills: [skillRef('azure-cosmos-modeling'), skillRef('azure-sql-setup'), skillRef('azure-storage-patterns'), skillRef('azure-data-explorer'), skillRef('build-nosql-data-model'), skillRef('build-sql-migration')],
    hooks: CORE_HOOKS
  },
  {
    name: 'azure-serverless',
    desc: 'Azure Serverless — Functions, Logic Apps, Event Grid, and Durable Functions patterns. Event-driven architectures with consumption-based scaling, cold start mitigation, and cost optimization.',
    keywords: ['azure', 'serverless', 'functions', 'logic-apps', 'event-grid', 'durable-functions', 'event-driven', 'consumption'],
    agents: [agentRef('azure-functions-expert'), agentRef('azure-logic-apps-expert'), agentRef('event-driven-expert')],
    instructions: [instrRef('azure-functions-waf'), instrRef('azure-logic-apps-waf')],
    skills: [skillRef('azure-functions-setup'), skillRef('azure-event-grid-setup')],
    hooks: [...CORE_HOOKS, hookRef('cost-tracker')]
  },
  {
    name: 'azure-monitoring',
    desc: 'Azure Monitoring — Application Insights, Log Analytics, KQL queries, alert rules, workbooks, and dashboards. Full observability for AI workloads with custom metrics, distributed tracing, and SLO tracking.',
    keywords: ['azure', 'monitoring', 'application-insights', 'log-analytics', 'kql', 'alerts', 'dashboards', 'observability'],
    agents: [agentRef('azure-monitor-expert'), agentRef('performance-profiler'), agentRef('incident-responder')],
    instructions: [instrRef('opex-monitoring'), instrRef('performance-optimization-waf')],
    skills: [skillRef('copilot-usage-metrics'), skillRef('azure-resource-health')],
    hooks: [...CORE_HOOKS, hookRef('session-logger')]
  },
  {
    name: 'azure-identity-security',
    desc: 'Azure Identity & Security — Managed Identity, Key Vault, RBAC, Conditional Access, and zero-trust architecture. Secure AI workloads with certificate-based auth, secret rotation, and compliance auditing.',
    keywords: ['azure', 'identity', 'security', 'key-vault', 'managed-identity', 'rbac', 'zero-trust', 'conditional-access'],
    agents: [agentRef('azure-identity-expert'), agentRef('azure-key-vault-expert'), agentRef('security-reviewer'), agentRef('compliance-expert')],
    instructions: [instrRef('security-python'), instrRef('security-typescript'), instrRef('security-csharp'), instrRef('security-owasp')],
    skills: [skillRef('azure-key-vault-setup'), skillRef('azure-role-selector'), skillRef('secret-scanning'), skillRef('threat-model'), skillRef('security-review-skill')],
    hooks: ALL_HOOKS
  },
  {
    name: 'azure-messaging',
    desc: 'Azure Messaging — Service Bus, Event Hubs, and Event Grid patterns for async communication, event sourcing, and CQRS. Build reliable message-driven architectures with dead-letter handling and partitioning.',
    keywords: ['azure', 'service-bus', 'event-hubs', 'event-grid', 'messaging', 'async', 'cqrs', 'event-sourcing'],
    agents: [agentRef('azure-service-bus-expert'), agentRef('azure-event-hubs-expert'), agentRef('event-driven-expert')],
    instructions: [instrRef('reliability-python'), instrRef('reliability-typescript')],
    skills: [skillRef('azure-service-bus-setup'), skillRef('azure-event-hubs-setup'), skillRef('azure-event-grid-setup')],
    hooks: CORE_HOOKS
  },
  {
    name: 'azure-containers',
    desc: 'Azure Containers — AKS, Container Apps, Container Registry, and Dockerized deployment patterns. GPU workloads, KEDA autoscaling, Dapr sidecar integration, and multi-arch builds for AI model serving.',
    keywords: ['azure', 'aks', 'container-apps', 'acr', 'docker', 'keda', 'dapr', 'gpu', 'kubernetes'],
    agents: [agentRef('azure-aks-expert'), agentRef('azure-container-apps-expert'), agentRef('kubernetes-expert'), agentRef('docker-expert')],
    instructions: [instrRef('kubernetes-waf'), instrRef('docker-waf'), instrRef('containerization-waf')],
    skills: [skillRef('build-kubernetes-manifest'), skillRef('multi-stage-docker'), skillRef('azure-container-registry'), skillRef('containerize-aspnet')],
    hooks: [...CORE_HOOKS, hookRef('cost-tracker')]
  }
];

for (const p of azurePlugins) {
  createPlugin(p.name, p);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. LANGUAGE / FRAMEWORK PLUGINS (8)
// ═══════════════════════════════════════════════════════════════════════════════

const langPlugins = [
  {
    name: 'csharp-dotnet-development',
    desc: 'C# .NET Development — ASP.NET Core, Minimal API, Blazor, MAUI, EF Core, xUnit/NUnit testing, and architecture patterns. Full-stack .NET with WAF-aligned coding standards and code review agents.',
    keywords: ['csharp', 'dotnet', 'aspnet', 'blazor', 'maui', 'ef-core', 'xunit', 'minimal-api'],
    agents: [agentRef('csharp-expert'), agentRef('dotnet-maui-expert'), agentRef('blazor-expert')],
    instructions: [instrRef('csharp-waf'), instrRef('aspnet-waf'), instrRef('blazor-waf'), instrRef('minimal-api-waf'), instrRef('ef-core-waf'), instrRef('xunit-waf')],
    skills: [skillRef('aspnet-minimal-api'), skillRef('aspire-orchestration'), skillRef('xunit-test'), skillRef('nunit-test'), skillRef('mstest-test')],
    hooks: CORE_HOOKS
  },
  {
    name: 'java-development',
    desc: 'Java Development — Spring Boot, Quarkus, JUnit 5, Gradle/Maven builds, and microservice patterns. Enterprise Java with reactive streams, GraalVM native images, and cloud-native deployment.',
    keywords: ['java', 'spring-boot', 'quarkus', 'junit', 'maven', 'gradle', 'microservices', 'graalvm'],
    agents: [agentRef('java-expert'), agentRef('java-mcp-expert')],
    instructions: [instrRef('java-waf'), instrRef('springboot-waf'), instrRef('quarkus-waf')],
    skills: [skillRef('springboot-scaffold'), skillRef('springboot-kotlin-scaffold'), skillRef('springboot-test'), skillRef('junit-test'), skillRef('java-extract-method')],
    hooks: CORE_HOOKS
  },
  {
    name: 'python-fullstack',
    desc: 'Python Full-Stack — FastAPI, Django, Flask, Pydantic, SQLAlchemy, pytest, and async patterns. Data science to web APIs with type safety, dependency injection, and production deployment.',
    keywords: ['python', 'fastapi', 'django', 'flask', 'pydantic', 'sqlalchemy', 'pytest', 'async'],
    agents: [agentRef('python-expert'), agentRef('python-mcp-expert')],
    instructions: [instrRef('python-waf'), instrRef('fastapi-waf'), instrRef('django-waf'), instrRef('flask-waf'), instrRef('pydantic-waf'), instrRef('sqlalchemy-waf'), instrRef('pytest-waf')],
    skills: [skillRef('fastapi-scaffold'), skillRef('pytest-coverage'), skillRef('playwright-python-test')],
    hooks: CORE_HOOKS
  },
  {
    name: 'typescript-fullstack',
    desc: 'TypeScript Full-Stack — Next.js, React, NestJS, Prisma, Zod, Vitest, and end-to-end type safety. Modern web development with server components, tRPC, and Tailwind CSS.',
    keywords: ['typescript', 'nextjs', 'react', 'nestjs', 'prisma', 'zod', 'vitest', 'tailwind'],
    agents: [agentRef('typescript-expert'), agentRef('react-expert')],
    instructions: [instrRef('typescript-waf'), instrRef('nextjs-waf'), instrRef('nestjs-waf'), instrRef('prisma-waf'), instrRef('zod-waf'), instrRef('vitest-waf'), instrRef('tailwind-waf'), instrRef('trpc-waf')],
    skills: [skillRef('nextjs-scaffold'), skillRef('react-component-scaffold'), skillRef('jest-test'), skillRef('playwright-test')],
    hooks: CORE_HOOKS
  },
  {
    name: 'go-development',
    desc: 'Go Development — high-performance services, gRPC APIs, concurrent patterns, and cloud-native tooling. Idiomatic Go with table-driven tests, error handling, and minimal dependency builds.',
    keywords: ['go', 'golang', 'grpc', 'concurrency', 'cloud-native', 'microservices', 'minimal'],
    agents: [agentRef('go-expert'), agentRef('go-mcp-expert')],
    instructions: [instrRef('go-waf'), instrRef('grpc-waf')],
    skills: [skillRef('mcp-go-scaffold')],
    hooks: CORE_HOOKS
  },
  {
    name: 'rust-development',
    desc: 'Rust Development — systems programming, zero-cost abstractions, async with Tokio, WASM targets, and memory-safe concurrency. Build high-performance tools, CLIs, and servers without garbage collection.',
    keywords: ['rust', 'tokio', 'wasm', 'systems-programming', 'memory-safety', 'async', 'cli'],
    agents: [agentRef('rust-expert'), agentRef('rust-mcp-expert')],
    instructions: [instrRef('rust-waf')],
    skills: [skillRef('mcp-rust-scaffold')],
    hooks: CORE_HOOKS
  },
  {
    name: 'frontend-web-development',
    desc: 'Frontend Web Development — React, Angular, Vue, Svelte, Astro, and Tailwind CSS patterns. Component architecture, state management, accessibility, and performance optimization for modern web apps.',
    keywords: ['frontend', 'react', 'angular', 'vue', 'svelte', 'astro', 'tailwind', 'accessibility', 'responsive'],
    agents: [agentRef('react-expert'), agentRef('vue-expert'), agentRef('svelte-expert'), agentRef('angular-expert'), agentRef('ux-designer'), agentRef('accessibility-expert')],
    instructions: [instrRef('html-css-waf'), instrRef('tailwind-waf'), instrRef('nextjs-waf'), instrRef('nuxt-waf'), instrRef('svelte-waf'), instrRef('astro-waf'), instrRef('a11y-waf')],
    skills: [skillRef('react-component-scaffold'), skillRef('design-ui-components'), skillRef('design-responsive'), skillRef('design-accessibility'), skillRef('design-themes'), skillRef('premium-frontend-ui')],
    hooks: CORE_HOOKS
  },
  {
    name: 'mobile-development',
    desc: 'Mobile Development — Swift/SwiftUI for iOS, Kotlin for Android, .NET MAUI for cross-platform, and Flutter/Dart for hybrid apps. Native AI integration with on-device inference and platform-specific UX patterns.',
    keywords: ['mobile', 'ios', 'android', 'swift', 'kotlin', 'maui', 'flutter', 'dart', 'cross-platform'],
    agents: [agentRef('swift-expert'), agentRef('kotlin-expert'), agentRef('dotnet-maui-expert')],
    instructions: [instrRef('swift-waf'), instrRef('kotlin-waf'), instrRef('maui-waf'), instrRef('dart-flutter-waf')],
    skills: [skillRef('mcp-swift-scaffold'), skillRef('mcp-kotlin-scaffold')],
    hooks: CORE_HOOKS
  }
];

for (const p of langPlugins) {
  createPlugin(p.name, p);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. AI / ML PLUGINS (6)
// ═══════════════════════════════════════════════════════════════════════════════

const aiPlugins = [
  {
    name: 'ai-evaluation-suite',
    desc: 'AI Evaluation Suite — groundedness, coherence, relevance, fluency, and safety scoring. Build evaluation pipelines with Azure AI Evaluation SDK, custom metrics, regression tracking, and CI/CD integration.',
    keywords: ['evaluation', 'groundedness', 'coherence', 'relevance', 'safety', 'metrics', 'regression', 'ci-cd', 'quality'],
    agents: [agentRef('responsible-ai-reviewer'), agentRef('content-safety-expert')],
    instructions: [instrRef('rai-content-safety'), instrRef('rai-bias-testing'), instrRef('responsible-ai-coding')],
    skills: [skillRef('eval-runner'), skillRef('evaluation-framework'), skillRef('build-llm-evaluator'), skillRef('agentic-eval'), skillRef('eval-driven-dev')],
    hooks: [...CORE_HOOKS, hookRef('output-validator')]
  },
  {
    name: 'prompt-engineering',
    desc: 'Prompt Engineering — chain-of-thought, few-shot, tree-of-thought, and meta-prompting patterns. Template management, dynamic prompt assembly, safety guardrails, and evaluation-driven prompt optimization.',
    keywords: ['prompt-engineering', 'chain-of-thought', 'few-shot', 'templates', 'safety', 'optimization', 'meta-prompting'],
    agents: [agentRef('prompt-engineer'), agentRef('genai-foundations-expert')],
    instructions: [instrRef('prompt-engineering'), instrRef('ai-prompt-safety-waf'), instrRef('genai-foundations')],
    skills: [skillRef('prompt-builder'), skillRef('dynamic-prompt'), skillRef('basic-prompt-optimization'), skillRef('boost-prompt'), skillRef('tldr-prompt'), skillRef('finalize-agent-prompt'), skillRef('build-prompting-system')],
    hooks: [...CORE_HOOKS, hookRef('output-validator'), hookRef('token-budget-enforcer')]
  },
  {
    name: 'responsible-ai',
    desc: 'Responsible AI — content safety, bias testing, fairness metrics, transparency cards, and human-in-the-loop review. Build ethical AI systems aligned with Microsoft Responsible AI Standard and EU AI Act requirements.',
    keywords: ['responsible-ai', 'content-safety', 'bias', 'fairness', 'transparency', 'human-in-the-loop', 'eu-ai-act', 'ethics'],
    agents: [agentRef('responsible-ai-reviewer'), agentRef('content-safety-expert'), agentRef('red-team-expert')],
    instructions: [instrRef('rai-content-safety'), instrRef('rai-bias-testing'), instrRef('responsible-ai-coding'), instrRef('agent-safety')],
    skills: [skillRef('content-safety-review'), skillRef('human-in-the-loop'), skillRef('guardrails-policy'), skillRef('gdpr-compliance')],
    hooks: [...CORE_HOOKS, hookRef('pii-redactor'), hookRef('output-validator')]
  },
  {
    name: 'fine-tuning-mlops',
    desc: 'Fine-Tuning & MLOps — dataset curation, model training, hyperparameter optimization, model registry, and deployment pipelines. End-to-end ML lifecycle with Azure AI Foundry, MLflow, and evaluation gates.',
    keywords: ['fine-tuning', 'mlops', 'model-training', 'dataset', 'hyperparameter', 'mlflow', 'model-registry', 'azure-ai-foundry'],
    agents: [agentRef('fine-tuning-expert'), agentRef('ml-engineer'), agentRef('data-engineer')],
    instructions: [instrRef('fine-tuning-data'), instrRef('python-waf')],
    skills: [skillRef('fine-tune-llm'), skillRef('build-llm-evaluator'), skillRef('model-recommendation'), skillRef('inference-optimization'), skillRef('build-tokenizer')],
    hooks: [...CORE_HOOKS, hookRef('cost-tracker')]
  },
  {
    name: 'llm-observability',
    desc: 'LLM Observability — trace every LLM call with input/output logging, token counts, latency percentiles, cost attribution, and evaluation score trends. OpenTelemetry-based tracing for Azure OpenAI and open-source models.',
    keywords: ['llm-observability', 'tracing', 'token-counting', 'latency', 'cost-attribution', 'opentelemetry', 'azure-openai'],
    agents: [agentRef('azure-monitor-expert'), agentRef('performance-profiler')],
    instructions: [instrRef('opex-monitoring'), instrRef('performance-optimization-waf')],
    skills: [skillRef('copilot-usage-metrics'), skillRef('azure-resource-health')],
    hooks: [...CORE_HOOKS, hookRef('session-logger'), hookRef('cost-tracker'), hookRef('token-budget-enforcer')]
  },
  {
    name: 'content-safety-toolkit',
    desc: 'Content Safety Toolkit — Azure AI Content Safety integration, custom blocklists, severity thresholds, image moderation, prompt injection detection, and jailbreak defense patterns for production AI.',
    keywords: ['content-safety', 'moderation', 'blocklist', 'prompt-injection', 'jailbreak', 'image-moderation', 'azure-ai'],
    agents: [agentRef('content-safety-expert'), agentRef('red-team-expert')],
    instructions: [instrRef('rai-content-safety'), instrRef('ai-prompt-safety-waf')],
    skills: [skillRef('content-safety-review'), skillRef('guardrails-policy')],
    hooks: [...CORE_HOOKS, hookRef('output-validator'), hookRef('pii-redactor')]
  }
];

for (const p of aiPlugins) {
  createPlugin(p.name, p);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. ARCHITECTURE / PLANNING PLUGINS (4)
// ═══════════════════════════════════════════════════════════════════════════════

const archPlugins = [
  {
    name: 'project-planning',
    desc: 'Project Planning — PRDs, epic breakdown, implementation plans, technical spikes, and rollout strategies. AI-assisted project management with architecture decision records and feature decomposition.',
    keywords: ['project-planning', 'prd', 'epic-breakdown', 'implementation-plan', 'technical-spike', 'roadmap', 'adr'],
    agents: [agentRef('product-manager'), agentRef('prd-writer'), agentRef('specification-writer'), agentRef('epic-breakdown-expert')],
    instructions: [instrRef('markdown-waf')],
    skills: [skillRef('prd-generator'), skillRef('epic-breakdown-pm'), skillRef('epic-breakdown-arch'), skillRef('implementation-plan-generator'), skillRef('specification-generator'), skillRef('technical-spike'), skillRef('rollout-plan'), skillRef('feature-breakdown')],
    hooks: CORE_HOOKS
  },
  {
    name: 'architecture-patterns',
    desc: 'Architecture Patterns — cloud design patterns, domain-driven design, microservices, event sourcing, CQRS, and hexagonal architecture. Generate architecture blueprints, C4 diagrams, and ADRs.',
    keywords: ['architecture', 'design-patterns', 'ddd', 'microservices', 'cqrs', 'event-sourcing', 'hexagonal', 'c4-diagram'],
    agents: [agentRef('architect'), agentRef('solutions-architect'), agentRef('api-gateway-designer')],
    instructions: [instrRef('design-patterns-waf'), instrRef('dotnet-architecture-waf'), instrRef('graphql-waf'), instrRef('grpc-waf')],
    skills: [skillRef('architecture-blueprint'), skillRef('architecture-decision-record'), skillRef('cloud-design-patterns'), skillRef('domain-driven-design'), skillRef('tech-stack-blueprint'), skillRef('context-map')],
    hooks: CORE_HOOKS
  },
  {
    name: 'technical-documentation',
    desc: 'Technical Documentation — API references, architecture guides, README generation, changelog automation, tutorials, and ADRs. AI-assisted writing with Mermaid diagrams, PlantUML, and DrawIO integration.',
    keywords: ['documentation', 'api-reference', 'readme', 'changelog', 'tutorial', 'mermaid', 'plantuml', 'drawio'],
    agents: [agentRef('technical-writer'), agentRef('adr-writer'), agentRef('mermaid-diagram-expert'), agentRef('markdown-expert')],
    instructions: [instrRef('markdown-waf'), instrRef('drawio-waf'), instrRef('self-documenting-code-waf')],
    skills: [skillRef('documentation-writer'), skillRef('readme-generator'), skillRef('changelog-generator'), skillRef('api-docs-generator'), skillRef('tutorial-generator'), skillRef('mermaid-generator'), skillRef('plantuml-generator'), skillRef('drawio-generator'), skillRef('excalidraw-generator'), skillRef('component-docs')],
    hooks: CORE_HOOKS
  },
  {
    name: 'design-system',
    desc: 'Design System — UI components, design tokens, theming, responsive layouts, accessibility, animations, and form patterns. Build consistent, accessible UIs with AI-generated component variants and Storybook docs.',
    keywords: ['design-system', 'ui-components', 'design-tokens', 'theming', 'accessibility', 'responsive', 'storybook'],
    agents: [agentRef('ux-designer'), agentRef('accessibility-expert')],
    instructions: [instrRef('a11y-waf'), instrRef('tailwind-waf'), instrRef('html-css-waf')],
    skills: [skillRef('design-ui-components'), skillRef('design-system-tokens'), skillRef('design-themes'), skillRef('design-responsive'), skillRef('design-forms'), skillRef('design-accessibility'), skillRef('design-animations'), skillRef('design-layouts'), skillRef('design-loading-states'), skillRef('design-error-states'), skillRef('design-data-visualization'), skillRef('design-onboarding'), skillRef('design-dialog-system'), skillRef('design-icon-system'), skillRef('design-state-management')],
    hooks: CORE_HOOKS
  }
];

for (const p of archPlugins) {
  createPlugin(p.name, p);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. DEVOPS / INFRASTRUCTURE PLUGINS (5)
// ═══════════════════════════════════════════════════════════════════════════════

const devopsPlugins = [
  {
    name: 'cicd-automation',
    desc: 'CI/CD Automation — GitHub Actions, Azure DevOps pipelines, build matrices, deployment gates, and release management. Automate test → build → deploy → evaluate pipelines for AI workloads.',
    keywords: ['cicd', 'github-actions', 'azure-devops', 'pipelines', 'deployment', 'release', 'automation'],
    agents: [agentRef('github-actions-expert'), agentRef('cicd-pipeline-expert'), agentRef('azure-devops-expert')],
    instructions: [instrRef('github-actions-waf'), instrRef('azure-devops-waf'), instrRef('opex-github-actions')],
    skills: [skillRef('build-github-workflow'), skillRef('codeql-setup'), skillRef('editorconfig-setup')],
    hooks: SECURITY_HOOKS
  },
  {
    name: 'kubernetes-orchestration',
    desc: 'Kubernetes Orchestration — cluster setup, Helm charts, KEDA autoscaling, Dapr sidecars, Istio service mesh, and GPU scheduling. Production K8s patterns for AI model serving and microservices.',
    keywords: ['kubernetes', 'helm', 'keda', 'dapr', 'istio', 'gpu', 'autoscaling', 'service-mesh'],
    agents: [agentRef('kubernetes-expert'), agentRef('azure-aks-expert')],
    instructions: [instrRef('kubernetes-waf')],
    skills: [skillRef('build-kubernetes-manifest')],
    hooks: [...CORE_HOOKS, hookRef('cost-tracker')]
  },
  {
    name: 'terraform-iac',
    desc: 'Terraform IaC — module authoring, state management, workspace strategies, provider configuration, and drift detection. Multi-cloud infrastructure as code with Azure-optimized patterns and cost estimation.',
    keywords: ['terraform', 'iac', 'infrastructure-as-code', 'modules', 'state', 'multi-cloud', 'drift-detection'],
    agents: [agentRef('terraform-expert')],
    instructions: [instrRef('terraform-waf'), instrRef('terraform-azure-waf')],
    skills: [skillRef('build-terraform-module'), skillRef('terraform-module-scaffold'), skillRef('import-iac')],
    hooks: SECURITY_HOOKS
  },
  {
    name: 'docker-containerization',
    desc: 'Docker Containerization — multi-stage builds, distroless images, BuildKit caching, health checks, and security scanning. Containerize any workload with optimized images for AI inference and web services.',
    keywords: ['docker', 'containerization', 'multi-stage', 'distroless', 'buildkit', 'health-checks', 'security-scanning'],
    agents: [agentRef('docker-expert')],
    instructions: [instrRef('docker-waf'), instrRef('containerization-waf')],
    skills: [skillRef('build-docker-image'), skillRef('multi-stage-docker'), skillRef('containerize-aspnet'), skillRef('containerize-aspnet-framework')],
    hooks: [...CORE_HOOKS, hookRef('license-checker')]
  },
  {
    name: 'incident-response',
    desc: 'Incident Response — on-call triage, KQL query generation, Azure resource diagnostics, runbook automation, and post-incident reviews. AI-assisted SRE with intelligent alerting and root cause analysis.',
    keywords: ['incident-response', 'on-call', 'sre', 'kql', 'diagnostics', 'runbook', 'root-cause', 'alerting'],
    agents: [agentRef('incident-responder'), agentRef('devops-expert'), agentRef('azure-monitor-expert')],
    instructions: [instrRef('opex-monitoring')],
    skills: [skillRef('azure-resource-health'), skillRef('azure-resource-graph')],
    hooks: [...CORE_HOOKS, hookRef('session-logger')]
  }
];

for (const p of devopsPlugins) {
  createPlugin(p.name, p);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. TESTING / QUALITY PLUGINS (2 new)
// ═══════════════════════════════════════════════════════════════════════════════

const testPlugins = [
  {
    name: 'security-hardening',
    desc: 'Security Hardening — OWASP Top 10, secrets scanning, dependency auditing, supply chain security, threat modeling, and penetration testing patterns. Harden AI applications with defense-in-depth and zero-trust.',
    keywords: ['security', 'owasp', 'secrets-scanning', 'supply-chain', 'threat-modeling', 'penetration-testing', 'zero-trust'],
    agents: [agentRef('security-reviewer'), agentRef('red-team-expert'), agentRef('compliance-expert')],
    instructions: [instrRef('security-owasp'), instrRef('security-python'), instrRef('security-typescript'), instrRef('security-csharp'), instrRef('security-bicep')],
    skills: [skillRef('security-review-skill'), skillRef('secret-scanning'), skillRef('threat-model'), skillRef('codeql-setup')],
    hooks: ALL_HOOKS
  },
  {
    name: 'code-quality',
    desc: 'Code Quality — automated code review, refactoring suggestions, dead code removal, complexity analysis, and technical debt tracking. AI-powered quality gates with custom rulesets and team coding standards.',
    keywords: ['code-quality', 'code-review', 'refactoring', 'dead-code', 'complexity', 'tech-debt', 'linting'],
    agents: [agentRef('code-reviewer'), agentRef('refactoring-expert'), agentRef('tech-debt-analyst')],
    instructions: [instrRef('code-review-waf'), instrRef('design-patterns-waf'), instrRef('object-calisthenics-waf'), instrRef('self-documenting-code-waf')],
    skills: [skillRef('code-smell-detector'), skillRef('dead-code-removal'), skillRef('refactor-complexity'), skillRef('refactor-plan'), skillRef('refactor-skill'), skillRef('review-and-refactor')],
    hooks: [...CORE_HOOKS, hookRef('waf-compliance')]
  }
];

for (const p of testPlugins) {
  createPlugin(p.name, p);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. META / DISCOVERY PLUGINS (3 new)
// ═══════════════════════════════════════════════════════════════════════════════

const metaPlugins = [
  {
    name: 'frootai-discovery',
    desc: 'FrootAI Discovery — meta-plugin for exploring and recommending agents, instructions, skills, hooks, and plugins. Suggests the right primitives for your task based on project context and WAF alignment.',
    keywords: ['discovery', 'meta', 'recommendation', 'suggest', 'explore', 'catalog', 'primitives', 'marketplace'],
    agents: [agentRef('play-dispatcher'), agentRef('play-lifecycle')],
    instructions: [instrRef('context-engineering-waf'), instrRef('taming-copilot-waf')],
    skills: [skillRef('suggest-agents'), skillRef('suggest-instructions'), skillRef('suggest-skills'), skillRef('what-context-needed'), skillRef('first-ask'), skillRef('copilot-instructions-generator')],
    hooks: CORE_HOOKS
  },
  {
    name: 'fai-protocol-starter',
    desc: 'FAI Protocol Starter — quickstart for the FAI Protocol ecosystem. Scaffold fai-manifest.json, fai-context.json, and connect primitives into wired solution plays. The entry point for building FAI Protocol compliant solutions.',
    keywords: ['fai-protocol', 'fai-manifest', 'fai-context', 'scaffold', 'quickstart', 'wiring', 'solution-play'],
    agents: [agentRef('architect'), agentRef('play-dispatcher')],
    instructions: [instrRef('mcp-integration-patterns'), instrRef('azure-ai-foundry')],
    skills: [skillRef('play-initializer'), skillRef('skill-template'), skillRef('folder-structure'), skillRef('copilot-instructions-generator')],
    hooks: SECURITY_HOOKS
  },
  {
    name: 'context-engineering',
    desc: 'Context Engineering — maximize AI effectiveness with structured context, memory banks, knowledge wiring, and smart prompt assembly. Build context-aware agents that retrieve the right information at the right time.',
    keywords: ['context-engineering', 'memory-bank', 'knowledge-wiring', 'rag', 'context-assembly', 'prompt-context'],
    agents: [agentRef('rag-expert'), agentRef('prompt-engineer')],
    instructions: [instrRef('context-engineering-waf'), instrRef('memory-bank-waf'), instrRef('copilot-thought-logging-waf')],
    skills: [skillRef('what-context-needed'), skillRef('context-map'), skillRef('contextual-rag'), skillRef('remember'), skillRef('build-genai-rag')],
    hooks: [...CORE_HOOKS, hookRef('session-logger')]
  }
];

for (const p of metaPlugins) {
  createPlugin(p.name, p);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10. COMMUNITY / INTEGRATION PLUGINS (3 new)
// ═══════════════════════════════════════════════════════════════════════════════

const communityPlugins = [
  {
    name: 'salesforce-integration',
    desc: 'Salesforce Integration — Apex development, Lightning Web Components, SOQL optimization, Salesforce MCP connectors, and AI-powered CRM workflows. Bridge Salesforce data with Azure AI services.',
    keywords: ['salesforce', 'apex', 'lwc', 'soql', 'crm', 'mcp-connector', 'salesforce-ai'],
    agents: [agentRef('salesforce-expert')],
    instructions: [instrRef('salesforce-apex-waf'), instrRef('salesforce-lwc-waf')],
    skills: [],
    hooks: CORE_HOOKS
  },
  {
    name: 'oracle-migration',
    desc: 'Oracle Migration — Oracle-to-PostgreSQL and Oracle-to-Azure SQL migration patterns. Schema conversion, PL/SQL translation, data pipeline design, and validation testing for database modernization.',
    keywords: ['oracle', 'migration', 'postgresql', 'azure-sql', 'schema-conversion', 'plsql', 'database-modernization'],
    agents: [agentRef('migration-expert'), agentRef('postgresql-expert'), agentRef('sql-server-expert')],
    instructions: [instrRef('sql-optimization-waf')],
    skills: [skillRef('build-sql-migration'), skillRef('postgresql-optimization'), skillRef('postgresql-code-review'), skillRef('sql-optimization-skill'), skillRef('sql-code-review-skill'), skillRef('database-schema-designer')],
    hooks: CORE_HOOKS
  },
  {
    name: 'power-bi-analytics',
    desc: 'Power BI Analytics — DAX formulas, data modeling, report design, dashboard layout, and performance optimization. Build self-service AI analytics with DirectQuery, incremental refresh, and composite models.',
    keywords: ['power-bi', 'dax', 'data-modeling', 'report-design', 'dashboard', 'directquery', 'analytics'],
    agents: [agentRef('power-bi-expert')],
    instructions: [instrRef('power-bi-dax-waf')],
    skills: [skillRef('power-bi-dashboard'), skillRef('power-bi-report'), skillRef('powerbi-modeling'), skillRef('build-data-lakehouse'), skillRef('fabric-lakehouse')],
    hooks: CORE_HOOKS
  }
];

for (const p of communityPlugins) {
  createPlugin(p.name, p);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

const total = (require('fs').readdirSync(PLUGINS_DIR)).filter(f => {
  const s = fs.statSync(path.join(PLUGINS_DIR, f));
  return s.isDirectory();
}).length;

console.log(`\n${'═'.repeat(60)}`);
console.log(`  FrootAI Plugin Sprint — COMPLETE`);
console.log(`${'═'.repeat(60)}`);
console.log(`  Created: ${created} new plugins`);
console.log(`  Skipped: ${skipped} (already exist)`);
console.log(`  TOTAL PLUGINS: ${total}`);
console.log(`  Competitor: 65`);
console.log(`  Status: ${total >= 65 ? '✅ WE LEAD' : '⬜ Gap: ' + (65 - total)}`);
console.log(`${'═'.repeat(60)}\n`);
