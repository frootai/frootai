---
name: MCP Spec Issue
about: Report a problem, request a promotion, or add a missing tool for an MCP spec
title: "[mcp-spec] <slug>: <one-line summary>"
labels: ["mcp-spec", "needs-triage"]
assignees: ["pavle"]
---

<!--
  [X5.25] Per-spec issue template — three use cases in one form.
  Walkthrough docs:
    - Community contribution flow: ../../frootai-core/docs/contributing-mcp-specs.md ([X5.2])
    - Tier promotion: ../../frootai-core/docs/tier-promotion.md ([X5.11])
    - Spec deprecation: ../../frootai-core/docs/spec-deprecation.md ([X5.23])
    - Ownership transfer: ../../frootai-core/docs/ownership-transfer.md ([X5.24])
  PR templates:
    - New spec: ./PULL_REQUEST_TEMPLATE/mcp-spec.md ([X5.1])
    - Tier promotion: ./PULL_REQUEST_TEMPLATE/tier-promotion.md ([X5.11])
    - Ownership transfer: ./PULL_REQUEST_TEMPLATE/ownership-transfer.md ([X5.24])
  Triage SLA: 14 days from issue open ([X5.9]).
-->

## Spec identity

**Slug**: `<slug>` (must match the filename of `orchard/registry/mcp-specs/<slug>.json` exactly)
**Publisher**: `<publisher>` (the `publisher` field in the spec — case-sensitive)
**Detail page**: https://frootai.dev/ecosystem/mcp/marketplace/<slug>

## Issue type

> Tick exactly **one** type. Each path has its own body section below — fill in
> only that section and delete the others before submitting.

- [ ] **Report breakage** — the spec doesn't attach, returns a stale `tools/list`, or otherwise fails the X4.19 nightly attach matrix.
- [ ] **Request promotion** — the spec's trust tier should go up (community → verified-publisher). See [X5.11] for the formal PR flow this issue precedes.
- [ ] **Add tool to snapshot** — the upstream server gained a new tool that's missing from the committed `tools/list` snapshot.

---

## A. Breakage details (fill if you ticked "Report breakage")

**Reproduction**:
```
# what command did you run?
frootai mcp test <slug>
```

**Observed error / unexpected behaviour**:

> Paste the error message, the divergent `tools/list` output, or describe the
> behaviour that doesn't match the spec.

**Environment**:
- Client: `<claude-desktop | cursor | vscode | other>`
- frootai-cli version: `<output of `frootai --version`>`
- OS: `<windows | macos | linux>`

**Last successful attach**: `<YYYY-MM-DD or "first time trying it">`

> **What happens next**: a maintainer triages within the [X5.9] 14-day SLA.
> Confirmed breakage opens an `[attach-drift]` issue per X2.12; the [X5.18]
> `Unmaintained` badge fires automatically after 14 consecutive failed nights.

## B. Promotion request (fill if you ticked "Request promotion")

**Current tier**: `<community>` → **Requested tier**: `<verified-publisher>`

**Substantive signal** (per [X5.11] §4.2 — at least one):
- [ ] **prior_orchard_accelerator** — _name the integration_
- [ ] **code_review** — _commit SHA / release reviewed + finding link_
- [ ] **founder_verified** — _business relationship / known-good vendor_

**Evidence link / receipts**:

> Paste a link to the integration's solution-play page, the maintainer code-
> review comment, or the founder-verification note. Vague claims (`"trust us"`,
> `"large user base"`) are not substantive — they belong in a separate
> elaboration block, not as the primary signal.

**Will you open the promotion PR yourself?**
- [ ] **Yes** — using [tier-promotion.md](./PULL_REQUEST_TEMPLATE/tier-promotion.md) ([X5.11]).
- [ ] **No** — asking a FrootAI maintainer to draft it.

## C. Missing tool (fill if you ticked "Add tool to snapshot")

**Tool name (upstream)**: `<tool-name>` (the bare name; the snapshot prepends `<tool_prefix>.`)

**Where you saw it**:
- Upstream changelog / release notes URL
- Or: `tools/list` output excerpt (≤20 lines)

**Are the new tool's args + return shape documented?**
- [ ] **Yes** — link the upstream docs page.
- [ ] **No** — flag for the maintainer to ask the upstream publisher.

**Will you open the snapshot-refresh PR yourself?**
- [ ] **Yes** — I'll run `node scripts/marketplace/snapshot-tools.mjs <slug> --live --write` and PR the diff.
- [ ] **No** — flag for the nightly attach-validate to pick it up (note: that takes ≤24h via the X2.25 auto-snapshot-refresh PR generator).

---

## Pre-flight checklist

- [ ] The slug in the title matches the spec filename exactly.
- [ ] Exactly **one** issue type is ticked at the top.
- [ ] The matching section (A / B / C) is filled; the others have been deleted.
- [ ] This is not a duplicate — I searched open issues for `[mcp-spec] <slug>`.
- [ ] If "Report breakage", I tried `frootai mcp test <slug>` AND read
      the [Spec deprecation policy](../../frootai-core/docs/spec-deprecation.md) ([X5.23])
      in case the spec is already in the 30-day notice window.

---

_This issue was opened via [`.github/ISSUE_TEMPLATE/mcp-spec-issue.md`](./ISSUE_TEMPLATE/mcp-spec-issue.md) ([X5.25])._
