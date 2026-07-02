# document-intelligence

> Document Intelligence — OCR, form extraction, table recognition, and intelligent document processing. Uses Azure AI Document Intelligence with custom models for invoices, receipts, contracts, and domain-specific forms.

## Overview

This plugin bundles **15 primitives** (4 agents, 3 instructions, 4 skills, 4 hooks) into a single installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install document-intelligence
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-play-06-builder` | Play 06 builder specialist |
| Agent | `frootai-play-06-reviewer` | Play 06 reviewer specialist |
| Agent | `frootai-play-06-tuner` | Play 06 tuner specialist |
| Agent | `frootai-data-engineer` | Data engineer specialist |
| Instruction | `play-06-document-intelligence-patterns` | Play 06 document intelligence patterns standards |
| Instruction | `python-waf` | Python waf standards |
| Instruction | `azure-ai-document-intelligence-waf` | Azure ai document intelligence waf standards |
| Skill | `frootai-deploy-06-document-intelligence` | Deploy 06 document intelligence capability |
| Skill | `frootai-evaluate-06-document-intelligence` | Evaluate 06 document intelligence capability |
| Skill | `frootai-tune-06-document-intelligence` | Tune 06 document intelligence capability |
| Skill | `frootai-build-etl-pipeline` | Build etl pipeline capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-pii-redactor` | Pii redactor gate |

## Compatible Solution Plays

- **Play 06-document-intelligence**

## Keywords

`document-intelligence` `ocr` `form-extraction` `table-recognition` `azure-ai` `invoice` `contract` `waf-aligned`

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
2. Edit files in `plugins/document-intelligence/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
