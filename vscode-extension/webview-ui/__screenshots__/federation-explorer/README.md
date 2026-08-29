# Federation Explorer — Visual Regression Goldens

Per **M5.27**, this directory holds the canonical golden screenshots for the
[`FederationExplorer.tsx`](../../src/panels/FederationExplorer.tsx) React webview component. The
M5.27 ship establishes:

- **[`manifest.json`](manifest.json)** — the canonical list of 5 golden states the visual-diff
  pipeline targets. Each state ships dark + light theme variants.
- **CI workflow** — [`vscode-federation-visual-regression.yml`](../../../.github/workflows/vscode-federation-visual-regression.yml)
  triggers on every PR touching `FederationExplorer.tsx` (or its pure-core sibling).

## Golden States (row-literal pin)

| ID | Theme variants | State |
|---|---|---|
| `catalog-empty` | dark + light | Catalog tab, marketplace fetch in flight, empty area list |
| `catalog-filtered` | dark + light | Catalog tab, first-party-ms tier filter active, 3 entries visible |
| `attached-empty` | dark + light | Attached tab, no areas, empty-state copy with discover affordance |
| `attached-list` | dark + light | Attached tab, azure + playwright attached, fresh idle timers |
| `warning-state` | dark + light | Attached tab, azure at 9.5min / 10min idle (M5.19 amber warning) |

## Baseline capture (future work)

Today the M5.27 workflow validates only the **manifest shape** — the canonical
roster + resolution + theme variants — via
[`visual-regression-core.js#checkGoldenManifest`](../../src/commands/visual-regression-core.js).

Capturing actual PNG baselines requires a Playwright Component Testing harness
(or equivalent) running the React component in headless Chromium with the
two VS Code theme tokens applied. When that harness lands, the baseline PNGs
will be committed alongside `manifest.json` as `<id>.<theme>.png` (e.g.
`catalog-empty.dark.png` / `catalog-empty.light.png`) — 10 files total
(5 states × 2 themes).

## Drift detection

Any change to the canonical golden roster (renaming, reordering, adding,
removing) trips the [`vscode-mcp-visual-regression.test.js`](../../../../scripts/orchard/test/vscode-mcp-visual-regression.test.js)
gate via the `checkGoldenManifest` validator. Ship a manifest update + the
matching new baseline PNG together; never commit a manifest drift without
the corresponding baseline.
