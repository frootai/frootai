---
name: fai-azure-architecture-review
description: Conduct Azure Well-Architected Framework reviews with scored pillar assessments, tiered finding severity, remediation priority tables, and an executive scorecard — turning ad-hoc architecture debates into structured, trackable decisions.
---

# FAI Azure Architecture Review

Delivers a structured Well-Architected Framework review that produces scored pillar assessments, severity-tiered findings, actionable remediation tasks, and an executive scorecard. Transforms informal architecture discussions into documented, trackable commitments with clear owners and timelines.

## When to Invoke

| Signal | Example |
|--------|---------|
| Pre-launch production readiness check | "Is this architecture ready to go live?" |
| Post-incident investigation | Reliability failure traced to an architecture gap |
| Quarterly architecture governance | Scheduled review cadence |
| Before a significant change | Adding a new AI service to an existing platform |

## Workflow

### Step 1 — Collect Architecture Evidence

```bash
# Export deployed resources for review
az resource list --resource-group $RG_NAME \
  --query "[].{name:name, type:type, location:location}" \
  --output table > architecture-inventory.txt

# Check for exposed public endpoints
az network public-ip list --resource-group $RG_NAME \
  --query "[].{name:name, ip:ipAddress}" --output table

# Check diagnostic settings coverage
az monitor diagnostic-settings list \
  --resource "/subscriptions/$SUB_ID/resourceGroups/$RG_NAME" \
  --output table

# Check for API keys vs Managed Identity
az resource list --resource-group $RG_NAME \
  --resource-type "Microsoft.CognitiveServices/accounts" \
  --query "[].{name:name, disableLocalAuth:properties.disableLocalAuth}" \
  --output table
```

### Step 2 — Pillar Assessment Worksheets

Score each finding area 1-5 (1=critical gap, 5=exemplary).

#### Reliability

| Finding Area | Score (1-5) | Evidence | Finding |
|-------------|------------|---------|---------|
| Retry policies on external calls | __ | HTTP client code | No exponential backoff on OpenAI calls |
| Circuit breaker | __ | Code review | No circuit breaker -- single timeout |
| Health check endpoints | __ | Endpoints list | Missing /health/ready probe |
| Multi-region failover | __ | Bicep deployment | Single region, no failover configured |
| Backup and restore tested | __ | Runbooks | No recovery drill in past 90 days |

#### Security

| Finding Area | Score (1-5) | Evidence | Finding |
|-------------|------------|---------|---------|
| Managed Identity (no keys) | __ | App config | API key in Key Vault -- use MSI instead |
| Private endpoints | __ | Network audit | AI Search has a public endpoint |
| RBAC least privilege | __ | IAM review | Dev team has Owner role on prod RG |
| Content safety filters | __ | AOAI config | Default filter -- no custom categories |
| Secret rotation policy | __ | Key Vault | Secrets have no expiry configured |

#### Cost Optimization

| Finding Area | Score (1-5) | Evidence | Finding |
|-------------|------------|---------|---------|
| Model right-sizing | __ | Cost metrics | gpt-4o used for classification (use mini) |
| Semantic cache | __ | Redis / logs | No cache -- 0% hit rate |
| PTU vs PAYG analysis | __ | Billing | PTU at 45% utilization -- overspend |
| Dev/test resource cleanup | __ | Billing | Dev VMs running 24/7 |

#### Performance Efficiency

| Finding Area | Score (1-5) | Evidence | Finding |
|-------------|------------|---------|---------|
| P99 latency budget met | __ | App Insights | P99 = 8s vs 3s budget |
| Streaming enabled | __ | API code | stream=false -- user waits for full response |
| Embedding batch processing | __ | Worker code | Embedding one-by-one (100ms each) |
| Auto-scaling configured | __ | VMSS/ACA rules | Min=Max (no scale-out possible) |

#### Operational Excellence

| Finding Area | Score (1-5) | Evidence | Finding |
|-------------|------------|---------|---------|
| IaC for all resources | __ | Bicep/Terraform | 3 resources created manually |
| CI/CD deployment pipeline | __ | GitHub Actions | Manual deployment process |
| Structured logs and traces | __ | App Insights | console.log() only -- no request IDs |
| Incident runbook | __ | Wiki/docs | No incident runbook exists |

#### Responsible AI

| Finding Area | Score (1-5) | Evidence | Finding |
|-------------|------------|---------|---------|
| Content safety configured | __ | AOAI portal | Default settings -- no custom categories |
| Groundedness measurement | __ | Eval pipeline | No groundedness evaluation in CI |
| Bias and fairness testing | __ | Test suite | No fairness test set |
| Human oversight for high-risk | __ | Design docs | Fully automated -- no human-in-the-loop |

### Step 3 — Finding Severity Classification

```python
def classify_severity(score: int, pillar: str) -> str:
    """Score 1-2 in security/reliability = Critical; 1-2 elsewhere = High; 3 = Medium; 4-5 = Low."""
    critical_pillars = {"security", "reliability"}
    if score <= 2 and pillar in critical_pillars:
        return "CRITICAL"
    elif score <= 2:
        return "HIGH"
    elif score == 3:
        return "MEDIUM"
    else:
        return "LOW"
```

### Step 4 — Remediation Priority Table

| Priority | Finding | Pillar | Effort | Owner | Target |
|----------|---------|--------|--------|-------|--------|
| CRITICAL | API key in config -- migrate to Managed Identity | Security | 1 day | App team | Week 1 |
| CRITICAL | No retry on OpenAI calls -- add Polly policy | Reliability | 0.5 day | App team | Week 1 |
| HIGH | AI Search public endpoint -- add private endpoint | Security | 2 days | Platform | Week 2 |
| HIGH | PTU at 45% -- reduce tier or switch to PAYG | Cost | 1 day | FinOps | Week 2 |
| MEDIUM | P99 latency 8s -- enable streaming responses | Performance | 1 day | App team | Week 3 |
| MEDIUM | No CI/CD -- create GitHub Actions pipeline | OpEx | 3 days | DevOps | Week 3 |
| LOW | No semantic cache -- add Redis cache layer | Cost | 2 days | App team | Week 4 |

### Step 5 — Executive Scorecard

```markdown
## Architecture Review Scorecard -- {Date}

| Pillar | Score /5 | Trend | Top Finding |
|--------|----------|-------|-------------|
| Reliability | 2.8 | down | No retry policies on AI calls |
| Security | 2.4 | flat | API key in application config |
| Cost Optimization | 2.6 | flat | PTU underutilized at 45% |
| Performance Efficiency | 3.0 | up | P99 latency 8s vs 3s budget |
| Operational Excellence | 2.8 | flat | 3 resources created manually |
| Responsible AI | 2.6 | flat | No groundedness evaluation |

**Overall Score: 2.7/5 -- NEEDS IMPROVEMENT**
**Critical: 2 | High: 3 | Medium: 5 | Low: 4**
**Review Cadence: Monthly until all pillars score >= 4.0**
```

## Review Checklist

```bash
# Before the review session
az resource list --resource-group $RG_NAME --output table     # Inventory
az advisor recommendations list --output table                 # Azure Advisor findings
az security assessment list --output table                     # Defender for Cloud

# After the review -- commit the scorecard
git add docs/architecture-review-$(date +%Y-%m-%d).md
git commit -m "docs: architecture review scorecard $(date +%Y-%m)"
```

## WAF Alignment

| Pillar | Contribution |
|--------|-------------|
| Operational Excellence | Quarterly review cadence prevents architecture rot; findings create a traceable audit trail |
| Reliability | Systematic scoring catches retry and circuit-breaker gaps before they cause production incidents |
| Security | Critical severity tier on security findings ensures remediation within one week |

## Compatible Solution Plays

- **All plays** — applicable as a cross-cutting governance practice
- **Play 02** — AI Landing Zone (infrastructure review)
- **Play 17** — AI Observability (operational excellence pillar evidence)

## Notes

- Score findings against evidence -- not against intent or the team's roadmap
- CRITICAL findings must have a target date <= 1 week; escalate to engineering leadership if blocked
- Repeat the review after each CRITICAL finding is remediated; do not wait for the full monthly cadence
- Use Azure Advisor and Defender for Cloud findings as objective evidence for scoring
