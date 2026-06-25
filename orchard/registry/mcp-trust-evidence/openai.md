---
# MCP Trust Evidence — verified-publisher: OpenAI  ([X4.18])
# Standards: ../../../../frootai-core/docs/internal/trust-assignment-criteria.md

# GitHub org / manifest key (doctrine #2 — exact match).
publisher: openai

tier: verified-publisher

servers_covered:
  - openai/developer-docs-mcp

last_reviewed: 2026-06-25
reviewer: frootai-maintainer

# No Orchard accelerator attaches the OpenAI Docs MCP (signal #1 false). The
# controlling signal is founder-verified: `openai` was carried in the M0
# federation seed as verified-publisher (genesis row, [X1.19]); this file is the
# evidence BACKFILL for that elevated tier, occasioned by the X4.18 OpenAI Docs
# MCP spec. No tier change.
signals:
  prior_orchard_accelerator: false
  code_review: false
  founder_verified: true

contact_overlay: openai.contact.local.md
---

# Trust Evidence — `openai` (verified-publisher)

OpenAI hosts the **official OpenAI Developer Docs MCP server** at
`https://developers.openai.com/mcp` — read-only search + fetch over OpenAI's
developer documentation (API, ChatGPT Apps SDK, Codex). OpenAI is a known
third-party vendor outside the FrootAI/Microsoft operational boundary — trusted
enough to attach silently, but destructive tools still confirm per-call
(`attachWithoutPrompt: true`, `allowDestructive: false`, metering
`per-publisher`).

## Publisher identity

- **GitHub org/owner**: `github.com/openai` (verified org, public presence at
  openai.com / developers.openai.com).
- **Manifest key**: `openai` — matches the org exactly (doctrine #2).
- **Server**: the OpenAI-hosted developer-docs MCP endpoint
  `https://developers.openai.com/mcp` (streamable HTTP). OpenAI also publishes
  the official `@openai/codex` CLI (Apache-2.0) and the `openai` / `@openai/agents`
  SDKs from this org, all via the `openai-publisher` npm identity with sigstore
  provenance.

## Evidence backfill + scope note (no tier change)

`openai` shipped in the M0 federation seed as `verified-publisher` (one of the 7
elevated publishers carried forward pending evidence — genesis row). This file
provides that evidence; the tier is unchanged.

Masterplan §X4.18 framed the slot as "OpenAI direct integration". Verification
(2026-06-25) found OpenAI publishes **no general 'call-the-OpenAI-API' MCP
server** — the `openai-mcp*` packages on npm are all third-party wrappers.
OpenAI's official hosted MCP server is the read-only **developer-docs** server,
so that is the honest deliverable for the slot (parallels `ms-learn` for
Microsoft docs). Codex (`@openai/codex`) is OpenAI's other official MCP-capable
surface and may be specced separately later.

## Servers covered

| Catalog slug | Server | Category | Installs (seed) |
|---|---|---|---|
| `openai/developer-docs-mcp` | OpenAI Developer Docs MCP | docs-retrieval | — (hosted) |

The hosted server exposes read-only `search` / `fetch` documentation tools; it
exposes no destructive tools and does not call the OpenAI API on the user's
behalf. The tier policy keeps `allowDestructive: false`.

## Prior Orchard accelerator

`signals.prior_orchard_accelerator: false` — no shipped Orchard solution-play
attaches the OpenAI Docs MCP today (verified: no `openai` MCP area in
`frootai/solution-plays/*/agent.md`).

## Code-review notes

`signals.code_review: false` — no standalone source review on file (the docs
server is hosted by OpenAI; not a local package).

## Founder-verified  — SIGNAL (controlling)

`signals.founder_verified: true`. The server is **OpenAI's own hosted** developer
documentation MCP endpoint under OpenAI's verified org and domain
(developers.openai.com). The authenticity signal — official vendor server from
the vendor's own verified org/domain — clears the `verified-publisher` gate
(criteria §4.2).

## Maintenance

Active. Hosted and maintained by OpenAI as part of developers.openai.com.

## Contact — PRIVATE (doctrine #3)

Raw incident-response contact lives only in the gitignored sidecar
`openai.contact.local.md`. The committed file records no PII.

- **Contact overlay present locally**: _no (populate when needed)_
- **Last reachable**: 2026-06-25 (date only)

## Decision

**PASS — `verified-publisher`.** Exact identity match (`openai` ===
`github.com/openai`), official OpenAI-hosted docs MCP endpoint under OpenAI's own
verified domain; backfills the M0 seed tier (no tier change). Attaches without
prompt; destructive tools (none today) would still confirm per-call; metering
`per-publisher`.

<!--
  CHANGELOG NOTE: on any tier change, append to
  frootai/orchard/registry/mcp-trust-changelog.md ([X1.27]):
  (date, publisher, old_tier, new_tier, reason, reviewer)  — doctrine #8.
-->
