---
name: evaluate-ai-powered-testing
description: "Evaluate AI-Powered Testing — measure generated test quality, coverage improvement, mutation score, false positive rate, flaky test rate. Use when: evaluate, audit test quality."
---

# Evaluate AI-Powered Testing

## When to Use
- Evaluate quality of AI-generated tests (do they catch real bugs?)
- Measure coverage improvement after test generation
- Calculate mutation score (test strength indicator)
- Detect flaky tests in generated suite
- Gate CI integration with test quality thresholds

## Test Quality Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Generated test pass rate | ≥ 95% | Tests passing on current (correct) code |
| Coverage improvement | ≥ 15% increase | Before vs after coverage delta |
| Mutation score | ≥ 70% | Mutations killed / total mutations |
| Assertion density | ≥ 2 per test | Assertions / test count |
| Flaky test rate | < 3% | Tests failing non-deterministically |
| Test generation accuracy | ≥ 85% | Valid, meaningful tests / total generated |
| Edge case coverage | ≥ 60% | Edge cases tested / identifiable edges |
| Duplicate test rate | < 5% | Semantically duplicate tests |

## Step 1: Evaluate Generated Test Quality
```bash
# Run generated tests
pytest tests/generated/ -v --tb=short
# Count pass/fail/error
```
For each generated test, assess:
- Does it test behavior (good) or implementation details (bad)?
- Are assertions meaningful (checking actual values, not just no-exception)?
- Are edge cases covered (null, empty, boundary, concurrent)?
- Are mocks appropriate (not mocking the thing under test)?

## Step 2: Measure Coverage Delta
```bash
# Before AI generation
pytest tests/ --cov=src --cov-report=json -o cov_before.json
# After AI generation
pytest tests/ tests/generated/ --cov=src --cov-report=json -o cov_after.json
# Compare
python scripts/coverage_diff.py --before cov_before.json --after cov_after.json
```

## Step 3: Run Mutation Testing
```bash
python scripts/mutation_test.py --target src/ --tests tests/generated/
```
- **Killed mutations**: Test suite caught the change (good)
- **Survived mutations**: Test suite missed the change (weak assertion)
- Target: ≥ 70% mutation kill rate

## Step 4: Detect Flaky Tests
```bash
# Run tests 5 times, flag any that pass/fail inconsistently
for i in $(seq 1 5); do pytest tests/generated/ --tb=short >> results.txt; done
python scripts/detect_flaky.py --results results.txt
```
- Flaky test = passes sometimes, fails sometimes with same code
- Common causes: time-dependent, order-dependent, external service

## Step 5: Compare AI vs Human Tests
| Metric | Human-Written | AI-Generated | Delta |
|--------|-------------|-------------|-------|
| Coverage | Measure | Measure | AI improvement |
| Mutation score | Measure | Measure | Strength comparison |
| Time to write | Hours | Seconds | Speed advantage |
| Edge case recall | Measure | Measure | Completeness |
| Maintenance burden | Manual updates | Re-generate | Cost over time |

## Step 6: Generate Report
```bash
python evaluation/eval.py --all --output evaluation/test-quality-report.json --ci-gate
```

### Quality Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Enable AI test gen in CI pipeline |
| Pass rate < 90% | Improve generation prompt, add framework context |
| Mutation score < 50% | Add "strong assertions, check return values" to prompt |
| Flaky > 5% | Add retry decorator, flag for human review |
| Coverage < 10% improvement | Increase generated test count, focus on untested paths |

## Evaluation Cadence
- **Pre-CI-integration**: Full quality evaluation on 5 source files
- **Weekly**: Monitor flaky test rate in CI dashboard
- **Monthly**: Re-evaluate mutation score + coverage delta
- **On prompt change**: Re-generate and compare quality

## Common Failure Patterns

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Tests assert True always | Prompt didn't request value checks | Add "assert return value equals expected" |
| Import errors in tests | Missing dependency in context | Include imports in prompt context |
| Tests mock the SUT | Misunderstood mock scope | Add "mock dependencies, NOT the function under test" |
| Trivial edge cases only | No guidance on boundaries | Add "test null, empty, max int, concurrent" |
| 0% mutation killed | All assertions are `assert not throws` | Require value assertions, not just no-exception |
