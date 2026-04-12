---
name: evaluate-copilot-studio-bot
description: "Evaluate Copilot Studio Bot — test intent recognition, resolution rate, CSAT, conversation turns, fallback rate, topic coverage. Use when: evaluate, test."
---

# Evaluate Copilot Studio Bot

## When to Use
- Evaluate bot conversation quality and resolution rate
- Measure intent recognition accuracy across topics
- Track CSAT and user satisfaction metrics
- Validate fallback and escalation behavior
- Gate releases with quality thresholds

## Quality Metrics & Targets

| Metric | Target | Source |
|--------|--------|--------|
| Topic trigger accuracy | ≥ 90% | Test utterance matching |
| Resolution rate | ≥ 65% | Conversations resolved without escalation |
| CSAT score | ≥ 4.0/5.0 | Post-conversation survey |
| Avg conversation turns | < 5 | Turn count per resolved conversation |
| Fallback rate | < 20% | Conversations hitting no-topic-match |
| Knowledge answer relevance | ≥ 0.8 | Generative answer grounding score |
| Escalation rate | < 25% | Human handoff count |
| Abandonment rate | < 15% | Conversations user left mid-flow |

## Step 1: Prepare Test Utterances
Create a test matrix covering all topics:
```json
{"topic": "password_reset", "utterance": "I forgot my password", "expected_topic": "PasswordReset"}
{"topic": "password_reset", "utterance": "Can't log in to my account", "expected_topic": "PasswordReset"}
{"topic": "leave_request", "utterance": "I want to take PTO next week", "expected_topic": "LeaveRequest"}
{"topic": "fallback", "utterance": "What's the weather like?", "expected_topic": "Fallback"}
```
Minimum: 10 test utterances per topic, 5 known fallback scenarios.

## Step 2: Test Topic Trigger Accuracy
- Submit each test utterance to the bot
- Compare triggered topic vs expected topic
- Calculate per-topic precision and recall
- Identify cross-topic confusion (similar trigger phrases)

## Step 3: Evaluate Resolution Rate
- Run 50+ test conversations through full flows
- Track which conversations complete their intended action
- Measure per-topic resolution rate
- Identify topics with consistently low resolution

## Step 4: Evaluate Knowledge Source Quality
- Test generative answers against known FAQ questions
- Measure grounding score (are answers sourced from knowledge?)
- Check for hallucinated information
- Verify citations link to correct source documents

## Step 5: Test Edge Cases
- **Typos/misspellings**: "pasword reset" → should still trigger PasswordReset
- **Multi-intent**: "Reset password and check leave balance" → handle gracefully
- **Profanity/abuse**: Should trigger content moderation
- **Off-topic**: "Tell me a joke" → graceful fallback or redirect
- **Repeated requests**: Same question 3x → should escalate

## Step 6: Generate Quality Report
Review Copilot Studio Analytics dashboard:
- Session analytics (volume, trends)
- Topic performance (trigger rate, resolution, abandonment)
- Customer satisfaction trends
- Knowledge source hit rates

### Quality Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Publish to production channel |
| Trigger accuracy < 85% | Add more trigger phrases, deduplicate |
| Resolution < 55% | Simplify conversation flows, improve actions |
| Fallback > 30% | Add more topics or expand knowledge sources |
| CSAT < 3.5 | Review conversation transcripts for UX issues |

## Common Failure Patterns

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Wrong topic fires | Overlapping trigger phrases | Unique triggers per topic |
| Bot loops in topic | Missing exit condition | Add "anything else?" + exit node |
| Knowledge hallucination | No grounding instruction | Configure "answer only from content" |
| Always falls back | Too few trigger phrases | Add 8-10 diverse phrases per topic |
| Auth flow breaks | Token expiry not handled | Add token refresh logic |
| Action fails silently | Power Automate error not surfaced | Add error handling in flow |

## Evaluation Cadence
- **Pre-publish**: Full test suite on all topics + knowledge
- **Weekly**: Review analytics dashboard, identify trending failures
- **Monthly**: Expand test utterances with real user queries
- **On topic change**: Re-test affected topic + related topics

## CI/CD Integration
Before publishing to production channel:
```
1. Export bot solution from dev environment
2. Run test utterance suite against staging bot
3. Verify all quality gates pass
4. Import solution to production environment
5. Publish to production channels
6. Monitor analytics for 24h post-publish
7. Roll back if any metric drops > 10%
```
