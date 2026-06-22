# [M8.28] DEPRECATION NOTICE — Foundry Agent Mirror Path

> **Effective 2026-06-19. Deprecation expires 2026-07-19 (30 days). Backward-compat path removed 2026-09-17 (90 days).**

## What changed

This folder (`frootai/foundry-agent/`) is no longer the source of truth for the FrootAI Foundry hosted prompt agent. The canonical implementation now lives in the sister repo at:

```
frootai-core/foundry-agent/
```

The files in this folder are **byte-identical mirrors** maintained automatically by [`scripts/foundry/sync-agent-copy.mjs`](https://github.com/frootai/frootai-core/blob/main/scripts/foundry/sync-agent-copy.mjs) and CI byte-identity assertion ([`foundry-agent-sync-check.yml`](https://github.com/frootai/frootai-core/blob/main/.github/workflows/foundry-agent-sync-check.yml)). Direct edits will be reverted on the next sync run.

## Timeline

| Date | Status | Action |
|------|--------|--------|
| **2026-06-19** | Deprecation announced | Mirror is byte-identical to canonical; this notice ships in `MIGRATION.md` and `README.md` |
| **2026-07-19** (30 days) | Soft deprecation ends | New tooling defaults to the canonical path; mirror still works as a runtime target |
| **2026-09-17** (90 days) | Backward-compat removed | Mirror may be removed; deployment scripts referencing this path will fail loudly |

During the 90-day window, both paths resolve to the same code. **Use the window to migrate your deployment scripts before 2026-09-17.**

## What you need to do

### If you have a Foundry deployment script

Change the source path:

```diff
- python frootai/foundry-agent/agent.py
+ python frootai-core/foundry-agent/agent.py
```

Or, preferred:

```bash
# Use the canonical deploy script (M8.18) — handles config, sync check, changelog
bash frootai-core/scripts/foundry/deploy.sh
```

### If you reference this folder in CI / azure.yaml

Update the path to point at `frootai-core/foundry-agent/`. The deployment manifest lives at [`frootai-core/foundry-agent/.foundry/agent.yaml`](https://github.com/frootai/frootai-core/blob/main/foundry-agent/.foundry/agent.yaml) (M8.10).

### If you import from this folder

There is no import surface here — the file is a script, not a package. The canonical script under `frootai-core/foundry-agent/` is the import-equivalent.

## Why the move

The canonicalization is part of M8 phase delivery (`federation-foundry-v0.8.0`):

- **Single source of truth.** Previously, two near-identical copies could drift. Now there is one canonical + a generated mirror (M8.2 / M8.3).
- **CI assertion** catches any drift in seconds (`sync-agent-copy.mjs --check`, ran on every PR + daily).
- **Federation surface** now lives next to the python-sdk (`frootai-core/python-sdk/frootai/federation/`) so the agent can wrap `FederationClient` cleanly (M8.4).

## Reading list

- [foundry-agent README (canonical)](https://github.com/frootai/frootai-core/blob/main/foundry-agent/README.md) — env-var matrix, sample play scope (M8.20)
- [Consolidation guide](https://github.com/frootai/frootai-core/blob/main/docs/internal/foundry-agent-consolidation.md) — full canonicalization doctrine (M8.1 + M8.27)
- [ecosystem-mapping.md §7](https://github.com/frootai/frootai-planning/blob/main/planning/fai-mcp-expansion/ecosystem-mapping.md) — shipped status note

## Questions?

Open an issue at [frootai/frootai-core](https://github.com/frootai/frootai-core/issues) with the `foundry-agent` label.
