# fai-protocol-starter

> FAI Protocol Starter — quickstart for the FAI Protocol ecosystem. Scaffold fai-manifest.json, fai-context.json, and connect primitives into wired solution plays. The entry point for building FAI Protocol compliant solutions.

## Overview

This plugin bundles **12 primitives** (2 agents, 2 instructions, 4 skills, 4 hooks) into a single installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install fai-protocol-starter
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-architect` | Architect specialist |
| Agent | `frootai-play-dispatcher` | Play dispatcher specialist |
| Instruction | `mcp-integration-patterns` | O3 mcp patterns standards |
| Instruction | `azure-ai-foundry` | O4 foundry config standards |
| Skill | `frootai-play-initializer` | Play initializer capability |
| Skill | `frootai-skill-template` | Skill template capability |
| Skill | `frootai-folder-structure` | Folder structure capability |
| Skill | `frootai-copilot-instructions-generator` | Copilot instructions generator capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-waf-compliance` | Waf compliance gate |

## Keywords

`fai-protocol` `fai-manifest` `fai-context` `scaffold` `quickstart` `wiring` `solution-play`

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
2. Edit files in `plugins/fai-protocol-starter/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)