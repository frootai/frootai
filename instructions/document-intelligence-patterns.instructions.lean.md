---
description: "Play 06 patterns — Document processing patterns — AI Document Intelligence, table extraction, OCR confidence, structured output."
applyTo: "**/*.py"
waf:
  - "reliability"
  - "security"
---

# Play 06 — Document Intelligence Patterns — FAI Standards

## Document Intelligence Client Setup

```python
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import AnalyzeDocumentRequest, DocumentAnalysisFeature
from azure.identity import DefaultAzureCredential
from azure.core.exceptions import HttpResponseError
import json, hashlib, logging

logger = logging.getLogger("play06")

config = json.load(open("config/document-intelligence.json"))
credential = DefaultAzureCredential()
client = DocumentIntelligenceClient(
    endpoint=config["endpoint"], credential=credential
)
```

## Prebuilt Model Extraction

```python
PREBUILT_MODELS = {
    "invoice": "prebuilt-invoice",
    "receipt": "prebuilt-receipt",
    "id_document": "prebuilt-idDocument",
    "business_card": "prebuilt-businessCard",
    "w2": "prebuilt-tax.us.w2",
    "health_insurance": "prebuilt-healthInsuranceCard.us",
}

async def extract_with_prebuilt(doc_bytes: bytes, doc_type: str, min_confidence: float = 0.7):
    model_id = PREBUILT_MODELS.get(doc_type, "prebuilt-layout")
    poller = await client.begin_analyze_document(
        model_id, AnalyzeDocumentRequest(bytes_source=doc_bytes),
        features=[DocumentAnalysisFeature.BARCODES, DocumentAnalysisFeature.FORMULAS],
    )
    result = await poller.result()
    fields = {}
    low_confidence = []
    for name, field in (result.documents[0].fields or {}).items():
        if field.confidence and field.confidence < min_confidence:
            low_confidence.append({"field": name, "confidence": field.confidence, "value": field.content})
        fields[name] = {"value": field.content, "confidence": field.confidence, "type": field.type}
    if low_confidence:
        logger.warning("low_confidence_fields", extra={"fields": low_confidence, "model": model_id})
    return {"fields": fields, "low_confidence": low_confidence, "model_id": model_id}
```

## Table and Key-Value Extraction

```python
def extract_tables(result) -> list[dict]:
    tables = []
    for table in (result.tables or []):
        rows = {}
        for cell in table.cells:
            rows.setdefault(cell.row_index, {})[cell.column_index] = {
                "content": cell.content, "kind": cell.kind,  # "columnHeader", "rowHeader", "content"
            }
        headers = [rows.get(0, {}).get(c, {}).get("content", f"col_{c}") for c in range(table.column_count)]
        data = [
            {headers[c]: rows[r][c]["content"] for c in range(table.column_count) if c in rows.get(r, {})}
            for r in range(1, table.row_count)
        ]
        tables.append({"headers": headers, "rows": data, "row_count": table.row_count - 1})
    return tables

def extract_kv_pairs(result) -> list[dict]:
    return [
        {"key": kv.key.content, "value": (kv.value.content if kv.value else None),
         "confidence": kv.confidence}
        for kv in (result.key_value_pairs or [])
    ]
```

## Document Classification

```python
async def classify_document(doc_bytes: bytes, classifier_id: str) -> dict:
    poller = await client.begin_classify_document(
        classifier_id, AnalyzeDocumentRequest(bytes_source=doc_bytes)
    )
    result = await poller.result()
    return {
        "doc_type": result.documents[0].doc_type,
        "confidence": result.documents[0].confidence,
        "page_ranges": [(d.bounding_regions[0].page_number, d.bounding_regions[-1].page_number)
                        for d in result.documents if d.bounding_regions],
    }
```

## Multi-Page Batch Processing

```python
import asyncio
from azure.core.exceptions import ServiceRequestError

async def batch_process(files: list[tuple[str, bytes]], model_id: str, max_concurrent: int = 5):
    semaphore = asyncio.Semaphore(max_concurrent)  # DI throttles at ~15 concurrent
    results = {}

    async def _process(name: str, data: bytes):
        async with semaphore:
            for attempt in range(3):
                try:
                    poller = await client.begin_analyze_document(
                        model_id, AnalyzeDocumentRequest(bytes_source=data), pages="1-"
                    )
                    return name, await poller.result()
                except HttpResponseError as e:
                    if e.status_code == 429:
                        await asyncio.sleep(2 ** attempt + 1)
                        continue
                    return name, {"error": str(e), "status": e.status_code}
                except ServiceRequestError:
                    await asyncio.sleep(2 ** attempt)
            return name, {"error": "max_retries_exceeded"}

    tasks = [_process(n, d) for n, d in files]
    for coro in asyncio.as_completed(tasks):
        name, result = await coro
        results[name] = result
        logger.info("batch_doc_processed", extra={"file": name, "success": not isinstance(result, dict)})
    return results
```

## Barcode/QR and Handwriting Extraction

```python
def extract_barcodes(result) -> list[dict]:
    return [
        {"kind": bc.kind, "value": bc.value, "confidence": bc.confidence,
         "page": bc.bounding_regions[0].page_number if bc.bounding_regions else None}
        for page in (result.pages or []) for bc in (page.barcodes or [])
    ]

def extract_handwritten_lines(result) -> list[dict]:
    return [
        {"content": line.content, "confidence": line.confidence(), "page": page.page_number}
        for page in (result.pages or []) for line in (page.lines or [])
        if any(span.confidence < 0.85 for span in (line.spans or []))  # handwritten = lower OCR confidence
    ]
```

## Result Caching and Output Normalization

```python
import redis

cache = redis.Redis.from_url(config.get("redis_url", "redis://localhost:6379"))
CACHE_TTL = config.get("cache_ttl_seconds", 3600)

def get_or_analyze(doc_bytes: bytes, model_id: str):
    doc_hash = hashlib.sha256(doc_bytes).hexdigest()
    cache_key = f"di:{model_id}:{doc_hash}"
    cached = cache.get(cache_key)
    if cached:
        return json.loads(cached)
    result = client.begin_analyze_document(model_id, AnalyzeDocumentRequest(bytes_source=doc_bytes)).result()
    normalized = normalize_result(result)
    cache.setex(cache_key, CACHE_TTL, json.dumps(normalized))
    return normalized

def normalize_result(result) -> dict:
    return {
        "pages": result.pages and len(result.pages),
        "tables": extract_tables(result),
        "kv_pairs": extract_kv_pairs(result),
        "documents": [
            {"doc_type": d.doc_type, "confidence": d.confidence,
             "fields": {k: {"value": v.content, "confidence": v.confidence} for k, v in (d.fields or {}).items()}}
            for d in (result.documents or [])
        ],
        "barcodes": extract_barcodes(result),
        "content_length": len(result.content or ""),
    }
```

## Pre/Post-Processing Pipeline

```python
from PIL import Image
import io

def preprocess_document(doc_bytes: bytes, filename: str) -> bytes:
    if filename.lower().endswith((".png", ".jpg", ".jpeg", ".tiff", ".bmp")):
        img = Image.open(io.BytesIO(doc_bytes))
        if img.mode != "RGB":
            img = img.convert("RGB")
        if max(img.size) > 4096:  # DI max dimension
            img.thumbnail((4096, 4096), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        return buf.getvalue()
    if len(doc_bytes) > 500 * 1024 * 1024:  # 500MB DI limit
        raise ValueError(f"Document exceeds 500MB limit: {len(doc_bytes)} bytes")
    return doc_bytes

def postprocess_fields(fields: dict, rules: dict) -> dict:
    """Apply domain-specific normalization: date formats, currency, phone numbers."""
    for name, field in fields.items():
        if rules.get(name, {}).get("type") == "currency" and field.get("value"):
            field["value"] = field["value"].replace("$", "").replace(",", "").strip()
        if rules.get(name, {}).get("type") == "date" and field.get("value"):
            field["value"] = field["value"].replace("/", "-")  # normalize to ISO-ish
    return fields
```

## Error Handling — Partial Extraction

```python
async def safe_extract(doc_bytes: bytes, model_id: str) -> dict:
    try:
        poller = await client.begin_analyze_document(model_id, AnalyzeDocumentRequest(bytes_source=doc_bytes))
        result = await poller.result()
        return {"status": "complete", "data": normalize_result(result)}
    except HttpResponseError as e:
        if e.status_code == 400 and "InvalidContent" in str(e):
            return {"status": "unsupported_format", "error": str(e)}
        if e.status_code == 413:
            return {"status": "too_large", "error": "Document exceeds size limit"}
        raise
    except Exception as e:
        logger.exception("extraction_failed", extra={"model": model_id})
        return {"status": "partial", "error": str(e), "data": None}
```

## Anti-Patterns

- ❌ Using `prebuilt-read` for structured docs — use the specific prebuilt model (invoice, receipt, etc.)
- ❌ Ignoring confidence scores — always threshold and flag low-confidence fields for human review
- ❌ Polling without backoff — `begin_analyze_document` returns a poller; don't spin-loop on status
- ❌ Sending unvalidated file types — DI supports PDF/JPEG/PNG/TIFF/BMP/DOCX/XLSX/PPTX/HTML only
- ❌ Processing files >500MB or >2000 pages without splitting first
- ❌ Hardcoding model IDs — use config so custom models can be swapped without code changes
- ❌ Skipping image preprocessing — rotated/skewed images degrade OCR accuracy significantly
- ❌ Storing raw DI results without normalization — downstream consumers get inconsistent schemas
- ❌ Using API keys instead of `DefaultAzureCredential` for the DI client

## WAF Alignment

| Pillar | Play 06 Implementation |
| --- | --- |
| **Security** | `DefaultAzureCredential` for DI client, private endpoints for DI resource, PII redaction from extracted fields before logging, Key Vault for any custom model training secrets |
| **Reliability** | Retry with backoff on 429/503 from DI API, partial extraction fallback (return what succeeded), circuit breaker for batch pipelines, dead-letter queue for failed documents |
| **Cost** | SHA-256 result caching (avoid re-analyzing identical docs), right-size DI SKU (S0 for <500 pages/mo, S1 for higher), batch documents to maximize per-call value, prebuilt models before custom (no training cost) |
| **Performance** | Semaphore-bounded concurrency (DI limits ~15 concurrent), async polling with `await poller.result()`, image preprocessing to reduce payload size, parallel page-range analysis for large docs |
| **Ops Excellence** | Structured logging with model_id + doc_hash correlation, confidence-score telemetry for drift detection, automated retraining triggers when custom model accuracy drops below threshold |
| **Responsible AI** | Flag handwriting extraction as lower-confidence, human-in-the-loop for PII documents (ID, health insurance), audit trail for all extracted data, bias monitoring across document languages |

### Operational Excellence
- Structured JSON logging with Application Insights + correlation IDs
- Custom metrics: latency p50/p95/p99, token usage, quality scores
- Automated Bicep deployment via GitHub Actions (staging → prod)
- Feature flags for gradual rollout, incident runbooks
