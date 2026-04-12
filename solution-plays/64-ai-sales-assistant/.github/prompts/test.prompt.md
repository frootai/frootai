---
mode: "agent"
agent: "builder"
description: "Test AI Sales Assistant (Play 64) — score sample leads and generate personalized outreach"
tools: ["terminal", "file", "read", "search"]
---

# Test Ai Sales Assistant Implementation

You are testing the FrootAI Ai Sales Assistant solution play (Play 64).

## Test Strategy
Execute a comprehensive test suite covering unit, integration, E2E, and load tests.

## Step 1: Unit Tests
Run unit tests for business logic and data transformations:
```bash
pytest tests/unit/ -v --cov=app --cov-report=term-missing --cov-report=html
```
**Coverage target:** ≥ 80% on business logic modules.

### What to Test
- Input validation and sanitization functions
- Data transformation and processing logic
- Configuration loading and validation
- Error handling and exception classification
- Output formatting and schema compliance

## Step 2: Integration Tests
Test Azure service integrations:
```bash
pytest tests/integration/ -v --timeout=60
```

### What to Test
- Azure OpenAI chat completion calls (with mock or test deployment)
- Azure AI Search indexing and querying
- Azure Key Vault secret retrieval
- Azure Storage blob operations
- Application Insights telemetry sending

## Step 3: End-to-End Tests
Run full request-response cycle tests:
```bash
pytest tests/e2e/ -v --timeout=120
```

### Scenarios to Cover
- Happy path: valid request → expected response with correct schema
- Authentication: invalid token → 401 response
- Validation: malformed input → 400 with error details
- Rate limiting: burst requests → 429 with Retry-After header
- Content safety: harmful input → blocked with safety reason
- Timeout: slow dependency → graceful timeout response

## Step 4: Load Tests
Establish performance baseline:
```bash
# Using locust or k6
k6 run tests/load/scenario.js --vus 50 --duration 60s
```

### Performance Targets
| Metric | Target | Measurement |
|--------|--------|-------------|
| Response time p50 | < 500ms | Median latency |
| Response time p95 | < 2000ms | 95th percentile |
| Response time p99 | < 5000ms | 99th percentile |
| Error rate | < 1% | 4xx + 5xx responses |
| Throughput | > 50 RPS | Requests per second |

## Step 5: Security Tests
- [ ] SQL/NoSQL injection: verify parameterized queries
- [ ] XSS: verify HTML encoding on LLM output displayed in UI
- [ ] Prompt injection: verify system prompt isolation
- [ ] Auth bypass: verify all endpoints require authentication
- [ ] Rate limit: verify limits are enforced per-user

## Step 6: Evaluate Test Results
```bash
# Generate combined test report
pytest tests/ --junitxml=test-results.xml --html=test-report.html
```

### Pass Criteria
- All unit tests pass (0 failures)
- All integration tests pass (0 failures)
- E2E tests: ≥ 95% pass rate
- Load test: all performance targets met
- Coverage: ≥ 80% on business logic

## Step 7: Test Data Management
- Test fixtures in `tests/fixtures/` directory
- Mock responses for Azure services in `tests/mocks/`
- Test environment config in `tests/conftest.py`
- Evaluation test set in `evaluation/test-set.jsonl`
- Never use production data in tests — use synthetic/anonymized data

## CI Integration
Tests run automatically on every PR:
1. Unit + integration tests on PR creation
2. E2E tests on PR approval (gated)
3. Load tests on merge to main (nightly)
4. Evaluation pipeline on deployment (CD gate)
