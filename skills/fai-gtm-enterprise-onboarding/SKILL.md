---
name: fai-gtm-enterprise-onboarding
description: |
  Design enterprise customer onboarding journeys with time-to-value optimization,
  success milestones, and expansion readiness. Use when onboarding enterprise
  customers to an AI platform.
---

# Enterprise Onboarding

Design onboarding journeys that reduce time-to-value and drive expansion.

## When to Use

- Onboarding new enterprise customers to AI platform
- Reducing time from contract signing to first deployment
- Defining success milestones and health scores
- Preparing accounts for upsell/expansion

---

## Onboarding Journey

| Week | Milestone | Owner | Deliverable |
|------|-----------|-------|-------------|
| 0 | Kickoff call | CSM | Scope doc, success criteria |
| 1 | Environment provisioned | Platform | Landing zone + credentials |
| 2 | First play deployed (dev) | Customer + SE | Working dev environment |
| 3 | Data integration complete | Customer | Connected to data sources |
| 4 | Production deployment | Customer + SE | Live with real users |
| 6 | Health check review | CSM | Usage metrics, satisfaction |
| 8 | Expansion planning | CSM + Sales | Next play identification |

## Customer Health Score

```python
def calculate_health(usage: dict) -> dict:
    score = 0
    score += 25 if usage["active_users"] > 10 else 10 if usage["active_users"] > 0 else 0
    score += 25 if usage["queries_per_day"] > 50 else 10 if usage["queries_per_day"] > 0 else 0
    score += 25 if usage["plays_deployed"] >= 2 else 10 if usage["plays_deployed"] >= 1 else 0
    score += 25 if usage["nps_score"] >= 8 else 10 if usage["nps_score"] >= 6 else 0
    status = "healthy" if score >= 75 else "at-risk" if score >= 40 else "critical"
    return {"score": score, "status": status}
```

## Success Criteria Template

```markdown
## Success Criteria — [Customer Name]

### Business Outcomes
- [ ] Reduce ticket resolution time by 30%
- [ ] Automate 50% of L1 support queries
- [ ] Achieve 85%+ user satisfaction score

### Technical Milestones
- [ ] Landing zone provisioned (Week 1)
- [ ] First play deployed to dev (Week 2)
- [ ] Production deployment (Week 4)
- [ ] 100+ queries/day sustained (Week 6)
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Slow onboarding | Complex enterprise security | Pre-build landing zone templates |
| Low adoption after deploy | No champion inside customer | Identify and enable internal champion |
| Time-to-value > 8 weeks | Scope too broad | Start with single high-impact play |
| Expansion stalled | No success metrics shared | Send monthly success reports |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Measure everything | Can't improve what you can't measure |
| Weekly review cadence | Catch issues before they compound |
| Customer interviews monthly | Stay connected to real problems |
| Competitor watch quarterly | Know the landscape, don't obsess |
| Content before campaigns | Educate first, sell second |
| Single owner per metric | Accountability drives results |

## Key Metrics

| Stage | Metric | Target |
|-------|--------|--------|
| Awareness | Website visits | 10K/month |
| Interest | GitHub stars | 1000 |
| Activation | First play deployed | 200 |
| Retention | Monthly active | 50 |
| Revenue | MRR | Track growth rate |


## Related Skills

- `fai-gtm-ai-strategy` — Overall GTM strategy
- `fai-gtm-launch` — Launch execution
- `fai-gtm-developer-ecosystem` — Community growth
- `fai-gtm-operating-cadence` — Weekly rhythms
