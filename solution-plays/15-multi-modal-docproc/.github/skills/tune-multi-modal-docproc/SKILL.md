---
name: tune-multi-modal-docproc
description: "Tune Multi-Modal DocProc — optimize vision vs OCR routing, image resolution, GPT-4o vision prompt engineering, batch throughput, cost per document. Use when: tune, optimize."
---

# Tune Multi-Modal DocProc

## When to Use
- Optimize page routing (vision vs OCR) for cost and accuracy
- Tune GPT-4o vision prompts for specific visual element types
- Optimize image resolution and preprocessing for quality vs speed
- Configure batch processing throughput
- Reduce cost per document by intelligent routing

## Tuning Dimensions

### Dimension 1: Vision vs OCR Routing

| Page Content | Use OCR | Use Vision | Use Both | Cost Ratio |
|-------------|---------|-----------|----------|-----------|
| Pure text | ✅ | ❌ | ❌ | 1x (cheapest) |
| Simple table | ✅ | ❌ | ❌ | 1x |
| Complex table | ✅ | ✅ (verify) | ✅ | 5x |
| Bar/line chart | ❌ | ✅ | ❌ | 10x |
| Photo/image | ❌ | ✅ | ❌ | 10x |
| Stamp/seal | ❌ | ✅ | ❌ | 10x |
| Handwriting | ✅ (try) | ✅ (fallback) | ✅ | 5x |
| Mixed (text+visual) | ✅ (text) | ✅ (visual) | ✅ | 5x |

**Cost impact**: Routing all pages through GPT-4o vision costs ~10x more than OCR-only. Intelligent routing saves 60-80% on text-heavy documents.

### Dimension 2: Image Resolution Optimization

| Resolution | Quality | Speed | VRAM | Best For |
|-----------|---------|-------|------|---------|
| 150 DPI | Low | Fast | Small | Quick preview / classification only |
| 300 DPI | Good | Medium | Medium | Standard OCR + vision |
| 600 DPI | High | Slow | Large | Fine print, stamps, signatures |
| 1024px max | Standard | Fast | Medium | GPT-4o vision (API limit) |
| 2048px max | High | Medium | Large | GPT-4o vision (max quality) |

**Rule**: OCR at 300 DPI, vision at 1024-2048px. Never send full-resolution scans to vision (wastes tokens and time).

### Dimension 3: Vision Prompt Engineering

| Visual Element | Prompt Strategy | Output Format |
|---------------|----------------|---------------|
| Bar chart | "Extract data points as {label: value}" | JSON array |
| Line chart | "Extract x,y coordinates for each series" | JSON array of arrays |
| Pie chart | "Extract segment labels and percentages" | JSON object |
| Stamp/seal | "Read text, identify type, note position" | JSON object |
| Signature | "Describe position, note if signed" | JSON object |
| Logo | "Identify company, describe visual" | JSON object |
| Photo | "Describe content, extract visible text" | JSON object |

**Prompt optimization tips**:
- Always request structured JSON output (not free text)
- Include 1-2 examples of expected output format
- Specify what to do when element is unclear: "If uncertain, return confidence: low"
- Keep prompts < 500 tokens (system + user) for speed

### Dimension 4: Batch Processing Throughput

| Strategy | Pages/min | Concurrency | Best For |
|----------|-----------|-------------|---------|
| Sequential | 4-6 | 1 | Testing, small batches |
| Parallel OCR | 20-30 | 5 | Text-heavy documents |
| Parallel vision | 8-12 | 3 | Visual-heavy documents |
| Mixed parallel | 15-20 | OCR:5, Vision:3 | Production mixed documents |
| Queue-based | 50+ | Auto-scale | High-volume enterprise |

**Bottleneck**: GPT-4o vision API has lower throughput than OCR. Parallelize OCR aggressively, rate-limit vision calls.

### Dimension 5: Cost Per Document

**Cost breakdown** (10-page mixed document):

| Component | Pages | Cost |
|-----------|-------|------|
| Document Intelligence (OCR) | 7 text pages | $0.07 |
| GPT-4o vision | 3 visual pages | $0.15 |
| Storage | Upload + cache | $0.001 |
| Cosmos DB | Result storage | $0.001 |
| **Total** | 10 pages | **$0.22** |

**Without intelligent routing** (all pages through vision): $0.50 — **56% savings** from routing.

**Optimization levers**:
1. Route text pages to OCR only (10x cheaper than vision)
2. Cache vision results for repeated document templates
3. Reduce image resolution where full quality not needed
4. Batch OCR pages together (reduces per-page overhead)
5. Skip blank pages entirely (page detection before processing)

## Production Readiness Checklist
- [ ] Page classification routing 95%+ accurate
- [ ] OCR extraction ≥95% on text pages
- [ ] Vision extraction ≥85% on visual pages
- [ ] Cross-modal consistency ≥90%
- [ ] PII detected in both text and images
- [ ] Processing time <15s per page
- [ ] Cost per document documented and within budget
- [ ] Batch pipeline handling 50+ pages without errors
- [ ] Structured JSON output matching expected schema

## Output: Tuning Report
After tuning, compare:
- Routing accuracy improvement
- Cost per document reduction (before vs after routing)
- Vision prompt accuracy per element type
- Throughput improvement (pages/min)
- Image resolution impact on accuracy
