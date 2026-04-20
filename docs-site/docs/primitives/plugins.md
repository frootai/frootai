---
sidebar_position: 5
title: Plugins
description: Bundle agents, instructions, skills, and hooks into installable packages — the distribution format for FrootAI DevKit primitives.
---

# Plugins

Plugins are **themed bundles** of agents, instructions, skills, and hooks. They are the distribution format for FrootAI primitives — installable packages that ship via the FrootAI Marketplace.

## Plugin Structure

Every plugin lives under `plugins/` with this layout:

```
plugins/document-intelligence/
├── plugin.json          # Required — plugin manifest
├── README.md            # Required — user-facing documentation
├── CHANGELOG.md         # Recommended — version history
└── assets/              # Optional — icons, screenshots
    └── icon.png
```

The folder name **must** be lowercase-hyphen and match the `name` field in `plugin.json`.

## plugin.json Schema

```json title="plugins/document-intelligence/plugin.json"
{
  "name": "document-intelligence",
  "description": "End-to-end document processing pipeline with Azure AI Document Intelligence, OCR extraction, and PII detection.",
  "version": "1.0.0",
  "author": {
    "name": "FrootAI Contributors",
    "email": "hello@frootai.dev",
    "url": "https://frootai.dev"
  },
  "repository": "https://github.com/frootai/frootai",
  "license": "MIT",
  "keywords": ["document-intelligence", "ocr", "extraction", "pii-detection"],
  "agents": [
    "../../agents/fai-document-processor.agent.md",
    "../../agents/fai-extraction-reviewer.agent.md"
  ],
  "instructions": [
    "../../instructions/python-waf.instructions.md"
  ],
  "skills": [
    "../../skills/fai-document-indexer/"
  ],
  "hooks": [
    "../../hooks/fai-pii-redactor/"
  ],
  "plays": ["06", "15"]
}
```

## Required Fields

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`, 3–64 chars, must match folder |
| `description` | string | 10–500 characters |
| `version` | string | Semver: `MAJOR.MINOR.PATCH` (e.g., `1.0.0`) |
| `author.name` | string | Required |
| `license` | string | SPDX identifier (`MIT`, `Apache-2.0`) |

## Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `author.email` | string | Contact email |
| `author.url` | string | Author website |
| `repository` | string | GitHub URL |
| `homepage` | string | Plugin docs URL |
| `keywords` | string[] | Lowercase-hyphen tags, max 20 |
| `agents` | string[] | Relative paths to `.agent.md` files |
| `instructions` | string[] | Relative paths to `.instructions.md` files |
| `skills` | string[] | Relative paths to skill folders (trailing `/`) |
| `hooks` | string[] | Relative paths to hook folders (trailing `/`) |
| `plays` | string[] | Compatible solution play IDs |

:::info Plugins as DevKit Distribution
Plugins are how DevKit primitives are distributed. Design your skill and agent bundles so they can be extracted as standalone plugins for the marketplace.
:::

## Versioning Strategy

Follow semantic versioning for all releases:

| Change Type | Version Bump | Example |
|-------------|-------------|---------|
| Bug fix in agent prompt | PATCH | `1.0.0` → `1.0.1` |
| Add new instruction | MINOR | `1.0.1` → `1.1.0` |
| Remove an agent or rename paths | MAJOR | `1.1.0` → `2.0.0` |
| Pre-release testing | PRERELEASE | `2.0.0-beta.1` |

## Creating a Plugin

1. Create the folder: `mkdir -p plugins/my-plugin`
2. Create `plugin.json` with required fields
3. Create `README.md` documenting what's included
4. Reference existing primitives via relative paths
5. Validate: `npm run validate:primitives`
6. Regenerate marketplace: `node scripts/generate-marketplace.js`

## Registering in the Marketplace

After validation, add your plugin to the marketplace:

```bash
# Validate schema compliance
npm run validate:primitives

# Regenerate marketplace index
node scripts/generate-marketplace.js

# Verify your plugin appears
node -e "
  const m = require('./marketplace.json');
  const p = m.plugins.find(p => p.name === 'my-plugin');
  console.log(p ? '✅ Found: ' + p.name : '❌ Not found');
"
```

## Referencing in a Play

```json title="fai-manifest.json"
{
  "primitives": {
    "plugins": ["../../plugins/document-intelligence/"]
  }
}
```

## Validation

```bash
npm run validate:primitives
```

Common errors:

| Error | Fix |
|-------|-----|
| `name must match pattern` | Use only lowercase letters, numbers, hyphens |
| `description too short` | Write at least 10 characters |
| `version must match pattern` | Use `X.Y.Z` format |
| `author.name is required` | Add `"author": { "name": "..." }` |
| `agents[0] path not found` | Ensure referenced file exists at the relative path |

## See Also

- [Package a Plugin Guide](/docs/guides/package-plugin) — step-by-step tutorial
- [Skills](/docs/primitives/skills) — skills bundled in plugins
- [Hooks](/docs/primitives/hooks) — hooks bundled in plugins
