---
description: "Enterprise AI Governance Hub domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Enterprise AI Governance Hub — Domain Knowledge

This workspace implements an enterprise AI governance hub — centralized AI system registry, risk classification (EU AI Act), model lifecycle management, policy enforcement, and organization-wide AI compliance dashboard.

## Governance Hub Architecture (What the Model Gets Wrong)

### AI System Registry
```python
class AISystem(BaseModel):
    id: str
    name: str
    owner: str                    # Team/person responsible
    risk_level: str               # unacceptable, high, limited, minimal (EU AI Act)
    status: str                   # development, staging, production, deprecated
    model_info: ModelInfo         # Model name, version, provider
    data_sources: list[str]       # Training and inference data sources
    compliance: ComplianceStatus  # Per-regulation compliance status
    last_assessment: datetime     # Last governance review date
    next_review: datetime         # Scheduled next review

async def register_ai_system(system: AISystem) -> RegistrationResult:
    # 1. Auto-classify risk level
    system.risk_level = await classify_risk(system)
    
    # 2. Check mandatory requirements per risk level
    requirements = get_requirements(system.risk_level)
    missing = [r for r in requirements if not system.meets(r)]
    
    # 3. If high-risk: require human oversight plan + conformity assessment
    if system.risk_level == "high" and not system.has_oversight_plan:
        return RegistrationResult(status="blocked", reason="High-risk AI requires human oversight plan")
    
    # 4. Register and schedule review
    system.next_review = calculate_review_date(system.risk_level)  # High=quarterly, Limited=annually
    await registry.save(system)
    return RegistrationResult(status="registered", next_review=system.next_review)
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| No central registry | Shadow AI — teams deploy without oversight | Mandatory registration before production |
| Self-assessed risk | Teams understate risk to avoid scrutiny | Independent risk classification with evidence |
| One-time assessment | Compliance at launch ≠ compliance 6 months later | Scheduled reviews: high-risk quarterly, others annually |
| No policy enforcement | Policies documented but not enforced | Automated gates: block non-compliant deployments |
| Ignore model lifecycle | Deprecated models still serving production | Status tracking: development → production → deprecated |
| No cross-system view | Can't identify organization-wide AI risks | Dashboard: aggregated risk, compliance gaps, incident trends |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | LLM for risk classification, report generation |
| `config/guardrails.json` | Risk classification rules, review schedules, compliance requirements |
| `config/agents.json` | Registry schema, policy definitions, notification channels |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement registry, risk classification, policy enforcement |
| `@reviewer` | Audit classification accuracy, compliance evidence, gaps |
| `@tuner` | Optimize review cadence, policy coverage, dashboard metrics |

## Slash Commands
`/deploy` — Deploy governance hub | `/test` — Test registration flow | `/review` — Compliance audit | `/evaluate` — Generate governance report
