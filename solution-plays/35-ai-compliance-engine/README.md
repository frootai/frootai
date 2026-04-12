# Play 35 — AI Compliance Engine ⚖️

> Automated compliance checking against GDPR, HIPAA, EU AI Act, and SOC 2.

Deploy an AI-powered compliance engine that automatically assesses your AI systems against regulatory frameworks. LLM-based analysis evaluates evidence, assigns risk scores, generates audit-ready reports, and tracks remediation. Covers all major frameworks with 200+ automated checks.

## Quick Start
```bash
cd solution-plays/35-ai-compliance-engine
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .  # Use @builder for checks/audit, @reviewer for coverage audit, @tuner for FP reduction
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure OpenAI (gpt-4o) | Compliance analysis, evidence assessment, risk scoring |
| Cosmos DB | Compliance evidence store, audit trail |
| Azure Storage | Reports, evidence snapshots, archives |
| Azure Functions | Scheduled compliance check execution |

## Supported Frameworks
| Framework | Checks | Focus |
|-----------|--------|-------|
| GDPR | 45 | Data subject rights, consent, breach notification |
| HIPAA | 38 | PHI protection, access controls, encryption |
| EU AI Act | 52 | Risk classification, transparency, testing |
| SOC 2 | 64 | Security, availability, processing integrity |
| ISO 27001 | 114 | ISMS, risk management, controls |

## Key Metrics
- Check accuracy: ≥90% · False negative: <5% · Framework coverage: 100% · Risk calibration: ±1 of expert

## DevKit (Compliance-Focused)
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (checks/audit trail/risk scoring), Reviewer (coverage/evidence/gaps), Tuner (frequency/FP/weights) |
| 3 skills | Deploy (100 lines), Evaluate (105 lines), Tune (105 lines) |
| 4 prompts | `/deploy` (compliance engine), `/test` (check execution), `/review` (coverage audit), `/evaluate` (accuracy) |

**Note:** This is a regulatory compliance play. TuneKit covers check frequency per risk level, false positive reduction, risk scoring weight calibration, evidence retention policies, and framework-specific tuning — not AI model parameters.

## Cost
| Dev | Prod |
|-----|------|
| $50–150/mo | $300–1K/mo |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/35-ai-compliance-engine](https://frootai.dev/solution-plays/35-ai-compliance-engine)
