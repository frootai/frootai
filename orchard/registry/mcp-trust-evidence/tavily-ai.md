---
# MCP Trust Evidence — verified-publisher: Tavily  ([X1.8])
# Standards: ../../../../frootai-core/docs/internal/trust-assignment-criteria.md

# GitHub org / manifest key (doctrine #2 — exact match).
publisher: tavily-ai

tier: verified-publisher

servers_covered:
  - tavily-ai/tavily-mcp

last_reviewed: 2026-06-25
reviewer: frootai-maintainer

# No Orchard accelerator attaches Tavily (signal #1 false). The controlling
# signal is founder-verified: the OFFICIAL Tavily server from its own verified
# org, rostered verified-publisher in masterplan §2.2.
signals:
  prior_orchard_accelerator: false
  code_review: false
  founder_verified: true

contact_overlay: tavily-ai.contact.local.md
---

# Trust Evidence — `tavily-ai` (verified-publisher)

Tavily publishes the **official Tavily MCP server** (web search + retrieval for
grounding). Tavily is a known third-party vendor outside the FrootAI/Microsoft
operational boundary — trusted enough to attach silently, but destructive tools
still confirm per-call (`attachWithoutPrompt: true`, `allowDestructive: false`,
metering `per-publisher`).

## Publisher identity

- **GitHub org/owner**: `github.com/tavily-ai` (real org, public presence at
  tavily.com).
- **Manifest key**: `tavily-ai` — matches the org exactly (doctrine #2).
- **Server repo**: `https://github.com/tavily-ai/tavily-mcp`.

## Servers covered

| Catalog slug | Server | Category | Installs (seed) |
|---|---|---|---|
| `tavily-ai/tavily-mcp` | Tavily MCP Server | docs-retrieval | 2,102 |

Tavily's server is read-oriented (search/extract for grounding); it exposes no
destructive tools. The tier policy still keeps `allowDestructive: false` so any
future destructive tool would prompt.

## Prior Orchard accelerator

`signals.prior_orchard_accelerator: false` — no shipped Orchard solution-play
attaches Tavily today (verified: no `tavily` area in
`frootai/solution-plays/*/agent.md`). A natural future fit for the
docs-retrieval / agentic-RAG plays alongside Context7.

## Code-review notes

`signals.code_review: false` — no standalone source review on file.

## Founder-verified  — SIGNAL (controlling)

`signals.founder_verified: true`. The server is the **official** Tavily MCP
server, published from Tavily's **own verified org** `tavily-ai` (not a
third-party wrapper or fork). Tavily is rostered as an initial
`verified-publisher` in masterplan §2.2. The authenticity signal — official
vendor server from the vendor's own verified org — clears the
`verified-publisher` gate (criteria §4.2). Popularity (2.1k installs) is ranking
context only.

## Maintenance

Active. Maintained by Tavily as its official integration surface.

## Contact — PRIVATE (doctrine #3)

Raw incident-response contact lives only in the gitignored sidecar
`tavily-ai.contact.local.md`. The committed file records no PII.

- **Contact overlay present locally**: _no (populate when needed)_
- **Last reachable**: 2026-06-25 (date only)

## Decision

**PASS — `verified-publisher`.** Exact identity match (`tavily-ai` ===
`github.com/tavily-ai`), official vendor server from its own verified org,
founder-rostered verified-publisher (§2.2). Attaches without prompt; destructive
tools still confirm per-call; metering `per-publisher`.

<!--
  CHANGELOG NOTE: on any tier change, append to
  frootai/orchard/registry/mcp-trust-changelog.md ([X1.27]):
  (date, publisher, old_tier, new_tier, reason, reviewer)  — doctrine #8.
-->
