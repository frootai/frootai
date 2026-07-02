# security-hardening

> Security Hardening — OWASP Top 10, secrets scanning, dependency auditing, supply chain security, threat modeling, and penetration testing patterns. Harden AI applications with defense-in-depth and zero-trust.

## Overview

This plugin bundles **22 primitives** (3 agents, 5 instructions, 4 skills, 10 hooks) into one installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install security-hardening
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-security-reviewer` | Security review specialist |
| Agent | `frootai-red-team-expert` | Red team specialist |
| Agent | `frootai-compliance-expert` | Compliance specialist |
| Instruction | `security-owasp` | OWASP standards |
| Instruction | `security-python` | Python standards |
| Instruction | `security-typescript` | TypeScript standards |
| Instruction | `security-csharp` | C# standards |
| Instruction | `security-bicep` | Bicep standards |
| Skill | `frootai-security-review-skill` | Security review capability |
| Skill | `frootai-secret-scanning` | Secret scanning capability |
| Skill | `frootai-threat-model` | Threat modeling capability |
| Skill | `frootai-codeql-setup` | CodeQL setup capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-waf-compliance` | Waf compliance gate |
| Hook | `frootai-cost-tracker` | Cost tracker gate |
| Hook | `frootai-pii-redactor` | Pii redactor gate |
| Hook | `frootai-output-validator` | Output validator gate |
| Hook | `frootai-token-budget-enforcer` | Token budget enforcer gate |
| Hook | `frootai-session-logger` | Session logger gate |
| Hook | `frootai-license-checker` | License checker gate |

## Keywords

`security` `owasp` `secrets-scanning` `supply-chain` `threat-modeling` `penetration-testing` `zero-trust`

## Usage

After installation, the primitives are available in your project:

1. **Agents** activate when you `@mention` them in Copilot Chat
2. **Instructions** auto-apply to matching files via `applyTo` glob patterns
3. **Skills** are invoked by agents or via `/skill` commands
4. **Hooks** fire automatically at session lifecycle events

With `fai-manifest.json` in a solution play, all primitives auto-wire through the FAI Protocol — shared context, WAF guardrails, and evaluation thresholds propagate automatically.

## WAF Alignment

| Pillar | Coverage |
|--------|----------|
| Security | Secrets scanning, Managed Identity, Key Vault integration, RBAC |

## Quality Gates

When used inside a play, this plugin enforces:

| Metric | Threshold |
|--------|-----------|
| Groundedness | ≥ 0.85 |
| Coherence | ≥ 0.80 |
| Relevance | ≥ 0.80 |
| Safety | 0 violations |
| Cost per query | ≤ $0.05 |

## Contributing

To improve this plugin:

1. Fork the [FrootAI repository](https://github.com/FrootAI/frootai)
2. Edit files in `plugins/security-hardening/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
