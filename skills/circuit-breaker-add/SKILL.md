---
name: circuit-breaker-add
description: "Add a circuit breaker, fallback routing, and health checks for Azure OpenAI calls — contain 429 and 503 cascades and preserve service"
---

# Circuit Breaker Add

Protect Azure OpenAI calls with a circuit breaker that prevents cascading failures during rate limiting (429) or service overload (503). The breaker transitions through three states — **Closed** (requests flow normally, failures counted), **Open** (requests blocked, fallback returned immediately), and **Half-Open** (limited probe requests test recovery). This avoids hammering a degraded endpoint and burning tokens on doomed requests.

## Circuit Breaker States

```
┌────────┐  failure_count >= threshold  ┌────────┐
│ CLOSED │ ──────────────────────────► │  OPEN  │
│        │                              │        │
│ Normal │  ◄────────────────────────── │ Block  │
│  flow  │   success in half-open       │  all   │
└────────┘                              └────┬───┘
     ▲                                       │ recovery_timeout expires
     │          ┌───────────┐                │
     └───────── │ HALF-OPEN │ ◄──────────────┘
   success_count │  Probe    │
   >= threshold  └───────────┘
```

## Configuration Parameters

```python
CIRCUIT_CONFIG = {
    "failure_threshold": 5,       # consecutive failures before opening
    "recovery_timeout": 30,       # seconds to wait before half-open probe
    "success_threshold": 3,       # consecutive successes in half-open to close
    "monitored_exceptions": [     # only these trip the breaker
        "openai.RateLimitError",  # HTTP 429
        "openai.APIStatusError",  # HTTP 503
        "httpx.ConnectTimeout",
    ],
    "excluded_exceptions": [      # these pass through without tripping
        "openai.BadRequestError", # HTTP 400 — caller error, not service fault
    ],
}
```

## Python Implementation with pybreaker

```python
import time, logging, pybreaker
from openai import AzureOpenAI, RateLimitError, APIStatusError

logger = logging.getLogger("circuit_breaker")

class AzureOpenAIListener(pybreaker.CircuitBreakerListener):
    def state_change(self, cb, old_state, new_state):
        logger.warning("Circuit %s: %s → %s", cb.name, old_state.name, new_state.name)

    def failure(self, cb, exc):
        logger.error("Circuit %s failure #%d: %s", cb.name, cb.fail_counter, exc)

breaker = pybreaker.CircuitBreaker(
    fail_max=5,
    reset_timeout=30,
    listeners=[AzureOpenAIListener()],
    exclude=[lambda e: isinstance(e, (KeyError, ValueError))],
)

client = AzureOpenAI(
    azure_endpoint="https://my-oai.openai.azure.com/",
    api_version="2024-12-01-preview",
)

@breaker
def call_openai(messages: list[dict], model: str = "gpt-4o") -> str:
    response = client.chat.completions.create(
        model=model, messages=messages, temperature=0.7, max_tokens=1024,
    )
    return response.choices[0].message.content
```

## Fallback Strategy Layer

```python
import hashlib, json

_response_cache: dict[str, str] = {}

def call_with_fallback(messages: list[dict]) -> dict:
    cache_key = hashlib.sha256(json.dumps(messages, sort_keys=True).encode()).hexdigest()

    try:
        result = call_openai(messages, model="gpt-4o")
        _response_cache[cache_key] = result  # warm cache on success
        return {"content": result, "source": "primary", "degraded": False}
    except pybreaker.CircuitBreakerError:
        logger.warning("Circuit open — executing fallback chain")
    except RateLimitError as e:
        retry_after = int(e.response.headers.get("retry-after", 10))
        logger.warning("429 rate limited, retry-after=%ds", retry_after)
    except APIStatusError as e:
        if e.status_code != 503:
            raise  # non-transient errors should propagate

    # Fallback 1: cached response for identical prompt
    if cache_key in _response_cache:
        return {"content": _response_cache[cache_key], "source": "cache", "degraded": True}

    # Fallback 2: cheaper/different model deployment
    try:
        result = call_openai(messages, model="gpt-4o-mini")
        return {"content": result, "source": "fallback_model", "degraded": True}
    except (pybreaker.CircuitBreakerError, RateLimitError, APIStatusError):
        pass

    # Fallback 3: graceful degradation message
    return {
        "content": "Service is temporarily unavailable. Your request has been queued.",
        "source": "degradation",
        "degraded": True,
    }
```

## Azure OpenAI 429/503 Patterns

Azure OpenAI returns specific headers on rate limits. Parse them to inform breaker timing:

```python
from openai import RateLimitError

def adaptive_recovery_timeout(exc: RateLimitError) -> int:
    """Extract retry-after from Azure OpenAI 429 response to tune breaker timing."""
    headers = getattr(exc, "response", None) and exc.response.headers or {}
    retry_after = int(headers.get("retry-after", 30))
    remaining = int(headers.get("x-ratelimit-remaining-tokens", 0))
    # If tokens are exhausted, extend recovery window
    if remaining == 0:
        return max(retry_after, 60)
    return retry_after
```

For PTU (Provisioned Throughput) deployments, 429 means you hit your reserved capacity — the breaker should open longer since provisioned capacity doesn't refill like PAYG.

## Health Check Integration

```python
from fastapi import FastAPI, Response

app = FastAPI()

@app.get("/health")
def health():
    status = {
        "circuit_state": breaker.current_state,
        "fail_count": breaker.fail_counter,
        "last_failure": str(getattr(breaker, "_last_failure", None)),
    }
    if breaker.current_state == "open":
        return Response(
            content=json.dumps({**status, "healthy": False}),
            status_code=503, media_type="application/json",
        )
    return {**status, "healthy": True}
```

## Distributed Circuit Breaker with Redis

For multi-instance deployments, share circuit state across replicas via Redis:

```python
import redis, pybreaker

r = redis.Redis(host="redis-host", port=6380, ssl=True, decode_responses=True)

class RedisCircuitBreakerStorage(pybreaker.CircuitBreakerStorage):
    BASE_KEY = "cb:{name}"

    def __init__(self, name: str):
        self._name = name
        self._base = self.BASE_KEY.format(name=name)

    @property
    def state(self):
        raw = r.get(f"{self._base}:state")
        return pybreaker.STATE_CLOSED if raw is None else int(raw)

    @state.setter
    def state(self, value):
        r.set(f"{self._base}:state", value, ex=300)

    @property
    def counter(self):
        return int(r.get(f"{self._base}:counter") or 0)

    @counter.setter
    def counter(self, value):
        r.set(f"{self._base}:counter", value, ex=300)

    @property
    def opened_at(self):
        raw = r.get(f"{self._base}:opened_at")
        return float(raw) if raw else 0.0

    @opened_at.setter
    def opened_at(self, value):
        r.set(f"{self._base}:opened_at", value, ex=300)

distributed_breaker = pybreaker.CircuitBreaker(
    fail_max=5, reset_timeout=30,
    state_storage=RedisCircuitBreakerStorage("azure-openai"),
    listeners=[AzureOpenAIListener()],
)
```

## Monitoring Circuit State Changes

Emit structured logs and metrics on every state transition for Azure Monitor / Application Insights:

```python
from opencensus.ext.azure import metrics_exporter

exporter = metrics_exporter.new_metrics_exporter(
    connection_string="InstrumentationKey=<key>"
)

class ObservableListener(pybreaker.CircuitBreakerListener):
    def state_change(self, cb, old_state, new_state):
        logger.info(json.dumps({
            "event": "circuit_state_change", "circuit": cb.name,
            "from": old_state.name, "to": new_state.name,
            "fail_count": cb.fail_counter,
        }))
        # Custom metric for dashboards
        exporter.export_metrics([{
            "name": "circuit_breaker_state",
            "value": {"open": 1, "half-open": 0.5, "closed": 0}.get(new_state.name, 0),
            "tags": {"circuit": cb.name},
        }])
```

## Testing Circuit Breaker Behavior

```python
import pytest, pybreaker
from unittest.mock import patch, MagicMock
from openai import RateLimitError

def test_breaker_opens_after_threshold(monkeypatch):
    breaker.close()  # reset state
    fake_resp = MagicMock(status_code=429, headers={"retry-after": "10"})
    with pytest.raises(pybreaker.CircuitBreakerError):
        for _ in range(6):  # fail_max=5, 6th call should raise CircuitBreakerError
            try:
                with patch.object(client.chat.completions, "create",
                                  side_effect=RateLimitError("rate limited", response=fake_resp, body=None)):
                    call_openai([{"role": "user", "content": "test"}])
            except RateLimitError:
                pass
    assert breaker.current_state == "open"

def test_fallback_returns_cached():
    _response_cache.clear()
    msgs = [{"role": "user", "content": "cached prompt"}]
    key = hashlib.sha256(json.dumps(msgs, sort_keys=True).encode()).hexdigest()
    _response_cache[key] = "cached answer"
    breaker.open()  # force open
    result = call_with_fallback(msgs)
    assert result["source"] == "cache"
    assert result["degraded"] is True

def test_half_open_recovery(monkeypatch):
    breaker.open()
    breaker._state_storage.opened_at = time.time() - 31  # past recovery_timeout
    with patch.object(client.chat.completions, "create") as mock_create:
        mock_create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="ok"))]
        )
        for _ in range(3):  # success_threshold probes
            call_openai([{"role": "user", "content": "probe"}])
    assert breaker.current_state == "closed"
```
