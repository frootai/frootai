---
# MCP Trust Evidence — verified-publisher: HashiCorp  ([X1.14])
# Standards: ../../../../frootai-core/docs/internal/trust-assignment-criteria.md

# GitHub org / manifest key (doctrine #2 — exact match).
publisher: hashicorp

tier: verified-publisher

servers_covered:
  - hashicorp/terraform-mcp-server

last_reviewed: 2026-06-25
reviewer: frootai-maintainer

# No Orchard accelerator attaches HashiCorp (signal #1 false). The controlling
# signal is founder-verified: the OFFICIAL Terraform server from its own verified
# org, rostered verified-publisher in masterplan §2.2.
signals:
  prior_orchard_accelerator: false
  code_review: false
  founder_verified: true

contact_overlay: hashicorp.contact.local.md
---

# Trust Evidence — `hashicorp` (verified-publisher)

HashiCorp publishes the **official Terraform MCP server** (infrastructure-as-code
planning + provider docs). HashiCorp is a known vendor outside the
FrootAI/Microsoft operational boundary — trusted enough to attach silently, but
destructive tools (e.g. `terraform apply`/`destroy`) still confirm per-call
(`attachWithoutPrompt: true`, `allowDestructive: false`, metering
`per-publisher`).

## Publisher identity

- **GitHub org/owner**: `github.com/hashicorp` (HashiCorp's official org, public
  presence at hashicorp.com).
- **Manifest key**: `hashicorp` — matches the org exactly (doctrine #2).
- **Server repo**: `https://github.com/hashicorp/terraform-mcp-server`.

## Servers covered

| Catalog slug | Server | Category | Installs (seed) |
|---|---|---|---|
| `hashicorp/terraform-mcp-server` | Terraform MCP Server | dev-tooling | 1,422 |

The server can plan and (potentially) apply infrastructure changes — destructive
operations. The tier policy keeps `allowDestructive: false`, so any apply/destroy
prompts per call even though HashiCorp attaches silently.

## Prior Orchard accelerator

`signals.prior_orchard_accelerator: false` — no shipped Orchard solution-play
attaches the Terraform MCP server. (Note: "Terraform" appears in the repo as the
`infra/` IaC templates, which is unrelated to attaching HashiCorp's MCP server.)

## Code-review notes

`signals.code_review: false` — no standalone source review on file.

## Founder-verified  — SIGNAL (controlling)

`signals.founder_verified: true`. The server is the **official** Terraform MCP
server, published from HashiCorp's **own verified org** `hashicorp` (not a
third-party wrapper or fork). HashiCorp is rostered as an initial
`verified-publisher` in masterplan §2.2. The authenticity signal — official
vendor server from the vendor's own verified org — clears the
`verified-publisher` gate (criteria §4.2). Popularity (1.4k installs) is ranking
context only.

## Maintenance

Active. Maintained by HashiCorp as its official integration surface.

## Contact — PRIVATE (doctrine #3)

Raw incident-response contact lives only in the gitignored sidecar
`hashicorp.contact.local.md`. The committed file records no PII.

- **Contact overlay present locally**: _no (populate when needed)_
- **Last reachable**: 2026-06-25 (date only)

## Decision

**PASS — `verified-publisher`.** Exact identity match (`hashicorp` ===
`github.com/hashicorp`), official vendor server from its own verified org,
founder-rostered verified-publisher (§2.2). Attaches without prompt; destructive
apply/destroy tools still confirm per-call; metering `per-publisher`.

<!--
  CHANGELOG NOTE: on any tier change, append to
  frootai/orchard/registry/mcp-trust-changelog.md ([X1.27]):
  (date, publisher, old_tier, new_tier, reason, reviewer)  — doctrine #8.
-->
