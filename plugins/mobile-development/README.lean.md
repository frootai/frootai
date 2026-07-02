# mobile-development

> Mobile Development — Swift/SwiftUI for iOS, Kotlin for Android, .NET MAUI for cross-platform, and Flutter/Dart for hybrid apps. Native AI integration with on-device inference and platform-specific UX patterns.

## Overview

This plugin bundles **12 primitives** (3 agents, 4 instructions, 2 skills, 3 hooks) into a single installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install mobile-development
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-swift-expert` | Swift expert specialist |
| Agent | `frootai-kotlin-expert` | Kotlin expert specialist |
| Agent | `frootai-dotnet-maui-expert` | Dotnet maui expert specialist |
| Instruction | `swift-waf` | Swift waf standards |
| Instruction | `kotlin-waf` | Kotlin waf standards |
| Instruction | `maui-waf` | Maui waf standards |
| Instruction | `dart-flutter-waf` | Dart flutter waf standards |
| Skill | `frootai-mcp-swift-scaffold` | Mcp swift scaffold capability |
| Skill | `frootai-mcp-kotlin-scaffold` | Mcp kotlin scaffold capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |

## Keywords

`mobile` `ios` `android` `swift` `kotlin` `maui` `flutter` `dart` `cross-platform`

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
2. Edit files in `plugins/mobile-development/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
