# azure-ai-services

> Azure AI Services — OpenAI, AI Search, Document Intelligence, Language, Speech, Vision, and Content Safety patterns. Production-ready wrappers with retry, circuit breaker, and cost tracking.

## Overview

This plugin bundles **19 primitives** (5 agents, 4 instructions, 5 skills, 5 hooks) into one installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install azure-ai-services
```

Or copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-azure-openai-expert` | Azure openai expert specialist |
| Agent | `frootai-azure-ai-search-expert` | Azure ai search expert specialist |
| Agent | `frootai-azure-ai-foundry-expert` | Azure ai foundry expert specialist |
| Agent | `frootai-content-safety-expert` | Content safety expert specialist |
| Agent | `frootai-embedding-expert` | Embedding expert specialist |
| Instruction | `azure-ai-document-intelligence-waf` | Azure ai document intelligence waf standards |
| Instruction | `azure-ai-language-waf` | Azure ai language waf standards |
| Instruction | `azure-ai-speech-waf` | Azure ai speech waf standards |
| Instruction | `azure-ai-vision-waf` | Azure ai vision waf standards |
| Skill | `frootai-azure-openai-integration` | Azure openai integration capability |
| Skill | `frootai-azure-ai-search-index` | Azure ai search index capability |
| Skill | `frootai-azure-ai-foundry-setup` | Azure ai foundry setup capability |
| Skill | `frootai-azure-cognitive-services` | Azure cognitive services capability |
| Skill | `frootai-content-safety-review` | Content safety review capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-cost-tracker` | Cost tracker gate |
| Hook | `frootai-token-budget-enforcer` | Token budget enforcer gate |

## Keywords

`azure` `ai-services` `openai` `ai-search` `document-intelligence` `language` `speech` `vision` `content-safety`

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
2. Edit files in `plugins/azure-ai-services/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
