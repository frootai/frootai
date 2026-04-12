---
name: tune-browser-automation-agent
description: "Tune Browser Automation Agent — optimize screenshot frequency, wait strategies, selector methods, action planning prompts, step limits, cost per automation. Use when: tune, optimize browser agent."
---

# Tune Browser Automation Agent

## When to Use
- Optimize screenshot frequency (balance vision cost vs accuracy)
- Configure wait strategies for dynamic pages (SPAs)
- Select best selector methods for action reliability
- Tune action planning prompts for fewer steps
- Reduce cost per automation task

## Tuning Dimensions

### Dimension 1: Screenshot Strategy

| Strategy | Screenshots/Task | Cost | Accuracy | Best For |
|----------|-----------------|------|----------|---------|
| Every action | 10-15 | High ($0.15) | Highest | Debugging, new tasks |
| Before decisions only | 3-5 | Medium ($0.05) | High | Stable workflows |
| On error only | 1-2 | Low ($0.02) | Medium | Cost-optimized, known flows |
| No screenshots (DOM only) | 0 | Lowest ($0.01) | Lower | Simple form fills |

**Rule**: Start with screenshots on every action (debugging). Reduce to decision-only once task is reliable.

### Dimension 2: Wait Strategy Optimization

| Strategy | Implementation | Best For |
|----------|---------------|---------|
| Fixed delay | `page.wait_for_timeout(2000)` | Never (waste of time) |
| Network idle | `page.wait_for_load_state('networkidle')` | Traditional multi-page sites |
| DOM stable | wait for element visible + stable | React/Angular SPAs |
| Custom condition | wait for specific element or text | Known page states |
| Adaptive | short wait → check → longer wait → check | Unknown pages |

**Anti-pattern**: Never use fixed delays. Always wait for a specific condition.

### Dimension 3: Selector Method Selection

| Method | Resilience | Speed | Example |
|--------|-----------|-------|---------|
| Accessible name (ARIA) | Highest | Medium | `page.get_by_role('button', name='Submit')` |
| Test ID | High | Fast | `page.get_by_test_id('submit-btn')` |
| Text content | High | Medium | `page.get_by_text('Submit')` |
| CSS selector | Low | Fast | `page.locator('#btn-submit')` |
| XPath | Lowest | Slow | `page.locator('//button[@id="submit"]')` |

**Priority order**: Accessible name > test ID > text content > CSS > XPath.
Using accessible names makes the agent resilient to UI redesigns.

### Dimension 4: Action Planning Prompt

| Optimization | Before | After | Impact |
|-------------|--------|-------|--------|
| Add page context | "Click a button" | "On the login page, click 'Sign In' button" | Fewer wrong clicks |
| Specify goal | "Fill the form" | "Fill name, email, submit the contact form" | Direct path |
| Add constraints | "Navigate freely" | "Stay on *.company.com, max 10 steps" | Safety + efficiency |
| Error hint | (none) | "If element not found, scroll down first" | Better recovery |

### Dimension 5: Cost Per Automation

| Component | Cost Driver | Optimization |
|-----------|------------|-------------|
| GPT-4o vision | Screenshots × $0.01 each | Reduce frequency, lower resolution |
| GPT-4o planning | Action tokens per step | Shorter prompts, cached plans |
| Container runtime | Running time × $/hr | Faster execution = less runtime |
| Network | Page loads | Cache static pages |

**Monthly estimate** (100 automations/day, avg 8 steps):
- Vision (3 screenshots/task): ~$90/mo
- Planning (500 tokens/step): ~$120/mo
- Container (30s/task): ~$30/mo
- **Total: ~$240/mo** (optimize to ~$100 with fewer screenshots + DOM mode)

## Production Readiness Checklist
- [ ] Task completion rate ≥ 85% on test suite
- [ ] Action success rate ≥ 95%
- [ ] Selector resilience ≥ 90% after minor DOM changes
- [ ] Error recovery tested (timeout, element missing, popup)
- [ ] Domain allowlist configured and verified
- [ ] Credentials stored in Key Vault (not hardcoded)
- [ ] Screenshot frequency optimized for cost
- [ ] Max step limit enforced (no infinite loops)
- [ ] Cost per task within budget

## Output: Tuning Report
After tuning, compare:
- Task completion rate improvement
- Step count reduction (efficiency)
- Screenshot frequency optimization
- Cost per task reduction
- Selector resilience improvement

## Tuning Playbook
1. **Baseline**: Record 20 tasks with screenshots-every-action mode
2. **Analyze**: Identify which steps use vision vs DOM (split ratio)
3. **Optimize screenshots**: Reduce to decision-only for stable steps
4. **Fix selectors**: Replace all CSS/XPath with accessible name selectors
5. **Tune waits**: Replace fixed delays with condition-based waits
6. **Compress prompts**: Shorten action planning to key context only
7. **Re-test**: Run same 20 tasks, compare completion rate + cost
