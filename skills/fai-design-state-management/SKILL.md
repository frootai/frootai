---
name: fai-design-state-management
description: 'Designs UI state models for predictable behavior, traceability, and reduced complexity.'
---

# FAI Skill: Design State Management

## Purpose

This skill defines a production-quality workflow for State architecture, transition rules, and UX consistency under async events. It ensures consistent outcomes through phase-based execution, measurable quality gates, and reliable handoff artifacts.

## Inputs

| Input | Description |
|---|---|
| Core parameters | state_domains, transition_graphs, async_events, persistence_rules |
| Environment | design, dev, staging, production |
| Constraints | accessibility, reliability, performance, and compliance requirements |

## Prerequisites

- Scope, ownership, and acceptance criteria are approved.
- Relevant UX/content/data stakeholders are identified.
- Instrumentation and validation approach are planned.
- Rollback or mitigation strategy is defined for risky changes.

## Full Phases Coverage

### Phase 1: Discover

- Clarify goals, user segments, and primary success outcomes.
- Map constraints, dependencies, and potential failure conditions.
- Define measurable criteria that determine release readiness.

### Phase 2: Design

- Produce patterns and variants for happy path and edge cases.
- Document tradeoffs across usability, speed, and maintainability.
- Encode accessibility and clarity requirements from the start.

### Phase 3: Implement

- Apply changes incrementally with reviewable checkpoints.
- Keep component contracts, tokens, and rules explicit.
- Avoid hidden coupling and undocumented assumptions.

### Phase 4: Validate

- Run scenario checks for primary and edge interactions.
- Verify accessibility, responsiveness, and behavior consistency.
- Capture evidence, defects, and remediation status.

### Phase 5: Deploy

- Roll out in controlled stages or feature flags.
- Monitor critical UX and performance indicators.
- Pause or rollback if release gates fail.

### Phase 6: Operate

- Track real-world behavior and drift over time.
- Triage issues with owners and clear SLAs.
- Feed learnings back into the next design iteration.

## WAF-Aligned Quality Gates

### Reliability

- Interaction behavior remains deterministic across retries/navigation.
- Error and empty states are present and tested.
- Degraded behavior is defined for dependency failures.

### Security

- User input handling avoids unsafe rendering or leakage.
- Sensitive data is excluded from client logs/telemetry.
- Permission-sensitive views degrade safely.

### Cost Optimization

- Heavy UI operations are measured and right-sized.
- Expensive visual effects are scoped by need and device capability.
- Non-essential work is deferred or batched.

### Operational Excellence

- CI quality checks run for affected surfaces.
- Release notes and rollout/rollback steps are documented.
- Observability events support diagnosis and product decisions.

### Performance Efficiency

- Rendering budgets are defined for critical views.
- High-frequency interactions avoid unnecessary recalculation.
- Assets and payloads remain within agreed thresholds.

### Responsible AI

- AI-driven content is labeled and safety-checked where applicable.
- Explanations and confidence cues are included when needed.
- Human escalation is available for high-impact failures.

## Deliverables

| Artifact | Purpose |
|---|---|
| Primary output | state-model-spec.md, transition table, consistency checklist |
| Validation dossier | Test evidence and release-readiness notes |
| Rollback guide | Mitigation and reversal actions |
| Operate notes | Monitoring plan and ownership |

## Completion Checklist

- [ ] Phase 1 discovery artifacts completed.
- [ ] Phase 2 design decisions documented.
- [ ] Phase 3 implementation reviewed.
- [ ] Phase 4 validation evidence attached.
- [ ] Phase 5 rollout completed safely.
- [ ] Phase 6 operate handoff accepted.
- [ ] Completion criteria met: state transitions deterministic, race conditions mitigated, user-visible consistency preserved.

## Troubleshooting

### Symptom: Behavior differs by device or viewport

- Compare breakpoint rules, input methods, and density assumptions.
- Validate typography and spacing tokens in affected contexts.
- Re-run targeted scenarios on representative devices.

### Symptom: Performance regression after release

- Profile render paths and expensive state updates.
- Reduce unnecessary effects, reflows, and oversized assets.
- Verify caching/memoization behavior on critical paths.

### Symptom: Users fail to recover from errors

- Audit copy clarity and recovery action prominence.
- Add contextual guidance and escalation routes.
- Confirm errors include actionable next steps.

## Example Commands

```bash
# Adapt to repository standards
npm run lint
npm test
npm run build
```

## Definition of Done

This skill is complete when all six phases are evidenced, quality gates are met, and another engineer can reproduce the workflow without tribal knowledge.

## Metadata

- Category: Design
- Maintainer: FAI Skill System
- Review cadence: Quarterly and after major UX architecture updates
