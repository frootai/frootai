---
description: "Play 15 patterns — Multi-modal patterns — GPT-4o Vision, image+text pipelines, PDF rendering, chart interpretation."
applyTo: "**/*.py"
waf:
  - "reliability"
  - "security"
---

# Play 15 — Multi-Modal Document Processing — FAI Standards

## GPT-4o Vision for Document Analysis

```python
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)
client = AzureOpenAI(
    azure_endpoint=config["azure_openai_endpoint"],
    azure_ad_token_provider=token_provider,
    api_version="2024-12-01-preview",
)

def analyze_document_page(image_b64: str, extraction_schema: dict) -> dict:
    """Send a single page image to GPT-4o Vision with structured output."""
    response = client.chat.completions.create(
        model=config["vision_model"],  # gpt-4o from config/openai.json
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": f"Extract fields per this schema: {json.dumps(extraction_schema)}"},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}", "detail": config.get("image_detail", "high")}},
            ],
        }],
        temperature=0,
        max_tokens=config["max_tokens_vision"],
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)
```

## Image Preprocessing Pipeline

```python
from PIL import Image, ImageEnhance, ImageFilter
import numpy as np

def preprocess_for_vision(img: Image.Image, max_dim: int = 2048) -> Image.Image:
    """Resize, deskew, and enhance contrast before sending to vision model."""
    # Resize — GPT-4o charges per tile (512×512), cap dimensions
    ratio = min(max_dim / img.width, max_dim / img.height, 1.0)
    if ratio < 1.0:
        img = img.resize((int(img.width * ratio), int(img.height * ratio)), Image.LANCZOS)

    # Deskew via numpy projection profile
    gray = img.convert("L")
    arr = np.array(gray)
    best_angle, best_score = 0, 0
    for angle in np.arange(-5, 5.1, 0.5):
        rotated = gray.rotate(angle, fillcolor=255)
        projection = np.sum(np.array(rotated), axis=1)
        score = np.max(projection) - np.min(projection)
        if score > best_score:
            best_angle, best_score = angle, score
    if abs(best_angle) > 0.5:
        img = img.rotate(best_angle, fillcolor=(255, 255, 255), expand=True)

    # Contrast enhancement — improves OCR on faded/scanned docs
    enhancer = ImageEnhance.Contrast(img)
    return enhancer.enhance(config.get("contrast_factor", 1.5))
```

## Multi-Page PDF Processing

```python
from pdf2image import convert_from_path
import asyncio, base64, io

def pdf_to_pages(pdf_path: str, dpi: int = 200) -> list[Image.Image]:
    """Convert PDF to images. Use 200 DPI — balances quality vs token cost."""
    return convert_from_path(pdf_path, dpi=dpi, fmt="png", thread_count=4)

async def process_pdf_batch(pdf_path: str, schema: dict, batch_size: int = 5) -> list[dict]:
    """Process PDF pages in batches to stay within rate limits."""
    pages = pdf_to_pages(pdf_path)
    results = []
    for i in range(0, len(pages), batch_size):
        batch = pages[i:i + batch_size]
        tasks = [_analyze_single_page(preprocess_for_vision(p), schema) for p in batch]
        batch_results = await asyncio.gather(*tasks, return_exceptions=True)
        for idx, result in enumerate(batch_results):
            page_num = i + idx + 1
            if isinstance(result, Exception):
                logger.warning("page_failed", page=page_num, error=str(result))
                results.append({"page": page_num, "status": "error", "error": str(result)})
            else:
                result["page"] = page_num
                results.append(result)
    return results
```

## Table Extraction from Images

```python
def extract_tables(image_b64: str) -> list[list[list[str]]]:
    """Extract tabular data as list-of-lists using GPT-4o Vision."""
    response = client.chat.completions.create(
        model=config["vision_model"],
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": (
                    "Extract ALL tables from this image. Return JSON: "
                    '{"tables": [{"headers": [...], "rows": [[...], ...]}]}. '
                    "Preserve numeric precision. Mark empty cells as null."
                )},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}", "detail": "high"}},
            ],
        }],
        temperature=0, max_tokens=4096,
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)["tables"]
```

## Hybrid Pipeline: Document Intelligence + GPT-4o Vision

```python
from azure.ai.documentintelligence import DocumentIntelligenceClient

di_client = DocumentIntelligenceClient(
    endpoint=config["doc_intelligence_endpoint"],
    credential=DefaultAzureCredential(),
)

def classify_page_complexity(page_result) -> str:
    """Route pages: simple text → OCR only, complex layouts → vision model."""
    has_tables = len(page_result.tables) > 0
    has_figures = len(getattr(page_result, "figures", [])) > 0
    low_confidence = any(w.confidence < config.get("ocr_confidence_threshold", 0.85)
                         for w in page_result.words)
    if has_figures or (has_tables and low_confidence):
        return "vision"   # ~$0.01-0.03 per page
    return "ocr"          # ~$0.001 per page — 10-30× cheaper

def hybrid_extract(pdf_bytes: bytes, schema: dict) -> list[dict]:
    """Two-pass: DI for layout + OCR, GPT-4o Vision only for complex pages."""
    poller = di_client.begin_analyze_document(
        "prebuilt-layout", body=pdf_bytes, content_type="application/pdf"
    )
    di_result = poller.result()
    results = []
    for i, page in enumerate(di_result.pages):
        complexity = classify_page_complexity(page)
        if complexity == "vision":
            img = pdf_to_pages_single(pdf_bytes, page_number=i + 1)
            img = preprocess_for_vision(img)
            b64 = image_to_base64(img)
            extracted = analyze_document_page(b64, schema)
            extracted["extraction_method"] = "vision"
        else:
            extracted = _build_from_ocr(page, di_result.tables)
            extracted["extraction_method"] = "ocr"
        extracted["page"] = i + 1
        results.append(extracted)
    return results
```

## Confidence Scoring and Human Review

```python
def score_extraction(extracted: dict, schema: dict) -> dict:
    """Score extraction confidence and flag for human review."""
    required_fields = [k for k, v in schema["properties"].items() if k in schema.get("required", [])]
    filled = sum(1 for f in required_fields if extracted.get(f) not in (None, "", []))
    completeness = filled / max(len(required_fields), 1)

    # Vision model self-reported confidence (ask model to rate 0-1)
    model_confidence = extracted.get("_confidence", 1.0)
    combined = 0.6 * model_confidence + 0.4 * completeness

    needs_review = (
        combined < config.get("auto_approve_threshold", 0.85)
        or extracted.get("extraction_method") == "vision"
        and any(extracted.get(f) is None for f in required_fields)
    )
    return {
        "confidence": round(combined, 3),
        "completeness": round(completeness, 3),
        "needs_human_review": needs_review,
        "review_reason": "low_confidence" if combined < 0.85 else "missing_fields" if completeness < 1.0 else None,
    }
```

## Structured Invoice/Form Extraction

```python
INVOICE_SCHEMA = {
    "type": "object",
    "properties": {
        "vendor_name": {"type": "string"},
        "invoice_number": {"type": "string"},
        "invoice_date": {"type": "string", "format": "date"},
        "due_date": {"type": "string", "format": "date"},
        "total_amount": {"type": "number"},
        "currency": {"type": "string"},
        "line_items": {"type": "array", "items": {
            "type": "object",
            "properties": {
                "description": {"type": "string"},
                "quantity": {"type": "number"},
                "unit_price": {"type": "number"},
                "amount": {"type": "number"},
            },
        }},
        "_confidence": {"type": "number", "description": "Self-assessed 0-1 confidence"},
    },
    "required": ["vendor_name", "invoice_number", "total_amount", "currency"],
}

def normalize_output(raw: dict) -> dict:
    """Normalize extracted data — dates to ISO, amounts to float, strip whitespace."""
    from dateutil import parser as dateparser
    for date_field in ("invoice_date", "due_date"):
        if raw.get(date_field):
            raw[date_field] = dateparser.parse(raw[date_field]).strftime("%Y-%m-%d")
    for num_field in ("total_amount",):
        if isinstance(raw.get(num_field), str):
            raw[num_field] = float(raw[num_field].replace(",", "").replace("$", ""))
    for item in raw.get("line_items", []):
        for k in ("quantity", "unit_price", "amount"):
            if isinstance(item.get(k), str):
                item[k] = float(item[k].replace(",", ""))
    return raw
```

## Anti-Patterns

- ❌ Sending full-resolution scans (4000×6000) to GPT-4o — burns 10× tokens, resize to ≤2048px
- ❌ Using `detail: "low"` for table/chart extraction — loses cell boundaries and small text
- ❌ Processing all pages through vision model — route text-heavy pages to Document Intelligence OCR
- ❌ No confidence gating — auto-approving all extractions without human review triggers
- ❌ Sequential page processing — use `asyncio.gather` with batch-size caps for throughput
- ❌ Hardcoding extraction prompts — use schema-driven prompts from config, version them
- ❌ Ignoring DI prebuilt models — `prebuilt-invoice` / `prebuilt-receipt` are faster and cheaper for standard forms
- ❌ Base64-encoding multi-MB TIFFs — convert to PNG first, strip alpha channel
- ❌ Missing PII redaction — invoices contain addresses, bank details; redact before logging

## WAF Alignment

| Pillar | Play 15 Implementation |
|--------|----------------------|
| **Reliability** | Retry per-page (not whole PDF) on 429/500; dead-letter failed pages to queue for reprocessing; circuit breaker on vision endpoint; health check validates DI + OpenAI connectivity |
| **Security** | `DefaultAzureCredential` for DI + OpenAI; PII redaction on extracted invoices before storage; private endpoints for both services; never log base64 image payloads |
| **Cost Optimization** | Hybrid routing: OCR ($0.001/page) for simple pages, vision ($0.01-0.03/page) for complex; resize images to reduce tile count; cache repeated document templates; batch DI calls |
| **Operational Excellence** | Log extraction method + confidence per page; dashboard: pages/min, vision vs OCR ratio, review rate; alert on confidence drop below threshold |
| **Performance** | Parallel page processing with configurable batch size; pre-render PDF pages during upload; stream results as pages complete; DPI from config (200 default — 300 only for fine print) |
| **Responsible AI** | Human-in-the-loop for low-confidence extractions; audit trail linking source image → extracted fields; no hallucinated field values — return null over guessing |
