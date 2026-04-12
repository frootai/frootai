---
name: "tune-fai-meta-agent"
description: "Tune FAI Meta-Agent — routing model, play matching weights, combination rules, DevKit templates, feedback integration, cost optimization."
---

# Tune FAI Meta-Agent

## Prerequisites

- Deployed meta-agent with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`

## Step 1: Tune Play Routing

```json
// config/agents.json — routing settings
{
  "routing": {
    "method": "semantic_search_with_intent",
    "intent_classification_model": "gpt-4o-mini",
    "semantic_search_top_k": 10,
    "rerank_top_k": 3,
    "intent_categories": {
      "domains": ["rag", "agent", "voice", "security", "vision", "document", "data", "devops", "ml", "creative"],
      "industries": ["healthcare", "finance", "government", "education", "telecom", "retail", "agriculture", "energy", "legal", "general"],
      "complexities": ["low", "medium", "high", "very_high"]
    },
    "user_context_factors": {
      "existing_azure_services": {"weight": 0.2, "boost_matching_plays": true},
      "team_size": {"small": ["low", "medium"], "large": ["high", "very_high"]},
      "compliance_requirements": {"boost": 1.5, "suggest_compliance_play": true},
      "budget": {"filter_by_cost_tier": true}
    },
    "fallback_on_ambiguous": "ask_clarifying_questions"
  }
}
```

Routing tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `semantic_search_top_k` | 10 | Higher = consider more candidates, slower |
| `rerank_top_k` | 3 | More = give user more options |
| `existing_azure_services boost` | true | Recommend plays matching user's current infra |
| `compliance_requirements boost` | 1.5× | Higher = strongly suggest governance plays |

### Routing Decision Flow
| Step | Method | Fallback |
|------|--------|---------|
| 1. Intent classification | gpt-4o-mini (fast) | Rule-based keyword matching |
| 2. Semantic search | Vector similarity over 101 plays | Filter by domain + industry |
| 3. Context reranking | User infra + budget + compliance | Skip if no context |
| 4. Combination check | Static rules + dynamic matching | Primary only |
| 5. Rationale generation | gpt-4o (quality) | Template-based |

## Step 2: Tune Play Combination Rules

```json
// config/agents.json — combination settings
{
  "combinations": {
    "static_pairs": {
      "01-enterprise-rag + 99-governance": "RAG with AI governance",
      "04-voice-ai + 10-content-moderation": "Safe voice agent",
      "07-multi-agent + 98-evaluation": "Agents with benchmarking",
      "87-pricing + 89-inventory": "Retail intelligence suite",
      "46-healthcare + 35-compliance": "Compliant healthcare AI"
    },
    "dynamic_matching": {
      "enabled": true,
      "suggest_security_play_when": ["high_risk", "customer_facing", "pii_handling"],
      "suggest_governance_when": ["regulated_industry", "eu_ai_act"],
      "suggest_evaluation_when": ["multi_agent", "production_critical"],
      "max_complementary": 3
    },
    "anti_patterns": {
      "no_duplicate_domain": true,
      "no_conflicting_infra": true
    }
  }
}
```

Combination tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `max_complementary` | 3 | More = comprehensive but may overwhelm |
| `suggest_security_play_when` | 3 triggers | Add more triggers for stricter security |
| `no_duplicate_domain` | true | Prevents recommending two RAG plays together |

## Step 3: Tune DevKit Initialization

```json
// config/agents.json — DevKit settings
{
  "devkit_init": {
    "template_source": "play_catalog",
    "create_structure": {
      "devkit": [".github/copilot-instructions.md", ".github/agents/", ".github/prompts/", ".github/skills/", ".github/hooks/", ".github/workflows/"],
      "tunekit": ["config/openai.json", "config/guardrails.json", "config/agents.json"],
      "speckit": ["spec/fai-manifest.json", "spec/play-spec.json", "spec/README.md"],
      "infra": ["infra/main.bicep", "infra/parameters.json"],
      "evaluation": ["evaluation/eval.py", "evaluation/test-set.jsonl"]
    },
    "skip_infra_for": ["non_azure_plays"],
    "validation_after_init": true,
    "git_init": false,
    "open_in_vscode": true
  }
}
```

DevKit tuning:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `skip_infra_for` | non-Azure plays | Prevents empty Bicep for pure SaaS plays |
| `validation_after_init` | true | Verify all JSON/YAML valid after creation |
| `open_in_vscode` | true | Auto-open workspace in VS Code after init |

## Step 4: Tune Feedback Loop

```json
// config/agents.json — feedback settings
{
  "feedback": {
    "tracking_events": ["recommended", "initialized", "deployed", "evaluated", "satisfaction"],
    "satisfaction_prompt_after_deploy": true,
    "rating_scale": "1_to_5",
    "retrain_routing_frequency": "monthly",
    "min_feedback_for_retrain": 50,
    "success_criteria": {
      "recommended_to_initialized": "> 70%",
      "initialized_to_deployed": "> 50%",
      "avg_satisfaction": "> 4.0"
    },
    "analyze_abandoned": {
      "enabled": true,
      "reasons": ["too_complex", "wrong_play", "missing_prerequisite", "budget_exceeded"]
    }
  }
}
```

| Metric | Target | Action on Miss |
|--------|--------|---------------|
| Recommended → Initialized | > 70% | Improve routing accuracy |
| Initialized → Deployed | > 50% | Simplify deployment skill |
| Avg satisfaction | > 4.0 | Analyze low-rated recommendations |
| Abandoned analysis | < 30% | Understand why users don't proceed |

## Step 5: Tune Model Configuration

```json
// config/openai.json
{
  "intent_classification": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 100
  },
  "routing_rationale": {
    "model": "gpt-4o",
    "temperature": 0.3,
    "max_tokens": 500
  },
  "play_embedding": {
    "model": "text-embedding-3-large",
    "dimensions": 1536
  }
}
```

| Task | Model | Why |
|------|-------|-----|
| Intent classification | gpt-4o-mini | Fast, high-volume, structured output |
| Routing rationale | gpt-4o | Quality explanation for user |
| Play embedding | text-embedding-3-large | Best semantic matching |

## Step 6: Cost Optimization

```python
# FAI Meta-Agent cost per month:
# LLM:
#   - Intent classification (gpt-4o-mini, ~1000 queries × $0.001): ~$1/month
#   - Routing rationale (gpt-4o, ~1000 × $0.02): ~$20/month
#   - Play embeddings (one-time, 101 plays): ~$0.01 (cached)
# Infrastructure:
#   - AI Search Basic: ~$75/month
#   - Container Apps: ~$15/month
#   - Cosmos DB Serverless: ~$5/month
# Total: ~$116/month for 1000 routing queries
# NOTE: This is the only play that serves ALL other plays

# Cost reduction:
# 1. gpt-4o-mini for rationale: save ~$19/month
# 2. Cache routing for repeat queries: save ~30% LLM
# 3. Reduce embedding dimensions to 256: save storage
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| gpt-4o-mini rationale | ~$19/month | Less compelling recommendations |
| Query caching | ~30% LLM | Miss context changes |
| Smaller embeddings | ~80% storage | Slightly lower precision |

## Step 7: Verify Tuning Impact

```bash
python evaluation/eval_routing.py --test-data evaluation/data/routing_queries/
python evaluation/eval_combinations.py --test-data evaluation/data/combinations/
python evaluation/eval_devkit.py --test-data evaluation/data/init_results/
python evaluation/eval_feedback.py --test-data evaluation/data/feedback/

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Top-3 routing accuracy | baseline | > 90% | > 90% |
| Combination validity | baseline | > 95% | > 95% |
| DevKit completeness | baseline | 100% | 100% |
| Recommendation → Init | baseline | > 70% | > 70% |
| Monthly cost | ~$116 | ~$80 | < $150 |
