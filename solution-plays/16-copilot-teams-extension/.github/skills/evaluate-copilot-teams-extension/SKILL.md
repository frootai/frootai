---
name: evaluate-copilot-teams-extension
description: "Evaluate Copilot Teams Extension — test SSO flow, Graph API permissions, Adaptive Card rendering, response quality, throttling resilience. Use when: evaluate, test, audit."
---

# Evaluate Copilot Teams Extension

## When to Use
- Validate SSO authentication flow end-to-end
- Test Graph API permissions (least privilege verification)
- Evaluate Adaptive Card rendering across Teams clients
- Measure bot response quality and latency
- Test throttling resilience and error handling

## Quality Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| SSO success rate | ≥ 99% | Token acquisition without user prompt |
| Response latency | < 3 seconds | Time from user message to bot reply |
| Adaptive Card render success | 100% | Cards render on desktop + mobile + web |
| Graph API call success | ≥ 99% | API calls returning 200 OK |
| Throttling recovery | 100% | Retry-After honored, no data loss |
| User satisfaction (CSAT) | ≥ 4.0/5.0 | Post-interaction survey |
| Error rate | < 1% | Bot errors / total messages |
| Proactive notification delivery | ≥ 95% | Notifications reaching target users |

## Step 1: Test SSO Flow
- Open extension in Teams → token should be acquired silently
- Verify no login prompt appears (SSO is seamless)
- Test token refresh (wait for expiry → next interaction should auto-refresh)
- Test in private/incognito → should show consent prompt (first time only)

## Step 2: Audit Graph API Permissions
```bash
# List granted permissions
az ad app permission list --id $APP_ID --query "[].{api:resourceAppId, scope:id}" -o table
```
- Verify only required permissions are granted
- No `*.ReadWrite.All` when `*.Read` suffices
- Delegated permissions preferred over Application where possible
- Admin consent granted for Application permissions

## Step 3: Test Adaptive Cards
| Client | Test | Expected |
|--------|------|----------|
| Teams Desktop (Windows) | Send query → verify card renders | Full card with actions |
| Teams Desktop (Mac) | Same query | Same card layout |
| Teams Mobile (iOS) | Same query | Responsive layout, buttons accessible |
| Teams Mobile (Android) | Same query | Responsive layout |
| Teams Web | Same query | Full card rendering |

## Step 4: Evaluate Response Quality
- Send 50 diverse queries through the extension
- Rate responses on relevance (1-5), completeness (1-5), correctness (1-5)
- Track per-category quality (FAQ, data lookup, action execution)
- Verify citations link to correct source documents
- Test edge cases: empty query, very long query, non-English text

## Step 5: Test Throttling Resilience
```bash
# Simulate burst traffic
python evaluation/test_throttling.py --endpoint $BOT_ENDPOINT --rps 100 --duration 60s
```
- Verify bot handles Graph API 429 responses gracefully
- Retry-After header respected
- User gets informative "please wait" message, not an error
- No data loss during throttling

## Step 6: Generate Report
```bash
python evaluation/eval.py --all --output evaluation/report.json --ci-gate
```

### Quality Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Publish to production tenant |
| SSO fails | Check app registration, redirect URIs, token config |
| Cards broken on mobile | Simplify card layout, test with Card Designer |
| Response > 5s | Optimize Graph queries, add caching |
| Throttling causes errors | Implement exponential backoff with Retry-After |

## Common Issues

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| SSO popup appears | Consent not pre-granted | Admin consent in Azure AD |
| Card blank on mobile | Using unsupported card element | Check Teams card version compatibility |
| Graph returns 403 | Missing permission scope | Add required scope, re-consent |
| Bot responds slowly | No Graph query batching | Use `$batch` for multiple calls |
| Proactive messages fail | Missing Teams activity permission | Add `TeamsActivity.Send` to app |

## Evaluation Cadence
- **Pre-publish**: Full test suite across all Teams clients
- **Weekly**: Monitor error rates and response latency
- **Monthly**: User satisfaction survey, quality spot-check
- **On Graph API update**: Re-test affected permission scopes
- **On Teams SDK update**: Re-test Adaptive Card rendering
- **On tenant migration**: Full SSO and permissions re-validation
