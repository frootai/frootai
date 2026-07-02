# azure-data-services

> Azure Data Services — Cosmos DB, SQL Database, Blob Storage, Data Explorer, and Redis Cache patterns. Schema design, partition strategies, query optimization, and data lifecycle management.

## Overview

This plugin bundles **18 primitives** (5 agents, 4 instructions, 6 skills, 3 hooks) into one installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install azure-data-services
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-azure-cosmos-db-expert` | Azure cosmos db expert |
| Agent | `frootai-azure-sql-expert` | Azure sql expert |
| Agent | `frootai-azure-storage-expert` | Azure storage expert |
| Agent | `frootai-data-engineer` | Data engineer |
| Agent | `frootai-redis-expert` | Redis expert |
| Instruction | `azure-cosmos-waf` | Azure cosmos waf standards |
| Instruction | `azure-redis-waf` | Azure redis waf standards |
| Instruction | `sql-optimization-waf` | Sql optimization waf standards |
| Instruction | `mongodb-waf` | Mongodb waf standards |
| Skill | `frootai-azure-cosmos-modeling` | Azure cosmos modeling |
| Skill | `frootai-azure-sql-setup` | Azure sql setup |
| Skill | `frootai-azure-storage-patterns` | Azure storage patterns |
| Skill | `frootai-azure-data-explorer` | Azure data explorer |
| Skill | `frootai-build-nosql-data-model` | Build nosql data model |
| Skill | `frootai-build-sql-migration` | Build sql migration |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |

## Keywords

`azure` `cosmos-db` `sql-database` `storage` `data-explorer` `redis` `data-services` `schema-design`

## Usage

After installation, the primitives are available in your project:

1. **Agents** activate when you `@mention` them in Copilot Chat
2. **Instructions** auto-apply to matching files via `applyTo` glob patterns
3. **Skills** are invoked by agents or via `/skill` commands
4. **Hooks** fire automatically at session lifecycle events

Inside a solution play with `fai-manifest.json`, all primitives auto-wire through the FAI Protocol — shared context, WAF guardrails, and evaluation thresholds propagate automatically.

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
2. Edit files in `plugins/azure-data-services/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
