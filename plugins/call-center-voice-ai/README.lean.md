# call-center-voice-ai

> Call Center Voice AI — real-time speech-to-text, intent classification, sentiment analysis, and AI-assisted agent coaching. Integrates Azure AI Speech, Azure Communication Services, and GPT-4o for voice-driven customer service.

## Overview

This plugin bundles **16 primitives** (4 agents, 3 instructions, 4 skills, 5 hooks) into one installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install call-center-voice-ai
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-play-04-builder` | Play 04 builder specialist |
| Agent | `frootai-play-04-reviewer` | Play 04 reviewer specialist |
| Agent | `frootai-play-04-tuner` | Play 04 tuner specialist |
| Agent | `frootai-streaming-expert` | Streaming expert specialist |
| Instruction | `play-04-call-center-voice-ai-patterns` | Play 04 call center voice ai patterns standards |
| Instruction | `python-waf` | Python waf standards |
| Instruction | `rai-content-safety` | Rai content safety standards |
| Skill | `frootai-deploy-04-call-center-voice-ai` | Deploy 04 call center voice ai capability |
| Skill | `frootai-evaluate-04-call-center-voice-ai` | Evaluate 04 call center voice ai capability |
| Skill | `frootai-tune-04-call-center-voice-ai` | Tune 04 call center voice ai capability |
| Skill | `frootai-build-genai-rag` | Build genai rag capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-pii-redactor` | Pii redactor gate |
| Hook | `frootai-cost-tracker` | Cost tracker gate |

## Compatible Solution Plays

- **Play 04-call-center-voice-ai**

## Keywords

`voice-ai` `call-center` `speech-to-text` `sentiment` `azure-communication-services` `real-time` `customer-service`

## Usage

After installation:

1. **Agents** activate when you `@mention` them in Copilot Chat
2. **Instructions** auto-apply to matching files via `applyTo` glob patterns
3. **Skills** are invoked by agents or via `/skill` commands
4. **Hooks** fire automatically at session lifecycle events

Inside a solution play with `fai-manifest.json`, all primitives auto-wire through the FAI Protocol; shared context, WAF guardrails, and evaluation thresholds propagate automatically.

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
2. Edit files in `plugins/call-center-voice-ai/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
