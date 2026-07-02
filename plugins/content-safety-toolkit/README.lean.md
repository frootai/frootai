# content-safety-toolkit

> Content Safety Toolkit — Azure AI Content Safety integration, custom blocklists, severity thresholds, image moderation, prompt injection detection, and jailbreak defense patterns for production AI.

## Overview

This plugin bundles **11 primitives** (2 agents, 2 instructions, 2 skills, 5 hooks) into one installable package; all are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install content-safety-toolkit
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-content-safety-expert` | Content safety expert |
| Agent | `frootai-red-team-expert` | Red team expert |
| Instruction | `rai-content-safety` | Rai content safety standards |
| Instruction | `ai-prompt-safety-waf` | Ai prompt safety waf standards |
| Skill | `frootai-content-safety-review` | Content safety review |
| Skill | `frootai-guardrails-policy` | Guardrails policy |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-output-validator` | Output validator gate |
| Hook | `frootai-pii-redactor` | Pii redactor gate |

## Keywords

`content-safety` `moderation` `blocklist` `prompt-injection` `jailbreak` `image-moderation` `azure-ai`

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
2. Edit files in `plugins/content-safety-toolkit/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
