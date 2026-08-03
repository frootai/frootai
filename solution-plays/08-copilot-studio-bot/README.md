# Play 08 - Copilot Studio Bot

> Target Power Platform solution for Copilot Studio topics, actions, Dataverse,
> DLP, approvals, and managed-solution ALM.

## Current State

This repository defines the target ownership and release contract. It does not
contain exported Copilot Studio solution source, Dataverse schema, connection
references, environment variables, tenant DLP policy, role assignments, a
promotion pipeline, clean import receipts, publication receipts, or rollback
evidence. The play remains Designed.

## Authoritative Surface

- Copilot Studio owns topics, generative answers, knowledge configuration, and channels.
- Dataverse owns solution state, structured records, roles, and audit data.
- Power Automate owns connector-backed actions and durable approvals.
- Power Platform environments and managed solutions own promotion and rollback.
- `config/power-platform.json` is the repository contract for ownership and ALM.

No standalone model configuration or generic cloud infrastructure template is
part of this play. An external service may be added only through a separately
owned connector contract with licensing, identity, DLP, data-flow, and evidence
review.

## Required Release Evidence

1. Unmanaged development export and source-control unpack receipt.
2. Solution Checker output for the exact solution artifact.
3. Connection-reference and environment-variable inventory with owners.
4. Tenant DLP policy and least-privilege role-assignment evidence.
5. Managed import into an isolated test environment and functional test results.
6. Durable approval and audit receipts for consequential actions.
7. Production import, publication smoke, and tested rollback receipts.

## Developer Roles

| Role | Scope |
|---|---|
| Builder | Exported solution source, connection references, environment variables |
| Reviewer | Topics, connectors, DLP, roles, approvals, audit, promotion evidence |
| Tuner | Measured trigger, fallback, completion, and escalation behavior |

See [architecture.md](architecture.md), [spec/README.md](spec/README.md), and
[config/power-platform.json](config/power-platform.json).