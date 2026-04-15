---
name: fai-az-cost-optimize
description: |
  Analyze Azure AI workload costs and generate optimization recommendations. Use this skill when:
  - Reviewing Azure resource costs for AI workloads
  - Implementing model routing to reduce token spend
  - Right-sizing compute for GPU/CPU workloads
  - Setting up budget alerts and cost anomaly detection
  - Evaluating PAYG vs PTU for Azure OpenAI
---

# Azure Cost Optimization for AI Workloads

Analyze infrastructure and AI costs, then generate actionable optimization recommendations.

## When to Use

- Monthly cost review for AI workloads
- Before scaling up (PTU purchase, GPU node pools)
- After traffic changes that affect token consumption
- Setting up FinOps practices for a new AI project

---

## Step 1: Discover Current Costs

```bash
# Get cost breakdown by resource group
az consumption usage list \
  --subscription $SUB_ID \
  --start-date 2026-03-01 --end-date 2026-03-31 \
  --query "[].{Resource:instanceName, Cost:pretaxCost, Currency:currency}" \
  --output table

# Get Azure OpenAI token consumption
az monitor metrics list \
  --resource $OPENAI_RESOURCE_ID \
  --metric "TokenTransaction" \
  --interval PT1H \
  --start-time 2026-03-01 \
  --output table
```

## Step 2: Model Routing

Route requests to the cheapest model that meets quality requirements:

```python
from dataclasses import dataclass

@dataclass
class ModelTier:
    name: str
    cost_per_1k_tokens: float
    quality_threshold: float  # min complexity score to use this model

TIERS = [
    ModelTier("gpt-4o-mini", 0.00015, 0.0),   # Default for simple tasks
    ModelTier("gpt-4o", 0.0025, 0.6),           # Complex reasoning
]

def select_model(prompt: str, complexity_score: float) -> str:
    """Route to cheapest model that meets quality requirements."""
    eligible = [t for t in TIERS if complexity_score >= t.quality_threshold]
    return min(eligible, key=lambda t: t.cost_per_1k_tokens).name

def estimate_complexity(prompt: str) -> float:
    """Quick heuristic for prompt complexity (0-1)."""
    signals = [
        len(prompt) > 2000,          # Long context
        "analyze" in prompt.lower(),  # Analytical task
        "compare" in prompt.lower(),  # Comparison task
        prompt.count("\n") > 20,     # Multi-part
    ]
    return sum(signals) / len(signals)
```

## Step 3: Semantic Caching

Cache responses for semantically similar queries:

```python
import hashlib, json

class SemanticCache:
    def __init__(self, similarity_threshold: float = 0.95):
        self.threshold = similarity_threshold
        self.cache = {}

    def get(self, prompt: str) -> str | None:
        key = self._hash(prompt)
        entry = self.cache.get(key)
        if entry and not self._is_expired(entry):
            return entry["response"]
        return None

    def set(self, prompt: str, response: str, ttl_hours: int = 24):
        self.cache[self._hash(prompt)] = {
            "response": response,
            "expires": time.time() + ttl_hours * 3600,
        }

    def _hash(self, text: str) -> str:
        normalized = " ".join(text.lower().split())
        return hashlib.sha256(normalized.encode()).hexdigest()[:16]
```

## Step 4: PTU vs PAYG Decision Matrix

| Utilization | Recommendation | Why |
|-------------|---------------|-----|
| < 30% | PAYG | PTU waste at low utilization |
| 30-60% | Evaluate PTU | Break-even zone — model with actual traffic |
| > 60% sustained | PTU | 40-60% cost savings at high utilization |
| Bursty (low avg, high peak) | PAYG + APIM throttle | PTU under-utilized between bursts |

```bash
# Calculate effective PTU utilization
az monitor metrics list \
  --resource $OPENAI_RESOURCE_ID \
  --metric "ProvisionedManagedUtilizationV2" \
  --interval PT1H \
  --aggregation Average \
  --output table
```

## Step 5: Budget Alerts

```bicep
resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: 'ai-workload-monthly'
  properties: {
    category: 'Cost'
    amount: 10000
    timeGrain: 'Monthly'
    timePeriod: { startDate: '2026-04-01' }
    notifications: {
      alert50: { enabled: true, threshold: 50, operator: 'GreaterThan'
        contactEmails: ['team@org.com'] }
      alert90: { enabled: true, threshold: 90, operator: 'GreaterThan'
        contactEmails: ['team@org.com', 'finance@org.com'] }
    }
  }
}
```

## Optimization Checklist

- [ ] Model routing configured (mini for simple, 4o for complex)
- [ ] Semantic caching reduces duplicate token spend by 20%+
- [ ] PTU vs PAYG evaluated with actual utilization data
- [ ] Budget alerts at 50%, 75%, 90% thresholds
- [ ] Cost-per-request tracked in Application Insights
- [ ] Unused/oversized resources identified and right-sized
