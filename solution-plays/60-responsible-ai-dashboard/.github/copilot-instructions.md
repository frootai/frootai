---
description: "Responsible AI Dashboard domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Responsible AI Dashboard — Domain Knowledge

This workspace implements a responsible AI dashboard — centralized monitoring of fairness metrics, transparency reports, model explainability, content safety incidents, and compliance status across all AI systems.

## RAI Dashboard Architecture (What the Model Gets Wrong)

### Multi-Model Monitoring Hub
```python
# Dashboard aggregates metrics from ALL AI systems in the organization
class RAIDashboard:
    systems: list[AISystem]     # All registered AI systems
    
    async def collect_metrics(self) -> DashboardData:
        metrics = {}
        for system in self.systems:
            metrics[system.name] = {
                "fairness": await system.get_fairness_metrics(),      # Demographic parity, equalized odds
                "transparency": await system.get_transparency_score(), # Model cards, documentation
                "safety": await system.get_safety_incidents(),        # Content safety violations
                "groundedness": await system.get_groundedness_score(), # Hallucination rate
                "explainability": await system.get_explainability(),  # SHAP/LIME availability
                "compliance": await system.get_compliance_status(),   # EU AI Act, GDPR, HIPAA
            }
        return DashboardData(metrics=metrics, generated=datetime.utcnow())
```

### Fairness Metrics (Not Optional)
| Metric | What It Measures | Target |
|--------|-----------------|--------|
| Demographic Parity | Equal selection rate across groups | Ratio > 0.8 (4/5ths rule) |
| Equalized Odds | Equal true positive rate across groups | Difference < 0.1 |
| Calibration | Predicted probabilities match actual outcomes | Slope within 0.9-1.1 |
| Disparate Impact | Adverse impact on protected groups | Ratio > 0.8 |

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| No centralized dashboard | Each team monitors independently (or doesn't) | Organization-wide RAI hub |
| Fairness measured once | Bias changes with data drift | Continuous monitoring (weekly cadence) |
| No incident tracking | Safety violations not logged | Incident log with severity, root cause, remediation |
| Fairness without intersectionality | Miss compounded bias (e.g., age + gender) | Test intersectional groups, not just single attributes |
| No model cards | Systems undocumented | Require model card for every production system |
| Compliance checkbox only | "Yes we're compliant" without evidence | Evidence-based: link to test results, audit logs |
| Dashboard without alerts | Data sits unreviewed | Alert on: fairness drop, new incidents, compliance gaps |
| No executive summary | Non-technical stakeholders can't interpret | Summary view: red/yellow/green per system |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | LLM for generating summaries, explanations |
| `config/guardrails.json` | Fairness thresholds, alert rules, compliance requirements |
| `config/agents.json` | System registry, monitoring cadence, report schedule |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement dashboard, metrics collection, incident tracking |
| `@reviewer` | Audit fairness testing methodology, compliance evidence |
| `@tuner` | Optimize monitoring cadence, alert thresholds, reporting |

## Slash Commands
`/deploy` — Deploy RAI dashboard | `/test` — Test metrics collection | `/review` — Audit compliance | `/evaluate` — Generate RAI report
