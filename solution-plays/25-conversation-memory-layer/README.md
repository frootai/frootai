# Play 25 — Conversation Memory Layer 🧠💾

> Persistent AI memory with tiered storage — short-term, long-term, and episodic recall.

Give your AI agent persistent memory across conversations. Redis handles short-term session state, Cosmos DB stores compressed long-term summaries, and a vector store enables episodic recall of key facts and preferences. PII-aware with GDPR-compliant delete.

## Quick Start
```bash
cd solution-plays/25-conversation-memory-layer
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .  # Use @builder for memory tiers, @reviewer for privacy audit, @tuner for compression
```

## Architecture
| Service | Purpose |
|---------|---------|
| Redis Cache | Short-term memory (session state, 15-min TTL) |
| Cosmos DB | Long-term memory (compressed summaries, 90-day TTL) |
| Vector Store | Episodic memory (key facts, similarity-based recall) |
| Azure OpenAI (gpt-4o-mini) | Conversation compression |
| Azure OpenAI (embedding) | Memory embedding for vector recall |

## Memory Tiers
| Tier | Storage | TTL | What It Stores |
|------|---------|-----|---------------|
| Short-term | Redis | 15 min | Current conversation turns |
| Long-term | Cosmos DB | 90 days | Compressed summaries |
| Episodic | Vector store | 1 year | Key facts, preferences, decisions |

## Key Metrics
- Recall precision: ≥85% · Compression: 4000→200 tokens · PII scrub: 100% · Latency: <200ms

## DevKit (Memory-Focused)
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (tiers/compression/recall), Reviewer (privacy/PII/consent), Tuner (thresholds/TTL/cost) |
| 3 skills | Deploy (102 lines), Evaluate (103 lines), Tune (101 lines) |
| 4 prompts | `/deploy` (tiered memory), `/test` (recall), `/review` (PII/privacy), `/evaluate` (compression quality) |

**Note:** This is a memory/context management play. TuneKit covers compression prompts, recall similarity thresholds, per-tier TTLs, embedding model selection, and storage cost per user (~$0.04/user/mo with pruning) — not AI inference quality.

## Cost
| Dev | Prod (100K users) |
|-----|-------------------|
| $30–80/mo | ~$4,000/mo ($0.04/user) |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/25-conversation-memory-layer](https://frootai.dev/solution-plays/25-conversation-memory-layer)
