# Changelog — frootai (npm CLI)

> Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), [SemVer](https://semver.org/spec/v2.0.0.html).
> **Versioning doctrine:** local version = registry-published + 1 patch.
> See `.internal/improvements/MASTER-IMPROVEMENT-PLAN.md` §2.

## [Unreleased]

### Fixed

- Removed CLI publication from the legacy `npm-publish.yml` workflow. CLI tags
  now have one publisher: the exact-artifact enterprise workflow.
- Made enterprise publication idempotent when npm already contains the exact
  tested artifact, with bounded retries for registry consistency.

## [6.2.0] — 2026-07-27

### Changed

- Advanced the enterprise CLI to 6.2.0 after overlapping tag workflows had
  already published the 6.1.2 and 6.1.3 artifacts.
- The legacy workflow published 6.2.0 from the release tag; its npm integrity
  exactly matches the retained enterprise-gate artifact for commit `248ff973`.

[6.2.0]: ../../compare/cli-v6.1.3...cli-v6.2.0

## [6.1.3] — 2026-07-26

### Changed

- Reissued the plan-compatible artifact as 6.1.3 while diagnosing duplicate
  publication. The legacy tag workflow published it before the explicit
  enterprise dispatch reached npm.

[6.1.3]: ../../compare/cli-v6.1.2...cli-v6.1.3

## [6.1.2] — 2026-07-26

### Changed

- Adapted the enterprise release workflow to the private repository's current
  GitHub plan: tag pushes build, test, checksum, and retain evidence but never
  publish automatically.
- Production publication now requires an explicit workflow dispatch on the
  immutable `cli-v6.1.2` tag, exact confirmation text, and the configured npm
  automation token.
- Removed unsupported GitHub artifact-attestation and npm provenance requests;
  registry integrity is still compared against the exact tested tarball.
- `cli-v6.1.1` remains an immutable failed release attempt.
- The 6.1.2 tag passed its build-only release gate and was published by the
  overlapping legacy npm workflow before the explicit enterprise dispatch.

[6.1.2]: ../../compare/cli-v6.1.1...cli-v6.1.2

## [6.1.1] — 2026-07-26

### Added — product coverage discovery

- `frootai products` maps 20 current FrootAI product and distribution surfaces
  to a CLI-native command, a CLI/MCP bridge, or their web-first experience.
- `frootai products --json` emits the same versioned package catalog for
  automation and product-parity audits.
- Top-level help now exposes Product Discovery and the shipped Lean commands.
- `frootai capabilities [--json]` derives executable evidence from the
  packaged command registries and handler contracts.
- Tested operator engines are now reachable through the published binary:
  `engine`, `config`, `docs`, `e2e`, `errors`, and `update`.
- The Harvest pipeline is exposed as `frootai engine` so the existing Orchard
  catalog namespace remains backward compatible.
- Enterprise mutation policy requires explicit approval for external writes
  and a separate approval for `--force`.
- Mutating commands emit an owner-only SHA-256 hash-chained audit log with
  verification and tail commands.
- Direct release scripts require a recent operation-bound one-time token issued
  by the audited CLI router.
- The enterprise release gate installs and tests one packed tarball, runs
  vulnerability and dependency checks, and emits digest-bound release evidence.
- Initial release automation attempted GitHub artifact attestations; publication
  was blocked because that hosted feature is unavailable on the private repo's
  current plan.

### Added — `frootai lean <path>` (local lossless compile)

- `frootai lean <path.md>` compiles a local markdown file to its **lossless
  Lean form** — the deterministic floor (trailing-whitespace + blank-line
  reclaim, no semantic change). Writes `<path>.lean.md` (or `-o <out>`, or
  `--stdout`) and reports the measured **byte** saving. Same transform as the
  MCP `leanCompact`, ported byte-for-byte. The exact token saving is the
  build-time o200k_base measurement on the `/lean` benchmark.

### Added — `frootai install <id> --lean` (real Lean install)

- `frootai install <id> --lean` now **fetches the primitive's committed,
  fidelity-verified Lean (`.lean.md`) variant** from the canonical source and
  writes it locally (mirroring the repo path, or `--flat` for the basename).
  Previously the flag was recognised but guidance-only.
- A bare id resolves to `skills/<id>/SKILL.lean.md`; pass an explicit
  `<path>.lean.md` for non-skill primitives. A missing variant exits 1 with the
  source URL; a missing id exits 2 with usage.

### Changed

- Corrected the public command reference to remove retired v5 commands and
  distinguish source-maintainer Factory commands from portable NPX commands.
- Clarified that `frootai` is the npm CLI; the JavaScript SDK remains an
  unpublished private preview under the separate `frootai-sdk` package name.
- Corrected the self-updater to query and install the published `frootai`
  package instead of the nonexistent `@frootai/cli` package.

[6.1.1]: ../../compare/cli-v6.1.0...cli-v6.1.1

## [6.1.0] — 2026-06-20

**Stable release on the `latest` dist-tag.** Promotes `6.1.0-alpha.1` to
GA in lockstep with the M11 launch arc:
- `frootai-mcp@6.0.0` (npm + PyPI, shipped at M11.5)
- `frootai@6.1.0` CLI (this release, M11.6)
- `frootai-vscode@6.0.0` (M11.7)
- `frootai/frootai@v6` Action (M11.8)
- Foundry agent `v2.0.0` (M11.9)
- Hosted MCP DNS flip (M11.10)

### Added — GA federation CLI surface

Promotes the `frootai mcp` subcommand family from alpha → stable:

- `frootai mcp list | discover | attach | detach | trust | test | invoke | publish`
- `--verbose` structured telemetry events to stderr
- `--no-network` air-gap mode (Doctrine #1 — offline-first)
- Deterministic exit codes: `0` OK, `1` USER_ERROR, `2` NETWORK,
  `3` TRUST_BLOCK, `4` UPSTREAM_FAILURE
- Shell completions for bash / zsh / powershell
- `~/.frootai/mcp-state.json` schema-validated state file

### Changed
- Promoted `6.1.0-alpha.1` → `6.1.0` (npm `latest` tag).
- `frootai mcp` is no longer behind the alpha dist-tag.

### Backward compatibility
- All `frootai orchard` / `frootai login` / `frootai telemetry` /
  `frootai scaffold` subcommands unchanged.
- `frootai@5.x` shell scripts continue to work without modification.

### Install
- `npm install -g frootai@6.1.0`

[6.1.0]: ../../compare/cli-v6.1.0-alpha.1...cli-v6.1.0

## [6.1.0-alpha.1] — 2026-06-18

> Tag: `cli-v6.1.0-alpha.1` · npm dist-tag: `alpha` (the `latest` pointer
> stays on stable `6.0.0` until the M4 federation surface graduates).
> Companion release for the **MCP Federation Kernel — Phase M4 close**.

### Added

#### `frootai mcp` subcommand family (Phase M4 — 28 of 30 rows shipped)

A new top-level subcommand group drives the FrootAI federation kernel from
the shell. Operators can attach external MCP servers, inspect publisher
trust posture, invoke federated tools, and publish plugins — all without
ever touching the kernel JSON-RPC layer directly. Eight subcommands ship:

- **`frootai mcp list`** — render the pre-attach roster + last
  health-check snapshot from `~/.frootai/mcp-state.json` (table or
  `--json`).
- **`frootai mcp discover [query]`** — search the marketplace catalog by
  query / tier with bundled-snapshot offline fallback. `--refresh` fetches
  a fresh snapshot from `frootai.dev/v1/marketplace/mcp-snapshot.json`.
- **`frootai mcp attach <name>`** — add an area to the pre-attach roster.
  Trust-tier-aware confirmation prompt for community / unknown publishers
  (skip via `--trust-override`). Idempotent.
- **`frootai mcp detach <name>`** — counterpart to attach. Idempotent.
- **`frootai mcp trust list|set|unset`** — inspect / set / unset the
  publisher trust override map at `~/.frootai/trust.json`.
- **`frootai mcp test <name> [--all]`** — probe an area's attach +
  list-tools round-trip latency. Writes a `lastHealthCheck` entry per
  area; `--all` does the Tier-1 sweep.
- **`frootai mcp invoke <area>.<tool> [--args '{...}'] [--persist]`** —
  one-shot invoke of `<area>.<tool>` with deterministic dispose discipline
  (Doctrine #7). `--persist` skips the trailing detach AND adds the area
  to `preAttach[]` + writes `~/.frootai/mcp-session.lock`.
- **`frootai mcp publish <plugin.json> [--submit]`** — validate a
  plugin manifest providing an MCP server. `--submit` is dry-run-only in
  M4; real submission ships in X3.

#### Cross-cutting flags + behaviors

- **`--verbose`** (M4.25) — structured single-line JSON telemetry events
  to stderr only (stdout stays pipeable for `--json` consumers). Forwards
  the kernel subprocess's stderr verbatim with a `[fai-mcp:kernel.stderr]`
  prefix. Canonical events: `dispatch.start` / `dispatch.end` /
  `dispatch.error` / `<sub>.result` / `auth.loaded` / `kernel.spawn` /
  `kernel.stderr`.
- **`--no-network`** (M4.26) — air-gap mode. Refuses `npx -y
  frootai-mcp@<v>` spawn unless `FROOTAI_MCP_BIN` (or `--bin-path`)
  points at a pre-installed kernel binary; short-circuits marketplace
  `fetch()` and falls through to the bundled snapshot. New error code
  `network_blocked` → exit 2 (NETWORK).
- **Auth integration** (M4.27) — marketplace API calls (`discover --refresh`,
  future `publish --submit`) reuse the existing H8.13 OAuth2 credentials
  at `~/.config/frootai/credentials.json` (XDG-compliant, mode 0600).
  There is **exactly one** canonical token store on disk — no parallel
  `~/.frootai/.token` file. Bearer token is **never** logged: every
  surface that mentions auth narrates via the redacted summary
  (`tokenPreview` 4-prefix + 4-suffix mask) only. The marketplace
  `Authorization: <type> <token>` header is built at the last possible
  moment before fetch and never assigned to a captured variable; the
  return shape exposes `authPresent: boolean` and never the token.
- **Deterministic exit codes** (M4.21) — `0` OK / `1` USER_ERROR / `2`
  NETWORK / `3` TRUST_BLOCK / `4` UPSTREAM_FAILURE. Every shipped
  `McpCliError.code` literal maps via a frozen `CODE_TO_EXIT_MAP`.
- **Shell completions** (M4.18-M4.20) — bash / zsh / powershell scripts
  generated by `frootai mcp --completion <shell>`. Drift-detector
  asserts byte-equivalence with the dispatcher's subcommand list.
- **State file v1** — `~/.frootai/mcp-state.json` schema-validated against
  `frootai/schemas/mcp-cli-state-v1.schema.json`. Atomic writes via
  `<file>.tmp` + `rename()`.
- **Bundled offline marketplace snapshot** (M4.17) — first-run UX works
  without network access; `discover` reads the bundle from
  `cli/lib/mcp/marketplace-snapshot.bundled.json` when the user cache is
  absent.

#### Quality + release infrastructure

- **3-OS × 3-Node CI matrix** (M4.24) — `.github/workflows/mcp-cli-cross-platform.yml`
  runs the full M4 gate suite on `ubuntu-latest × macos-latest ×
  windows-latest × Node 18 / 20 / 22`. Path separators + env-var syntax
  + spawn semantics are matrix-validated.
- **M4.22 case-floor ratchet** — `cli/lib/mcp/_floors.js` locks
  `TOTAL_CASE_FLOOR=410` across 28 gate files; per-subcommand + per-error-
  code + state-roundtrip floors prevent silent regressions.
- **Documentation** — `docs/cli/mcp.md` covers every subcommand with
  examples, the global flag table, the four state-file paths under
  `~/.frootai/`, completion install for all three shells, the air-gap
  matrix, the `--verbose` event taxonomy, the auth integration with
  redaction guarantee, and the M4.21 exit-code contract.

### Notes

- `npm install -g frootai@alpha` to opt into this prerelease. The
  `latest` dist-tag stays on stable `6.0.0` until M4 graduates.
- The `mcp` subcommand group is **additive** — existing `frootai
  orchard` / `frootai login` / `frootai telemetry` / `frootai scaffold`
  surfaces are unchanged.
- M4 phase close + tag `federation-cli-v0.4.0` lands at row M4.30.

[6.1.0-alpha.1]: ../../compare/cli-v6.0.0...cli-v6.1.0-alpha.1

## [6.0.0] — 2026-05-26

> Tag: `orchard-v0.5.0-ops`. Companion release for the Orchard operational
> maturity milestone — backend endpoints live, npm distribution wired,
> telemetry pipeline + privacy floor shipped, VSCode extension calling
> the CLI in-process, CDN-served Play recipes.

### BREAKING
- **Local config schema bumped to `v: 1`** — older config files (`~/.frootai/config.json` without `v` key) are still readable but will be re-stamped with `v: 1` on first write.
- **Telemetry is OPT-IN, default OFF** — pre-v6 builds had no telemetry surface at all. The new default-off shape ships in this release.
- **CLI exports map enforced** — package.json now uses an explicit 8-entry `exports` field; sub-path imports outside the map will fail (was: implicit). Consumers should `require("frootai")` or `require("frootai/orchard")`; consult package.json for the full map.

### Added

#### Phase A4 — CLI surface (orchard subcommands + auth + scaffold + diff + telemetry)
- `frootai orchard list|search|show|install|diff|pollinate|bushel` — 8 subcommands with full `--json` mode, `--no-color`, `--variety`/`--ripeness`/`--category` filters.
- `frootai login` / `frootai logout` / `frootai whoami` — browser-based device-code OAuth flow with PKCE, token stored at `~/.frootai/.token` mode 0o600.
- `frootai telemetry on|off|status|reset|export` — opt-in anonymous usage events. `DO_NOT_TRACK=1` env always wins. GDPR Article 20 export to local JSONL file.
- Scaffold engine — `--upgrade-to-play <id>` clones the accelerator + layers the Solution Play recipe with conflict detection + atomic file drops + advisory hook detection (azd_init, npm_install, pip_install, dotnet_restore).
- Diff engine — `frootai orchard diff --target <dir> --upgrade-to-play <id>` previews the Play overlay; `--apply` writes the changes (requires Pro tier).

#### Phase A5 — Operational maturity (backend + distribution + integration)
- **17 backend modules** at `frootai.dev/src/lib/backend/` light up the previously-mocked endpoints: entitlements, telemetry, device-code OAuth, refresh+revoke (single-use refresh with auto-revoke chain on replay), Stripe webhook (constant-time multi-sig signature verify, 30-day idempotency dedup, customer→tier mapping via `fai_tier` metadata).
- **11 Next.js route wrappers** at `frootai.dev/src/app/api/` — all use a typed `BackendError` envelope + audit log (NEVER blocks response).
- **`@frootai/orchard-types` v1.0.0** — separable npm package with byte-equal enums (VARIETY, TIER_RANK, EVENT_ENUM, ALLOWED_PROP_KEYS) shared across CLI/backend/website/SDK. Zero deps, `sideEffects: false`.
- **`frootai --version`** now shows CLI version + linked-against backend revision via `/api/version` (5-min CDN cache + 1-hour client cache + 2-second timeout + NEVER blocks the CLI).
- **Privacy floor doctrine** — `PRIVACY_FLOOR_DOCTRINE` frozen constant + `assertNoIdentityFields` server-side check on every gated response. Dashboard + export NEVER return `sub`/`email`/`org_id` even when authenticated user has them; even when poisoned segment files inject prohibited fields, server sanitization strips them.
- **90d raw / 730d aggregate retention sweep** — daily cron-runnable operator script (`scripts/orchard/event-retention-sweep.js`) summarizes raw events to per-day aggregates then deletes raw, with read-back verification before deletion.
- **VSCode extension in-process integration** — extension now invokes `cli/lib/orchard/dispatch.js` directly (no subprocess spawn — saves ~200 ms/call on Windows). `OrchardTreeProvider` tree view + 7 real command handlers. Shared auth: `frootai login` in terminal transparently signs in the extension on next tree refresh.
- **Shared bushel sync** — server-side merge engine (UNION minus tombstones, max+1 version, ETag optimistic concurrency, Team-tier `bushel-sync` entitlement gated).
- **Extension telemetry** — `emitVscodeEvent` shares anon-id + opt-in with CLI via `vscode:<subcommand>` cmd prefix.
- **CDN-served Play recipes** — gzipped JSON bundle format with per-file SHA-256 + canonical hash dedup (excludes `bundled_at` so byte-equal content dedupes at CDN edge regardless of rebuild time). `CDNRecipeProvider` drop-in replacement for `LocalDirRecipeProvider` with stale-while-error fallback.
- **ETag cache invalidation** — per-recipe monotonic counter at `recipe:invalidation:<id>`. Admin POST endpoint at `/api/plays/[id]/invalidate` gated by `admin:invalidate-cache` scope. Operator CLI `scripts/orchard/invalidate-recipe-cache.js` reads token from env var (never argv — no shell-history leakage).
- **Per-platform npm smoke matrix** — `.github/workflows/cli-smoke-matrix.yml` runs `npm pack` + tarball install + 4 no-network smoke commands on ubuntu/macos/windows × Node 18/20/22.
- **Phase-close verifier `--phase A5`** — 68-check pre-flight gate. Run `node scripts/orchard/verify-phase-close.js --phase A5` before pushing the release tag.

### Changed
- **`cli/package.json` overhaul** — 8-entry `exports` map, `files` allowlist scoped to publishable artifacts (`bin.js`, `lib/**/*.js`, `CHANGELOG.md`, `README.md`), `publishConfig.provenance: true`, `engines.node >= 18`, `homepage`/`bugs` fields.
- **GitHub Actions publish workflow** at `.github/workflows/publish-cli.yml` — OIDC for npm provenance, tag-vs-package version drift guard, `npm pack --dry-run` precheck, best-effort Slack notification.
- **Cross-cutting privacy invariants** — dashboard handler NEVER returns identity fields; export handler NEVER returns identity fields. Verified by tests that POISON-INJECT `sub`/`email`/`org_id` into source events and assert they're stripped server-side before bytes leave the gateway.

### Fixed
- Multiple bugs caught pre-ship by the test suite (see [planning/retros/orchard-phase5.md](../../planning/retros/orchard-phase5.md) § 3 for the 8-bug catch table).

### Notes
- Companion `@frootai/orchard-types` v1.0.0 published in parallel.
- Run `node scripts/orchard/verify-phase-close.js --phase A5` before pushing the release tag.
- Full release runbook: `node scripts/orchard/finalize-phase-a5.js --help`.
- Launch announcement template: [planning/announcements/orchard-v0.5.0-ops.md](../../planning/announcements/orchard-v0.5.0-ops.md).

## [5.4.1] — 2026-05-03

### Changed
- **Phase 1 harmonization** — local version corrected from vanity-inflated `6.8.1` down to `5.4.1` (= published `5.4.0` + 1 patch).
- `cli/README.md` regenerated from 0 bytes → 8 KB with full install / commands / env / troubleshooting sections.

### Notes
- This release is **not yet published**. Tag `cli-v5.4.1` will trigger publish once operator commits and pushes.
- See `.internal/improvements/PHASE-1-EXECUTION-LOG.md` for full audit trail.

## [5.4.0] — Last published version on npm

Prior history pre-dates this changelog. See [npm versions](https://www.npmjs.com/package/frootai?activeTab=versions) for installed releases.

[Unreleased]: ../../compare/cli-v6.1.0-alpha.1...HEAD
[6.0.0]: ../../compare/cli-v5.4.1...cli-v6.0.0
[5.4.1]: ../../compare/cli-v5.4.0...cli-v5.4.1
