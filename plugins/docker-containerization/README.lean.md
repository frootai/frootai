# docker-containerization

> Docker Containerization — multi-stage builds, distroless images, BuildKit caching, health checks, and security scanning. Containerize any workload with optimized images for AI inference and web services.

## Overview

This plugin bundles **11 primitives** (1 agents, 2 instructions, 4 skills, 4 hooks) in one installable package; all are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install docker-containerization
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-docker-expert` | Docker expert |
| Instruction | `docker-waf` | Docker WAF standards |
| Instruction | `containerization-waf` | Containerization WAF standards |
| Skill | `frootai-build-docker-image` | Build Docker images |
| Skill | `frootai-multi-stage-docker` | Multi-stage Docker |
| Skill | `frootai-containerize-aspnet` | Containerize ASP.NET |
| Skill | `frootai-containerize-aspnet-framework` | Containerize ASP.NET Framework |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-license-checker` | License checker gate |

## Keywords

`docker` `containerization` `multi-stage` `distroless` `buildkit` `health-checks` `security-scanning`

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

1. Fork the [FrootAI repository](https://github.com/FrootAI/frootai)
2. Edit files in `plugins/docker-containerization/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md).

## License

MIT — see [LICENSE](../../LICENSE)
