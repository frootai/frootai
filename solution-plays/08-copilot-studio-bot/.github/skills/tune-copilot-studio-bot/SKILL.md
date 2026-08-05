---
name: tune-copilot-studio-bot
description: "Tune Copilot Studio Bot — optimize topic triggers, knowledge source relevance, conversation flow, generative answers quality. Use when: tune, optimize."
---

# Tune Copilot Studio Bot

## When to Use
- Optimize topic trigger accuracy based on analytics
- Tune knowledge source configuration for better relevance
- Shorten conversation flows for faster resolution
- Improve generative answers quality and grounding
- Reduce fallback and escalation rates

## Tuning Dimensions

### Dimension 1: Topic Trigger Optimization

| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| Trigger phrases per topic | 3-5 | 8-15 | More = better recognition |
| Phrase diversity | Low | Low/Medium/High | Diverse = fewer misses |
| Entity extraction | Basic | Basic/Advanced | Advanced = structured data capture |
| Confirmation prompts | Always | Always/Smart/Never | Smart = fewer turns |

**Optimization steps**:
1. Review analytics: which queries hit fallback?
2. Add those queries as trigger phrases to matching topics
3. Remove duplicate triggers across topics
4. Test with new phrases to verify no cross-triggering

### Dimension 2: Knowledge Source Tuning

| Parameter | Default | Recommendation | Impact |
|-----------|---------|---------------|--------|
| Source count | 5+ | 2-3 focused | Fewer sources = more relevant answers |
| SharePoint scope | Entire site | Specific page libraries | Reduces noise |
| Refresh interval | Weekly | Daily for dynamic content | Freshness |
| Content chunking | Auto | Sentence-level | Better precision |
| Answer length | Medium | Short for FAQ, Medium for guides | User preferences |

**Optimization steps**:
1. Check knowledge answer logs: which sources are used?
2. Remove sources that never contribute useful answers
3. Add page-level filtering for large SharePoint sites
4. Test with real user queries from analytics

### Dimension 3: Conversation Flow Optimization

| Metric | Current | Target | How to Improve |
|--------|---------|--------|---------------|
| Avg turns to resolution | 7+ | < 5 | Remove unnecessary confirmation steps |
| Branch depth | 4+ | ≤ 3 | Flatten decision trees |
| Abandonment rate | 20%+ | < 15% | Add "quick exit" at each step |
| Re-prompt rate | 15%+ | < 5% | Improve entity extraction prompts |

**Flow optimization patterns**:
- Combine related questions into single adaptive card
- Use buttons instead of free-text where possible
- Show progress indicator for multi-step flows
- Offer "Skip" option for optional fields
- Auto-fill known user data from Microsoft Graph

### Dimension 4: Generative Answers Quality

| Parameter | Default | Strict | Balanced |
|-----------|---------|--------|----------|
| Grounding instruction | Basic | "ONLY from indexed content" | "Prefer indexed, supplement minimally" |
| Citation style | None | Required | Recommended |
| Answer confidence | Show all | ≥ 0.8 only | ≥ 0.6 with warning |
| Fallback behavior | Generic response | "I don't know" | Suggest related topics |

### Dimension 5: Cost & Performance

| Component | Cost Driver | Optimization |
|-----------|------------|-------------|
| Copilot Studio license | Per-tenant | N/A (fixed cost) |
| Power Automate | Flow runs | Batch actions, reduce flow calls |
| Azure OpenAI (generative) | Tokens | Cache common answers, limit response length |
| Microsoft Graph | API calls | Cache user profile data |

## Production Readiness Checklist
- [ ] All topics have 8+ trigger phrases
- [ ] Knowledge sources returning relevant answers (≥ 0.8 grounding)
- [ ] Fallback rate < 20%
- [ ] Resolution rate ≥ 65%
- [ ] Average conversation turns < 5
- [ ] Authentication flow tested end-to-end
- [ ] All Power Automate actions error-handled
- [ ] Escalation to human agent works
- [ ] Content moderation active
- [ ] Analytics dashboard configured and monitored

## Output: Tuning Report
After tuning, generate comparison:
- Topic trigger accuracy delta
- Fallback rate change
- Resolution rate improvement
- Average turns reduction
- Knowledge relevance score change
- Cost per conversation estimate
