# multi-agent-service

> Multi-Agent Service — orchestrated agent teams with supervisor patterns, tool delegation, shared memory, and conflict resolution. Build production agent services on Azure Container Apps with Semantic Kernel or AutoGen.

## Overview

This plugin bundles **18 primitives** (5 agents, 3 instructions, 5 skills, 5 hooks) into a single installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install multi-agent-service
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-play-07-builder` | Play 07 builder specialist |
| Agent | `frootai-play-07-reviewer` | Play 07 reviewer specialist |
| Agent | `frootai-play-07-tuner` | Play 07 tuner specialist |
| Agent | `frootai-swarm-supervisor` | Swarm supervisor specialist |
| Agent | `frootai-semantic-kernel-expert` | Semantic kernel expert specialist |
| Instruction | `play-07-multi-agent-service-patterns` | Play 07 multi agent service patterns standards |
| Instruction | `python-waf` | Python waf standards |
| Instruction | `agent-coding-patterns` | O2 agent coding standards |
| Skill | `frootai-deploy-07-multi-agent-service` | Deploy 07 multi agent service capability |
| Skill | `frootai-evaluate-07-multi-agent-service` | Evaluate 07 multi agent service capability |
| Skill | `frootai-tune-07-multi-agent-service` | Tune 07 multi agent service capability |
| Skill | `frootai-build-agentic-loops` | Build agentic loops capability |
| Skill | `frootai-human-in-the-loop` | Human in the loop capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-output-validator` | Output validator gate |
| Hook | `frootai-token-budget-enforcer` | Token budget enforcer gate |

## Compatible Solution Plays

- **Play 07-multi-agent-service**

## Keywords

`multi-agent` `orchestration` `supervisor` `autogen` `semantic-kernel` `shared-memory` `container-apps`

## Usage

After installation, the primitives are available in your project:

1. **Agents** activate when you `@mention` them in Copilot Chat
2. **Instructions** auto-apply to matching files via `applyTo` glob patterns
3. **Skills** are invoked by agents or via `/skill` commands
4. **Hooks** fire automatically at session lifecycle events

When used inside a solution play with `fai-manifest.json`, all primitives auto-wire through the FAI Protocol — shared context, WAF guardrails, and evaluation thresholds propagate automatically.

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
2. Edit files in `plugins/multi-agent-service/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)