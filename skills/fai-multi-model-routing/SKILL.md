---
name: fai-multi-model-routing
description: "Implement model routing logic: cheap model for simple, capable for complex tasks"
---

# Multi-Model Routing

Route each request to the cheapest model that can handle it. A complexity classifier scores inbound prompts, a router selects the deployment, and fallback chains guarantee delivery when a region or SKU is unavailable.

## Routing Strategies

| Strategy | Signal | Trade-off |
|----------|--------|-----------|
| **Complexity-based** | Token count, tool calls, instruction depth | Best quality/cost balance |
| **Cost-based** | Always pick cheapest model that meets quality bar | Lowest spend, may under-serve |
| **Latency-based** | Region RTT, queue depth, TTFT target | Best UX, higher cost |
| **Hybrid** | Weighted score across all three | Production default |

## Complexity Classifier

Score every prompt 1-10, then bucket into a tier:

```python
import tiktoken

def classify_complexity(messages: list[dict], tools: list | None = None) -> str:
    enc = tiktoken.encoding_for_model("gpt-4o")
    prompt_text = " ".join(m["content"] or "" for m in messages)
    token_count = len(enc.encode(prompt_text))
    tool_count = len(tools) if tools else 0
    has_system = any(m["role"] == "system" for m in messages)
    turn_count = sum(1 for m in messages if m["role"] == "user")

    score = 0
    score += min(token_count // 200, 4)       # 0-4 points for length
    score += min(tool_count, 3)               # 0-3 points for tools
    score += 1 if has_system else 0           # 1 point for system prompt
    score += min(turn_count - 1, 2)           # 0-2 points for multi-turn

    if score <= 2:
        return "simple"       # gpt-4o-mini
    elif score <= 6:
        return "complex"      # gpt-4o
    else:
        return "reasoning"    # o1 / o1-mini
```

## Config Structure — `config/model-routing.json`

```json
{
  "tiers": {
    "simple": {
      "primary": "gpt-4o-mini",
      "fallback": ["gpt-4o-mini-swedencentral", "gpt-4o"],
      "max_tokens": 2048,
      "temperature": 0.3,
      "cost_cap_per_1k_tokens": 0.002
    },
    "complex": {
      "primary": "gpt-4o",
      "fallback": ["gpt-4o-swedencentral", "gpt-4o-eastus2"],
      "max_tokens": 4096,
      "temperature": 0.7,
      "cost_cap_per_1k_tokens": 0.01
    },
    "reasoning": {
      "primary": "o1",
      "fallback": ["o1-mini", "gpt-4o"],
      "max_tokens": 8192,
      "reasoning_effort": "medium"
    }
  },
  "deployments": {
    "gpt-4o-mini": {
      "endpoint": "${AOAI_ENDPOINT_EASTUS}",
      "deployment_name": "gpt-4o-mini",
      "sku": "PTU",
      "ptu_capacity": 50,
      "region": "eastus"
    },
    "gpt-4o-mini-swedencentral": {
      "endpoint": "${AOAI_ENDPOINT_SWEDEN}",
      "deployment_name": "gpt-4o-mini",
      "sku": "PAYG",
      "region": "swedencentral"
    },
    "gpt-4o": {
      "endpoint": "${AOAI_ENDPOINT_EASTUS}",
      "deployment_name": "gpt-4o",
      "sku": "PTU",
      "ptu_capacity": 100,
      "region": "eastus"
    },
    "gpt-4o-swedencentral": {
      "endpoint": "${AOAI_ENDPOINT_SWEDEN}",
      "deployment_name": "gpt-4o",
      "sku": "PAYG",
      "region": "swedencentral"
    },
    "gpt-4o-eastus2": {
      "endpoint": "${AOAI_ENDPOINT_EASTUS2}",
      "deployment_name": "gpt-4o",
      "sku": "PAYG",
      "region": "eastus2"
    },
    "o1": {
      "endpoint": "${AOAI_ENDPOINT_EASTUS}",
      "deployment_name": "o1",
      "sku": "PAYG",
      "region": "eastus"
    },
    "o1-mini": {
      "endpoint": "${AOAI_ENDPOINT_EASTUS}",
      "deployment_name": "o1-mini",
      "sku": "PAYG",
      "region": "eastus"
    }
  },
  "ptu_overflow": {
    "enabled": true,
    "threshold_utilization": 0.85,
    "overflow_sku": "PAYG"
  },
  "ab_test": {
    "enabled": false,
    "experiment": "gpt4o-vs-gpt4o-mini-for-medium",
    "split_pct": 10,
    "variant_tier_override": { "complex": "simple" }
  }
}
```

## Router Implementation

```python
import time, random, logging
from openai import AzureOpenAI, RateLimitError, APITimeoutError
from app.classify import classify_complexity
from app.config import load_routing_config

logger = logging.getLogger("model-router")

class ModelRouter:
    def __init__(self, config_path: str = "config/model-routing.json"):
        self.cfg = load_routing_config(config_path)
        self._clients: dict[str, AzureOpenAI] = {}
        self._route_counts: dict[str, int] = {}

    def _get_client(self, deployment_key: str) -> AzureOpenAI:
        if deployment_key not in self._clients:
            dep = self.cfg["deployments"][deployment_key]
            self._clients[deployment_key] = AzureOpenAI(
                azure_endpoint=dep["endpoint"],
                azure_deployment=dep["deployment_name"],
                api_version="2025-04-01-preview",
            )
        return self._clients[deployment_key]

    def route(self, messages: list[dict], tools: list | None = None, **kw):
        tier_name = classify_complexity(messages, tools)
        tier_name = self._apply_ab_test(tier_name)
        tier = self.cfg["tiers"][tier_name]

        chain = [tier["primary"]] + tier.get("fallback", [])
        chain = self._apply_ptu_overflow(chain)

        last_err = None
        for deployment_key in chain:
            try:
                client = self._get_client(deployment_key)
                params = {
                    "model": self.cfg["deployments"][deployment_key]["deployment_name"],
                    "messages": messages,
                    "max_tokens": tier.get("max_tokens", 4096),
                }
                if "temperature" in tier:
                    params["temperature"] = tier["temperature"]
                if "reasoning_effort" in tier:
                    params["reasoning_effort"] = tier["reasoning_effort"]
                if tools:
                    params["tools"] = tools

                start = time.perf_counter()
                resp = client.chat.completions.create(**params)
                latency = time.perf_counter() - start

                self._track(tier_name, deployment_key, resp.usage, latency)
                return resp
            except (RateLimitError, APITimeoutError) as e:
                logger.warning("Fallback from %s: %s", deployment_key, e)
                last_err = e
                continue
        raise last_err  # all deployments exhausted

    def _apply_ptu_overflow(self, chain: list[str]) -> list[str]:
        """Insert PAYG fallback after PTU deployments when overflow is enabled."""
        if not self.cfg.get("ptu_overflow", {}).get("enabled"):
            return chain
        return chain  # overflow handled by Azure-side 429 → next in chain

    def _apply_ab_test(self, tier_name: str) -> str:
        ab = self.cfg.get("ab_test", {})
        if not ab.get("enabled"):
            return tier_name
        if tier_name in ab.get("variant_tier_override", {}):
            if random.randint(1, 100) <= ab["split_pct"]:
                variant = ab["variant_tier_override"][tier_name]
                logger.info("A/B test: %s → %s", tier_name, variant)
                return variant
        return tier_name

    def _track(self, tier: str, deployment: str, usage, latency: float):
        self._route_counts[deployment] = self._route_counts.get(deployment, 0) + 1
        logger.info(
            "route tier=%s deployment=%s prompt_tokens=%d completion_tokens=%d latency=%.3fs",
            tier, deployment, usage.prompt_tokens, usage.completion_tokens, latency,
        )
```

## PTU Overflow to PAYG

PTU deployments return HTTP 429 when capacity is saturated. The router's fallback chain handles this automatically — PTU deployments are listed first, PAYG deployments follow. Azure's throttling triggers `RateLimitError`, the router catches it, and advances to the next deployment in the chain. Set `ptu_overflow.threshold_utilization` to alert before saturation via Azure Monitor.

## Cost Tracking Per Route

Log every completion with tier, deployment, and token counts. Aggregate in Application Insights:

```kusto
customEvents
| where name == "model_route"
| extend tier = tostring(customDimensions.tier),
         deployment = tostring(customDimensions.deployment),
         prompt_tokens = toint(customDimensions.prompt_tokens),
         completion_tokens = toint(customDimensions.completion_tokens)
| summarize total_prompt = sum(prompt_tokens),
            total_completion = sum(completion_tokens),
            calls = count()
  by tier, deployment, bin(timestamp, 1h)
| order by timestamp desc
```

## Monitoring Route Distribution

Alert when distribution drifts — if >40% of traffic hits the `reasoning` tier, prompts may need rewriting or the classifier threshold needs tuning:

```kusto
customEvents
| where name == "model_route" and timestamp > ago(1h)
| summarize calls = count() by tier = tostring(customDimensions.tier)
| extend pct = round(100.0 * calls / todynamic(toscalar(
    customEvents | where name == "model_route" and timestamp > ago(1h) | count
  )), 1)
```

Expected healthy distribution: simple 60-70%, complex 25-35%, reasoning <5%.

## A/B Testing Routes

Enable in `config/model-routing.json` by setting `ab_test.enabled: true`. The `split_pct` controls what percentage of requests in the target tier get rerouted to the variant. Track results by comparing quality metrics (groundedness, relevance) across the control and variant groups using the same KQL queries filtered by a `variant` flag in custom dimensions.

## Checklist

- [ ] `config/model-routing.json` defines all tiers and deployments
- [ ] Classifier thresholds tuned on 100+ sample prompts
- [ ] Fallback chain tested by simulating 429 on primary
- [ ] PTU overflow verified: primary saturated → PAYG picks up
- [ ] Cost tracking emitting to Application Insights
- [ ] Route distribution dashboard in Azure Workbook
- [ ] A/B test disabled in production unless experiment is active
