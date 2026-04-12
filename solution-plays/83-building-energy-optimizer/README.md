# Play 83 — Building Energy Optimizer 🏢

> AI building energy management — occupancy-based HVAC scheduling, zone setpoint optimization, fault detection, sustainability reporting.

Build an intelligent building energy optimizer. Occupancy prediction fuses badge-in, WiFi, CO2, and calendar data to drive zone-based HVAC setpoints, pre-conditioning anticipates arrivals, fault detection catches stuck valves and energy anomalies, and sustainability reports track CO₂ reductions.

## Quick Start
```bash
cd solution-plays/83-building-energy-optimizer
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .
# Use @builder to implement, @reviewer to audit, @tuner to optimize
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure IoT Hub | BMS sensor data (temperature, humidity, occupancy) |
| Azure Digital Twins | Building model (zones, HVAC units, sensors) |
| Azure Data Explorer | 15-minute energy time-series analytics |
| Azure ML | Occupancy prediction + energy forecasting |
| Azure OpenAI (gpt-4o) | Sustainability reporting + anomaly explanation |
| Azure Functions | Event-driven setpoint recommendation engine |

## Pre-Tuned Defaults
- Comfort: ASHRAE 55 ranges · cooling 73-79°F · heating 68-76°F
- Setback: 85°F cooling / 55°F heating when empty · 30 min pre-conditioning
- Occupancy: 5 data sources fused · 24h horizon · 15 min updates
- Faults: Stuck valve, simultaneous heat/cool, energy anomaly, sensor drift

## DevKit (AI-Assisted Development)
| Primitive | What It Does |
|-----------|-------------|
| `agent.md` | Root orchestrator with builder→reviewer→tuner handoffs |
| `copilot-instructions.md` | Building energy domain (HVAC control, occupancy, fault detection pitfalls) |
| 3 agents | Builder (gpt-4o), Reviewer (gpt-4o-mini), Tuner (gpt-4o-mini) |
| 3 skills | Deploy (200+ lines), Evaluate (120+ lines), Tune (235+ lines) |
| 4 prompts | `/deploy`, `/test`, `/review`, `/evaluate` with agent routing |

## Cost Estimate
| Environment | Monthly (per building) |
|-------------|---------|
| Dev/Test | $180–210 |
| Production | $200–300 |

## vs. Play 71 (Smart Energy Grid AI)
| Aspect | Play 71 | Play 83 |
|--------|---------|---------|
| Focus | Grid-level energy management | Building-level HVAC optimization |
| Scale | City/region (MW) | Single building (kW) |
| Optimization | Renewable dispatch + demand response | Zone setpoints + occupancy scheduling |
| ROI | Grid stability + peak shaving | 15-20% energy bill reduction |

📖 [Full documentation](spec/README.md) · 🌐 [frootai.dev/solution-plays/83-building-energy-optimizer](https://frootai.dev/solution-plays/83-building-energy-optimizer) · 📦 [FAI Protocol](spec/fai-manifest.json)
