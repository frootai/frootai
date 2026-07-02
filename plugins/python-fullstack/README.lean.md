# python-fullstack

> Python Full-Stack — FastAPI, Django, Flask, Pydantic, SQLAlchemy, pytest, and async patterns. Data science to web APIs with type safety, dependency injection, and production deployment.

## Overview

This plugin bundles **15 primitives** (2 agents, 7 instructions, 3 skills, 3 hooks) into one installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install python-fullstack
```

Or copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-python-expert` | Python expert specialist |
| Agent | `frootai-python-mcp-expert` | Python mcp expert specialist |
| Instruction | `python-waf` | Python waf standards |
| Instruction | `fastapi-waf` | Fastapi waf standards |
| Instruction | `django-waf` | Django waf standards |
| Instruction | `flask-waf` | Flask waf standards |
| Instruction | `pydantic-waf` | Pydantic waf standards |
| Instruction | `sqlalchemy-waf` | Sqlalchemy waf standards |
| Instruction | `pytest-waf` | Pytest waf standards |
| Skill | `frootai-fastapi-scaffold` | Fastapi scaffold capability |
| Skill | `frootai-pytest-coverage` | Pytest coverage capability |
| Skill | `frootai-playwright-python-test` | Playwright python test capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |

## Keywords

`python` `fastapi` `django` `flask` `pydantic` `sqlalchemy` `pytest` `async`

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
2. Edit files in `plugins/python-fullstack/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
