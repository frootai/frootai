# Play 79 — Food Safety Inspector AI 🍴

> AI food safety — HACCP monitoring, contamination risk scoring, supply chain traceability, recall management, FDA/EFSA regulatory reporting.

Build an intelligent food safety inspection system. IoT sensors monitor Critical Control Points (temperature, humidity), AI detects violation patterns across inspections, full supply chain traceability enables rapid recall simulations, and regulatory reports auto-generate for FDA/EFSA compliance.

## Quick Start
```bash
cd solution-plays/79-food-safety-inspector-ai
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .
# Use @builder to implement, @reviewer to audit, @tuner to optimize
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure IoT Hub | Temperature/humidity sensors at each CCP |
| Azure Event Hubs | Real-time HACCP violation streaming |
| Azure OpenAI (gpt-4o) | Pattern analysis + inspection report generation |
| Cosmos DB (Serverless) | HACCP records, inspection history, lot tracking |
| Azure Functions | Event-driven CCP violation alerts |
| Container Apps | Inspection API + dashboard |

## Pre-Tuned Defaults
- HACCP: 5 CCPs (receiving, storage, cooking, cooling, hot holding) with FDA limits
- Alerts: 90% warning threshold · 15 min escalation · 120s door-open debounce
- Patterns: 3-month history · recurring+trending+seasonal+shift detection
- Traceability: FSMA 204 compliant · one-up-one-back · 2-year retention

## DevKit (AI-Assisted Development)
| Primitive | What It Does |
|-----------|-------------|
| `agent.md` | Root orchestrator with builder→reviewer→tuner handoffs |
| `copilot-instructions.md` | Food safety domain (HACCP plans, FDA limits, traceability, recall management) |
| 3 agents | Builder (gpt-4o), Reviewer (gpt-4o-mini), Tuner (gpt-4o-mini) |
| 3 skills | Deploy (210+ lines), Evaluate (125+ lines), Tune (240+ lines) |
| 4 prompts | `/deploy`, `/test`, `/review`, `/evaluate` with agent routing |

## Cost Estimate
| Environment | Monthly (per facility) |
|-------------|---------|
| Dev/Test | $45–65 |
| Production | $60–100 |

## vs. Play 78 (Precision Agriculture Agent)
| Aspect | Play 78 | Play 79 |
|--------|---------|---------|
| Focus | Crop health monitoring | Food processing safety |
| Sensors | Soil moisture/pH + satellite | Temperature/humidity at CCPs |
| AI Role | Stress detection + yield | Violation patterns + recall trace |
| Regulation | N/A | FDA HACCP, FSMA 204 |

📖 [Full documentation](spec/README.md) · 🌐 [frootai.dev/solution-plays/79-food-safety-inspector-ai](https://frootai.dev/solution-plays/79-food-safety-inspector-ai) · 📦 [FAI Protocol](spec/fai-manifest.json)
