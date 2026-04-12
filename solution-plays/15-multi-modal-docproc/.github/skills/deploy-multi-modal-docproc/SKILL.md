---
name: deploy-multi-modal-docproc
description: "Deploy Multi-Modal DocProc — configure GPT-4o vision + Document Intelligence OCR for images, charts, tables, stamps, handwriting. Use when: deploy, provision, configure vision pipeline."
---

# Deploy Multi-Modal DocProc

## When to Use
- Deploy a pipeline that processes documents containing images + text together
- Configure GPT-4o vision for chart/graph/stamp/signature interpretation
- Set up Document Intelligence OCR for text and table extraction
- Configure page-level routing (text pages → OCR, visual pages → GPT-4o vision)
- Set up structured JSON output from mixed-content documents

## Prerequisites
1. Azure CLI authenticated: `az account show`
2. Azure OpenAI with GPT-4o (vision-capable) deployment
3. Azure Document Intelligence (S0 tier)
4. Azure Storage for document upload and processing queue
5. Cosmos DB for structured extraction results

## Step 1: Validate Infrastructure
```bash
az bicep lint -f infra/main.bicep
az bicep build -f infra/main.bicep
```
Verify resources:
- Azure OpenAI (gpt-4o with vision capability enabled)
- Document Intelligence (S0 — Layout model for OCR + tables)
- Azure Storage (document upload + page image cache)
- Cosmos DB (structured extraction results)
- Azure Functions (page-level processing pipeline)

## Step 2: Deploy Azure Resources
```bash
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
```

## Step 3: Configure Multi-Modal Pipeline
```
Document Upload → PDF split into pages → Page Classification
    ├── Text-heavy page → Document Intelligence (OCR + Layout)
    ├── Chart/graph page → GPT-4o Vision (interpret visual)
    ├── Table page → Document Intelligence (table extraction)
    ├── Photo/stamp page → GPT-4o Vision (describe + extract)
    └── Mixed page → Doc Intel (OCR) + GPT-4o Vision (visual elements)
                                    ↓
              Merge results → Structured JSON → Cosmos DB
```

## Step 4: Configure Page Classification
| Page Type | Detection Method | Processing Path |
|-----------|-----------------|----------------|
| Text-only | >90% text area | Document Intelligence Layout |
| Table | Table borders detected | Document Intelligence table extraction |
| Chart/graph | Chart pattern recognition | GPT-4o Vision with data extraction prompt |
| Photo/image | <20% text area | GPT-4o Vision with description prompt |
| Stamp/seal | Circular pattern detected | GPT-4o Vision with stamp reading prompt |
| Handwriting | Ink stroke detection | Document Intelligence + GPT-4o Vision |
| Mixed | Text + visual elements | Both pipelines, merge results |

## Step 5: Configure GPT-4o Vision Prompts
```python
# Chart interpretation prompt
vision_prompt = """Analyze this chart/graph image and extract:
1. Chart type (bar, line, pie, scatter)
2. Title and axis labels
3. All data points as structured JSON
4. Key trends or insights

Return structured JSON only."""

# Stamp/signature prompt
stamp_prompt = """Identify stamps, seals, or signatures in this image:
1. Type (stamp, seal, signature, initials)
2. Text content (if readable)
3. Position on page (top-left, bottom-right, etc.)
4. Estimated authenticity indicators

Return structured JSON only."""
```

## Step 6: Configure Image Preprocessing
- Convert PDF pages to PNG at 300 DPI (minimum for OCR accuracy)
- Resize to max 2048×2048 for GPT-4o vision (API limit)
- Deskew rotated pages before processing
- Apply contrast enhancement for faded documents
- Store processed page images in Blob Storage for audit trail

## Step 7: Smoke Test
```bash
# Test OCR-only page
python scripts/test_extraction.py --document samples/text-page.pdf --expect ocr

# Test vision page (chart)
python scripts/test_extraction.py --document samples/chart-page.pdf --expect vision

# Test mixed document
python scripts/test_extraction.py --document samples/mixed-doc.pdf --expect multi-modal

# Test full pipeline
python scripts/test_pipeline.py --document samples/full-report.pdf --output results.json
```

## Post-Deployment Verification
- [ ] Text pages extracted via Document Intelligence
- [ ] Charts interpreted correctly by GPT-4o vision
- [ ] Tables extracted with correct row/column structure
- [ ] Stamps/signatures detected and described
- [ ] Page classification routing working
- [ ] Structured JSON output matches expected schema
- [ ] PII detected in both text and image content
- [ ] Processing time < 15 seconds per page

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Vision returns "I can't see" | Image too small or low quality | Ensure 300 DPI, resize to ≥1024px |
| Chart data extraction wrong | Ambiguous chart type | Add chart type hint in prompt |
| Table columns misaligned | Complex spanning headers | Use Doc Intel table extraction, not vision |
| Handwriting not recognized | Cursive or faded ink | Combine Doc Intel + GPT-4o for cross-validation |
| High cost per document | Using vision on text pages | Route text pages to OCR (10x cheaper) |
| Processing timeout | Large multi-page document | Process pages in parallel, max 5 concurrent |
