# MCP Trust — Contact Sidecar TEMPLATE  ([X1.17])

> **This file is the committed SCHEMA for the per-publisher contact sidecar.**
> The real contact data lives in `<publisher>.contact.local.md`, which is
> **gitignored** (`orchard/registry/mcp-trust-evidence/*.contact.local.md`) and
> **never committed, never published**. Copy the frontmatter block below into
> `<publisher>.contact.local.md` and fill it in locally.
>
> Standards: [`trust-assignment-criteria.md` §9](../../../../frootai-core/docs/internal/trust-assignment-criteria.md).
> Doctrine #3 — NEVER LEAK PUBLISHER METADATA WITHOUT CONSENT.

## Why this is separate

Per-publisher contact exists **only for incident response** — to reach a
maintainer if their server is compromised or misbehaving. It is consent-scoped
PII and MUST NOT appear in:

- the committed `<publisher>.md` evidence file (which is public/CC0),
- the public CDN copy of the trust manifest,
- any published evidence mirror.

The committed evidence file records only a **last-reachable date** (not the
address) in its `Contact` section; the address itself lives here.

## Sidecar schema — copy to `<publisher>.contact.local.md`

```yaml
---
# Must match the evidence file's `publisher` field (and the manifest key).
publisher: example-org

# Primary incident-response email (a security/abuse alias is preferred over a
# personal address).
primary_contact_email: security@example.com

# GitHub handle of the maintainer/security contact (with the leading @).
github_handle: "@example-security"

# ISO date the contact was last confirmed reachable. This is the ONLY contact
# field mirrored (date-only) into the committed evidence file's Contact section.
last_reachable: 2026-06-25

# Fixed marker — this file exists for incident response only.
purpose: incident-response-only
---

# Contact — example-org (PRIVATE)

Free-form escalation notes (e.g. preferred channel, security.txt URL, PGP key
fingerprint). Never copy any of this into the committed evidence file.
```

## Required fields

| Field | Required | Notes |
|---|:--:|---|
| `publisher` | ✅ | Must equal the evidence file's `publisher` |
| `primary_contact_email` | ✅ | Incident-response alias preferred |
| `github_handle` | ✅ | With leading `@` |
| `last_reachable` | ✅ | ISO date; mirrored (date-only) to the evidence file |
| `purpose` | ✅ | Fixed: `incident-response-only` |

## First-party operators

For `first-party-ms` publishers (Microsoft, GitHub) the escalation path is the
vendor's own security-response process (MSRC / GitHub Security). A local sidecar
is optional; the committed evidence file already records `Contact overlay
present locally: no` for those.

## Redaction backstop ([X1.18])

Even though the sidecar is gitignored, `scripts/marketplace/redact-evidence.mjs`
strips any of these fields from evidence content before public publication, and
doctrine check #3 (`no-leak-publisher-metadata`) fails CI if any contact key
reaches the public CDN mirror.
