---
name: MCP Spec Contribution
about: Contribute a new MCP server attach spec to the FrootAI marketplace
title: "mcp-spec: <slug> — <one-line summary>"
labels: ["mcp-spec", "community", "needs-founder-review"]
assignees: ["pavle"]
---

<!--
  [X5.1] Community MCP spec PR template.
  Format ref: orchard/registry/mcp-specs/README.md
  Authoring guide: docs/contributing-mcp-specs.md  ([X5.2], frootai-core)
  Auto-validator: .github/workflows/mcp-spec-pr.yml  ([X5.8], frootai-core)
  Founder review SLA: 14 days from PR open ([X5.9]).
  Default trust tier for community contributions: `community`.
-->

## 1. Publisher

**GitHub org / namespace**: `<github-org-or-reverse-dns>`
**Publisher key** (lowercase, kebab-case — `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`): `<publisher>`
**Already in [`trust.json`](../../frootai-core/npm-mcp/src/federation/trust.json)?** `<yes | no — needs trust entry>`

> Community contributions default to **`trust: "community"`**. Promotion to
> `verified-publisher` requires a separate PR with a trust-evidence file under
> [`orchard/registry/mcp-trust-evidence/<publisher>.md`](../../orchard/registry/mcp-trust-evidence/)
> and a founder approval comment ([X5.11] / [X5.12]).

## 2. Spec

**Slug** (lowercase, `slug === filename === tool_prefix`): `<slug>`
**Title** (human-readable): `<Title>`
**Description** (one paragraph, no marketing): `<what the server actually does>`
**Server repo URL**: `https://github.com/<org>/<repo>`
**Package + version pin**:
- `version_pin.package`: `<npm-or-pypi-package | null (hosted)>`
- `version_pin.version_range`: `<>=X.Y.Z <X+1.0.0 | "hosted">`
- `version_pin.tested_version`: `<X.Y.Z>` (semver; for hosted, an ISO date like `2026-06-25`)

**Transport** (pick one):
- [ ] `stdio-subprocess` — `command`/`args`/`env_passthrough` (no `=` characters in `args` — doctrine #6)
- [ ] `http-sse` — hosted endpoint `url` (`command: null`, `args: []`)

## 3. Environment variables

> One row per env var. Pass credentials via `env_passthrough`, **never** inline in `args` (doctrine #6).

| Name | Required | Auth mode | Description |
|---|---|---|---|
| `<ENV_NAME>` | yes / no | `api-key` / `oauth-token` / `pat` / `any` / `none` | `<short purpose, no PII>` |

## 4. Sample tools

> The curated set surfaced in the marketplace UI (`tool_prefix.<name>`). ≥1 sample.
> Each entry must match the live `tools/list` exactly (the snapshot proves it).

| Name | Summary |
|---|---|
| `<tool_name>` | `<one-line description>` |

**Destructive tools declared** (per X2.18 audit pattern — `delete` / `remove` / `destroy` / `purge` / `drop` / `revoke` / `terminate` / `kill` / `force-push` / `uninstall` / `deprovision` / `overwrite` / `wipe`):

- `<destructive_tool>` (or **none — audited read-only**)

## 5. License

**License**: `<SPDX id — MIT / Apache-2.0 / BSD-2-Clause / BSD-3-Clause / ISC / 0BSD / CC0-1.0>`

> Permissive floor — non-permissive licenses (GPL, AGPL, SSPL, custom) are
> handled case-by-case by founder review.

## 6. Contact for incident response

**Incident-response contact** (committed in the spec metadata, no raw PII):

- **Type**: `<email | github-issues | github-security-advisory | discord | other>`
- **Public handle / URL** (no raw email; redact at `name@domain` → `redacted (github-security-advisory)`): `<redacted-handle-or-URL>`

> Raw contact PII (email/phone) lives **only** in the gitignored
> `mcp-trust-evidence/<publisher>.contact.local.md` overlay (doctrine #3). The
> public spec records only how to **reach** the contact, never the contact itself.

## Pre-flight checklist

> The X5.8 PR-triage workflow runs the full validator on every push. Check yourself first to save a review round-trip.

- [ ] `publisher` is in [`trust.json`](../../frootai-core/npm-mcp/src/federation/trust.json) `knownPublishers` at the declared `trust` tier (doctrine #2 — no silent attach)
- [ ] `slug === filename === tool_prefix`, all lowercase kebab-case (doctrine #5)
- [ ] `transport.args` contains **no** `=` characters; credentials flow through `env_passthrough` (doctrine #6)
- [ ] `spec_version` is `"1.0.0"`; `last_reviewed` is an ISO date `YYYY-MM-DD`
- [ ] `version_pin.tested_version` is inside `version_pin.version_range` (or `version_range === "hosted"`)
- [ ] `env_vars` table is exhaustive — every var the server reads is listed
- [ ] `sample_tools` matches the live `tools/list` (the snapshot will prove it)
- [ ] Every `destructive_tool` matches a destructive verb pattern (X2.18); `known_limitations` includes the canonical `Destructive-action audit (X2.18): …` line
- [ ] `auth.recipe` is a single sentence + `auth.modes` is a non-empty array
- [ ] License is in the permissive floor (or flagged for founder review)
- [ ] Incident contact is set (no raw PII; doctrine #3)
- [ ] PR is `< 100` files (large PRs get a warning; founder may ask to split)

## What the PR validator checks ([X5.8] — frootai-core)

The workflow runs on every push touching `orchard/registry/mcp-specs/`:

1. **Schema** — `mcp-spec-v1.schema.json` (Ajv + jsonschema, both runtimes).
2. **Shape** — `slug === filename === tool_prefix`, kebab-case (`spec-fields.js`).
3. **Trust** — `publisher` resolves to `trust.json` at the declared tier, byte-identical across the 3 federation copies.
4. **Doctrine #6** — `transport.args` contains no `=` (env passthrough only).
5. **version_pin** — semver comparators + `tested_version` parses; hosted variant accepts an ISO date.
6. **Destructive audit** — declared tools each match a pattern; sample tools matching a pattern must be declared (`destructive-audit.js`).
7. **Limitations** — ≥1 substantive line + the X2.18 audit META line (`spec-limitations.js`).
8. **Snapshot** — committed `mcp-specs-snapshots/<slug>.json` exists and matches `sample_tools` (or the live `tools/list` if `FAI_SNAPSHOT_LIVE=1`).
9. **Bundle budget** — adding the spec keeps the offline bundle ≤ 200 KB gzipped ([X4.26]).

The validator posts a single comment with the full result on every push. Errors block merge; warnings are non-blocking.

## Founder review SLA

**14 days from PR open to first response** ([X5.9] — frootai-core). If you haven't heard back by then, ping `@pavle` on this PR.

## Author attestation

- [ ] I am the publisher OR have been authorized by them to submit this spec.
- [ ] I have run the validator locally (`node scripts/marketplace/run-marketplace-tests.js` in `frootai-core/` is green for this slug).
- [ ] I understand this spec defaults to `trust: "community"` — promotion is a separate PR with evidence.

---

_Thank you for contributing — every well-formed spec makes the marketplace more useful for the next 100 attaches. 🌳_
