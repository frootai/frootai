---
name: fai-token-budget-enforce
description: "Enforce token budgets per user/team with tracking and alerting"
---

# Token Budget Enforce

Enforce per-request and aggregate token budgets across AI applications. Covers counting, context window reservation, truncation, cost tracking, and alerting.

## Token Counting with tiktoken

Use `tiktoken` to count tokens before sending requests. Never rely on string length or word count.

```python
import tiktoken

def count_tokens(text: str, model: str = "gpt-4o") -> int:
    enc = tiktoken.encoding_for_model(model)
    return len(enc.encode(text))

def count_messages_tokens(messages: list[dict], model: str = "gpt-4o") -> int:
    """Count tokens for a chat completion messages array.
    Each message has overhead: 4 tokens per message + 2 for reply priming."""
    enc = tiktoken.encoding_for_model(model)
    total = 0
    for msg in messages:
        total += 4  # <im_start>{role}\n...content...<im_end>\n
        total += len(enc.encode(msg.get("content", "")))
        if msg.get("name"):
            total += len(enc.encode(msg["name"])) - 1  # name replaces role
    total += 2  # reply priming
    return total
```

## Context Window Management

Every request must reserve space for system prompt and response. Never fill the full context window with user content.

```python
# Model context limits (check Azure OpenAI docs for current values)
MODEL_LIMITS = {
    "gpt-4o":      {"context": 128_000, "max_output": 16_384},
    "gpt-4o-mini": {"context": 128_000, "max_output": 16_384},
    "gpt-4":       {"context":   8_192, "max_output":  8_192},
    "gpt-35-turbo":{"context":  16_385, "max_output":  4_096},
}

def available_user_tokens(model: str, system_tokens: int, response_reserve: int) -> int:
    """Tokens available for user messages + RAG context."""
    limit = MODEL_LIMITS[model]
    max_response = min(response_reserve, limit["max_output"])
    return limit["context"] - system_tokens - max_response

# Example: gpt-4o with 2000-token system prompt, reserving 4096 for response
# available = 128000 - 2000 - 4096 = 121904 tokens for user+RAG content
```

## config/token-budgets.json

```json
{
  "models": {
    "gpt-4o":       {"cost_per_1k_input": 0.0025, "cost_per_1k_output": 0.01},
    "gpt-4o-mini":  {"cost_per_1k_input": 0.00015, "cost_per_1k_output": 0.0006}
  },
  "budgets": {
    "default":    {"daily_tokens": 500000,  "monthly_tokens": 10000000, "max_per_request": 8000},
    "power_user": {"daily_tokens": 2000000, "monthly_tokens": 50000000, "max_per_request": 32000},
    "team_pool":  {"daily_tokens": 5000000, "monthly_tokens": 100000000}
  },
  "alerts": {
    "warn_at_percent": 80,
    "block_at_percent": 100,
    "notify": ["ops-channel-webhook"]
  },
  "response_reserve": 4096,
  "system_prompt_budget": 2000
}
```

## Budget Enforcer Class

```python
import json
import time
import logging
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

@dataclass
class UsageRecord:
    input_tokens: int
    output_tokens: int
    model: str
    timestamp: float = field(default_factory=time.time)
    user_id: str = ""

class TokenBudgetEnforcer:
    def __init__(self, config_path: str = "config/token-budgets.json"):
        with open(config_path) as f:
            self.config = json.load(f)
        self._usage: list[UsageRecord] = []

    def check_request_budget(self, input_tokens: int, user_id: str, tier: str = "default") -> dict:
        """Pre-flight check before sending a request. Returns allow/deny + reason."""
        budget = self.config["budgets"][tier]
        max_req = budget.get("max_per_request", float("inf"))
        if input_tokens > max_req:
            return {"allowed": False, "reason": f"Request {input_tokens} exceeds per-request limit {max_req}"}

        daily = self._usage_since(86400, user_id)
        daily_limit = budget.get("daily_tokens", float("inf"))
        if daily + input_tokens > daily_limit:
            return {"allowed": False, "reason": f"Daily budget exhausted ({daily}/{daily_limit})"}

        monthly = self._usage_since(2_592_000, user_id)
        monthly_limit = budget.get("monthly_tokens", float("inf"))
        if monthly + input_tokens > monthly_limit:
            return {"allowed": False, "reason": f"Monthly budget exhausted ({monthly}/{monthly_limit})"}

        self._check_alerts(daily, daily_limit, user_id)
        return {"allowed": True, "daily_remaining": daily_limit - daily - input_tokens}

    def record_usage(self, input_tokens: int, output_tokens: int, model: str, user_id: str):
        self._usage.append(UsageRecord(input_tokens, output_tokens, model, user_id=user_id))

    def estimate_cost(self, input_tokens: int, output_tokens: int, model: str) -> float:
        pricing = self.config["models"].get(model, {})
        input_cost = (input_tokens / 1000) * pricing.get("cost_per_1k_input", 0)
        output_cost = (output_tokens / 1000) * pricing.get("cost_per_1k_output", 0)
        return round(input_cost + output_cost, 6)

    def _usage_since(self, seconds: float, user_id: str) -> int:
        cutoff = time.time() - seconds
        return sum(
            r.input_tokens + r.output_tokens
            for r in self._usage
            if r.timestamp >= cutoff and r.user_id == user_id
        )

    def _check_alerts(self, used: int, limit: int, user_id: str):
        pct = (used / limit) * 100 if limit else 0
        warn_at = self.config["alerts"]["warn_at_percent"]
        if pct >= warn_at:
            logger.warning(f"Token budget alert: {user_id} at {pct:.0f}% of daily limit")
```

## Truncation Strategies

When conversation history exceeds available tokens, truncate before sending.

```python
def truncate_oldest_first(messages: list[dict], max_tokens: int, model: str) -> list[dict]:
    """Keep system message + most recent messages that fit within budget."""
    system = [m for m in messages if m["role"] == "system"]
    non_system = [m for m in messages if m["role"] != "system"]
    system_tokens = count_messages_tokens(system, model) if system else 0
    budget = max_tokens - system_tokens

    # Add messages from newest to oldest until budget exhausted
    kept = []
    running = 0
    for msg in reversed(non_system):
        msg_tokens = count_messages_tokens([msg], model)
        if running + msg_tokens > budget:
            break
        kept.insert(0, msg)
        running += msg_tokens
    return system + kept

def truncate_with_summary(messages: list[dict], max_tokens: int, model: str,
                          summarizer_fn) -> list[dict]:
    """Summarize older messages, keep recent ones verbatim."""
    system = [m for m in messages if m["role"] == "system"]
    non_system = [m for m in messages if m["role"] != "system"]
    if count_messages_tokens(messages, model) <= max_tokens:
        return messages

    # Split: older half gets summarized, recent half kept verbatim
    split = len(non_system) // 2
    older = non_system[:split]
    recent = non_system[split:]

    summary_text = summarizer_fn(older)  # your summarization call
    summary_msg = {"role": "assistant", "content": f"[Summary of earlier conversation]: {summary_text}"}
    return system + [summary_msg] + recent
```

## Integration Pattern

Wire the enforcer into your request pipeline as middleware:

```python
async def chat_completion_with_budget(
    messages: list[dict], model: str, user_id: str,
    enforcer: TokenBudgetEnforcer, tier: str = "default"
) -> dict:
    config = enforcer.config
    system_budget = config["system_prompt_budget"]
    response_reserve = config["response_reserve"]

    # 1. Count input tokens
    input_tokens = count_messages_tokens(messages, model)

    # 2. Truncate if exceeding context window
    available = available_user_tokens(model, system_budget, response_reserve)
    if input_tokens > available:
        messages = truncate_oldest_first(messages, available, model)
        input_tokens = count_messages_tokens(messages, model)

    # 3. Check budget
    check = enforcer.check_request_budget(input_tokens, user_id, tier)
    if not check["allowed"]:
        raise BudgetExceededError(check["reason"])

    # 4. Call Azure OpenAI
    response = await client.chat.completions.create(
        model=model, messages=messages, max_tokens=response_reserve
    )
    output_tokens = response.usage.completion_tokens

    # 5. Record usage + cost
    enforcer.record_usage(input_tokens, output_tokens, model, user_id)
    cost = enforcer.estimate_cost(input_tokens, output_tokens, model)
    logger.info(f"user={user_id} in={input_tokens} out={output_tokens} cost=${cost:.4f}")

    return response

class BudgetExceededError(Exception):
    pass
```

## Monitoring Usage Patterns

Track token consumption over time to right-size budgets and catch anomalies:

```python
def usage_report(enforcer: TokenBudgetEnforcer, user_id: str) -> dict:
    """Generate usage summary for dashboards or alerts."""
    now = time.time()
    day_records = [r for r in enforcer._usage if r.timestamp >= now - 86400 and r.user_id == user_id]
    month_records = [r for r in enforcer._usage if r.timestamp >= now - 2_592_000 and r.user_id == user_id]

    total_cost_day = sum(enforcer.estimate_cost(r.input_tokens, r.output_tokens, r.model) for r in day_records)
    return {
        "daily_requests": len(day_records),
        "daily_tokens": sum(r.input_tokens + r.output_tokens for r in day_records),
        "daily_cost_usd": round(total_cost_day, 4),
        "monthly_requests": len(month_records),
        "monthly_tokens": sum(r.input_tokens + r.output_tokens for r in month_records),
        "avg_tokens_per_request": (
            sum(r.input_tokens + r.output_tokens for r in day_records) // max(len(day_records), 1)
        ),
    }
```

Log to Azure Monitor for KQL dashboards: emit `token_usage` custom events with `user_id`, `model`, `input_tokens`, `output_tokens`, and `cost_usd` fields. Alert when any user crosses 80% of daily budget or when aggregate monthly spend exceeds forecast.
