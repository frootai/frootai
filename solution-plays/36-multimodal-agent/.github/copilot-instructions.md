---
description: "Multimodal Agent domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Multimodal Agent — Domain Knowledge

This workspace implements a multimodal AI agent — processing text, images, audio, and video inputs, routing to specialized models per modality, and generating unified responses with cross-modal reasoning.

## Multimodal Architecture (What the Model Gets Wrong)

### Input Router by Modality
```python
async def process_multimodal(inputs: list[Input]) -> Response:
    results = {}
    for inp in inputs:
        match inp.modality:
            case "text":   results["text"] = await text_llm(inp.content)
            case "image":  results["image"] = await vision_model(inp.content)  # GPT-4o vision
            case "audio":  results["audio"] = await stt(inp.content)           # Azure Speech
            case "video":  results["video"] = await extract_frames_and_analyze(inp.content)
    
    # Cross-modal reasoning: combine all modality results
    unified = await cross_modal_synthesis(results)
    return unified
```

### GPT-4o Vision (Image Understanding)
```python
import base64

# WRONG — send raw image URL (may be blocked, large payload)
# CORRECT — base64 encode, resize to max 1024px
image_b64 = base64.standard_b64encode(resize_image(image, max_px=1024)).decode()
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "Describe this image and extract any text visible."},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}", "detail": "high"}},
        ],
    }],
    max_tokens=1000,
)
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Send full-res images to vision API | Token cost explosion (high detail = 1000+ tokens/image) | Resize to 1024px max, use `detail: "low"` for thumbnails |
| Process all modalities sequentially | Slow — audio + image + text in series | `asyncio.gather` for parallel processing |
| No modality detection | Assume input type, crash on wrong type | Auto-detect: MIME type + content inspection |
| Single model for all modalities | GPT-4o can't process raw audio | Route: text→LLM, image→vision, audio→STT, video→frames+vision |
| No cross-modal reasoning | Process each modality independently | Synthesis step merges all modality results |
| Video as single frame | Misses temporal information | Extract key frames (1/sec), analyze sequence |
| No content safety on images | Harmful image content passes through | Azure Content Safety for images + text |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | Vision model, text model, image detail level |
| `config/guardrails.json` | Image size limits, content safety thresholds |
| `config/agents.json` | Modality routing rules, parallel processing settings |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement multimodal pipeline, vision integration, cross-modal synthesis |
| `@reviewer` | Audit content safety, modality handling, image sizing |
| `@tuner` | Optimize image detail level, parallel processing, cost per query |

## Slash Commands
`/deploy` — Deploy multimodal agent | `/test` — Test all modalities | `/review` — Audit safety | `/evaluate` — Measure cross-modal quality
