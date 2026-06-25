---
# MCP Trust Evidence — verified-publisher: MongoDB  ([X1.9])
# Standards: ../../../../frootai-core/docs/internal/trust-assignment-criteria.md

# GitHub org / manifest key (doctrine #2 — exact match).
publisher: mongodb-js

tier: verified-publisher

servers_covered:
  - mongodb-js/mongodb-mcp-server

last_reviewed: 2026-06-25
reviewer: frootai-maintainer

# No Orchard accelerator attaches MongoDB (signal #1 false). The controlling
# signal is founder-verified: the OFFICIAL MongoDB server from its own verified
# org, rostered verified-publisher in masterplan §2.2.
signals:
  prior_orchard_accelerator: false
  code_review: false
  founder_verified: true

contact_overlay: mongodb-js.contact.local.md
---

# Trust Evidence — `mongodb-js` (verified-publisher)

MongoDB publishes the **official MongoDB MCP server** (database query +
administration). MongoDB is a known vendor outside the FrootAI/Microsoft
operational boundary — trusted enough to attach silently, but its destructive
data tools **always** confirm per-call (`attachWithoutPrompt: true`,
`allowDestructive: false`, metering `per-publisher`).

## Publisher identity

- **GitHub org/owner**: `github.com/mongodb-js` (MongoDB's official JavaScript /
  tooling org, public presence at mongodb.com).
- **Manifest key**: `mongodb-js` — matches the org exactly (doctrine #2).
- **Server repo**: `https://github.com/mongodb-js/mongodb-mcp-server`.

## Servers covered

| Catalog slug | Server | Category | Installs (seed) |
|---|---|---|---|
| `mongodb-js/mongodb-mcp-server` | MongoDB MCP Server | data-stores | 1,050 |

The server exposes query, insert, update, delete, and collection/index
administration — several of which are destructive. The tier policy keeps
`allowDestructive: false`, so each destructive operation (e.g. `dropCollection`,
`deleteMany`) prompts per call even though MongoDB attaches silently.

## Prior Orchard accelerator

`signals.prior_orchard_accelerator: false` — no shipped Orchard solution-play
attaches MongoDB. (Note: `mongodb` appears in the repo only as a connection-
string pattern in the secrets-scanner hook — `mongodb+srv://…` — unrelated to
trust classification.)

## Code-review notes

`signals.code_review: false` — no standalone source review on file.

## Founder-verified  — SIGNAL (controlling)

`signals.founder_verified: true`. The server is the **official** MongoDB MCP
server, published from MongoDB's **own verified org** `mongodb-js` (not a
third-party wrapper or fork). MongoDB is rostered as an initial
`verified-publisher` in masterplan §2.2. The authenticity signal — official
vendor server from the vendor's own verified org — clears the
`verified-publisher` gate (criteria §4.2). Popularity (1.05k installs) is
ranking context only.

## Maintenance

Active. Maintained by MongoDB as its official integration surface.

## Contact — PRIVATE (doctrine #3)

Raw incident-response contact lives only in the gitignored sidecar
`mongodb-js.contact.local.md`. The committed file records no PII.

- **Contact overlay present locally**: _no (populate when needed)_
- **Last reachable**: 2026-06-25 (date only)

## Decision

**PASS — `verified-publisher`.** Exact identity match (`mongodb-js` ===
`github.com/mongodb-js`), official vendor server from its own verified org,
founder-rostered verified-publisher (§2.2). Attaches without prompt; the
destructive data tools still confirm per-call; metering `per-publisher`.

<!--
  CHANGELOG NOTE: on any tier change, append to
  frootai/orchard/registry/mcp-trust-changelog.md ([X1.27]):
  (date, publisher, old_tier, new_tier, reason, reviewer)  — doctrine #8.
-->
