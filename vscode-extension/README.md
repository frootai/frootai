# `vscode-extension/` — Asset CDN only

> **This folder is the asset CDN for the published `frootai-vscode` VS Code extension. The extension SOURCE lives elsewhere — do not author code here.**

## What this is

The 7 image files under `media/` are screenshots referenced by the public docs site at `frootai.dev/distribution/vscode-extension` via `raw.githubusercontent.com/frootai/frootai/main/vscode-extension/media/*.png`. Keeping them in this repo lets the docs site hot-link a stable URL.

| File | Used by |
|------|---------|
| `media/agent_FAI.png` | Agent FAI chat screenshot |
| `media/catalog_FAI.png` | Primitives Catalog screenshot |
| `media/configurator_FAI.png` | Solution Configurator screenshot |
| `media/frootai-mark.png` | Branding mark |
| `media/icon.svg` | Extension icon |
| `media/solutionplay_FAI.png` | Solution Play browser screenshot |
| `media/welcome_FAI.png` | Welcome panel screenshot |

## What this is NOT

- **NOT** the extension source code. The canonical implementation (TypeScript, package.json, build pipeline, published as `frootai-vscode@5.1.8` on the VS Code Marketplace) lives at [`frootai-core/vscode-extension/`](https://github.com/frootai/frootai-core/tree/main/vscode-extension) — 21,000+ files including `src/extension.ts`, `src/extension.js`, `src/legacy.js`, `src/types.ts`, plus a populated `media/` mirror.
- **NOT** a place to add new extension features. Open PRs against `frootai-core/vscode-extension/` instead.
- **NOT** a place to add new screenshots independently — the canonical extension at `frootai-core/vscode-extension/media/` carries the same 7 files byte-identical; keep both in sync if you add a new asset.

## Contributing

To work on the VS Code extension itself: see [`frootai-core/vscode-extension/`](https://github.com/frootai/frootai-core/tree/main/vscode-extension) and its `package.json` build scripts.
