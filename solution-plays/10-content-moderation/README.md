# Play 10 — Content Moderation 🛡️

> Filter harmful content with Azure Content Safety, custom blocklists, and severity scoring.

Every AI response passes through Azure Content Safety for severity scoring across hate, violence, self-harm, and sexual categories. Custom blocklists catch domain-specific terms. Dual moderation on both input and output.

## Quick Start
```bash
cd solution-plays/10-content-moderation
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .  # Use @builder for pipeline, @reviewer for threshold audit, @tuner for false positives
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure Content Safety | Severity scoring across 4 categories |
| API Management | Gateway with rate limiting |
| Azure Functions | Async processing for high volume |
| Key Vault | Blocklist management |

## Key Metrics
- True positive rate: ≥95% · False positive rate: <5% · Moderation latency: <200ms

## DevKit
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (pipeline/blocklists), Reviewer (threshold/compliance audit), Tuner (FP reduction/cost) |
| 3 skills | Deploy (121 lines), Evaluate (101 lines), Tune (120 lines) |

## Cost
| Dev | Prod |
|-----|------|
| $50–150/mo | $500–2K/mo |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/10-content-moderation](https://frootai.dev/solution-plays/10-content-moderation)
