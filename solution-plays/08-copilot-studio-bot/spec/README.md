# Play 08 Specification

## Product Boundary

Play 08 is a Copilot Studio and Power Platform solution. Repository changes may
describe or modify exported solution source, Dataverse components, connection
references, environment variables, DLP requirements, roles, Power Automate
flows, durable approvals, managed-solution promotion, and rollback.

The package currently has no exported solution source. Do not present the target
architecture as an importable or published bot.

## Canonical Files

| File | Purpose |
|---|---|
| `config/power-platform.json` | Platform authority, ALM stages, controls, evidence gaps |
| `config/guardrails.json` | DLP, identity, privacy, approval, and evidence boundaries |
| `config/agents.json` | Developer-agent roles and authority |
| `evaluation/test-set.jsonl` | Ownership and release-contract cases |
| `evaluation/eval.py` | Offline contract validator; it does not simulate runtime quality |
| `architecture.md` | Target solution and promotion boundaries |

## Promotion Contract

Promotion requires one exact managed solution artifact, explicit connection and
environment bindings, tenant DLP compatibility, least-privilege roles, durable
approval evidence, clean test import, human approval, production smoke, and a
tested rollback artifact. Missing evidence blocks promotion.

## Not Yet Available

- `solution/` export and unpacked source
- Dataverse schema and security roles
- connection references and environment variables
- tenant DLP policy export
- managed test or production import receipts
- channel publication and smoke receipts
- measured evaluation, cost, or operational evidence