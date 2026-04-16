---
name: audit-log-implement
description: "Implement immutable audit logging, PII redaction, and Sentinel monitoring for AI systems — preserve evidence, prove access history, and detect suspicious activity"
---

# Audit Log Implementation

Immutable, append-only audit logging for AI workloads — covering structured event capture, PII redaction, compliance retention, and alerting on anomalous patterns.

## Structured Audit Event Schema

Every audit event must answer five questions: **who**, **what**, **when**, **where**, and **outcome**. Store as JSON with a fixed schema so downstream KQL queries never break.

```python
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4
import json

class AuditOutcome(str, Enum):
    SUCCESS = "success"
    FAILURE = "failure"
    DENIED = "denied"
    ERROR = "error"

@dataclass(frozen=True)
class AuditEvent:
    event_id: str = field(default_factory=lambda: str(uuid4()))
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    # WHO — actor identity (never store raw tokens or passwords)
    actor_id: str = ""           # AAD object ID or service principal
    actor_ip: str = ""           # client IP (redact last octet for GDPR if needed)
    actor_role: str = ""         # RBAC role at time of action
    # WHAT — operation details
    action: str = ""             # e.g. "llm.completion", "document.upload", "config.change"
    resource_type: str = ""      # e.g. "ChatSession", "Document", "Model"
    resource_id: str = ""        # target resource identifier
    detail: dict = field(default_factory=dict)  # action-specific payload (redacted)
    # WHERE — infrastructure context
    service_name: str = ""       # e.g. "fai-api", "fai-indexer"
    environment: str = ""        # dev | staging | prod
    region: str = ""             # Azure region
    correlation_id: str = ""     # distributed trace ID
    # OUTCOME
    outcome: AuditOutcome = AuditOutcome.SUCCESS
    error_code: str = ""
    duration_ms: int = 0

    def to_json(self) -> str:
        return json.dumps(asdict(self), default=str, separators=(",", ":"))
```

## PII Redaction

Redact PII **before** the event reaches storage. Never rely on post-hoc scrubbing — once written to an immutable store, data cannot be deleted within the retention window.

```python
import re

_PII_PATTERNS = {
    "email": re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"),
    "phone": re.compile(r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b"),
    "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "ip_last_octet": re.compile(r"(\d+\.\d+\.\d+\.)\d+"),
}

def redact_pii(value: str, *, keep_ip_prefix: bool = True) -> str:
    """Replace PII tokens with category placeholders."""
    for name, pattern in _PII_PATTERNS.items():
        if name == "ip_last_octet" and keep_ip_prefix:
            value = pattern.sub(r"\g<1>***", value)
        else:
            value = pattern.sub(f"[REDACTED_{name.upper()}]", value)
    return value

def redact_event_detail(detail: dict) -> dict:
    """Deep-redact string values inside the detail payload."""
    return {
        k: redact_pii(v) if isinstance(v, str) else v
        for k, v in detail.items()
    }
```

## Audit Logger — Append-Only Storage

Write to Cosmos DB (NoSQL API) with a TTL matching your retention policy. Cosmos provides millisecond writes, automatic geo-replication, and tamper-evident change feed.

```python
from azure.cosmos.aio import CosmosClient
from azure.identity.aio import DefaultAzureCredential

class AuditLogger:
    """Append-only audit logger backed by Cosmos DB."""

    def __init__(self, endpoint: str, database: str = "audit", container: str = "events"):
        self._credential = DefaultAzureCredential()
        self._client = CosmosClient(endpoint, credential=self._credential)
        self._container = (
            self._client.get_database_client(database)
            .get_container_client(container)
        )

    async def log(self, event: AuditEvent) -> None:
        """Write a single audit event. Immutable — no update/delete exposed."""
        doc = {
            "id": event.event_id,
            "partitionKey": event.service_name,
            **__import__("dataclasses").asdict(event),
            "detail": redact_event_detail(event.detail),
            "ttl": 63_072_000,  # 2 years in seconds (SOC2 minimum)
        }
        await self._container.create_item(body=doc)

    async def close(self) -> None:
        await self._client.close()
        await self._credential.close()
```

Set the Cosmos container with **no delete or replace stored procedures** and enable **Azure RBAC data-plane** with `Cosmos DB Built-in Data Contributor` scoped to the audit database. Disable key-based auth entirely for SOC2 compliance.

## Immutable Archive in Blob Storage

Use Blob Storage with immutability as the secondary evidence archive. Cosmos handles low-latency writes and querying, while Blob provides WORM retention for auditor-facing exports.

```bicep
resource auditStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
    name: 'stfaiaudit${uniqueString(resourceGroup().id)}'
    location: resourceGroup().location
    kind: 'StorageV2'
    sku: {
        name: 'Standard_GRS'
    }
    properties: {
        allowBlobPublicAccess: false
        minimumTlsVersion: 'TLS1_2'
        supportsHttpsTrafficOnly: true
    }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
    parent: auditStorage
    name: 'default'
}

resource auditContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
    parent: blobService
    name: 'audit-archive'
    properties: {
        publicAccess: 'None'
        immutableStorageWithVersioning: {
            enabled: true
        }
    }
}
```

Export daily audit batches from the Cosmos change feed into this container, then apply a time-based retention policy or legal hold for the required compliance window.

## Middleware — Automatic Capture

Wrap your FastAPI endpoints so every request generates an audit event without developer intervention.

```python
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import time

class AuditMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, audit_logger: AuditLogger):
        super().__init__(app)
        self.audit = audit_logger

    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.perf_counter_ns()
        correlation_id = request.headers.get("x-correlation-id", str(uuid4()))
        outcome = AuditOutcome.SUCCESS
        error_code = ""
        try:
            response = await call_next(request)
            if response.status_code >= 400:
                outcome = AuditOutcome.FAILURE
                error_code = str(response.status_code)
            return response
        except Exception as exc:
            outcome = AuditOutcome.ERROR
            error_code = type(exc).__name__
            raise
        finally:
            event = AuditEvent(
                actor_id=request.state.user_id if hasattr(request.state, "user_id") else "anonymous",
                actor_ip=redact_pii(request.client.host) if request.client else "",
                action=f"{request.method} {request.url.path}",
                resource_type="HTTP",
                service_name="fai-api",
                environment=request.app.state.environment,
                correlation_id=correlation_id,
                outcome=outcome,
                error_code=error_code,
                duration_ms=int((time.perf_counter_ns() - start) / 1_000_000),
            )
            await self.audit.log(event)
```

## Compliance Retention Policies

| Standard | Minimum Retention | Key Requirements |
|----------|------------------|------------------|
| SOC 2 Type II | 1 year (recommended 2) | Immutable, tamper-evident, access-controlled |
| HIPAA | 6 years | PHI access logging, encryption at rest (AES-256) |
| GDPR | As short as possible | PII must be redacted pre-storage; right-to-erasure N/A for security logs |
| PCI DSS 4.0 | 1 year online, 1 year archive | Centralized, time-synced, integrity-monitored |

Set Cosmos TTL per compliance tier. For HIPAA workloads, set `ttl: 189_216_000` (6 years). Enable **customer-managed keys** via Azure Key Vault for encryption at rest.

## Querying Audit Logs with KQL

Export audit events from Cosmos change feed → Event Hub → Log Analytics workspace. Query in Azure Monitor:

```kql
// Failed authentication attempts by actor in last 24h
AuditEvents_CL
| where TimeGenerated > ago(24h)
| where outcome_s == "denied" or outcome_s == "failure"
| where action_s has "auth" or action_s has "login"
| summarize FailCount=count() by actor_id_s, actor_ip_s, bin(TimeGenerated, 1h)
| where FailCount > 10
| order by FailCount desc

// LLM usage anomaly — token spend spike per user
AuditEvents_CL
| where action_s == "llm.completion"
| extend tokens = toint(detail_tokens_total_d)
| summarize DailyTokens=sum(tokens) by actor_id_s, bin(TimeGenerated, 1d)
| where DailyTokens > 500000
| order by DailyTokens desc
```

## Alerting on Suspicious Patterns

Create Azure Monitor alert rules for these high-signal detections:

- **Brute-force**: >10 denied outcomes from same `actor_ip` in 5 minutes
- **Privilege escalation**: `config.change` action from a role that is not `admin`
- **Data exfil probe**: >50 `document.download` actions from one actor in 1 hour
- **Model abuse**: Single actor exceeding 500K tokens/day (cost + safety signal)
- **Off-hours access**: Any `actor_role=admin` action between 00:00–06:00 local time

Wire alerts to an Action Group that posts to a PagerDuty/Slack webhook and creates an incident in Azure Sentinel for SOC triage.

## Integration Checklist

1. Provision Cosmos DB container with partition key `/serviceName`, TTL enabled, RBAC-only auth
2. Deploy change feed processor → Event Hub → Log Analytics diagnostic setting
3. Register `AuditMiddleware` in FastAPI `app.add_middleware(AuditMiddleware, audit_logger=logger)`
4. Verify PII redaction with unit tests — assert no raw emails/SSNs in serialized output
5. Create KQL function `AuditEvents_Enriched` joining actor IDs to AAD display names
6. Configure alert rules in Bicep via `Microsoft.Insights/scheduledQueryRules`
7. Configure Microsoft Sentinel analytics rules against the `AuditEvents_CL` table for brute-force, exfiltration, and off-hours admin access
8. Run `az monitor log-analytics query` to validate events flow end-to-end
9. Enable Cosmos backup policy — continuous backup with 30-day PITR for disaster recovery
- [Azure Best Practices](https://learn.microsoft.com/azure/well-architected/)
- [FAI Protocol](https://frootai.dev/fai-protocol)
