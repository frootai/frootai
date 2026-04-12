---
name: "deploy-telecom-fraud-shield"
description: "Deploy Telecom Fraud Shield — SIM swap detection, IRSF blocking, Wangiri pattern engine, subscription fraud, real-time CDR anomaly scoring."
---

# Deploy Telecom Fraud Shield

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- CDR feed (Call Detail Records) from network switches
- Python 3.11+ with `azure-openai`, `azure-eventhub`, `scikit-learn`

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-fraud-shield \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Event Hubs | Real-time CDR ingestion (millions/sec) | Standard (2+ TUs) |
| Azure Stream Analytics | Real-time rule engine for velocity + pattern detection | Standard |
| Azure ML | Anomaly detection model serving | Managed endpoint |
| Azure OpenAI | Fraud investigation report generation | S0 |
| Cosmos DB | Subscriber profiles, fraud cases, IRSF ranges | Serverless |
| Azure Functions | Alert routing + blocking API calls | Consumption |
| Azure Redis Cache | Subscriber velocity counters (calls/min) | C1 |
| Container Apps | Fraud dashboard + investigation API | Consumption |

## Step 2: Deploy CDR Ingestion Pipeline

```python
# CDR schema (per call/SMS/data)
CDR_SCHEMA = {
    "cdr_id": str,
    "timestamp": str,
    "subscriber_id": str,           # MSISDN or IMSI
    "call_type": str,               # "voice_outgoing", "voice_incoming", "sms", "data"
    "destination": str,             # Called number or destination
    "duration_sec": int,
    "cell_id": str,                 # Cell tower serving the call
    "imei": str,                    # Device identifier
    "roaming": bool,
    "charge_amount": float
}

# Ingest via Event Hubs (partitioned by subscriber_id for ordering)
# Stream Analytics processes in real-time with 3-second tumbling windows
```

## Step 3: Deploy SIM Swap Detection

```python
async def detect_sim_swap(subscriber_id: str, cdr: CDR) -> bool:
    """Detect SIM swap: new IMEI + location change + high-value activity."""
    profile = await get_subscriber_profile(subscriber_id)
    
    SIM_SWAP_INDICATORS = {
        "new_imei": cdr.imei != profile.last_known_imei,
        "location_jump": geo_distance(cdr.cell_id, profile.last_cell_id) > 100,  # >100km
        "high_value_calls": cdr.charge_amount > profile.avg_charge * 5,
        "premium_numbers": cdr.destination in premium_number_ranges,
        "time_since_last_activity": (now() - profile.last_activity) > timedelta(hours=24)
    }
    
    # Require 3+ indicators for SIM swap alert
    indicator_count = sum(SIM_SWAP_INDICATORS.values())
    
    if indicator_count >= 3:
        await block_subscriber(subscriber_id, reason="sim_swap_suspected")
        await create_fraud_case(subscriber_id, "sim_swap", SIM_SWAP_INDICATORS)
        return True
    return False
```

## Step 4: Deploy IRSF Detection

```python
# International Revenue Sharing Fraud
# Pattern: Fraudster routes calls to premium-rate numbers in specific countries
# They share the revenue with the premium number operator

IRSF_HIGH_RISK_RANGES = {
    # Country code → known IRSF number ranges
    "882": {"risk": "critical", "desc": "International networks"},
    "883": {"risk": "critical", "desc": "International networks"},
    "979": {"risk": "high", "desc": "International premium rate"},
    # Auto-updated from GSMA IRSF database
}

IRSF_RULES = {
    "max_international_calls_per_hour": 10,
    "max_premium_calls_per_day": 3,
    "max_charge_per_call_usd": 50,
    "velocity_window_min": 15,
    "auto_block_on": ["critical_range", "velocity_exceeded"],
    "flag_for_review_on": ["high_range", "unusual_destination"]
}
```

## Step 5: Deploy Wangiri Detection

```python
async def detect_wangiri(subscriber_id: str) -> bool:
    """Detect Wangiri callback fraud pattern.
    Pattern: Many short calls (1-2 rings) to different numbers → victims call back premium number.
    """
    recent_calls = await get_recent_calls(subscriber_id, minutes=30)
    
    WANGIRI_INDICATORS = {
        "short_duration": [c for c in recent_calls if c.duration_sec < 5],
        "unique_destinations": len(set(c.destination for c in recent_calls)),
        "outbound_only": all(c.direction == "outgoing" for c in recent_calls),
        "high_volume": len(recent_calls) > 20  # >20 calls in 30 min
    }
    
    if (len(WANGIRI_INDICATORS["short_duration"]) > 15 and 
        WANGIRI_INDICATORS["unique_destinations"] > 10 and
        WANGIRI_INDICATORS["high_volume"]):
        await flag_for_review(subscriber_id, "wangiri_originator")
        return True
    return False
```

## Step 6: Deploy ML Anomaly Scorer

```python
# Subscriber behavioral baseline + anomaly detection
ANOMALY_FEATURES = [
    "calls_per_day_ratio",      # Today vs 30-day avg
    "unique_destinations_ratio", # New numbers vs baseline
    "international_pct",         # % international vs normal
    "premium_pct",               # % premium rate vs normal
    "avg_duration_ratio",        # Call duration vs baseline
    "time_of_day_unusual",       # Calls at unusual hours
    "new_device",                # IMEI changed
    "roaming_new_country"        # Roaming in new country
]

# Train isolation forest on normal subscriber behavior
from sklearn.ensemble import IsolationForest
model = IsolationForest(contamination=0.01, n_estimators=200, random_state=42)
model.fit(normal_subscriber_features)

# Real-time scoring via Azure ML managed endpoint
async def score_cdr(cdr: CDR) -> float:
    """Score CDR for anomaly (0=normal, 1=highly anomalous)."""
    features = build_anomaly_features(cdr, subscriber_profile)
    score = await ml_endpoint.score(features)
    return score
```

## Step 7: Deploy Velocity Counter (Redis)

```python
# Redis-based velocity tracking (sub-millisecond lookups)
async def check_velocity(subscriber_id: str, cdr: CDR) -> VelocityResult:
    """Track call velocity per subscriber."""
    pipe = redis.pipeline()
    
    # Increment counters with TTL
    keys = {
        f"vel:{subscriber_id}:1m": (60, 5),        # Max 5 calls/minute
        f"vel:{subscriber_id}:15m": (900, 30),      # Max 30 calls/15 min
        f"vel:{subscriber_id}:1h": (3600, 100),     # Max 100 calls/hour
        f"vel:{subscriber_id}:intl:1h": (3600, 10), # Max 10 international/hour
    }
    
    for key, (ttl, limit) in keys.items():
        pipe.incr(key)
        pipe.expire(key, ttl)
    
    results = await pipe.execute()
    
    violations = []
    for (key, (ttl, limit)), count in zip(keys.items(), results[::2]):
        if count > limit:
            violations.append(f"{key}: {count}/{limit}")
    
    return VelocityResult(violations=violations, block=len(violations) > 0)
```

## Step 8: Smoke Test

```bash
# Submit test CDR
curl -s https://api-fraud.azurewebsites.net/api/analyze \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"subscriber_id": "test-001", "destination": "+882001234", "duration_sec": 300}' | jq '.'

# Check subscriber profile
curl -s https://api-fraud.azurewebsites.net/api/profile \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"subscriber_id": "test-001"}' | jq '.risk_score, .velocity'

# Get fraud cases
curl -s https://api-fraud.azurewebsites.net/api/cases \
  -H "Authorization: Bearer $TOKEN" | jq '.cases[:3]'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Too many false positives | Velocity limits too tight | Widen per-subscriber based on historical baseline |
| SIM swap missed | Only checking 2 indicators | Require 2+ (not 3+) for high-value subscribers |
| IRSF numbers not blocked | Range database stale | Auto-update from GSMA IRSF DB weekly |
| Stream Analytics lag | Throughput exceeded | Scale TUs, optimize query windowing |
| Redis velocity counter lost | Redis restart | Use Redis persistence (AOF) |
