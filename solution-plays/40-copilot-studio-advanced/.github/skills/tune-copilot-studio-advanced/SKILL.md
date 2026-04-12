---
name: "tune-copilot-studio-advanced"
description: "Tune Copilot Studio Advanced configuration — plugin latency, conversation context, Graph query efficiency, adaptive card templates, cost optimization."
---

# Tune Copilot Studio Advanced

## Prerequisites

- Deployed Copilot Studio Advanced bot with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`
- Copilot Studio admin portal access for topic and plugin tuning
- Evaluation baseline from `evaluate-copilot-studio-advanced` skill

## Step 1: Tune Declarative Agent Instructions

### Agent Behavior Configuration
```markdown
<!-- instructions.md — loaded via $[file](instructions.md) -->
# Enterprise Assistant Instructions

## Identity
You are the Enterprise Assistant for Contoso. You help employees with incidents,
project tracking, policy questions, and team collaboration.

## Behavior Rules
1. Always greet by name when SSO provides identity
2. Prefer Graph-grounded answers over general knowledge
3. When uncertain, ask clarifying questions before calling plugins
4. Show incidents as adaptive cards, not plain text
5. Escalate to Power Automate for approval workflows

## Plugin Routing
- Incident questions → EnterpriseOps.listIncidents / .createIncident
- Task questions → Planner integration
- Policy questions → Graph connector (SharePoint)
- Calendar → Graph connector (Outlook)

## Guardrails
- Never disclose other users' PII
- Never perform bulk operations without confirmation
- Always cite sources for policy answers
```

Tuning levers:
| Instruction Change | Impact |
|-------------------|--------|
| Add few-shot examples | +10-15% plugin routing accuracy |
| Explicit routing rules | Reduces fallback rate by 20-30% |
| Persona definition | Improves personality consistency score |
| Clarification triggers | Reduces incorrect plugin calls |
| Source citation rules | Improves groundedness score |

## Step 2: Tune Plugin Performance

### API Plugin Optimization
```json
// config/agents.json — plugin configuration
{
  "plugins": {
    "EnterpriseOps": {
      "timeout": 5000,
      "retryCount": 2,
      "retryDelay": 1000,
      "cacheEnabled": true,
      "cacheTTL": 300,
      "batchSize": 20,
      "responseMapping": "adaptive-card"
    }
  },
  "pluginRouting": {
    "confidenceThreshold": 0.75,
    "fallbackBehavior": "ask-clarification",
    "maxPluginsPerTurn": 2
  }
}
```

Tuning levers:
| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| `timeout` | 5000ms | 2000-15000 | Higher = more reliable, slower UX |
| `retryCount` | 2 | 0-5 | More retries = higher reliability, higher latency |
| `cacheTTL` | 300s | 60-3600 | Higher = faster responses, staler data |
| `confidenceThreshold` | 0.75 | 0.5-0.95 | Higher = fewer false triggers, more fallbacks |
| `maxPluginsPerTurn` | 2 | 1-5 | More = complex responses, higher latency |
| `batchSize` | 20 | 5-100 | Higher = fewer API calls, larger payloads |

### OpenAPI Schema Optimization
```yaml
# Improve function descriptions for better routing
/incidents:
  get:
    operationId: listIncidents
    summary: "List incidents by status. Use when user asks about bugs, issues, tickets, or problems."
    # Add semantic hints for Copilot routing:
    x-copilot-hints:
      - "show me open bugs"
      - "what incidents are critical"
      - "any unresolved issues"
```

## Step 3: Tune Graph Grounding

### Graph Connector Configuration
```json
// config/graph-connectors.json
{
  "connections": {
    "sharepoint-knowledge-base": {
      "searchSchema": {
        "searchableProperties": ["title", "content", "keywords"],
        "retrievableProperties": ["title", "content", "url", "lastModified"],
        "resultTemplateId": "sharepoint-result"
      },
      "ingestionConfig": {
        "crawlSchedule": "daily",
        "includeAttachments": true,
        "maxFileSize": "10MB",
        "excludePatterns": ["*.tmp", "~*"]
      }
    }
  },
  "groundingConfig": {
    "maxResults": 5,
    "minRelevanceScore": 0.7,
    "citationStyle": "inline",
    "freshnessWeight": 0.2
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `maxResults` | 5 | More = broader context, higher cost |
| `minRelevanceScore` | 0.7 | Higher = fewer but more precise results |
| `citationStyle` | inline | "footnote" for cleaner responses |
| `freshnessWeight` | 0.2 | Higher = prefer recent documents |
| `crawlSchedule` | daily | "hourly" for frequently updated content |

## Step 4: Tune Conversation Context

### Context Window Management
```json
// config/openai.json
{
  "model": "gpt-4o",
  "temperature": 0.2,
  "maxTokens": 2048,
  "topP": 0.95,
  "conversationContext": {
    "maxTurns": 10,
    "summarizeAfter": 5,
    "includeSystemContext": true,
    "contextPriority": ["plugin-results", "graph-grounding", "conversation-history"]
  },
  "topicDetection": {
    "enabled": true,
    "switchThreshold": 0.6,
    "preservePreviousTopic": true
  }
}
```

Tuning levers:
| Parameter | Default | When to Adjust |
|-----------|---------|---------------|
| `temperature` | 0.2 | Lower for factual, higher for creative conversations |
| `maxTurns` | 10 | Increase for complex multi-step workflows |
| `summarizeAfter` | 5 | Lower to save tokens in long conversations |
| `contextPriority` | plugin→graph→history | Reorder based on most common conversation patterns |
| `switchThreshold` | 0.6 | Lower = more aggressive topic detection |

## Step 5: Tune Adaptive Card Templates

```json
// config/card-templates.json
{
  "incident-card": {
    "version": "1.5",
    "colorCoding": {
      "critical": "#d13438",
      "high": "#f7630c",
      "medium": "#fce100",
      "low": "#107c10"
    },
    "maxItemsPerCard": 5,
    "showActions": true,
    "compactMode": false
  },
  "summary-card": {
    "maxLength": 500,
    "showMetadata": true,
    "includeLinks": true
  }
}
```

Card optimization:
| Adjustment | Effect |
|-----------|--------|
| `maxItemsPerCard: 3` | Cleaner display, faster rendering |
| `compactMode: true` | Saves vertical space in Teams |
| `showActions: false` | Simpler cards for read-only responses |
| Color coding by severity | Instant visual priority assessment |

## Step 6: Tune Admin Controls

```json
// config/guardrails.json
{
  "admin": {
    "allowedDomains": ["contoso.com"],
    "blockedUsers": [],
    "maxDailyConversations": 1000,
    "maxTurnsPerConversation": 50,
    "auditLogging": true,
    "dataRetention": 90
  },
  "content": {
    "groundednessMin": 0.85,
    "coherenceMin": 0.80,
    "relevanceMin": 0.80,
    "safety": {
      "blockHarmful": true,
      "blockPII": true,
      "moderationLevel": "strict"
    }
  },
  "performance": {
    "latencyP95": 3000,
    "pluginTimeout": 5000,
    "maxConcurrentSessions": 100
  }
}
```

## Step 7: Cost Optimization

```python
# Copilot Studio Advanced cost breakdown per session:
# - Copilot Studio messages: included in M365 Copilot license
# - Azure OpenAI (orchestration): ~$0.02/turn (gpt-4o)  
# - Graph API calls: free (within rate limits)
# - Plugin API calls: depends on backend hosting
# - Total: ~$0.10-0.30 per conversation (5-15 turns)

# Cost reduction strategies:
# 1. Use gpt-4o-mini for simple routing (save 90% per turn)
# 2. Cache Graph results (reduce API calls by 40%)
# 3. Batch plugin calls (fewer round trips)
# 4. Summarize conversation after 5 turns (reduce context tokens)
# 5. Use Copilot Studio built-in topic routing (bypasses LLM for known intents)
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| gpt-4o-mini for routing | ~90% per routing decision | Slightly lower intent accuracy |
| Graph result caching | ~40% Graph API calls | Data freshness delay (5min) |
| Conversation summarization | ~30% token cost | May lose fine details |
| Topic routing bypass | ~50% for known intents | Requires predefined topics |
| Response caching | ~60% for FAQ-type queries | Stale answers risk |

## Step 8: Verify Tuning Impact

```bash
# Re-run full evaluation suite
python evaluation/eval_plugins.py --test-data evaluation/data/
python evaluation/eval_grounding.py --test-data evaluation/data/ --judge-model gpt-4o
python evaluation/eval_conversation.py --test-data evaluation/data/
python evaluation/eval_cards.py --test-data evaluation/data/
python evaluation/eval_auth.py --bot-endpoint $BOT_ENDPOINT

# Compare metrics before/after tuning
python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements after tuning:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Plugin routing accuracy | baseline | +5-10% | > 92% |
| Groundedness | baseline | +0.05 | > 0.85 |
| Context retention | baseline | +10-15% | > 90% |
| Adaptive card rendering | baseline | +2-3% | > 99% |
| Cost per conversation | ~$0.30 | ~$0.10-0.15 | < $0.25 |
| Latency p95 | baseline | -20-30% | < 3000ms |
