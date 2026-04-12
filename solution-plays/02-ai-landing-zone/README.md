# Play 02 — AI Landing Zone ⛰️

> Foundational Azure infrastructure for AI workloads — networking, identity, governance.

Deploy the foundational infrastructure every AI workload needs. VNet with private endpoints keeps traffic off the public internet, Managed Identity eliminates secrets, RBAC locks down access, and Key Vault stores what must be stored.

## Quick Start
```bash
cd solution-plays/02-ai-landing-zone
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .  # Use @builder for Bicep, @reviewer for security audit, @tuner for cost
```

## Architecture
| Service | Purpose |
|---------|---------|
| VNet + Private Endpoints | Network isolation for all AI services |
| RBAC + Managed Identity | Zero-secret authentication |
| Key Vault | Secret management for what must be stored |
| GPU Quota Management | Capacity planning for AI workloads |

## DevKit
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (Bicep infra), Reviewer (security/compliance), Tuner (SKU/cost) |
| 3 skills | Deploy (161 lines), Evaluate (170 lines), Tune (227 lines) |
| 4 prompts | `/deploy`, `/test`, `/review`, `/evaluate` |

## Cost
| Dev | Prod |
|-----|------|
| $10–50/mo | Included in dependent services |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/02-ai-landing-zone](https://frootai.dev/solution-plays/02-ai-landing-zone)
