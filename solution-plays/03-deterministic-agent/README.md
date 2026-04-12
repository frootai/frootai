# Play 03 — Deterministic Agent 🎯

> Reliable, reproducible AI agent with zero temperature and multi-layer guardrails.

When you need AI that gives the same answer every time. Temperature=0, seed pinning, structured JSON output, confidence scoring, anti-sycophancy prompts, and a multi-layer guardrail pipeline.

## Quick Start
```bash
cd solution-plays/03-deterministic-agent
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .  # Use @builder for pipelines, @reviewer for determinism audit, @tuner for thresholds
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure OpenAI (gpt-4o, temp=0) | Deterministic generation with seed pinning |
| Container Apps | API hosting |
| Content Safety | Output filtering |

## Pre-Tuned Defaults
- Temperature: 0.0 · Seed: 42 · Structured JSON output
- Confidence threshold: ≥0.7 (abstain below)
- Anti-sycophancy prompts · Citation requirements

## DevKit
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (zero-temp pipelines), Reviewer (reproducibility audit), Tuner (confidence thresholds) |
| 3 skills | Deploy (106 lines), Evaluate (152 lines), Tune (153 lines) |

## Cost
| Dev | Prod |
|-----|------|
| $100–250/mo | $1.5K–6K/mo |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/03-deterministic-agent](https://frootai.dev/solution-plays/03-deterministic-agent)
