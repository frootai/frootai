# Play 90 — Network Optimization Agent 📡

> AI telecom network optimization — traffic forecasting, dynamic routing, predictive maintenance, 5G resource allocation, SLA compliance.

Build a telecom network optimization agent. LSTM forecasts traffic per link 4 hours ahead, NetworkX-based routing balances utilization while maintaining redundancy, predictive maintenance catches equipment failures 7+ days early, and 5G network slicing allocates resources per URLLC/eMBB/mMTC slice SLAs.

## Quick Start
```bash
cd solution-plays/90-network-optimization-agent
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .
# Use @builder to implement, @reviewer to audit, @tuner to optimize
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure IoT Hub | Equipment telemetry (SNMP, metrics) |
| Azure Data Explorer | Network time-series (traffic, latency, errors) |
| Azure ML | Traffic forecasting + failure prediction |
| Azure OpenAI (gpt-4o) | Anomaly analysis + NOC-grade reports |
| Event Hubs | Real-time traffic flow streaming |
| Azure Functions | Alert engine + routing recalculation |

## Pre-Tuned Defaults
- Utilization: Max 80% per link · 20% headroom for bursts · ≥2 redundant paths
- SLA: URLLC < 1ms · Real-time < 20ms · Best-effort < 100ms · 99.95% availability
- Routing: Multi-objective (utilization 40% / latency 35% / redundancy 25%) · ECMP
- Maintenance: Alert at 70% failure probability · auto-failover on critical · 14-day scheduling

## DevKit (AI-Assisted Development)
| Primitive | What It Does |
|-----------|-------------|
| `agent.md` | Root orchestrator with builder→reviewer→tuner handoffs |
| `copilot-instructions.md` | Network domain (traffic forecasting, routing, 5G slicing, maintenance) |
| 3 agents | Builder (gpt-4o), Reviewer (gpt-4o-mini), Tuner (gpt-4o-mini) |
| 3 skills | Deploy (215+ lines), Evaluate (110+ lines), Tune (240+ lines) |
| 4 prompts | `/deploy`, `/test`, `/review`, `/evaluate` with agent routing |

## Cost Estimate
| Environment | Monthly |
|-------------|---------|
| Dev/Test | $130–170 |
| Production | $230–350 |

## vs. Play 71 (Smart Energy Grid AI)
| Aspect | Play 71 | Play 90 |
|--------|---------|---------|
| Focus | Energy grid operations | Telecom network operations |
| Optimization | Renewable dispatch + demand response | Traffic routing + capacity planning |
| Prediction | Load forecasting (kW) | Traffic forecasting (Gbps) |
| Slicing | N/A | 5G URLLC/eMBB/mMTC slices |

📖 [Full documentation](spec/README.md) · 🌐 [frootai.dev/solution-plays/90-network-optimization-agent](https://frootai.dev/solution-plays/90-network-optimization-agent) · 📦 [FAI Protocol](spec/fai-manifest.json)
