---
name: tune-multimodal-agent
description: "Tune Multimodal Agent — optimize image detail level, parallel modality processing, cross-modal prompts, content safety thresholds, cost per request. Use when: tune, optimize multimodal."
---

# Tune Multimodal Agent

## When to Use
- Optimize GPT-4o image detail level (high vs low) per image type
- Enable parallel modality processing for speed
- Tune cross-modal synthesis prompts for quality
- Configure content safety thresholds per modality
- Reduce cost per multimodal request

## Tuning Dimensions

### Dimension 1: Image Detail Level

| Image Type | Detail Setting | Tokens | Cost | Accuracy |
|-----------|---------------|--------|------|----------|
| High-res photo | high | ~1000 | $0.01 | Best |
| Screenshot | high | ~1000 | $0.01 | Best |
| Chart/graph | high | ~1000 | $0.01 | Best |
| Thumbnail/icon | low | ~85 | $0.003 | Sufficient |
| Sketch/diagram | low | ~85 | $0.003 | Sufficient |

**Rule**: Use "high" for photos/screenshots/charts. Use "low" for thumbnails/sketches. Auto-detect: if image < 512px → "low", else → "high".

### Dimension 2: Parallel Processing

| Strategy | Latency | When to Use |
|----------|---------|-------------|
| Sequential | Slower (sum of modalities) | Dependent modalities |
| Parallel (modalities) | Faster (max of modalities) | Independent inputs |
| Streaming | Fastest (progressive) | Real-time interaction |

```python
# Parallel processing example
import asyncio
async def process_parallel(text, image, audio):
    results = await asyncio.gather(
        analyze_image(image),       # 2-3s
        transcribe_audio(audio),    # 1-2s
        process_text(text)          # 0.5s
    )
    return merge_modalities(results)  # Total: max(2-3s) not sum(4-5.5s)
```

### Dimension 3: Cross-Modal Prompt Tuning

| Scenario | Prompt Strategy | Quality Impact |
|----------|----------------|---------------|
| Image Q&A | "Answer based on the image content" | +20% relevance |
| Image + text analysis | "Use both the image and text to answer" | +30% completeness |
| Audio summary | "Summarize the key points from this transcript" | +25% coherence |
| Mixed conflict | "If image and text disagree, explain both perspectives" | Better handling |

### Dimension 4: Cost Per Request

| Input Combination | Cost Breakdown | Total |
|-------------------|---------------|-------|
| Text only | LLM: $0.005 | ~$0.005 |
| Image + text (high detail) | Image: $0.01 + LLM: $0.005 | ~$0.015 |
| Image + text (low detail) | Image: $0.003 + LLM: $0.005 | ~$0.008 |
| Audio + text | STT: $0.005 + LLM: $0.005 | ~$0.01 |
| Image + audio + text | Image: $0.01 + STT: $0.005 + LLM: $0.008 | ~$0.023 |

**Monthly estimate** (10K requests/day, 40% with images):
- Text-only (6K): ~$900/mo
- Image+text (4K): ~$600/mo (high detail) or ~$320/mo (low detail)
- **Total: ~$1,220-1,500/mo** (optimize to ~$900 with smart detail routing)

### Dimension 5: Content Safety Configuration

| Modality | Default Threshold | Strict | Permissive |
|----------|------------------|--------|-----------|
| Text input | Severity ≥ 4 | ≥ 2 | ≥ 6 |
| Image input | Severity ≥ 4 | ≥ 2 | ≥ 6 |
| Audio (post-STT) | Severity ≥ 4 | ≥ 2 | ≥ 6 |
| Output | Severity ≥ 4 | ≥ 2 | ≥ 4 |

## Production Readiness Checklist
- [ ] All modality combinations tested (text, image, audio, mixed)
- [ ] Image detail routing configured (auto high/low)
- [ ] Parallel processing enabled for independent modalities
- [ ] Cross-modal synthesis producing coherent output
- [ ] Content safety active on all input + output modalities
- [ ] Cost per request within budget
- [ ] Latency < 5s for image+text, < 8s for audio+text
- [ ] Error handling for unsupported formats (WebP, HEIC, etc.)

## Output: Tuning Report
After tuning, compare:
- Per-modality accuracy improvement
- Latency reduction (parallel vs sequential)
- Cost per request reduction (detail routing)
- Cross-modal quality delta
- Content safety coverage

## Tuning Playbook
1. **Baseline**: Run 30 multimodal test cases, record per-modality metrics
2. **Detail**: Route images by size (>512px=high, <512px=low)
3. **Parallel**: Enable asyncio.gather for independent modalities
4. **Prompts**: Add modality-specific instructions to cross-modal prompts
5. **Safety**: Test per-modality content safety with adversarial inputs
6. **Cost**: Calculate per-request cost by input combination
7. **Re-test**: Same 30 cases, compare before/after
