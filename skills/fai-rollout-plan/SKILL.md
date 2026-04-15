---
name: fai-rollout-plan
description: |
  Create deployment rollout plans with staged promotion, health checks, rollback
  triggers, and communication templates. Use when deploying changes to production
  with risk-managed incremental rollout.
---

# Rollout Plan

Plan staged deployments with health checks, rollback triggers, and communication.

## When to Use

- Deploying major changes to production
- Setting up canary or blue-green deployments
- Creating rollback runbooks
- Communicating deployment status to stakeholders

---

## Rollout Plan Template

```markdown
# Rollout Plan — [Feature/Release]

## Overview
- **Release:** v2.1.0
- **Owner:** [name]
- **Date:** YYYY-MM-DD
- **Risk:** Low / Medium / High

## Pre-Deployment
- [ ] All CI checks pass on release branch
- [ ] Staging smoke tests pass
- [ ] Rollback procedure tested
- [ ] Monitoring dashboards open
- [ ] On-call engineer notified

## Deployment Stages

### Stage 1: Canary (5% traffic)
- **Duration:** 30 minutes
- **Health checks:**
  - [ ] Error rate < 0.1%
  - [ ] P95 latency < 2s
  - [ ] No new exception types
- **Go/No-Go:** If all checks pass → proceed to Stage 2

### Stage 2: Partial (25% traffic)
- **Duration:** 2 hours
- **Health checks:** Same as Stage 1
- **Go/No-Go:** If all checks pass → proceed to Stage 3

### Stage 3: Full (100% traffic)
- **Duration:** Monitor for 24 hours
- **Health checks:** Same + business KPIs stable

## Rollback Triggers
- Error rate > 1% sustained for 5 minutes
- P95 latency > 5s
- Any P1 incident attributed to release
- Rollback command: `az webapp deployment slot swap --slot staging`

## Communication
| When | To | Channel | Message |
|------|-----|---------|---------|
| Start | Engineering | Slack #deploy | "Starting v2.1.0 rollout" |
| Stage 2 | Engineering | Slack #deploy | "25% traffic, metrics healthy" |
| Complete | All stakeholders | Email | "v2.1.0 deployed successfully" |
| Rollback | All stakeholders | Slack + Email | "Rolling back v2.1.0 — [reason]" |
```

## Post-Deployment

```markdown
- [ ] Remove feature flags no longer needed
- [ ] Update documentation
- [ ] Close related issues/PRs
- [ ] Update changelog
- [ ] Post-deployment review (lessons learned)
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Canary shows elevated errors | Bug in new code | Rollback immediately, debug in staging |
| Rollback takes too long | No pre-staged rollback | Keep previous version deployed in staging slot |
| No one monitoring | No ownership | Assign on-call for deployment window |
| Stakeholders surprised | No communication plan | Send start/progress/complete notifications |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Start simple, add complexity when needed | Avoid over-engineering |
| Automate repetitive tasks | Consistency and speed |
| Document decisions and tradeoffs | Future reference for the team |
| Validate with real data | Don't rely on synthetic tests alone |
| Review with peers | Fresh eyes catch blind spots |
| Iterate based on feedback | First version is never perfect |

## Quality Checklist

- [ ] Requirements clearly defined
- [ ] Implementation follows project conventions
- [ ] Tests cover happy path and error paths
- [ ] Documentation updated
- [ ] Peer reviewed
- [ ] Validated in staging environment

## Related Skills

- `fai-implementation-plan-generator` — Planning and milestones
- `fai-review-and-refactor` — Code review patterns
- `fai-quality-playbook` — Engineering quality standards
