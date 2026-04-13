---
description: "LLM selection standards — model routing config, benchmark-driven selection, cost/quality tradeoffs."
applyTo: "**/*.json, **/*.py"
waf:
  - "cost-optimization"
  - "performance-efficiency"
---

# LLM Selection & Routing — FAI Standards

## Model Routing by Task Complexity

Route requests to the cheapest model that meets quality thresholds:

| Task Type | Model | Why |
|-----------|-------|-----|
| Classification, tagging, extraction | `gpt-4o-mini` | Fast, cheap, 95%+ accuracy on structured tasks |
| Summarization, Q&A, RAG grounding | `gpt-4o` | Best quality/cost ratio for reasoning |
| Complex multi-step analysis, math, code | `o3-mini` | Chain-of-thought reasoning, higher accuracy |
| Research, long-context synthesis | `o3` | Deep reasoning, large context handling |
| Embeddings | `text-embedding-3-large` | 3072-dim, best retrieval quality |
| Embeddings (budget) | `text-embedding-3-small` | 1536-dim, 5x cheaper, adequate for most RAG |

## Deployment Name Abstraction

Never hardcode model names. Use deployment aliases in `config/models.json`:

```json
{
  "models": {
    "fast": { "deployment": "gpt-4o-mini-2024-07-18", "maxTokens": 4096, "temperature": 0.0 },
    "balanced": { "deployment": "gpt-4o-2024-11-20", "maxTokens": 8192, "temperature": 0.3 },
    "reasoning": { "deployment": "o3-mini-2025-01-31", "maxTokens": 16384, "temperature": 1.0 },
    "embedding": { "deployment": "text-embedding-3-large", "dimensions": 3072 }
  },
  "routing": {
    "classify": "fast",
    "summarize": "balanced",
    "analyze": "reasoning",
    "embed": "embedding"
  },
  "fallback": ["balanced", "fast"]
}
```

## Model Router Implementation

```python
# config-driven model router with fallback chain
import json, os
from openai import AzureOpenAI

class ModelRouter:
    def __init__(self, config_path: str = "config/models.json"):
        with open(config_path) as f:
            self.config = json.load(f)

    def get_model(self, task: str) -> dict:
        alias = self.config["routing"].get(task, "balanced")
        return self.config["models"][alias]

    async def complete(self, task: str, messages: list, client: AzureOpenAI) -> str:
        model_cfg = self.get_model(task)
        fallbacks = [model_cfg["deployment"]] + [
            self.config["models"][f]["deployment"] for f in self.config.get("fallback", [])
        ]
        for deployment in fallbacks:
            try:
                resp = client.chat.completions.create(
                    model=deployment,
                    messages=messages,
                    max_tokens=model_cfg.get("maxTokens", 4096),
                    temperature=model_cfg.get("temperature", 0.0),
                )
                return resp.choices[0].message.content
            except Exception as e:
                if "429" in str(e) or "503" in str(e):
                    continue  # try next fallback
                raise
        raise RuntimeError("All model fallbacks exhausted")
```

## SLM vs LLM Decision Criteria

Use **Small Language Models** (gpt-4o-mini, Phi-3) when:
- Task is classification, extraction, or formatting (structured output)
- Latency budget is <500ms p95
- Cost per 1M tokens matters (10x cheaper than large models)
- Input/output is short (<2K tokens)

Use **Large Language Models** (gpt-4o, o3) when:
- Multi-step reasoning or complex instruction following required
- Output quality directly impacts user trust (customer-facing summaries)
- Long-context grounding (>8K input tokens with citations)
- Task requires world knowledge beyond training data

## PTU vs Pay-As-You-Go Decision Matrix

| Criteria | PTU (Provisioned) | PAYG (Token-based) |
|----------|-------------------|--------------------|
| Traffic | Steady, predictable >50K TPM | Bursty, <10K TPM average |
| Latency SLA | Guaranteed p99 <2s | Best-effort, may spike |
| Cost breakeven | ~$0.06/1K tokens equivalent | Standard per-token pricing |
| Commitment | 1-month minimum | None |
| Recommendation | Production workloads | Dev/test, low-volume prod |

## Model Version Pinning

- Always pin to dated versions: `gpt-4o-2024-11-20`, never `gpt-4o` (auto-upgrades break prompts)
- Track model retirement dates — Azure gives 90-day deprecation notice
- Test new versions against evaluation suite BEFORE swapping deployment
- Keep a `model-versions.lock` file in config/ tracking deployed versions per environment

## A/B Testing Models

```typescript
// Traffic splitting for model comparison
function selectModel(userId: string, experiment: string): string {
  const config = loadConfig("config/experiments.json");
  const exp = config.experiments[experiment];
  if (!exp?.enabled) return exp?.control ?? "balanced";

  // Deterministic split by user ID hash
  const hash = createHash("sha256").update(userId + experiment).digest();
  const bucket = hash[0] / 255;
  return bucket < exp.trafficSplit ? exp.treatment : exp.control;
}
// Log: { experiment, model, userId, latencyMs, qualityScore, tokenCount }
```

## Evaluation Metrics (Gate Before Promotion)

Every model swap must pass these thresholds on the evaluation dataset:

| Metric | Threshold | Measurement |
|--------|-----------|-------------|
| Groundedness | ≥ 4.0 / 5.0 | Does output stay faithful to provided context? |
| Relevance | ≥ 4.0 / 5.0 | Does output address the user's question? |
| Fluency | ≥ 4.0 / 5.0 | Is output grammatically correct and readable? |
| Coherence | ≥ 3.5 / 5.0 | Is output logically consistent? |
| Latency p95 | ≤ 3,000ms | End-to-end response time |
| Cost delta | ≤ +20% | Per-request cost vs current model |

## Multi-Model Pipelines

Chain models for cost-efficient quality:

1. **Classify** (gpt-4o-mini) → determine intent + complexity score
2. **Route** → simple queries to gpt-4o-mini, complex to gpt-4o
3. **Generate** → primary response with citations
4. **Validate** (gpt-4o-mini) → check groundedness, reject hallucinations
5. **Fallback** → if validation fails, re-generate with gpt-4o + stricter prompt

## Preferred Patterns

- ✅ Config-driven deployment names — swap models without code changes
- ✅ Fallback chains with automatic failover on 429/503
- ✅ Evaluation gate before any model promotion to production
- ✅ Deterministic A/B splits by user hash (not random — reproducible)
- ✅ `temperature: 0.0` for classification/extraction, `0.3` for generation, `1.0` for reasoning models
- ✅ `max_tokens` always set from config — never unlimited
- ✅ Pin model versions with dated suffixes in deployment config
- ✅ Track token usage per-request for FinOps dashboards

## Anti-Patterns

- ❌ Hardcoding `model="gpt-4o"` in application code — use deployment abstraction
- ❌ Using gpt-4o for simple classification (10x cost, no quality gain)
- ❌ Using gpt-4o-mini for complex reasoning (fails on multi-step logic)
- ❌ Setting `temperature > 0` on reasoning models (o1/o3 ignore it, wastes prompt space)
- ❌ Skipping evaluation when swapping model versions ("same family, should be fine")
- ❌ PAYG for steady 100K+ TPM workloads (PTU is 40-60% cheaper)
- ❌ Unpinned model versions — auto-upgrade causes silent regression
- ❌ Single model for all tasks — no routing = overpaying or underperforming
- ❌ Logging full prompts/completions in production (PII + cost + storage)

## WAF Alignment

| Pillar | LLM Selection Practice |
|--------|----------------------|
| **Cost Optimization** | Model routing by complexity, PTU for steady traffic, token budget enforcement, SLM-first policy |
| **Performance Efficiency** | Latency-aware routing, streaming for generation, gpt-4o-mini for <500ms tasks |
| **Reliability** | Fallback chains across deployments, version pinning, evaluation gates |
| **Security** | No model names/keys in code, DefaultAzureCredential, Content Safety on outputs |
| **Operational Excellence** | A/B testing framework, per-request telemetry, model version tracking |
| **Responsible AI** | Groundedness thresholds, hallucination validation step, bias evaluation in test suite |
