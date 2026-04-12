# Play 98 — Agent Evaluation Platform 🏆

> AI agent benchmarking — multi-dimensional scoring (7 dimensions), LLM-as-judge with calibration, adversarial safety testing, leaderboard comparison.

Build an agent evaluation platform. Score agents across 7 dimensions (task completion, accuracy, tool use, safety, latency, cost, conversation quality), calibrate LLM-as-judge against human annotations, generate diverse test suites with adversarial probes, and publish leaderboard rankings with baseline comparison.

## Quick Start
```bash
cd solution-plays/98-agent-evaluation-platform
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .
# Use @builder to implement, @reviewer to audit, @tuner to optimize
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure OpenAI (gpt-4o) | LLM-as-judge + test case generation |
| Cosmos DB (Serverless) | Test suites, eval results, leaderboard |
| Azure Functions | Evaluation pipeline orchestration |
| Container Apps | Dashboard API + leaderboard UI |

## Pre-Tuned Defaults
- Dimensions: 7 weighted (task 20%, accuracy 20%, tools 15%, safety 15%, latency 10%, cost 10%, quality 10%)
- Judge: gpt-4o · temperature 0 · calibrated against 50+ human annotations · safety veto rule
- Tests: 5 types (single-turn, multi-turn, tool use, adversarial, edge cases) · monthly rotation
- Leaderboard: Per-dimension breakdown · baseline comparison · version tracking

## DevKit (AI-Assisted Development)
| Primitive | What It Does |
|-----------|-------------|
| `agent.md` | Root orchestrator with builder→reviewer→tuner handoffs |
| `copilot-instructions.md` | Eval domain (multi-dimensional scoring, judge bias, adversarial testing) |
| 3 agents | Builder (gpt-4o), Reviewer (gpt-4o-mini), Tuner (gpt-4o-mini) |
| 3 skills | Deploy (240+ lines), Evaluate (115+ lines), Tune (240+ lines) |
| 4 prompts | `/deploy`, `/test`, `/review`, `/evaluate` with agent routing |

## Cost Estimate
| Environment | Monthly |
|-------------|---------|
| Dev/Test | $30–50 |
| Production (12 eval runs) | $190–250 |

## vs. Play 32 (Testing Expert)
| Aspect | Play 32 | Play 98 |
|--------|---------|---------|
| Focus | Code test generation (unit/integration) | AI agent quality benchmarking |
| Target | Source code | Agent endpoints |
| Scoring | Test pass/fail + coverage | 7-dimension weighted score + leaderboard |
| Safety | Security scanning | Adversarial probes (jailbreak, injection) |

📖 [Full documentation](spec/README.md) · 🌐 [frootai.dev/solution-plays/98-agent-evaluation-platform](https://frootai.dev/solution-plays/98-agent-evaluation-platform) · 📦 [FAI Protocol](spec/fai-manifest.json)
