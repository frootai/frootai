---
name: tune-ai-code-review-pipeline
description: "Tune AI Code Review — optimize review prompts, reduce false positives, configure severity routing, model selection per file type, cost per review. Use when: tune, optimize review quality."
---

# Tune AI Code Review Pipeline

## When to Use
- Reduce false positive rate in review comments
- Optimize review prompts for actionable feedback
- Configure model routing by file type and diff size
- Adjust severity thresholds and merge gate rules
- Reduce cost per review while maintaining quality

## Tuning Dimensions

### Dimension 1: Review Prompt Optimization

| Directive | Before | After | Impact |
|-----------|--------|-------|--------|
| Scope | "Review this code" | "Review for security and logic only" | -50% noise |
| Confidence | (none) | "Only comment when confidence > 0.8" | -30% FP |
| Style filter | Reviews style | "Do NOT comment on naming or formatting" | -40% noise |
| Context | File diff only | Diff + surrounding functions | Better accuracy |
| Examples | None | 2 good + 1 bad example comment | Consistent quality |

### Dimension 2: Model Routing by File Type

| File Type | Model | Why | Cost |
|-----------|-------|-----|------|
| Security-sensitive (.auth, .crypto) | gpt-4o | Reasoning quality critical | $0.01/file |
| Infrastructure (.bicep, .tf) | gpt-4o | Config errors = outages | $0.01/file |
| Business logic (.service, .controller) | gpt-4o | Logic errors hard to catch | $0.01/file |
| Tests (.test, .spec) | gpt-4o-mini | Lower risk, simpler patterns | $0.002/file |
| Style/config (.json, .yaml, .css) | gpt-4o-mini | Low complexity | $0.002/file |
| Documentation (.md) | Skip | Not worth AI review | $0 |

### Dimension 3: Severity Threshold Tuning

| Finding Type | Default Severity | If Too Noisy | If Missing Real Issues |
|-------------|-----------------|-------------|----------------------|
| Hardcoded secrets | Critical (block) | Keep (always block) | Lower detection threshold |
| SQL injection | Critical (block) | Keep (always block) | Add more SQL patterns |
| Null pointer | High (request changes) | Lower to Medium | Keep High |
| Missing error handling | Medium (comment) | Lower to Low | Raise to High |
| Variable naming | Low (suggestion) | Remove entirely | Keep Low |

### Dimension 4: False Positive Reduction

| Strategy | FP Reduction | Complexity |
|----------|-------------|-----------|
| Add "high confidence only" to prompt | 30% | Low |
| Filter by file extension (skip .md, .json) | 20% | Low |
| Deduplicate similar comments | 15% | Medium |
| Add context (full function, not just diff) | 25% | Medium |
| Track dismissed comments, retrain prompt | 40% | High |

### Dimension 5: Cost Per Review

| Component | Cost Driver | Optimization |
|-----------|------------|-------------|
| LLM review | Tokens per file × number of files | Route simple files to mini |
| Static analysis | CI runner time | Cache dependencies |
| OWASP scan | Dependency count | Only scan changed lockfiles |
| GitHub API | Comment creation | Batch comments into single review |

**Per-PR cost estimate** (10 changed files, avg 50 lines each):
- gpt-4o (5 complex files): ~$0.05
- gpt-4o-mini (3 simple files): ~$0.006
- Static analysis (CI): ~$0.01
- OWASP scan: ~$0.005
- **Total: ~$0.07/PR** — optimize to ~$0.04 with routing

## Production Readiness Checklist
- [ ] False positive rate < 15%
- [ ] Developer trust score ≥ 4.0/5.0
- [ ] OWASP Top 10 coverage complete
- [ ] Review latency < 3 minutes
- [ ] Merge gate blocking only on critical findings
- [ ] Comment deduplication working
- [ ] Model routing configured per file type
- [ ] Cost per PR within budget
- [ ] No style-only comments (noise eliminated)

## Output: Tuning Report
After tuning, compare:
- False positive rate reduction
- Comment actionability improvement
- Cost per review reduction (model routing)
- Developer trust score change
- Review latency improvement

## Tuning Playbook
1. **Baseline**: Run 30 test PRs (15 with issues, 15 clean), record all metrics
2. **Prompt tune**: Add "high confidence only" + "no style" directives
3. **Route models**: gpt-4o for security/logic files, gpt-4o-mini for tests/config
4. **Filter files**: Exclude .md, .json, generated code from review
5. **Add context**: Include full function (not just diff) for medium+ diffs
6. **Track feedback**: Monitor developer dismiss rate for 2 weeks
7. **Iterate**: Adjust thresholds based on developer trust data
8. **Re-baseline**: Run same 30 PRs, compare before/after
