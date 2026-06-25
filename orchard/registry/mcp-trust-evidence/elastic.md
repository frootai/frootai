---
# MCP Trust Evidence — verified-publisher: Elastic  ([X1.11])
# Standards: ../../../../frootai-core/docs/internal/trust-assignment-criteria.md

# GitHub org / manifest key (doctrine #2 — exact match).
publisher: elastic

tier: verified-publisher

servers_covered:
  - elastic/mcp-server-elasticsearch

last_reviewed: 2026-06-25
reviewer: frootai-maintainer

# No Orchard accelerator attaches Elastic (signal #1 false). The controlling
# signal is founder-verified: the OFFICIAL Elasticsearch server from its own
# verified org, rostered verified-publisher in masterplan §2.2.
signals:
  prior_orchard_accelerator: false
  code_review: false
  founder_verified: true

contact_overlay: elastic.contact.local.md
---

# Trust Evidence — `elastic` (verified-publisher)

Elastic publishes the **official Elasticsearch MCP server** (search + index
querying). Elastic is a known vendor outside the FrootAI/Microsoft operational
boundary — trusted enough to attach silently, but destructive index tools still
confirm per-call (`attachWithoutPrompt: true`, `allowDestructive: false`,
metering `per-publisher`).

## Publisher identity

- **GitHub org/owner**: `github.com/elastic` (Elastic's official org, public
  presence at elastic.co).
- **Manifest key**: `elastic` — matches the org exactly (doctrine #2).
- **Server repo**: `https://github.com/elastic/mcp-server-elasticsearch`.

## Servers covered

| Catalog slug | Server | Category | Installs (seed) |
|---|---|---|---|
| `elastic/mcp-server-elasticsearch` | Elasticsearch MCP Server | data-stores | 672 |

The server is primarily read-oriented (search/query over indices); any
index-mutating tool is held behind the tier policy's `allowDestructive: false`,
so it prompts per call even though Elastic attaches silently.

## Prior Orchard accelerator

`signals.prior_orchard_accelerator: false` — no shipped Orchard solution-play
attaches Elastic. (Note: matches for "elastic" in the repo refer to *elasticity*
pricing models, not Elastic the company — unrelated to trust classification.)

## Code-review notes

`signals.code_review: false` — no standalone source review on file.

## Founder-verified  — SIGNAL (controlling)

`signals.founder_verified: true`. The server is the **official** Elasticsearch
MCP server, published from Elastic's **own verified org** `elastic` (not a
third-party wrapper or fork). Elastic is rostered as an initial
`verified-publisher` in masterplan §2.2. The authenticity signal — official
vendor server from the vendor's own verified org — clears the
`verified-publisher` gate (criteria §4.2). Popularity (672 installs) is ranking
context only.

## Maintenance

Active. Maintained by Elastic as its official integration surface.

## Contact — PRIVATE (doctrine #3)

Raw incident-response contact lives only in the gitignored sidecar
`elastic.contact.local.md`. The committed file records no PII.

- **Contact overlay present locally**: _no (populate when needed)_
- **Last reachable**: 2026-06-25 (date only)

## Decision

**PASS — `verified-publisher`.** Exact identity match (`elastic` ===
`github.com/elastic`), official vendor server from its own verified org,
founder-rostered verified-publisher (§2.2). Attaches without prompt; destructive
index tools still confirm per-call; metering `per-publisher`.

<!--
  CHANGELOG NOTE: on any tier change, append to
  frootai/orchard/registry/mcp-trust-changelog.md ([X1.27]):
  (date, publisher, old_tier, new_tier, reason, reviewer)  — doctrine #8.
-->
