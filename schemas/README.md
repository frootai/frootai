# FrootAI — JSON Schemas

> Validation schemas for all FrootAI primitive types. 7 schemas enforcing structure across 770+ files.

## Schema Inventory (7 schemas)

| Schema | Validates | Required Fields | Status |
|--------|-----------|-----------------|--------|
| `agent.schema.json` | `.agent.md` frontmatter | `description` (10+ chars) | ✅ Done |
| `instruction.schema.json` | `.instructions.md` frontmatter | `description`, `applyTo` (glob) | ✅ Done |
| `skill.schema.json` | `SKILL.md` frontmatter | `name` (kebab), `description` (10-1024) | ✅ Done |
| `hook.schema.json` | `hooks.json` event config | `version: 1`, ≥1 event | ✅ Done |
| `plugin.schema.json` | `plugin.json` metadata | `name`, `description`, `version`, `author.name`, `license` | ✅ Done |
| `fai-manifest.schema.json` | FAI Protocol play wiring | `play`, `version`, `context`, `primitives` | ✅ Done |
| `fai-context.schema.json` | LEGO block context | (none required — all optional) | ✅ Done |

## Competitor Comparison

| Aspect | Awesome-Copilot | FrootAI | Delta |
|--------|----------------|---------|-------|
| JSON Schemas | 3 | **7** | +4 |
| Primitive coverage | 3 types | **7 types** | +4 |
| FAI Protocol schemas | 0 | **2** (manifest + context) | +2 |
| WAF enum validation | 0 | **1** (6-pillar enum) | +1 |

## Usage

```bash
# Validate all primitives against schemas
node scripts/validate-primitives.js

# Validate specific folder
node scripts/validate-primitives.js agents/
node scripts/validate-primitives.js plugins/

# Verbose output (shows each check)
node scripts/validate-primitives.js --verbose
```

## Solution Play vNext Contracts

The additive modernization contract is defined by:

- `solution-play-spec.vNext.schema.json`
- `solution-play-delivery-profile.v1.schema.json`
- `agent-context-envelope.v1.schema.json`
- `agent-handoff.v1.schema.json`
- `agent-loop-policy.v1.schema.json`
- `agent-memory-policy.v1.schema.json`
- `solution-play-certification-evidence.v2.schema.json`

Existing play files remain authoritative until migration write mode is explicitly enabled. Inventory and evidence migration are read-only:

```bash
npm run contracts:inventory
npm run contracts:migration-preview
npm run test:contract-inventory
npm run test:solution-play-schemas
npm run test:evidence-v2-migration
```

## VS Code Integration

All schemas are auto-mapped in `.vscode/settings.json`:

| File Pattern | Schema Applied |
|-------------|---------------|
| `plugins/*/plugin.json` | `plugin.schema.json` |
| `hooks/*/hooks.json` | `hook.schema.json` |
| `**/fai-manifest.json` | `fai-manifest.schema.json` |
| `**/fai-context.json` | `fai-context.schema.json` |

Open any matching file in VS Code → red squiggles appear for invalid fields!

## Schema Design Principles

1. **Strict but minimal** — only require what's essential, allow optional extensions
2. **Consistent naming** — all use `$schema`, `$id`, lowercase-hyphen names
3. **Self-documenting** — every field has a `description` property
4. **WAF-aware** — agent, instruction, and context schemas enforce valid WAF pillar names
5. **Composable** — fai-manifest references patterns from agent/skill/hook schemas
6. **Versioned** — all schemas have `$id` URLs for external reference

## Build Pipeline

```
validate-primitives.js
  ├── Loads schemas from schemas/
  ├── Scans agents/, instructions/, skills/, hooks/, plugins/
  ├── Validates YAML frontmatter (agents, instructions, skills)
  ├── Validates JSON files (hooks, plugins, manifests, contexts)
  ├── Checks naming conventions (kebab-case, folder=name match)
  └── Reports: passed / errors
```
