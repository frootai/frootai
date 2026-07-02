# java-development

> Java Development — Spring Boot, Quarkus, JUnit 5, Gradle/Maven builds, and microservice patterns. Enterprise Java with reactive streams, GraalVM native images, and cloud-native deployment.

## Overview

This plugin bundles **13 primitives** (2 agents, 3 instructions, 5 skills, 3 hooks) into a single installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install java-development
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-java-expert` | Java expert specialist |
| Agent | `frootai-java-mcp-expert` | Java mcp expert specialist |
| Instruction | `java-waf` | Java waf standards |
| Instruction | `springboot-waf` | Springboot waf standards |
| Instruction | `quarkus-waf` | Quarkus waf standards |
| Skill | `frootai-springboot-scaffold` | Springboot scaffold capability |
| Skill | `frootai-springboot-kotlin-scaffold` | Springboot kotlin scaffold capability |
| Skill | `frootai-springboot-test` | Springboot test capability |
| Skill | `frootai-junit-test` | Junit test capability |
| Skill | `frootai-java-extract-method` | Java extract method capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |

## Keywords

`java` `spring-boot` `quarkus` `junit` `maven` `gradle` `microservices` `graalvm`

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
2. Edit files in `plugins/java-development/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
