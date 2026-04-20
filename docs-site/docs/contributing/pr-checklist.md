---
sidebar_position: 3
title: PR Checklist
description: Pull request validation checklist for FrootAI contributions — file naming, frontmatter, schema validation, secrets scanning, and WAF alignment.
---

# PR Checklist

Every pull request to FrootAI is validated by CI automation. Use this checklist before submitting to ensure a smooth review.

## Automated CI Checks

These checks run automatically on every PR:

| Pipeline | What It Validates |
|----------|------------------|
| `validate-primitives.yml` | Schema, naming, frontmatter, secrets scan |
| `validate-plays.yml` | Solution play structure (4-kit model) |
| `auto-generate.yml` | Regenerates marketplace.json on merge |

## Pre-Submit Checklist

### ✅ File Naming

```bash
# Run validation
npm run validate:primitives
```

- [ ] All files follow **lowercase-hyphen** naming (no underscores, no camelCase)
- [ ] Agents: `fai-{name}.agent.md`
- [ ] Instructions: `{name}.instructions.md`
- [ ] Skills: `{name}/SKILL.md` (folder name matches `name` in frontmatter)
- [ ] Hooks: `{name}/hooks.json`
- [ ] Plugins: `{name}/plugin.json` (folder name matches `name` in manifest)

### ✅ Frontmatter Requirements

Every primitive type has required YAML frontmatter fields:

| Primitive | Required Fields |
|-----------|----------------|
| `.agent.md` | `description` (10+ chars) |
| `.instructions.md` | `description` (10+ chars), `applyTo` (glob pattern) |
| `SKILL.md` | `name` (must match folder), `description` (10–1024 chars) |
| `hooks.json` | `version: 1`, at least one valid `event` |
| `plugin.json` | `name`, `description`, `version` (semver), `author.name`, `license` |
| `fai-manifest.json` | `play`, `version`, `context.knowledge[]`, `context.waf[]`, `primitives` |

### ✅ Schema Validation

```bash
# Validate all primitives against JSON schemas
npm run validate:primitives

# Verify individual JSON files parse correctly
node -e "require('./path/to/file.json'); console.log('✅ OK')"
```

- [ ] `npm run validate:primitives` passes with **0 errors**
- [ ] All JSON files parse without syntax errors
- [ ] `fai-manifest.json` conforms to `schemas/fai-manifest.schema.json`

### ✅ Security

- [ ] **No secrets, API keys, or connection strings** in any file
- [ ] Azure services use **Managed Identity** (not API keys)
- [ ] Secrets stored in **Azure Key Vault** (referenced, not inlined)
- [ ] MCP config uses `inputs` for secrets, `envFile` for `.env`, never hardcoded

:::danger
CI will **block** any PR that contains detected secrets. The `frootai-secrets-scanner` hook runs automatically.
:::

### ✅ WAF Alignment

- [ ] `waf` array values use **valid pillar names** from the 6-pillar set
- [ ] Valid values: `security`, `reliability`, `cost-optimization`, `operational-excellence`, `performance-efficiency`, `responsible-ai`
- [ ] At least one WAF pillar declared for agents and plays

### ✅ Solution Play Structure (if applicable)

If your PR adds or modifies a solution play:

- [ ] `fai-manifest.json` exists at play root with `context` + `primitives` + `guardrails`
- [ ] Play folder follows `NN-kebab-case` naming
- [ ] DevKit (`.github/`) contains at minimum: `copilot-instructions.md` + one agent
- [ ] TuneKit (`config/`) contains `openai.json` and `guardrails.json`
- [ ] `copilot-instructions.md` is **< 150 lines** (knowledge only, not behavioral override)
- [ ] Builder/reviewer/tuner agent triad exists in `.github/agents/`

### ✅ Plugin (if applicable)

If your PR adds or modifies a plugin:

- [ ] `plugin.json` exists with valid `name`, `description`, `version`, `author`, `license`
- [ ] `README.md` exists alongside `plugin.json`
- [ ] Run `npm run generate:marketplace` to regenerate `marketplace.json`

### ✅ Content Quality

- [ ] No placeholder text (e.g., "TODO", "Lorem ipsum", "Add content here")
- [ ] Agent files are **1500+ bytes** with real content
- [ ] Skill files are **150+ lines** with step-by-step procedures
- [ ] Code examples are syntactically correct and runnable

## Validation Commands

```bash
# Full validation suite
npm run validate:primitives          # Schema + naming + frontmatter

# Individual JSON validation
node -e "require('./fai-manifest.json')"
node -e "require('./config/openai.json')"
node -e "require('./config/guardrails.json')"

# FAI Engine wiring check
node engine/index.js fai-manifest.json --status

# Regenerate marketplace (after plugin changes)
npm run generate:marketplace
```

## Common Rejection Reasons

| Issue | How to Fix |
|-------|-----------|
| `validate:primitives` fails | Check error output — usually missing frontmatter field |
| Secrets detected | Remove API keys, use `inputs` in MCP config |
| Invalid WAF pillar | Use exact values: `security`, `reliability`, etc. |
| Skill name mismatch | Ensure `name` in SKILL.md matches parent folder name |
| copilot-instructions.md too long | Keep under 150 lines — knowledge only, no behavioral overrides |
| Plugin not in marketplace | Run `npm run generate:marketplace` after creating `plugin.json` |

## After Merge

CI automatically:
1. Regenerates `marketplace.json` from all `plugins/*/plugin.json`
2. Updates website data feeds
3. Validates the merged state passes all checks

## Next Steps

- **[Naming Conventions](./naming-conventions)** — detailed file naming rules
- **[How to Contribute](./how-to-contribute)** — the full contribution workflow
