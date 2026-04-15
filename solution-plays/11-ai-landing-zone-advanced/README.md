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

## Architecture

```mermaid
graph TB
    subgraph Management Layer
        Bastion[Azure Bastion<br/>Secure Admin Access]
        Defender[Defender for Cloud<br/>CSPM + Threat Protection]
        Policy[Azure Policy<br/>AI Governance Guardrails]
    end

    subgraph Hub Region 1
        FW1[Azure Firewall Premium<br/>TLS Inspection + IDPS]
        DNS1[Private DNS Zones<br/>Endpoint Resolution]
    end

    subgraph Hub Region 2
        FW2[Azure Firewall Premium<br/>TLS Inspection + IDPS]
        DNS2[Private DNS Zones<br/>Endpoint Resolution]
    end

    subgraph AI Workload Spokes
        SPOKE1[Spoke VNet 1<br/>AI Services + PE]
        SPOKE2[Spoke VNet 2<br/>Data Platform + PE]
        SPOKE3[Spoke VNet 3<br/>ML Training + GPU]
    end

    subgraph Identity
        ENTRA[Entra ID P2<br/>PIM + Access Reviews]
        RBAC[RBAC<br/>Custom AI Roles]
    end

    subgraph Monitoring
        LA[Log Analytics<br/>Centralized Logging]
        KV[Key Vault<br/>Platform Secrets]
    end

    FW1 -->|filtered| SPOKE1
    FW1 -->|filtered| SPOKE2
    FW2 -->|filtered| SPOKE3
    DNS1 -->|resolution| SPOKE1
    DNS2 -->|resolution| SPOKE3
    ENTRA -->|PIM| RBAC
    RBAC -->|access| SPOKE1
    RBAC -->|access| SPOKE2
    Policy -->|enforce| SPOKE1
    Policy -->|enforce| SPOKE2
    Policy -->|enforce| SPOKE3
    Defender -->|monitor| SPOKE1
    Defender -->|monitor| SPOKE3
    LA -->|collect| FW1
    LA -->|collect| FW2
    Bastion -->|admin| SPOKE1

    style Bastion fill:#7c3aed,color:#fff
    style Defender fill:#7c3aed,color:#fff
    style Policy fill:#7c3aed,color:#fff
    style FW1 fill:#7c3aed,color:#fff
    style FW2 fill:#7c3aed,color:#fff
    style DNS1 fill:#3b82f6,color:#fff
    style DNS2 fill:#3b82f6,color:#fff
    style SPOKE1 fill:#10b981,color:#fff
    style SPOKE2 fill:#10b981,color:#fff
    style SPOKE3 fill:#10b981,color:#fff
    style ENTRA fill:#7c3aed,color:#fff
    style RBAC fill:#7c3aed,color:#fff
    style LA fill:#0ea5e9,color:#fff
    style KV fill:#7c3aed,color:#fff
```

> 📐 [Full architecture details](architecture.md) — data flow, security architecture, scaling guide

## Cost Estimate

| Service | Dev/PoC | Production | Enterprise |
|---------|---------|-----------|------------|
| Virtual Network (Multi-Region) | $0 (Single region) | $50 (Dual region) | $200 (Multi-region 3+) |
| Azure Firewall | $250 (Basic) | $650 (Standard) | $1,300 (Premium) |
| Azure Policy | $0 (Free) | $0 (Free) | $0 (Free) |
| RBAC + Entra ID | $0 (Free) | $60 (Entra P1) | $250 (Entra P2) |
| Private DNS Zones | $3 (Standard) | $8 (Standard) | $20 (Standard) |
| Monitor + Log Analytics | $0 (Free) | $50 (Pay-per-GB) | $200 (Commitment) |
| Defender for Cloud | $0 (Free) | $50 (CSPM) | $200 (Full CWP) |
| Key Vault (Platform) | $1 (Standard) | $5 (Standard) | $15 (Premium HSM) |
| Azure Bastion | $0 (Developer) | $140 (Basic) | $280 (Standard) |
| **Total** | **$254/mo** | **$1,013/mo** | **$2,465/mo** |

> 💰 [Full cost breakdown](cost.json) — per-service SKUs, usage assumptions, optimization tips

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/11-ai-landing-zone-advanced](https://frootai.dev/solution-plays/11-ai-landing-zone-advanced)
