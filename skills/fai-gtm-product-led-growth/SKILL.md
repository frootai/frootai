---
name: fai-gtm-product-led-growth
description: |
  Define product-led growth motions with activation loops, freemium conversion,
  expansion triggers, and retention mechanics. Use when designing self-serve
  adoption funnels for developer tools.
---

# Product-Led Growth

Design self-serve growth loops with activation, conversion, and expansion.

## When to Use

- Building self-serve adoption for developer tools
- Designing freemium → paid conversion funnels
- Creating viral loops and sharing mechanics
- Measuring and optimizing PLG metrics

---

## PLG Funnel

```
Discover → Sign Up → Activate → Engage → Convert → Expand → Advocate
  SEO       GitHub    First      Weekly    Paid      More     Share +
  Social    VS Code   Play       Usage     Tier      Plays    Contribute
  Content   npm       Deployed   Queries   Features  Users    Referral
```

## Activation Metrics

| Event | Definition | Target |
|-------|-----------|--------|
| Sign up | GitHub star or npm install | — |
| Activation | First play scaffolded | 50% of sign-ups in 7 days |
| Aha moment | First successful AI query via play | 30% of activated |
| Habit | 3+ sessions in first 14 days | 20% of activated |

## Conversion Triggers

```python
UPGRADE_SIGNALS = {
    "plays_deployed": {"threshold": 3, "message": "You've deployed 3 plays — unlock advanced features"},
    "team_members": {"threshold": 3, "message": "Your team is growing — add team management"},
    "monthly_queries": {"threshold": 1000, "message": "High usage — get priority support"},
}

def check_upgrade_triggers(usage: dict) -> list[str]:
    triggered = []
    for signal, config in UPGRADE_SIGNALS.items():
        if usage.get(signal, 0) >= config["threshold"]:
            triggered.append(config["message"])
    return triggered
```

## Viral Loops

| Loop | Mechanism | Metric |
|------|-----------|--------|
| Share your play | Public play URL with "Built with FrootAI" | Referral visits |
| Contributor path | Submit skill/plugin → visible in marketplace | Community PRs |
| Team invite | Workspace invite for shared plays | Seats per account |
| Badge/showcase | "FAI Certified" badge for profile | Badge displays |

## Retention Levers

| Lever | Implementation |
|-------|---------------|
| Weekly digest email | Usage stats + new plays matching their stack |
| In-product tips | Suggest next play based on current usage |
| Community highlights | Feature top contributors weekly |
| Release notifications | VS Code extension update notifications |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Low activation | Quickstart too complex | Reduce first play to <5 minutes |
| Activation but no habit | No ongoing value after first use | Add weekly use cases + notifications |
| Low conversion | Free tier too generous | Tighten limits, show premium value |
| No viral loop | No sharing mechanic | Add shareable play URLs with attribution |

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
