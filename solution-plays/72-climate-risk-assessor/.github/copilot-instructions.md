---
description: "Climate Risk Assessor domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Climate Risk Assessor — Domain Knowledge

This workspace implements AI climate risk assessment — physical risk scoring (floods, storms, heat), transition risk analysis (policy, market, technology), scenario modeling (NGFS, IPCC), and TCFD-aligned reporting.

## Climate Risk Architecture (What the Model Gets Wrong)

### Risk Assessment Framework
```python
class ClimateRisk(BaseModel):
    physical_risks: list[PhysicalRisk]    # Flood, storm, heat, wildfire, sea level
    transition_risks: list[TransitionRisk] # Policy, market, technology, reputation
    opportunities: list[Opportunity]       # Renewable energy, efficiency, new markets
    scenario: str                          # "orderly", "disorderly", "hot_house"
    time_horizon: str                      # "short" (1-3y), "medium" (3-10y), "long" (10-30y)
    financial_impact: FinancialImpact       # Revenue, cost, asset value impact

async def assess_climate_risk(company: CompanyProfile, scenario: str = "disorderly") -> ClimateRisk:
    # 1. Physical risk: location-based analysis
    physical = await assess_physical_risks(company.locations, scenario)
    # Flood exposure, heat stress, storm frequency per location
    
    # 2. Transition risk: sector + policy analysis
    transition = await assess_transition_risks(company.sector, company.carbon_intensity, scenario)
    # Carbon pricing impact, stranded asset risk, market shift
    
    # 3. Financial impact quantification
    financial = await quantify_financial_impact(physical, transition, company.financials)
    
    return ClimateRisk(physical_risks=physical, transition_risks=transition, financial_impact=financial, scenario=scenario)
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Physical risk only | Miss transition risks (often larger financial impact) | Assess both physical AND transition risks |
| Single scenario | Miss range of outcomes | Model 3+ scenarios (orderly, disorderly, hot house) |
| LLM estimates financial impact | Hallucinated numbers | Ground in climate models (NGFS, IPCC data) + financial models |
| No location-level analysis | Country-level too coarse | Asset-level: lat/long → flood maps, heat projections |
| Static assessment | Climate projections evolve | Annual reassessment + trigger on major climate events |
| Ignore opportunities | Only report risks | TCFD requires both risks AND opportunities |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | LLM for narrative generation, scenario analysis |
| `config/guardrails.json` | Risk thresholds, scenario parameters, time horizons |
| `config/agents.json` | Climate data sources, NGFS scenarios, reporting framework |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement risk models, scenario analysis, financial quantification |
| `@reviewer` | Audit data sources, model assumptions, TCFD alignment |
| `@tuner` | Optimize scenario parameters, risk granularity, reporting |

## Slash Commands
`/deploy` — Deploy risk assessor | `/test` — Test with sample company | `/review` — Audit methodology | `/evaluate` — Generate TCFD report
