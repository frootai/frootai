# cicd-automation

> CI/CD Automation — GitHub Actions, Azure DevOps pipelines, build matrices, deployment gates, and release management. Automate test → build → deploy → evaluate pipelines for AI workloads.

## Overview

This plugin packages **13 primitives** (3 agents, 3 instructions, 3 skills, 4 hooks) in one installable bundle. All are WAF-aligned and FAI Protocol auto-wire compatible.

## Installation

```bash
npx frootai install cicd-automation
```

Or copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-github-actions-expert` | GitHub Actions specialist |
| Agent | `frootai-cicd-pipeline-expert` | CI/CD pipeline specialist |
| Agent | `frootai-azure-devops-expert` | Azure DevOps specialist |
| Instruction | `github-actions-waf` | GitHub Actions WAF standards |
| Instruction | `azure-devops-waf` | Azure DevOps WAF standards |
| Instruction | `opex-github-actions` | Opex GitHub Actions standards |
| Skill | `frootai-build-github-workflow` | Build GitHub workflow capability |
| Skill | `frootai-codeql-setup` | CodeQL setup capability |
| Skill | `frootai-editorconfig-setup` | Editorconfig setup capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-waf-compliance` | WAF compliance gate |

## Keywords

`cicd` `github-actions` `azure-devops` `pipelines` `deployment` `release` `automation`

## Usage

After install, primitives are available:

1. **Agents** activate when you `@mention` them in Copilot Chat
2. **Instructions** auto-apply to matching files via `applyTo` glob patterns
3. **Skills** are invoked by agents or via `/skill` commands
4. **Hooks** fire automatically at session lifecycle events

Inside a solution play with `fai-manifest.json`, all primitives auto-wire through the FAI Protocol — shared context, WAF guardrails, and evaluation thresholds propagate automatically.

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
2. Edit `plugins/cicd-automation/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
