---
name: fai-deploy-18-prompt-management
description: 'Executes production deployment workflow for Solution Play 18 Prompt Management.'
---

# FAI Skill: Deploy 18 Prompt Management

## Purpose

This skill provides a production-oriented workflow for Prompt version promotion, evaluation gates, and change safety. It enforces explicit phase evidence, clear release gates, and repeatable handoff quality.

## Inputs

| Input | Description |
|---|---|
| Core parameters | prompt_registry, eval_suite, release_tags, rollback_revision |
| Environment | dev, staging, prod |
| Constraints | security, reliability, cost, latency, and compliance requirements |

## Prerequisites

- CI pipeline is green and artifacts are versioned.
- Ownership and approval chain are identified.
- Secrets/config are externally managed and environment-scoped.
- Monitoring and rollback procedures are prepared.

## Full Phases Coverage

### Phase 1: Discover

- Confirm objectives, risks, and affected systems.
- Inventory dependencies and interface contracts.
- Define measurable release success criteria.

### Phase 2: Design

- Choose architecture and deployment boundaries.
- Define controls for security, resilience, and privacy.
- Document tradeoffs and fallback behavior.

### Phase 3: Implement

- Deliver incremental, reviewable changes.
- Keep config explicit and source-controlled.
- Avoid hidden coupling and unversioned runtime assumptions.

### Phase 4: Validate

- Run lint, test, integration, and scenario gates.
- Verify logs, traces, and alerts before production rollout.
- Capture approval evidence and known risks.

### Phase 5: Deploy

- Use staged deployment with hold points.
- Validate KPI and health checks between stages.
- Stop and rollback when gates fail.

### Phase 6: Operate

- Monitor post-release drift against baseline.
- Triage incidents with defined owner/SLA.
- Run post-release review and track improvements.

## WAF Quality Gates

### Reliability

- Retry, timeout, and circuit-breaker behaviors are defined.
- Health checks validate downstream dependencies.
- Graceful degradation is tested in staging.

### Security

- Least-privilege access is enforced.
- Sensitive data is protected in transit and at rest.
- AI inputs/outputs are validated where applicable.

### Cost Optimization

- Sizing and routing decisions are evidence-based.
- Budget alerts and anomaly checks are configured.
- Non-critical workloads are rate-limited or scheduled.

### Operational Excellence

- CI/CD is the only production path.
- Runbooks and rollback instructions are current.
- Observability includes correlation identifiers.

### Performance Efficiency

- SLO targets are defined and measurable.
- Hot paths are benchmarked and tuned.
- Payload/query costs are tracked over time.

### Responsible AI

- Safety controls and escalation are active.
- Grounding and evaluation policies are enforced.
- Human override exists for high-impact decisions.

## Deliverables

| Artifact | Purpose |
|---|---|
| Primary output | deploy-checklist-18.md, prompt promotion record, eval evidence |
| Validation dossier | Evidence for release decision |
| Rollback guide | Exact reversal steps and ownership |
| Operate handoff | Monitoring and incident procedures |

## Completion Checklist

- [ ] Phase 1 evidence captured.
- [ ] Phase 2 design reviewed.
- [ ] Phase 3 implementation approved.
- [ ] Phase 4 validation passed.
- [ ] Phase 5 staged deployment completed.
- [ ] Phase 6 operations handoff accepted.
- [ ] Completion criteria met: evaluation thresholds met, version lineage clear, rollback prompt pinned.

## Troubleshooting

### Symptom: Behavior diverges between staging and production

- Compare environment config, data shape, and feature flags.
- Validate runtime and dependency version parity.
- Re-run representative production scenarios in pre-prod.

### Symptom: Cost or latency regression post-release

- Review retries, cache hit rates, and scaling thresholds.
- Identify expensive calls and adjust routing tiers.
- Rebalance limits to protect SLO and budget.

### Symptom: Excessive alert volume

- Separate informational from paging alerts.
- Add dimensions for service, tenant, and scenario.
- Rebaseline thresholds with observed traffic.

## Example Commands

```bash
# Adapt to repository standards
npm run lint
npm test
npm run build
```

## Definition of Done

The workflow is complete when all six phases have objective evidence, release risk is controlled, and the process is reproducible by another engineer.

## Metadata

- Category: Deployment
- Maintainer: FAI Skill System
- Review cadence: Quarterly and after major architecture changes
