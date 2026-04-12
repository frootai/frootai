---
name: deploy-anomaly-detection
description: "Deploy Anomaly Detection — configure time-series detection pipeline, Azure Monitor Anomaly Detector, alerting rules, LLM root cause analysis, dashboards. Use when: deploy, provision, configure detection."
---

# Deploy Anomaly Detection

## When to Use
- Deploy time-series anomaly detection for metrics/logs
- Configure Azure Anomaly Detector or custom detection models
- Set up alerting rules with severity-based routing
- Implement LLM-powered root cause analysis
- Build operational dashboards for anomaly visualization

## Prerequisites
1. Azure CLI authenticated: `az account show`
2. Log Analytics Workspace with metric data flowing
3. Azure OpenAI for root cause analysis
4. Application Insights or Prometheus metrics source
5. Azure Monitor action groups configured

## Step 1: Deploy Detection Infrastructure
```bash
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
```
Resources:
- Azure Anomaly Detector (multivariate time-series)
- Azure OpenAI (root cause analysis with gpt-4o)
- Azure Functions (detection pipeline trigger)
- Log Analytics (metric storage + KQL queries)
- Azure Monitor (alert rules + action groups)

## Step 2: Configure Detection Pipeline
```
Metrics Source → Time Window → Anomaly Detection → Classification → Alerting
    │                │              │                    │              │
    ├─ App Insights   ├─ 5-min      ├─ Statistical      ├─ Severity   ├─ PagerDuty
    ├─ Prometheus      ├─ 15-min     ├─ ML-based         ├─ Category   ├─ Teams
    └─ Custom metrics  └─ 1-hour     └─ LLM-augmented    └─ Priority   └─ Email
```

## Step 3: Configure Detection Models
| Method | Best For | Latency | Setup |
|--------|---------|---------|-------|
| Statistical (Z-score) | Simple threshold-based | <1s | Low |
| Azure Anomaly Detector | Multivariate time-series | 2-5s | Medium |
| Isolation Forest | High-dimensional data | 1-3s | Medium |
| LLM pattern recognition | Complex, context-dependent | 5-10s | High |

## Step 4: Configure Alerting Rules
| Severity | Detection | Example | Action |
|----------|----------|---------|--------|
| Sev 0 (Critical) | >5σ deviation, multiple metrics | Service down | PagerDuty immediate |
| Sev 1 (High) | >3σ deviation, sustained 15min | Latency spike | PagerDuty + Teams |
| Sev 2 (Medium) | >2σ deviation, sustained 30min | Error rate increase | Teams notification |
| Sev 3 (Low) | >1.5σ deviation, informational | Minor trend change | Dashboard only |

## Step 5: Implement Root Cause Analysis
```python
# LLM-powered root cause analysis
async def analyze_root_cause(anomaly_context):
    prompt = f"""Analyze this anomaly and suggest root causes:
    Metric: {anomaly_context['metric']}
    Current value: {anomaly_context['value']} (normal: {anomaly_context['baseline']})
    Duration: {anomaly_context['duration']}
    Correlated anomalies: {anomaly_context['correlated']}
    Recent changes: {anomaly_context['recent_deployments']}
    
    Provide: 1) Most likely root cause 2) Recommended actions 3) Blast radius"""
    return await openai_client.chat.completions.create(model="gpt-4o", messages=[...])
```

## Step 6: Build Anomaly Dashboard
```kql
// Anomaly detection KQL
let baseline = toscalar(metrics | where timestamp between(ago(7d)..ago(1d)) | summarize avg(value));
let stddev = toscalar(metrics | where timestamp between(ago(7d)..ago(1d)) | summarize stdev(value));
metrics
| where timestamp > ago(1h)
| extend anomaly_score = abs(value - baseline) / stddev
| where anomaly_score > 3
| project timestamp, metric_name, value, baseline, anomaly_score
```

## Post-Deployment Verification
- [ ] Detection pipeline processing metrics in real-time
- [ ] Anomalies detected within configured time window
- [ ] Alert rules firing and routing to correct channels
- [ ] Root cause analysis generating actionable suggestions
- [ ] Dashboard showing anomaly timeline and severity
- [ ] False positive rate < 10% on initial calibration
- [ ] Historical anomaly backfill working

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| No anomalies detected | Threshold too high | Lower from 3σ to 2σ |
| Too many alerts (alert fatigue) | Threshold too low | Raise threshold, add suppression window |
| Delayed detection | Time window too long | Reduce from 1h to 15min |
| Root cause analysis wrong | Missing context | Add correlated metrics and recent deployments to prompt |
| Missing metrics | Source not connected | Verify diagnostic settings in source resources |
| Dashboard slow | KQL scanning too much data | Add time filters, summarize at higher grain |
