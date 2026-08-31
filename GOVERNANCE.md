# FrootAI Governance

This document describes stewardship and decision-making for the public FAI Protocol, catalog, and community surfaces.

## Mission

We are building the **industry standard for AI primitive unification** — the
FAI Protocol that wires agents, instructions, skills, hooks, workflows,
plugins, tools, prompts, and guardrails into deployable solution plays.

## Project Stewardship

| Role | Responsibility |
|------|---------------|
| **Founder / Project Lead** | Pavle. Accountable for protocol direction, breaking changes, licensing, and the long-term mission. |
| **Core Maintainers** | Merge rights on `frootai/*` repos. Review PRs, triage issues, cut releases. Listed in [`MAINTAINERS.md`](./MAINTAINERS.md). |
| **Domain Owners** | Subject-matter experts for specific areas (RAG, security, infra). Listed in [`.github/CODEOWNERS`](./.github/CODEOWNERS). Auto-assigned PR reviews in their domain. |
| **Contributors** | Anyone who has had a PR merged. Recognized in `CONTRIBUTORS.md` (auto-generated). |
| **Community** | Everyone who participates in Discussions, Issues, Discord. |

## Decision-Making Process

We use a **lazy consensus** model with three escalation tiers:

### Tier 1 — Routine Changes (Lazy Consensus)
- Bug fixes, doc improvements, new primitives, new solution plays
- Any maintainer can merge after one approving review and passing CI
- No formal vote required

### Tier 2 — Significant Changes (Maintainer Consensus)
- Breaking API changes, new dependencies, removal of features, security policies
- Requires **2 maintainer approvals** + 7-day comment window
- Discussion happens on the PR or in a GitHub Discussion

### Tier 3 — Strategic Changes (RFC Process)
- Protocol changes, major architecture shifts, repo splits, license changes
- Requires an **RFC** (Request for Comments) proposal submitted through a
  GitHub issue or pull request in this repository
- 14-day public comment period
- Final decision rests with the Founder + Core Maintainers

## Becoming a Maintainer

We invite contributors to become maintainers based on:

1. **Sustained contributions** — at least 10 merged PRs over 3+ months
2. **Quality** — PRs land cleanly, follow conventions, pass CI on first try most of the time
3. **Community** — constructive review comments, helps newcomers, follows Code of Conduct
4. **Trust** — current maintainers know your work and trust your judgment

Existing maintainers nominate; the Founder confirms. New maintainers start with
review + triage rights, gaining merge rights after a 4-week probation.

## Releases

Public protocol, schema, catalog, and community changes are versioned and validated in this repository. Distribution products—including npm, PyPI, container, CLI, and VS Code artifacts—are built and published through controlled release systems from their canonical implementation repositories.

Release requirements include:

1. Immutable version identifiers and source provenance.
2. Required validation, security, and compatibility gates.
3. Least-privilege publishing identities.
4. Consumer-verifiable checksums, signatures, or attestations where supported.
5. No dependency on transitional implementation copies in this public repository.

See [Repository Scope](./REPOSITORY_SCOPE.md) for the public/private boundary.

## Conflict Resolution

1. **Discuss** in the relevant PR/Issue first
2. **Escalate** to a Core Maintainer if no resolution in 7 days
3. **Founder decides** if maintainers cannot agree
4. **Code of Conduct violations** → email `conduct@frootai.dev`

## Funding & Sustainability

FrootAI is **MIT-licensed and free forever**. There is no premium tier.

Sustainability comes from:
- **GitHub Sponsors** (when available) for the Founder
- **Future managed offerings** in `frootai.dev` (hosted FAI Engine, evaluation
  pipelines) — distinct from the open-source primitives
- **Enterprise consulting** for large-scale solution-play deployments

No sponsor or paying customer can buy a feature, a vote, or a maintainer slot.
The catalog stays neutral.

## Amending This Document

Changes to this governance document follow the **Tier 3 RFC process**.
Existing maintainers + Founder must approve.

---

*Last updated: August 31, 2026.*
*Adapted from open-source governance patterns observed in CNCF, Apache, and Vercel projects.*
