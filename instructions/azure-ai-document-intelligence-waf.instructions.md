---
description: "Azure AI Document Intelligence standards — model selection, layout analysis, table/form extraction, custom models, batch processing, confidence thresholds, SDK usage, and Bicep deployment."
applyTo: "**/*.py, **/*.ts, **/*.bicep"
waf:
  - "reliability"
  - "performance-efficiency"
  - "cost-optimization"
  - "security"
  - "responsible-ai"
---

# Azure AI Document Intelligence WAF — FAI Standards

When writing or reviewing Azure AI Document Intelligence code, enforce these WAF-aligned standards.

## Rules

### Model Selection
1. Use prebuilt models first (`prebuilt-invoice`, `prebuilt-receipt`, `prebuilt-idDocument`, `prebuilt-tax.*`) — they require no training and cover common document types.
2. Use `prebuilt-layout` for general document structure extraction (text, tables, figures, sections) without field-level extraction.
3. Use `prebuilt-read` for pure OCR text extraction when you only need text content without structural analysis.
4. Train custom extraction models only when prebuilt models achieve < 90% field accuracy on your document types.
5. Train custom classification models to route incoming documents to the correct extraction model in multi-document-type pipelines.
6. Use composed models to combine multiple custom models behind a single model ID — the service auto-classifies and routes.

### Document Analysis API v4.0
7. Use the `2024-11-30` (GA) API version or later. Never pin to preview API versions in production.
8. Submit documents via `begin_analyze_document()` (Python) or `beginAnalyzeDocument()` (JS) — these return a long-running operation poller.
9. Always poll with backoff: `result = await poller.result()`. Do not busy-wait with fixed intervals.
10. Set `locale` parameter when the document language is known to improve OCR accuracy: `analyze_request = AnalyzeDocumentRequest(url_source=url, locale="en-US")`.
11. Use URL source (`url_source`) for documents already in Azure Blob Storage to avoid upload overhead. Use `bytes_source` only for local files.

### Layout & Structure Extraction
12. Use `features=["keyValuePairs"]` to extract form fields without a custom model for semi-structured documents.
13. Use `features=["formulas"]` for documents containing mathematical expressions (scientific papers, engineering docs).
14. Access extracted tables via `result.tables[]` — iterate `table.cells` and use `row_index`/`column_index` for reconstruction.
15. Use `result.paragraphs[]` with `role` property to distinguish titles, section headings, footnotes, and page numbers.
16. For figures and charts, use `features=["figures"]` — each figure includes bounding regions and optional caption.

### Confidence Thresholds
17. Set minimum confidence thresholds per field: ≥ 0.80 for automated processing, ≥ 0.50 for human-review queue, < 0.50 for rejection.
18. Always check `field.confidence` before using extracted values. Log low-confidence fields for model improvement feedback loops.
19. For critical fields (amounts, dates, IDs), require ≥ 0.90 confidence or route to human review.
20. Track per-field confidence distributions over time to detect model degradation or document format drift.

### Custom Model Training
21. Provide a minimum of 5 labeled samples per document type; 15+ samples significantly improve accuracy.
22. Include variation in your training set: different scan qualities, orientations, handwritten vs. typed, and field value ranges.
23. Use the Document Intelligence Studio for labeling — export labels as JSON for CI/CD pipeline integration.
24. Train neural custom models for complex or variable layouts; train template models for fixed-format documents.
25. Version custom models and compare accuracy metrics before promoting a new version to production.

### Batch Processing
26. Use `begin_analyze_batch_documents()` for processing multiple documents in a single API call.
27. Set `result_container_url` and `result_prefix` to write batch results directly to Azure Blob Storage.
28. Limit concurrent requests per resource: S0 tier supports 15 concurrent requests. Use semaphore or queue-based throttling.
29. For large-scale pipelines (1000+ docs/day), use Azure Queue Storage → Functions → Document Intelligence pattern with poison-message handling.
30. Implement dead-letter handling for documents that repeatedly fail analysis (corrupt files, unsupported formats).

### SDK Usage Patterns
31. Python: Use `azure-ai-documentintelligence` package (v1.0+). Initialize with `DocumentIntelligenceClient(endpoint, DefaultAzureCredential())`.
32. TypeScript: Use `@azure-rest/ai-document-intelligence`. Initialize with `DocumentIntelligence(endpoint, new DefaultAzureCredential())`.
33. Reuse client instances — create one per application lifetime, not per request.
34. Handle `HttpResponseError` with retry for 429 (throttled) and 503 (service unavailable). Use exponential backoff starting at 1 second.
35. Set operation timeout appropriate to document size: 60s for single pages, 300s for large multi-page documents.

### Bicep Deployment
36. Deploy as `Microsoft.CognitiveServices/accounts` with `kind: "FormRecognizer"` and `sku: { name: "S0" }`.
37. Enable managed identity and disable key-based access: `properties: { disableLocalAuth: true }`.
38. Configure private endpoint for VNet-integrated deployments. Disable public network access when not needed.
39. Set up diagnostic settings to send logs and metrics to Log Analytics workspace.

### Output Formats
40. Access raw response with `result` object. Use `result.content` for full text, `result.pages` for per-page data.
41. For PDF output enrichment, use the `output=["pdf"]` option to get a searchable PDF with OCR text layer.
42. Export structured data as JSON for downstream processing — avoid re-parsing the SDK result objects.

## Patterns

```python
# Production-grade document analysis with confidence filtering
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.identity import DefaultAzureCredential
from azure.ai.documentintelligence.models import AnalyzeDocumentRequest

client = DocumentIntelligenceClient(
    endpoint=os.environ["DOC_INTELLIGENCE_ENDPOINT"],
    credential=DefaultAzureCredential()
)

poller = client.begin_analyze_document(
    "prebuilt-invoice",
    analyze_request=AnalyzeDocumentRequest(url_source=blob_url),
)
result = poller.result()

for invoice in result.documents:
    vendor = invoice.fields.get("VendorName")
    amount = invoice.fields.get("InvoiceTotal")

    if vendor and vendor.confidence >= 0.80:
        record["vendor"] = vendor.value_string
    else:
        record["needs_review"].append("VendorName")

    if amount and amount.confidence >= 0.90:
        record["amount"] = amount.value_currency.amount
    else:
        record["needs_review"].append("InvoiceTotal")
```

```python
# Batch processing with concurrency control
import asyncio

CONCURRENCY_LIMIT = 10
semaphore = asyncio.Semaphore(CONCURRENCY_LIMIT)

async def analyze_document(client, blob_url):
    async with semaphore:
        poller = await client.begin_analyze_document(
            "prebuilt-layout",
            analyze_request=AnalyzeDocumentRequest(url_source=blob_url),
        )
        return await poller.result()

results = await asyncio.gather(
    *[analyze_document(client, url) for url in document_urls],
    return_exceptions=True
)
```

```bicep
// Bicep deployment with managed identity and private endpoint
resource docIntelligence 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: docIntelligenceName
  location: location
  kind: 'FormRecognizer'
  sku: { name: 'S0' }
  identity: { type: 'SystemAssigned' }
  properties: {
    disableLocalAuth: true
    publicNetworkAccess: 'Disabled'
    networkAcls: { defaultAction: 'Deny' }
    customSubDomainName: docIntelligenceName
  }
}
```

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|---|---|---|
| Training custom models for standard invoices/receipts | Wastes labeling effort, lower accuracy than prebuilt | Use prebuilt models for common document types |
| Ignoring confidence scores | Silent data corruption in downstream systems | Enforce thresholds, route low-confidence to review |
| One client per request | Connection pool exhaustion, unnecessary auth overhead | Reuse client instances across requests |
| Synchronous polling with `time.sleep(1)` | Blocks threads, ignores server retry-after hints | Use SDK poller `result()` or async polling |
| Uploading from blob via SDK bytes instead of URL | Double network transfer, increased latency | Use `url_source` for blob-stored documents |
| No dead-letter handling in batch pipelines | Corrupt documents block the entire queue | Poison-message queue with max retry count |
| Pinning to preview API version | Breaking changes in preview, no SLA | Use latest GA API version |
| Storing extraction keys in code | Security vulnerability, hard to rotate | Use Managed Identity, disable local auth |

## Testing

- Unit test confidence threshold logic with mock results at various confidence levels (0.0, 0.49, 0.79, 0.95).
- Integration test with a known test document set to verify field extraction accuracy ≥ 95%.
- Test batch pipeline with corrupt files, empty pages, and oversized documents to verify error handling.
- Validate Bicep templates with `az bicep build` and `what-if` deployment before production.
- Monitor extraction accuracy metrics weekly — retrain custom models when accuracy drops below thresholds.
- Test failover by simulating 429/503 responses and verifying retry behavior.

## WAF Alignment

| Pillar | Implementation |
|---|---|
| **Reliability** | SDK poller with retry, dead-letter queues for batch failures, confidence-based routing to human review, connection reuse |
| **Performance Efficiency** | URL source for blob-stored docs, concurrency-limited parallel processing, prebuilt models avoid training latency, batch API for throughput |
| **Cost Optimization** | Prebuilt models (no training cost), `prebuilt-read` for OCR-only scenarios, S0 tier sizing based on throughput needs, batch processing reduces per-document overhead |
| **Security** | Managed Identity (no keys), private endpoints, disabled local auth, no secrets in code, VNet integration |
| **Responsible AI** | Confidence thresholds prevent silent errors, human-in-the-loop for low-confidence results, PII handling for ID documents, audit logging of extraction results |
