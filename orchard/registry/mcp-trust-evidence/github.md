---
# MCP Trust Evidence — first-party-ms: GitHub  ([X1.4])
# Standards: ../../../../frootai-core/docs/internal/trust-assignment-criteria.md

# GitHub org / manifest key (doctrine #2 — exact match).
publisher: github

# GitHub is a Microsoft subsidiary operating its own verified org. The masterplan
# §2.2 tier table classifies GitHub under first-party-ms ("GitHub, jointly").
tier: first-party-ms

servers_covered:
  - github/github-mcp-server

last_reviewed: 2026-06-25
reviewer: frootai-maintainer

# For first-party-ms the controlling gate is org verification (see body); the
# signals block is retained for schema consistency.
signals:
  prior_orchard_accelerator: true
  code_review: false
  founder_verified: true

contact_overlay: github.contact.local.md
---

# Trust Evidence — `github` (first-party-ms)

GitHub is a **first-party operator**: a Microsoft subsidiary that publishes its
official MCP server from its own verified GitHub org. It is treated as inside the
FrootAI/Microsoft trust boundary (`attachWithoutPrompt: true`,
`allowDestructive: true`, metering `azure-aoai`).

## Publisher identity

| GitHub org | Verified | Namespace | Notes |
|---|---|---|---|
| `github.com/github` | yes (org verified badge) | official GitHub release pipeline | GitHub's own org |

Manifest key `github` matches the upstream org exactly (doctrine #2). GitHub is a
Microsoft subsidiary; it is classified first-party jointly with Microsoft, but on
its **own** verified identity — not by aliasing to `microsoft`.

## Servers covered

| Catalog slug | Server | Category | Installs (seed) |
|---|---|---|---|
| `github/github-mcp-server` | GitHub MCP Server | dev-tooling | 30,666 |

The GitHub MCP Server exposes repository, issue, PR, and Actions tooling. As a
first-party server its destructive tools (e.g. closing an issue, merging a PR)
may run without a per-call prompt once attached — the user consented by
attaching a first-party server.

## Org verification (the first-party justification)

The promotion gate for `first-party-ms` (criteria §3.2) is satisfied:

1. **Verified org** — `github.com/github` carries the GitHub organisation
   verified badge and is GitHub's own corporate org.
2. **Published from the org's own repository** — `github_url`
   `https://github.com/github/github-mcp-server` resolves inside the verified
   org (not a fork or mirror).
3. **Official release pipeline** — the server ships from GitHub's own release
   process.
4. **This evidence file** names the server and the verification method.

## Prior Orchard accelerator

`signals.prior_orchard_accelerator: true` — GitHub tooling is already composed
into Orchard developer-workflow plays; the GitHub MCP server is a load-bearing
integration across the dev-tooling category.

## Code-review notes

`signals.code_review: false` — not required for `first-party-ms` (org
verification is the controlling gate). The per-server attach spec + `tools/list`
snapshot are validated in Phase X2.

## Founder-verified

`signals.founder_verified: true` — GitHub is a Microsoft subsidiary and platform
partner; the operator relationship is founder-known.

## Maintenance

Actively maintained by GitHub on a rolling release cadence.

## Contact — PRIVATE (doctrine #3)

Raw incident-response contact lives only in the gitignored sidecar
`github.contact.local.md`. For a first-party operator the escalation path is the
GitHub/Microsoft security response process; the committed file records no PII.

- **Contact overlay present locally**: no (first-party escalation via GitHub Security)
- **Last reachable**: 2026-06-25 (date only)

## Decision

**PASS — `first-party-ms`.** GitHub's own verified org publishes its official MCP
server from its own repository under an official release pipeline. Inside the
trust boundary: attach without prompt, destructive tools permitted without
per-call confirmation, usage meters to `azure-aoai`.

<!--
  CHANGELOG NOTE: on any tier change, append to
  frootai/orchard/registry/mcp-trust-changelog.md ([X1.27]):
  (date, publisher, old_tier, new_tier, reason, reviewer)  — doctrine #8.
-->
