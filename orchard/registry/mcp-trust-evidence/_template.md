---
# ─────────────────────────────────────────────────────────────────────────────
# MCP Trust Evidence — TEMPLATE  ([X1.2])
#
# Copy this file to `<publisher>.md` (filename === the `publisher` field below,
# === the GitHub org, === the `knownPublishers` key in trust.json — doctrine #2).
# Only `first-party-ms` and `verified-publisher` need an evidence file;
# `community` is auto-assigned and `untrusted` is auto-tagged.
#
# Standards: ../../../../frootai-core/docs/internal/trust-assignment-criteria.md
# Validated by the frontmatter validator at [X1.24].
# ─────────────────────────────────────────────────────────────────────────────

# Publisher identity — MUST match the GitHub org/owner exactly (doctrine #2).
publisher: example-org

# One of: first-party-ms | verified-publisher
tier: verified-publisher

# OPTIONAL — only for a first-party operator that runs MULTIPLE verified GitHub
# orgs under one operator identity (e.g. microsoft → microsoft/azure/microsoftdocs).
# List every org this one file evidences; the manifest maps each → the same tier,
# all justified here. Omit entirely for single-org publishers.
# covers_orgs:
#   - example-org
#   - example-org-secondary

# Catalog slugs (<owner>/<slug>) this evidence justifies. One file per publisher
# org; list every covered server here.
servers_covered:
  - example-org/example-server

# ISO date of the most recent human review. Drives the 90-day quarterly review
# cadence (doctrine #4 — an auto-issue opens 90 days after this date).
last_reviewed: 2026-01-01

# GitHub handle of the maintainer who authored/reviewed this evidence.
reviewer: your-github-handle

# Positive signals. For `verified-publisher`, AT LEAST ONE must be true and the
# matching body section below must be substantive (doctrine #1 — no promotion
# without evidence). For `first-party-ms`, the org-verification body section
# carries the justification instead.
signals:
  prior_orchard_accelerator: false
  code_review: false
  founder_verified: false

# Raw incident-response contact (email/phone/handle) is PRIVATE (doctrine #3).
# It NEVER lives inline in this committed file. It lives in the gitignored
# sidecar named here, kept local-only. The committed file references the sidecar
# but carries no PII.
contact_overlay: example-org.contact.local.md
---

# Trust Evidence — `example-org`

> Replace every _italic placeholder_ below. Delete guidance comments before
> committing. This file is **public/CC0** and reviewable in PRs — do not put any
> private contact PII in it (see § Contact).

## Publisher identity

- **GitHub org/owner**: `example-org` (verified badge: _yes/no_)
- **Manifest key**: `example-org` — must equal the org exactly (doctrine #2).
- **Public presence**: _link to the org's site / GitHub org page._

## Servers covered

| Catalog slug | Server | Notes |
|---|---|---|
| `example-org/example-server` | _Display name_ | _what it does_ |

## Prior Orchard accelerator

> Signal #1. Set `signals.prior_orchard_accelerator: true` if substantive.

_Name the accelerator/solution-play that already integrates this publisher
(e.g. `docs-retrieval-context7`), or write "none"._

## Code-review notes

> Signal #2. Set `signals.code_review: true` if substantive.

_What did a FrootAI maintainer review (commit SHA / release), and what was the
finding? Or write "none"._

## Founder-verified

> Signal #3. Set `signals.founder_verified: true` if substantive.

_Business relationship / known-good vendor context, or write "none"._

## Maintenance

- **Last release/commit**: _ISO date_ (must be within 180 days for
  `verified-publisher`; otherwise re-review before keeping the tier).

## Contact  — PRIVATE (doctrine #3)

> **Do not put emails/phones/handles here.** Raw incident-response contact lives
> ONLY in the gitignored sidecar `example-org.contact.local.md` (named in
> `contact_overlay` above), whose schema is defined in
> [`_contact-template.md`](./_contact-template.md): `primary_contact_email` +
> `github_handle` + `last_reachable`. That sidecar is never committed and never
> reaches a public copy. `redact-evidence.mjs` ([X1.18]) additionally strips any
> contact fields before public publication.

- **Contact overlay present locally**: _yes/no_
- **Last reachable**: _ISO date_ (the date only — mirrored from the sidecar's
  `last_reachable`; never the address.)

## Decision

> The reviewer's tier justification — the sentence a CIO reads.

_e.g. "PASS — verified-publisher: exact identity match, Orchard accelerator
`docs-retrieval-context7` integrates this publisher (signal #1), last release
within 30 days. Destructive tools still prompt per the tier policy."_

<!--
  CHANGELOG NOTE: when this file's tier changes, also append a row to
  frootai/orchard/registry/mcp-trust-changelog.md ([X1.27]):
  (date, publisher, old_tier, new_tier, reason, reviewer)  — doctrine #8.
-->
