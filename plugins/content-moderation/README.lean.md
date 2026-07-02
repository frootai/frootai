# content-moderation

> Content Moderation — real-time text, image, and multi-modal safety with Azure AI Content Safety, including severity scoring, blocklist management, custom categories, and human-in-the-loop review.

## Overview

This plugin bundles **18 primitives** (5 agents, 3 instructions, 5 skills, 5 hooks) in one installable package. All primitives are WAF-aligned and auto-wire with the FAI Protocol.

## Installation

```bash
npx frootai install content-moderation
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-play-10-builder` | Play 10 builder |
| Agent | `frootai-play-10-reviewer` | Play 10 reviewer |
| Agent | `frootai-play-10-tuner` | Play 10 tuner |
| Agent | `frootai-content-safety-expert` | Content safety expert |
| Agent | `frootai-responsible-ai-reviewer` | Responsible ai reviewer |
| Instruction | `play-10-content-moderation-patterns` | Play 10 content moderation patterns |
| Instruction | `rai-content-safety` | Rai content safety standards |
| Instruction | `rai-bias-testing` | Rai bias testing standards |
| Skill | `frootai-deploy-10-content-moderation` | Deploy 10 content moderation |
| Skill | `frootai-evaluate-10-content-moderation` | Evaluate 10 content moderation |
| Skill | `frootai-tune-10-content-moderation` | Tune 10 content moderation |
| Skill | `frootai-content-safety-review` | Content safety review |
| Skill | `frootai-human-in-the-loop` | Human in the loop |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-pii-redactor` | Pii redactor gate |
| Hook | `frootai-output-validator` | Output validator gate |

## Compatible Solution Plays

- **Play 10-content-moderation**

## Keywords

`content-moderation` `content-safety` `azure-ai` `image-moderation` `text-moderation` `blocklist` `responsible-ai`

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
| Responsible AI | Content safety, PII redaction, bias detection, groundedness enforcement |

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
2. Edit `plugins/content-moderation/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
