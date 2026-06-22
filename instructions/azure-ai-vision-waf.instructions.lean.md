---
description: "Azure AI Vision standards — image analysis, OCR, custom classification, spatial analysis, and content safety patterns."
applyTo: "**/*.py, **/*.ts, **/*.js"
waf:
  - "reliability"
  - "performance-efficiency"
  - "security"
  - "cost-optimization"
---

# Azure AI Vision — FAI Standards

## Image Analysis API

- Use `ImageAnalysisClient` from `@azure/cognitiveservices-computervision` (JS) or `azure.ai.vision` (Python)
- Authenticate with `DefaultAzureCredential` — never API keys in production code
- Specify visual features explicitly: `["Caption", "Tags", "Objects", "Read"]` — don't request all features
- Set `language` parameter for non-English content analysis
- Handle large images: resize client-side before sending (max 4MB, 50MP limit)
- Use `model_version` parameter to pin to specific model version for reproducibility

## OCR (Read API)

- Use Read API v4.0 (async) for production — supports PDF, TIFF, multi-page documents
- For real-time OCR: use analyze endpoint with `Read` feature (sync, single image)
- Handle multi-page results: iterate through `readResult.pages[].lines[].words[]`
- Extract handwriting by enabling `handwritingEnabled` — separate confidence thresholds
- Set minimum confidence threshold (0.7 default) for word-level extraction
- Preserve document layout: use bounding box coordinates for spatial reconstruction

## Custom Classification & Object Detection

- Use Custom Vision or Florence model for domain-specific classification
- Training data: minimum 15 images per class, diverse lighting/angles/backgrounds
- Evaluation: precision, recall, F1 per class, confusion matrix, mAP for detection
- Version trained models, track evaluation metrics per version, A/B test before promotion
- Export ONNX for edge deployment — validate quality matches cloud model within 5%

## Content Safety for Images

- Apply Content Safety API to all user-uploaded images before processing
- Categories: hate, violence, sexual, self-harm — severity threshold ≤2 for production
- Block processing if ANY category exceeds threshold — log event, return safe error
- For batch processing: pre-screen all images before OCR/analysis pipeline

## Error Handling

```python
from azure.ai.vision.imageanalysis import ImageAnalysisClient
from azure.identity import DefaultAzureCredential
from azure.core.exceptions import HttpResponseError, ServiceRequestError

client = ImageAnalysisClient(endpoint=config.endpoint, credential=DefaultAzureCredential())

try:
    result = client.analyze(image_data=image_bytes, visual_features=["Caption", "Read"])
except HttpResponseError as e:
    if e.status_code == 429:
        logger.warning("Vision API rate limited", extra={"retry_after": e.response.headers.get("Retry-After")})
        # Retry with backoff
    elif e.status_code == 400:
        logger.error("Invalid image", extra={"error": str(e)})
        # Skip this image, continue batch
    else:
        logger.exception("Vision API error", extra={"status": e.status_code})
        raise
except ServiceRequestError:
    logger.error("Network error connecting to Vision API")
    # Circuit breaker
```

## Performance Optimization

- Batch processing: process images in parallel (asyncio.gather, max 10 concurrent)
- Resize images client-side: 1024px max dimension for analysis, 2048px for OCR
- Cache analysis results by image hash — TTL based on use case (5min for real-time, 1hr for batch)
- Use streaming for large PDF OCR — process pages as they're available
- Connection pooling: reuse HTTP client across requests

## Cost Optimization

- Select only needed visual features — each feature has separate pricing
- Use gpt-4o-mini for simple classification instead of Vision API when text suffices
- Batch operations during off-peak for lower priority work
- Cache results aggressively — same image = same result
- Monitor per-image cost and set alerts on anomalies

## Anti-Patterns

- ❌ Requesting all visual features when you only need OCR
- ❌ Sending full-resolution images (10MB+) when analysis works at 1024px
- ❌ Not handling 429 rate limits — causes cascading failures
- ❌ Storing raw image bytes in logs (privacy + cost)
- ❌ Using synchronous Read API for multi-page PDFs (timeout risk)
- ❌ Hardcoding model versions — use config for version pinning

## WAF Alignment

### Security
- DefaultAzureCredential, private endpoints, Content Safety pre-screening, PII in images masked

### Reliability
- Retry with backoff on 429/5xx, circuit breaker, timeout (30s analysis, 120s OCR), health checks

### Performance Efficiency
- Client-side resize, parallel processing, connection pooling, streaming for large docs

### Cost Optimization
- Minimal feature selection, caching by image hash, batch off-peak, monitor per-image cost
