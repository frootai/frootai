---
name: tune-ai-powered-testing
description: "Tune AI-Powered Testing — optimize generation prompts, test prioritization, mutation testing config, flaky test handling, model routing per language. Use when: tune, optimize test generation."
---

# Tune AI-Powered Testing

## When to Use
- Optimize LLM prompts for higher-quality test generation
- Configure test prioritization (critical paths first)
- Tune mutation testing scope and thresholds
- Reduce flaky test rate
- Route generation to optimal model per language/complexity

## Tuning Dimensions

### Dimension 1: Generation Prompt Optimization

| Technique | Before | After | Impact |
|-----------|--------|-------|--------|
| Add framework hint | Generic tests | Framework-specific (pytest/Jest) | +30% compile rate |
| Include function docstring | Guess behavior | Test documented behavior | +25% relevance |
| Specify edge cases | Random tests | Null, empty, boundary, large | +40% edge coverage |
| Add assertion guidance | assert True | assert result == expected | +50% mutation score |
| Include dependencies | Import errors | Correct imports and mocks | +35% pass rate |

### Dimension 2: Test Prioritization

| Strategy | Method | Best For |
|----------|--------|---------|
| Risk-based | Prioritize recently changed code | Regression prevention |
| Coverage-gap | Prioritize uncovered functions | Coverage improvement |
| Complexity-based | Prioritize high-cyclomatic-complexity | Bug-likely code |
| History-based | Prioritize files with past bugs | Known hotspots |
| Time-based | Fastest tests first, slow last | CI speed optimization |

### Dimension 3: Model Routing

| Language/Complexity | Model | Why | Cost |
|--------------------|-------|-----|------|
| Simple functions (< 20 LOC) | gpt-4o-mini | Sufficient for simple cases | $0.01/file |
| Complex logic (> 50 LOC) | gpt-4o | Better reasoning for edge cases | $0.05/file |
| Multi-file interactions | gpt-4o | Needs cross-file understanding | $0.08/file |
| Security-sensitive | gpt-4o | Must catch security edge cases | $0.05/file |
| Config/boilerplate | Skip | Not worth testing | $0 |

### Dimension 4: Flaky Test Reduction

| Strategy | Implementation | Effectiveness |
|----------|---------------|---------------|
| Remove time dependencies | Mock time.now() | Eliminates clock flakes |
| Add test isolation | Each test resets state | Eliminates order deps |
| Add explicit waits | Replace sleep() with conditions | Eliminates timing flakes |
| Retry decorator | Retry 3x before failing | Masks (not fixes) root cause |
| Quarantine | Move flaky tests to separate suite | Prevents pipeline blocks |

### Dimension 5: Cost Per Test Suite

| Component | Cost | Optimization |
|-----------|------|-------------|
| Test generation (LLM) | $0.01-0.08/file | Route simple→mini, complex→full |
| Mutation testing | $0.05/file (extra LLM calls) | Only on changed files |
| CI execution | $0.01/run | Test prioritization (fast tests first) |
| Flaky retry | $0.005/flaky test | Fix root cause instead of retrying |

**Monthly estimate** (100 files, daily CI):
- Generation (first time): ~$5 (one-time)
- Incremental (changed files): ~$30/mo
- Mutation testing (weekly): ~$20/mo
- CI execution: ~$30/mo
- **Total: ~$80/mo** for complete AI test automation

## Production Readiness Checklist
- [ ] Generated test pass rate ≥ 95%
- [ ] Coverage improvement ≥ 15%
- [ ] Mutation score ≥ 70%
- [ ] Flaky rate < 3%
- [ ] CI integration running on every PR
- [ ] Model routing configured per language
- [ ] Test prioritization active
- [ ] Assertion density ≥ 2 per test
- [ ] Cost per month within budget

## Output: Tuning Report
After tuning, compare:
- Test quality improvement (pass rate, mutation score)
- Coverage delta
- Flaky test rate reduction
- Cost per test suite
- Generation speed improvement

## Tuning Playbook
1. **Baseline**: Generate tests for 10 source files, record all metrics
2. **Prompt**: Add framework hint + edge case directive + assertion guidance
3. **Model**: Route simple functions to gpt-4o-mini, complex to gpt-4o
4. **Mutation**: Run mutation testing, identify surviving mutations
5. **Fix**: Regenerate tests targeting surviving mutations specifically
6. **Flaky**: Run 5x, quarantine any non-deterministic tests
7. **Priority**: Configure risk-based test ordering in CI
8. **Coverage**: Compare coverage before/after, target \u226515% lift
9. **Cost**: Calculate monthly budget at target repo size
10. **Re-test**: Same 10 files, compare before/after
