# database-management

> Database administration and optimization — PostgreSQL, SQL Server, Cosmos DB modeling, query optimization, migration planning, and data pipeline patterns.

## Overview

This plugin bundles **0 primitives** (0 agents, 0 instructions, 0 skills, 0 hooks) in one installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install database-management
```

Or copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|

## Keywords

`database` `postgresql` `sql-server` `cosmos-db` `migration` `optimization` `schema-design`

## Usage

After installation, primitives are available in your project:

1. **Agents** activate when you `@mention` them in Copilot Chat
2. **Instructions** auto-apply to matching files via `applyTo` glob patterns
3. **Skills** are invoked by agents or via `/skill` commands
4. **Hooks** fire automatically at session lifecycle events

Inside a solution play with `fai-manifest.json`, all primitives auto-wire through the FAI Protocol: shared context, WAF guardrails, and evaluation thresholds propagate automatically.

## WAF Alignment

| Pillar | Coverage |
|--------|----------|
| Cost Optimization | Model routing (GPT-4o vs mini), token budgets, caching, right-sizing |

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

1. Fork the [FrootAI repository](https://github.com/FrootAI/frootai)
2. Edit `plugins/database-management/`
3. Run `npm run validate:primitives`
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
