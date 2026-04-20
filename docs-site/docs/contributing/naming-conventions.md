---
sidebar_position: 2
title: Naming Conventions
description: FrootAI naming conventions for all primitives — agents, instructions, skills, hooks, plugins, and manifests. All files use lowercase-hyphen format.
---

# Naming Conventions

All FrootAI primitives follow strict naming conventions enforced by `npm run validate:primitives`. The golden rule: **lowercase-hyphen for everything**.

## General Rules

- All files and folders use **lowercase-hyphen** (kebab-case)
- No underscores, no camelCase, no PascalCase
- No spaces in file or folder names
- UTF-8 encoding (no BOM) on all files

## Primitives by Type

### Agents (`.agent.md`)

```
agents/
├── fai-rag-architect.agent.md        ✅ lowercase-hyphen
├── fai-security-reviewer.agent.md    ✅ lowercase-hyphen
├── fai-play-01-builder.agent.md      ✅ play-specific agent
├── RagArchitect.agent.md             ❌ PascalCase
└── rag_architect.agent.md            ❌ underscore
```

**Naming pattern:** `fai-{name}.agent.md`

**Frontmatter requirements:**

```yaml
---
description: "10+ character description"  # Required
tools: ["codebase", "terminal"]           # Optional
model: ["gpt-4o", "gpt-4o-mini"]         # Optional (array)
waf: ["security", "reliability"]          # Optional
plays: ["01-enterprise-rag"]              # Optional
---
```

### Instructions (`.instructions.md`)

```
instructions/
├── waf-security.instructions.md          ✅
├── python-coding.instructions.md         ✅
├── rag-patterns.instructions.md          ✅
├── WAF_Security.instructions.md          ❌ PascalCase + underscore
└── security.md                           ❌ missing .instructions suffix
```

**Naming pattern:** `{name}.instructions.md`

**Frontmatter requirements:**

```yaml
---
description: "10+ character description"  # Required
applyTo: "**/*.{ts,js,py}"               # Required — glob pattern
waf: ["security"]                         # Optional
---
```

### Skills (`SKILL.md` in folder)

```
skills/
├── fai-play-initializer/
│   └── SKILL.md                          ✅ name matches folder
├── fai-rag-indexer/
│   ├── SKILL.md                          ✅
│   └── index.sh                          ✅ optional bundled assets
├── PlayInitializer/
│   └── SKILL.md                          ❌ PascalCase folder
└── fai-play-initializer.md               ❌ not in a folder
```

**Naming pattern:** `fai-{name}/SKILL.md` (folder name = skill name)

**Frontmatter requirements:**

```yaml
---
name: fai-play-initializer                # Required — must match folder
description: "10-1024 char description"   # Required
---
```

:::warning
The `name` field in SKILL.md frontmatter **must exactly match** the parent folder name. This is validated by CI.
:::

### Hooks (`hooks.json` in folder)

```
hooks/
├── frootai-secrets-scanner/
│   ├── hooks.json                        ✅
│   └── scan-secrets.sh                   ✅ referenced script
├── frootai-tool-guardian/
│   ├── hooks.json                        ✅
│   └── guard-tools.sh                    ✅
└── SecretsScanner/
    └── hooks.json                        ❌ PascalCase folder
```

**Naming pattern:** `{name}/hooks.json`

**Required fields:**

```json
{
  "version": 1,
  "hooks": [
    {
      "event": "SessionStart",
      "steps": [
        {
          "type": "shell",
          "command": "bash ${__dirname}/scan-secrets.sh"
        }
      ]
    }
  ]
}
```

### Plugins (`plugin.json` in folder)

```
plugins/
├── enterprise-rag/
│   ├── plugin.json                       ✅
│   └── README.md                         ✅ recommended
├── EnterpriseRAG/
│   └── plugin.json                       ❌ PascalCase folder
└── enterprise_rag/
    └── plugin.json                       ❌ underscore
```

**Naming pattern:** `{name}/plugin.json` (folder name = plugin name)

**Required fields:**

```json
{
  "name": "enterprise-rag",
  "description": "Complete RAG pipeline with security hooks",
  "version": "1.0.0",
  "author": { "name": "Your Name" },
  "license": "MIT"
}
```

:::info
The `name` field in `plugin.json` **must match** the parent folder name.
:::

### FAI Manifest (`fai-manifest.json`)

```json
{
  "play": "01-enterprise-rag",
  "version": "1.0.0"
}
```

- `play` field must match the folder name: `NN-kebab-case`
- `version` must be valid semver: `X.Y.Z`

### FAI Context (`fai-context.json`)

Placed as a sibling to standalone primitives:

```
agents/
├── fai-rag-architect.agent.md
└── fai-rag-architect/
    └── fai-context.json
```

## Solution Play Folders

```
solution-plays/
├── 01-enterprise-rag/                    ✅ NN-kebab-case
├── 02-ai-landing-zone/                   ✅
├── enterprise-rag/                       ❌ missing number prefix
└── 01_enterprise_rag/                    ❌ underscore
```

**Pattern:** `NN-kebab-case` where `NN` is a two-digit number (01–99).

## Validation

Run the validation script to check all naming conventions:

```bash
npm run validate:primitives
```

This checks every primitive file in the repository for:
- Correct file extensions and naming patterns
- Required frontmatter fields
- Name-to-folder matching for skills and plugins
- Valid lifecycle events for hooks

## Next Steps

- **[PR Checklist](./pr-checklist)** — full validation requirements for PRs
- **[How to Contribute](./how-to-contribute)** — the contribution workflow
