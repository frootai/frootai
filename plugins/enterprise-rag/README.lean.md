# Enterprise RAG Plugin

> Production-grade Retrieval-Augmented Generation — the first FrootAI plugin, packaging Play 01 with all standalone primitives wired together.

## Overview

Enterprise RAG goes beyond basic retrieval by combining hybrid search (keyword + vector + semantic reranking), citation-grounded answers, and production guardrails into a single deployable pipeline. This plugin bundles **7 primitives** (1 agent, 2 instructions, 1 skill, 3 hooks) that wire together through the FAI Protocol auto-wiring system. Each primitive works standalone, but when used inside a solution play with `fai-manifest.json`, shared context, WAF guardrails, and evaluation thresholds propagate automatically. The result is a Q&A system backed by Azure AI Search and Azure OpenAI that is secure, cost-controlled, and evaluation-ready from day one.

## What's Included

| Primitive | Name | Purpose |
|-----------|------|---------|
| **Agent** | `fai-rag-architect` | Designs RAG pipelines with Azure AI Search, evaluation, and cost controls |
| **Instruction** | `python-waf` | Python coding standards aligned with 4 WAF pillars |
| **Instruction** | `bicep-waf` | Bicep IaC standards aligned with 5 WAF pillars |
| **Skill** | `fai-play-initializer` | Scaffolds new solution plays with full FAI Protocol structure |
| **Hook** | `fai-secrets-scanner` | 25+ regex patterns for credential leak detection |
| **Hook** | `fai-tool-guardian` | 7 threat categories blocking dangerous operations |
| **Hook** | `fai-governance-audit` | 5 threat categories with 4 audit levels for prompt safety |

## Installation

```bash
npx frootai install enterprise-rag
```

Or manually copy the referenced primitives from the FrootAI repository into your project's `.github/` directory.

## Compatible Solution Plays

- **Play 01** — Enterprise RAG Q&A
- **Play 09** — AI Search Portal
- **Play 21** — Agentic RAG

## Usage

After installation, the primitives activate in your project:

1. **Agent** — `@fai-rag-architect` in Copilot Chat for pipeline design, chunking strategy, and index configuration
2. **Instructions** — auto-apply to `*.py` and `*.bicep` files via `applyTo` glob patterns
3. **Skill** — invoked by agents to scaffold new plays with the correct FAI Protocol structure
4. **Hooks** — fire automatically at `SessionStart` to scan for secrets, block dangerous tool calls, and audit prompts

When used inside a solution play with `fai-manifest.json`, all primitives auto-wire through the FAI Protocol — shared context, WAF guardrails, and evaluation thresholds propagate automatically.

## Quality Gates

This plugin enforces these evaluation thresholds when used inside a play:

| Metric | Threshold | Action |
|--------|-----------|--------|
| Groundedness | ≥ 0.95 | Retry on failure |
| Coherence | ≥ 0.90 | Retry on failure |
| Relevance | ≥ 0.85 | Warn |
| Safety violations | 0 | Block |
| Cost per query | ≤ $0.01 | Alert |

## WAF Alignment

All primitives in this plugin are aligned to the Azure Well-Architected Framework:

| Pillar | How This Plugin Addresses It |
|--------|------------------------------|
| Security | Secrets scanner hook, Managed Identity in Bicep, Key Vault in Python |
| Reliability | Retry patterns in Python, health probes in Bicep, circuit breaker guidance |
| Cost Optimization | Model routing in agent, token budgets in Python, consumption SKUs in Bicep |
| Performance | Async patterns in Python, streaming in agent, CDN in Bicep |
| Responsible AI | Governance audit hook, content safety in agent, grounding enforcement |

## Contributing

1. Fork the [FrootAI repository](https://github.com/FrootAI/frootai)
2. Edit files in `plugins/enterprise-rag/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
