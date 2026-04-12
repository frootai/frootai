---
name: "evaluate-digital-twin-agent"
description: "Evaluate Digital Twin Agent quality — NL query accuracy, predictive maintenance RUL precision, twin sync latency, telemetry coverage, graph traversal correctness."
---

# Evaluate Digital Twin Agent

## Prerequisites

- Deployed digital twin (run `deploy-digital-twin-agent` skill first)
- Test queries with expected DTDL translations
- Historical maintenance records for RUL backtesting

## Step 1: Evaluate NL→DTDL Query Accuracy

```bash
python evaluation/eval_queries.py \
  --test-data evaluation/data/queries/ \
  --agent-endpoint $AGENT_ENDPOINT \
  --output evaluation/results/queries.json
```

Query metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Query Correctness** | Generated DTDL parses + returns expected results | > 85% |
| **Property Name Accuracy** | Uses correct twin property names | > 95% |
| **Relationship Traversal** | Correctly follows twin graph links | > 80% |
| **Filter Accuracy** | WHERE conditions match intent | > 85% |
| **Query Latency** | NL→DTDL→results time | < 3s |

Query test categories:
| Category | Examples | Challenge |
|----------|---------|----------|
| Simple property | "Status of machine M-001" | Direct lookup |
| Threshold filter | "Machines above 80°C" | Numeric comparison |
| Relationship | "All machines on Floor 1" | JOIN query |
| Aggregation | "Average temperature per floor" | GROUP BY |
| Multi-hop | "Machines in Building A, Floor 2" | Nested relationships |

## Step 2: Evaluate Predictive Maintenance

```bash
python evaluation/eval_rul.py \
  --test-data evaluation/data/maintenance/ \
  --output evaluation/results/rul.json
```

RUL metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **MAE (days)** | Mean absolute error of RUL prediction | < 5 days |
| **Critical Detection** | Machines failing within 7 days correctly flagged | > 90% |
| **False Alarm Rate** | Healthy machines flagged for maintenance | < 10% |
| **Explanation Quality** (LLM judge) | Actionable, accurate explanation | > 4.0/5.0 |
| **Feature Importance** | Top factors match known failure modes | > 80% |

## Step 3: Evaluate Twin Synchronization

```bash
python evaluation/eval_sync.py \
  --output evaluation/results/sync.json
```

Sync metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Sync Latency** | IoT message → twin property update | < 5s |
| **Update Success Rate** | Twin updates without error | > 99.5% |
| **Telemetry Coverage** | Sensors sending data / total sensors | > 95% |
| **Data Freshness** | Time since last update per twin | < 60s |
| **Graph Consistency** | Relationships match physical reality | 100% |

## Step 4: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md
```

## Step 5: Evaluate Graph Traversal

```bash
python evaluation/eval_graph.py \
  --test-data evaluation/data/graph/ \
  --output evaluation/results/graph.json
```

Graph traversal metrics:
| Metric | Description | Target |
|--------|-------------|--------|
| **Relationship Accuracy** | Correct twin relationships found | > 95% |
| **Multi-hop Traversal** | Building→Floor→Machine chain correct | > 85% |
| **Graph Completeness** | All physical relationships modeled | > 90% |
| **Orphan Detection** | Twins without relationships flagged | 100% |

## Step 6: Generate Report

```bash
python evaluation/generate_report.py \
  --results-dir evaluation/results/ \
  --output evaluation/report.md \
  --thresholds config/guardrails.json
```

Report includes:
- NL→DTDL query accuracy breakdown by query type
- RUL prediction error distribution with backtesting results
- Twin sync latency histogram and outlier analysis
- Telemetry coverage heatmap by device/floor
- Graph traversal correctness with failed relationship chains
- Cost breakdown: ADT operations, IoT messages, ADX queries

## Threshold Reference

| Metric | Threshold | Source |
|--------|-----------|--------|
| NL query correctness | > 85% | config/guardrails.json |
| RUL MAE | < 5 days | config/guardrails.json |
| Critical detection | > 90% | config/guardrails.json |
| Sync latency | < 5s | config/guardrails.json |
| Telemetry coverage | > 95% | config/guardrails.json |
| Graph completeness | > 90% | config/guardrails.json |
| Groundedness | > 0.85 | fai-manifest.json |
