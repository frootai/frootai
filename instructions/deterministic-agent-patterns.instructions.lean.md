---
description: "Play 03 patterns — Deterministic AI patterns — temperature=0, structured output, grounding, citation, evaluation-driven reliability."
applyTo: "**/*.py, **/*.ts"
waf:
  - "reliability"
  - "security"
---

# Play 03 — Deterministic Agent Patterns — FAI Standards

## Temperature Zero + Seed Pinning

```python
CONFIG = json.loads(pathlib.Path("config/openai.json").read_text())
assert CONFIG["temperature"] == 0, "Production MUST use temperature=0"

def deterministic_call(messages: list[dict], **overrides) -> ChatCompletion:
    params = {
        "model": CONFIG["model"], "temperature": 0, "seed": CONFIG["seed"],
        "top_p": 1, "max_tokens": CONFIG["max_tokens"], **overrides,
    }
    resp = client.chat.completions.create(messages=messages, **params)
    logger.info("fingerprint=%s seed=%d", resp.system_fingerprint, params["seed"])
    if resp.system_fingerprint != _last_fingerprint.get(params["model"]):
        logger.warning("Model drift detected — rerun snapshot suite")
    return resp
```

## Structured Output — Pydantic as Contract

```python
class TicketClassification(BaseModel):
    category: Literal["billing", "technical", "account", "other"]
    priority: int = Field(ge=1, le=5)
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str = Field(min_length=10, max_length=500)

    @model_validator(mode="after")
    def high_priority_needs_confidence(self) -> Self:
        if self.priority <= 2 and self.confidence < 0.8:
            raise ValueError("P1/P2 tickets require confidence >= 0.8")
        return self

result = client.beta.chat.completions.parse(
    model=CONFIG["model"], response_format=TicketClassification,
    messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": ticket}],
    temperature=0, seed=CONFIG["seed"],
).choices[0].message.parsed  # type: TicketClassification — fully validated
```

## Function Calling — Strict Schema

```python
tools = [{"type": "function", "function": {
    "name": "lookup_order", "strict": True,
    "parameters": {
        "type": "object",
        "properties": {
            "order_id": {"type": "string", "pattern": "^ORD-[0-9]{6}$"},
            "fields": {"type": "array", "items": {"enum": ["status", "total", "tracking"]}},
        },
        "required": ["order_id", "fields"], "additionalProperties": False,
    },
}}]
# strict=True → server-side grammar constraint, zero hallucinated keys
```

## Validation Retry with Error Feedback

```python
def validated_call(prompt: str, schema: type[BaseModel], max_retries: int = 3) -> BaseModel:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}]
    for attempt in range(max_retries):
        resp = deterministic_call(messages)
        raw = resp.choices[0].message.content
        try:
            return schema.model_validate_json(raw)
        except ValidationError as e:
            logger.warning("attempt=%d errors=%d", attempt + 1, e.error_count())
            messages.append({"role": "assistant", "content": raw})
            messages.append({"role": "user", "content": f"Validation failed:\n{e}\nFix and return valid JSON."})
    raise DeterminismError(f"Schema validation failed after {max_retries} attempts")
```

## Idempotent Tools + Cache-Keyed Execution

```python
def idempotent_tool(name: str, args: dict) -> dict:
    canon = json.dumps(args, sort_keys=True, default=str)
    key = f"tool:{name}:{hashlib.sha256(canon.encode()).hexdigest()}"
    if cached := redis.get(key):
        return json.loads(cached)
    result = TOOL_REGISTRY[name](**args)
    redis.setex(key, CONFIG.get("tool_cache_ttl", 300), json.dumps(result, default=str))
    return result

def execute_plan(steps: list[ToolStep]) -> list[ToolResult]:
    steps.sort(key=lambda s: s.priority)  # config-driven order, never LLM-decided
    return [ToolResult(tool=s.tool, output=idempotent_tool(s.tool, s.args)) for s in steps]
```

## State Machine — Zero LLM Routing

```python
class Phase(str, Enum):
    CLASSIFY = "classify"; RETRIEVE = "retrieve"
    GENERATE = "generate"; VALIDATE = "validate"; DONE = "done"

TRANSITIONS: dict[Phase, dict[bool, Phase]] = {
    Phase.CLASSIFY: {True: Phase.RETRIEVE, False: Phase.DONE},
    Phase.RETRIEVE: {True: Phase.GENERATE, False: Phase.CLASSIFY},
    Phase.GENERATE: {True: Phase.VALIDATE, False: Phase.RETRIEVE},
    Phase.VALIDATE: {True: Phase.DONE, False: Phase.GENERATE},
}

def run_agent(input_data: dict) -> dict:
    state, ctx = Phase.CLASSIFY, {"input": input_data}
    while state != Phase.DONE:
        ok, ctx = PHASE_HANDLERS[state](ctx)  # each handler is a pure function
        state = TRANSITIONS[state][ok]
        logger.info("transition → %s (success=%s)", state.value, ok)
    return ctx
```

## Guardrails — Dual-Boundary Content Safety

```python
safety = ContentSafetyClient(endpoint, DefaultAzureCredential())

def enforce_safety(text: str, direction: Literal["input", "output"]) -> str:
    threshold = CONFIG["guardrails"][f"max_{direction}_severity"]
    result = safety.analyze_text(AnalyzeTextOptions(text=text))
    violations = [c for c in result.categories_analysis if c.severity > threshold]
    if violations:
        cats = ", ".join(f"{v.category}={v.severity}" for v in violations)
        raise GuardrailViolation(f"{direction} blocked: {cats}")
    return text
# Call enforce_safety(prompt, "input") before LLM, enforce_safety(output, "output") after
```

## Snapshot Testing for Prompt Regression

```python
SNAP_DIR = pathlib.Path("tests/snapshots")

def assert_deterministic(test_id: str, prompt: str, schema: type[BaseModel]):
    result = validated_call(prompt, schema)
    snap_file = SNAP_DIR / f"{test_id}.json"
    actual = result.model_dump_json(indent=2)
    if snap_file.exists():
        expected = snap_file.read_text()
        assert actual == expected, f"Regression in {test_id}: diff snapshot vs actual"
    else:
        snap_file.write_text(actual)  # first run creates baseline
# Run in CI: pytest tests/test_determinism.py --snapshot-update to refresh after intentional changes
```

## Evaluation Pipeline — Consistency + Quality

```python
def eval_consistency(prompt: str, schema: type[BaseModel], n: int = 10) -> float:
    results = [validated_call(prompt, schema).model_dump_json() for _ in range(n)]
    unique = len(set(results))
    score = 1.0 - (unique - 1) / n
    assert score >= CONFIG["consistency_threshold"], f"Consistency {score:.2f} < {CONFIG['consistency_threshold']}"
    return score

def eval_pipeline(test_suite: list[EvalCase]) -> EvalReport:
    metrics = {"consistency": [], "latency_ms": [], "validation_pass": []}
    for case in test_suite:
        t0 = time.perf_counter()
        try:
            validated_call(case.prompt, case.schema)
            metrics["validation_pass"].append(1.0)
        except DeterminismError:
            metrics["validation_pass"].append(0.0)
        metrics["latency_ms"].append((time.perf_counter() - t0) * 1000)
        metrics["consistency"].append(eval_consistency(case.prompt, case.schema, n=5))
    return EvalReport(means={k: statistics.mean(v) for k, v in metrics.items()})
```

## Anti-Patterns

- ❌ `temperature > 0` in production without eval proof justifying the variance
- ❌ Omitting `seed` — makes regression detection and fingerprint tracking impossible
- ❌ Free-form string output instead of Pydantic with `Literal`/`Field` constraints
- ❌ LLM-decided routing between steps — use explicit state machine transitions
- ❌ Mutable shared state between phases — each handler receives and returns context
- ❌ Single-boundary guardrails — must check both input and output
- ❌ No snapshot tests — prompt edits silently alter classification behavior
- ❌ Hardcoded thresholds — read from `config/openai.json` so TuneKit can adjust

## WAF Alignment

| Pillar | Deterministic Pattern |
|---|---|
| **Reliability** | Validation retry with error feedback, state machine with fallback transitions, snapshot regression in CI |
| **Security** | Dual-boundary Content Safety, `strict: true` function schemas, `additionalProperties: false` everywhere |
| **Cost Optimization** | SHA-keyed tool cache prevents duplicate calls, `max_tokens` from config, early guardrail rejection |
| **Operational Excellence** | System fingerprint drift detection, consistency eval in CI gate, config-driven params via TuneKit |
| **Performance** | Redis idempotent cache, deterministic step ordering avoids retry storms, batched eval runs |
| **Responsible AI** | Input+output guardrails, bias-stable via `temperature=0`, auditable snapshots, eval pipeline in CI |
