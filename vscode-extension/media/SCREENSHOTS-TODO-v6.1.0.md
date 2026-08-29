# Screenshots — capture TODO for v6.1.0 Marketplace listing (M11.14)

> **Status**: DRAFT. Capture before running `vsce publish` for v6.1.0.
> The README already references these PNG paths and will look broken on
> the Marketplace listing until the actual screenshots are committed.

## Why this file exists

The M11.14 row spec says "Update VS Code Marketplace listing description + screenshots; bump version banner". The description copy + version banner ship in this PR (README.md updates). The screenshots themselves are a UI-driven capture task that has to be done from a running VS Code with the v6.1.0 extension installed.

## Screenshots to capture

All targets land under [`media/`](.) alongside the existing `welcome_FAI.png`, `agent_FAI.png`, etc. Use the same dimensions + style as the existing captures (1360×800 viewport, default dark theme, no personal config visible).

| Filename | What to capture | Where to drop it |
|----------|-----------------|------------------|
| `federation_FAI.png` | Federation Explorer webview with `azure`, `github`, `playwright` attached. Show the tree + the trust posture line at the bottom. | New screenshot. Reference from a new section in `README.md` (TBD). |
| `federation_attach_FAI.png` | Command palette open with `frootai.federation.attach` highlighted, dropdown showing the 6 Tier-1 areas | New screenshot. Reference from the Federation Surface section. |
| `federation_trust_FAI.png` | Trust query webview showing the resolved verdict for an area (allow / prompt / blocked) with the manifest source | New screenshot. Reference from the Federation Surface section. |

## Capture procedure

```bash
# 1. Build + install the v6.1.0 VSIX locally
cd frootai-core/vscode-extension
npm install
npm run build
npx vsce package
code --install-extension frootai-vscode-6.1.0.vsix --force

# 2. Open a fresh VS Code window with a clean test workspace
code --new-window /tmp/frootai-test

# 3. Run the federation commands manually + take screenshots via the OS
#    (macOS: Cmd+Shift+4 → Space → click VS Code window)
#    (Windows: Win+Shift+S)
#    (Linux: gnome-screenshot --window)

# 4. Crop to 1360×800 (or letter-box if narrower) + save under media/
#    Use PNG, no JPEG. Match the file-naming convention above.

# 5. Reference the new PNGs from README.md per the table above
git add media/federation_*.png
git commit -m "M11.14 — Marketplace screenshots: federation explorer + attach + trust"
```

## After capture

Once the 3 PNGs land:

1. Add new image references in `README.md` (inline `<p align="center"><img src="..."></p>` blocks under the relevant subsections, matching the existing pattern used for `welcome_FAI.png` and `agent_FAI.png`).
2. Re-run the M11.7 verifier — it doesn't check images directly, but a manual `npx vsce package --no-yarn` should succeed with `--allow-missing-repository` flags off.
3. Re-run `npx vsce ls` to confirm the new files are in the published tarball.
4. Then publish: `npx vsce publish`.

## Why not generate them programmatically

Headless VS Code rendering is brittle and the Marketplace listing rejects screenshots that look obviously synthetic (wrong fonts, missing chrome). Captured screenshots from a real install are the only safe option for the public listing.
