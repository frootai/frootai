# csharp-dotnet-development

> C# .NET Development — ASP.NET Core, Minimal API, Blazor, MAUI, EF Core, xUnit/NUnit testing, and architecture patterns. Full-stack .NET with WAF-aligned coding standards and code review agents.

## Overview

This plugin bundles **17 primitives** (3 agents, 6 instructions, 5 skills, 3 hooks) into one installable package. All are WAF-aligned and FAI Protocol auto-wiring compatible.

## Installation

```bash
npx frootai install csharp-dotnet-development
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-csharp-expert` | C# expert |
| Agent | `frootai-dotnet-maui-expert` | .NET MAUI expert |
| Agent | `frootai-blazor-expert` | Blazor expert |
| Instruction | `csharp-waf` | C# WAF standards |
| Instruction | `aspnet-waf` | ASP.NET WAF standards |
| Instruction | `blazor-waf` | Blazor WAF standards |
| Instruction | `minimal-api-waf` | Minimal API WAF standards |
| Instruction | `ef-core-waf` | EF Core WAF standards |
| Instruction | `xunit-waf` | xUnit WAF standards |
| Skill | `frootai-aspnet-minimal-api` | ASP.NET Minimal API capability |
| Skill | `frootai-aspire-orchestration` | Aspire orchestration capability |
| Skill | `frootai-xunit-test` | xUnit test capability |
| Skill | `frootai-nunit-test` | NUnit test capability |
| Skill | `frootai-mstest-test` | MSTest test capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |

## Keywords

`csharp` `dotnet` `aspnet` `blazor` `maui` `ef-core` `xunit` `minimal-api`

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
| Security | Secrets scanning, Managed Identity, Key Vault, RBAC |
| Reliability | Retry/backoff, circuit breaker, health probes, fallback chains |
| Operational Excellence | CI/CD, observability, IaC templates, automated testing |

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
2. Edit files in `plugins/csharp-dotnet-development/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
