---
description: "AI-Powered DevOps domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# AI-Powered DevOps — Domain Knowledge

This workspace implements AI-powered DevOps — intelligent incident management, automated root cause analysis, deployment risk scoring, change impact prediction, and AIOps dashboards.

## AIOps Architecture (What the Model Gets Wrong)

### Incident Response Pipeline
```python
async def handle_incident(alert: Alert) -> IncidentResponse:
    # 1. Classify severity using alert context + historical patterns
    severity = await classify_severity(alert)  # P1/P2/P3/P4
    
    # 2. Root cause analysis — correlate with recent changes
    recent_changes = get_recent_deployments(hours=24)
    recent_alerts = get_correlated_alerts(alert, window_minutes=30)
    root_cause = await analyze_root_cause(alert, recent_changes, recent_alerts)
    
    # 3. Suggest remediation
    remediation = await suggest_fix(root_cause, knowledge_base="runbooks")
    
    # 4. Auto-remediate if confidence > 0.9 and it's a known pattern
    if remediation.confidence > 0.9 and remediation.is_known_pattern:
        await auto_remediate(remediation)  # Restart pod, scale up, rollback
    else:
        await notify_oncall(severity, root_cause, remediation)
    
    return IncidentResponse(severity=severity, root_cause=root_cause, action=remediation)
```

### Deployment Risk Scoring
```python
def score_deployment_risk(pr: PullRequest) -> RiskScore:
    factors = {
        "files_changed": len(pr.changed_files),        # More files = more risk
        "lines_changed": pr.additions + pr.deletions,   # Larger changes = more risk
        "infra_changes": any("bicep" in f or "terraform" in f for f in pr.changed_files),
        "database_migration": any("migration" in f for f in pr.changed_files),
        "friday_deploy": datetime.now().weekday() == 4,  # Never deploy on Friday
        "new_contributor": pr.author.commit_count < 10,
        "missing_tests": pr.test_additions == 0 and pr.additions > 50,
    }
    score = sum(weights[k] * v for k, v in factors.items()) / sum(weights.values())
    return RiskScore(score=score, factors=factors, recommendation="proceed" if score < 0.6 else "review")
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Auto-remediate everything | Dangerous — may make it worse | Only auto-remediate known patterns with >0.9 confidence |
| No correlation window | Miss related alerts | Correlate alerts within 30-min window |
| Ignore recent deployments | "Nothing changed" when something did | Always check last 24h deployments |
| Alert on raw metrics | Too many false positives | Anomaly detection with baseline, not static thresholds |
| No runbook integration | LLM invents solutions | Ground remediation in documented runbooks |
| Risk score without context | Every PR gets same treatment | Factor in: files changed, infra, tests, author experience |
| No feedback loop | Model doesn't improve | Track: was auto-remediation successful? Was root cause correct? |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | Model for analysis, temperature=0 for deterministic |
| `config/guardrails.json` | Auto-remediation confidence threshold, risk score weights |
| `config/agents.json` | Correlation window, deployment check period, notification channels |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement incident pipeline, risk scoring, auto-remediation |
| `@reviewer` | Audit auto-remediation safety, alert coverage, risk factors |
| `@tuner` | Optimize correlation window, risk weights, false positive rate |

## Slash Commands
`/deploy` — Deploy AIOps pipeline | `/test` — Simulate incidents | `/review` — Audit safety | `/evaluate` — Measure MTTR + accuracy
