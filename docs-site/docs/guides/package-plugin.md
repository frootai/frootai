---
sidebar_position: 8
title: Package a Plugin
description: Bundle agents, instructions, skills, and hooks into an installable plugin for the FrootAI Marketplace.
---

# Package a Plugin

Bundle related primitives into a distributable plugin with marketplace metadata, validation, and CI/CD publishing.

## Prerequisites

- Node.js 22+
- FrootAI repo cloned
- Existing primitives to bundle

## Step 1: Create the Plugin Folder

```bash
mkdir -p plugins/document-intelligence
```

```
plugins/document-intelligence/
├── plugin.json          # Required — plugin manifest
├── README.md            # Required — documentation
├── CHANGELOG.md         # Recommended — version history
└── assets/              # Optional — icons
```

## Step 2: Create plugin.json

```json title="plugins/document-intelligence/plugin.json"
{
  "name": "document-intelligence",
  "description": "End-to-end document processing with Azure AI Document Intelligence, OCR, and PII detection.",
  "version": "1.0.0",
  "author": {
    "name": "FrootAI Contributors",
    "url": "https://frootai.dev"
  },
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

## Step 3: Required Fields

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | Lowercase-hyphen, 3–64 chars, must match folder |
| `description` | string | 10–500 characters |
| `version` | string | Semver: `MAJOR.MINOR.PATCH` |
| `author.name` | string | Required |
| `license` | string | SPDX identifier (`MIT`, `Apache-2.0`) |

## Step 4: Write the README

```markdown title="plugins/document-intelligence/README.md"
# Document Intelligence Plugin

End-to-end document processing for enterprise workloads.

## What's Included
| Primitive | Name | Purpose |
|-----------|------|---------|
| Agent | fai-document-processor | Multi-format document ingestion |
| Agent | fai-extraction-reviewer | Validates extracted data |
| Instruction | python-waf | WAF-aligned Python patterns |
| Skill | fai-document-indexer | Index documents into AI Search |
| Hook | fai-pii-redactor | Redact PII before storage |
```

## Step 5: Validate

```bash
npm run validate:primitives
```

Fix common errors:

| Error | Fix |
|-------|-----|
| `name must match pattern` | Use only lowercase, numbers, hyphens |
| `description too short` | Write at least 10 characters |
| `author.name is required` | Add `"author": { "name": "..." }` |
| `agents[0] path not found` | Ensure referenced file exists |

## Step 6: Regenerate Marketplace

```bash
node scripts/generate-marketplace.js

# Verify
node -e "
  const m = require('./marketplace.json');
  const p = m.plugins.find(p => p.name === 'document-intelligence');
  console.log(p ? '✅ Found: ' + p.name : '❌ Not found');
"
```

## Step 7: Versioning

| Change Type | Bump | Example |
|-------------|------|---------|
| Bug fix in agent prompt | PATCH | `1.0.0` → `1.0.1` |
| Add new instruction | MINOR | `1.0.1` → `1.1.0` |
| Remove agent or rename paths | MAJOR | `1.1.0` → `2.0.0` |

## Step 8: Reference in a Play

```json title="fai-manifest.json"
{
  "primitives": {
    "plugins": ["../../plugins/document-intelligence/"]
  }
}
```

## Best Practices

1. **One plugin per domain** — bundle related primitives, not everything
2. **Always include a README** — the marketplace displays it as the detail page
3. **Reference real primitives** — broken paths fail validation
4. **Version on every change** — never ship without bumping
5. **Keep CHANGELOG updated** — consumers need to know what changed

## See Also

- [Plugins Reference](/primitives/plugins) — full plugin specification
- [Create a Skill](/guides/create-skill) — skills for plugins
- [Create an Agent](/guides/create-agent) — agents for plugins
