---
# MCP Trust Evidence — verified-publisher: Stripe  ([X1.7])
# Standards: ../../../../frootai-core/docs/internal/trust-assignment-criteria.md

# Canonical GitHub org / manifest key (doctrine #2). The catalog entry arrives
# from the official MCP registry under the reverse-DNS namespace `com.stripe`
# (no github_org captured); the canonical operator org is github.com/stripe.
publisher: stripe

tier: verified-publisher

servers_covered:
  - com.stripe/mcp

last_reviewed: 2026-06-25
reviewer: frootai-maintainer

# No Orchard accelerator attaches Stripe (signal #1 false). The controlling
# signal is founder-verified: the OFFICIAL Stripe server, published to the
# official MCP registry under com.stripe, rostered verified-publisher in §2.2.
signals:
  prior_orchard_accelerator: false
  code_review: false
  founder_verified: true

contact_overlay: stripe.contact.local.md
---

# Trust Evidence — `stripe` (verified-publisher)

Stripe publishes the **official Stripe MCP server** (payments/billing tooling).
Stripe is a major known vendor outside the FrootAI/Microsoft operational
boundary — trusted enough to attach silently, but destructive tools (e.g.
issuing a refund, creating a charge) **always** confirm per-call
(`attachWithoutPrompt: true`, `allowDestructive: false`, metering
`per-publisher`).

## Publisher identity

- **GitHub org/owner**: `github.com/stripe` (canonical operator).
- **Manifest key**: `stripe` — matches Stripe's org (doctrine #2).
- **Catalog identity**: the seed entry comes from the official MCP registry
  under the reverse-DNS namespace `com.stripe` (no `github_org` captured in the
  crawl). The namespace `com.stripe.*` is reverse-DNS-owned by Stripe.

## Servers covered

| Catalog slug | Server | Category | Installs (seed) |
|---|---|---|---|
| `com.stripe/mcp` | Stripe MCP Server | specialty | 1,606 |

Stripe's server exposes payment, customer, invoice, and refund tooling — several
of which are destructive. The tier policy keeps `allowDestructive: false`, so
every such tool prompts per call even though Stripe attaches silently.

## Prior Orchard accelerator

`signals.prior_orchard_accelerator: false` — no shipped Orchard solution-play
attaches Stripe. (Note: `stripe` appears in the repo only as a credential
pattern in the secrets-scanner hook — `sk_live_*` — which is unrelated to trust
classification.)

## Code-review notes

`signals.code_review: false` — no standalone source review on file.

## Founder-verified  — SIGNAL (controlling)

`signals.founder_verified: true`. The server is the **official** Stripe MCP
server, published to the official MCP registry under Stripe's own reverse-DNS
namespace `com.stripe` (not a third-party wrapper or fork). Stripe is rostered
as an initial `verified-publisher` in masterplan §2.2. The authenticity signal —
official vendor server under the vendor's own namespace — clears the
`verified-publisher` gate (criteria §4.2). Popularity (1.6k installs) is ranking
context only.

## Maintenance

Active. Maintained by Stripe as its official integration surface.

## Contact — PRIVATE (doctrine #3)

Raw incident-response contact lives only in the gitignored sidecar
`stripe.contact.local.md`. The committed file records no PII.

- **Contact overlay present locally**: _no (populate when needed)_
- **Last reachable**: 2026-06-25 (date only)

## Decision

**PASS — `verified-publisher`.** Official Stripe server under Stripe's own
`com.stripe` registry namespace; founder-rostered verified-publisher (§2.2).
Attaches without prompt; the (destructive) payment tools still confirm per-call;
metering `per-publisher`.

<!--
  CHANGELOG NOTE: on any tier change, append to
  frootai/orchard/registry/mcp-trust-changelog.md ([X1.27]):
  (date, publisher, old_tier, new_tier, reason, reviewer)  — doctrine #8.
-->
