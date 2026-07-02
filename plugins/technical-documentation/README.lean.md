# technical-documentation

> Technical Documentation — API references, architecture guides, README generation, changelog automation, tutorials, and ADRs. AI-assisted writing with Mermaid diagrams, PlantUML, and DrawIO integration.

## Overview

This plugin bundles **20 primitives** (4 agents, 3 instructions, 10 skills, 3 hooks) into a single installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install technical-documentation
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-technical-writer` | Technical writer specialist |
| Agent | `frootai-adr-writer` | Adr writer specialist |
| Agent | `frootai-mermaid-diagram-expert` | Mermaid diagram expert specialist |
| Agent | `frootai-markdown-expert` | Markdown expert specialist |
| Instruction | `markdown-waf` | Markdown waf standards |
| Instruction | `drawio-waf` | Drawio waf standards |
| Instruction | `self-documenting-code-waf` | Self documenting code waf standards |
| Skill | `frootai-documentation-writer` | Documentation writer capability |
| Skill | `frootai-readme-generator` | Readme generator capability |
| Skill | `frootai-changelog-generator` | Changelog generator capability |
| Skill | `frootai-api-docs-generator` | Api docs generator capability |
| Skill | `frootai-tutorial-generator` | Tutorial generator capability |
| Skill | `frootai-mermaid-generator` | Mermaid generator capability |
| Skill | `frootai-plantuml-generator` | Plantuml generator capability |
| Skill | `frootai-drawio-generator` | Drawio generator capability |
| Skill | `frootai-excalidraw-generator` | Excalidraw generator capability |
| Skill | `frootai-component-docs` | Component docs capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |

## Keywords

`documentation` `api-reference` `readme` `changelog` `tutorial` `mermaid` `plantuml` `drawio`

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
2. Edit files in `plugins/technical-documentation/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
