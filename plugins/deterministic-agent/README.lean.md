# deterministic-agent

> Deterministic AI Agent: finite state machines, rule-based routing, guardrailed tool use, reproducible conversation flows. Build consistent outputs regardless of LLM temperature.

## Overview

This plugin bundles **16 primitives** (4 agents, 3 instructions, 5 skills, 4 hooks) in one installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install deterministic-agent
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-play-03-builder` | Play 03 builder specialist |
| Agent | `frootai-play-03-reviewer` | Play 03 reviewer specialist |
| Agent | `frootai-play-03-tuner` | Play 03 tuner specialist |
| Agent | `frootai-deterministic-expert` | Deterministic expert specialist |
| Instruction | `play-03-deterministic-agent-patterns` | Play 03 deterministic agent patterns standards |
| Instruction | `python-waf` | Python waf standards |
| Instruction | `agent-safety` | Agent safety standards |
| Skill | `frootai-deploy-03-deterministic-agent` | Deploy 03 deterministic agent capability |
| Skill | `frootai-evaluate-03-deterministic-agent` | Evaluate 03 deterministic agent capability |
| Skill | `frootai-tune-03-deterministic-agent` | Tune 03 deterministic agent capability |
| Skill | `frootai-deterministic-agent-skill` | Deterministic agent skill capability |
| Skill | `frootai-guardrails-policy` | Guardrails policy capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-output-validator` | Output validator gate |

## Compatible Solution Plays

- **Play 03-deterministic-agent**

## Keywords

`deterministic` `finite-state-machine` `guardrails` `reproducible` `rule-based` `agent` `waf-aligned`

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
2. Edit files in `plugins/deterministic-agent/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
