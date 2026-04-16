---
name: canary-deploy-ai
description: "Implement canary deployment, rollout gates, and rollback automation for AI changes — catch latency or quality regressions before full release"
---

# Canary Deployment for AI Workloads

## Traffic Splitting Strategy

Progressive rollout with quality gates at each stage:

| Stage | Traffic | Duration | Gate Criteria |
|-------|---------|----------|---------------|
| Shadow | 0% live (mirror only) | 1 hour | No crashes, latency within 20% of baseline |
| Canary | 5% | 30 min | p95 latency within 15% of baseline, error rate <1% |
| Expand | 25% | 2 hours | Groundedness regression <5%, relevance regression <5% |
| Majority | 50% | 4 hours | Cost, latency, and quality remain within agreed SLOs |
| Full | 100% | — | Promote, drain old revision |

Abort at any stage if quality drops. Never skip shadow validation for LLM model swaps.

## Blue-Green vs Canary Decision Matrix

| Factor | Blue-Green | Canary |
|--------|-----------|--------|
| Model version bump (GPT-4o → 4.1) | ✅ Full cutover after shadow test | — |
| Prompt/config change | — | ✅ Gradual with A/B metrics |
| Infrastructure change (new region) | ✅ Swap slots atomically | — |
| Fine-tuned model rollout | — | ✅ Monitor groundedness drift |
| Latency-sensitive (voice, real-time) | ✅ Instant rollback | — |
| RAG pipeline change | — | ✅ Compare retrieval quality |

## App Service Deployment Slots for AI APIs

```bicep
// infra/modules/ai-api-slots.bicep
param appName string
param location string = resourceGroup().location

resource app 'Microsoft.Web/sites@2023-12-01' existing = {
  name: appName
}

resource canarySlot 'Microsoft.Web/sites/slots@2023-12-01' = {
  parent: app
  name: 'canary'
  location: location
  properties: {
    siteConfig: {
      appSettings: [
        { name: 'MODEL_DEPLOYMENT', value: 'gpt-4o-canary' }
        { name: 'SLOT_ROLE', value: 'canary' }
        { name: 'APPLICATIONINSIGHTS_SLOT', value: 'canary' }
      ]
    }
  }
}

// Traffic routing — start at 5%
resource routingRule 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: app
  name: 'experiments'
  properties: {
    rampUpRules: [
      {
        actionHostName: '${appName}-canary.azurewebsites.net'
        reroutePercentage: 5
        name: 'canary'
        changeIntervalInMinutes: 30
        changeStep: 20
        maxReroutePercentage: 50
        minReroutePercentage: 5
      }
    ]
  }
}
```

Promote after gates pass:
```bash
#!/bin/bash
set -euo pipefail
APP="myai-api"
RG="rg-ai-prod"

# Swap canary → production
az webapp deployment slot swap \
  --name "$APP" --resource-group "$RG" \
  --slot canary --target-slot production

# Verify health post-swap
STATUS=$(curl -sf "https://${APP}.azurewebsites.net/health" | jq -r '.status')
if [ "$STATUS" != "healthy" ]; then
  echo "ROLLBACK: health check failed"
  az webapp deployment slot swap \
    --name "$APP" --resource-group "$RG" \
    --slot production --target-slot canary
  exit 1
fi
```

## AKS Canary with Istio + Flagger

```yaml
# k8s/canary.yaml — Flagger canary resource
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: ai-inference
  namespace: ai-workloads
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ai-inference
  service:
    port: 8080
    trafficPolicy:
      tls:
        mode: ISTIO_MUTUAL
  analysis:
    interval: 2m
    threshold: 3          # max failures before rollback
    maxWeight: 50         # max canary traffic %
    stepWeight: 5         # increment per interval
    metrics:
      - name: request-success-rate
        thresholdRange:
          min: 99.5
        interval: 1m
      - name: request-duration
        thresholdRange:
          max: 500        # p99 ms
        interval: 1m
      # Custom AI quality metric from Prometheus
      - name: ai-groundedness-score
        templateRef:
          name: ai-quality-metrics
          namespace: ai-workloads
        thresholdRange:
          min: 4.0
        interval: 5m
    webhooks:
      - name: ai-quality-gate
        type: rollback
        url: http://ai-quality-checker.ai-workloads:9090/gate
        timeout: 60s
```

Custom Prometheus metric template for AI quality:
```yaml
# k8s/metric-template.yaml
apiVersion: flagger.app/v1beta1
kind: MetricTemplate
metadata:
  name: ai-quality-metrics
  namespace: ai-workloads
spec:
  provider:
    type: prometheus
    address: http://prometheus.monitoring:9090
  query: |
    avg(ai_groundedness_score{
      destination_workload_namespace="{{ namespace }}",
      destination_workload="{{ target }}"
    }[{{ interval }}])
```

## Automated Rollback Triggers

Quality gate checker that Flagger calls via webhook:
```bash
#!/bin/bash
# scripts/ai-quality-gate.sh — called by Flagger webhook
CANARY_TAG="${1:-canary}"
BASELINE_TAG="${2:-production}"

# Pull last 30min of eval scores from App Insights
CANARY_GROUND=$(az monitor app-insights query \
  --app "$AI_APPINSIGHTS" --analytics-query \
  "customMetrics | where name == 'groundedness' and customDimensions.slot == '${CANARY_TAG}' | summarize avg(value) by bin(timestamp, 5m) | summarize avg(avg_value)" \
  --query 'tables[0].rows[0][0]' -o tsv)

BASELINE_GROUND=$(az monitor app-insights query \
  --app "$AI_APPINSIGHTS" --analytics-query \
  "customMetrics | where name == 'groundedness' and customDimensions.slot == '${BASELINE_TAG}' | summarize avg(value) by bin(timestamp, 5m) | summarize avg(avg_value)" \
  --query 'tables[0].rows[0][0]' -o tsv)

LATENCY_P99=$(az monitor app-insights query \
  --app "$AI_APPINSIGHTS" --analytics-query \
  "requests | where customDimensions.slot == '${CANARY_TAG}' | summarize percentile(duration, 99)" \
  --query 'tables[0].rows[0][0]' -o tsv)

ERROR_RATE=$(az monitor app-insights query \
  --app "$AI_APPINSIGHTS" --analytics-query \
  "requests | where customDimensions.slot == '${CANARY_TAG}' | summarize countif(success == false) * 100.0 / count()" \
  --query 'tables[0].rows[0][0]' -o tsv)

# Rollback conditions
FAIL=0
(( $(echo "$CANARY_GROUND < 4.0" | bc -l) )) && echo "FAIL: groundedness ${CANARY_GROUND} < 4.0" && FAIL=1
(( $(echo "$LATENCY_P99 > 8000" | bc -l) )) && echo "FAIL: p99 latency ${LATENCY_P99}ms > 8000ms" && FAIL=1
(( $(echo "$ERROR_RATE > 1.0" | bc -l) )) && echo "FAIL: error rate ${ERROR_RATE}% > 1.0%" && FAIL=1

# Regression check — canary must not be >10% worse than baseline
DRIFT=$(echo "($BASELINE_GROUND - $CANARY_GROUND) / $BASELINE_GROUND * 100" | bc -l)
(( $(echo "$DRIFT > 10" | bc -l) )) && echo "FAIL: groundedness regression ${DRIFT}%" && FAIL=1

exit $FAIL
```

## A/B Testing AI Models with Feature Flags

Route users to different model deployments using feature flags:
```yaml
# config/feature-flags.json — consumed by App Configuration
{
  "model_routing": {
    "enabled": true,
    "variants": {
      "control": { "model": "gpt-4o", "deployment": "gpt4o-prod", "weight": 80 },
      "treatment": { "model": "gpt-4o-2025-04", "deployment": "gpt4o-canary", "weight": 20 }
    },
    "sticky_assignment": true,
    "assignment_key": "user_id",
    "metrics_to_track": ["groundedness", "relevance", "latency_ms", "token_count"]
  }
}
```

Sticky assignment ensures the same user always hits the same model during the experiment, preventing inconsistent experiences mid-conversation.

## Metric Comparison Dashboard (KQL)

```kql
// Compare canary vs production across all AI quality dimensions
let timeRange = ago(4h);
let canaryMetrics = customMetrics
| where timestamp > timeRange and customDimensions.slot == "canary"
| summarize
    canary_groundedness = avgif(value, name == "groundedness"),
    canary_relevance    = avgif(value, name == "relevance"),
    canary_latency_p99  = percentileif(value, 99, name == "latency_ms"),
    canary_error_rate   = countif(name == "error") * 100.0 / countif(name == "request"),
    canary_tokens_avg   = avgif(value, name == "total_tokens");
let prodMetrics = customMetrics
| where timestamp > timeRange and customDimensions.slot == "production"
| summarize
    prod_groundedness = avgif(value, name == "groundedness"),
    prod_relevance    = avgif(value, name == "relevance"),
    prod_latency_p99  = percentileif(value, 99, name == "latency_ms"),
    prod_error_rate   = countif(name == "error") * 100.0 / countif(name == "request"),
    prod_tokens_avg   = avgif(value, name == "total_tokens");
canaryMetrics | join kind=fullouter prodMetrics on $left.$right
| extend
    groundedness_delta = round(canary_groundedness - prod_groundedness, 2),
    latency_delta_pct  = round((canary_latency_p99 - prod_latency_p99) / prod_latency_p99 * 100, 1),
    token_delta_pct    = round((canary_tokens_avg - prod_tokens_avg) / prod_tokens_avg * 100, 1)
```

## Promotion Criteria Checklist

A canary is promoted to production only when ALL pass:

| Metric | Threshold | Measurement Window |
|--------|-----------|-------------------|
| Request success rate | ≥99.5% | 30 min rolling |
| p99 latency | ≤500ms (or ≤110% of baseline) | 30 min rolling |
| Groundedness score | ≥4.0 (absolute) and ≤10% regression | 2 hour rolling |
| Relevance score | ≥4.0 | 2 hour rolling |
| Token consumption | ≤120% of baseline | 1 hour rolling |
| Content safety flags | 0 high-severity | Entire canary window |
| Error rate | <0.5% | 30 min rolling |

If any metric breaches its threshold for 3 consecutive intervals, Flagger triggers automatic rollback. Manual override requires on-call approval via PagerDuty acknowledge.
