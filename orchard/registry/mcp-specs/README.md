<!-- [X2.21] MCP attach-spec library — format reference + contributor workflow. CC0-1.0. -->
# MCP Attach Specs (`mcp-specs/`)

This directory holds the **Tier-1 attach specs** for the FrootAI MCP federation: one
fully-validated `<slug>.json` per server, plus the `_template.json` you copy from.
A spec is the canonical, machine-checked description of how the kernel attaches to an
upstream MCP server — its transport, environment variables, auth path, version pin,
destructive tools, and sample tools.

## What lives here

| File | Purpose |
|---|---|
| `_template.json` | Annotated `ExternalMcpSpec` template — copy this to start a new spec. Underscore-prefixed files are **not** real specs (readers skip `_*`). |
| `azure.json` · `playwright.json` · `github.json` · `markitdown.json` · `context7.json` · `ms-learn.json` · `notion.json` · `stripe.json` · `tavily-ai.json` · `mongodb.json` · `supabase.json` · `elastic.json` · `pgedge.json` · `sonatype.json` · `sonarsource.json` · `atlassian.json` · `vercel.json` · `hashicorp-terraform.json` · `firecrawl.json` · `qdrant.json` · `chromadb.json` · `pinecone.json` · `openai.json` | The attach specs (6 Tier-1 from Phase X2 + Tier-2 verified-publisher additions from Phase X4). |
| `README.md` | This file. |

Related locations:

- **Schema**: [`frootai/schemas/mcp-spec-v1.schema.json`](../../../schemas/mcp-spec-v1.schema.json) (JSON Schema, draft 2020-12).
- **Snapshots**: [`../mcp-specs-snapshots/<slug>.json`](../mcp-specs-snapshots) — committed `tools/list` baselines.
- **Docs**: `frootai-core/docs/specs/<slug>.md` — generated env-var matrix + install instructions.
- **Validators**: `frootai-core/scripts/marketplace/crawler/lib/{validate-spec,spec-fields}.js` (JS) and `frootai-core/python-mcp/frootai_mcp/federation/spec_validator.py` (Python).

## Spec format (`ExternalMcpSpec`)

Every spec is a JSON object with these top-level fields (full field docs live in
`_template.json` under `_doc`):

| Field | Notes |
|---|---|
| `spec_version` | Always `"1.0.0"`. |
| `slug` | Stable kebab-case identity. **MUST** equal the filename, the `tool_prefix`, and the federation namespace prefix (doctrine #5 — no collision). |
| `title`, `description` | Human-readable. |
| `publisher` | Lowercase GitHub org. **MUST** be a `knownPublishers` key in `trust.json` (doctrine #2 — no silent attach). |
| `trust` | `first-party-ms` \| `verified-publisher` \| `community` \| `untrusted` — must match the publisher's tier in `trust.json`. |
| `tool_prefix` | Namespace prefix; equals `slug`. |
| `transport` | `kind: stdio-subprocess` (`command` + `args`) or `kind: http-sse` (`url`). `env_passthrough` lists env-var **names only** — never literal secrets (doctrine #6). |
| `version_pin` | `package` + semver `version_range` (e.g. `>=0.5.0 <1.0.0`) + `tested_version`. Hosted endpoints use `package: null` + `version_range: "hosted"`. |
| `env_vars[]` | Env-var matrix: `name`, `required`, `auth_mode`, `description`. |
| `auth` | `recipe` (1-line auth summary) + `modes[]` (preference order). |
| `sample_tools[]` | Representative tools (`name` + `summary`). Not exhaustive — the snapshot holds the full list. |
| `destructive_tools[]` | Bare names of tools with destructive side-effects. Blocked when the trust policy sets `allowDestructive: false`. |
| `known_limitations[]` | Caveats a consumer must know before attaching. |
| `client_install`, `snapshot`, `last_reviewed`, `reviewer` | Optional metadata. |

## Adding a new spec

1. **Confirm the publisher is trusted.** The `publisher` must already be a
   `knownPublishers` key in `trust.json` (with an evidence file under
   `mcp-trust-evidence/` for first-party / verified tiers). If not, add the trust
   evidence first.
2. **Copy the template**: `cp _template.json <slug>.json` and fill every field.
   Keep `slug === filename === tool_prefix`.
3. **Validate** (from `frootai-core/`):
   ```
   node tests/marketplace/specs-live.smoke.test.js
   node tests/marketplace/spec-schema.smoke.test.js
   node tests/marketplace/validate-spec.smoke.test.js
   python -m pytest python-mcp/tests/federation/test_spec_validator.py -q
   ```
4. **Seed the snapshot**:
   ```
   node scripts/marketplace/snapshot-tools.mjs <slug> --write
   ```
   (Run with `FAI_SNAPSHOT_LIVE=1 … --live --write` to capture the real `tools/list`.)
5. **Generate the doc**:
   ```
   node scripts/marketplace/build-spec-docs.mjs --write
   ```
6. **Add the attach E2E**: create `tests/marketplace/specs/<slug>.test.mjs`
   (2-line wrapper around `runAttachE2E`) and add `<slug>` to the matrix in
   `.github/workflows/marketplace-attach-validate.yml`.
7. **Run the full marketplace suite** and confirm it stays green:
   ```
   node scripts/marketplace/run-marketplace-tests.js
   ```

## Invariants enforced by CI

- `slug === filename === tool_prefix` (doctrine #5).
- `publisher` resolves to `trust.json` at the declared `trust` tier (doctrine #2).
- `env_passthrough` and `args` contain **no literal secrets** (doctrine #6).
- `version_pin` is well-formed and `tested_version ∈ version_range` (or `hosted`).
- Every spec documents ≥1 substantive limitation + its transport-derived gotcha.
- Committed docs + snapshots stay byte-fresh (regenerate-and-diff).

## Backwards-compatibility policy

A spec is **pinned to a semver range** (e.g. `>=0.5.0 <1.0.0`). Upstream
patch/minor releases inside the range are picked up automatically; the nightly
attach validation (X2.12) catches any tools/list drift.

An upstream **MAJOR-version bump** (`0.x → 1.0`, `1.x → 2.0`, …) is treated as a
**potential breaking change**: it requires a human to re-validate the spec before
re-pinning, because a major release may rename or remove tools. When CI's
auto-update PR (X2.25) is generated for a slug whose upstream `latest` is a major
bump over the spec's `tested_version`, the PR is auto-tagged
**`breaking-change-review`** so a maintainer reviews it deliberately rather than
rubber-stamping the snapshot refresh. Hosted specs (e.g. `ms-learn`, with no
package and a `hosted` range) are exempt — they have no semver to bump.

