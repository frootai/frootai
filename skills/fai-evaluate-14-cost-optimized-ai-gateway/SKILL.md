---
name: fai-evaluate-14-cost-optimized-ai-gateway
description: 'Evaluates Solution Play 14 Cost-Optimized AI Gateway for routing accuracy, budget adherence, and latency balance.'
---

# FAI Skill: Evaluate 14 Cost Optimized Ai Gateway

## Purpose

This skill defines a production-grade workflow for Cost-aware routing quality and performance tradeoff validation. It enforces full phase coverage, strict quality gates, and reproducible delivery evidence.

## Inputs

| Input | Description |
|---|---|
| Core parameters | routing_logs, budget_limits, latency_targets, model_tiers |
| Environment | dev, staging, prod |
| Constraints | security, reliability, latency, cost, and governance requirements |

## Prerequisites

- Scope, acceptance criteria, and owners are confirmed.
- Required datasets/configs are versioned and accessible.
- Baseline metrics are captured for comparison.
- Rollback and mitigation strategy is defined.

## Full Phases Coverage

### Phase 1: Discover

- Define outcomes, constraints, and risk boundaries.
- Identify dependency map and unknowns.
- Lock measurable pass/fail thresholds.

### Phase 2: Design

- Choose approach with tradeoff rationale.
- Define reliability, security, and observability controls.
- Specify fallback and escalation behavior.

### Phase 3: Implement

- Apply small, reviewable changes.
- Keep prompts/config/contracts explicit and versioned.
- Prevent hidden coupling and side effects.

### Phase 4: Validate

- Run functional, edge-case, and regression checks.
- Verify telemetry, logs, and traceability outputs.
- Record findings and remediation actions.

### Phase 5: Deploy

- Promote through staged gates.
- Verify health/KPI checkpoints at each step.
- Stop and rollback when thresholds fail.

### Phase 6: Operate

- Monitor drift, incidents, and trend signals.
- Route issues with owner/SLA clarity.
- Feed lessons into next iteration.

## WAF-Aligned Quality Gates

### Reliability

- Retry, timeout, and fallback behaviors are tested.
- Health checks include dependency state.
- Degraded mode remains usable.

### Security

- Secrets are externalized and least privilege is enforced.
- Logging avoids sensitive data exposure.
- Audit evidence exists for critical actions.

### Cost Optimization

- Resource/model usage is right-sized.
- High-cost paths are measured and optimized.
- Budget thresholds and anomalies are monitored.

### Operational Excellence

- CI/CD and repeatable validation are mandatory.
- Runbooks and rollback steps are current.
- Metrics and traces support fast triage.

### Performance Efficiency

- SLO targets are explicit and monitored.
- Hot paths are benchmarked and tuned.
- Compute and payload overhead are controlled.

### Responsible AI

- Safety and grounding checks are enforced where AI applies.
- User-facing outputs remain transparent.
- Human escalation is available for high-impact failures.

## Deliverables

| Artifact | Purpose |
|---|---|
| Primary output | evaluate-14-report.md, routing efficiency metrics, cost variance analysis |
| Validation dossier | Evidence for release/readiness decisions |
| Rollback guide | Reversal and mitigation steps |
| Operate handoff | Monitoring and ownership instructions |

## Completion Checklist

- [ ] Phase 1 discovery complete.
- [ ] Phase 2 design approved.
- [ ] Phase 3 implementation reviewed.
- [ ] Phase 4 validation passed.
- [ ] Phase 5 staged rollout completed.
- [ ] Phase 6 operate handoff accepted.
- [ ] Completion criteria met: budget adherence maintained, routing decisions correct, latency within acceptable band.

## Troubleshooting

### Symptom: Quality metrics regress unexpectedly

- Compare dataset/config/prompt version deltas.
- Recalibrate thresholds for changed traffic patterns.
- Re-run with controlled baseline data.

### Symptom: Latency or cost spikes during evaluation

- Analyze retry storms and cache effectiveness.
- Tune concurrency, batching, and model routing.
- Rebalance limits for workload class.

### Symptom: Environment-to-environment variance

- Validate parity in dependencies and feature flags.
- Confirm endpoint routing and region alignment.
- Execute smoke checks before promotion.

## Example Commands

```bash
# Adapt to repository standards
npm run lint
npm test
npm run build
```

## Definition of Done

This skill is complete when all six phases have objective evidence, quality gates pass, and another engineer can reproduce outcomes without tribal knowledge.

## Metadata

- Category: Evaluation
- Maintainer: FAI Skill System
- Review cadence: Quarterly and after major platform changes
