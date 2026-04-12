---
name: evaluate-low-code-ai-builder
description: "Evaluate Low-Code AI Builder — test pipeline execution accuracy, template quality, deployment success rate, user experience, connector reliability. Use when: evaluate, test builder platform."
---

# Evaluate Low-Code AI Builder

## When to Use
- Test pipeline execution accuracy on template workflows
- Validate template quality (do templates produce correct results?)
- Measure deployment success rate (one-click → running app)
- Assess user experience (time to first pipeline, error messages)
- Gate releases with platform quality thresholds

## Builder Platform Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Pipeline execution success | ≥ 95% | Pipelines completing without errors |
| Template import success | 100% | Templates loading and customizable |
| Deployment success rate | ≥ 90% | One-click deploy → running Container App |
| Connector auth success | ≥ 99% | Connectors authenticating on first try |
| Time to first pipeline | < 5 minutes | New user → first pipeline running |
| Error message quality | ≥ 4.0/5.0 | User understanding of errors |
| Pipeline output accuracy | ≥ 90% | Correct results on test data |
| Visual designer load time | < 3 seconds | Initial page load |

## Step 1: Test Template Pipelines
Run each template with sample data:
- Document Classifier: 20 sample docs → verify correct classification
- Customer Sentiment: 20 sample reviews → verify correct sentiment
- FAQ Bot: 20 test questions → verify grounded answers
- Email Triager: 20 sample emails → verify correct routing
- Data Enricher: 20 sample records → verify enrichment quality

## Step 2: Test Pipeline Editor UX
- Create new pipeline from scratch (< 5 min target)
- Drag nodes, connect edges, configure properties
- Validate: pipeline runs on first attempt (no hidden config)
- Test undo/redo, save/load, version history

## Step 3: Test One-Click Deployment
- Deploy 5 different pipeline types to staging
- Verify: Container App running, endpoints responding
- Verify: rollback works (revert to previous version)
- Measure: deploy time (target < 3 minutes)

## Step 4: Test Error Handling
| Scenario | Expected UX |
|----------|------------|
| Invalid connector config | Clear error: "Missing API key for connector X" |
| AI step timeout | Retry with "Step took too long. Retrying..." |
| Circular dependency | Block with "Loop detected between step A → B → A" |
| Missing required input | Highlight node + "Required: input field X" |
| Deploy quota exceeded | "Insufficient Azure quota. Contact admin." |

## Step 5: Generate Report
```bash
python evaluation/eval.py --all --output evaluation/builder-report.json --ci-gate
```

### Quality Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Release builder platform |
| Pipeline execution < 90% | Fix failing pipeline patterns |
| Deploy success < 80% | Debug Container App generation |
| Template errors | Fix template definitions |
| UX score < 3.5 | Improve error messages and validation |

## Evaluation Cadence
- **Pre-release**: Full template suite + deployment testing
- **Weekly**: Monitor pipeline execution success rate
- **Monthly**: User experience survey, time-to-first-pipeline
- **On template add**: Test new template with 20 sample inputs

## Common Failure Patterns

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Template produces wrong output | Prompt too generic | Add domain-specific few-shot examples |
| Deploy fails with quota error | Subscription limit | Pre-check quota before deploy |
| Connector timeout | Slow backend API | Add timeout + retry in connector config |
| Pipeline loops forever | Circular condition | Add loop detection in validator |
| Users confused by errors | Technical error messages | Map errors to user-friendly descriptions |
| Canvas elements misaligned | Browser zoom issue | Use relative positioning, test at 100%/125%/150% |

## CI/CD Quality Gates
```yaml
- name: Template Execution Gate
  run: python evaluation/eval.py --metrics template_execution --ci-gate --threshold 0.95
- name: Deploy Success Gate
  run: python evaluation/eval.py --metrics deploy_success --ci-gate --threshold 0.90
- name: UX Load Time Gate
  run: python evaluation/eval.py --metrics load_time --ci-gate --max-seconds 3
```

## Benchmark: Low-Code vs Custom Code
| Dimension | Custom Code | Low-Code Builder |
|-----------|------------|-----------------|
| Time to first pipeline | Days-weeks | < 5 minutes |
| Developer skill required | Senior developer | Business analyst |
| Maintenance burden | Code updates + deploy | Visual edit + one-click |
| Flexibility | Maximum | Template-bounded |
| Best for | Complex custom logic | Standard AI workflows |
