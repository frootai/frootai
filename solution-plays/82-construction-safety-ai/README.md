# Play 82 — Construction Safety AI 🏗️

> AI construction safety — PPE detection (YOLO), hazard zone monitoring, incident prediction, real-time worker alerts, OSHA compliance reporting.

Build an intelligent construction safety system. YOLOv8 detects PPE compliance at 2 FPS on IoT Edge devices, geo-fenced hazard zones trigger intrusion alerts, gradient boosting predicts incident risk from weather/fatigue/workforce patterns, and real-time alerts reach supervisors via push notification within 30 seconds.

## Quick Start
```bash
cd solution-plays/82-construction-safety-ai
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .
# Use @builder to implement, @reviewer to audit, @tuner to optimize
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure Custom Vision | PPE detection model training |
| Azure IoT Edge | On-site YOLOv8 inference (low-latency) |
| Azure IoT Hub | Camera feed + edge device management |
| Azure Event Hubs | Real-time safety alert streaming |
| Azure OpenAI (gpt-4o) | Incident report + trend analysis |
| Notification Hubs | Push alerts to supervisor mobile |
| Cosmos DB (Serverless) | Incident records, compliance logs |

## Pre-Tuned Defaults
- PPE: 5 items (hard hat, vest, boots, gloves, glasses) · 0.80 confidence · temporal smoothing
- Zones: Critical (crane) / High (excavation) / Standard · buffer 2-3m · max worker limits
- Alerts: Dedup 5 min · max 10/hour · escalation after 3 repeats · multi-channel
- Prediction: 6 risk factors (time, weather, PPE rate, new workers, trades)

## DevKit (AI-Assisted Development)
| Primitive | What It Does |
|-----------|-------------|
| `agent.md` | Root orchestrator with builder→reviewer→tuner handoffs |
| `copilot-instructions.md` | Safety domain (PPE detection, hazard zones, OSHA compliance, edge inference) |
| 3 agents | Builder (gpt-4o), Reviewer (gpt-4o-mini), Tuner (gpt-4o-mini) |
| 3 skills | Deploy (215+ lines), Evaluate (125+ lines), Tune (240+ lines) |
| 4 prompts | `/deploy`, `/test`, `/review`, `/evaluate` with agent routing |

## Cost Estimate
| Environment | Monthly (per site) |
|-------------|---------|
| Dev/Test | $75–100 |
| Production | $140–200 |

## vs. Play 79 (Food Safety Inspector AI)
| Aspect | Play 79 | Play 82 |
|--------|---------|---------|
| Focus | Food HACCP compliance | Construction worker safety |
| Detection | Temperature sensors (IoT) | Computer vision (cameras + YOLO) |
| Real-time | Sensor violation alerts | PPE + zone intrusion alerts |
| Edge | N/A | IoT Edge for on-site inference |
| Regulation | FDA HACCP, FSMA 204 | OSHA construction standards |

📖 [Full documentation](spec/README.md) · 🌐 [frootai.dev/solution-plays/82-construction-safety-ai](https://frootai.dev/solution-plays/82-construction-safety-ai) · 📦 [FAI Protocol](spec/fai-manifest.json)
