---
# MCP Trust Evidence — verified-publisher: Notion  ([X1.6])
# Standards: ../../../../frootai-core/docs/internal/trust-assignment-criteria.md

# Brand/manifest key. Notion's official server ships from the GitHub org
# `makenotion` (declared in covers_orgs). Both `notion` (brand) and `makenotion`
# (org) are seeded in the M0 trust.json; covers_orgs is the doctrine #2 identity
# set (mirrors the microsoft.md multi-org pattern).
publisher: notion

tier: verified-publisher

covers_orgs:
  - makenotion

servers_covered:
  - makenotion/notion-mcp-server

last_reviewed: 2026-06-25
reviewer: frootai-maintainer

# No Orchard accelerator integrates Notion yet (signal #1 false). The controlling
# signal is founder-verified: the OFFICIAL Notion server from Notion's own
# verified org, rostered verified-publisher in masterplan §2.2.
signals:
  prior_orchard_accelerator: false
  code_review: false
  founder_verified: true

contact_overlay: notion.contact.local.md
---

# Trust Evidence — `notion` (verified-publisher)

Notion publishes the **official Notion MCP server** from its own verified GitHub
org `makenotion`. Notion is a major known SaaS vendor, outside the
FrootAI/Microsoft operational boundary — trusted enough to attach silently, but
destructive tools still confirm per-call (`attachWithoutPrompt: true`,
`allowDestructive: false`, metering `per-publisher`).

## Publisher identity

- **Brand**: Notion (notion.so).
- **GitHub org/owner**: `github.com/makenotion` — the org that publishes the
  official server. The friendly key `notion` resolves to this org via
  `covers_orgs` (doctrine #2 identity set).
- **Server repo**: `https://github.com/makenotion/notion-mcp-server`.

> **Naming note**: the masterplan row labels this `notion.md`. The canonical
> GitHub org is `makenotion`. The M0 federation `trust.json` seeded BOTH keys
> (`notion` + `makenotion`) as verified-publisher; at `[X1.19]` (manifest
> compose) the canonical mapping is `makenotion → verified-publisher`, with
> `notion` retained only as a documented brand alias owned by this file.

## Servers covered

| Catalog slug | Server | Category | Installs (seed) |
|---|---|---|---|
| `makenotion/notion-mcp-server` | Notion MCP Server | specialty | 4,422 |

## Prior Orchard accelerator

`signals.prior_orchard_accelerator: false` — no shipped Orchard solution-play
attaches Notion today (verified: no `notion`/`makenotion` area in
`frootai/solution-plays/*/agent.md`). Eligible to flip true if a future play
integrates it.

## Code-review notes

`signals.code_review: false` — no standalone source review on file.

## Founder-verified  — SIGNAL (controlling)

`signals.founder_verified: true`. The server is the **official** Notion MCP
server, published from Notion's **own verified org** `makenotion` (not a
third-party wrapper or fork). Notion is rostered as an initial
`verified-publisher` in masterplan §2.2. The authenticity signal — official
vendor server from the vendor's own verified org — clears the
`verified-publisher` gate (criteria §4.2). Popularity (4.4k installs) is noted
as ranking context only, never as a trust signal.

## Maintenance

Active. Maintained by Notion as its official integration surface.

## Contact — PRIVATE (doctrine #3)

Raw incident-response contact lives only in the gitignored sidecar
`notion.contact.local.md`. The committed file records no PII.

- **Contact overlay present locally**: _no (populate when needed)_
- **Last reachable**: 2026-06-25 (date only)

## Decision

**PASS — `verified-publisher`.** Official Notion server published from Notion's
own verified org `makenotion`; founder-rostered verified-publisher (§2.2).
Identity resolves via `covers_orgs: [makenotion]`. Attaches without prompt;
destructive tools still confirm per-call; metering `per-publisher`.

<!--
  CHANGELOG NOTE: on any tier change, append to
  frootai/orchard/registry/mcp-trust-changelog.md ([X1.27]):
  (date, publisher, old_tier, new_tier, reason, reviewer)  — doctrine #8.
-->
