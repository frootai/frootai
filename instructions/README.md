# FAI — Instructions (176)

> 176 language, framework, and cross-cutting coding standards that auto-apply via `applyTo` glob patterns.

## What Are FAI Instructions?

Instructions are `.instructions.md` files that define coding standards, best practices, and rules for specific languages, frameworks, or cross-cutting concerns. They auto-apply to matching files via the `applyTo` glob pattern.

## Instruction Schema

Every instruction uses YAML frontmatter:

```yaml
---
description: "Purpose statement"
applyTo: "glob pattern(s)"
---
```

## Existing Instructions (WAF Architecture)

FAI has 6 WAF-aligned instructions in `.github/instructions/`:

| Instruction | Scope | applyTo |
|-------------|-------|---------|
| waf-cost-optimization | Azure WAF Cost pillar | `**/*.{ts,js,py,bicep,json,yaml,yml}` |
| waf-operational-excellence | Azure WAF Ops pillar | same |
| waf-performance-efficiency | Azure WAF Performance pillar | same |
| waf-reliability | Azure WAF Reliability pillar | same |
| waf-responsible-ai | Azure WAF RAI pillar | same |
| waf-security | Azure WAF Security pillar | same |

## New Instructions (This Folder)

This folder holds **language-level and framework-level** coding standards — complementing the architecture-level WAF instructions:

| Category | Examples | applyTo |
|----------|----------|---------|
| Language standards | `python-waf.instructions.md` | `**/*.py` |
| IaC standards | `bicep-waf.instructions.md` | `**/*.bicep` |
| MCP development | `python-mcp-development.instructions.md` | `**/*.py` |
| Cross-cutting | `security-owasp.instructions.md` | `*` |

## Unique Advantage

FAI instructions combine **coding rules** with **WAF pillar alignment**. Every instruction references which WAF pillar it enforces.

## Naming Convention

`kebab-case.instructions.md` — always lowercase, hyphen-separated.

## Validation

```bash
node scripts/validate-primitives.js instructions/
```
