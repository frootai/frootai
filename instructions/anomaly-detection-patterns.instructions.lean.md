---
description: "Play 20 patterns — Anomaly detection patterns — streaming analytics, statistical thresholds, ML models, alert routing."
applyTo: "**/*.py"
waf:
  - "reliability"
  - "security"
---

# Play 20 — Real-Time Anomaly Detection — FAI Standards

## Streaming Ingestion & Sliding Window

Ingest from Event Hubs or Kafka into a sliding window buffer. Window size and slide interval come from config — never hardcode temporal parameters.

```python
from azure.eventhub.aio import EventHubConsumerClient
from azure.identity.aio import DefaultAzureCredential
from collections import deque
import json, time

config = json.load(open("config/anomaly.json"))
WINDOW_SIZE = config["sliding_window_seconds"]     # e.g. 300
SLIDE_INTERVAL = config["slide_interval_seconds"]  # e.g. 30

class SlidingWindowBuffer:
    def __init__(self, window_seconds: int):
        self.buffer: deque[tuple[float, dict]] = deque()
        self.window_seconds = window_seconds

    def add(self, timestamp: float, record: dict) -> None:
        self.buffer.append((timestamp, record))
        self._evict(timestamp)

    def _evict(self, now: float) -> None:
        cutoff = now - self.window_seconds
        while self.buffer and self.buffer[0][0] < cutoff:
            self.buffer.popleft()

    def snapshot(self) -> list[dict]:
        return [rec for _, rec in self.buffer]

async def consume_stream(buffer: SlidingWindowBuffer) -> None:
    credential = DefaultAzureCredential()
    client = EventHubConsumerClient(
        fully_qualified_namespace=config["eventhub_namespace"],
        eventhub_name=config["eventhub_name"],
        consumer_group="$Default",
        credential=credential,
    )
    async with client:
        async def on_event(partition_context, event):
            ts = event.enqueued_time.timestamp()
            payload = json.loads(event.body_as_str())
            buffer.add(ts, payload)
            await partition_context.update_checkpoint(event)
        await client.receive(on_event=on_event, starting_position="-1")
```

## Feature Engineering for Time Series

Extract statistical features per window before feeding to the detector. Raw values without feature engineering produce noisy detections.

```python
import numpy as np
from dataclasses import dataclass

@dataclass
class WindowFeatures:
    mean: float; std: float; p95: float; p99: float
    slope: float; zero_crossing_rate: float; entropy: float

def extract_features(values: list[float]) -> WindowFeatures:
    arr = np.array(values)
    diffs = np.diff(arr)
    zero_crossings = np.sum(np.diff(np.sign(diffs)) != 0) / max(len(diffs), 1)
    hist, _ = np.histogram(arr, bins=20, density=True)
    hist = hist[hist > 0]
    entropy = -np.sum(hist * np.log2(hist))
    coeffs = np.polyfit(range(len(arr)), arr, 1) if len(arr) > 1 else [0.0]
    return WindowFeatures(
        mean=float(np.mean(arr)), std=float(np.std(arr)),
        p95=float(np.percentile(arr, 95)), p99=float(np.percentile(arr, 99)),
        slope=float(coeffs[0]), zero_crossing_rate=float(zero_crossings),
        entropy=float(entropy),
    )
```

## Azure Anomaly Detector — Univariate & Multivariate

Use univariate for single-metric monitoring (CPU, latency). Switch to multivariate when correlating 2+ signals (CPU + memory + disk IO).

```python
from azure.ai.anomalydetector import AnomalyDetectorClient
from azure.ai.anomalydetector.models import (
    UnivariateDetectionOptions, TimeSeriesPoint,
    MultivariateDetectionOptions, ModelInfo,
)
from azure.identity import DefaultAzureCredential
from datetime import datetime, timezone

credential = DefaultAzureCredential()
client = AnomalyDetectorClient(
    endpoint=config["anomaly_detector_endpoint"], credential=credential
)

def detect_univariate(timestamps: list[str], values: list[float]) -> list[dict]:
    series = [TimeSeriesPoint(timestamp=t, value=v) for t, v in zip(timestamps, values)]
    options = UnivariateDetectionOptions(
        series=series,
        granularity=config.get("granularity", "minutely"),
        sensitivity=config.get("sensitivity", 85),            # 0-99, higher = more sensitive
        custom_interval=config.get("custom_interval_minutes"),
    )
    result = client.detect_univariate_entire_series(options)
    anomalies = []
    for i, is_anomaly in enumerate(result.is_anomaly):
        if is_anomaly:
            anomalies.append({
                "timestamp": timestamps[i], "value": values[i],
                "expected": result.expected_values[i],
                "upper": result.upper_margins[i], "lower": result.lower_margins[i],
                "severity": result.severity[i] if result.severity else None,
            })
    return anomalies
```

## Threshold Tuning & Feedback Loop

Sensitivity and anomaly fraction are the two most impactful knobs. Store analyst feedback to retrain.

```python
from enum import Enum

class Verdict(str, Enum):
    CONFIRMED = "confirmed"
    DISMISSED = "dismissed"
    PENDING = "pending"

def record_feedback(anomaly_id: str, verdict: Verdict, analyst: str, db) -> None:
    """Analyst confirms or dismisses — feeds retraining pipeline."""
    db.execute(
        "UPDATE anomalies SET verdict=?, reviewed_by=?, reviewed_at=NOW() WHERE id=?",
        (verdict.value, analyst, anomaly_id),
    )

def compute_precision(db) -> dict:
    """Track precision to auto-adjust sensitivity when false positive rate > threshold."""
    rows = db.execute(
        "SELECT verdict, COUNT(*) as cnt FROM anomalies "
        "WHERE reviewed_at > DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY verdict"
    ).fetchall()
    counts = {r["verdict"]: r["cnt"] for r in rows}
    confirmed = counts.get("confirmed", 0)
    dismissed = counts.get("dismissed", 0)
    total = confirmed + dismissed
    precision = confirmed / total if total > 0 else 0.0
    return {"precision_7d": precision, "confirmed": confirmed, "dismissed": dismissed}

def auto_tune_sensitivity(current: int, precision: float) -> int:
    """If precision < 0.7, reduce sensitivity (fewer alerts). If > 0.95, increase."""
    if precision < 0.7 and current > 50:
        return current - 5
    if precision > 0.95 and current < 95:
        return current + 3
    return current
```

## Alert Correlation & Root Cause

Group concurrent anomalies within a time window to avoid alert storms. Attach root cause candidates.

```python
from itertools import groupby
from datetime import timedelta

def correlate_alerts(anomalies: list[dict], window_minutes: int = 5) -> list[dict]:
    sorted_a = sorted(anomalies, key=lambda a: a["timestamp"])
    groups = []
    current_group = []
    for a in sorted_a:
        if not current_group:
            current_group.append(a)
        elif (a["timestamp"] - current_group[-1]["timestamp"]).total_seconds() <= window_minutes * 60:
            current_group.append(a)
        else:
            groups.append(_summarize_group(current_group))
            current_group = [a]
    if current_group:
        groups.append(_summarize_group(current_group))
    return groups

def _summarize_group(group: list[dict]) -> dict:
    metrics = list({a["metric"] for a in group})
    return {
        "start": group[0]["timestamp"], "end": group[-1]["timestamp"],
        "count": len(group), "affected_metrics": metrics,
        "root_cause_candidates": _rank_causes(metrics),
        "severity": max(a.get("severity", 0) for a in group),
    }

def _rank_causes(metrics: list[str]) -> list[str]:
    """Heuristic: infrastructure metrics appearing together suggest shared root cause."""
    infra = {"cpu", "memory", "disk_io", "network_bytes"}
    if infra.intersection(set(metrics)):
        return ["resource_exhaustion", "noisy_neighbor", "scaling_event"]
    return ["application_regression", "upstream_dependency"]
```

## Batch vs Real-Time Detection Modes

Run real-time on the streaming path. Run batch nightly for drift detection and model retraining.

```python
import asyncio

async def realtime_loop(buffer: SlidingWindowBuffer, detector) -> None:
    while True:
        snapshot = buffer.snapshot()
        if len(snapshot) >= config["min_window_points"]:
            values = [s["value"] for s in snapshot]
            timestamps = [s["timestamp"] for s in snapshot]
            anomalies = detector.detect_last_point(timestamps, values)
            if anomalies:
                await route_alert(anomalies)
        await asyncio.sleep(config["slide_interval_seconds"])

def batch_detect(db, detector) -> dict:
    """Nightly batch: full-series detection, retraining on confirmed feedback."""
    series = db.execute(
        "SELECT timestamp, value FROM metrics WHERE timestamp > DATE_SUB(NOW(), INTERVAL 30 DAY)"
    ).fetchall()
    anomalies = detector.detect_entire_series(series)
    confirmed = db.execute(
        "SELECT * FROM anomalies WHERE verdict='confirmed' AND reviewed_at > DATE_SUB(NOW(), INTERVAL 30 DAY)"
    ).fetchall()
    if len(confirmed) >= config.get("min_retrain_samples", 50):
        detector.retrain(confirmed_anomalies=confirmed)
    return {"detected": len(anomalies), "retrain_samples": len(confirmed)}
```

## Integration — Azure Monitor, PagerDuty, Grafana

```python
import httpx

async def route_alert(anomalies: list[dict]) -> None:
    severity = max(a.get("severity", 0) for a in anomalies)
    payload = {"anomalies": anomalies, "severity": severity}
    async with httpx.AsyncClient() as http:
        # Azure Monitor custom metrics
        await http.post(config["azure_monitor_ingestion_url"], json=payload,
                        headers={"Authorization": f"Bearer {get_token()}"})
        # PagerDuty for critical
        if severity >= config.get("pagerduty_threshold", 0.8):
            await http.post("https://events.pagerduty.com/v2/enqueue", json={
                "routing_key": config["pagerduty_routing_key"],
                "event_action": "trigger",
                "payload": {"summary": f"{len(anomalies)} correlated anomalies",
                            "severity": "critical", "source": "fai-anomaly-detector"},
            })
        # Grafana annotation for dashboards
        await http.post(f"{config['grafana_url']}/api/annotations", json={
            "text": f"Anomaly cluster: {len(anomalies)} points",
            "tags": ["anomaly", "auto-detected"],
        }, headers={"Authorization": f"Bearer {config['grafana_api_key']}"})
```

## Anti-Patterns

- ❌ Fixed thresholds without feedback — precision degrades within weeks as data distribution shifts
- ❌ Alerting on every anomaly individually — creates alert storms; always correlate first
- ❌ Skipping feature engineering — raw values produce 3-5x more false positives than windowed features
- ❌ Univariate detection on correlated metrics — use multivariate when metrics share root causes
- ❌ No batch retraining — models trained once go stale; retrain on confirmed anomalies monthly minimum
- ❌ Logging raw metric values without aggregation — storage costs explode; log window summaries
- ❌ Hardcoding sensitivity — must be tunable per metric and auto-adjustable from feedback precision
- ❌ Ignoring dismissed anomalies — they are negative training signal; feed them back to reduce FP rate

## WAF Alignment

| Pillar | Play 20 Implementation |
| --- | --- |
| **Reliability** | Sliding window buffers survive transient Event Hub disconnects; checkpoint after processing; circuit breaker on Anomaly Detector API; batch mode as fallback when streaming degrades |
| **Security** | `DefaultAzureCredential` for all Azure services; PagerDuty routing key from Key Vault; Grafana tokens rotated via Key Vault; no metric data in logs — only anomaly summaries |
| **Cost Optimization** | Univariate API for single metrics (cheaper); multivariate only when correlation needed; batch detection runs off-peak; sensitivity tuning reduces false alerts → less analyst time |
| **Operational Excellence** | Feedback loop tracks precision weekly; auto-tune sensitivity from analyst verdicts; Grafana dashboards with anomaly annotations; PagerDuty integration for critical severity |
| **Performance Efficiency** | Sliding window with deque O(1) append/evict; feature extraction vectorized with NumPy; async Event Hub consumer; parallel alert routing with httpx |
| **Responsible AI** | Analyst-in-the-loop confirms/dismisses before retraining; no automated actions without human review threshold; audit trail of all verdicts with reviewer identity |

### Operational Excellence
- Structured JSON logging with Application Insights + correlation IDs
- Custom metrics: latency p50/p95/p99, token usage, quality scores
- Automated Bicep deployment via GitHub Actions (staging → prod)
- Feature flags for gradual rollout, incident runbooks
