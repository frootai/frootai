# it-ticket-resolution

> IT Ticket Resolution — automated incident classification, knowledge base search, resolution suggestion, and escalation routing. Uses RAG over IT documentation with Azure AI Search and Semantic Kernel orchestration.

## Overview

This plugin bundles **17 primitives** (5 agents, 3 instructions, 5 skills, 4 hooks) into a single installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install it-ticket-resolution
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-play-05-builder` | Play 05 builder specialist |
| Agent | `frootai-play-05-reviewer` | Play 05 reviewer specialist |
| Agent | `frootai-play-05-tuner` | Play 05 tuner specialist |
| Agent | `frootai-rag-expert` | Rag expert specialist |
| Agent | `frootai-semantic-kernel-expert` | Semantic kernel expert specialist |
| Instruction | `play-05-it-ticket-resolution-patterns` | Play 05 it ticket resolution patterns standards |
| Instruction | `python-waf` | Python waf standards |
| Instruction | `semantic-kernel` | O1 semantic kernel standards |
| Skill | `frootai-deploy-05-it-ticket-resolution` | Deploy 05 it ticket resolution capability |
| Skill | `frootai-evaluate-05-it-ticket-resolution` | Evaluate 05 it ticket resolution capability |
| Skill | `frootai-tune-05-it-ticket-resolution` | Tune 05 it ticket resolution capability |
| Skill | `frootai-build-genai-rag` | Build genai rag capability |
| Skill | `frootai-contextual-rag` | Contextual rag capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-pii-redactor` | Pii redactor gate |

## Compatible Solution Plays

- **Play 05-it-ticket-resolution**

## Keywords

`it-service-management` `incident-resolution` `rag` `knowledge-base` `semantic-kernel` `escalation` `waf-aligned`

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
2. Edit files in `plugins/it-ticket-resolution/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)