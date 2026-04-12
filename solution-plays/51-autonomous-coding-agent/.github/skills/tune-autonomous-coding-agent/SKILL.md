---
name: "tune-autonomous-coding-agent"
description: "Tune Autonomous Coding Agent — plan accuracy, iteration limits, test coverage requirements, auto-merge criteria, scope guards, cost per PR optimization."
---

# Tune Autonomous Coding Agent

## Prerequisites

- Deployed autonomous coding agent with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`
- Evaluation baseline from `evaluate-autonomous-coding-agent` skill

## Step 1: Tune Code Generation

### Model Configuration
```json
// config/openai.json
{
  "code_generation": {
    "model": "gpt-4o",
    "temperature": 0,
    "seed": 42,
    "max_tokens": 4096,
    "system_prompt": "You are an expert software engineer. Write clean, tested, well-documented code. Follow existing project conventions."
  },
  "plan_generation": {
    "model": "gpt-4o",
    "temperature": 0.1,
    "max_tokens": 2048,
    "response_format": "json_object"
  },
  "test_generation": {
    "model": "gpt-4o-mini",
    "temperature": 0.2,
    "max_tokens": 2048
  },
  "pr_description": {
    "model": "gpt-4o-mini",
    "temperature": 0.3,
    "max_tokens": 1000
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `code.temperature` | 0 | ALWAYS 0 for code (deterministic) |
| `code.seed` | 42 | Reproducible output |
| `plan.temperature` | 0.1 | Slightly creative for plan alternatives |
| `test.model` | gpt-4o-mini | Good enough for tests, 90% cheaper |
| `pr.model` | gpt-4o-mini | Good enough for descriptions |

### Model Selection per Task
| Task | Model | Why |
|------|-------|-----|
| Issue analysis | gpt-4o | Needs deep understanding |
| Implementation plan | gpt-4o | Critical accuracy |
| Code generation | gpt-4o | Must compile, must be correct |
| Test generation | gpt-4o-mini | Patterns are simpler, save cost |
| PR description | gpt-4o-mini | Text summarization, save cost |
| Self-healing | gpt-4o | Error analysis needs full model |

## Step 2: Tune Pipeline Behavior

### Pipeline Configuration
```json
// config/guardrails.json
{
  "pipeline": {
    "max_files_per_pr": 10,
    "max_lines_changed": 500,
    "max_self_heal_attempts": 3,
    "require_tests": true,
    "require_lint_pass": true,
    "require_existing_tests_pass": true,
    "allowed_file_types": [".py", ".ts", ".js", ".tsx", ".jsx", ".json", ".md"],
    "blocked_patterns": ["*.lock", "*.min.*", "dist/*", "build/*"]
  },
  "quality_gates": {
    "min_test_coverage_delta": 5,
    "max_complexity_per_function": 15,
    "require_type_annotations": true,
    "require_docstrings": true
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `max_files_per_pr` | 10 | Lower = smaller safer PRs, may need multiple |
| `max_lines_changed` | 500 | Lower = fewer regressions, scope guard |
| `max_self_heal_attempts` | 3 | Higher = more resilient, higher cost |
| `require_tests` | true | false only for docs-only changes |
| `min_test_coverage_delta` | 5% | Higher = more tests required |
| `max_complexity_per_function` | 15 | Lower = simpler code output |

### Pipeline Tuning Guide
| Symptom | Adjustment |
|---------|------------|
| PRs too large | Lower max_files to 5, max_lines to 300 |
| Self-healing loops forever | Lower max_self_heal to 2, add better error parsing |
| Tests not generated | Verify require_tests=true, check test framework detection |
| Code style mismatch | Add existing codebase examples to system prompt |
| Frequent lint failures | Add lint rules to system prompt |

## Step 3: Tune Auto-Merge Criteria

```json
// config/agents.json
{
  "auto_merge": {
    "enabled": false,
    "criteria": {
      "max_files": 3,
      "max_lines": 100,
      "issue_types": ["bug"],
      "require_all_tests_pass": true,
      "require_lint_clean": true,
      "require_coverage_increase": true,
      "confidence_threshold": 0.95
    }
  },
  "branch_naming": {
    "pattern": "fix/{issue_number}-{short_title}",
    "max_length": 50
  },
  "pr_labels": ["auto-generated", "needs-review"],
  "assignees": ["tech-lead"]
}
```

Auto-merge safety:
| Criterion | Default | Purpose |
|-----------|---------|--------|
| `max_files: 3` | Small changes only | Reduce blast radius |
| `issue_types: ["bug"]` | Bug fixes only | Features need human review |
| `confidence_threshold: 0.95` | Very high confidence | Only auto-merge when sure |
| `require_coverage_increase` | true | No coverage regression |

## Step 4: Tune Codebase Indexing

```json
// config/agents.json
{
  "indexing": {
    "max_files": 500,
    "ignore_patterns": ["node_modules", ".git", "__pycache__", "dist", "build"],
    "index_depth": "imports+exports",
    "cache_ttl_hours": 24,
    "language_detection": "auto",
    "test_framework_detection": "auto"
  }
}
```

## Step 5: Cost Optimization

```python
# Autonomous coding cost breakdown per PR:
# - Issue analysis (gpt-4o): ~$0.05 (500 tokens)
# - Codebase index (gpt-4o): ~$0.10 (cached, amortized)
# - Plan generation (gpt-4o): ~$0.10 (1000 tokens)
# - Code generation (gpt-4o, per file): ~$0.15/file
# - Test generation (gpt-4o-mini): ~$0.01
# - Self-healing (gpt-4o, if needed): ~$0.15/attempt
# - PR description (gpt-4o-mini): ~$0.005
# - Total (3-file bug fix): ~$0.55
# - Total (10-file feature): ~$2.10

# Cost reduction strategies:
# 1. Use gpt-4o-mini for test gen + PR description (save 50%)
# 2. Cache codebase index (save $0.10/PR)
# 3. Reduce max_self_heal to 2 (save $0.15 on failures)
# 4. Limit scope to 5 files (fewer code gen calls)
# 5. Batch similar issues (share codebase context)
```

| Strategy | Savings | Trade-off |
|----------|---------|----------|
| gpt-4o-mini for tests+PR | ~50% on test/PR | Slightly simpler tests |
| Cache codebase index | ~$0.10/PR | May miss new files (<24h) |
| Lower self-heal attempts | ~$0.15-0.30 | More failed PRs |
| Smaller scope guard | ~30% per PR | More PRs for large issues |
| Batch similar issues | ~20% total | Longer queue time |

## Step 6: Verify Tuning Impact

```bash
python evaluation/eval_resolution.py --test-data evaluation/data/
python evaluation/eval_code_quality.py --test-data evaluation/data/
python evaluation/eval_tests.py --test-data evaluation/data/
python evaluation/eval_prs.py --test-data evaluation/data/
python evaluation/eval_cost.py

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Resolution rate | baseline | +10-15% | > 70% |
| First-attempt success | baseline | +15-20% | > 50% |
| Code compiles | baseline | +3-5% | > 95% |
| Test generation | baseline | +5% | > 90% |
| Cost per PR | ~$1.00 | ~$0.55 | < $1.00 |
