---
description: "Production deployment standards — blue-green, canary rollout, health probes, rollback criteria."
applyTo: "**/*.yaml, **/*.bicep"
waf:
  - "reliability"
  - "operational-excellence"
---

# Production Deployment — FAI Standards

## Blue-Green Deployment (Azure App Service)

Use deployment slots to eliminate downtime. Staging receives traffic only after health checks pass.

```bicep
resource appService 'Microsoft.Web/sites@2023-12-01' = {
  name: svcName
  properties: {
    siteConfig: {
      healthCheckPath: '/health'
      autoHealEnabled: true
    }
  }
}

resource stagingSlot 'Microsoft.Web/sites/slots@2023-12-01' = {
  parent: appService
  name: 'staging'
  properties: {
    siteConfig: {
      healthCheckPath: '/health'
      appSettings: [
        { name: 'DEPLOYMENT_SLOT', value: 'staging' }
        { name: 'MODEL_VERSION', value: modelVersion }
      ]
    }
  }
}
```

Swap only after smoke tests pass on the staging slot:

```bash
az webapp deployment slot swap \
  --resource-group $RG --name $APP --slot staging \
  --target-slot production --action preview
curl -sf "https://${APP}-staging.azurewebsites.net/health" || exit 1
curl -sf "https://${APP}-staging.azurewebsites.net/ready" || exit 1
az webapp deployment slot swap \
  --resource-group $RG --name $APP --slot staging \
  --target-slot production --action swap
```

## Canary Releases with Traffic Splitting

Route a percentage to the new version. Increase only when error rate and latency hold steady.

```bicep
resource trafficRouting 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: appService
  name: 'web'
  properties: {
    experiments: {
      rampUpRules: [
        {
          actionHostName: '${svcName}-staging.azurewebsites.net'
          reroutePercentage: 10   // Start 10%, ramp to 50%, then 100%
          name: 'canary'
          changeIntervalInMinutes: 15
          changeStep: 10
          maxReroutePercentage: 50
          minReroutePercentage: 10
        }
      ]
    }
  }
}
```

## Health Check Endpoints

Every AI service MUST expose three endpoints:

| Endpoint | Purpose | Failure Action |
| --- | --- | --- |
| `/health` | Load balancer liveness — 200 if process alive | Remove from rotation |
| `/ready` | Readiness — model loaded, DB connected, caches warm | Stop sending traffic |
| `/live` | Deep liveness — GPU available, inference < threshold | Alert + investigate |

```python
@app.get("/ready")
async def readiness():
    model_ok = model_registry.is_loaded()
    db_ok = await db.ping()
    if not (model_ok and db_ok):
        raise HTTPException(503, detail="not ready")
    return {"status": "ready", "model": model_registry.version()}
```

## Graceful Shutdown (SIGTERM Handling)

AI workloads must drain in-flight inference requests before exiting. Never kill mid-generation.

```python
import signal, asyncio
shutdown_event = asyncio.Event()

def handle_sigterm(sig, frame):
    logger.info("SIGTERM received — draining connections")
    shutdown_event.set()

signal.signal(signal.SIGTERM, handle_sigterm)

async def shutdown():
    shutdown_event.set()
    await asyncio.sleep(0.5)          # Let in-flight requests finish
    await inference_engine.flush()     # Flush GPU batch queue
    await telemetry.flush()            # Flush App Insights buffer
    await db_pool.close()
```

Set `terminationGracePeriodSeconds: 60` in Kubernetes — GPU inference can take 30s+ per request.

## AKS Deployment Strategies for GPU Workloads

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-inference
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # 1 extra GPU pod during rollout
      maxUnavailable: 0    # Zero downtime
  template:
    spec:
      terminationGracePeriodSeconds: 60
      tolerations:
        - key: "sku"
          operator: "Equal"
          value: "gpu"
          effect: "NoSchedule"
      containers:
        - name: inference
          resources:
            limits:
              nvidia.com/gpu: 1
          readinessProbe:
            httpGet: { path: /ready, port: 8080 }
            initialDelaySeconds: 30  # Model loading time
            periodSeconds: 10
          livenessProbe:
            httpGet: { path: /live, port: 8080 }
            initialDelaySeconds: 45
            failureThreshold: 3
```

## Feature Flags for AI Model Rollout

Route traffic between model versions without redeploying:

```json
{
  "model_routing": {
    "default": "gpt-4o-2024-08-06",
    "canary": { "model": "gpt-4o-2024-11-20", "percentage": 15 },
    "rollback_model": "gpt-4o-2024-05-13"
  },
  "rollback_triggers": {
    "error_rate_threshold": 0.05,
    "latency_p99_ms": 8000,
    "groundedness_score_min": 0.85
  }
}
```

## Rollback Procedures

Automated rollback triggers — codify in CI/CD, never rely on manual judgment:

```bash
ERROR_RATE=$(az monitor metrics list --resource $RESOURCE_ID \
  --metric "Http5xx" --interval PT10M \
  --query "value[0].timeseries[0].data[-1].total" -o tsv)
TOTAL=$(az monitor metrics list --resource $RESOURCE_ID \
  --metric "Requests" --interval PT10M \
  --query "value[0].timeseries[0].data[-1].total" -o tsv)
RATE=$(echo "scale=4; $ERROR_RATE / $TOTAL" | bc)
if (( $(echo "$RATE > 0.05" | bc -l) )); then
  echo "Error rate ${RATE} > 5% — rolling back"
  az webapp deployment slot swap --resource-group $RG --name $APP \
    --slot staging --target-slot production --action swap
fi
```

## Environment Promotion Pipeline

```yaml
# .github/workflows/deploy.yml
jobs:
  deploy-staging:
    environment: staging
    steps:
      - run: az deployment group create -g $RG_STAGING -f infra/main.bicep -p env=staging
      - run: ./scripts/smoke-test.sh https://$APP-staging.azurewebsites.net
      - run: ./scripts/eval-pipeline.sh --env staging --threshold 0.85
  deploy-prod:
    needs: deploy-staging
    environment: production
    steps:
      - run: az deployment group create -g $RG_PROD -f infra/main.bicep -p env=prod
      - run: ./scripts/smoke-test.sh https://$APP.azurewebsites.net
      - run: |
          python evaluation/post_deploy_check.py \
            --latency-p99 8000 --error-rate 0.02 --token-budget-daily 5000000
```

## Post-Deploy Smoke Tests

Smoke tests MUST validate AI-specific behavior, not just HTTP 200:

```bash
curl -sf "$ENDPOINT/health" | jq -e '.status == "healthy"'
curl -sf "$ENDPOINT/ready" | jq -e '.status == "ready"'
RESPONSE=$(curl -s -X POST "$ENDPOINT/chat" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What is 2+2?"}]}')
echo "$RESPONSE" | jq -e '.choices[0].message.content' || exit 1
LATENCY=$(echo "$RESPONSE" | jq '.usage.latency_ms')
[ "$LATENCY" -lt 8000 ] || { echo "Latency ${LATENCY}ms > 8s"; exit 1; }
```

## Monitoring & Alerting Thresholds

| Metric | Warning | Critical | Action |
| --- | --- | --- | --- |
| Latency p99 | > 5s | > 10s | Scale out / check GPU saturation |
| Error rate (5xx) | > 2% | > 5% | Auto-rollback triggered |
| Token usage / hour | > 80% budget | > 95% budget | Throttle non-critical |
| Groundedness score | < 0.90 | < 0.80 | Block deploy / retrain |
| GPU utilization | > 85% | > 95% | Add node to pool |
| Memory (RSS) | > 80% | > 90% | Restart pod / investigate leak |

## Anti-Patterns

- ❌ Deploying directly to production without staging slot validation
- ❌ `kubectl rollout restart` instead of canary with traffic split
- ❌ Health endpoint returning 200 without checking model readiness or GPU state
- ❌ No `terminationGracePeriodSeconds` — GPU inference killed mid-generation
- ❌ Feature flags in code instead of external config (forces redeploy to toggle)
- ❌ Manual rollback — MUST be automated with metric-based triggers
- ❌ Skipping smoke tests — inference can diverge between slots
- ❌ GPU workloads without node taints — pods land on CPU nodes and OOM
- ❌ No token budget alerts — prompt injection loops can burn $10K in hours

## WAF Alignment

| Pillar | Deployment Practice |
|--------|-------------------|
| **Reliability** | Blue-green slots, zero-downtime rolling updates, auto-rollback at 5% error rate, health probes `/health` `/ready` `/live`, `terminationGracePeriodSeconds: 60` |
| **Operational Excellence** | Bicep IaC with env-specific params, GitHub Actions promotion (dev→staging→prod), post-deploy smoke + eval, structured deployment logs |
| **Security** | Slot-sticky secrets, Managed Identity per slot, private endpoints in prod, no secrets in CI logs |
| **Cost Optimization** | Canary at 10% initial traffic (limits blast radius + cost), GPU auto-scaling with KEDA, daily token budget alerts, model routing via feature flags |
| **Performance Efficiency** | GPU taints prevent CPU scheduling, readiness probes block traffic until model loaded, traffic split validates latency before full rollout |
| **Responsible AI** | Groundedness gate (≥ 0.85) before promotion, Content Safety per slot, evaluation pipeline as deployment gate |
