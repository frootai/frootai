---
name: tune-prompt-management
description: "Tune Prompt Management — optimize token usage, A/B test configuration, few-shot example selection, template compression, prompt caching. Use when: tune, optimize prompts."
---

# Tune Prompt Management

## When to Use
- Reduce token usage in system prompts (cost optimization)
- Configure A/B tests for prompt improvement
- Select optimal few-shot examples for each prompt
- Compress templates without losing quality
- Optimize prompt caching strategy

## Tuning Dimensions

### Dimension 1: Token Optimization

| Technique | Token Reduction | Quality Impact | Complexity |
|-----------|----------------|---------------|-----------|
| Remove redundant instructions | 10-20% | None | Low |
| Shorten few-shot examples | 15-30% | Low (1-2%) | Low |
| Use structured output format | 10-15% | None | Medium |
| Replace prose with bullet points | 20-30% | None | Low |
| Merge overlapping directives | 10-15% | None | Low |
| Remove obvious instructions | 5-10% | None | Low |

**Token budget framework**:
| Component | Budget % | Example (4096 window) |
|-----------|---------|----------------------|
| System prompt | ≤ 15% | ~600 tokens max |
| Few-shot examples | ≤ 10% | ~400 tokens |
| Retrieved context | ≤ 50% | ~2000 tokens |
| User query | ≤ 5% | ~200 tokens |
| Response space | ≥ 20% | ~800 tokens |

### Dimension 2: A/B Testing Configuration

| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| Traffic split | 50/50 | 10/90 to 50/50 | Lower variant % = safer rollout |
| Min samples | 1000 | 500-5000 | More = higher confidence |
| Duration | 7 days | 3-30 days | Longer = captures weekly patterns |
| Significance | p < 0.05 | 0.01-0.10 | Lower = more confident winner |
| Primary metric | Quality score | Quality/Latency/Cost | Choose most important |

**A/B test lifecycle**:
1. Create variant prompt (new version)
2. Start test with 10% traffic to variant (safe rollout)
3. If no regressions after 24h: increase to 50/50
4. Run for minimum duration (7 days)
5. Analyze: statistical significance on primary metric
6. Promote winner or extend test

### Dimension 3: Few-Shot Example Selection

| Strategy | Method | Best For |
|----------|--------|---------|
| Random | Pick N random examples | General-purpose prompts |
| Diversity | Select across categories | Classification prompts |
| Similarity | Closest to user query (dynamic) | RAG/QA prompts |
| Difficulty | Include edge cases | Complex reasoning prompts |
| Recency | Most recent examples | Evolving domains |

**Dynamic few-shot** (most effective):
- Embed all candidate examples offline
- At runtime: embed user query → find top-K similar → inject into prompt
- Reduces token usage (only relevant examples) + improves quality

### Dimension 4: Template Compression

| Before | After | Tokens Saved |
|--------|-------|-------------|
| "You are a helpful AI assistant that helps users with..." | "You help users with..." | ~10 tokens |
| "Please ensure that you always..." | "Always..." | ~5 tokens |
| "It is important to note that..." | [delete — obvious] | ~8 tokens |
| 3 repetitive few-shot examples | 1 diverse example | ~200 tokens |
| Prose paragraph of rules | Bullet list of rules | ~30% |

**Compression checklist**:
- [ ] Remove filler words ("please", "ensure", "it is important")
- [ ] Merge overlapping instructions
- [ ] Replace prose with bullet points
- [ ] Reduce few-shot examples to minimum effective count
- [ ] Use abbreviations for repeated terms
- [ ] Test compressed version: quality delta < 2%

### Dimension 5: Prompt Caching Strategy

| Strategy | Cache Scope | TTL | Best For |
|----------|------------|-----|---------|
| Full prompt cache | Rendered template + variables | 5 min | Repeated queries |
| Template cache | Template only (variables injected at runtime) | 1 hour | High-volume apps |
| Few-shot cache | Pre-computed few-shot embeddings | 24 hours | Dynamic few-shot |
| No cache | Always fetch from registry | — | Rapidly evolving prompts |

## Production Readiness Checklist
- [ ] System prompts ≤ 15% of context window
- [ ] All prompts tested against injection suite
- [ ] A/B testing framework configured and validated
- [ ] Few-shot examples curated (diverse, high-quality)
- [ ] Token counts documented per prompt template
- [ ] Caching configured for production volume
- [ ] Version rollback tested successfully
- [ ] Prompt analytics showing usage patterns
- [ ] Template compliance verified against standards

## Output: Tuning Report
After tuning, compare:
- Token count reduction per prompt
- A/B test results (winner with confidence interval)
- Few-shot selection impact on quality
- Template compression savings
- Caching hit rate and latency improvement
