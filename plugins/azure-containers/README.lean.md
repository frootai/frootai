# azure-containers

> Azure Containers — AKS, Container Apps, Container Registry, and Dockerized deployment patterns for GPU workloads, KEDA autoscaling, Dapr sidecars, and multi-arch AI model serving.

## Overview

This plugin bundles **15 primitives** (4 agents, 3 instructions, 4 skills, 4 hooks) into one installable package. All primitives are WAF-aligned and FAI Protocol auto-wiring compatible.

## Installation

```bash
npx frootai install azure-containers
```

Or copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-azure-aks-expert` | Azure aks expert specialist |
| Agent | `frootai-azure-container-apps-expert` | Azure container apps expert specialist |
| Agent | `frootai-kubernetes-expert` | Kubernetes expert specialist |
| Agent | `frootai-docker-expert` | Docker expert specialist |
| Instruction | `kubernetes-waf` | Kubernetes waf standards |
| Instruction | `docker-waf` | Docker waf standards |
| Instruction | `containerization-waf` | Containerization waf standards |
| Skill | `frootai-build-kubernetes-manifest` | Build kubernetes manifest capability |
| Skill | `frootai-multi-stage-docker` | Multi stage docker capability |
| Skill | `frootai-azure-container-registry` | Azure container registry capability |
| Skill | `frootai-containerize-aspnet` | Containerize aspnet capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-cost-tracker` | Cost tracker gate |

## Keywords

`azure` `aks` `container-apps` `acr` `docker` `keda` `dapr` `gpu` `kubernetes`

## Usage

After installation, the primitives are available in your project:

1. **Agents** activate when you `@mention` them in Copilot Chat
2. **Instructions** auto-apply to matching files via `applyTo` glob patterns
3. **Skills** are invoked by agents or via `/skill` commands
4. **Hooks** fire automatically at session lifecycle events

When used inside a solution play with `fai-manifest.json`, primitives auto-wire through the FAI Protocol — shared context, WAF guardrails, and evaluation thresholds propagate automatically.

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
2. Edit files in `plugins/azure-containers/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
