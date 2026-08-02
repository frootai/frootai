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
npm run validate:solution-play-delivery-profile
npm run test:solution-play-delivery-profile
npm run test:evidence-v2-migration
```

Delivery profile v1.1 defines technology-neutral folder roles and bounded command descriptors for a clean-checkout vertical slice. The validator is read-only: it reports profiles named `delivery-profile.v1.json` but never creates or updates canonical play files.

### Delivery Profile Security Model

- Commands are executable-plus-argument vectors, not shell strings. T214 must execute them with shell expansion disabled and stdin closed.
- Executables that change privilege context are rejected. Common inline-secret, credential-URL, interactive, and unbounded-watch arguments are rejected.
- Paths use repository-relative POSIX form. Runtime, infrastructure, working-directory, and receipt paths cannot escape the declared slice boundaries.
- Every command is bounded to 3600 seconds. Longer operations must be decomposed into bounded commands with separate receipts.
- Cleanup may require network access to remove external resources, but must be explicitly classified, bounded, and idempotent.
- Validation reduces accidental and supply-chain risk; it does not make an untrusted executable safe. T214 remains responsible for process isolation, resource limits, cancellation, redaction, and atomic evidence.

Deterministic Solution Play generation is protected by a reviewed quality-debt fingerprint:

```bash
npm run quality:solution-plays
npm run quality:solution-plays:strict
npm run test:solution-play-quality
```

The normal gate fails when TODO/placeholder markers, copied metric groups, broken references, duplicate IDs, or unsupported vNext claims differ from `data/solution-play-quality-baseline.v1.json`. Strict mode rejects all remaining debt. Baseline changes must be reviewed with the source repair; they are not an error-suppression mechanism.

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
