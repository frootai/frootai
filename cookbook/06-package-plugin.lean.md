# Recipe 6: Package a FrootAI Plugin

> Bundle agents, instructions, skills, and hooks into an installable plugin for the FrootAI Marketplace.

## Prerequisites

- Node.js 22+ installed
- FrootAI repo cloned (`git clone https://github.com/frootai/frootai`)
- Existing primitives to bundle, or create new ones via recipes 1–5
- Familiarity with semantic versioning (`MAJOR.MINOR.PATCH`)

## What You'll Build

`document-intelligence`, bundling:

- 2 agents: document processor + extraction reviewer
- 2 instructions: Python WAF + Azure AI Services guidance
- 1 skill: document indexer
- 1 hook: PII redactor
- Marketplace metadata
- CI/CD for automated publishing

---

## Steps

### 1. Create the Plugin Folder Structure

Every plugin lives under `plugins/` and must match this layout:

```bash
mkdir -p plugins/document-intelligence
```

```
plugins/document-intelligence/
├── plugin.json          # Required — plugin manifest
├── README.md            # Required — user-facing documentation
├── CHANGELOG.md         # Recommended — version history
└── assets/              # Optional — icons, screenshots
    └── icon.png
```

The folder name **must** be lowercase-hyphen and match `name` in `plugin.json`.

### 2. Create `plugin.json` with All Fields

```json
{
  "name": "document-intelligence",
  "description": "End-to-end document processing pipeline with Azure AI Document Intelligence, OCR extraction, structured output parsing, PII detection, and WAF-aligned evaluation. Includes specialized agents for multi-format document handling.",
  "version": "1.0.0",
  "author": {
    "name": "FrootAI Contributors",
    "email": "hello@frootai.dev",
    "url": "https://frootai.dev"
  },
  "repository": "https://github.com/frootai/frootai",
  "homepage": "https://frootai.dev/plugins/document-intelligence",
  "license": "MIT",
  "keywords": [
    "document-intelligence",
    "ocr",
    "extraction",
    "azure-ai",
    "pdf-processing",
    "structured-output",
    "pii-detection",
    "waf-aligned"
  ],
  "agents": [
    "../../agents/frootai-document-processor.agent.md",
    "../../agents/frootai-extraction-reviewer.agent.md"
  ],
  "instructions": [
    "../../instructions/python-waf.instructions.md",
    "../../instructions/azure-ai-services.instructions.md"
  ],
  "skills": [
    "../../skills/frootai-document-indexer/"
  ],
  "hooks": [
    "../../hooks/frootai-pii-redactor/"
  ],
  "plays": [
    "18-multi-modal-docproc",
    "11-document-intelligence"
  ]
}
```

### 3. Understand the `plugin.json` Schema

Validated by `schemas/plugin.schema.json`:

| Field | Required | Type | Rules |
|-------|----------|------|-------|
| `name` | ✅ | string | `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`, 3–64 chars, must match folder |
| `description` | ✅ | string | 10–500 chars, shown in marketplace |
| `version` | ✅ | string | Semver: `MAJOR.MINOR.PATCH` or `1.0.0-beta.1` |
| `author` | ✅ | object | `author.name` required; `email`, `url` optional |
| `license` | ✅ | string | SPDX identifier (`MIT`, `Apache-2.0`) |
| `repository` | | string | GitHub URL |
| `homepage` | | string | Plugin docs URL |
| `keywords` | | array | Lowercase-hyphen tags, max 20, unique |
| `agents` | | array | Relative paths to `.agent.md` files |
| `instructions` | | array | Relative paths to `.instructions.md` files |
| `skills` | | array | Relative paths to skill folders (trailing `/`) |
| `hooks` | | array | Relative paths to hook folders (trailing `/`) |
| `plays` | | array | Solution play IDs this plugin supports |

### 4. Write the Plugin README

Create `plugins/document-intelligence/README.md`:

```markdown
# Document Intelligence Plugin

End-to-end document processing for enterprise workloads.

## What's Included

| Primitive | Name | Purpose |
|-----------|------|---------|
| Agent | frootai-document-processor | Multi-format document ingestion and OCR |
| Agent | frootai-extraction-reviewer | Validates extracted data against schemas |
| Instruction | python-waf | WAF-aligned Python coding patterns |
| Instruction | azure-ai-services | Azure AI Services best practices |
| Skill | frootai-document-indexer | Index extracted documents into AI Search |
| Hook | frootai-pii-redactor | Redact PII before storage or output |

## Compatible Plays

- Play 18: Multi-Modal Document Processing
- Play 11: Document Intelligence

## Quick Start

1. Install the plugin: `npm run materialize:plugins`
2. Reference in your `fai-manifest.json` under `primitives.plugins`
3. Run: `node engine/index.js your-play/fai-manifest.json --status`
```

### 5. Validate the Plugin

Run the validator:

```bash
npm run validate:primitives
```

Expected valid output:

```
✅ plugins/document-intelligence/plugin.json — valid
   Name:    document-intelligence
   Version: 1.0.0
   Items:   2 agents, 2 instructions, 1 skill, 1 hook
```

Common errors:

| Error | Fix |
|-------|-----|
| `name must match pattern` | Use only lowercase letters, numbers, hyphens |
| `description too short` | Write at least 10 characters |
| `version must match pattern` | Use `X.Y.Z` format (e.g., `1.0.0`) |
| `author.name is required` | Add `"author": { "name": "..." }` |
| `agents[0] path not found` | Ensure the referenced file exists at the relative path |

### 6. Regenerate the Marketplace

After validation, register the plugin:

```bash
node scripts/generate-marketplace.js
```

Verify it appears in `marketplace.json`:

```bash
node -e "
  const m = require('./marketplace.json');
  const p = m.plugins.find(p => p.name === 'document-intelligence');
  if (p) {
    console.log('✅ Found:', p.name, 'v' + p.version);
    console.log('   Items:', JSON.stringify(p.items));
    console.log('   Keywords:', p.keywords.join(', '));
  } else {
    console.log('❌ Not found in marketplace.json');
  }
"
```

### 7. Test the Plugin Locally

Materialize to confirm paths resolve:

```bash
# Dry run — shows what would be copied without making changes
node scripts/materialize-plugins.js --dry-run

# Full materialize — copies primitives into .github/ structure
node scripts/materialize-plugins.js
```

Load a compatible play and verify wiring:

```bash
node engine/index.js solution-plays/18-multi-modal-docproc/fai-manifest.json --status
```

### 8. Versioning Strategy

Use semantic versioning for all releases:

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| Bug fix in agent prompt | PATCH | `1.0.0` → `1.0.1` |
| Add new instruction | MINOR | `1.0.1` → `1.1.0` |
| Remove an agent or rename paths | MAJOR | `1.1.0` → `2.0.0` |
| Pre-release testing | PRERELEASE | `2.0.0-beta.1` |

Update `plugin.json` **and** add a `CHANGELOG.md` entry:

```markdown
## [1.1.0] - 2026-04-06
### Added
- azure-ai-services instruction for Document Intelligence best practices
### Changed
- Updated document-processor agent with improved OCR prompts
```

### 9. CI/CD for Plugin Publishing

Add `.github/workflows/publish-plugin.yml`:

```yaml
name: Validate & Publish Plugin
on:
  push:
    paths:
      - 'plugins/document-intelligence/**'
  pull_request:
    paths:
      - 'plugins/document-intelligence/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npm run validate:primitives
      - run: node scripts/generate-marketplace.js
      - name: Verify plugin in marketplace
        run: |
          node -e "
            const m = require('./marketplace.json');
            const p = m.plugins.find(p => p.name === 'document-intelligence');
            if (!p) { console.error('Plugin missing from marketplace'); process.exit(1); }
            console.log('✅', p.name, 'v' + p.version, '— items:', JSON.stringify(p.items));
          "

  publish:
    needs: validate
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: node scripts/materialize-plugins.js
      - run: npm run generate:marketplace
      - name: Commit updated marketplace
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "actions@github.com"
          git add marketplace.json
          git diff --cached --quiet || git commit -m "chore: update marketplace for document-intelligence"
          git push
```

### 10. Register in a Solution Play

Reference the plugin in any compatible play’s `fai-manifest.json`:

```json
{
  "play": "18-multi-modal-docproc",
  "version": "1.0.0",
  "primitives": {
    "agents": ["../../agents/frootai-document-processor.agent.md"],
    "instructions": ["../../instructions/python-waf.instructions.md"],
    "skills": ["../../skills/frootai-document-indexer/"],
    "hooks": ["../../hooks/frootai-pii-redactor/"],
    "plugins": ["../../plugins/document-intelligence/"]
  }
}
```

---

## Validation Checklist

Run after creating any plugin:

```bash
# 1. Schema validation
npm run validate:primitives

# 2. Marketplace regeneration
node scripts/generate-marketplace.js

# 3. Consistency check across all data sources
node scripts/validate-consistency.js

# 4. Materialize dry run
node scripts/materialize-plugins.js --dry-run

# 5. Full build pipeline (validates + generates + updates README)
npm run build
```

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| `name must match pattern` | Uppercase or underscores in name | Rename folder and `name` to lowercase-hyphen |
| Plugin not in marketplace | Forgot to regenerate | Run `node scripts/generate-marketplace.js` |
| `agents[0] path not found` | Wrong relative path | Paths are relative to `plugin.json` location |
| Materialize copies nothing | No matching plugin folder | Ensure folder name matches `name` field exactly |
| Version validation fails | Missing patch number | Use full semver: `1.0.0` not `1.0` |
| Keywords rejected | Uppercase or special chars | Use only `[a-z0-9-]` per keyword |
| CI fails on marketplace check | Plugin not committed | Commit both `plugin.json` and referenced primitives |

---

## Best Practices

1. **One plugin per domain** — bundle related primitives only; `enterprise-rag` is RAG-specific, `document-intelligence` is document-specific.
2. **Always include a README** — marketplace uses it as the plugin detail page.
3. **Reference real primitives** — every `agents`, `instructions`, `skills`, `hooks` path must exist; broken paths fail validation.
4. **Use 5–15 keywords** — enough for discovery, not noise.
5. **Tag compatible plays** — `plays` helps users find matching plugins.
6. **Version on every change** — never ship without bumping the version; marketplace tracks history.
7. **Test with the engine** — run `node engine/index.js` against a manifest that includes the plugin.
8. **Keep `CHANGELOG` updated** — consumers need version-to-version changes.
