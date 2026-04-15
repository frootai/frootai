---
name: fai-deploy-04-call-center-voice-ai
description: |
  Deploy Call Center Voice AI (Play 04) with speech-to-text, LLM processing,
  text-to-speech pipeline, and real-time WebSocket streaming. Covers latency
  optimization and escalation handling.
---

# Deploy Call Center Voice AI (Play 04)

Deploy real-time voice AI pipeline with STT → LLM → TTS streaming.

## When to Use

- Deploying a voice-based AI agent for call centers
- Setting up STT/TTS with Azure Speech Services
- Optimizing end-to-end voice latency (<2s target)
- Implementing human escalation paths

---

## Pipeline Architecture

```
Phone Call → Azure Communication Services
    → Speech-to-Text (real-time)
    → LLM Processing (streaming)
    → Text-to-Speech (real-time)
    → Audio Response to Caller
```

## Deployment

```bash
# Deploy speech + LLM infrastructure
az deployment group create --resource-group rg-voice-prod \
  --template-file infra/main.bicep

# Deploy voice gateway app
az containerapp create --name voice-gateway \
  --resource-group rg-voice-prod \
  --image myacr.azurecr.io/voice-gateway:v1.0 \
  --cpu 2 --memory 4Gi \
  --min-replicas 2 --max-replicas 10
```

## Real-Time STT

```python
import azure.cognitiveservices.speech as speechsdk

speech_config = speechsdk.SpeechConfig(
    subscription=None,  # Use MI
    region="eastus2"
)
speech_config.speech_recognition_language = "en-US"

async def transcribe_stream(audio_stream):
    recognizer = speechsdk.SpeechRecognizer(
        speech_config=speech_config,
        audio_config=speechsdk.AudioConfig(stream=audio_stream)
    )
    result = recognizer.recognize_once_async().get()
    return result.text
```

## Streaming LLM Response

```python
async def stream_llm_response(text: str):
    stream = client.chat.completions.create(
        model="gpt-4o-mini",  # Low latency model
        messages=[
            {"role": "system", "content": "You are a helpful call center agent. Be concise."},
            {"role": "user", "content": text},
        ],
        stream=True,
        max_tokens=150,  # Keep responses short for voice
    )
    for chunk in stream:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
```

## Latency Budget

| Stage | Target | Optimization |
|-------|--------|-------------|
| STT | <500ms | Use real-time recognition |
| LLM | <800ms | GPT-4o-mini, stream, short max_tokens |
| TTS | <400ms | Use neural voice, pre-warm connection |
| Network | <300ms | Same-region deployment |
| **Total** | **<2000ms** | |

## Escalation

```python
ESCALATION_TRIGGERS = [
    "speak to a human", "transfer me", "supervisor",
    "I want to complain", "this is urgent",
]

def should_escalate(transcript: str) -> bool:
    return any(trigger in transcript.lower() for trigger in ESCALATION_TRIGGERS)
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| High latency (>3s) | Wrong model or no streaming | Use mini + streaming + same region |
| STT accuracy low | Background noise | Enable noise suppression |
| TTS sounds robotic | Using standard voice | Switch to neural voice (en-US-JennyNeural) |
| Escalation not triggering | Keyword list too narrow | Add more trigger phrases |
