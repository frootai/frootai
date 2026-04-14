#!/usr/bin/env node
/** Instructions Sprint 3 — Final push to 180+ */
const { writeFileSync, existsSync } = require('fs');
const { join } = require('path');
const D = join(__dirname, '..', 'instructions');
let c = 0;
function mk(n,d,a,w) {
  const f=join(D,`${n}.instructions.md`);
  if(existsSync(f))return;
  writeFileSync(f,`---\ndescription: "${d}"\napplyTo: "${a}"\nwaf:\n${w.map(v=>`  - "${v}"`).join('\n')}\n---\n\n# ${n.split('-').map(s=>s[0].toUpperCase()+s.slice(1)).join(' ')}\n\n${d}\n`);
  c++;
}

// Per-FROOT-module coding standards
mk('genai-foundations','GenAI foundations coding — token counting, model parameter configuration, inference optimization.','**/*.py, **/*.ts',['performance-efficiency','cost-optimization']);
mk('llm-model-selection','LLM selection standards — model routing config, benchmark-driven selection, cost/quality tradeoffs.','**/*.json, **/*.py',['cost-optimization','performance-efficiency']);
mk('ai-glossary','AI glossary consistency — use standard FrootAI terminology, avoid ambiguous AI terms in code comments.','**',['operational-excellence']);
mk('agentic-os-customization','Agentic OS standards — .github folder structure, 7 primitives, 4 layers, plugin packaging.','**/.github/**',['operational-excellence']);
mk('prompt-engineering','Prompt engineering standards — system message structure, few-shot patterns, output format enforcement.','**/*.py, **/*.ts, **/*.md',['reliability','responsible-ai']);
mk('rag-coding-patterns','RAG coding standards — chunking config, embedding batch calls, reranker integration, citation injection.','**/*.py, **/*.ts',['reliability','performance-efficiency']);
mk('deterministic-ai','Determinism standards — temperature=0+seed, structured output, validation pipeline, grounding checks.','**/*.py, **/*.ts, **/*.json',['reliability','responsible-ai']);
mk('semantic-kernel','Semantic Kernel standards — kernel config, plugin design, filter pipeline, memory store integration.','**/*.cs, **/*.py',['reliability','operational-excellence']);
mk('agent-coding-patterns','Agent coding standards — ReAct loop, tool selection, memory management, circuit breaker on tools.','**/*.py, **/*.ts, **/*.cs',['reliability','security']);
mk('mcp-integration-patterns','MCP integration patterns — tool description quality, parameter design, error handling, transport selection.','**/*.py, **/*.ts, **/*.cs',['reliability','security']);
mk('azure-ai-foundry','Azure AI Foundry config — Hub/Project RBAC, deployment types, evaluation pipeline, content filter config.','**/*.bicep, **/*.json',['security','operational-excellence']);
mk('gpu-infrastructure','GPU infrastructure standards — VRAM sizing, quantization selection, serving framework config, scaling rules.','**/*.yaml, **/*.py',['performance-efficiency','cost-optimization']);
mk('copilot-extensibility','Copilot extensibility — Graph connectors, plugin manifest, action design, M365 integration patterns.','**/*.json, **/*.ts',['operational-excellence']);
mk('fine-tuning-data','Fine-tuning data standards — JSONL format, quality validation, class balance, edge case inclusion.','**/*.jsonl, **/*.py',['reliability','operational-excellence']);
mk('responsible-ai-coding','Responsible AI coding — content safety integration, red team test coverage, bias metric collection.','**/*.py, **/*.ts',['responsible-ai','security']);
mk('production-deployment','Production deployment standards — blue-green, canary rollout, health probes, rollback criteria.','**/*.yaml, **/*.bicep',['reliability','operational-excellence']);

// Additional .NET ecosystem
mk('dotnet-architecture-waf','.NET architecture standards — DDD, SOLID, clean architecture, CQRS, event sourcing.','**/*.cs',['reliability','operational-excellence']);
mk('ef-core-waf','Entity Framework Core standards — migrations, query optimization, eager/lazy loading, concurrency handling.','**/*.cs',['performance-efficiency','reliability']);
mk('signalr-waf','SignalR real-time standards — hub design, groups, streaming, connection management, Azure SignalR Service.','**/*.cs, **/*.ts',['performance-efficiency','reliability']);
mk('minimal-api-waf','ASP.NET Minimal API standards — endpoint routing, DI, filters, OpenAPI, rate limiting.','**/*.cs',['performance-efficiency','security']);

// Additional Python ecosystem
mk('pydantic-waf','Pydantic standards — model design, validation, serialization, settings management, custom validators.','**/*.py',['reliability','security']);
mk('uvicorn-waf','Uvicorn/ASGI standards — worker config, graceful shutdown, health checks, production settings.','**/*.py',['performance-efficiency','reliability']);
mk('sqlalchemy-waf','SQLAlchemy standards — async sessions, relationship mapping, migration with Alembic, connection pooling.','**/*.py',['reliability','performance-efficiency']);

// Additional TS/JS ecosystem
mk('zod-waf','Zod validation standards — schema design, type inference, transform, error messages, API input validation.','**/*.ts',['security','reliability']);
mk('prisma-waf','Prisma ORM standards — schema design, migrations, query optimization, relation loading, type safety.','**/*.ts, **/schema.prisma',['reliability','performance-efficiency']);
mk('trpc-waf','tRPC standards — router design, middleware, error handling, type-safe API calls, input validation.','**/*.ts',['reliability','security']);

// Azure services (continued)
mk('azure-ai-speech-waf','Azure AI Speech standards — STT/TTS config, custom models, real-time transcription, pronunciation assessment.','**/*.py, **/*.ts',['performance-efficiency','reliability']);
mk('azure-ai-vision-waf','Azure AI Vision standards — image analysis, OCR, custom classification, spatial analysis patterns.','**/*.py, **/*.ts',['reliability','performance-efficiency']);
mk('azure-ai-language-waf','Azure AI Language standards — NER, sentiment, PII detection, summarization, custom models.','**/*.py, **/*.ts',['responsible-ai','reliability']);
mk('azure-ai-document-intelligence-waf','Azure AI Document Intelligence standards — layout analysis, custom models, table extraction, batch processing.','**/*.py',['reliability','performance-efficiency']);
mk('azure-cosmos-waf','Cosmos DB standards — partition keys, RU estimation, consistency levels, vector search, global distribution.','**/*.py, **/*.ts, **/*.cs',['performance-efficiency','reliability','cost-optimization']);
mk('azure-redis-waf','Azure Cache for Redis standards — connection pooling, semantic cache patterns, session store, pub/sub.','**/*.py, **/*.ts, **/*.cs',['performance-efficiency','cost-optimization']);
mk('azure-front-door-waf','Azure Front Door standards — global routing, WAF policies, caching rules, health probes, SSL.','**/*.bicep, **/*.json',['performance-efficiency','security']);
mk('azure-app-service-waf','Azure App Service standards — deployment slots, auto-scale, VNet integration, health checks, diagnostics.','**/*.bicep, **/*.json',['reliability','operational-excellence']);
mk('azure-static-web-apps-waf','Azure Static Web Apps standards — API integration, custom domains, auth, preview environments.','**/*.json, **/*.ts',['performance-efficiency','security']);

// Specialized
mk('no-heredoc-waf','No heredoc in terminal — prevent terminal file corruption from heredoc syntax in AI-generated commands.','**/*.sh',['reliability']);
mk('copilot-thought-logging-waf','Copilot thought logging — track reasoning process, tool selection rationale, confidence levels.','**',['operational-excellence','responsible-ai']);
mk('taming-copilot-waf','Taming Copilot — prevent overreach, enforce constraints, verify before executing, undo patterns.','**',['security','reliability']);

console.log(`Created: ${c} new instructions`);
