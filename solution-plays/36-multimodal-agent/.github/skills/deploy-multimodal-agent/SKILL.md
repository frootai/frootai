---
name: deploy-multimodal-agent
description: "Deploy Multimodal Agent — configure unified text+image+audio pipeline, GPT-4o vision, modality routing, cross-modal synthesis, content safety per modality. Use when: deploy, provision multimodal."
---

# Deploy Multimodal Agent

## When to Use
- Deploy an agent that processes text, images, and audio together
- Configure GPT-4o vision for image understanding and analysis
- Set up modality routing (detect input type → appropriate processor)
- Enable cross-modal synthesis (describe image as text, text-to-image prompts)
- Configure content safety across all modalities

## How Play 36 Differs from Play 15 (Multi-Modal DocProc)
| Aspect | Play 15 (DocProc) | Play 36 (Multimodal Agent) |
|--------|------------------|--------------------------|
| Focus | Document processing only | Any input: text, image, audio, video |
| Input | PDF/image documents | User uploads, real-time streams |
| Output | Structured JSON extraction | Conversational multimodal responses |
| Agent type | Pipeline processor | Interactive conversational agent |
| Modalities | OCR + vision on pages | Text + image + audio + video |

## Prerequisites
1. Azure OpenAI with GPT-4o (vision-capable model)
2. Azure Speech Service (audio processing — STT + TTS)
3. Azure Storage (uploaded file handling)
4. Container Apps (multimodal agent runtime)

## Step 1: Deploy Infrastructure
```bash
az bicep lint -f infra/main.bicep
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
```

## Step 2: Configure Modality Detection & Routing
```python
async def process_multimodal(inputs):
    modalities = detect_modalities(inputs)  # text, image, audio, mixed
    context = {}
    for modality in modalities:
        if modality == "image":
            context["image_analysis"] = await analyze_image(inputs.image)
        elif modality == "audio":
            context["transcript"] = await transcribe_audio(inputs.audio)
        elif modality == "text":
            context["text"] = inputs.text
    return await generate_response(context, model="gpt-4o")
```

## Step 3: Configure Image Processing
| Image Input | Processing | GPT-4o Config |
|------------|-----------|---------------|
| Photo | Describe, identify objects/people | detail: "high" |
| Screenshot | Extract text, understand UI | detail: "high" |
| Chart/graph | Extract data points | detail: "high" |
| Sketch/diagram | Describe layout, relationships | detail: "low" (sufficient) |
| Thumbnail | Quick classification | detail: "low" |

**detail parameter**: "high" = better accuracy, more tokens ($0.01/image). "low" = faster, cheaper ($0.003/image).

## Step 4: Configure Audio Processing
- STT for speech input → text transcript
- Speaker diarization for multi-speaker audio
- Language detection for multilingual audio
- TTS for spoken responses (optional)

## Step 5: Configure Cross-Modal Synthesis
| From → To | Example | Method |
|-----------|---------|--------|
| Image → Text | "Describe this photo" | GPT-4o vision |
| Text → Image description | "Create a prompt for image generation" | GPT-4o text |
| Audio → Text summary | "Summarize this recording" | STT + GPT-4o |
| Image + Text → Analysis | "What's wrong in this X-ray?" | GPT-4o vision + domain prompt |

## Step 6: Configure Per-Modality Content Safety
| Modality | Safety Check | Tool |
|----------|-------------|------|
| Text input | Content Safety API (4 categories) | Azure Content Safety |
| Image input | Image moderation (inappropriate content) | Azure Content Safety |
| Audio input | STT → text safety check | STT + Content Safety |
| Output (text) | Content Safety + grounding check | Azure Content Safety |
| Output (image ref) | Generated description safety | Content Safety |

## Step 7: Post-Deployment Verification
- [ ] Text-only input processed correctly
- [ ] Image input analyzed by GPT-4o vision
- [ ] Audio input transcribed and processed
- [ ] Mixed input (text + image) handled together
- [ ] Cross-modal synthesis producing correct output
- [ ] Content safety active on all input/output modalities
- [ ] Modality routing selecting correct processor

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Image analysis blank | Image too small | Require min 256px, resize up |
| Audio transcript wrong | Noisy audio | Enable noise suppression in STT |
| Mixed input confused | Modalities not separated | Explicit modality tags in request |
| High cost | All images on "high" detail | Use "low" for thumbnails/sketches |
| Content safety misses image | Image not sent to moderation | Add image check in pipeline |
| Slow response | Sequential modality processing | Parallelize image + audio analysis |
