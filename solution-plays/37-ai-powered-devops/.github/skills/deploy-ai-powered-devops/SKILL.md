---
name: deploy-ai-powered-devops
description: "Deploy AI-Powered DevOps — configure AI incident pipeline, deployment risk scoring, auto-remediation runbooks, alert correlation, change impact analysis. Use when: deploy, provision AIOps."
---

# Deploy AI-Powered DevOps

## When to Use
- Deploy AI-enhanced incident management pipeline
- Configure deployment risk scoring (pre-deploy assessment)
- Set up auto-remediation with LLM-generated runbooks
- Enable alert correlation (group related alerts into incidents)
- Implement change impact analysis for pull requests

## How Play 37 Differs from Related Plays
| Aspect | Play 17 (Observability) | Play 20 (Anomaly) | Play 37 (DevOps) |
|--------|----------------------|-------------------|------------------|
| Focus | Monitoring + dashboards | Detection | Response + prevention |
| Output | Metrics, alerts | Anomaly flags | Remediation actions |
| When | Passive observation | When abnormal | When deploying/incident |
| Actions | None (informational) | Alert only | Auto-remediate + risk score |

## Prerequisites
1. Azure Monitor / Log Analytics with existing alert rules
2. Azure DevOps or GitHub Actions for CI/CD pipelines
3. Azure OpenAI (gpt-4o for incident analysis + risk scoring)
4. PagerDuty/Teams for notification integration

## Step 1: Deploy Infrastructure
```bash
az bicep lint -f infra/main.bicep
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
```

## Step 2: Configure Incident Pipeline
```
Alert Fired → Alert Correlation (group related) → Severity Assessment
    → Root Cause Analysis (LLM) → Remediation Suggestion → Auto-Execute or Human Approval
    → Post-Incident Report Generation
```

## Step 3: Configure Deployment Risk Scoring
| Risk Factor | Weight | What It Checks |
|------------|--------|---------------|
| Change size | 0.25 | Lines changed, files touched |
| Blast radius | 0.30 | Services affected, user impact |
| Time of day | 0.10 | Deploy during peak = higher risk |
| Author experience | 0.10 | New contributor = higher risk |
| Test coverage delta | 0.15 | Coverage decrease = higher risk |
| Dependency changes | 0.10 | Package updates = moderate risk |

**Risk gate**: Score > 7 → require manual approval. Score > 9 → block deploy.

## Step 4: Configure Auto-Remediation
| Incident Type | Auto-Fix | Confidence Required |
|--------------|---------|-------------------|
| High CPU (>90%) | Scale up replicas | 0.95 (safe) |
| OOM crash | Increase memory limit | 0.90 |
| Certificate expiry | Renew via Key Vault | 0.99 (scripted) |
| Disk full | Archive old logs | 0.85 |
| Unhealthy pod | Restart pod | 0.95 (safe) |
| Database connection pool exhausted | Increase pool size | 0.80 |

**Safety rule**: Never auto-remediate if blast radius > 1 service. Always require human for data-touching fixes.

## Step 5: Configure Alert Correlation
- Group alerts by: service, time window (5 min), dependency chain
- Single incident from 50+ correlated alerts → reduces noise 90%
- LLM provides natural language incident summary

## Step 6: Post-Deployment Verification
- [ ] Alert correlation grouping related alerts correctly
- [ ] LLM root cause analysis producing actionable suggestions
- [ ] Deployment risk score calculating before each deploy
- [ ] Auto-remediation executing safe fixes (restart, scale)
- [ ] Human approval required for risky remediations
- [ ] Post-incident report generated automatically
- [ ] Notification channels (Teams/PagerDuty) receiving alerts

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Alerts not correlating | Time window too narrow | Increase from 2 min to 5 min |
| Risk score always high | Weights miscalibrated | Adjust weights based on historical deploys |
| Auto-fix makes things worse | Confidence threshold too low | Raise from 0.7 to 0.9 |
| LLM root cause wrong | Missing context | Add more telemetry data to prompt |
| Post-incident report generic | Template too vague | Include timeline + metrics + root cause |
| Deploy blocked incorrectly | Risk factor too aggressive | Review test coverage weight |

## Integration Architecture
```
Azure Monitor (alerts) → Alert Correlation Engine → Grouped Incident
    → LLM Root Cause Analysis (gpt-4o) → Remediation Suggestion
    → Confidence > threshold? → Auto-Execute : Human Approval
    → Post-Incident Report Generation

CI/CD Pipeline (PR/Deploy) → Risk Scoring Engine
    → Score > 7? Block + Require Approval
    → Score > 9? Block Entirely
```

## Security Considerations
- Auto-remediation MUST NOT touch data (databases, storage)
- All auto-actions logged with before/after state
- Blast radius check: if fix affects >1 service, require human
- Rollback capability for every auto-fix action
- Rate limit auto-remediation: max 5 per hour per service
