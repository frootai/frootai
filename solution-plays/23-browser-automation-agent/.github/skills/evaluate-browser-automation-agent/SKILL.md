---
name: evaluate-browser-automation-agent
description: "Evaluate Browser Automation Agent — measure task completion rate, action success rate, step efficiency, selector resilience, error recovery. Use when: evaluate, test automation quality."
---

# Evaluate Browser Automation Agent

## When to Use
- Evaluate end-to-end task completion (can agent finish the workflow?)
- Measure per-action success rate (click, type, navigate)
- Assess step efficiency (fewer steps = better planning)
- Test selector resilience (does it break on minor DOM changes?)
- Validate error recovery (network failures, timeouts, CAPTCHAs)

## Browser Agent Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Task completion rate | ≥ 85% | Completed tasks / total attempted |
| Action success rate | ≥ 95% | Successful actions / total actions |
| Avg steps per task | < 10 | Steps from start to goal |
| Selector resilience | ≥ 90% | Actions working after minor DOM change |
| Error recovery rate | ≥ 80% | Recovered from transient failure |
| Screenshot analysis accuracy | ≥ 90% | Vision correctly identifies page state |
| Time per task | < 60 seconds | Total automation time |
| Cost per task | < $0.10 | GPT-4o vision calls × screenshots |

## Step 1: Prepare Task Test Set
```json
{"task": "Login to portal and check account balance", "url": "https://portal.company.com", "expected_result": "balance_displayed", "max_steps": 8}
{"task": "Fill out support ticket form", "url": "https://support.company.com/new", "expected_result": "ticket_submitted", "max_steps": 12}
{"task": "Download monthly report from dashboard", "url": "https://dashboard.company.com", "expected_result": "file_downloaded", "max_steps": 6}
{"task": "Navigate to settings and update notification preferences", "url": "https://app.company.com/settings", "expected_result": "settings_saved", "max_steps": 10}
```
Minimum: 20 tasks covering login, form fill, navigation, data extraction, download.

## Step 2: Evaluate Task Completion
```bash
python evaluation/eval.py --test-set evaluation/test-set.jsonl --metrics task_completion
```
- Track which tasks complete end-to-end
- Identify failure points (which step fails most?)
- Categorize: vision error vs selector error vs timeout vs CAPTCHA

## Step 3: Evaluate Action Reliability
| Action Type | Expected Success | Track |
|------------|-----------------|-------|
| Click button | ≥ 98% | Selector found + click registered |
| Type in input | ≥ 98% | Input focused + text entered |
| Navigate to URL | ≥ 99% | Page loaded within timeout |
| Select dropdown | ≥ 95% | Option selected correctly |
| Scroll to element | ≥ 95% | Element becomes visible |
| Wait for state | ≥ 90% | Condition met within timeout |

## Step 4: Test Selector Resilience
- Record selectors used in successful run
- Modify DOM slightly (add class, change ID prefix)
- Re-run: what % of actions still work?
- Target: ≥ 90% resilience (use accessible names, not fragile CSS)

## Step 5: Test Error Recovery
| Scenario | Expected Behavior |
|----------|------------------|
| Page load timeout | Retry with exponential backoff |
| Element not found | Wait + retry, then screenshot + replan |
| Network error | Retry request, continue from last state |
| CAPTCHA detected | Flag for human-in-the-loop |
| Unexpected popup | Dismiss popup, continue task |
| Login session expired | Re-authenticate, resume |

## Step 6: Generate Report
```bash
python evaluation/eval.py --all --output evaluation/report.json --ci-gate
```

### Quality Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Deploy automation to production schedule |
| Task completion < 75% | Improve action planning, add retry logic |
| Selector resilience < 80% | Switch to accessible name selectors |
| Error recovery < 70% | Add more error handling scenarios |
| Cost > $0.20/task | Reduce screenshot frequency, use DOM more |

## Evaluation Cadence
- **Pre-deployment**: Full task suite on target site
- **Weekly**: Spot-check 5 tasks (sites change frequently)
- **On site update**: Re-evaluate when target UI changes
- **Monthly**: Full regression on all recorded tasks

## Common Failure Patterns

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Agent clicks wrong button | Multiple similar buttons | Use accessible name with exact text |
| Form submit fails | Required field missed | Scan all required fields before submit |
| Login broken after update | Selector changed | Use accessible role selectors |
| Infinite scroll loop | No scroll limit | Set max scroll attempts (5) |
| Downloaded file empty | Click before download ready | Wait for network idle after click |
| Popup blocks interaction | Unexpected modal | Add popup detection + dismiss step |
