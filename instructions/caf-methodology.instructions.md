---
description: "Cloud Adoption Framework — Methodology umbrella. Cross-cuts Strategy, Plan, Ready, Adopt (Migrate/Innovate), Govern, Manage, Secure. Use this pack alongside the per-domain CAF instruction files."
applyTo: "**/*.md, **/*.bicep, **/*.bicepparam, **/parameters.json, **/*.tf, **/*.tfvars, **/azure.yaml"
caf:
  - "methodology"
  - "identity"
  - "network"
  - "security"
  - "governance"
  - "operations"
  - "billing"
---

# CAF — Methodology

The Microsoft Cloud Adoption Framework organizes cloud work into 7 methodologies. This pack maps each one to the FAI domains and to the per-domain instruction files in this folder.

## Strategy
- Document the business motivation, expected outcomes, and the financial model BEFORE provisioning anything
- Author lives in `planning/` — not in IaC
- Validator coverage: N/A (this is a doc deliverable)

## Plan
- Inventory existing workloads, classify by complexity, sequence the adoption
- Output: a migration / innovation backlog with per-workload disposition (rehost / refactor / rearchitect / rebuild / replace)
- Validator coverage: N/A (this is a planning artifact)

## Ready
- Land the landing zone — Management Groups, networking, identity, security baseline
- This is where most CAF instruction packs apply:
  - **Identity** → see [caf-identity.instructions.md](./caf-identity.instructions.md) (CAF-I-006/007/010)
  - **Network** → see [caf-network.instructions.md](./caf-network.instructions.md) (CAF-N-003..011)
  - **Security baseline** → see [caf-security.instructions.md](./caf-security.instructions.md) (CAF-S-001..010)
  - **Governance baseline** → see [caf-governance.instructions.md](./caf-governance.instructions.md) (CAF-G-003..008)

## Adopt — Migrate
- Use Azure Migrate for assessment + replication
- Apply right-sizing recommendations BEFORE replication, not after
- Validator coverage: workload-level — same CAF-* checks as any production workload

## Adopt — Innovate
- New cloud-native workloads built on Foundry / AI Services / Container Apps / Functions
- All Innovate workloads MUST pass the same CAF gate as Migrate workloads — no exceptions for "it's experimental"

## Govern
- See [caf-governance.instructions.md](./caf-governance.instructions.md) for the IaC-level policy assignments
- Process-level governance (cost reviews, access reviews, exception workflows) lives in tenant admin, not IaC

## Manage
- Operations baseline → see [caf-operations.instructions.md](./caf-operations.instructions.md) (CAF-O-001..011)
- Includes monitoring, alerts, backup, patch lifecycle, Service Health

## Secure
- Security operations → see [caf-security.instructions.md](./caf-security.instructions.md) (CAF-S-001..010)
- Cross-cuts Identity, Network, Operations — author Sentinel + Defender + Key Vault rotation together

---

## Per-domain instruction-file cross-reference

| Methodology phase | Primary instruction file | Check IDs |
|-------------------|--------------------------|-----------|
| Ready / Identity | [caf-identity.instructions.md](./caf-identity.instructions.md) | CAF-I-006/007/010 (+8 out-of-template) |
| Ready / Network | [caf-network.instructions.md](./caf-network.instructions.md) | CAF-N-003..011 (9 checks) |
| Ready / Security | [caf-security.instructions.md](./caf-security.instructions.md) | CAF-S-001..010 (9 checks) |
| Govern | [caf-governance.instructions.md](./caf-governance.instructions.md) | CAF-G-003..008 (5 checks) |
| Manage | [caf-operations.instructions.md](./caf-operations.instructions.md) | CAF-O-001..011 (7 checks) |
| Strategy / Cost | [caf-billing.instructions.md](./caf-billing.instructions.md) | CAF-B-002..010 (6 checks) |

**Total**: 39 enforceable CAF check IDs across 6 domain packs + 1 methodology umbrella = 7 instruction files. Aligned 1:1 with the `frootai-core/scripts/verified/caf-validator/checks/*.py` modules.

## Authoring discipline

- A new workload template MUST address ALL applicable CAF domains — not just the ones the author is familiar with
- When in doubt about which domain owns a control, default to **Ready** (it's the landing-zone phase)
- Combine WAF + CAF: WAF says "is the workload well-built?", CAF says "is the landing zone right?". Both gates must pass.
