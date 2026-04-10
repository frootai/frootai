---
description: "AI Video Generation domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# AI Video Generation — Domain Knowledge

This workspace implements AI video generation — text-to-video, image-to-video, video editing with natural language, batch processing, and content moderation for generated media.

## Video Generation Architecture (What the Model Gets Wrong)

### Generation Pipeline
```python
# Text-to-Video with Azure AI or Sora-like APIs
async def generate_video(prompt: str, config: dict) -> VideoResult:
    # 1. Content safety check on prompt
    safety = await check_content_safety(prompt)
    if safety.blocked: raise ContentBlockedError(safety.reason)
    
    # 2. Generate video
    result = await video_client.create(
        prompt=prompt,
        duration_seconds=config.get("duration", 5),  # 5-60 seconds
        resolution=config.get("resolution", "1080p"),
        aspect_ratio=config.get("aspect_ratio", "16:9"),
        style=config.get("style", "natural"),  # natural, cinematic, animated
    )
    
    # 3. Content safety check on generated video (frame sampling)
    frames = extract_key_frames(result.video, sample_rate=1)  # 1 frame/sec
    for frame in frames:
        frame_safety = await check_image_safety(frame)
        if frame_safety.blocked:
            raise ContentBlockedError(f"Generated frame {frame.index} blocked: {frame_safety.reason}")
    
    return result
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| No prompt safety check | Generate harmful/inappropriate content | Content Safety on input prompt |
| No output safety check | Generated video may contain inappropriate frames | Sample frames, check each with Content Safety |
| Synchronous generation | Video gen takes 30-120s, blocks thread | Async with polling/webhook for completion |
| No cost estimation | Video gen is expensive ($0.05-1.00/video) | Estimate cost before generation, require approval |
| Full resolution for preview | Wastes compute on previews | Generate 480p preview first, 1080p on approval |
| No watermark | Generated content mistaken for real | Add AI-generated watermark/metadata (C2PA) |
| No batch queuing | Burst of requests overwhelms service | Queue with rate limiting, priority scheduling |
| Ignoring copyright | Prompts reference copyrighted characters | Content policy filter on prompt |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | Video model, default duration, resolution, style |
| `config/guardrails.json` | Content safety thresholds, cost limit per video, copyright filters |
| `config/agents.json` | Batch queue settings, priority rules, watermark config |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement generation pipeline, batch processing, safety checks |
| `@reviewer` | Audit content safety, copyright compliance, watermarking |
| `@tuner` | Optimize quality/cost trade-off, resolution settings, queue throughput |

## Slash Commands
`/deploy` — Deploy video pipeline | `/test` — Test generation | `/review` — Audit safety | `/evaluate` — Measure quality + cost
