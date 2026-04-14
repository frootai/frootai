---
description: "Polyglot testing standards — unit, integration, and E2E testing patterns for AI applications. Covers pytest, Vitest, xUnit, Playwright, mock strategies for LLM APIs, evaluation pipelines, and CI/CD test gates."
applyTo: "**/*.test.*, **/*.spec.*, **/test_*, **/tests/**, **/__tests__/**"
waf:
  - "reliability"
  - "operational-excellence"
---

# Testing Best Practices — FAI Standards

## Test Pyramid

Target ratio: **70% unit · 20% integration · 10% E2E**. Unit tests run in <1s each, catch logic bugs fast. Integration tests verify service boundaries (database, LLM API, message bus). E2E tests cover critical user journeys only — they are slow, brittle, and expensive.

## AAA Pattern (Arrange-Act-Assert)

Every test body follows three clearly separated phases. No logic between Act and Assert.

```typescript
// TypeScript — Vitest
it("should_return_top_3_chunks_when_query_has_matches", () => {
  // Arrange
  const index = buildSearchIndex(fakeDocuments(50));
  const query = "deployment architecture";

  // Act
  const results = index.search(query, { topK: 3 });

  // Assert
  expect(results).toHaveLength(3);
  expect(results[0].score).toBeGreaterThan(0.7);
});
```

```python
# Python — pytest
def test_should_redact_pii_when_text_contains_email():
    # Arrange
    text = "Contact alice@example.com for details"

    # Act
    result = redact_pii(text)

    # Assert
    assert "alice@example.com" not in result
    assert "[EMAIL]" in result
```

## Test Naming

Use `should_X_when_Y` — describes expected behavior and trigger condition. Never name tests `test1`, `testFunction`, or `it works`.

## One Assertion per Concept

Multiple `expect` calls are fine if they verify **one logical outcome** (e.g., checking both status code and body of a response). Split into separate tests when verifying unrelated behaviors.

## Test Independence

- No shared mutable state between tests — each test creates its own fixtures
- Never depend on execution order — tests must pass when run individually or shuffled
- Reset databases, clear caches, restore mocks in `afterEach` / `teardown`

## Test Data Builders

Use builder/factory patterns instead of raw object literals scattered across tests:

```typescript
// Factory with sensible defaults + overrides
function buildChatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    role: "user",
    content: "What is RAG?",
    timestamp: new Date("2026-01-15"),
    ...overrides,
  };
}
```

```python
# Python dataclass factory
def make_document(*, title="Test Doc", chunks=5, language="en") -> Document:
    return Document(
        id=str(uuid4()),
        title=title,
        chunks=[make_chunk() for _ in range(chunks)],
        language=language,
    )
```

## Mocking Strategy

Mock at **system boundaries** (HTTP clients, databases, LLM APIs, file I/O) — never mock internal functions. If you need to mock internals, your design needs refactoring.

```typescript
// ✅ Mock the HTTP boundary, not internal parsers
vi.spyOn(httpClient, "post").mockResolvedValue({ choices: [{ message: { content: "answer" } }] });

// ❌ Don't mock your own utility functions
vi.spyOn(utils, "formatPrompt"); // Couples test to implementation
```

```python
# ✅ Mock at boundary with responses or respx
@responses.activate
def test_should_return_completion_when_api_succeeds():
    responses.post("https://api.openai.com/v1/chat/completions", json=fake_completion)
    result = service.get_answer("What is RAG?")
    assert result.text == "answer"
```

## Snapshot Testing

Use for **stable, complex outputs** only — serialized API responses, generated configs, rendered templates. Never snapshot volatile data (timestamps, IDs). Review snapshot diffs in PRs; auto-updating without review defeats the purpose.

## Mutation Testing

Run mutation testing on critical paths to validate test suite effectiveness. A passing test suite with low mutation score means tests aren't catching real bugs.

- **TypeScript**: Stryker (`npx stryker run`) — target >80% mutation score on business logic
- **Python**: mutmut (`mutmut run --paths-to-mutate=src/`) — review surviving mutants

## Flaky Test Management

- Flaky test detected → immediately **quarantine** (move to `describe.skip` / `@pytest.mark.skip`) with a tracking issue
- Fix root cause within one sprint — common causes: timing, shared state, external dependencies, non-deterministic AI output
- CI pipeline must never have tests that "sometimes pass" — 100% deterministic or quarantined

## Coverage Targets

- **80%+ line coverage** measured in CI (Vitest `--coverage`, `pytest-cov`) — block merge if below threshold
- Coverage is a **floor not a goal** — don't write tests that assert nothing just to hit the number
- Exclude generated code, type definitions, and config files from coverage calculations

## AI-Specific Testing

### Prompt Regression Tests
Pin known prompt→response pairs. When modifying prompts, verify outputs still meet quality thresholds:

```python
@pytest.mark.parametrize("prompt,expected_topic", GOLDEN_PROMPT_TEST_CASES)
def test_should_produce_on_topic_response_when_given_known_prompt(prompt, expected_topic):
    result = llm.complete(prompt, temperature=0, seed=42)
    assert expected_topic.lower() in result.text.lower()
```

### Evaluation Pipeline
Run `evaluation/eval.py` as a CI gate. Thresholds from `config/guardrails.json`:
- Groundedness ≥ 4.0, Relevance ≥ 4.0, Coherence ≥ 4.0, Fluency ≥ 4.0
- Block deployment if any metric drops below threshold

## Contract Testing

Use Pact for consumer-driven contract tests between services. Contracts live in a broker — provider CI verifies against all consumer contracts before deploying.

```typescript
// Consumer test generates a pact contract
const interaction = {
  uponReceiving: "a request for document chunks",
  withRequest: { method: "GET", path: "/api/chunks", query: { docId: "abc-123" } },
  willRespondWith: { status: 200, body: like({ chunks: eachLike({ text: "...", score: 0.95 }) }) },
};
```

## CI Test Parallelization

- Split test suites across CI workers by file or module (`--shard=1/4` in Vitest, `pytest-xdist -n auto`)
- Run unit tests first (fast feedback), integration second, E2E last
- Cache dependencies between runs (`actions/cache` for `node_modules`, `.venv`)
- Set per-test timeout (30s unit, 60s integration, 120s E2E) — fail fast on hangs

## Anti-Patterns

- ❌ Testing implementation details instead of behavior (asserting mock call counts for internal functions)
- ❌ Copy-pasting test data across files instead of using builders/factories
- ❌ `sleep(5000)` to wait for async operations — use polling, events, or `waitFor`
- ❌ Disabling tests with `skip` and no tracking issue — hidden tech debt
- ❌ Mocking everything including the unit under test — you're testing mocks, not code
- ❌ Running E2E tests against production APIs in CI — use WireMock or recorded fixtures
- ❌ Coverage gaming: `expect(true).toBe(true)` to inflate numbers
- ❌ Non-deterministic AI tests without seed pinning and tolerance ranges
- ❌ Snapshot tests on volatile data (timestamps, random IDs, LLM outputs)

## WAF Alignment

| Pillar | Testing Practice |
|--------|-----------------|
| **Reliability** | Retry/circuit-breaker tests, chaos test stubs, health-check assertions, failover validation |
| **Security** | Prompt injection test cases, PII leak assertions, auth boundary tests, dependency audit in CI |
| **Cost Optimization** | Token-budget assertions, model-routing correctness tests, cache-hit ratio validation |
| **Operational Excellence** | CI parallelization, coverage gates, mutation score tracking, structured test telemetry |
| **Performance Efficiency** | Latency budget tests (p95 < threshold), streaming response tests, batch-size boundary tests |
| **Responsible AI** | Bias detection test sets, content safety assertions, groundedness evaluation pipeline |
