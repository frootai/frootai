---
name: "evaluate-realtime-event-ai"
description: "Evaluate Real-Time Event AI quality — throughput, enrichment accuracy, anomaly detection precision/recall, alert quality, checkpoint consistency, processing latency."
---

# Evaluate Real-Time Event AI

## Prerequisites

- Deployed event pipeline (run `deploy-realtime-event-ai` skill first)
- Test event dataset with labeled anomalies and classifications
- Python 3.11+ with `azure-ai-evaluation` package
- Event Hub and consumer accessible

## Step 1: Prepare Evaluation Dataset

```bash
mkdir -p evaluation/data

# Each test stream: events with ground-truth labels
# evaluation/data/stream-001.jsonl
# {"event_id": "e001", "value": 42.5, "device_id": "d1", "label_anomaly": false, "label_class": "normal_reading"}
# {"event_id": "e002", "value": 999.9, "device_id": "d1", "label_anomaly": true, "label_class": "sensor_fault"}
```

Test categories:
- **Normal flow**: 1000 events, all normal (verify no false positives)
- **Anomaly injection**: 100 events with 10 labeled anomalies
- **Burst traffic**: 5000 events in 10 seconds (stress test)
- **Duplicate events**: 100 events with 20 intentional duplicates
- **Malformed events**: 50 events with bad schema (→ DLQ)
- **Mixed classification**: 200 events across 5 categories

## Step 2: Evaluate Throughput

```bash
python evaluation/eval_throughput.py \
  --test-data evaluation/data/ \
  --eventhub-endpoint $EVENTHUB_ENDPOINT \
  --output evaluation/results/throughput.json
```

Throughput metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Events per Second** | Sustained processing rate | > 1000 evt/s |
| **P50 Latency** | Median event-to-enrichment time | < 100ms |
| **P95 Latency** | 95th percentile latency | < 500ms |
| **P99 Latency** | 99th percentile (tail) | < 2000ms |
| **Consumer Lag** | Unprocessed events in queue | < 100 events |
| **Partition Balance** | Even distribution across partitions | < 10% variance |

Throughput by component:
| Component | Latency | Throughput |
|-----------|---------|-----------|
| Event ingestion | < 5ms | > 10K evt/s |
| Rule-based enrichment | < 1ms/event | > 50K evt/s |
| LLM batch enrichment | ~200ms/batch (50 events) | ~250 evt/s |
| Anomaly scoring | < 1ms/event | > 50K evt/s |
| Checkpointing | < 50ms/batch | — |
| **End-to-end** | **< 100ms (P50)** | **> 1K evt/s** |

## Step 3: Evaluate Enrichment Accuracy

```bash
python evaluation/eval_enrichment.py \
  --test-data evaluation/data/ \
  --output evaluation/results/enrichment.json
```

Enrichment metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Rule Classification Accuracy** | Rule-based correct classifications | > 90% |
| **LLM Classification Accuracy** | LLM correct for "unknown" events | > 85% |
| **Overall Classification Accuracy** | Combined rule + LLM | > 92% |
| **LLM Usage Rate** | % of events needing LLM | < 10% |
| **Unknown Rate** | Events that remain unclassified | < 2% |

## Step 4: Evaluate Anomaly Detection

```bash
python evaluation/eval_anomaly.py \
  --test-data evaluation/data/ \
  --output evaluation/results/anomaly.json
```

Anomaly detection metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Precision** | True anomalies / all flagged | > 80% |
| **Recall** | True anomalies found / all true anomalies | > 90% |
| **F1 Score** | Harmonic mean of precision + recall | > 85% |
| **False Positive Rate** | Normal events flagged as anomaly | < 5% |
| **Detection Latency** | Time from anomaly to alert | < 5s |
| **Adaptive Threshold Accuracy** | Threshold correctly adjusts to baseline | > 90% |

Anomaly detection evaluation:
1. **Steady-state baseline**: Run 1000 normal events, verify zero false positives
2. **Single anomaly**: Inject one anomaly, verify detection in <5s
3. **Burst anomalies**: Inject 10 anomalies in 1 second, verify all detected
4. **Gradual drift**: Slowly shift baseline, verify threshold adapts
5. **Seasonal patterns**: Inject periodic patterns, verify not flagged as anomalies

## Step 5: Evaluate Processing Reliability

```bash
python evaluation/eval_reliability.py \
  --test-data evaluation/data/ \
  --output evaluation/results/reliability.json
```

Reliability metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Deduplication Accuracy** | Duplicate events filtered | > 99% |
| **Checkpoint Consistency** | No event loss on consumer restart | 100% |
| **DLQ Routing** | Malformed events sent to DLQ | 100% |
| **At-Least-Once Delivery** | Every event processed ≥1 time | 100% |
| **Scale-up Time** | Time to add consumer replica | < 60s |
| **Recovery Time** | Time to resume after consumer crash | < 30s |

## Step 6: Evaluate Alert Quality

```bash
python evaluation/eval_alerts.py \
  --test-data evaluation/data/ \
  --output evaluation/results/alerts.json
```

Alert metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Alert Precision** | Actionable alerts / total alerts | > 85% |
| **Alert Latency** | Time from anomaly to alert delivery | < 10s |
| **Alert Aggregation** | Related events grouped into one alert | > 90% |
| **Cooldown Compliance** | No duplicate alerts within cooldown | 100% |
| **Alert Channel Delivery** | Alerts reach configured channels | 100% |

## Step 7: Generate Evaluation Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md \
  --thresholds config/guardrails.json
```

Report includes:
- Throughput dashboard with latency percentiles
- Enrichment accuracy: rule-based vs LLM breakdown
- Anomaly detection ROC curve and optimal threshold
- Reliability: checkpoint, dedup, DLQ statistics
- Alert quality: precision, latency, aggregation
- Cost breakdown: LLM calls vs rule-based processing

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| Throughput | > 1000 evt/s | config/guardrails.json |
| P95 latency | < 500ms | config/guardrails.json |
| Anomaly F1 | > 85% | config/guardrails.json |
| Enrichment accuracy | > 92% | config/guardrails.json |
| Deduplication | > 99% | config/guardrails.json |
| Groundedness | > 0.85 | fai-manifest.json |
