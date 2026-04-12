---
name: "tune-continual-learning-agent"
description: "Tune Continual Learning Agent — memory retention, distillation thresholds, reflection frequency, decay rates, retrieval parameters, cost optimization."
---

# Tune Continual Learning Agent

## Prerequisites

- Deployed continual learning agent with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Memory Retention

```json
// config/guardrails.json — memory settings
{
  "memory": {
    "episodic": {
      "max_episodes": 10000,
      "embedding_model": "text-embedding-3-large",
      "embedding_dimensions": 1536,
      "retrieval_top_k": 5,
      "similarity_threshold": 0.65,
      "importance_levels": ["critical", "high", "normal", "low"],
      "auto_classify_importance": true
    },
    "semantic": {
      "min_episodes_for_distillation": 3,
      "confidence_threshold": 0.70,
      "max_knowledge_entries": 5000,
      "override_on_conflict": "newer_if_higher_confidence"
    },
    "procedural": {
      "update_on_improvement": true,
      "min_improvement_pct": 10,
      "max_skills": 500
    }
  }
}
```

Memory tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `max_episodes` | 10,000 | Higher = more memory, more storage cost |
| `similarity_threshold` | 0.65 | Lower = recall more (noisier), higher = miss subtle matches |
| `min_episodes_for_distillation` | 3 | Lower = distill sooner (less reliable), higher = wait longer |
| `confidence_threshold` | 0.70 | Lower = accept weaker knowledge |
| `min_improvement_pct` | 10% | Lower = update procedures more often |

## Step 2: Tune Decay & Forgetting

```json
// config/agents.json — decay settings
{
  "decay": {
    "rates_by_importance": {
      "critical": 0.999,
      "high": 0.990,
      "normal": 0.970,
      "low": 0.900
    },
    "archive_threshold": 0.10,
    "maintenance_frequency": "daily",
    "pruning_strategy": "importance_x_recency",
    "never_forget": ["errors_causing_harm", "security_incidents", "critical_corrections"],
    "fast_forget": ["routine_tasks", "redundant_similar_episodes"]
  }
}
```

Decay tuning:
| Importance | Decay Rate | Half-Life (~) | Use Case |
|-----------|-----------|--------------|----------|
| Critical | 0.999/day | ~2 years | Never-repeat errors, security |
| High | 0.990/day | ~70 days | Successful complex tasks |
| Normal | 0.970/day | ~23 days | Standard learning |
| Low | 0.900/day | ~7 days | Routine, already distilled |

## Step 3: Tune Reflection Engine

```json
// config/agents.json — reflection settings
{
  "reflection": {
    "frequency": "after_every_task",
    "depth": "standard",
    "reflection_model": "gpt-4o-mini",
    "trigger_deep_reflection_on": ["failure", "unexpected_outcome", "first_of_type"],
    "deep_reflection_model": "gpt-4o",
    "include_past_episodes": 3,
    "auto_update_knowledge_on_pattern": true,
    "min_pattern_occurrences": 3,
    "meta_reflection_frequency": "weekly",
    "meta_reflection_scope": "all_reflections_this_week"
  }
}
```

Reflection tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `frequency` | after_every_task | "selective" = only on failures (save cost) |
| `depth` (standard vs deep) | standard | Deep = more tokens, better insight |
| `deep_reflection_model` | gpt-4o | gpt-4o-mini = cheaper, less insightful |
| `meta_reflection_frequency` | weekly | Monthly = less overhead, slower improvement |

### Reflection Depth Levels
| Level | When Triggered | Model | Tokens | Quality |
|-------|---------------|-------|--------|---------|
| Quick | Routine success | gpt-4o-mini | ~200 | Basic what-went-well |
| Standard | Normal tasks | gpt-4o-mini | ~500 | Lessons + improvements |
| Deep | Failure/novel task | gpt-4o | ~1000 | Root cause + knowledge update |
| Meta | Weekly rollup | gpt-4o | ~2000 | Cross-task pattern synthesis |

## Step 4: Tune Distillation Pipeline

```json
// config/agents.json — distillation settings
{
  "distillation": {
    "trigger": "episode_count_threshold",
    "min_similar_episodes": 3,
    "similarity_grouping_method": "embedding_clustering",
    "cluster_threshold": 0.75,
    "distillation_model": "gpt-4o",
    "output_format": "pattern_antipattern_conditions",
    "replace_episodes_after_distill": false,
    "accelerate_decay_of_distilled": true,
    "distillation_frequency": "daily",
    "quality_check_on_distilled": true
  }
}
```

| Parameter | Default | Impact |
|-----------|---------|--------|
| `min_similar_episodes` | 3 | Higher = more reliable patterns, slower learning |
| `cluster_threshold` | 0.75 | Lower = group unlike episodes (weaker patterns) |
| `accelerate_decay_of_distilled` | true | Distilled episodes fade faster (saves memory) |
| `quality_check_on_distilled` | true | Verify distilled knowledge against episodes |

## Step 5: Tune Model Configuration

```json
// config/openai.json
{
  "reasoning": {
    "model": "gpt-4o",
    "temperature": 0.3,
    "max_tokens": 2000
  },
  "reflection": {
    "model": "gpt-4o-mini",
    "temperature": 0.2,
    "max_tokens": 500
  },
  "deep_reflection": {
    "model": "gpt-4o",
    "temperature": 0.2,
    "max_tokens": 1000
  },
  "distillation": {
    "model": "gpt-4o",
    "temperature": 0,
    "max_tokens": 800
  },
  "episode_embedding": {
    "model": "text-embedding-3-large",
    "dimensions": 1536
  }
}
```

| Task | Model | Why |
|------|-------|-----|
| Reasoning | gpt-4o | Core agent intelligence |
| Standard reflection | gpt-4o-mini | High frequency, cost-sensitive |
| Deep reflection | gpt-4o | Root cause analysis needs depth |
| Distillation | gpt-4o | Knowledge quality is critical |
| Embedding | text-embedding-3-large | Best retrieval quality |

## Step 6: Cost Optimization

```python
# Continual Learning Agent cost per month (500 tasks):
# LLM:
#   - Reasoning (gpt-4o, 500 tasks × $0.05): ~$25/month
#   - Standard reflection (gpt-4o-mini, 500 × $0.002): ~$1/month
#   - Deep reflection (gpt-4o, ~50 × $0.05): ~$2.50/month
#   - Distillation (gpt-4o, ~20 × $0.03): ~$0.60/month
#   - Meta reflection (gpt-4o, weekly × $0.10): ~$0.40/month
# Embedding:
#   - text-embedding-3-large (500 tasks × $0.0001): ~$0.05/month
# Infrastructure:
#   - AI Search S1: ~$250/month
#   - Container Apps: ~$15/month
#   - Cosmos DB Serverless: ~$10/month
# Total: ~$305/month for 500 tasks/month

# Cost reduction:
# 1. Reflect only on failures (save ~$0.80/month reflection)
# 2. gpt-4o-mini for distillation (save ~$0.50/month)
# 3. AI Search Basic (if <1M memories): save $200/month
# 4. Reduce embedding dimensions (1536 → 256): save 80% vector storage
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Selective reflection | ~$0.80/month | Miss lessons from successful tasks |
| gpt-4o-mini distillation | ~$0.50/month | Lower quality knowledge patterns |
| Search Basic | ~$200/month | 15M memory limit |
| Smaller embeddings | ~80% storage | Lower retrieval precision |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_memory.py --test-data evaluation/data/retrieval_tests/
python evaluation/eval_learning.py --test-data evaluation/data/learning_sessions/
python evaluation/eval_reflection.py --test-data evaluation/data/reflections/
python evaluation/eval_forgetting.py --test-data evaluation/data/long_term/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Episodic recall precision | baseline | > 80% | > 80% |
| Performance improvement | baseline | Positive trend | Positive |
| Critical retention | baseline | > 95% | > 95% |
| Repeated mistake rate | baseline | < 10% | < 10% |
| Monthly cost | ~$305 | ~$100 | < $350 |
