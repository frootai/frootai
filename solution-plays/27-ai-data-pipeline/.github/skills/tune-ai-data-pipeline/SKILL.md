---
name: tune-ai-data-pipeline
description: "Tune AI Data Pipeline — optimize batch sizes, LLM enrichment cost, parallelism, partition strategy, scheduling, data quality thresholds. Use when: tune, optimize pipeline."
---

# Tune AI Data Pipeline

## When to Use
- Optimize batch processing throughput
- Reduce LLM enrichment cost per record
- Configure parallelism and partition strategy
- Tune data quality thresholds (too strict = too many quarantined)
- Optimize pipeline scheduling (frequency vs freshness)

## Tuning Dimensions

### Dimension 1: Batch Size Optimization

| Batch Size | Throughput | LLM Latency | Memory | Cost |
|-----------|-----------|-------------|--------|------|
| 1 (sequential) | Slow (~500/hr) | Low | Low | Baseline |
| 10 | Medium (~3K/hr) | Medium | Medium | -20% overhead |
| 50 | Fast (~10K/hr) | Medium | Higher | -40% overhead |
| 100 | Fastest (~15K/hr) | High | High | -50% overhead |

**Rule**: Start at batch size 20. Increase until LLM rate limiting or memory issues.

### Dimension 2: LLM Enrichment Cost Optimization

| Strategy | Cost Reduction | Trade-off |
|----------|---------------|-----------|
| Use gpt-4o-mini (not gpt-4o) | 90% | Slight accuracy drop (~2%) |
| Batch API (Azure OpenAI) | 50% | Asynchronous (results in 24h) |
| Cache repeated enrichments | 30-60% | Only for duplicate/similar records |
| Skip enrichment on simple records | 20-40% | Need classification first |
| Compress input before LLM | 10-20% | May lose some context |

**Monthly estimate** (1M records/day):
- Without optimization: ~$9,000/mo (gpt-4o, all records)
- With gpt-4o-mini: ~$900/mo (10x savings)
- With batch API: ~$450/mo (another 50%)
- With caching (30% dupes): ~$315/mo (total 96% reduction)

### Dimension 3: Parallelism Configuration

| Component | Default | Range | Impact |
|-----------|---------|-------|--------|
| Data Factory parallel copies | 4 | 1-32 | Higher = faster ingest |
| Enrichment parallel workers | 5 | 1-20 | Higher = faster, more LLM calls |
| Data Flow partitions | 4 | 1-16 | Match source partition count |
| Database write parallelism | 4 | 1-8 | Match DB DTU capacity |

### Dimension 4: Partition Strategy

| Strategy | Implementation | Best For |
|----------|---------------|---------|
| Date-based | Partition by ingestion date | Time-series data |
| Source-based | Partition by data source | Multi-source pipelines |
| Category-based | Partition by record type | Different enrichment per type |
| Hash-based | Hash of primary key | Even distribution |

### Dimension 5: Scheduling Optimization

| Frequency | Freshness | Cost | Compute Waste |
|-----------|-----------|------|-------------|
| Real-time (Event Hub) | <1 min | Highest | None |
| Every 15 min | <15 min | High | Low |
| Hourly | <1 hour | Medium | Medium |
| Daily (batch) | <24 hours | Lowest | Highest |
| On-demand | User-triggered | Lowest | None |

**Recommendation**: Daily batch for analytics, hourly for operational data, real-time only for time-critical enrichment.

## Production Readiness Checklist
- [ ] Pipeline throughput meets SLA (≥10K records/hour)
- [ ] Enrichment accuracy ≥90% on test dataset
- [ ] LLM cost per record within budget (using gpt-4o-mini)
- [ ] Data quality gates configured and tested
- [ ] PII detected and redacted before serving
- [ ] Pipeline is idempotent (re-run safe)
- [ ] Error recovery tested (LLM timeout, storage failure)
- [ ] Scheduling configured with retry and timeout
- [ ] Monitoring alerts on pipeline failure
- [ ] Lineage tracking enabled for audit

## Output: Tuning Report
After tuning, compare:
- Throughput improvement (records/hour)
- LLM enrichment cost reduction
- Error rate change
- Data quality score improvement
- Pipeline duration reduction

## Tuning Playbook
1. **Baseline**: Run pipeline on 10K records, measure throughput + cost
2. **Model**: Switch gpt-4o → gpt-4o-mini, compare enrichment accuracy
3. **Batch**: Increase batch size from 10 → 50, check for rate limits
4. **Cache**: Identify duplicate records, add hash-based cache
5. **Parallel**: Increase Data Factory parallel copies, measure speedup
6. **Schedule**: Match pipeline frequency to data freshness needs
7. **Quality**: Review quarantined records — too strict? too lenient?
8. **Re-test**: Run same 10K records, compare before/after
9. **Cost**: Project monthly cost at production volume
