# ai-search-portal

> AI Search Portal: full-text + vector hybrid search with semantic ranking, faceted navigation, autocomplete, and personalized results. Build production search on Azure AI Search with RAG integration.

## Overview

This plugin bundles **16 primitives** (5 agents, 3 instructions, 5 skills, 3 hooks) in one installable package. All are WAF-aligned and FAI Protocol auto-wiring compatible.

## Installation

```bash
npx frootai install ai-search-portal
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-play-09-builder` | Play 09 builder |
| Agent | `frootai-play-09-reviewer` | Play 09 reviewer |
| Agent | `frootai-play-09-tuner` | Play 09 tuner |
| Agent | `frootai-azure-ai-search-expert` | Azure AI Search expert |
| Agent | `frootai-embedding-expert` | Embedding expert |
| Instruction | `play-09-ai-search-portal-patterns` | Play 09 AI search portal standards |
| Instruction | `python-waf` | Python WAF standards |
| Instruction | `nextjs-waf` | Next.js WAF standards |
| Skill | `frootai-deploy-09-ai-search-portal` | Deploy 09 AI search portal |
| Skill | `frootai-evaluate-09-ai-search-portal` | Evaluate 09 AI search portal |
| Skill | `frootai-tune-09-ai-search-portal` | Tune 09 AI search portal |
| Skill | `frootai-azure-ai-search-index` | Azure AI Search index |
| Skill | `frootai-build-semantic-search` | Build semantic search |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |

## Compatible Solution Plays

- **Play 09-ai-search-portal**

## Keywords

`ai-search` `vector-search` `semantic-ranking` `hybrid-search` `faceted-navigation` `azure-ai-search` `rag`

## Usage

After installation, the primitives are available in your project:

1. **Agents** activate when you `@mention` them in Copilot Chat
2. **Instructions** auto-apply to matching files via `applyTo` glob patterns
3. **Skills** are invoked by agents or via `/skill` commands
4. **Hooks** fire automatically at session lifecycle events

Inside a solution play with `fai-manifest.json`, all primitives auto-wire through the FAI Protocol: shared context, WAF guardrails, and evaluation thresholds propagate automatically.

## WAF Alignment

| Pillar | Coverage |
|--------|----------|
| Security | Secrets scanning, Managed Identity, Key Vault integration, RBAC |
| Reliability | Retry with backoff, circuit breaker, health probes, fallback chains |
| Operational Excellence | CI/CD integration, observability, IaC templates, automated testing |

## Quality Gates

When used inside a play, this plugin enforces:

| Metric | Threshold |
|--------|-----------|
| Groundedness | ≥ 0.85 |
| Coherence | ≥ 0.80 |
| Relevance | ≥ 0.80 |
| Safety | 0 violations |
| Cost per query | ≤ $0.05 |

## Contributing

To improve this plugin:

1. Fork the [FrootAI repository](https://github.com/FrootAI/frootai)
2. Edit files in `plugins/ai-search-portal/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
