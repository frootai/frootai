---
name: evaluate-ai-code-review-pipeline
description: "Evaluate AI Code Review — measure comment quality, false positive rate, developer trust, OWASP coverage, review latency. Use when: evaluate, assess review quality."
---

# Evaluate AI Code Review Pipeline

## When to Use
- Measure review comment quality (actionable vs noise)
- Calculate false positive rate (incorrect findings)
- Assess developer trust (are comments accepted or dismissed?)
- Validate OWASP scanning coverage
- Gate pipeline deployment with quality thresholds

## Review Quality Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Comment actionability | ≥ 80% | Developer accepts/acts on comment |
| False positive rate | < 15% | Comments dismissed as incorrect |
| True security finding rate | ≥ 90% | Known vulns detected in test PRs |
| Review latency | < 3 minutes | Time from PR open to review posted |
| OWASP coverage | 100% of Top 10 | Vulnerability categories covered |
| Developer satisfaction | ≥ 4.0/5.0 | Post-review survey |
| Comment duplication | < 5% | Same issue flagged multiple times |
| Merge block accuracy | 100% | Only critical issues block merge |

## Step 1: Prepare Test PRs
Create synthetic PRs with known issues:
```json
{"pr_id": "test-001", "file": "auth.ts", "issue": "hardcoded_api_key", "severity": "critical", "line": 42}
{"pr_id": "test-002", "file": "query.py", "issue": "sql_injection", "severity": "critical", "line": 18}
{"pr_id": "test-003", "file": "app.js", "issue": "n_plus_1_query", "severity": "medium", "line": 55}
{"pr_id": "test-004", "file": "utils.ts", "issue": "none", "severity": "none", "line": null}
```
Minimum: 30 test PRs — 15 with issues, 15 clean (to test false positive rate).

## Step 2: Evaluate Comment Quality
- Run all test PRs through the review pipeline
- For each comment: is it actionable? correct? appropriate severity?
- Score: actionable (fix possible), informational (context but no fix), noise (wrong)
- Target: ≥ 80% actionable + informational, < 15% noise

## Step 3: Evaluate OWASP Coverage
| OWASP Category | Test PR | Detected? |
|---------------|---------|----------|
| LLM01: Prompt Injection | test-pr-owasp-01 | ✅ / ❌ |
| LLM02: Insecure Output | test-pr-owasp-02 | ✅ / ❌ |
| SQL Injection | test-pr-sqli | ✅ / ❌ |
| XSS | test-pr-xss | ✅ / ❌ |
| Hardcoded Secrets | test-pr-secrets | ✅ / ❌ |

## Step 4: Developer Trust Assessment
- Track over 30 days: what % of AI comments do developers address?
- If < 50% addressed: comments may be too noisy → tune prompts
- If > 80% addressed: high trust → can increase automation (auto-approve clean PRs)

## Step 5: Generate Report
```bash
python evaluation/eval.py --all --output evaluation/review-report.json --ci-gate
```

### Quality Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Enable pipeline on all repos |
| FP rate > 20% | Tune review prompts, add "confident only" directive |
| OWASP gaps | Add missing detection rules |
| Latency > 5 min | Route small diffs to gpt-4o-mini |
| Developer trust < 50% | Review comment samples, reduce noise |

## Evaluation Cadence
- **Pre-rollout**: Full test PR suite (30+ PRs)
- **Weekly**: False positive rate from developer feedback
- **Monthly**: Developer trust survey, OWASP coverage check
- **On prompt change**: Re-evaluate on test PR suite

## Common Failure Patterns

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| All PRs flagged critical | Severity calibration off | Add confidence threshold to prompt |
| Missing SQL injection | Pattern not in prompt | Add injection patterns to review rules |
| Style comments despite rule | System prompt too long, lost context | Move "no style" to beginning of prompt |
| Comments on generated files | No file exclusion list | Add .generated., dist/, build/ to exclude |
| Review on force-push loses comments | GitHub API resolves old comments | Re-post on force push if still relevant |
| Comments reference wrong diff | Stale diff cached | Always fetch fresh diff on each run |

## CI/CD Quality Gates
```yaml
- name: Review Quality Gate
  run: python evaluation/eval.py --metrics comment_quality --ci-gate --threshold 0.80
- name: False Positive Gate
  run: python evaluation/eval.py --metrics false_positive --ci-gate --max-rate 0.15
- name: OWASP Coverage Gate
  run: python evaluation/eval.py --metrics owasp_coverage --ci-gate --threshold 1.0
```

## Benchmark: AI Review vs Human Review
| Dimension | Human Reviewer | AI Review Pipeline |
|-----------|---------------|-------------------|
| Speed | 30-60 min/PR | < 3 min/PR |
| Coverage | Varies by reviewer | Consistent across all PRs |
| Cost | $50-100/review (senior dev time) | ~$0.07/review |
| Availability | Business hours | 24/7 |
