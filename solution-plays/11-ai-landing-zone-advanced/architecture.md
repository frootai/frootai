# Architecture — Play 11: AI Landing Zone — Advanced

## Overview

Multi-region, policy-driven Azure landing zone purpose-built for enterprise AI workloads. Extends Play 02 (basic landing zone) with hub-spoke networking across regions, Azure Firewall for centralized egress control, Azure Policy guardrails for AI governance, Entra ID PIM for privileged access, and Defender for Cloud for security posture management. All AI workloads deploy into governed spoke VNets with private endpoints.

## Architecture Diagram

```mermaid
graph TB
    subgraph Management Layer
        Bastion[Azure Bastion<br/>Secure Admin Access]
        Defender[Defender for Cloud<br/>CSPM + Threat Protection]
        Policy[Azure Policy<br/>AI Governance Guardrails]
    end

    subgraph Hub Region 1 — Primary
        Hub1FW[Azure Firewall<br/>Egress Filtering + Threat Intel]
        Hub1DNS[Private DNS Zones<br/>OpenAI · Search · Storage]
        Hub1KV[Key Vault<br/>Platform Secrets]
        Hub1LA[Log Analytics<br/>Central Monitoring]
    end

    subgraph Spoke — AI Workloads Primary
        AISearch[Azure AI Search<br/>Private Endpoint]
        OpenAI1[Azure OpenAI<br/>Private Endpoint]
        ACA1[Container Apps<br/>AI Applications]
    end

    subgraph Hub Region 2 — Secondary
        Hub2FW[Azure Firewall<br/>Egress Filtering + Failover]
        Hub2DNS[Private DNS Zones<br/>Cross-region Resolution]
    end

    subgraph Spoke — AI Workloads Secondary
        OpenAI2[Azure OpenAI<br/>Private Endpoint — DR]
        ACA2[Container Apps<br/>AI Applications — DR]
    end

    subgraph Identity Layer
        EntraID[Entra ID P2<br/>PIM + Access Reviews + CA]
        RBAC[Custom AI Roles<br/>AI Developer · AI Reviewer · AI Admin]
    end

    Bastion -->|RDP/SSH| ACA1
    Defender -->|Posture Scan| AISearch
    Defender -->|Posture Scan| OpenAI1
    Policy -->|Enforce SKU/Region| AISearch
    Policy -->|Enforce SKU/Region| OpenAI1

    ACA1 -->|Egress via| Hub1FW
    AISearch -->|DNS| Hub1DNS
    OpenAI1 -->|DNS| Hub1DNS
    Hub1FW -->|Logs| Hub1LA
    ACA1 -->|Secrets| Hub1KV

    ACA2 -->|Egress via| Hub2FW
    OpenAI2 -->|DNS| Hub2DNS

    Hub1FW -->|Global Peering| Hub2FW

    EntraID -->|Authenticate| ACA1
    RBAC -->|Authorize| OpenAI1
    RBAC -->|Authorize| AISearch

    style Bastion fill:#06b6d4,color:#fff,stroke:#0891b2
    style Defender fill:#7c3aed,color:#fff,stroke:#6d28d9
    style Policy fill:#7c3aed,color:#fff,stroke:#6d28d9
    style Hub1FW fill:#7c3aed,color:#fff,stroke:#6d28d9
    style Hub1DNS fill:#f59e0b,color:#fff,stroke:#d97706
    style Hub1KV fill:#7c3aed,color:#fff,stroke:#6d28d9
    style Hub1LA fill:#0ea5e9,color:#fff,stroke:#0284c7
    style Hub2FW fill:#7c3aed,color:#fff,stroke:#6d28d9
    style Hub2DNS fill:#f59e0b,color:#fff,stroke:#d97706
    style AISearch fill:#10b981,color:#fff,stroke:#059669
    style OpenAI1 fill:#10b981,color:#fff,stroke:#059669
    style ACA1 fill:#06b6d4,color:#fff,stroke:#0891b2
    style OpenAI2 fill:#10b981,color:#fff,stroke:#059669
    style ACA2 fill:#06b6d4,color:#fff,stroke:#0891b2
    style EntraID fill:#7c3aed,color:#fff,stroke:#6d28d9
    style RBAC fill:#7c3aed,color:#fff,stroke:#6d28d9
```

## Data Flow

1. **Deployment**: AI workloads deployed into governed spoke VNets via CI/CD → Azure Policy validates SKU, region, network rules, and tagging before resource creation → Non-compliant deployments denied at ARM level
2. **Networking**: All AI service traffic routes through hub VNet → Azure Firewall applies FQDN rules and threat intelligence → Private DNS zones resolve AI service endpoints to private IPs
3. **Identity**: Developers authenticate via Entra ID → PIM provides just-in-time access to AI resources → Custom RBAC roles (AI Developer, AI Reviewer, AI Admin) scope permissions per workload
4. **Monitoring**: All network flows, policy compliance events, and security alerts centralized in Log Analytics → Defender for Cloud provides CSPM score and attack path analysis → Alerts trigger incident response workflows
5. **Failover**: Secondary region hub mirrors primary → Azure OpenAI and Container Apps deployed in active-passive → DNS failover via Azure Traffic Manager or Front Door

## Service Roles

| Service | Layer | Role |
|---------|-------|------|
| Virtual Networks (Hub-Spoke) | Networking | Network isolation, peering, multi-region topology |
| Azure Firewall | Security | Centralized egress filtering, FQDN rules, threat intel |
| Azure Policy | Governance | AI service guardrails — enforce SKUs, regions, networking |
| Entra ID (P2) | Identity | PIM, conditional access, access reviews, SSO |
| Custom RBAC Roles | Identity | AI Developer, AI Reviewer, AI Admin scoped permissions |
| Private DNS Zones | Networking | Private endpoint DNS resolution for all AI services |
| Azure Monitor + Log Analytics | Monitoring | Central logging, NSG flow logs, KQL, alerting |
| Defender for Cloud | Security | CSPM, vulnerability assessment, threat protection |
| Key Vault | Security | Platform-level secrets, certificates, firewall certs |
| Azure Bastion | Management | Secure admin access without public IPs |

## Security Architecture

- **Zero Trust Networking**: All AI services behind private endpoints — no public access in production
- **Azure Firewall**: Egress locked to approved FQDNs only (e.g., `*.openai.azure.com`, `*.search.windows.net`)
- **Azure Policy (Deny)**: Prevent deployment of non-compliant AI resources — wrong SKU, wrong region, missing tags
- **Entra ID PIM**: Just-in-time privileged access — no standing admin permissions
- **Defender for Cloud**: Continuous security posture assessment, attack path analysis
- **NSG Flow Logs**: All network traffic logged and analyzed via Log Analytics
- **Encryption**: All data encrypted at rest (platform-managed or CMK) and in transit (TLS 1.2+)

## Scaling

| Metric | Dev | Production | Enterprise |
|--------|-----|-----------|------------|
| Regions | 1 | 2 | 3+ |
| Hub VNets | 1 | 2 | 3+ |
| Spoke VNets | 2 | 4-8 | 10-20 |
| AI workloads hosted | 2-3 | 10-20 | 50+ |
| Policy definitions | 10 | 30 | 50+ |
| Custom RBAC roles | 2 | 5 | 10+ |
| Private DNS zones | 5 | 15 | 40+ |
| Log Analytics ingestion | 500MB/day | 30GB/day | 200GB/day |
