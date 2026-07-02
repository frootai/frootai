# python-mcp-development

> Python MCP Development — build MCP servers in Python with FastMCP, asyncio, Pydantic models, type-safe tool schemas, and Azure Functions hosting.

## Overview

This plugin bundles **9 primitives** (2 agents, 2 instructions, 2 skills, 3 hooks) into a single installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install python-mcp-development
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-python-mcp-expert` | Python mcp expert specialist |
| Agent | `frootai-python-expert` | Python expert specialist |
| Instruction | `python-mcp-development` | Python mcp development standards |
| Instruction | `python-waf` | Python waf standards |
| Skill | `frootai-mcp-python-scaffold` | Mcp python scaffold capability |
| Skill | `frootai-mcp-python-generator` | Mcp python generator capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |

## Keywords

`python` `fastmcp` `mcp` `asyncio` `pydantic` `model-context-protocol` `tool-server`

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
| Performance Efficiency | Async patterns, streaming, caching, parallel execution |

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
2. Edit files in `plugins/python-mcp-development/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
