---
name: fai-evaluate-03-deterministic-agent
description: 'Evaluates Solution Play 03 Deterministic Agent for repeatability, schema conformance, and stability.'
---

# FAI Skill: Evaluate 03 Deterministic Agent

## Purpose

This skill defines a production-grade workflow for Determinism verification and structured-output reliability. It uses full six-phase execution with explicit validation gates so outcomes remain reproducible and auditable.

## Inputs

| Input | Description |
|---|---|
| Core parameters | test_prompts, seed_config, schema_rules, stability_window |
| Environment | dev, staging, prod |
| Constraints | security, reliability, latency, cost, and governance limits |

## Prerequisites

- Scope and quality objectives are approved.
- Required datasets, configs, and dependencies are versioned.
- Ownership and approval responsibilities are assigned.
- Rollback/mitigation strategy exists for failed outcomes.

## Full Phases Coverage

### Phase 1: Discover

- Confirm goals, constraints, and critical user/system journeys.
- Identify dependencies, assumptions, and risk hotspots.
- Define measurable acceptance thresholds.

### Phase 2: Design

- Choose evaluation or implementation approach with tradeoff notes.
- Define control points for reliability, safety, and observability.
- Specify fallback behavior and escalation criteria.

### Phase 3: Implement

- Apply incremental changes with review checkpoints.
- Keep contracts, prompts, and configs explicit and versioned.
- Minimize hidden coupling and side effects.

### Phase 4: Validate

- Run quality, regression, and edge-case checks.
- Verify telemetry, traceability, and evidence capture.
- Record unresolved risks and remediation actions.

### Phase 5: Deploy

- Roll out through staged gates or controlled promotion.
- Validate KPIs and health checks at each stage.
- Stop rollout and rollback when thresholds fail.

### Phase 6: Operate

- Monitor drift and post-release behavior continuously.
- Route incidents via defined owner and SLA.
- Feed lessons back into next iteration cycle.

## WAF-Aligned Quality Gates

### Reliability

- Retry/timeout/fallback behavior is tested.
- Health and dependency checks are operational.
- Degraded-mode responses remain actionable.

### Security

- Secrets are externalized and access is least-privilege.
- Data exposure in logs and outputs is controlled.
- Audit trails exist for critical actions.

### Cost Optimization

- Resource/model usage is right-sized to workload.
- High-cost operations are measured and optimized.
- Budget thresholds and anomaly signals are configured.

### Operational Excellence

- CI/CD and repeatable run steps are mandatory.
- Runbooks and rollback instructions are current.
- Metrics and traces support incident triage.

### Performance Efficiency

- SLO targets are explicit and monitored.
- Hot paths are benchmarked and tuned.
- Payload and compute overhead are controlled.

### Responsible AI

- Safety, grounding, and fairness checks are applied where AI exists.
- User-facing outputs are transparent about AI involvement.
- Human escalation paths are available for high-impact outcomes.

## Deliverables

| Artifact | Purpose |
|---|---|
| Primary output | evaluate-03-report.md, determinism scorecard, conformance log |
| Validation dossier | Evidence for readiness decisions |
| Rollback guide | Mitigation and reversal actions |
| Operate handoff | Monitoring and ownership instructions |

## Completion Checklist

- [ ] Phase 1 discovery evidence captured.
- [ ] Phase 2 design decisions documented.
- [ ] Phase 3 implementation reviewed.
- [ ] Phase 4 validation passed.
- [ ] Phase 5 staged rollout completed.
- [ ] Phase 6 operate handoff accepted.
- [ ] Completion criteria met: repeatability gate met, schema violations eliminated, run variance bounded.

## Troubleshooting

### Symptom: Score quality regresses after updates

- Compare data/prompt/config version deltas.
- Validate threshold calibration and scenario coverage.
- Re-run with fixed baselines for controlled comparison.

### Symptom: Cost or latency spikes during runs

- Inspect hot paths, retries, and caching effectiveness.
- Right-size model/resource choices for workload class.
- Tune timeouts, concurrency, and batching policies.

### Symptom: Inconsistent outcomes between environments

- Verify environment parity for dependencies and flags.
- Check data residency and endpoint routing differences.
- Execute representative smoke suites pre-release.

## Example Commands

```bash
# Adapt to repository conventions
npm run lint
npm test
npm run build
```

## Definition of Done

The skill is complete when all six phases are evidenced, quality gates are met, and another engineer can reproduce the workflow without tribal knowledge.

## Metadata

- Category: Evaluation
- Maintainer: FAI Skill System
- Review cadence: Quarterly and after major platform changes
