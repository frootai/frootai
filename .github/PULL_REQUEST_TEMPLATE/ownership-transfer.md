---
name: MCP Spec Ownership Transfer
about: Hand off maintenance of an MCP spec to a new author
title: "ownership-transfer: <slug> — @<original-author> → @<new-maintainer>"
labels: ["ownership-transfer", "needs-founder-review", "needs-original-author-attest"]
assignees: ["pavle"]
---

<!--
  [X5.24] Spec ownership transfer PR template.
  Walkthrough: ../../frootai-core/docs/ownership-transfer.md
  Auto-validator: .github/workflows/mcp-spec-pr.yml ([X5.8])
  Founder review SLA: 14 days from PR open ([X5.9]).
  Ownership transfer is ALWAYS a separate PR — never bundled with a spec
  content change OR a tier promotion ([X5.11]).
-->

## 1. Spec being transferred

**Slug**: `<slug>`
**Current spec path**: `orchard/registry/mcp-specs/<slug>.json` (or `mcp-specs/auto/<slug>.json`)
**Publisher**: `<publisher>` (unchanged by this PR — see § 6 if the new maintainer is not an existing publisher insider)
**Current trust tier**: `<community | verified-publisher | first-party-ms>`

## 2. Parties

**Original author** (the current `reviewer` field): `@<original-author>`
**New maintainer**: `@<new-maintainer>`
**GitHub org / publisher**: must equal `publisher` exactly per doctrine #2.

## 3. Reason for transfer

> One short paragraph. Examples: original maintainer moved on, employer
> change, publisher acquired by a different org, single-maintainer burnout,
> handoff to a more active contributor.

## 4. Spec diff (`reviewer` field flip)

```diff
- "reviewer": "<original-author>",
+ "reviewer": "<new-maintainer>",
```

> Optional: bump `last_reviewed` to today's ISO date if you've re-checked
> the spec against the live server. Do **not** bump `version_pin.tested_version`
> in the same PR — capture a fresh snapshot in a separate PR after the
> transfer lands.

## 5. Evidence file update (Tier-2 only)

If the trust tier is `verified-publisher`, the evidence file at
`orchard/registry/mcp-trust-evidence/<publisher>.md` must reflect the new
maintainer. Otherwise skip this section.

```diff
- reviewer: <original-author>
+ reviewer: <new-maintainer>
```

Plus the `last_reviewed` ISO date in the YAML frontmatter, and a new entry
in the publisher's `prior_reviewers` body section (append; don't replace).

## 6. New-maintainer-is-an-insider check

> Per the [X5.13] sock-puppet guard, the new maintainer needs to be a
> publisher insider OR have insider attestation. Tick the path that applies:

- [ ] **New maintainer's login equals the publisher key** (e.g. transferring
      `playwright` → `@playwright`).
- [ ] **New maintainer is already a `reviewer` on a sibling spec** (cite the
      sibling slug: `<sibling-slug>`).
- [ ] **An insider has posted `/coauthor-attest <publisher>` on this PR**
      from a known-good account (cite the comment URL).

## 7. Attestations

Both parties must attest on this PR by editing this section in-place:

### Original-author attestation

> By keeping this section signed, I confirm I currently maintain `<slug>`
> (the `reviewer` field is me OR I am the publisher's authoritative
> representative) and I authorise transferring maintenance to
> @<new-maintainer>. I understand the spec stays on my account's git
> history but the marketplace UI will route enquiries to the new maintainer.

`Signed: @<original-author>` _<!-- replace with your handle when ready -->_

### New-maintainer attestation

> By keeping this section signed, I accept maintenance of `<slug>`. I have
> read [`docs/contributing-mcp-specs.md`](../../frootai-core/docs/contributing-mcp-specs.md)
> ([X5.2]) and understand the 14-day [X5.9] review SLA on community PRs
> against this spec. If the spec is `verified-publisher` tier, I also accept
> the 90-day re-review cadence (doctrine #4).

`Signed: @<new-maintainer>` _<!-- replace with your handle when ready -->_

## Pre-flight checklist

- [ ] PR title matches `ownership-transfer: <slug> — @old → @new`.
- [ ] Only the `reviewer` field (+ optional `last_reviewed`, evidence file
      reviewer) changed — no transport / env-vars / sample-tools edits in
      this PR (those go in a separate maintenance PR after transfer).
- [ ] Insider-check section (§6) has at least one box ticked OR an
      attest-comment URL cited.
- [ ] Both parties have signed §7 with their actual `@handle`.
- [ ] If `verified-publisher`, the evidence file's frontmatter `reviewer`
      and the body's `prior_reviewers` section are both updated.

## Author attestation

By opening this PR I confirm:

- I am one of the two parties named in §2 (or a FrootAI maintainer acting
  with the publisher's explicit consent).
- The reason in §3 is true to the best of my knowledge.
- I will not merge this PR myself — founder review is the gate.
