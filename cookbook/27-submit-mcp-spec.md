# Recipe 27: Submit a Community MCP Spec

> Walk an author end-to-end through submitting their MCP server to the FrootAI
> marketplace at the `community` trust tier — from "I have a working server"
> to "the spec is merged and rendering on `frootai.dev/ecosystem/mcp/marketplace/<slug>`".

> **Note on numbering**: this recipe is `27-` because slots `25-` and `26-` were
> taken by the [X4.24] composition-recipe batch
> ([`25-web-to-vector-rag.md`](./25-web-to-vector-rag.md) +
> [`26-vector-memory-bakeoff.md`](./26-vector-memory-bakeoff.md)). The [X5.28]
> masterplan row's literal `25-submit-mcp-spec.md` is a planning-time guess;
> the actual filename adapts to the existing cookbook ordering.

## What you'll do

Open one community-spec PR that:

1. Adds a schema-valid `mcp-specs/<slug>.json` for your server.
2. Passes the [X5.8] PR-triage workflow (schema + doctrine #2 + dry-run attach).
3. Renders on the marketplace detail page with all the [X5.4]/[X5.7]/[X5.15]/[X5.17]/[X5.18]/[X5.21] affordances active.

You will **not** flip your spec to `verified-publisher` in this PR — promotion
is a separate flow per the [X5.11] tier-promotion walkthrough.

## Prerequisites

- A working MCP server published as an npm package, a `uvx` package, OR a
  hosted http-sse endpoint.
- A GitHub account that satisfies one of the [X5.13] insider checks for the
  publisher (login = publisher key, OR existing reviewer on a sibling spec,
  OR a known insider will post `/coauthor-attest <publisher>` on your PR).
- The [`frootai`](https://www.npmjs.com/package/frootai) CLI installed
  (`npm i -g frootai`).
- The FrootAI repo cloned + a feature branch.

## Step 1 — Probe your server locally

The [X5.2] community guide makes this the **first** step for a reason: if
your transport / env-vars / sample-tools claim doesn't survive a live
`frootai mcp test`, the PR is going to bounce.

```
frootai mcp test <slug>
```

This attaches your server, fetches `tools/list`, and reports latency. Tighten
your transport + env-var matrix until the probe returns the tools you expect.

## Step 2 — Author the spec

Copy
[`frootai/orchard/registry/mcp-specs/_template.json`](../orchard/registry/mcp-specs/_template.json)
to `<slug>.json` (filename === `slug` === `tool_prefix`, all kebab-case —
doctrine #5). Minimum fields the [X5.8] workflow's ajv-cli gate will check:

- `spec_version: "1.0.0"`
- `slug` / `title` / `publisher` / `tool_prefix` (publisher MUST be a
  `knownPublishers` key in `data/mcp-trust.json` — doctrine #2)
- `trust: "community"` (the [X5.2] default)
- `transport` (stdio-subprocess with `command` + `args` + `env_passthrough`
  names-only — doctrine #6, NO `=value` strings; OR http-sse with `url`)
- `version_pin` (`package` + `version_range` + `tested_version`)
- `env_vars` (every variable named in `env_passthrough` must appear here)
- `auth` (recipe + modes)
- `sample_tools` (≥1 representative tool)
- `destructive_tools` (empty `[]` is fine if read-only)
- `known_limitations`

Per the [X5.22] community-freshness validator, you'll also want:

- `license` — SPDX-style (`"MIT"`, `"Apache-2.0"`, etc.)
- `incident_contact` — a publisher-side security-contact URL or email
- `last_validated_at` — today's ISO date

## Step 3 — Snapshot the live tools/list

```
node scripts/marketplace/snapshot-tools.mjs <slug> --live --write
```

This writes `frootai/orchard/registry/mcp-specs-snapshots/<slug>.json` — the
committed `tools/list` the [X2.12] nightly attach matrix diffs against.

## Step 4 — Open the PR with the [X5.1] template

Use the [`.github/PULL_REQUEST_TEMPLATE/mcp-spec.md`](../.github/PULL_REQUEST_TEMPLATE/mcp-spec.md)
template:

```
git push origin <your-branch>
gh pr create --template mcp-spec.md \
  --title "mcp-spec: <slug> — <one-line summary>"
```

The template auto-applies labels `mcp-spec` + `community` +
`needs-founder-review` and assigns `@pavle`. It carries a 12-item pre-flight
checklist covering doctrines #2/#5/#6 + the [X5.22] freshness fields.

## Step 5 — Wait for the gates

The PR runs through 3 sequential gates (each fails the check independently
with a sticky comment):

1. **[X5.13] anti-abuse** — ≤3 open PRs per author + sock-puppet check
   (your insider-check from Prerequisites).
2. **[X5.12] tier-escalation guard** — no escalation needed for the bare
   community submission; this gate is a no-op for you.
3. **[X5.8] PR-triage** — schema validation (ajv against `mcp-spec-v1`),
   doctrine #2 publisher cross-check, [X5.6] attach-test dry-run.

Each gate posts at most one sticky comment per PR (no spam on re-pushes).
A maintainer reviews within the [X5.9] 14-day SLA. If you don't hear back,
the [X5.9] watcher will ping `@pavle` on your behalf.

## Step 6 — After merge

Once the spec is merged:

- It appears on `frootai.dev/ecosystem/mcp/marketplace/<slug>` with the full
  detail-page treatment: [X5.4] confidence banner (your spec scores 100/100
  if you filled in all the X5.22 fields), [X5.7] "Help improve this spec"
  CTAs auto-hidden (no longer inferred), [X5.15] contributor list shows
  your avatar, [X5.17] last-attach pill / [X5.21] freshness strip reflect
  the merge date, [X5.18] unmaintained badge stays clean (verdict will
  flip to `verified` after the next nightly attach passes).
- The [X3.21] RSS feed picks it up + the [X5.20] Discord announcer posts
  to `#mcp-marketplace`.
- The [X5.26] per-spec shields are generated; you can paste the 3-line
  markdown snippet from `frootai-core/data/mcp-spec-badges.json` into your
  upstream README.

## If a gate blocks you

- **Schema failure** → ajv prints the exact JSON-Schema path that failed in
  the workflow log; fix the field and re-push.
- **Doctrine #2 publisher missing** → the `publisher` key isn't in
  `data/mcp-trust.json`. Open a separate evidence PR per the
  [X5.11] walkthrough — but for `community` tier the publisher just needs
  to be added as a `knownPublishers` entry, no evidence file required.
- **Sock-puppet flag** → ask a publisher insider to comment
  `/coauthor-attest <publisher>` on your PR (see [X5.13]).
- **X5.22 freshness failure** → fill in `license` + `incident_contact` +
  `last_validated_at` (today's date); re-push.

## When to use a different flow

- **Promoting an existing community spec to verified-publisher**: use the
  [X5.11] tier-promotion walkthrough + the dedicated
  [`tier-promotion.md`](../.github/PULL_REQUEST_TEMPLATE/tier-promotion.md)
  PR template. Don't bundle promotion into your spec PR.
- **Handing off maintenance to a new author**: use the [X5.24] ownership-transfer
  walkthrough + the dedicated
  [`ownership-transfer.md`](../.github/PULL_REQUEST_TEMPLATE/ownership-transfer.md)
  PR template.
- **Reporting breakage / requesting a snapshot refresh**: open an issue with
  the [X5.25] [`mcp-spec-issue.md`](../.github/ISSUE_TEMPLATE/mcp-spec-issue.md)
  template — pick the matching category at the top.

## Why the community tier is the right starting point

Per the [§5.4 trust criteria](../../frootai-core/docs/internal/trust-assignment-criteria.md),
`community` lets your server attach **with a per-call prompt** —
`attachWithoutPrompt: false`. Users see a clear elicitation before the
transport spawns. That's the safer-by-default posture and exactly what the
[X5.2] guide promises for community submissions.

Once your spec accumulates substantive signal (an Orchard accelerator
integration, a maintainer code review, or founder verification), you'll
qualify for [X5.11] promotion to `verified-publisher` — silent attach,
sky-blue badge.

## See also

- Front-door guide: [Contributing community specs](../../frootai-core/docs/contributing-mcp-specs.md) ([X5.2])
- The PR template you'll use: [`mcp-spec.md`](../.github/PULL_REQUEST_TEMPLATE/mcp-spec.md) ([X5.1])
- The triage workflow that gates the PR: [`mcp-spec-pr.yml`](../.github/workflows/mcp-spec-pr.yml) ([X5.8])
- The 14-day SLA: [`sla-watcher.mjs`](../../frootai-core/scripts/marketplace/sla-watcher.mjs) ([X5.9])
- Anti-abuse helper: [`pr-rate-limit.mjs`](../../frootai-core/scripts/marketplace/pr-rate-limit.mjs) ([X5.13])
- Inverse-flow recipes:
  - Tier promotion: [tier-promotion.md](../../frootai-core/docs/tier-promotion.md) ([X5.11])
  - Ownership transfer: [ownership-transfer.md](../../frootai-core/docs/ownership-transfer.md) ([X5.24])
  - Spec deprecation: [spec-deprecation.md](../../frootai-core/docs/spec-deprecation.md) ([X5.23])
