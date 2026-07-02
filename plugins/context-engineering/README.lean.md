# context-engineering

> Context Engineering: maximize AI effectiveness with structured context, memory banks, knowledge wiring, and smart prompt assembly. Build context-aware agents that retrieve the right information at the right time.

## Overview

This plugin bundles **14 primitives** (2 agents, 3 instructions, 5 skills, 4 hooks) into one installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install context-engineering
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-rag-expert` | RAG expert |
| Agent | `frootai-prompt-engineer` | Prompt engineer |
| Instruction | `context-engineering-waf` | Context engineering WAF standards |
| Instruction | `memory-bank-waf` | Memory bank WAF standards |
| Instruction | `copilot-thought-logging-waf` | Copilot thought logging WAF standards |
| Skill | `frootai-what-context-needed` | What context needed |
| Skill | `frootai-context-map` | Context map |
| Skill | `frootai-contextual-rag` | Contextual RAG |
| Skill | `frootai-remember` | Remember |
| Skill | `frootai-build-genai-rag` | Build GenAI RAG |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-session-logger` | Session logger gate |

## Keywords

`context-engineering` `memory-bank` `knowledge-wiring` `rag` `context-assembly` `prompt-context`

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
|--------|----------|
| Groundedness | ≥ 0.85 |
| Coherence | ≥ 0.80 |
| Relevance | ≥ 0.80 |
| Safety | 0 violations |
| Cost per query | ≤ $0.05 |

## Contributing

To improve this plugin:

1. Fork the [FrootAI repository](https://github.com/FrootAI/frootai)
2. Edit files in `plugins/context-engineering/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
