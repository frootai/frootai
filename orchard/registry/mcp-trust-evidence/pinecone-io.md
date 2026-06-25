---
# MCP Trust Evidence — verified-publisher: Pinecone  ([X4.17])
# Standards: ../../../../frootai-core/docs/internal/trust-assignment-criteria.md

# GitHub org / manifest key (doctrine #2 — exact match).
publisher: pinecone-io

tier: verified-publisher

servers_covered:
  - pinecone-io/pinecone-mcp

last_reviewed: 2026-06-25
reviewer: frootai-maintainer

# No Orchard accelerator attaches Pinecone (signal #1 false). The controlling
# signal is founder-verified: the OFFICIAL Pinecone Developer MCP server from its
# own verified org, with npm sigstore build provenance. Rostered into the X4
# verified-publisher set (re-targeted from the masterplan lancedb slot, which has
# no official server).
signals:
  prior_orchard_accelerator: false
  code_review: false
  founder_verified: true

contact_overlay: pinecone-io.contact.local.md
---

# Trust Evidence — `pinecone-io` (verified-publisher)

Pinecone publishes the **official Pinecone Developer MCP server** (`@pinecone-database/mcp`)
— index management plus records upsert / search / rerank with integrated
inference, and Pinecone documentation search. Pinecone is a known third-party
vendor outside the FrootAI/Microsoft operational boundary — trusted enough to
attach silently, but destructive tools still confirm per-call
(`attachWithoutPrompt: true`, `allowDestructive: false`, metering
`per-publisher`).

## Publisher identity

- **GitHub org/owner**: `github.com/pinecone-io` (real org, public presence at
  pinecone.io).
- **Manifest key**: `pinecone-io` — matches the org exactly (doctrine #2).
- **Server repo**: `https://github.com/pinecone-io/pinecone-mcp` (Apache-2.0,
  "Pinecone Developer MCP Server").
- **Package**: `@pinecone-database/mcp` (npm, run via `npx`), published by
  `pinecone-ops` with **npm sigstore build provenance** (GitHub Actions OIDC).

## Re-target note (lancedb → pinecone)

Masterplan §X4.17 originally slotted `lancedb`. Verification (2026-06-25) found
LanceDB publishes **no official MCP server** — only the `@lancedb/lancedb` SDK
and third-party community wrappers (`memory-lancedb-mcp`, `@cablate/memory-lancedb-mcp`).
Assigning `lancedb` verified-publisher for a server it does not ship would be
false provenance (doctrine #1/#2). The slot was re-targeted to Pinecone, whose
official server genuinely clears the gate. LanceDB may be revisited if it ships
an official server.

## Servers covered

| Catalog slug | Server | Category | Installs (seed) |
|---|---|---|---|
| `pinecone-io/pinecone-mcp` | Pinecone Developer MCP Server | docs-retrieval | 3,000 |

Pinecone's server exposes docs/index/record tools (list/describe/create/upsert/
search/rerank); it exposes no destructive tools (no index or record deletion).
The tier policy keeps `allowDestructive: false` so any future destructive tool
would prompt.

## Prior Orchard accelerator

`signals.prior_orchard_accelerator: false` — no shipped Orchard solution-play
attaches Pinecone today (verified: no `pinecone` area in
`frootai/solution-plays/*/agent.md`). A natural future fit for the agentic-RAG /
vector-memory plays alongside Qdrant, Chroma, Firecrawl, and Tavily.

## Code-review notes

`signals.code_review: false` — no standalone source review on file. Package
ships with npm sigstore provenance, which strengthens authenticity.

## Founder-verified  — SIGNAL (controlling)

`signals.founder_verified: true`. The server is the **official** Pinecone
Developer MCP server, published from Pinecone's **own verified org**
`pinecone-io` (not a third-party wrapper or fork), with cryptographic build
provenance. The authenticity signal — official vendor server from the vendor's
own verified org — clears the `verified-publisher` gate (criteria §4.2).
Popularity is ranking context only.

## Maintenance

Active. Maintained by Pinecone as its official developer integration surface
(latest release v0.2.1).

## Contact — PRIVATE (doctrine #3)

Raw incident-response contact lives only in the gitignored sidecar
`pinecone-io.contact.local.md`. The committed file records no PII.

- **Contact overlay present locally**: _no (populate when needed)_
- **Last reachable**: 2026-06-25 (date only)

## Decision

**PASS — `verified-publisher`.** Exact identity match (`pinecone-io` ===
`github.com/pinecone-io`), official vendor server from its own verified org with
sigstore provenance, founder-rostered into the X4 verified-publisher set.
Attaches without prompt; destructive tools (none today) would still confirm
per-call; metering `per-publisher`.

<!--
  CHANGELOG NOTE: on any tier change, append to
  frootai/orchard/registry/mcp-trust-changelog.md ([X1.27]):
  (date, publisher, old_tier, new_tier, reason, reviewer)  — doctrine #8.
-->
