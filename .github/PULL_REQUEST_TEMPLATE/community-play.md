---
name: Community Solution Play
about: Contribute a new Solution Play to the FrootAI catalog
title: "community-play: <slug> — <one-line summary>"
labels: ["community-play", "needs-founder-review"]
assignees: ["pavle"]
---

<!--
  [H11.21] Community Solution Play PR template.
  See: frootai/orchard/community-plays/CONTRIBUTING.md
  Auto-validator: cli/commands/release/community-pr-validate.js
  Founder review SLA: 7 days from PR open.
-->

## Solution Play summary

**Slug**: `<your-slug-here>`
**Variety**: `<azure | aws | gcp | oss | hybrid>`
**Tagline (≤200 chars)**:
> _One-line description of what the play does + who it's for._

## What does this play do?

_2-3 short paragraphs covering:_

- The problem the play solves
- The cloud + AI primitives it composes
- Who would deploy it (target user / use case)

## Deploy walkthrough

_Brief outline of the deploy path the README covers — e.g. "Clone → `azd up` → smoke-test endpoint → tear down with `azd down`"._

## Pre-flight checklist

(The auto-validator will catch most of these; check yourself first to save a review round-trip.)

- [ ] Slug is URL-safe lowercase-hyphenated, 3-64 chars (validator regex `^[a-z0-9-]+$`)
- [ ] License is in the permissive floor: MIT / Apache-2.0 / BSD-2-Clause / BSD-3-Clause / ISC / 0BSD / Unlicense / CC0-1.0
- [ ] No PII in `name`, `tagline`, `description`, or `readme_excerpt` (validator scans for email / phone / SSN patterns)
- [ ] `fai-manifest.json` + `README.md` both present at `frootai/orchard/community-plays/<slug>/`
- [ ] PR is < 100 files (large PRs get a warning; founder review may ask to split)
- [ ] Branch name is `community-play/<slug>`
- [ ] If the play wraps OR derives from another project, upstream is cited in `README.md`

## Founder review SLA

**7 days from PR open to first response** per [community-plays/CONTRIBUTING.md](../../orchard/community-plays/CONTRIBUTING.md). If you haven't heard back by then, ping `@pavle` on this PR.

## What the validator checks

1. `fai-manifest.json` is valid JSON + has all required fields (`schema_version` / `id` / `name` / `slug` / `variety` / `owner` / `owner_type` / `repo_url` / `default_branch` / `tagline` / `license`)
2. Slug shape + length + path-traversal safety
3. Variety + owner_type are in the allowed enums
4. License is in the permissive floor
5. Tagline ≤ 200 chars
6. PII scan on `name` / `tagline` / `description` / `readme_excerpt`
7. `repo_url` is an http(s) URL
8. Required files (`fai-manifest.json` + `README.md`) present in the PR file tree
9. No file paths are absolute / contain `..` / contain backslashes

The validator posts a PR comment with the full result on every push. Errors block merge; warnings are non-blocking.

---

_Thank you for contributing — every community play makes the Orchard more useful for the next 100 users. 🌳_
