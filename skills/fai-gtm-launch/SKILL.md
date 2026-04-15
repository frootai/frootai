---
name: fai-gtm-launch
description: |
  Execute product launches with coordinated messaging, channel orchestration,
  launch checklist, and post-launch diagnostics. Use when shipping new features,
  releases, or major product updates.
---

# Product Launch Execution

Coordinate launches with messaging, channels, checklists, and diagnostics.

## When to Use

- Shipping a major product release or new feature
- Coordinating cross-team launch activities
- Creating launch checklists and runbooks
- Running post-launch diagnostics and retrospectives

---

## Launch Checklist

```markdown
## Launch Checklist — [Feature/Version]

### Pre-Launch (T-7 days)
- [ ] Release branch cut and tested
- [ ] Changelog and release notes drafted
- [ ] Blog post / announcement written
- [ ] Demo video recorded
- [ ] Documentation updated
- [ ] Social media posts scheduled
- [ ] Email campaign prepared
- [ ] Partner notifications sent

### Launch Day (T-0)
- [ ] Deploy to production
- [ ] Smoke tests pass
- [ ] Monitoring dashboards active
- [ ] Publish blog post
- [ ] Send email announcement
- [ ] Post on social channels
- [ ] Update website
- [ ] Notify community (Discord/Discussions)

### Post-Launch (T+1 to T+7)
- [ ] Monitor error rates and latency
- [ ] Track adoption metrics (installs, API calls)
- [ ] Collect user feedback
- [ ] Triage incoming issues
- [ ] Post retrospective summary
```

## Channel Orchestration

| Channel | Content | Owner | Timing |
|---------|---------|-------|--------|
| Blog | Feature deep-dive | Marketing | T-0 |
| Twitter/X | Thread + demo GIF | DevRel | T-0 |
| Email | Customer announcement | Marketing | T-0 |
| Discord | Community highlight | Community | T-0 |
| GitHub | Release + changelog | Engineering | T-0 |
| VS Code Marketplace | Extension update | Engineering | T-0 |
| npm | Package publish | Engineering | T-0 |

## Post-Launch Diagnostics

```python
def launch_health(metrics_before: dict, metrics_after: dict) -> dict:
    return {
        "adoption_delta": metrics_after["active_users"] - metrics_before["active_users"],
        "error_rate_change": metrics_after["error_rate"] - metrics_before["error_rate"],
        "latency_change_ms": metrics_after["p95_ms"] - metrics_before["p95_ms"],
        "healthy": (metrics_after["error_rate"] < 0.02 and
                    metrics_after["p95_ms"] < 3000),
    }
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Low awareness of launch | No distribution plan | Use channel orchestration table |
| Bugs flood after launch | Insufficient testing | Add more smoke tests, do staged rollout |
| Team confusion on launch day | No checklist | Use launch checklist with owners |
| Can't measure impact | No baseline metrics | Capture metrics 24h before launch |

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
