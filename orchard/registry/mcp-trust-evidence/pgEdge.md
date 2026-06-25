---
# MCP Trust Evidence — verified-publisher: pgEdge  ([X1.12])
# Standards: ../../../../frootai-core/docs/internal/trust-assignment-criteria.md

# GitHub org / manifest key (doctrine #2 — EXACT match, including casing).
# NOTE: the M0 federation trust.json seeded this key lowercased as `pgedge`;
# the catalog org is `pgEdge`. Doctrine #2 requires exact-case match → the
# canonical key is `pgEdge`. X1.19 (manifest compose) must canonicalize the
# lowercase M0 key to `pgEdge`.
publisher: pgEdge

tier: verified-publisher

servers_covered:
  - pgEdge/postgres-mcp

last_reviewed: 2026-06-25
reviewer: frootai-maintainer

# No Orchard accelerator attaches pgEdge (signal #1 false). The controlling
# signal is founder-verified: the OFFICIAL pgEdge Postgres server from its own
# verified org, rostered verified-publisher in masterplan §2.2.
signals:
  prior_orchard_accelerator: false
  code_review: false
  founder_verified: true

contact_overlay: pgEdge.contact.local.md
---

# Trust Evidence — `pgEdge` (verified-publisher)

pgEdge publishes the **official pgEdge Postgres MCP server** (distributed
PostgreSQL management). pgEdge is a known vendor outside the FrootAI/Microsoft
operational boundary — trusted enough to attach silently, but its destructive
database tools still confirm per-call (`attachWithoutPrompt: true`,
`allowDestructive: false`, metering `per-publisher`).

## Publisher identity

- **GitHub org/owner**: `github.com/pgEdge` (pgEdge's official org, public
  presence at pgedge.com).
- **Manifest key**: `pgEdge` — matches the org exactly, **including casing**
  (doctrine #2). The M0 trust.json seed used a lowercased `pgedge`; that is a
  casing drift reconciled to `pgEdge` at `[X1.19]`.
- **Server repo**: `https://github.com/pgEdge/postgres-mcp`.

## Servers covered

| Catalog slug | Server | Category | Installs (seed) |
|---|---|---|---|
| `pgEdge/postgres-mcp` | pgEdge Postgres MCP Server | data-stores | 178 |

The server exposes SQL execution and Postgres administration — several
operations are destructive. The tier policy keeps `allowDestructive: false`, so
each destructive operation (e.g. `DROP TABLE`, node management) prompts per call
even though pgEdge attaches silently.

## Prior Orchard accelerator

`signals.prior_orchard_accelerator: false` — no shipped Orchard solution-play
attaches pgEdge today (verified: no `pgedge`/`postgres-mcp` area in
`frootai/solution-plays/*/agent.md`).

## Code-review notes

`signals.code_review: false` — no standalone source review on file.

## Founder-verified  — SIGNAL (controlling)

`signals.founder_verified: true`. The server is the **official** pgEdge Postgres
MCP server, published from pgEdge's **own verified org** `pgEdge` (not a
third-party wrapper or fork). pgEdge is rostered as an initial
`verified-publisher` in masterplan §2.2. The authenticity signal — official
vendor server from the vendor's own verified org — clears the
`verified-publisher` gate (criteria §4.2). Popularity (178 installs) is ranking
context only.

## Maintenance

Active. Maintained by pgEdge as its official integration surface.

## Contact — PRIVATE (doctrine #3)

Raw incident-response contact lives only in the gitignored sidecar
`pgEdge.contact.local.md`. The committed file records no PII.

- **Contact overlay present locally**: _no (populate when needed)_
- **Last reachable**: 2026-06-25 (date only)

## Decision

**PASS — `verified-publisher`.** Exact identity match (`pgEdge` ===
`github.com/pgEdge`), official vendor server from its own verified org,
founder-rostered verified-publisher (§2.2). Attaches without prompt; the
destructive database tools still confirm per-call; metering `per-publisher`.

<!--
  CHANGELOG NOTE: on any tier change, append to
  frootai/orchard/registry/mcp-trust-changelog.md ([X1.27]):
  (date, publisher, old_tier, new_tier, reason, reviewer)  — doctrine #8.
-->
