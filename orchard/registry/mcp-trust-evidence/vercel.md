---
# MCP Trust Evidence — verified-publisher: Vercel  ([X1.14])
# Standards: ../../../../frootai-core/docs/internal/trust-assignment-criteria.md

# GitHub org / manifest key (doctrine #2 — exact match).
publisher: vercel

tier: verified-publisher

# Vercel has TWO catalog entries: one from its GitHub org and one from the
# official MCP registry under the reverse-DNS namespace com.vercel. Both are
# Vercel-operated and covered by this single evidence file.
servers_covered:
  - vercel/next-devtools-mcp
  - com.vercel/vercel-mcp

last_reviewed: 2026-06-25
reviewer: frootai-maintainer

# No Orchard accelerator attaches Vercel (signal #1 false). The controlling
# signal is founder-verified: the OFFICIAL Vercel servers from its own verified
# org / namespace, rostered verified-publisher in masterplan §2.2.
signals:
  prior_orchard_accelerator: false
  code_review: false
  founder_verified: true

contact_overlay: vercel.contact.local.md
---

# Trust Evidence — `vercel` (verified-publisher)

Vercel publishes its **official MCP servers** (Next.js devtools + the Vercel
platform server). Vercel is a known vendor outside the FrootAI/Microsoft
operational boundary — trusted enough to attach silently, but destructive tools
(e.g. deployment/project changes) still confirm per-call
(`attachWithoutPrompt: true`, `allowDestructive: false`, metering
`per-publisher`).

## Publisher identity

- **GitHub org/owner**: `github.com/vercel` (Vercel's official org, public
  presence at vercel.com).
- **Manifest key**: `vercel` — matches the org exactly (doctrine #2).
- **Catalog identity**: one entry resolves to the GitHub org
  (`vercel/next-devtools-mcp`); the other comes from the official MCP registry
  under the reverse-DNS namespace `com.vercel` (no `github_org` captured). Both
  are Vercel-operated.

## Servers covered

| Catalog slug | Server | Category | Installs (seed) |
|---|---|---|---|
| `vercel/next-devtools-mcp` | Next.js DevTools MCP Server | specialty | 765 |
| `com.vercel/vercel-mcp` | Vercel Platform MCP Server | specialty | 8 |

The Next.js devtools server is largely read/diagnostic; the platform server can
touch deployments/projects (destructive). The tier policy keeps
`allowDestructive: false`, so any such operation prompts per call even though
Vercel attaches silently.

## Prior Orchard accelerator

`signals.prior_orchard_accelerator: false` — no shipped Orchard solution-play
attaches Vercel today (verified: no `vercel` area in
`frootai/solution-plays/*/agent.md`).

## Code-review notes

`signals.code_review: false` — no standalone source review on file.

## Founder-verified  — SIGNAL (controlling)

`signals.founder_verified: true`. Both servers are **official** Vercel MCP
servers, published from Vercel's **own verified org** `vercel` and its own
`com.vercel` registry namespace (not third-party wrappers or forks). Vercel is
rostered as a round-2 `verified-publisher` in masterplan §2.2. The authenticity
signal — official vendor servers from the vendor's own org/namespace — clears the
`verified-publisher` gate (criteria §4.2). Popularity (765 + 8 installs) is
ranking context only.

## Maintenance

Active. Maintained by Vercel as its official integration surfaces.

## Contact — PRIVATE (doctrine #3)

Raw incident-response contact lives only in the gitignored sidecar
`vercel.contact.local.md`. The committed file records no PII.

- **Contact overlay present locally**: _no (populate when needed)_
- **Last reachable**: 2026-06-25 (date only)

## Decision

**PASS — `verified-publisher`.** Two official Vercel servers from Vercel's own
verified org + `com.vercel` namespace; founder-rostered verified-publisher
(§2.2). Attaches without prompt; destructive deployment/project tools still
confirm per-call; metering `per-publisher`.

<!--
  CHANGELOG NOTE: on any tier change, append to
  frootai/orchard/registry/mcp-trust-changelog.md ([X1.27]):
  (date, publisher, old_tier, new_tier, reason, reviewer)  — doctrine #8.
-->
