---
# MCP Trust Evidence — verified-publisher: Qdrant  ([X4.15])
# Standards: ../../../../frootai-core/docs/internal/trust-assignment-criteria.md

# GitHub org / manifest key (doctrine #2 — exact match).
publisher: qdrant

tier: verified-publisher

servers_covered:
  - qdrant/mcp-server-qdrant

last_reviewed: 2026-06-25
reviewer: frootai-maintainer

# No Orchard accelerator attaches Qdrant (signal #1 false). The controlling
# signal is founder-verified: the OFFICIAL Qdrant server from its own verified
# org, rostered verified-publisher in masterplan §2.2.
signals:
  prior_orchard_accelerator: false
  code_review: false
  founder_verified: true

contact_overlay: qdrant.contact.local.md
---

# Trust Evidence — `qdrant` (verified-publisher)

Qdrant publishes the **official Qdrant MCP server** (`mcp-server-qdrant`) — a
semantic-memory layer over the Qdrant vector search engine. Qdrant is a known
third-party vendor outside the FrootAI/Microsoft operational boundary — trusted
enough to attach silently, but destructive tools still confirm per-call
(`attachWithoutPrompt: true`, `allowDestructive: false`, metering
`per-publisher`).

## Publisher identity

- **GitHub org/owner**: `github.com/qdrant` (real org, public presence at
  qdrant.tech).
- **Manifest key**: `qdrant` — matches the org exactly (doctrine #2).
- **Server repo**: `https://github.com/qdrant/mcp-server-qdrant` (Apache-2.0,
  "An official Qdrant Model Context Protocol (MCP) server implementation").
- **Package**: `mcp-server-qdrant` (PyPI, run via `uvx`).

## Servers covered

| Catalog slug | Server | Category | Installs (seed) |
|---|---|---|---|
| `qdrant/mcp-server-qdrant` | Qdrant MCP Server | docs-retrieval | 1,400 |

Qdrant's server exposes two tools — `qdrant-store` (append a memory) and
`qdrant-find` (semantic retrieval); it exposes no destructive tools. The tier
policy still keeps `allowDestructive: false` so any future destructive tool
would prompt.

## Prior Orchard accelerator

`signals.prior_orchard_accelerator: false` — no shipped Orchard solution-play
attaches Qdrant today (verified: no `qdrant` area in
`frootai/solution-plays/*/agent.md`). A natural future fit for the agentic-RAG /
long-term-memory plays alongside Firecrawl, Tavily, and Context7.

## Code-review notes

`signals.code_review: false` — no standalone source review on file.

## Founder-verified  — SIGNAL (controlling)

`signals.founder_verified: true`. The server is the **official** Qdrant MCP
server, published from Qdrant's **own verified org** `qdrant` (not a third-party
wrapper or fork). Qdrant is rostered as a `verified-publisher` candidate in
masterplan §2.2. The authenticity signal — official vendor server from the
vendor's own verified org — clears the `verified-publisher` gate (criteria §4.2).
Popularity is ranking context only.

## Maintenance

Active. Maintained by Qdrant as its official integration surface (latest release
v0.8.1, Dec 2025).

## Contact — PRIVATE (doctrine #3)

Raw incident-response contact lives only in the gitignored sidecar
`qdrant.contact.local.md`. The committed file records no PII.

- **Contact overlay present locally**: _no (populate when needed)_
- **Last reachable**: 2026-06-25 (date only)

## Decision

**PASS — `verified-publisher`.** Exact identity match (`qdrant` ===
`github.com/qdrant`), official vendor server from its own verified org,
founder-rostered verified-publisher (§2.2). Attaches without prompt; destructive
tools still confirm per-call; metering `per-publisher`.

<!--
  CHANGELOG NOTE: on any tier change, append to
  frootai/orchard/registry/mcp-trust-changelog.md ([X1.27]):
  (date, publisher, old_tier, new_tier, reason, reviewer)  — doctrine #8.
-->
