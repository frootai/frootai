# Play 11 — AI Landing Zone Advanced 🏔️

> Multi-region, policy-driven enterprise AI infrastructure with Firewall, DNS, and governance.

The enterprise-grade version of Play 02. Multi-region VNets with Azure Firewall, NAT Gateway, private DNS zones, management group hierarchy, Azure Policy enforcement, and Defender for Cloud. Designed for regulated industries needing compliance controls.

## Quick Start
```bash
cd solution-plays/11-ai-landing-zone-advanced

# Deploy at management group scope
az deployment mg create --management-group-id $MG_ID --location eastus2 \
  --template-file infra/main.bicep --parameters infra/parameters.json

code .  # Use @builder for Bicep/MG, @reviewer for compliance audit, @tuner for cost
```

## Architecture
| Service | Purpose |
|---------|---------|
| Management Groups | Hierarchical governance (Platform/Landing Zones/Sandboxes) |
| Azure Firewall (Premium) | Traffic inspection, IDPS, TLS termination |
| NAT Gateway | Controlled outbound internet access |
| Private DNS Zones | Name resolution for private endpoints |
| Azure Policy | Enforcement (private endpoints, managed identity, encryption) |
| Defender for Cloud | CIS/NIST/ISO compliance monitoring |

## Key Governance Targets
- Policy compliance: ≥95% · Defender score: ≥80% · Private endpoints: 100% on AI services

## DevKit (Infrastructure-Focused)
| Primitive | What It Does |
|-----------|-------------|
| `agent.md` | Root orchestrator with builder→reviewer→tuner handoffs |
| 3 agents | Builder (multi-region Bicep), Reviewer (compliance/Defender), Tuner (SKU/cost) |
| 3 skills | Deploy (105 lines), Evaluate (105 lines), Tune (116 lines) |
| 4 prompts | `/deploy`, `/test`, `/review` (governance), `/evaluate` (compliance) |

**Note:** This is a pure infrastructure play — no AI model parameters, no temperature tuning. TuneKit covers SKU sizing, policy effects, reserved instances, and Firewall rules.

## Cost
| Dev | Prod |
|-----|------|
| $200–500/mo | $2K–15K/mo (hub infrastructure) |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/11-ai-landing-zone-advanced](https://frootai.dev/solution-plays/11-ai-landing-zone-advanced)
