# design-system

> Design System — UI components, design tokens, theming, responsive layouts, accessibility, animations, and form patterns. Build consistent, accessible UIs with AI-generated component variants and Storybook docs.

## Overview

This plugin bundles **23 primitives** (2 agents, 3 instructions, 15 skills, 3 hooks) into a single installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install design-system
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-ux-designer` | Ux designer specialist |
| Agent | `frootai-accessibility-expert` | Accessibility expert specialist |
| Instruction | `a11y-waf` | A11y waf standards |
| Instruction | `tailwind-waf` | Tailwind waf standards |
| Instruction | `html-css-waf` | Html css waf standards |
| Skill | `frootai-design-ui-components` | Design ui components capability |
| Skill | `frootai-design-system-tokens` | Design system tokens capability |
| Skill | `frootai-design-themes` | Design themes capability |
| Skill | `frootai-design-responsive` | Design responsive capability |
| Skill | `frootai-design-forms` | Design forms capability |
| Skill | `frootai-design-accessibility` | Design accessibility capability |
| Skill | `frootai-design-animations` | Design animations capability |
| Skill | `frootai-design-layouts` | Design layouts capability |
| Skill | `frootai-design-loading-states` | Design loading states capability |
| Skill | `frootai-design-error-states` | Design error states capability |
| Skill | `frootai-design-data-visualization` | Design data visualization capability |
| Skill | `frootai-design-onboarding` | Design onboarding capability |
| Skill | `frootai-design-dialog-system` | Design dialog system capability |
| Skill | `frootai-design-icon-system` | Design icon system capability |
| Skill | `frootai-design-state-management` | Design state management capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |

## Keywords

`design-system` `ui-components` `design-tokens` `theming` `accessibility` `responsive` `storybook`

## Usage

After installation, the primitives are available in your project:

1. **Agents** activate when you `@mention` them in Copilot Chat
2. **Instructions** auto-apply to matching files via `applyTo` glob patterns
3. **Skills** are invoked by agents or via `/skill` commands
4. **Hooks** fire automatically at session lifecycle events

When used inside a solution play with `fai-manifest.json`, all primitives auto-wire through the FAI Protocol — shared context, WAF guardrails, and evaluation thresholds propagate automatically.

## WAF Alignment

| Pillar | Coverage |
|--------|----------|
| Security | Secrets scanning, Managed Identity, Key Vault integration, RBAC |
| Reliability | Retry with backoff, circuit breaker, health probes, fallback chains |
| Operational Excellence | CI/CD integration, observability, IaC templates, automated testing |

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
2. Edit files in `plugins/design-system/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
