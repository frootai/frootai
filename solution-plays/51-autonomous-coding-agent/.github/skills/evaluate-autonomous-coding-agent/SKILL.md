---
name: "evaluate-autonomous-coding-agent"
description: "Evaluate Autonomous Coding Agent quality — issue resolution rate, code correctness, test coverage, PR acceptance rate, iteration count, cost per PR."
---

# Evaluate Autonomous Coding Agent

## Prerequisites

- Deployed autonomous coding agent (run `deploy-autonomous-coding-agent` skill first)
- Test issues dataset with known solutions
- Python 3.11+ with `pytest`, `coverage`, `azure-ai-evaluation` packages
- GitHub repository with test issues

## Step 1: Prepare Evaluation Dataset

```bash
mkdir -p evaluation/data

# Each test case: issue description + expected solution
# evaluation/data/issue-001.json
# {
#   "title": "Fix null check in user service",
#   "body": "UserService.getUser() crashes when userId is null",
#   "type": "bug",
#   "expected_files": ["src/services/user-service.ts"],
#   "expected_test": true,
#   "complexity": "simple"
# }
```

Test categories:
- **Bug fixes**: Null checks, off-by-one, exception handling (10 issues)
- **Feature additions**: New endpoints, new fields, new methods (5 issues)
- **Refactoring**: Extract function, rename, move file (5 issues)
- **Multi-file changes**: Cross-module updates (5 issues)
- **Edge cases**: Circular deps, large files, monorepo (5 issues)

## Step 2: Evaluate Resolution Rate

```bash
python evaluation/eval_resolution.py \
  --test-data evaluation/data/ \
  --agent-endpoint $AGENT_ENDPOINT \
  --output evaluation/results/resolution.json
```

Resolution metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Resolution Rate** | Issues fully resolved to merged PR | > 70% |
| **Partial Resolution** | Correct direction but incomplete | Track (< 20%) |
| **Failure Rate** | Agent could not resolve | < 10% |
| **First-Attempt Success** | Resolved without self-healing iterations | > 50% |
| **Avg Iterations** | Self-healing cycles before passing | < 2.5 |
| **Scope Compliance** | PRs within max-file limit | 100% |

## Step 3: Evaluate Code Quality

```bash
python evaluation/eval_code_quality.py \
  --test-data evaluation/data/ \
  --output evaluation/results/quality.json
```

Code quality metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Compiles/Lints** | Generated code passes linter | > 95% |
| **Type Safety** | No type errors in TypeScript/Python | > 90% |
| **Style Conformance** | Matches existing code style | > 85% |
| **No Regressions** | Existing tests still pass | 100% |
| **Code Review Score** (LLM judge) | Quality rating by reviewer | > 3.5/5.0 |
| **Security** | No new vulnerabilities introduced | 100% |

## Step 4: Evaluate Test Generation

```bash
python evaluation/eval_tests.py \
  --test-data evaluation/data/ \
  --output evaluation/results/tests.json
```

Test generation metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Test Generated** | Tests created for changed code | > 90% of PRs |
| **Test Pass Rate** | Generated tests pass | > 95% |
| **Coverage Delta** | Coverage increase from generated tests | > +5% |
| **Mutation Kill Rate** | Tests catch introduced bugs | > 60% |
| **Test Quality** (LLM judge) | Meaningful assertions, not trivial | > 3.5/5.0 |

## Step 5: Evaluate PR Quality

```bash
python evaluation/eval_prs.py \
  --test-data evaluation/data/ \
  --output evaluation/results/prs.json
```

PR quality metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Acceptance Rate** | PRs approved by human reviewer | > 60% |
| **Description Quality** | Clear what/why/how + test summary | > 4.0/5.0 |
| **Diff Size** | Lines changed per PR | < 200 lines avg |
| **Review Cycles** | Rounds of review before merge | < 2 avg |
| **Time to Merge** | From PR creation to merge | < 24 hours |

## Step 6: Evaluate Cost Efficiency

```bash
python evaluation/eval_cost.py \
  --output evaluation/results/cost.json
```

Cost metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Tokens per PR** | Total tokens (plan + code + tests + PR) | < 50K tokens |
| **Cost per PR** | API cost for full resolution | < $1.00 |
| **Cost per Bug Fix** | Simple bug resolution cost | < $0.30 |
| **Cost per Feature** | Feature implementation cost | < $2.00 |
| **VM/Compute Cost** | Container Apps runtime | < $30/month |

## Step 7: Generate Evaluation Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md \
  --thresholds config/guardrails.json
```

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Resolution rate | > 70% | config/guardrails.json |
| Code compiles | > 95% | config/guardrails.json |
| No regressions | 100% | config/guardrails.json |
| Test generated | > 90% | config/guardrails.json |
| PR acceptance | > 60% | config/guardrails.json |
| Cost per PR | < $1.00 | config/guardrails.json |
