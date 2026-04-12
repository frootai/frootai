---
name: tune-content-moderation
description: "Tune Content Moderation — optimize severity thresholds per category, reduce false positives, custom blocklist management, latency optimization. Use when: tune."
---

# Tune Content Moderation

## When to Use
- Optimize severity thresholds to balance safety vs usability
- Reduce false positive rate without compromising detection
- Manage and maintain custom blocklists
- Optimize moderation latency for high-throughput applications
- Configure per-use-case moderation profiles

## Tuning Dimensions

### Dimension 1: Severity Threshold Optimization

| Category | Consumer App | Enterprise Internal | Developer Tool |
|----------|-------------|-------------------|----------------|
| Hate | ≥ 2 (Low) | ≥ 4 (Medium) | ≥ 4 (Medium) |
| Violence | ≥ 2 (Low) | ≥ 4 (Medium) | ≥ 6 (High) |
| SelfHarm | ≥ 2 (Low) | ≥ 2 (Low) | ≥ 2 (Low) |
| Sexual | ≥ 2 (Low) | ≥ 4 (Medium) | ≥ 4 (Medium) |

**Tuning methodology**:
1. Start with strict thresholds (≥ 2 for all categories)
2. Run evaluation on 100+ test samples
3. Identify false positives per category
4. Raise threshold for categories with > 5% false positives
5. Re-evaluate and verify recall stays ≥ 95%

### Dimension 2: False Positive Reduction

| Strategy | Impact | Complexity |
|----------|--------|-----------|
| Raise severity threshold | Reduces FP, may miss some harmful | Low |
| Add context exceptions | Domain-specific exclusions | Medium |
| Custom categories | Replace broad detection with targeted | High |
| Human-in-the-loop | Review borderline cases | Operational |

**Context-aware exceptions**:
- Medical/healthcare: exclude clinical terms from Violence
- Legal: exclude legal terminology from Hate
- Security research: exclude CVE descriptions from harmful
- Code: exclude code snippets from content analysis

### Dimension 3: Custom Blocklist Management

| Parameter | Default | Recommendation | Notes |
|-----------|---------|---------------|-------|
| Term count per blocklist | 0 | 50-500 | Too many = performance overhead |
| Blocklist count | 0 | 2-5 per domain | Separate by category |
| Refresh frequency | Manual | Weekly | Stakeholder review before adding |
| Partial matching | Disabled | Keep disabled | Reduces false positives |

**Blocklist hygiene**:
- Review and prune quarterly (remove obsolete terms)
- Track false positive rate per blocklist
- Separate blocklists by purpose (competitors, regulated terms, brand safety)
- Document the reason for each term's inclusion

### Dimension 4: Latency Optimization

| Strategy | Latency Reduction | When to Use |
|----------|------------------|-------------|
| Text chunking | 30-50% for long text | Documents > 1000 chars |
| Parallel analysis | 40-60% for batch | Multiple content items |
| Category subset | 20-30% | Only check relevant categories |
| Caching | 80-95% for repeated | FAQ/template content |
| Regional deployment | 10-30ms | Cross-region latency |

**Optimization steps**:
1. Profile: measure latency breakdown (network, analysis, response)
2. If network dominant: deploy Content Safety in same region as app
3. If analysis slow: chunk large text, analyze categories selectively
4. If repeated content: cache moderation results (hash-based, 1h TTL)

### Dimension 5: Cost Optimization

| Component | Cost Driver | Optimization |
|-----------|------------|-------------|
| Text analysis | 1,000 text records per unit | Batch requests, use caching |
| Image analysis | 1 image per unit | Resize before analysis, skip thumbnails |
| Custom categories | Training + inference | Use only when prebuilt insufficient |
| Blocklists | Free (included) | Prefer blocklists over custom categories |

**Monthly cost estimate** (100K moderations/day):
- Text analysis: ~$300/mo (3M records/mo at $1/1000)
- Image analysis: ~$150/mo (if 50% have images)
- **Total: ~$450/mo** (optimize to ~$200 with caching)

## Per-Use-Case Profiles

| Profile | Thresholds | Blocklists | Latency Target |
|---------|-----------|-----------|---------------|
| Consumer chatbot | Strict (≥ 2) | Brand + competitor | < 100ms |
| Enterprise copilot | Moderate (≥ 4) | Company terms | < 200ms |
| Content generation | Strict (≥ 2) | All active | < 150ms |
| Code assistant | Relaxed (≥ 6) | None | < 50ms |

## Production Readiness Checklist
- [ ] True positive rate ≥ 95% per category
- [ ] False positive rate < 5%
- [ ] Custom blocklists loaded and verified
- [ ] Dual moderation (input + output) active
- [ ] Moderation latency p95 < 200ms
- [ ] Monitoring alerts for spike detection
- [ ] Human review queue for borderline content
- [ ] Per-use-case profiles configured
- [ ] Image moderation enabled (if applicable)
- [ ] Compliance documentation updated

## Output: Tuning Report
After tuning, compare before/after:
- False positive rate delta per category
- True positive rate change
- Latency improvement
- Cost per moderation change
- Threshold recommendations per use case
