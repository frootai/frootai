---
# MCP Trust Evidence — verified-publisher: Supabase  ([X1.10])
# Standards: ../../../../frootai-core/docs/internal/trust-assignment-criteria.md

# Canonical GitHub org / manifest key (doctrine #2). The catalog entry arrives
# from the official MCP registry under the reverse-DNS namespace `com.supabase`
# (no github_org captured); the canonical operator org is github.com/supabase.
publisher: supabase

tier: verified-publisher

servers_covered:
  - com.supabase/mcp

last_reviewed: 2026-06-25
reviewer: frootai-maintainer

# No Orchard accelerator attaches Supabase (signal #1 false). The controlling
# signal is founder-verified: the OFFICIAL Supabase server under its own
# com.supabase namespace, rostered verified-publisher in masterplan §2.2.
signals:
  prior_orchard_accelerator: false
  code_review: false
  founder_verified: true

contact_overlay: supabase.contact.local.md
---

# Trust Evidence — `supabase` (verified-publisher)

Supabase publishes the **official Supabase MCP server** (Postgres database +
project administration). Supabase is a known vendor outside the
FrootAI/Microsoft operational boundary — trusted enough to attach silently, but
its destructive data tools **always** confirm per-call
(`attachWithoutPrompt: true`, `allowDestructive: false`, metering
`per-publisher`).

## Publisher identity

- **GitHub org/owner**: `github.com/supabase` (canonical operator, public
  presence at supabase.com).
- **Manifest key**: `supabase` — matches Supabase's org (doctrine #2).
- **Catalog identity**: the seed entry comes from the official MCP registry
  under the reverse-DNS namespace `com.supabase` (no `github_org` captured in the
  crawl). The namespace `com.supabase.*` is reverse-DNS-owned by Supabase.

## Servers covered

| Catalog slug | Server | Category | Installs (seed) |
|---|---|---|---|
| `com.supabase/mcp` | Supabase MCP Server | data-stores | 2,737 |

The server exposes SQL execution, table/row management, and project
administration — several of which are destructive. The tier policy keeps
`allowDestructive: false`, so each destructive operation (e.g. `DROP TABLE`,
project config changes) prompts per call even though Supabase attaches silently.

## Prior Orchard accelerator

`signals.prior_orchard_accelerator: false` — no shipped Orchard solution-play
attaches Supabase today (verified: no `supabase` area in
`frootai/solution-plays/*/agent.md`).

## Code-review notes

`signals.code_review: false` — no standalone source review on file.

## Founder-verified  — SIGNAL (controlling)

`signals.founder_verified: true`. The server is the **official** Supabase MCP
server, published to the official MCP registry under Supabase's own reverse-DNS
namespace `com.supabase` (not a third-party wrapper or fork). Supabase is
rostered as an initial `verified-publisher` in masterplan §2.2. The authenticity
signal — official vendor server under the vendor's own namespace — clears the
`verified-publisher` gate (criteria §4.2). Popularity (2.7k installs) is ranking
context only.

## Maintenance

Active. Maintained by Supabase as its official integration surface.

## Contact — PRIVATE (doctrine #3)

Raw incident-response contact lives only in the gitignored sidecar
`supabase.contact.local.md`. The committed file records no PII.

- **Contact overlay present locally**: _no (populate when needed)_
- **Last reachable**: 2026-06-25 (date only)

## Decision

**PASS — `verified-publisher`.** Official Supabase server under Supabase's own
`com.supabase` registry namespace; founder-rostered verified-publisher (§2.2).
Attaches without prompt; the destructive data tools still confirm per-call;
metering `per-publisher`.

<!--
  CHANGELOG NOTE: on any tier change, append to
  frootai/orchard/registry/mcp-trust-changelog.md ([X1.27]):
  (date, publisher, old_tier, new_tier, reason, reviewer)  — doctrine #8.
-->
