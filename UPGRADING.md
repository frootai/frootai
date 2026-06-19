# Upgrading from FrootAI Action v5 to v6

## What's new in v6

FrootAI Action v6 adds **MCP federation** — the ability to pre-attach
Tier-1 MCP areas (Azure, Playwright, MS Learn) so evaluations, validations,
and cost estimates run with full federated context from external knowledge
sources.

**v6 is fully backward compatible.** Existing v5 workflow YAML runs
unchanged against the v6 action — all new inputs have safe defaults and
federation outputs default to `[]` / `0` when not used.

## Migration (2 lines)

Change your action reference from `v5` to `v6` and add `mcp-attach`:

```diff
 - uses: frootai/frootai@v5
+ - uses: frootai/frootai@v6
   with:
     command: evaluate
     play: 01-enterprise-rag
+    mcp-attach: azure
+    version: '6.0.0-alpha.2'
```

That's it. Two lines added, zero lines removed.

## New inputs

| Input | Default | Description |
|-------|---------|-------------|
| `mcp-attach` | _(empty)_ | Comma-separated areas to pre-attach: `azure`, `playwright`, `ms_learn` |
| `mcp-trust-file` | _(empty)_ | Path to trust-override JSON (relative to repo root) |
| `mcp-federation` | `on` | Kill-switch: set to `off` to disable federation entirely |

## New outputs

| Output | Default | Description |
|--------|---------|-------------|
| `mcp-attached` | `[]` | JSON array of areas that successfully attached |
| `mcp-tools-count` | `0` | Total MCP tools registered across attached areas |

## Auto-attach from Play manifest

If your play includes a `spec/mcp-scope.json` with an `attached` array,
the action auto-populates `mcp-attach` — no workflow change needed:

```json
{
  "attached": ["azure"],
  "router_config": { "trust_overrides": {} }
}
```

## Secrets handling

Area-specific credentials use the `FROOTAI_SECRET_*` env-var convention:

```yaml
env:
  FROOTAI_SECRET_AZURE_KEY: ${{ secrets.AZURE_KEY }}
```

All `FROOTAI_*` values are automatically masked in logs.

## Staying on v5

If you're not ready to adopt federation, simply keep `frootai/frootai@v5`.
The v5 branch continues to receive bug fixes. When you're ready, the
migration is the 2-line diff above.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `mcp-attached` is `[]` despite `mcp-attach` being set | Ensure `version` is `6.0.0-alpha.2` or later |
| `::error:: Federation attach failed for area: X` | Area name typo — valid values: `azure`, `playwright`, `ms_learn` |
| Trust file warning | Check the `mcp-trust-file` path exists relative to repo root |
| Action fails on Windows runner | Ensure `shell: bash` is available (default on GitHub-hosted runners) |
