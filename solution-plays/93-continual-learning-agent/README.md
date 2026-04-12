# Play 93 — Continual Learning Agent 🧠

> Self-improving AI agent — persistent memory (episodic+semantic+procedural), reflection loops, knowledge distillation, skill acquisition, adaptive decay.

Build a continual learning agent that improves across sessions. Three memory types (episodic experiences, semantic patterns, procedural skills) persist between conversations, reflection loops analyze what worked and what didn't, knowledge distillation compresses episodes into generalizable patterns, and importance-based decay prevents memory bloat.

## Quick Start
```bash
cd solution-plays/93-continual-learning-agent
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .
# Use @builder to implement, @reviewer to audit, @tuner to optimize
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure OpenAI (gpt-4o) | Reasoning + reflection + distillation |
| Azure AI Search (Standard) | Episodic memory vector store |
| Cosmos DB (Serverless) | Semantic memory (knowledge graph) + procedural skills |
| Container Apps | Agent API |

## Pre-Tuned Defaults
- Episodic: 10K max episodes · text-embedding-3-large · 0.65 similarity threshold
- Semantic: Distill after 3+ similar episodes · 0.70 confidence · conflict resolution by recency
- Procedural: Update on ≥10% improvement · 500 max skills
- Decay: Critical 0.999/day · Normal 0.970/day · Low 0.900/day · archive at 0.10

## DevKit (AI-Assisted Development)
| Primitive | What It Does |
|-----------|-------------|
| `agent.md` | Root orchestrator with builder→reviewer→tuner handoffs |
| `copilot-instructions.md` | Continual learning domain (3-memory arch, reflection, distillation, forgetting) |
| 3 agents | Builder (gpt-4o), Reviewer (gpt-4o-mini), Tuner (gpt-4o-mini) |
| 3 skills | Deploy (215+ lines), Evaluate (120+ lines), Tune (240+ lines) |
| 4 prompts | `/deploy`, `/test`, `/review`, `/evaluate` with agent routing |

## Cost Estimate
| Environment | Monthly |
|-------------|---------|
| Dev/Test | $30–60 |
| Production (500 tasks) | $280–350 |

## vs. Play 07 (Multi-Agent Service)
| Aspect | Play 07 | Play 93 |
|--------|---------|---------|
| Focus | Multi-agent orchestration | Single agent that learns over time |
| Memory | Shared context during session | Persistent across sessions (3 types) |
| Improvement | Static behavior | Improves with experience |
| Reflection | N/A | Post-task reflection + distillation |

📖 [Full documentation](spec/README.md) · 🌐 [frootai.dev/solution-plays/93-continual-learning-agent](https://frootai.dev/solution-plays/93-continual-learning-agent) · 📦 [FAI Protocol](spec/fai-manifest.json)
