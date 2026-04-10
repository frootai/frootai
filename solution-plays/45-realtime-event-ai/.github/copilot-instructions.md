---
description: "Real-Time Event AI domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Real-Time Event AI — Domain Knowledge

This workspace implements real-time event-driven AI — processing streaming events (IoT, clickstream, transactions) with AI enrichment, anomaly detection, pattern recognition, and real-time alerting.

## Event AI Architecture (What the Model Gets Wrong)

### Event Processing Pipeline
```python
from azure.eventhub import EventHubConsumerClient

async def process_events(partition_context, events):
    for event in events:
        data = json.loads(event.body_as_str())
        
        # 1. AI enrichment (classification, entity extraction)
        enriched = await enrich_event(data)
        
        # 2. Anomaly detection (real-time scoring)
        anomaly_score = await detect_anomaly(enriched)
        
        # 3. Pattern matching (complex event processing)
        patterns = match_patterns(enriched, pattern_rules)
        
        # 4. Action (alert, store, trigger downstream)
        if anomaly_score > 0.8:
            await send_alert(enriched, anomaly_score)
        await store_event(enriched)
    
    await partition_context.update_checkpoint()

client = EventHubConsumerClient.from_connection_string(conn_str, consumer_group="$Default", eventhub_name="events")
client.receive(on_event_batch=process_events)
```

### LLM for Event Enrichment (Batch, Not Per-Event)
```python
# WRONG — LLM call per event (expensive, slow at 10K events/sec)
for event in events:
    enriched = await llm.classify(event)  # 10K API calls!

# CORRECT — batch enrichment or rule-based with LLM fallback
async def enrich_batch(events: list, batch_size: int = 50) -> list:
    # Rule-based for common patterns (free, instant)
    rule_enriched = [apply_rules(e) for e in events]
    
    # LLM only for unclassified events (< 5% of total)
    unclassified = [e for e in rule_enriched if e.classification == "unknown"]
    if unclassified:
        llm_results = await llm.batch_classify(unclassified[:batch_size])
        merge(rule_enriched, llm_results)
    
    return rule_enriched
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| LLM per event | 10K events/sec × $0.005/call = $50/sec | Rule-based first, LLM for unknowns only |
| No checkpointing | Events reprocessed on failure | `update_checkpoint()` after each batch |
| Synchronous processing | Can't keep up with event volume | Async consumer with partitioned processing |
| No backpressure | Consumer overwhelmed at peak | Buffer + rate limit + auto-scale consumers |
| Static anomaly thresholds | Too many false positives | Adaptive thresholds based on rolling baseline |
| No event deduplication | Same event processed multiple times | Idempotency key (event ID + timestamp hash) |
| No dead letter queue | Failed events lost | DLQ + retry with exponential backoff |
| Alert fatigue | Too many alerts | Aggregate related alerts, batch notification |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | Enrichment model, batch size, temperature=0 |
| `config/guardrails.json` | Anomaly thresholds, alert cooldown, DLQ settings |
| `config/agents.json` | Consumer groups, partitions, checkpoint interval |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement event pipeline, anomaly detection, pattern matching |
| `@reviewer` | Audit throughput, checkpointing, deduplication, alert quality |
| `@tuner` | Optimize batch size, anomaly thresholds, LLM usage ratio |

## Slash Commands
`/deploy` — Deploy event pipeline | `/test` — Simulate events | `/review` — Audit processing | `/evaluate` — Measure throughput + accuracy
