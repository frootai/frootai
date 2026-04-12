# Play 18 — Prompt Management 📝

> Versioned prompt registry with A/B testing, injection defense, and token optimization.

Manage prompts as first-class assets. Cosmos DB stores versioned templates, A/B testing compares variants with statistical significance, injection defense layers protect against prompt attacks, and analytics track usage across applications.

## Quick Start
```bash
cd solution-plays/18-prompt-management
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .  # Use @builder for registry/A-B, @reviewer for injection audit, @tuner for token optimization
```

## Architecture
| Service | Purpose |
|---------|---------|
| Cosmos DB | Prompt registry (versioned storage, per-env containers) |
| Azure Functions | Prompt serving API (get/create/activate/rollback) |
| Azure OpenAI | Prompt testing and A/B evaluation |
| Application Insights | Prompt usage analytics |

## Key Capabilities
| Feature | Details |
|---------|---------|
| Versioning | Semantic versioning with rollback |
| A/B Testing | Traffic splitting with statistical significance |
| Injection Defense | Input sanitization, prompt armor, output validation |
| Token Optimization | Template compression, dynamic few-shot |
| Analytics | Usage tracking per app, per prompt, per version |

## DevKit (Prompt Engineering-Focused)
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (registry/A-B framework), Reviewer (injection/quality audit), Tuner (token/few-shot/caching) |
| 3 skills | Deploy (111 lines), Evaluate (101 lines), Tune (114 lines) |
| 4 prompts | `/deploy` (registry + A/B), `/test` (templates), `/review` (injection/compliance), `/evaluate` (quality) |

**Note:** This is a prompt engineering/MLOps play. TuneKit covers token budgets, A/B test configuration, few-shot selection strategies, template compression, and prompt caching — not infrastructure sizing.

## Cost
| Dev | Prod |
|-----|------|
| $30–80/mo | $200–1K/mo |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/18-prompt-management](https://frootai.dev/solution-plays/18-prompt-management)
