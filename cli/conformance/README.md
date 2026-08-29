# `fai conformance` — L0 Conformance Runner

[![FAI Protocol L0 conformance](https://raw.githubusercontent.com/frootai/frootai/main/conformance/badge.svg)](https://github.com/frootai/frootai/tree/main/conformance)

> **Bundled into `frootai@5.4.2+` and shipped as the `conformance` subcommand.**
>
> Implements the 5 L0 checks from [FAI Protocol §9.1](https://github.com/frootai/frootai/blob/main/fai-protocol/README.md#9-conformance) — schema, paths, knowledge IDs, guardrail ranges. Zero runtime dependencies. Node 18+ only.

## What L0 verifies

| # | Check ID | Spec | What it checks |
|---|---|---|---|
| 1 | `manifest-parse` | §3.1 | File is valid JSON; root is an object |
| 2 | `schema-validation` | §3 | Required fields (`play`, `version`, `context`, `primitives`), correct types, regex patterns |
| 3 | `path-syntax` | §5.1 | Primitive paths begin with `./` or `../../` only |
| 4 | `knowledge-ids` | §4.1 | `context.knowledge` entries are FROOT taxonomy (`F*`/`R*`/`O*`/`T*`) or custom `X*`-prefix |
| 5 | `guardrail-ranges` | §3.4 | Declared guardrails fall in their valid ranges; `safety` MUST be 0 |

L0 is the **cheapest tier**. It runs in ~0.12 seconds on the 10 reference examples and is designed for pre-commit + CI gates. It does NOT verify that paths resolve to real files (that's L1), context inheritance (L2), guardrail evaluation (L3), hooks (L4), or full MCP-bridge exposure (L5).

## Quick start

```bash
# Default: scan current directory recursively
npx frootai conformance

# Scan a specific play
npx frootai conformance ./plays/01-enterprise-rag

# Show only failures + summary
npx frootai conformance --quiet

# Emit JSON for CI integration
npx frootai conformance --json > conformance-report.json

# Show the canonical 5 checks + spec links
npx frootai conformance --help
```

Alias: `npx fai conformance ...` works identically.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | All manifests passed all 5 L0 checks |
| `1` | One or more manifests failed at least one check |
| `2` | Invocation error (bad flag, target directory missing, no manifests found) |

These codes are stable across the v5.4.x line — safe to use in CI without version-pinning the CLI.

## Use in CI

GitHub Actions:

```yaml
- name: FAI L0 conformance
  run: |
    npx -y frootai@^5 conformance . --quiet
```

GitLab CI:

```yaml
conformance:
  image: node:20
  script:
    - npx -y frootai@^5 conformance . --quiet
```

Pre-commit hook:

```yaml
# .pre-commit-config.yaml
- repo: local
  hooks:
    - id: fai-conformance
      name: FAI L0 conformance
      entry: npx frootai@^5 conformance . --quiet
      language: system
      types: [json]
      files: 'fai-manifest\.json$'
```

## JSON output schema

When `--json` is set, the runner emits a single JSON document:

```json
{
  "suite": "conformance-v0.9-rc1",
  "protocol": "v0.9-rc1",
  "targetDir": "/abs/path/to/scan",
  "startedAt": "2026-05-22T18:00:00.000Z",
  "elapsedMs": 12,
  "manifestCount": 10,
  "passed": 10,
  "failed": 0,
  "results": [
    {
      "file": "/abs/path/to/play/fai-manifest.json",
      "passed": true,
      "checks": [
        { "id": "manifest-parse", "spec": "§3.1", "passed": true, "errors": [] },
        { "id": "schema-validation", "spec": "§3", "passed": true, "errors": [] },
        { "id": "path-syntax", "spec": "§5.1", "passed": true, "errors": [] },
        { "id": "knowledge-ids", "spec": "§4.1", "passed": true, "errors": [] },
        { "id": "guardrail-ranges", "spec": "§3.4", "passed": true, "errors": [] }
      ]
    }
  ]
}
```

The schema is intentionally simple — flat enough to query with `jq` and stable across the v0.x protocol line.

## Use as a library

```javascript
const { runAll, runFile, discoverManifests } = require('frootai/conformance/lib');

const report = runAll('./my-plays', { recursive: true });
console.log(report.passed, 'of', report.manifestCount, 'passed');
```

Exported surface:

- `runAll(targetDir, opts?)` — scan + run all checks
- `runFile(filePath)` — run all 5 checks against a single manifest
- `discoverManifests(targetDir, opts?)` — list manifests in a directory
- Individual checks: `checkParse`, `checkSchema`, `checkPaths`, `checkKnowledge`, `checkGuardrails`
- Constants: `SUITE_VERSION`, `PROTOCOL_VERSION`, `VALID_WAF`, `FROOT_MODULES`

The library API is pure: no console output, no `process.exit`, returns structured result objects.

## Why this implementation exists

The canonical L0 suite lives in [github.com/frootai/frootai/tree/main/conformance](https://github.com/frootai/frootai/tree/main/conformance) as 5 standalone scripts. Those are the **reference implementation** that documents the spec. This bundled CLI implementation is a **conformant runner** — different code, same verdicts, on the same inputs.

Two compatible runners is exactly what conformance is FOR. If the CLI runner and the reference runner disagree on the same manifest, that's a spec-level conformance bug worth filing (see [RFC v1.0](https://github.com/frootai/frootai/blob/main/fai-protocol/RFC-v1.0.md)).

## Backward compatibility

Per [G.002 (backward compat sacred)](https://github.com/frootai/frootai/blob/main/frootai-blueprint/MASTER-IMPLEMENTATION-TRACKER.md): the v0.9-rc1 L0 check set and exit-code contract above is **frozen** for the v0.x line. The next protocol major (v1.0) adds new checks via new opt-in tiers (L1, L2, …), never changes existing L0 semantics.

## License

MIT — same as the rest of the FrootAI ecosystem. Forever.
