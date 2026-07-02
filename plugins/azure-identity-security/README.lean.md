# azure-identity-security

> Azure Identity & Security: Managed Identity, Key Vault, RBAC, Conditional Access, zero-trust architecture; secures AI workloads with certificate-based auth, secret rotation, compliance auditing.

## Overview

This plugin bundles **23 primitives** (4 agents, 4 instructions, 5 skills, 10 hooks) into one installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install azure-identity-security
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-azure-identity-expert` | Azure identity expert specialist |
| Agent | `frootai-azure-key-vault-expert` | Azure key vault expert specialist |
| Agent | `frootai-security-reviewer` | Security reviewer specialist |
| Agent | `frootai-compliance-expert` | Compliance expert specialist |
| Instruction | `security-python` | Security python standards |
| Instruction | `security-typescript` | Security typescript standards |
| Instruction | `security-csharp` | Security csharp standards |
| Instruction | `security-owasp` | Security owasp standards |
| Skill | `frootai-azure-key-vault-setup` | Azure key vault setup capability |
| Skill | `frootai-azure-role-selector` | Azure role selector capability |
| Skill | `frootai-secret-scanning` | Secret scanning capability |
| Skill | `frootai-threat-model` | Threat model capability |
| Skill | `frootai-security-review-skill` | Security review skill capability |
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

`azure` `identity` `security` `key-vault` `managed-identity` `rbac` `zero-trust` `conditional-access`

## Usage

After installation, primitives are available in your project:

1. **Agents** activate when you `@mention` them in Copilot Chat
2. **Instructions** auto-apply to matching files via `applyTo` glob patterns
3. **Skills** are invoked by agents or via `/skill` commands
4. **Hooks** fire automatically at session lifecycle events

Inside a solution play with `fai-manifest.json`, all primitives auto-wire through the FAI Protocol — shared context, WAF guardrails, and evaluation thresholds propagate automatically.

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
2. Edit files in `plugins/azure-identity-security/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
