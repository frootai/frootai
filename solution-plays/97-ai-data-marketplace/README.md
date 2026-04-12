# Play 97 — AI Data Marketplace 📊

> Data commerce platform — dataset discovery with quality scoring, privacy-preserving sharing, synthetic data augmentation, license management, lineage tracking.

Build an AI data marketplace. 5-dimension quality scoring (completeness, consistency, accuracy, timeliness, uniqueness) grades every dataset, PII scanning + k-anonymity + differential privacy enable privacy-preserving sharing, Gaussian Copula generates synthetic data with verified zero real-record overlap, and Azure Purview tracks full data lineage.

## Quick Start
```bash
cd solution-plays/97-ai-data-marketplace
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .
# Use @builder to implement, @reviewer to audit, @tuner to optimize
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure OpenAI (gpt-4o) | Dataset description + semantic search |
| Azure AI Search (Standard) | Dataset catalog with vector + semantic search |
| Azure Purview | Data lineage tracking + governance |
| Cosmos DB (Serverless) | Listings, transactions, reviews |
| Azure Storage | Dataset files, samples, synthetic outputs |
| Azure Functions | Quality scoring + privacy scanning |

## Pre-Tuned Defaults
- Quality: 5 dimensions · weighted composite · auto-delist below 40 · weekly refresh
- Privacy: Presidio PII scan · k=5 anonymity · Gaussian Copula synthetic · ε=1.0 differential privacy
- Search: Vector + semantic · facets (category, privacy, license) · quality + freshness boost
- Licensing: 5 license types · attribution tracking · usage limits · 80/20 revenue split

## DevKit (AI-Assisted Development)
| Primitive | What It Does |
|-----------|-------------|
| `agent.md` | Root orchestrator with builder→reviewer→tuner handoffs |
| `copilot-instructions.md` | Data marketplace domain (quality, privacy, synthetic, lineage) |
| 3 agents | Builder (gpt-4o), Reviewer (gpt-4o-mini), Tuner (gpt-4o-mini) |
| 3 skills | Deploy (225+ lines), Evaluate (110+ lines), Tune (225+ lines) |
| 4 prompts | `/deploy`, `/test`, `/review`, `/evaluate` with agent routing |

## Cost Estimate
| Environment | Monthly |
|-------------|---------|
| Dev/Test | $110–150 |
| Production | $380–500 |

## vs. Play 62 (Federated Learning Pipeline)
| Aspect | Play 62 | Play 97 |
|--------|---------|---------|
| Focus | Train models without sharing data | Share/sell datasets with privacy |
| Privacy | Federated (data stays local) | Anonymize/synthesize before sharing |
| Output | Trained model | Quality-scored dataset listing |
| Governance | Differential privacy on gradients | PII scanning + lineage tracking |

📖 [Full documentation](spec/README.md) · 🌐 [frootai.dev/solution-plays/97-ai-data-marketplace](https://frootai.dev/solution-plays/97-ai-data-marketplace) · 📦 [FAI Protocol](spec/fai-manifest.json)
