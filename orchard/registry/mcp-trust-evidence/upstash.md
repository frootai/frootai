---
# MCP Trust Evidence — verified-publisher: Upstash (Context7)  ([X1.5])
# Standards: ../../../../frootai-core/docs/internal/trust-assignment-criteria.md

# GitHub org / manifest key (doctrine #2 — exact match).
publisher: upstash

tier: verified-publisher

servers_covered:
  - upstash/context7

last_reviewed: 2026-06-25
reviewer: frootai-maintainer

# verified-publisher requires ≥1 substantive positive signal. Signal #1
# (prior Orchard accelerator) is the controlling justification here.
signals:
  prior_orchard_accelerator: true
  code_review: false
  founder_verified: false

contact_overlay: upstash.contact.local.md
---

# Trust Evidence — `upstash` (verified-publisher)

Upstash publishes **Context7**, the library-docs grounding server. Upstash is a
known third-party vendor outside the FrootAI/Microsoft operational boundary —
trusted enough to attach silently, but **not** to run destructive tools without a
per-call prompt (`attachWithoutPrompt: true`, `allowDestructive: false`, metering
`per-publisher`).

## Publisher identity

- **GitHub org/owner**: `github.com/upstash` (real org, public presence at
  upstash.com).
- **Manifest key**: `upstash` — matches the org exactly (doctrine #2).
- **Server repo**: `https://github.com/upstash/context7`.

## Servers covered

| Catalog slug | Server | Category | Installs (seed) |
|---|---|---|---|
| `upstash/context7` | Context7 (library-docs grounding) | docs-retrieval | 57,351 |

Context7 is read-oriented (fetches fresh library documentation for grounding);
it exposes no destructive tools. Even so, the tier policy keeps
`allowDestructive: false` so that any future destructive tool would still prompt.

## Prior Orchard accelerator  — SIGNAL #1 (controlling)

`signals.prior_orchard_accelerator: true`. Context7 is already a load-bearing,
attached area in shipped Orchard solution-plays:

- `frootai/solution-plays/21-agentic-rag/agent.md` — `attached: ["azure", "context7"]`
- `frootai/solution-plays/51-autonomous-coding-agent/agent.md` — `attached: ["github", "context7"]`

It is documented as a `verified-publisher` area in the attach cookbook
(`frootai/cookbook/19-attach-mcp-to-agent.md`) and exercised in the mcp_scope
authoring walkthrough (`frootai/cookbook/20-author-play-with-mcp-scope.md`).
This pre-existing Orchard integration is the documented positive signal that
clears the `verified-publisher` gate (criteria §4.2).

## Code-review notes

`signals.code_review: false` — no standalone source review on file. Not required:
signal #1 (Orchard accelerator) already clears the gate. A `tools/list` snapshot
+ attach spec validation lands in Phase X2.

## Founder-verified

`signals.founder_verified: false` — no separate business-relationship
attestation; trust rests on the Orchard-integration signal above.

## Maintenance

Active. Context7 is widely deployed (57k+ installs in the seed) and maintained by
Upstash. (The seed crawl did not capture a `last_commit_at`; refresh on the next
weekly crawl.)

## Contact — PRIVATE (doctrine #3)

Raw incident-response contact lives only in the gitignored sidecar
`upstash.contact.local.md`. The committed file records no PII.

- **Contact overlay present locally**: _no (populate when needed)_
- **Last reachable**: 2026-06-25 (date only)

## Decision

**PASS — `verified-publisher`.** Exact identity match (`upstash` ===
`github.com/upstash`), one substantive positive signal (Context7 is an attached
area in shipped Orchard solution-plays 21 + 51), real org with public presence,
actively deployed. Attaches without prompt; destructive tools still confirm
per-call; metering `per-publisher`.

<!--
  CHANGELOG NOTE: on any tier change, append to
  frootai/orchard/registry/mcp-trust-changelog.md ([X1.27]):
  (date, publisher, old_tier, new_tier, reason, reviewer)  — doctrine #8.
-->
