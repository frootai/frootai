---
name: "evaluate-copilot-studio-advanced"
description: "Evaluate Copilot Studio Advanced quality — plugin response accuracy, Graph grounding faithfulness, conversation coherence, adaptive card rendering, SSO reliability."
---

# Evaluate Copilot Studio Advanced

## Prerequisites

- Deployed Copilot Studio Advanced bot (run `deploy-copilot-studio-advanced` skill first)
- Test conversation dataset with ground-truth responses
- Python 3.11+ with `azure-ai-evaluation`, `botbuilder-testing` packages
- Access to Copilot Studio analytics dashboard
- Azure OpenAI deployment for LLM-as-judge evaluation

## Step 1: Prepare Evaluation Dataset

```bash
# Structure test conversations
mkdir -p evaluation/data

# Each test case: multi-turn conversation with expected outcomes
# evaluation/data/conversation-001.json
# {
#   "turns": [
#     { "user": "Show me open critical incidents", "expected_action": "listIncidents" },
#     { "user": "Assign the first one to me", "expected_action": "updateIncident" },
#     { "user": "Create a follow-up task", "expected_action": "createPlannerTask" }
#   ],
#   "expected_plugin": "EnterpriseOps",
#   "expected_grounding_source": "sharepoint-knowledge-base",
#   "category": "incident-management"
# }
```

Test dataset requirements:
- Minimum 50 multi-turn conversations
- Cover all plugin functions (CRUD operations)
- Include Graph grounding scenarios (SharePoint, Outlook, Teams)
- Include SSO-dependent flows
- Include edge cases: ambiguous queries, out-of-scope requests, adversarial inputs

## Step 2: Evaluate Plugin Response Accuracy

```bash
python evaluation/eval_plugins.py \
  --test-data evaluation/data/ \
  --bot-endpoint $BOT_ENDPOINT \
  --output evaluation/results/plugins.json
```

Plugin metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Function Routing Accuracy** | Correct plugin function called | > 92% |
| **Parameter Extraction** | Correct params passed to API | > 88% |
| **Response Mapping** | API response correctly formatted | > 95% |
| **Error Handling** | Graceful handling of API failures | > 90% |
| **Fallback Rate** | Conversations falling to generic response | < 10% |

Evaluation breakdown:
1. **Intent detection**: Did the bot correctly identify the user wants a plugin action?
2. **Function selection**: Was the right function called (e.g., `listIncidents` vs `createIncident`)?
3. **Parameter extraction**: Were parameters correctly extracted from natural language?
4. **Response quality**: Was the API response correctly mapped to user-facing output?
5. **Multi-turn context**: Did subsequent turns correctly reference prior context?

## Step 3: Evaluate Graph Grounding Quality

```bash
python evaluation/eval_grounding.py \
  --test-data evaluation/data/ \
  --bot-endpoint $BOT_ENDPOINT \
  --judge-model gpt-4o \
  --output evaluation/results/grounding.json
```

Graph grounding metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Groundedness** | Response based on Graph data, not hallucinated | > 0.85 |
| **Source Attribution** | Correct source referenced | > 90% |
| **Relevance** | Response addresses the user's question | > 0.80 |
| **Freshness** | Data reflects current state (not stale cache) | > 95% |
| **Permission Compliance** | Only surfaces data user has access to | 100% |

Test scenarios for grounding:
- SharePoint: "What's the latest policy on remote work?" → verify references correct document
- Outlook: "Show my meetings today" → verify correct calendar, no unauthorized access
- Teams: "What did the product team discuss last week?" → verify channel access permissions
- Planner: "What tasks are assigned to me?" → verify only user's tasks shown

## Step 4: Evaluate Conversation Coherence

```bash
python evaluation/eval_conversation.py \
  --test-data evaluation/data/ \
  --bot-endpoint $BOT_ENDPOINT \
  --judge-model gpt-4o \
  --output evaluation/results/conversation.json
```

Conversation metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Context Retention** | Remembers previous turns | > 90% (5-turn window) |
| **Topic Switching** | Handles topic changes gracefully | > 85% |
| **Clarification** | Asks clarifying questions appropriately | > 80% |
| **Coherence** (LLM judge) | Logical flow across turns | > 4.0/5.0 |
| **Personality Consistency** | Maintains agent persona | > 4.0/5.0 |

Multi-turn test patterns:
1. **Linear**: Incident → details → assign → close (context chain)
2. **Branch**: Incident → switch to calendar → back to incident (topic recovery)
3. **Correction**: "No, I meant the other one" (reference resolution)
4. **Escalation**: Complex query → Power Automate handoff (graceful transition)

## Step 5: Evaluate Adaptive Card Rendering

```bash
python evaluation/eval_cards.py \
  --test-data evaluation/data/ \
  --bot-endpoint $BOT_ENDPOINT \
  --output evaluation/results/cards.json
```

Adaptive card metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Schema Validity** | Card JSON validates against schema | 100% |
| **Data Binding** | Template variables correctly populated | > 95% |
| **Action Correctness** | Buttons/links point to correct URLs | > 98% |
| **Rendering Success** | Card renders in Teams without errors | > 99% |
| **Accessibility** | Alt text, contrast, keyboard navigation | > 90% |

## Step 6: Evaluate SSO/Auth Reliability

```bash
python evaluation/eval_auth.py \
  --bot-endpoint $BOT_ENDPOINT \
  --output evaluation/results/auth.json
```

Auth metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **SSO Success Rate** | Silent token acquisition succeeds | > 95% |
| **Consent Prompt Rate** | Users prompted for consent | < 5% (after initial) |
| **Token Refresh** | Token refresh without user intervention | > 99% |
| **Permission Enforcement** | Unauthorized access blocked | 100% |
| **Logout/Re-auth** | Session cleanup on sign-out | 100% |

## Step 7: Evaluate Content Safety

```bash
python evaluation/eval_safety.py \
  --test-data evaluation/data/adversarial/ \
  --bot-endpoint $BOT_ENDPOINT \
  --output evaluation/results/safety.json
```

Safety metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Prompt Injection Block** | Jailbreak attempts blocked | > 98% |
| **PII Leakage** | No unauthorized PII in responses | 0 incidents |
| **Content Filter** | Harmful content blocked | > 99% |
| **Data Exfiltration** | No bulk data extraction via conversation | 100% blocked |

## Step 8: Generate Evaluation Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md \
  --thresholds config/guardrails.json \
  --analytics-export copilot-studio-analytics.csv
```

Report structure:
- Executive summary with overall pass/fail
- Per-capability breakdown (plugins, grounding, conversation, cards, auth, safety)
- Worst-performing scenarios with root cause analysis
- Comparison with Copilot Studio built-in analytics
- Cost analysis: tokens per conversation, API calls per session

## Threshold Reference

From `config/guardrails.json`:
| Metric | Threshold | Source |
|--------|-----------|--------|
| Groundedness | 0.85 | fai-manifest.json |
| Coherence | 0.80 | fai-manifest.json |
| Relevance | 0.80 | fai-manifest.json |
| Plugin routing accuracy | > 92% | config/guardrails.json |
| SSO success rate | > 95% | config/guardrails.json |
| Safety | 0 PII incidents | fai-manifest.json |
| Cost per query | < $0.05 | fai-manifest.json |
