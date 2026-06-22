# `foundry-agent/` — DEPRECATED MIRROR (M8.28)

> ⚠️ **This folder is a byte-identical mirror of the canonical source at [`frootai-core/foundry-agent/`](https://github.com/frootai/frootai-core/tree/main/foundry-agent).**
>
> **Soft deprecation:** 2026-06-19 → 2026-07-19 (30 days).
> **Backward-compat window:** through **2026-09-17** (90 days from deprecation).
>
> See [MIGRATION.md](./MIGRATION.md) for the migration path.

## TL;DR

- All files in this folder (`agent.py`, `federation_client.py`, `prompt_builder.py`, `.foundry/agent.yaml`) are **byte-identical mirrors** of their canonical counterparts under `frootai-core/foundry-agent/`.
- Direct edits here will be **reverted** by the next [`sync-agent-copy.mjs`](https://github.com/frootai/frootai-core/blob/main/scripts/foundry/sync-agent-copy.mjs) run, enforced by the CI byte-identity assertion.
- Make all changes in the canonical copy. See the [consolidation guide](https://github.com/frootai/frootai-core/blob/main/docs/internal/foundry-agent-consolidation.md).

## Why does this folder still exist?

To preserve backward compatibility for deployment scripts and Foundry workspaces that pin this path. The mirror will be **removed on 2026-09-17** — please migrate your tooling within the window.

## What this is — full reference

For the live documentation (federation env-var matrix, sample `mcp-scope.json`, test suite, deployment script), see the **canonical README** at:

→ <https://github.com/frootai/frootai-core/blob/main/foundry-agent/README.md>

## Migration

See [MIGRATION.md](./MIGRATION.md) for the path-update recipe + timeline.
