# FrootAI Cookbook

> Step-by-step recipes for common FrootAI tasks. Each recipe is self-contained with runnable commands, code examples, and best practices.

## Recipes

### Getting Started

| # | Recipe | Difficulty | Time | What You'll Learn |
|---|--------|-----------|------|-------------------|
| 1 | [Init a Play](./01-init-play.md) | Easy | 10 min | Scaffold a solution play with FAI Protocol, manifest, DevKit/TuneKit/SpecKit |
| 2 | [Deploy a Play](./02-deploy-play.md) | Medium | 30 min | Deploy to Azure with Bicep validation, what-if, rollback, tagging |
| 3 | [Evaluate a Play](./03-evaluate-play.md) | Medium | 20 min | Run quality gates — groundedness, coherence, safety, cost, CI/CD integration |

### Building Primitives

| # | Recipe | Difficulty | Time | What You'll Learn |
|---|--------|-----------|------|-------------------|
| 4 | [Create a Custom Agent](./04-create-agent.md) | Easy | 15 min | Build a WAF-aligned agent with tool restrictions and fai-context wiring |
| 9 | [Create a Custom Instruction](./09-create-instruction.md) | Easy | 15 min | Build a glob-targeted instruction with WAF pillars and coding standards |
| 10 | [Create a Custom Skill](./10-create-skill.md) | Easy | 15 min | Build a skill folder with SKILL.md, steps, verification, and troubleshooting |
| 16 | [Create a Custom Hook](./16-create-hook.md) | Medium | 20 min | Build a security hook with lifecycle events, modes, and stdin processing |

### Packaging & Distribution

| # | Recipe | Difficulty | Time | What You'll Learn |
|---|--------|-----------|------|-------------------|
| 5 | [Build an MCP Server](./05-build-mcp-server.md) | Medium | 30 min | Create a Python MCP server with typed tools, error handling, multi-client config |
| 6 | [Package a Plugin](./06-package-plugin.md) | Easy | 15 min | Bundle primitives into an installable plugin with marketplace registration |

### FAI Protocol

| # | Recipe | Difficulty | Time | What You'll Learn |
|---|--------|-----------|------|-------------------|
| 7 | [Run the FAI Engine](./07-fai-engine.md) | Easy | 5 min | Load a manifest, inspect wiring, run evaluation, MCP bridge API |
| 8 | [Add Security Hooks](./08-security-hooks.md) | Easy | 10 min | Install secrets scanner, tool guardian, governance audit with warn/block modes |
| 12 | [Wire FAI Context](./12-wire-fai-context.md) | Easy | 10 min | Connect primitives with fai-context.json — knowledge, WAF, play compatibility |

### Advanced Patterns

| # | Recipe | Difficulty | Time | What You'll Learn |
|---|--------|-----------|------|-------------------|
| 11 | [Build an Agentic Workflow](./11-build-agentic-workflow.md) | Medium | 25 min | Natural language workflows with safe-outputs, triggers, `gh aw` compatibility |
| 13 | [Agentic Loop (Ralph Loop)](./13-agentic-loop.md) | Advanced | 30 min | Autonomous task execution — disk-based state, fresh context, eval backpressure |
| 15 | [Error Handling & Recovery](./15-error-handling.md) | Medium | 20 min | Retry, circuit breaker, timeout, structured logging, graceful degradation |

### Developer Experience

| # | Recipe | Difficulty | Time | What You'll Learn |
|---|--------|-----------|------|-------------------|
| 14 | [Configure VS Code](./14-configure-vscode.md) | Easy | 10 min | File associations, schema validation, tasks, MCP integration |

### MCP Composition Recipes — Phase X8 preview

> Cross-spec workflows that attach **2+ marketplace MCP servers** in a single play.
> Drafted in Phase X4 ([X4.24] / [X4.27]) as a preview of the composition patterns
> Phase X8 will formalize. Each surfaces on its servers' marketplace detail pages
> under "Used in recipes".

| # | Recipe | Servers attached | What You'll Build | Est. cost/mo (100 inv.) |
|---|--------|------------------|-------------------|-------------------------|
| 24 | [Research-to-Notion](./24-research-to-notion.md) | Context7 + Tavily + Notion | Research → synthesize → publish a findings page | — |
| 25 | [Web-to-Vector RAG](./25-web-to-vector-rag.md) | Firecrawl + Qdrant + OpenAI Docs | Crawl → embed → retrieve grounded answers | — |
| 26 | [Vector-Memory Bake-off](./26-vector-memory-bakeoff.md) | Pinecone + Chroma | A/B two vector DBs behind one agent | — |
| 28 | [Browser Screenshot to Bug Report](./28-browser-screenshot-to-bug-report.md) | Playwright + Markitdown + GitHub | Capture a browser failure → file a triage-ready issue | ~$3.00 |
| 29 | [Azure Resource Audit](./29-azure-resource-audit.md) | Azure + MS Learn | Inventory resources → grounded best-practice audit | ~$6.00 |
| 30 | [Notion Doc Update on PR](./30-notion-doc-update-on-pr.md) | GitHub + Notion + Stripe | Merged docs PR → mirror to Notion → reconcile billing | ~$3.00 |
| 31 | [Multi-Cloud Cost Report](./31-multi-cloud-cost-report.md) | Azure + MongoDB | Live spend + cached history → cross-period cost trend | ~$5.00 |
| 32 | [Firecrawl Research Pipeline](./32-firecrawl-research-pipeline.md) | Firecrawl + Tavily + Context7 | Crawl + search + ground → cited research brief | ~$17.80 |
| 33 | [Elastic Log Analysis](./33-elastic-log-analysis.md) | Elastic + Context7 + MS Learn | Log spike → grounded root-cause + remediation report | ~$6.00 |
| 34 | [Vector DB Comparison](./34-vector-db-comparison.md) | Qdrant + ChromaDB + Pinecone | Same corpus + queries → recall/latency/cost bake-off | ~$18.00 |
| 35 | [pgEdge Replication Monitor](./35-pgedge-replication-monitor.md) | pgEdge + Elastic | Live replication state + logs → per-node health verdict | ~$4.00 |
| 36 | [PDF to Research Deck](./36-pdf-to-research-deck.md) | Markitdown + Context7 + Tavily | PDF → grounded, cited research summary | ~$5.40 |
| 37 | [RAG from a GitHub Repo](./37-rag-from-github-repo.md) | GitHub + Markitdown + Azure AI Search | Repo → normalized → queryable vector index | ~$22.00 |
| 38 | [Competitor Pricing Tracker](./38-competitor-pricing-tracker.md) | Firecrawl + MongoDB + Notion | Crawl pricing → track history → publish a diffed digest | ~$9.50 |

## Quick Start

```bash
# Clone the repo
git clone https://github.com/frootai/frootai.git
cd frootai

# Verify everything works
npm run validate:primitives

# Run the FAI Engine against Play 01
node engine/index.js solution-plays/01-enterprise-rag/fai-manifest.json --status
```
