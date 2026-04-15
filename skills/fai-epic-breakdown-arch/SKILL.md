---
name: fai-epic-breakdown-arch
description: 'Breaks architecture initiatives into actionable epics with dependencies, risk, and sequencing.'
---

# FAI Skill: Epic Breakdown Arch

## Purpose

This skill defines a production-grade workflow for Architecture-to-delivery decomposition and execution sequencing. It applies full phase execution, explicit quality gates, and clear delivery evidence so outcomes remain repeatable.

## Inputs

| Input | Description |
|---|---|
| Core parameters | architecture_goals, capability_map, dependencies, delivery_constraints |
| Environment | design, dev, staging, production |
| Constraints | security, reliability, latency, cost, and governance requirements |

## Prerequisites

- Scope and success criteria are approved by owners.
- Dependencies and affected systems are documented.
- Validation and observability approaches are prepared.
- Rollback or mitigation strategy is ready for high-risk changes.

## Full Phases Coverage

### Phase 1: Discover

- Clarify outcomes, constraints, and affected user/system journeys.
- Identify risks, unknowns, and dependencies early.
- Define measurable acceptance and release criteria.

### Phase 2: Design

- Produce architecture/pattern options with tradeoff analysis.
- Select an approach balancing quality, speed, and maintainability.
- Encode accessibility, security, and compliance expectations.

### Phase 3: Implement

- Ship incrementally with focused, reviewable changes.
- Keep interfaces, contracts, and config explicit.
- Minimize hidden coupling and side effects.

### Phase 4: Validate

- Run functional, edge-case, and regression validation.
- Verify observability signals and operational readiness.
- Capture evidence and unresolved risk notes.

### Phase 5: Deploy

- Roll out through controlled stages with stop conditions.
- Confirm health/KPI checkpoints before progression.
- Trigger rollback immediately when gates fail.

### Phase 6: Operate

- Monitor live behavior and drift against baseline.
- Resolve incidents with owner and SLA clarity.
- Feed lessons learned into next iteration.

## WAF-Aligned Quality Gates

### Reliability

- Core flows behave consistently under transient failures.
- Health and fallback paths are documented and tested.
- Error/empty/degraded states remain actionable.

### Security

- Secrets are externalized and access is least-privilege.
- Input and output handling avoids unsafe data exposure.
- Auditability exists for critical operations.

### Cost Optimization

- Resource and model choices are right-sized to need.
- High-cost paths are measured and optimized.
- Budget thresholds and anomaly alerts are defined.

### Operational Excellence

- CI/CD and validation gates are mandatory.
- Runbooks and rollback instructions are versioned.
- Telemetry supports troubleshooting and continuous improvement.

### Performance Efficiency

- SLO targets are explicit and monitored.
- Hot paths are benchmarked and tuned.
- Payload, rendering, or compute footprints are controlled.

### Responsible AI

- Safety and grounding checks are applied where AI exists.
- User-facing AI outputs include transparency cues.
- Human escalation exists for high-impact outcomes.

## Deliverables

| Artifact | Purpose |
|---|---|
| Primary output | epic-breakdown-plan.md, dependency graph, execution roadmap |
| Validation dossier | Release-readiness evidence |
| Rollback guide | Mitigation and reversal actions |
| Operate handoff | Monitoring and ownership notes |

## Completion Checklist

- [ ] Phase 1 discovery complete.
- [ ] Phase 2 design approved.
- [ ] Phase 3 implementation reviewed.
- [ ] Phase 4 validation passed.
- [ ] Phase 5 staged deployment completed.
- [ ] Phase 6 operate handoff acknowledged.
- [ ] Completion criteria met: epics are actionable, dependency risks explicit, sequencing supports incremental value.

## Troubleshooting

### Symptom: Outcomes are inconsistent across environments

- Compare config, dependencies, and feature-flag parity.
- Validate data shape and traffic assumptions.
- Reproduce using representative scenarios.

### Symptom: Performance or cost regresses after rollout

- Profile hot paths and retry/caching behavior.
- Rebalance routing, limits, and expensive operations.
- Verify autoscaling and batching thresholds.

### Symptom: Users fail to recover from failures

- Improve clarity of recovery actions and messaging.
- Add contextual diagnostics for support triage.
- Validate escalation pathways end to end.

## Example Commands

```bash
# Adapt to repository standards
npm run lint
npm test
npm run build
```

## Definition of Done

The skill is complete when all six phases are evidenced, quality gates are met, and another engineer can reproduce results without tribal knowledge.

## Metadata

- Category: Planning
- Maintainer: FAI Skill System
- Review cadence: Quarterly and after major architecture changes
