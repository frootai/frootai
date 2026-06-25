# MCP Trust Changelog

> **Audit trail for every change to the federation `trust.json` manifest.**
> Authored at Phase `[X1.27]` of the
> [Marketplace + Trust masterplan](../../../../frootai-planning/planning/fai-mcp-expansion/02-marketplace-and-trust-masterplan.md).
> **Doctrine #8 — NEVER FORGET PROVENANCE.** Every promotion, demotion, or
> reclassification of a publisher's trust tier is recorded here, so a CIO can
> read exactly why any publisher holds the tier it holds.

Each row records `(date, publisher, old_tier, new_tier, reason, reviewer)`.
`old_tier`/`new_tier` use `—` for "not present". Append a row in the same change
that edits an evidence file + re-composes `trust.json` ([X1.19] / [X1.21]).

| Date | Publisher | Old tier | New tier | Reason | Reviewer |
|---|---|---|---|---|---|
| 2026-06-25 | `openai` | verified-publisher | verified-publisher | Evidence BACKFILL (no tier change): added evidence file for `openai`, occasioned by the X4.18 OpenAI Developer Docs MCP spec (developers.openai.com/mcp). Resolves one of the 7 M0-seed elevated publishers carried forward pending evidence. | frootai-maintainer |
| 2026-06-25 | `pinecone-io` | — | verified-publisher | Added evidence for the official Pinecone Developer MCP server (`pinecone-io/pinecone-mcp`, Apache-2.0, npm sigstore provenance) under Pinecone's own verified org; Tier-2 catalog expansion (X4.17, re-targeted from the lancedb slot — LanceDB ships no official server). | frootai-maintainer |
| 2026-06-25 | `chroma-core` | community | verified-publisher | Promoted: added evidence for the official Chroma MCP server (`chroma-core/chroma-mcp`, Apache-2.0) under Chroma's own verified org; Tier-2 catalog expansion (X4.16). | frootai-maintainer |
| 2026-06-25 | `qdrant` | — | verified-publisher | Added evidence file for the official Qdrant MCP server (`qdrant/mcp-server-qdrant`, Apache-2.0) under Qdrant's own verified org; Tier-2 catalog expansion (X4.15). | frootai-maintainer |
| 2026-06-25 | `(genesis)` | — | — | Initial v1 manifest composed: 15 evidence files (6 first-party-ms + 21 verified-publisher incl. covers_orgs aliases) + 63 auto-community + 0 untrusted = 90 publishers ([X1.19]). Preserves the M0 federation seed; 7 elevated M0 publishers (chromedevtools, docker, firecrawl, getsentry, neondatabase, openai, sveltejs) carried forward pending evidence backfill. | frootai-maintainer |

<!--
  HOW TO APPEND (per change):
  1. Edit the evidence file(s) under mcp-trust-evidence/ and/or bump a tier.
  2. Re-compose:  node scripts/marketplace/compose-trust-manifest.mjs --write
  3. Re-sync:     node scripts/marketplace/sync-trust-manifest.mjs --write
  4. Add one row above per (publisher, old_tier → new_tier) with a reason + reviewer.
  The marketplace-trust-drift CI ([X1.21]) keeps the manifest in lock-step with
  the evidence; this changelog is the human-readable why.
-->

---

## Review passes

A review pass certifies that, at a point in time, every elevated tier is backed
by a valid evidence file and the manifest + mirrors are consistent. It is the
sign-off recorded for a `trust-vX.Y.Z` tag (doctrine #4 + #8).

### `trust-v1.0.0` — v1 review pass ([X1.29])

- **Date**: 2026-06-25
- **Scope**: 15 evidence files covering 19 publisher identities (incl.
  `covers_orgs` aliases); 90 total `knownPublishers`
  (6 first-party-ms · 21 verified-publisher · 63 community · 0 untrusted).
- **Verification** (all green):
  - Evidence frontmatter validator + per-publisher round-trip — 13/13.
  - Compose-consistency — canonical `trust.json` matches the evidence.
  - 3-way byte-identity — npm + python + CDN identical (sha256 `a311112072443962…`).
  - Evidence snapshot — fresh (19 keys), redacted (no contact PII).
  - Marketplace doctrine pillar — 3 pass · 1 partial · 4 skip · 0 fail.
  - Full marketplace test suite — 372 pass / 0 fail across 28 suites.
- **Sign-off**: review pass authorised by the founder at `[X1.29]`.
- **Tag**: `trust-v1.0.0` — **ready to cut** at the merge commit (the git tag +
  merge to `main` are applied at commit time, not by the build agent).
- **Carry-forward**: 7 M0-seed publishers (`chromedevtools`, `docker`,
  `firecrawl`, `getsentry`, `neondatabase`, `openai`, `sveltejs`) remain
  `verified-publisher` without a dedicated evidence file — preserved from the M0
  federation seed, pending evidence backfill. Doctrine checks `#1`/`#2`/`#4`
  read a future `mcp-trust-manifest.json` + catalog `trust_tier` and therefore
  still SKIP against the federation `trust.json` used here — a reconciliation
  tracked for a later phase.
