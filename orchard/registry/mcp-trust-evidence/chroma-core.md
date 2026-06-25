---
# MCP Trust Evidence — verified-publisher: Chroma  ([X4.16])
# Standards: ../../../../frootai-core/docs/internal/trust-assignment-criteria.md

# GitHub org / manifest key (doctrine #2 — exact match).
publisher: chroma-core

tier: verified-publisher

servers_covered:
  - chroma-core/chroma-mcp

last_reviewed: 2026-06-25
reviewer: frootai-maintainer

# No Orchard accelerator attaches Chroma (signal #1 false). The controlling
# signal is founder-verified: the OFFICIAL Chroma server from its own verified
# org, rostered verified-publisher in masterplan §2.2. This evidence PROMOTES
# chroma-core from the M0 auto-community seed to verified-publisher.
signals:
  prior_orchard_accelerator: false
  code_review: false
  founder_verified: true

contact_overlay: chroma-core.contact.local.md
---

# Trust Evidence — `chroma-core` (verified-publisher)

Chroma publishes the **official Chroma MCP server** (`chroma-mcp`) — collection
management plus semantic / full-text / metadata search over the Chroma embedding
database. Chroma is a known third-party vendor outside the FrootAI/Microsoft
operational boundary — trusted enough to attach silently, but its destructive
tools still confirm per-call (`attachWithoutPrompt: true`,
`allowDestructive: false`, metering `per-publisher`).

## Publisher identity

- **GitHub org/owner**: `github.com/chroma-core` (real org, public presence at
  trychroma.com).
- **Manifest key**: `chroma-core` — matches the org exactly (doctrine #2).
- **Server repo**: `https://github.com/chroma-core/chroma-mcp` (Apache-2.0, "A
  Model Context Protocol (MCP) server implementation that provides database
  capabilities for Chroma").
- **Package**: `chroma-mcp` (PyPI, run via `uvx`).

## Promotion (M0 seed → verified-publisher)

`chroma-core` shipped in the M0 federation seed as `community`. This evidence
file PROMOTES it to `verified-publisher`: the catalog entry is the vendor's own
official MCP server published from `github.com/chroma-core`, which clears the
verified-publisher gate. Recorded in `mcp-trust-changelog.md`
(community → verified-publisher) per doctrine #8.

## Servers covered

| Catalog slug | Server | Category | Installs (seed) |
|---|---|---|---|
| `chroma-core/chroma-mcp` | Chroma MCP Server | docs-retrieval | 570 |

Chroma's server exposes collection + document tools, **including two destructive
tools** — `chroma_delete_collection` and `chroma_delete_documents` — declared in
the spec `destructive_tools`. The tier policy keeps `allowDestructive: false`, so
each delete prompts per call even though Chroma attaches silently.

## Prior Orchard accelerator

`signals.prior_orchard_accelerator: false` — no shipped Orchard solution-play
attaches Chroma today (verified: no `chroma` area in
`frootai/solution-plays/*/agent.md`). A natural future fit for the agentic-RAG /
long-term-memory plays alongside Qdrant, Firecrawl, Tavily, and Context7.

## Code-review notes

`signals.code_review: false` — no standalone source review on file.

## Founder-verified  — SIGNAL (controlling)

`signals.founder_verified: true`. The server is the **official** Chroma MCP
server, published from Chroma's **own verified org** `chroma-core` (not a
third-party wrapper or fork). Chroma is rostered as a `verified-publisher`
candidate in masterplan §2.2. The authenticity signal — official vendor server
from the vendor's own verified org — clears the `verified-publisher` gate
(criteria §4.2). Popularity is ranking context only.

## Maintenance

Active. Maintained by Chroma as its official integration surface (latest release
v0.2.6, Aug 2025).

## Contact — PRIVATE (doctrine #3)

Raw incident-response contact lives only in the gitignored sidecar
`chroma-core.contact.local.md`. The committed file records no PII.

- **Contact overlay present locally**: _no (populate when needed)_
- **Last reachable**: 2026-06-25 (date only)

## Decision

**PASS — `verified-publisher`.** Exact identity match (`chroma-core` ===
`github.com/chroma-core`), official vendor server from its own verified org,
founder-rostered verified-publisher (§2.2). Promoted from the M0 community seed.
Attaches without prompt; destructive delete tools still confirm per-call;
metering `per-publisher`.

<!--
  CHANGELOG NOTE: on any tier change, append to
  frootai/orchard/registry/mcp-trust-changelog.md ([X1.27]):
  (date, publisher, old_tier, new_tier, reason, reviewer)  — doctrine #8.
-->
