---
# MCP Trust Evidence — verified-publisher: Atlassian  ([X1.14])
# Standards: ../../../../frootai-core/docs/internal/trust-assignment-criteria.md

# Canonical GitHub org / manifest key (doctrine #2). The catalog entry arrives
# from the official MCP registry under the reverse-DNS namespace `com.atlassian`
# (no github_org captured); the canonical operator org is github.com/atlassian.
publisher: atlassian

tier: verified-publisher

servers_covered:
  - com.atlassian/atlassian-mcp-server

last_reviewed: 2026-06-25
reviewer: frootai-maintainer

# No Orchard accelerator attaches Atlassian (signal #1 false). The controlling
# signal is founder-verified: the OFFICIAL Atlassian server under its own
# com.atlassian namespace, rostered verified-publisher in masterplan §2.2.
signals:
  prior_orchard_accelerator: false
  code_review: false
  founder_verified: true

contact_overlay: atlassian.contact.local.md
---

# Trust Evidence — `atlassian` (verified-publisher)

Atlassian publishes the **official Atlassian MCP server** (Jira / Confluence
tooling). Atlassian is a known vendor outside the FrootAI/Microsoft operational
boundary — trusted enough to attach silently, but destructive tools (e.g.
deleting an issue, editing a page) still confirm per-call
(`attachWithoutPrompt: true`, `allowDestructive: false`, metering
`per-publisher`).

## Publisher identity

- **GitHub org/owner**: `github.com/atlassian` (canonical operator, public
  presence at atlassian.com).
- **Manifest key**: `atlassian` — matches Atlassian's org (doctrine #2).
- **Catalog identity**: the seed entry comes from the official MCP registry
  under the reverse-DNS namespace `com.atlassian` (no `github_org` captured in
  the crawl). The namespace `com.atlassian.*` is reverse-DNS-owned by Atlassian.

## Servers covered

| Catalog slug | Server | Category | Installs (seed) |
|---|---|---|---|
| `com.atlassian/atlassian-mcp-server` | Atlassian MCP Server | specialty | 780 |

The server exposes Jira/Confluence read + write tooling; write/delete operations
are destructive. The tier policy keeps `allowDestructive: false`, so each such
operation prompts per call even though Atlassian attaches silently.

## Prior Orchard accelerator

`signals.prior_orchard_accelerator: false` — no shipped Orchard solution-play
attaches Atlassian today (verified: no `atlassian` area in
`frootai/solution-plays/*/agent.md`).

## Code-review notes

`signals.code_review: false` — no standalone source review on file.

## Founder-verified  — SIGNAL (controlling)

`signals.founder_verified: true`. The server is the **official** Atlassian MCP
server, published to the official MCP registry under Atlassian's own reverse-DNS
namespace `com.atlassian` (not a third-party wrapper or fork). Atlassian is
rostered as a round-2 `verified-publisher` in masterplan §2.2. The authenticity
signal — official vendor server under the vendor's own namespace — clears the
`verified-publisher` gate (criteria §4.2). Popularity (780 installs) is ranking
context only.

## Maintenance

Active. Maintained by Atlassian as its official integration surface.

## Contact — PRIVATE (doctrine #3)

Raw incident-response contact lives only in the gitignored sidecar
`atlassian.contact.local.md`. The committed file records no PII.

- **Contact overlay present locally**: _no (populate when needed)_
- **Last reachable**: 2026-06-25 (date only)

## Decision

**PASS — `verified-publisher`.** Official Atlassian server under Atlassian's own
`com.atlassian` registry namespace; founder-rostered verified-publisher (§2.2).
Attaches without prompt; destructive Jira/Confluence tools still confirm
per-call; metering `per-publisher`.

<!--
  CHANGELOG NOTE: on any tier change, append to
  frootai/orchard/registry/mcp-trust-changelog.md ([X1.27]):
  (date, publisher, old_tier, new_tier, reason, reviewer)  — doctrine #8.
-->
