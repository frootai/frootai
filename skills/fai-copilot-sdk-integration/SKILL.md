---
name: fai-copilot-sdk-integration
description: 'Implements GitHub Copilot SDK integration patterns for custom agent capabilities.'
---

# FAI Skill: Copilot Sdk Integration

## Purpose

This skill defines a production-oriented workflow for SDK wiring, tool invocation, and safe execution. It is intended for builders and reviewers who need repeatable outcomes, explicit validation, and clear rollback guidance.

## When To Use

- Use when the team needs a standardized implementation path for this capability.
- Use when quality gates must be documented before rollout.
- Use when architecture, security, and operational concerns must be captured in one artifact.

## Inputs

| Input | Description |
|---|---|
| Core parameters | sdk_version, auth_mode, tool_registry, telemetry_requirements |
| Environment | dev, staging, prod |
| Constraints | compliance, latency, budget, and ownership constraints |

## Prerequisites

- Repository has documented build and test commands.
- Owners are assigned for implementation and approval.
- Required platform access is validated before execution.
- A rollback plan exists for every production-facing change.

## Execution Workflow

### 1) Discover and Scope

- Identify the minimum viable change for initial rollout.
- List dependencies across code, config, infra, and docs.
- Capture assumptions that can invalidate results.

### 2) Design Decisions

- Select patterns that favor reliability and clear observability.
- Keep interfaces stable and versioned where possible.
- Separate required behavior from optional enhancements.

### 3) Implement in Small Steps

- Make incremental changes with narrow blast radius.
- Run local validation after each meaningful edit.
- Document non-obvious tradeoffs near the implementation.

### 4) Validate and Review

- Run lint, unit, and integration checks for impacted areas.
- Confirm expected behavior with representative scenarios.
- Capture evidence in a concise review record.

### 5) Release and Observe

- Promote with staged rollout where practical.
- Monitor key signals and set alert thresholds.
- Prepare rollback trigger criteria and ownership.

## Quality Gates

- Correctness: behavior matches acceptance criteria.
- Reliability: failure modes are handled with safe defaults.
- Security: secrets are externalized and access is least-privilege.
- Cost: implementation respects budget guardrails.
- Operability: logs, metrics, and runbooks are available.

## Deliverables

| Artifact | Purpose |
|---|---|
| Primary output | integration-architecture.md, bootstrap checklist, failure modes matrix |
| Decision log | Captures architecture and tradeoff decisions |
| Validation record | Stores test and review evidence |
| Rollback note | Defines reversal steps and owner |

## Verification Checklist

- [ ] Scope and assumptions documented.
- [ ] Implementation reviewed by responsible owner.
- [ ] Validation evidence attached.
- [ ] Operational monitors configured.
- [ ] Rollback plan tested or rehearsed.
- [ ] Completion criteria met: tool calls succeed, auth flow validated, telemetry emitted with correlation ids.

## Troubleshooting

### Symptom: Results differ between environments

- Compare environment-specific configuration values.
- Verify version parity for tools and dependencies.
- Re-run with deterministic inputs and fixed sample data.

### Symptom: Validation passes locally but fails in CI

- Reproduce using CI-equivalent commands and versions.
- Inspect generated artifacts and line-ending differences.
- Check for timing/order assumptions in tests.

### Symptom: Operational metrics are noisy

- Tune thresholds based on baseline behavior.
- Add dimensions to isolate source and impact.
- Separate informational events from alerting signals.

## Security and Compliance Notes

- Avoid embedding secrets or tokens in docs and examples.
- Prefer managed identity and centralized secret stores.
- Record data handling boundaries and retention expectations.
- Ensure auditability for critical decisions and approvals.

## Performance and Cost Notes

- Start with right-sized defaults; scale with evidence.
- Cache expensive operations where consistency allows.
- Track utilization trends and revisit thresholds monthly.
- Stop non-essential background processing in low-traffic windows.

## Example Command Set

```bash
# Adapt these commands to the repository conventions
npm run lint
npm test
npm run build
```

## Definition of Done

The skill execution is complete when implementation, validation, and operational handoff are all documented, approved, and reproducible by another engineer without tribal knowledge.

## Metadata

- Category: Platform Integration
- Maintainer: FAI Skill System
- Review cadence: Quarterly or after major platform changes
