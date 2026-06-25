---
# MCP Trust Evidence — verified-publisher: Sonatype  ([X1.13])
# Standards: ../../../../frootai-core/docs/internal/trust-assignment-criteria.md

# Canonical GitHub org / manifest key (doctrine #2). The catalog entry arrives
# from the official MCP registry under the reverse-DNS namespace `com.sonatype`
# (no github_org captured); the canonical operator org is github.com/sonatype.
publisher: sonatype

tier: verified-publisher

servers_covered:
  - com.sonatype/dependency-management-mcp-server

last_reviewed: 2026-06-25
reviewer: frootai-maintainer

# No Orchard accelerator attaches Sonatype (signal #1 false). The controlling
# signal is founder-verified: the OFFICIAL Sonatype server under its own
# com.sonatype namespace, rostered verified-publisher in masterplan §2.2.
signals:
  prior_orchard_accelerator: false
  code_review: false
  founder_verified: true

contact_overlay: sonatype.contact.local.md
---

# Trust Evidence — `sonatype` (verified-publisher)

Sonatype publishes the **official Sonatype dependency-management MCP server**
(software supply-chain / dependency intelligence). Sonatype is a known vendor
outside the FrootAI/Microsoft operational boundary — trusted enough to attach
silently, but destructive tools still confirm per-call
(`attachWithoutPrompt: true`, `allowDestructive: false`, metering
`per-publisher`).

## Publisher identity

- **GitHub org/owner**: `github.com/sonatype` (canonical operator, public
  presence at sonatype.com).
- **Manifest key**: `sonatype` — matches Sonatype's org (doctrine #2).
- **Catalog identity**: the seed entry comes from the official MCP registry
  under the reverse-DNS namespace `com.sonatype` (no `github_org` captured in the
  crawl). The namespace `com.sonatype.*` is reverse-DNS-owned by Sonatype.

## Servers covered

| Catalog slug | Server | Category | Installs (seed) |
|---|---|---|---|
| `com.sonatype/dependency-management-mcp-server` | Sonatype Dependency Management MCP Server | dev-tooling | 72 |

The server is primarily read-oriented (dependency / vulnerability intelligence);
the tier policy keeps `allowDestructive: false` so any future destructive tool
would prompt.

## Prior Orchard accelerator

`signals.prior_orchard_accelerator: false` — no shipped Orchard solution-play
attaches Sonatype today (verified: no `sonatype` area in
`frootai/solution-plays/*/agent.md`).

## Code-review notes

`signals.code_review: false` — no standalone source review on file.

## Founder-verified  — SIGNAL (controlling)

`signals.founder_verified: true`. The server is the **official** Sonatype MCP
server, published to the official MCP registry under Sonatype's own reverse-DNS
namespace `com.sonatype` (not a third-party wrapper or fork). Sonatype is
rostered as an initial `verified-publisher` in masterplan §2.2. The authenticity
signal — official vendor server under the vendor's own namespace — clears the
`verified-publisher` gate (criteria §4.2). Popularity (72 installs) is ranking
context only.

## Maintenance

Active. Maintained by Sonatype as its official integration surface.

## Contact — PRIVATE (doctrine #3)

Raw incident-response contact lives only in the gitignored sidecar
`sonatype.contact.local.md`. The committed file records no PII.

- **Contact overlay present locally**: _no (populate when needed)_
- **Last reachable**: 2026-06-25 (date only)

## Decision

**PASS — `verified-publisher`.** Official Sonatype server under Sonatype's own
`com.sonatype` registry namespace; founder-rostered verified-publisher (§2.2).
Attaches without prompt; destructive tools still confirm per-call; metering
`per-publisher`.

<!--
  CHANGELOG NOTE: on any tier change, append to
  frootai/orchard/registry/mcp-trust-changelog.md ([X1.27]):
  (date, publisher, old_tier, new_tier, reason, reviewer)  — doctrine #8.
-->
