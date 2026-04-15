# FrootAI Content Source Map

> Which file is the **source of truth** for each data point, and what files reference it.

This is the map that `sync-content.js` and `validate-consistency.js` use to keep everything in sync.

---

## Sources of Truth

| Data Point | Source of Truth | Referenced By |
|-----------|----------------|---------------|
| **MCP version** | `mcp-server/package.json` → `version` | README.md, functions/server.js, website, Docker tags |
| **Extension version** | `vscode-extension/package.json` → `version` | functions/server.js, website |
| **Tool count** | `mcp-server/index.js` → `server.tool()` calls | README.md, mcp-server/package.json description, vscode-extension/package.json description, vscode-extension sidebar view name, website /mcp-tooling page |
| **Command count** | `vscode-extension/package.json` → `contributes.commands[]` | README.md |
| **Module count** | `mcp-server/knowledge.json` → `modules` keys | README.md, mcp-server/package.json description |
| **Play count** | `solution-plays/` → directory count | README.md, mcp-server/package.json description |
| **Homepage URL** | `https://frootai.dev` | mcp-server/package.json homepage, README.md |
| **Repository URL** | `https://github.com/frootai/frootai` | mcp-server/package.json repository, README.md |
| **Copyright** | `LICENSE`, `NOTICE` | All published packages |

---

## Downstream Files (auto-updated by sync-content.js)

| File | What Gets Updated |
|------|-------------------|
| `README.md` | Version refs (`@X.Y.Z`), tool count, command count, module count, play count |
| `mcp-server/package.json` | Description (tool count, module count, play count) |
| `vscode-extension/package.json` | Description (tool count, module count, play count), sidebar view name |
| `functions/server.js` | MCP version ref, extension version ref, tool count |

---

## Automation Chain

```
Code change (index.js, package.json, knowledge.json, solution-plays/)
  │
  ├─ Pre-commit hook (.husky/pre-commit)
  │   ├─ node scripts/sync-content.js     ← auto-updates downstream files
  │   └─ node scripts/validate-consistency.js  ← blocks if drift detected
  │
  ├─ PR guard (version-check.yml)         ← blocks merge if versions mismatch
  ├─ PR guard (content-sync.yml)          ← blocks merge if counts drift
  ├─ Push guard (consistency-check.yml)   ← runs on every push to main
  │
  └─ Release (scripts/release.js)
      ├─ Bumps versions in package.json files
      ├─ Runs sync-content.js
      ├─ Runs validate-consistency.js
      ├─ Generates CHANGELOG.md
      └─ Tags → triggers npm-publish, vsce-publish, docker-publish, release.yml
```

---

## Adding a New Data Point

1. Add the source of truth to `validate-consistency.js` (read + check)
2. Add the sync logic to `sync-content.js` (read source → update downstream)
3. Update this document
4. Test: `node scripts/sync-content.js && node scripts/validate-consistency.js`

---

## Build Scripts Inventory (18 scripts)

### Core Pipeline

| Script | Purpose | npm Script |
|--------|---------|-----------|
| `validate-primitives.js` | Validate all agents/instructions/skills/hooks/plugins against schemas | `npm run validate:primitives` |
| `validate-consistency.js` | Check version + count consistency across packages | `npm run validate` |
| `generate-marketplace.js` | Build `marketplace.json` from plugins/ folder | `npm run generate:marketplace` |
| `generate-website-data.js` | Extract metadata for frootai.dev website JSON feeds | `npm run generate:website-data` |
| `update-readme.js` | Auto-update README badge counts | `npm run update:readme` |
| `materialize-plugins.js` | Copy referenced primitives into plugin dist/ folders | `npm run materialize` |
| `scaffold-primitive.js` | Interactive CLI to create agents, skills, instructions, hooks | `npm run scaffold` |
| `sync-content.js` | Propagate version/count changes to downstream files | `npm run sync` |
| `release.js` | Bump versions, sync, validate, commit, tag | `npm run release` |
| `deploy-play.sh/.ps1` | Deploy play infrastructure to Azure | manual |
| `export-skills.sh/.ps1` | Export skills for distribution | manual |
| `rebuild-knowledge.sh/.ps1` | Rebuild MCP knowledge.json from docs/ | manual |

### Content Sprint Scripts (6)

| Script | What It Generated |
|--------|-------------------|
| `generate-agents-sprint.js` + sprint2 + sprint3 | 238 agents |
| `generate-instructions-sprint.js` + sprint2 + sprint3 | 176 instructions |
| `generate-skills-sprint.js` + sprint2 | 322 skills |
| `generate-plugins-sprint.js` | 77 plugins |

### Full Build Pipeline

```bash
# One command to validate + generate + update everything
npm run build

# Which runs:
# 1. node scripts/validate-primitives.js    → 2510 checks
# 2. node scripts/generate-marketplace.js   → marketplace.json
# 3. node scripts/generate-website-data.js  → website-data/*.json
# 4. node scripts/update-readme.js          → README badge counts
```
