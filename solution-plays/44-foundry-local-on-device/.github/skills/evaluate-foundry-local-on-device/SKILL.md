---
name: "evaluate-foundry-local-on-device"
description: "Evaluate Foundry Local On-Device AI quality — local vs cloud response accuracy, latency comparison, cost savings, offline reliability, hardware utilization."
---

# Evaluate Foundry Local On-Device AI

## Prerequisites

- Deployed Foundry Local with hybrid routing (run `deploy-foundry-local-on-device` skill first)
- Test prompt dataset covering simple→complex range
- Python 3.11+ with `azure-ai-evaluation` package
- Both local model and cloud fallback accessible
- Telemetry logging enabled

## Step 1: Prepare Evaluation Dataset

```bash
mkdir -p evaluation/data

# Each test case: prompt + expected answer + complexity label
# evaluation/data/prompt-001.json
# {
#   "prompt": "What is the capital of France?",
#   "expected": "Paris",
#   "complexity": "simple",
#   "category": "factual-qa",
#   "expected_source": "local"
# }
```

Test categories:
- **Simple QA**: Factual questions, definitions (20 prompts → local)
- **Summarization**: Short text summarization (10 prompts → local)
- **Code Generation**: Simple code snippets (10 prompts → local)
- **Complex Analysis**: Multi-step reasoning (10 prompts → cloud)
- **Creative Writing**: Long-form creative content (5 prompts → cloud)
- **Offline Scenarios**: All above without network (10 prompts → local only)

## Step 2: Evaluate Response Quality (Local vs Cloud)

```bash
python evaluation/eval_quality.py \
  --test-data evaluation/data/ \
  --local-model Phi-4-mini \
  --cloud-model gpt-4o \
  --judge-model gpt-4o \
  --output evaluation/results/quality.json
```

Quality metrics:
| Metric | Description | Local Target | Cloud Target |
|--------|-------------|-------------|-------------|
| **Accuracy** (LLM judge) | Correctness of response | > 80% | > 95% |
| **Relevance** (LLM judge) | Response addresses the question | > 85% | > 95% |
| **Coherence** (LLM judge) | Logical, readable response | > 4.0/5.0 | > 4.5/5.0 |
| **Instruction Following** | Follows prompt format/constraints | > 80% | > 95% |
| **Quality Parity** | Local quality / cloud quality ratio | > 0.75 | Baseline |

Quality comparison by category:
| Category | Local Quality | Cloud Quality | Parity |
|----------|--------------|---------------|--------|
| Simple QA | Expected ~90% | ~98% | ~0.92 |
| Summarization | Expected ~80% | ~95% | ~0.84 |
| Code Generation | Expected ~75% | ~95% | ~0.79 |
| Complex Analysis | Expected ~55% | ~95% | ~0.58 (→ route to cloud) |
| Creative Writing | Expected ~65% | ~90% | ~0.72 (→ route to cloud) |

## Step 3: Evaluate Latency

```bash
python evaluation/eval_latency.py \
  --test-data evaluation/data/ \
  --output evaluation/results/latency.json
```

Latency metrics:
| Metric | Description | Local Target | Cloud Target |
|--------|-------------|-------------|-------------|
| **Time to First Token** | Initial response latency | < 200ms | < 800ms |
| **Tokens per Second** | Generation throughput | > 15 tok/s | > 50 tok/s |
| **End-to-End (100 tokens)** | Full response time | < 7s | < 3s |
| **Router Overhead** | Time for complexity classification | < 10ms | N/A |
| **Cold Start** | First inference after model load | < 5s | < 1s |

Latency by device class:
| Device Class | Model | TTFT | Tok/s | 100-token E2E |
|-------------|-------|------|-------|--------------|
| High-end (RTX 4090) | Phi-4 FP16 | ~100ms | ~30 | ~3.5s |
| Mid-range (RTX 3060) | Phi-4-mini INT8 | ~150ms | ~25 | ~4.5s |
| Low-end (CPU 8GB) | Phi-3-mini INT4 | ~300ms | ~15 | ~7s |
| Edge (4GB CPU) | Phi-3-mini INT4 | ~500ms | ~5 | ~20s |

## Step 4: Evaluate Cost Savings

```bash
python evaluation/eval_cost.py \
  --telemetry-log telemetry.jsonl \
  --output evaluation/results/cost.json
```

Cost metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Local Inference Rate** | % of queries handled locally | > 60% |
| **Cloud Savings** | Monthly API cost reduction | > 50% |
| **Cost per 1K Queries** | Blended cost (local=$0, cloud=$0.01) | < $5 |
| **Break-even Period** | When device cost pays for itself | < 6 months |

Cost comparison (1000 queries/month):
| Scenario | Cloud-Only | Hybrid (60/40) | Savings |
|----------|-----------|----------------|---------|
| All GPT-4o | $10.00 | $4.00 | 60% |
| All GPT-4o-mini | $1.00 | $0.40 | 60% |
| Mixed routing | $6.00 | $2.40 | 60% |
| Electricity cost | $0 | ~$0.50/mo | — |
| **Net savings** | — | — | **~55%** |

## Step 5: Evaluate Offline Reliability

```bash
python evaluation/eval_offline.py \
  --test-data evaluation/data/offline/ \
  --output evaluation/results/offline.json
```

Offline metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Offline Success Rate** | Queries answered without network | > 95% |
| **Graceful Degradation** | Complex queries handled gracefully | > 90% |
| **Cache Integrity** | Model loads correctly from cache | 100% |
| **Cold Start (offline)** | First query after boot, no network | < 10s |
| **Quality in Offline** | Quality vs online local inference | > 95% parity |

## Step 6: Evaluate Complexity Router

```bash
python evaluation/eval_router.py \
  --test-data evaluation/data/ \
  --output evaluation/results/router.json
```

Router metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Routing Accuracy** | Correct source for complexity | > 85% |
| **Over-routing to Cloud** | Simple queries sent to cloud | < 10% |
| **Under-routing to Cloud** | Complex queries kept local | < 10% |
| **Router Latency** | Classification overhead | < 10ms |

## Step 7: Generate Evaluation Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md \
  --thresholds config/guardrails.json
```

Report includes:
- Quality comparison: local vs cloud per category
- Latency dashboard by device class
- Cost savings projection (monthly/annual)
- Offline reliability summary
- Router accuracy analysis
- Recommendation: optimal complexity_threshold for this device

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Local accuracy | > 80% | config/guardrails.json |
| Quality parity | > 0.75 | config/guardrails.json |
| Local inference rate | > 60% | config/guardrails.json |
| Offline success | > 95% | config/guardrails.json |
| Router accuracy | > 85% | config/guardrails.json |
| Groundedness | > 0.85 | fai-manifest.json |
