# architecture-patterns

> Architecture Patterns — cloud design patterns, domain-driven design, microservices, event sourcing, CQRS, hexagonal architecture. Generate architecture blueprints, C4 diagrams, and ADRs.

## Overview

This plugin bundles **16 primitives** (3 agents, 4 instructions, 6 skills, 3 hooks) into one installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install architecture-patterns
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-architect` | Architect specialist |
| Agent | `frootai-solutions-architect` | Solutions architect specialist |
| Agent | `frootai-api-gateway-designer` | Api gateway designer specialist |
| Instruction | `design-patterns-waf` | Design patterns waf standards |
| Instruction | `dotnet-architecture-waf` | Dotnet architecture waf standards |
| Instruction | `graphql-waf` | Graphql waf standards |
| Instruction | `grpc-waf` | Grpc waf standards |
| Skill | `frootai-architecture-blueprint` | Architecture blueprint capability |
| Skill | `frootai-architecture-decision-record` | Architecture decision record capability |
| Skill | `frootai-cloud-design-patterns` | Cloud design patterns capability |
| Skill | `frootai-domain-driven-design` | Domain driven design capability |
| Skill | `frootai-tech-stack-blueprint` | Tech stack blueprint capability |
| Skill | `frootai-context-map` | Context map capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |

## Keywords

`architecture` `design-patterns` `ddd` `microservices` `cqrs` `event-sourcing` `hexagonal` `c4-diagram`

## Usage

After installation, the primitives are available in your project:

1. **Agents** activate when you `@mention` them in Copilot Chat
2. **Instructions** auto-apply to matching files via `applyTo` glob patterns
3. **Skills** are invoked by agents or via `/skill` commands
4. **Hooks** fire automatically at session lifecycle events

When used inside a solution play with `fai-manifest.json`, all primitives auto-wire through the FAI Protocol: shared context, WAF guardrails, and evaluation thresholds propagate automatically.

## WAF Alignment

| Pillar | Coverage |
|--------|----------|
| Operational Excellence | CI/CD, observability, IaC templates, automated testing |

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
2. Edit `plugins/architecture-patterns/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
