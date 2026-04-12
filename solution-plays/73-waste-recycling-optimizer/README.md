# Play 73 — Waste Recycling Optimizer ♻️

> AI waste management — material classification (CV), contamination detection, route optimization, circular economy tracking.

Build an intelligent waste management system. ONNX vision models classify materials (9 categories), contamination detection prevents batch rejection, OR-Tools optimizes collection routes, and IoT sensors trigger dynamic collection scheduling.

## Quick Start
```bash
cd solution-plays/73-waste-recycling-optimizer
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .
# Use @builder to implement, @reviewer to audit, @tuner to optimize
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure Custom Vision | Train waste material classifier (9-class) |
| Azure IoT Hub | Fill-level sensor data from bins |
| Azure Maps | Collection route optimization |
| Azure OpenAI (gpt-4o-mini) | Analytics narratives + anomaly reporting |
| Cosmos DB (Serverless) | Collection records, classification logs |
| Container Apps | Classification API + route optimizer |

## Pre-Tuned Defaults
- Classification: 9 categories · confidence threshold 0.75 · ONNX < 100ms
- Contamination: 4 types (food, liquid, mixed, hazardous) · auto-reject hazardous
- Routes: TSP with time windows · 70% fill trigger · 40 max stops
- Recovery: Plastic 50% · Metal 70% · Paper 65% · Glass 80% · Organic 60%

## DevKit (AI-Assisted Development)
| Primitive | What It Does |
|-----------|-------------|
| `agent.md` | Root orchestrator with builder→reviewer→tuner handoffs |
| `copilot-instructions.md` | Waste AI domain (CV pipeline, contamination, route optimization pitfalls) |
| 3 agents | Builder (gpt-4o), Reviewer (gpt-4o-mini), Tuner (gpt-4o-mini) |
| 3 skills | Deploy (180+ lines), Evaluate (130+ lines), Tune (220+ lines) |
| 4 prompts | `/deploy`, `/test`, `/review`, `/evaluate` with agent routing |

## Cost Estimate
| Environment | Monthly |
|-------------|---------|
| Dev/Test | $55–75 |
| Production | $200–400 |

## vs. Play 69 (Carbon Footprint Tracker)
| Aspect | Play 69 | Play 73 |
|--------|---------|---------|
| Focus | Scope 1/2/3 emissions tracking | Material recovery optimization |
| AI Role | Emission factor estimation | Computer vision classification |
| Data Flow | Reports → scoring | Images → classification → sorting |
| Infrastructure | Cosmos DB + Functions | Custom Vision + IoT Hub + Maps |

📖 [Full documentation](spec/README.md) · 🌐 [frootai.dev/solution-plays/73-waste-recycling-optimizer](https://frootai.dev/solution-plays/73-waste-recycling-optimizer) · 📦 [FAI Protocol](spec/fai-manifest.json)
