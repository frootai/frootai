---
name: fai-tune-06-document-intelligence
description: |
  Tune Document Intelligence OCR model selection, field extraction confidence,
  and multi-format processing. Use when optimizing Azure Document Intelligence
  for invoice, receipt, ID, or custom form extraction.
---

# Tune Document Intelligence

Optimize Azure Document Intelligence for field extraction accuracy and throughput.

## When to Use

- Tuning OCR accuracy for specific document types
- Selecting between prebuilt and custom models
- Configuring confidence thresholds for extraction
- Optimizing multi-format processing pipelines

---

## Model Selection

| Document Type | Model | Accuracy |
|--------------|-------|----------|
| Invoices | prebuilt-invoice | High (95%+) |
| Receipts | prebuilt-receipt | High |
| ID documents | prebuilt-idDocument | High |
| Custom forms | Custom trained | Varies (train with 5+ samples) |
| General text | prebuilt-read | Good for OCR-only |
| Layout + tables | prebuilt-layout | Good for structured docs |

## Python SDK Usage

```python
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.identity import DefaultAzureCredential

client = DocumentIntelligenceClient(
    endpoint="https://di-prod.cognitiveservices.azure.com",
    credential=DefaultAzureCredential()
)

# Analyze invoice
with open("invoice.pdf", "rb") as f:
    poller = client.begin_analyze_document("prebuilt-invoice", body=f, content_type="application/pdf")

result = poller.result()
for doc in result.documents:
    vendor = doc.fields.get("VendorName")
    total = doc.fields.get("InvoiceTotal")
    print(f"Vendor: {vendor.content} (confidence: {vendor.confidence:.2f})")
    print(f"Total: {total.content} (confidence: {total.confidence:.2f})")
```

## Confidence Thresholds

```python
CONFIDENCE_THRESHOLDS = {
    "high": 0.90,    # Auto-accept
    "medium": 0.70,  # Flag for review
    "low": 0.50,     # Require manual entry
}

def route_by_confidence(field_name: str, value, confidence: float) -> dict:
    if confidence >= CONFIDENCE_THRESHOLDS["high"]:
        return {"field": field_name, "value": value, "action": "accept"}
    elif confidence >= CONFIDENCE_THRESHOLDS["medium"]:
        return {"field": field_name, "value": value, "action": "review"}
    else:
        return {"field": field_name, "value": None, "action": "manual"}
```

## Multi-Format Pipeline

```python
SUPPORTED = {".pdf": "application/pdf", ".png": "image/png",
             ".jpg": "image/jpeg", ".tiff": "image/tiff"}

def process_document(path: str, model: str = "prebuilt-invoice"):
    ext = Path(path).suffix.lower()
    content_type = SUPPORTED.get(ext)
    if not content_type:
        raise ValueError(f"Unsupported format: {ext}")
    with open(path, "rb") as f:
        poller = client.begin_analyze_document(model, body=f, content_type=content_type)
    return poller.result()
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Low extraction accuracy | Wrong model for doc type | Match prebuilt model to document category |
| Fields missing | Document layout varies | Train custom model with 5+ representative samples |
| Slow processing | Large files, no batching | Use async API, process pages in parallel |
| Confidence too low | Poor scan quality | Require 300+ DPI, good contrast scans |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Tune one parameter at a time | Isolate impact of each change |
| Always measure before and after | Evidence-based tuning |
| Use evaluation dataset for comparison | Objective quality measurement |
| Keep previous config for rollback | Instant revert if quality drops |
| Document tuning decisions | Future reference for the team |
| Automate tuning evaluation | Reduce manual effort |

## Tuning Workflow

```
1. Baseline eval → record current scores
2. Change ONE parameter
3. Re-run eval → compare to baseline
4. If improved → keep change, update baseline
5. If regressed → revert change
6. Repeat for next parameter
```

## Related Skills

- `fai-tune-01-enterprise-rag` — RAG tuning playbook
- `fai-evaluation-framework` — Eval infrastructure
- `fai-inference-optimization` — Latency and cost optimization
