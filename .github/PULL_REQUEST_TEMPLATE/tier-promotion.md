---
name: Trust Tier Promotion (community → verified-publisher)
about: Promote an existing community-tier MCP publisher to verified-publisher
title: "tier-promotion: <publisher> → verified-publisher"
labels: ["tier-promotion", "verified-publisher", "needs-founder-review"]
assignees: ["pavle"]
---

<!--
  [X5.11] Tier-promotion PR template.
  Walkthrough: ../../frootai-core/docs/tier-promotion.md
  Eligibility criteria: ../../frootai-core/docs/internal/trust-assignment-criteria.md §4.2
  Auto-validator: .github/workflows/mcp-spec-pr.yml ([X5.8])
  Founder review SLA: 14 days from PR open ([X5.9]).
  Promotion is ALWAYS a separate PR from the original community spec.
-->

## 1. Publisher being promoted

**Publisher key**: `<publisher>` — must match the GitHub org exactly (doctrine #2).
**Currently in `trust.json` as**: `community`
**Original spec PR**: #<number> (must be merged + live in the marketplace).
**Specs this promotion covers**:
- `<slug-1>` — _one-line summary_
- `<slug-2>` — _(if the evidence file's `servers_covered` lists multiple)_

## 2. Substantive signals

> Per [`docs/internal/trust-assignment-criteria.md`](../../frootai-core/docs/internal/trust-assignment-criteria.md)
> §4.2, **at least one** of these signals must be substantive (not "tbd", not
> "see other section"). Tick the one(s) that apply; fill in the matching body.

- [ ] **prior_orchard_accelerator** — _name the solution-play / accelerator that
      already integrates this server_
- [ ] **code_review** — _commit SHA / release reviewed + the finding (link to a
      review note or maintainer comment)_
- [ ] **founder_verified** — _business relationship / known-good vendor context_

## 3. Evidence file

**Path**: `orchard/registry/mcp-trust-evidence/<publisher>.md`
**Filename matches publisher key**: `<yes | no — fix before submitting>`
**`last_reviewed`**: `<YYYY-MM-DD — today>`
**`contact_overlay`**: `<publisher>.contact.local.md` (gitignored sidecar; **PII
NEVER lives in the committed file** — doctrine #3).

## 4. Trust manifest recompose

```
cd frootai-core
node scripts/marketplace/compose-trust-manifest.mjs --write
node scripts/sync-trust-manifest.mjs --write
```

Output paste (the publisher's tier flip line):

```
- "<publisher>": "community",
+ "<publisher>": "verified-publisher",
```

## 5. Spec trust-field flip

```diff
- "trust": "community",
+ "trust": "verified-publisher",
```

Applied to: `frootai/orchard/registry/mcp-specs/<slug>.json`
(repeat per covered slug if the evidence file covers multiple).

## 6. Maintenance posture

- **Last upstream release/commit**: `<YYYY-MM-DD>` (must be within 180 days)
- **Next re-review due**: `<last_reviewed + 90 days>` (auto-tracked by the
  trust-review cadence; an issue auto-opens on the date — doctrine #4)
- **Maintainer reachable**: `<yes — via gitignored sidecar | no — block>`

## Pre-flight checklist

- [ ] Original community spec PR is merged and the spec is live in the marketplace.
- [ ] **At least one** positive signal is substantive (not "tbd").
- [ ] Evidence file passes the X1.24 frontmatter validator
      (`node scripts/marketplace/validators/validate-evidence.mjs --write`).
- [ ] `last_reviewed` is today's ISO date.
- [ ] `contact_overlay` references a gitignored `<publisher>.contact.local.md`
      AND the sidecar itself is NOT committed.
- [ ] `compose-trust-manifest.mjs --write` ran without errors.
- [ ] `sync-trust-manifest.mjs --write` ran without errors; the 3 copies are
      byte-identical.
- [ ] The spec's `trust` field flipped to `verified-publisher` and the spec
      still schema-validates.
- [ ] This PR is **separate** from any spec content change (no bundling).

## Author attestation

By opening this PR I confirm:
- I am the publisher OR a FrootAI maintainer acting on the publisher's behalf
  with their consent.
- The substantive-signal evidence above is true to the best of my knowledge.
- Promotion to `verified-publisher` means this server attaches **silently**
  (`attachWithoutPrompt: true`) in users' marketplaces. I have made the
  publisher aware of the elevated trust posture.
