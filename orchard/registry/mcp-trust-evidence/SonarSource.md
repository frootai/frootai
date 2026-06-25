---
# MCP Trust Evidence — verified-publisher: SonarSource  ([X1.13])
# Standards: ../../../../frootai-core/docs/internal/trust-assignment-criteria.md

# GitHub org / manifest key (doctrine #2 — EXACT match, including casing).
# NOTE: the M0 federation trust.json seeded this key lowercased as `sonarsource`;
# the catalog org is `SonarSource`. Doctrine #2 requires exact-case match → the
# canonical key is `SonarSource`. X1.19 (manifest compose) must canonicalize the
# lowercase M0 key to `SonarSource`.
publisher: SonarSource

tier: verified-publisher

servers_covered:
  - SonarSource/sonarqube-mcp-server

last_reviewed: 2026-06-25
reviewer: frootai-maintainer

# No Orchard accelerator attaches SonarSource (signal #1 false). The controlling
# signal is founder-verified: the OFFICIAL SonarQube server from its own verified
# org, rostered verified-publisher in masterplan §2.2.
signals:
  prior_orchard_accelerator: false
  code_review: false
  founder_verified: true

contact_overlay: SonarSource.contact.local.md
---

# Trust Evidence — `SonarSource` (verified-publisher)

SonarSource publishes the **official SonarQube MCP server** (code quality +
static analysis). SonarSource is a known vendor outside the FrootAI/Microsoft
operational boundary — trusted enough to attach silently, but destructive tools
still confirm per-call (`attachWithoutPrompt: true`, `allowDestructive: false`,
metering `per-publisher`).

## Publisher identity

- **GitHub org/owner**: `github.com/SonarSource` (SonarSource's official org,
  public presence at sonarsource.com).
- **Manifest key**: `SonarSource` — matches the org exactly, **including
  casing** (doctrine #2). The M0 trust.json seed used a lowercased
  `sonarsource`; that is a casing drift reconciled to `SonarSource` at `[X1.19]`.
- **Server repo**: `https://github.com/SonarSource/sonarqube-mcp-server`.

## Servers covered

| Catalog slug | Server | Category | Installs (seed) |
|---|---|---|---|
| `SonarSource/sonarqube-mcp-server` | SonarQube MCP Server | dev-tooling | 573 |

The server surfaces code-quality findings and project analysis (largely
read-oriented). The tier policy keeps `allowDestructive: false` so any
project-mutating tool would prompt per call.

## Prior Orchard accelerator

`signals.prior_orchard_accelerator: false` — no shipped Orchard solution-play
attaches SonarSource today (verified: no `sonarsource`/`sonarqube` area in
`frootai/solution-plays/*/agent.md`).

## Code-review notes

`signals.code_review: false` — no standalone source review on file.

## Founder-verified  — SIGNAL (controlling)

`signals.founder_verified: true`. The server is the **official** SonarQube MCP
server, published from SonarSource's **own verified org** `SonarSource` (not a
third-party wrapper or fork). SonarSource is rostered as an initial
`verified-publisher` in masterplan §2.2. The authenticity signal — official
vendor server from the vendor's own verified org — clears the
`verified-publisher` gate (criteria §4.2). Popularity (573 installs) is ranking
context only.

## Maintenance

Active. Maintained by SonarSource as its official integration surface.

## Contact — PRIVATE (doctrine #3)

Raw incident-response contact lives only in the gitignored sidecar
`SonarSource.contact.local.md`. The committed file records no PII.

- **Contact overlay present locally**: _no (populate when needed)_
- **Last reachable**: 2026-06-25 (date only)

## Decision

**PASS — `verified-publisher`.** Exact identity match (`SonarSource` ===
`github.com/SonarSource`), official vendor server from its own verified org,
founder-rostered verified-publisher (§2.2). Attaches without prompt; destructive
tools still confirm per-call; metering `per-publisher`.

<!--
  CHANGELOG NOTE: on any tier change, append to
  frootai/orchard/registry/mcp-trust-changelog.md ([X1.27]):
  (date, publisher, old_tier, new_tier, reason, reviewer)  — doctrine #8.
-->
