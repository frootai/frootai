# Play 66 — AI Infrastructure Optimizer

FinOps for AI workloads — Azure Monitor metrics collection, GPU utilization analysis, SKU right-sizing engine with p95-based recommendations, cost anomaly detection with severity classification, auto-scaling advisor, and FinOps dashboard with monthly savings tracking.

## Architecture

| Component | Azure Service | Purpose |
|-----------|--------------|---------|
| Metrics Collection | Azure Monitor | CPU, GPU, memory, network utilization |
| Cost Analysis | Azure Cost Management | Daily spend, anomaly detection |
| Recommendation Engine | Custom + Azure OpenAI | Right-sizing, GPU optimization, explanations |
| Optimizer API | Azure Container Apps | Analysis endpoint, dashboard API |
| Secrets | Azure Key Vault | Subscription credentials |

## How It Differs from Related Plays

| Aspect | Play 14 (Cost-Optimized Gateway) | **Play 66 (Infrastructure Optimizer)** |
|--------|----------------------------------|---------------------------------------|
| Scope | Single API gateway cost | **All Azure resources in subscription** |
| Focus | Model routing for cost | **Compute + GPU + storage right-sizing** |
| Method | Complexity-based routing | **30-day utilization analysis (p95)** |
| Output | Cheaper model calls | **SKU changes, GPU→CPU migration, auto-scale** |
| Anomaly | N/A | **Daily cost anomaly detection** |
| Savings | Per-query token savings | **20-40% total infrastructure savings** |

## Key Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| Recommendation Accuracy | > 90% | Resized resources perform within SLA |
| Total Savings | > 20% | Monthly cost reduction |
| GPU Optimization | > 30% | Under-utilized GPU savings |
| Anomaly Detection | > 90% | Cost spikes caught |
| No Perf Degradation | 100% | P95 latency unchanged after resize |
| ROI | > 10x | Savings / optimizer cost |

## WAF Alignment

| Pillar | Implementation |
|--------|---------------|
| **Cost Optimization** | Right-sizing, GPU→CPU migration, auto-scale, storage tiering |
| **Performance Efficiency** | P95-based analysis (not peak), auto-scale recommendations |
| **Reliability** | No-downsize-below-minimum safety, gradual rollout |
| **Operational Excellence** | Weekly analysis cadence, FinOps dashboard, trend tracking |
| **Security** | Reader role only, no write access to monitored resources |
| **Responsible AI** | LLM explains recommendations in human-readable format |
