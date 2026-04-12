---
name: "deploy-realtime-voice-agent-v2"
description: "Deploy Realtime Voice Agent V2 — WebSocket streaming STT/TTS, function calling mid-conversation, barge-in detection, emotion analysis, multi-language switching."
---

# Deploy Realtime Voice Agent V2

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- Azure OpenAI with Realtime API access (GPT-4o Realtime)
- Python 3.11+ with `azure-openai`, `azure-cognitiveservices-speech`, `websockets`

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-voice-v2 \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure OpenAI (Realtime) | GPT-4o Realtime API for streaming conversation | S0 |
| Azure Speech Service | Streaming STT + Neural TTS with SSML | S0 |
| Azure Communication Services | Phone/PSTN integration | Pay-as-you-go |
| Azure Content Safety | Real-time content moderation | S0 |
| Cosmos DB | Conversation history, user context | Serverless |
| Container Apps | WebSocket server (HTTP/2 + WS) | Consumption |
| Azure Redis Cache | Session state, function call cache | C1 |
| Azure Key Vault | API keys | Standard |

## Step 2: Deploy WebSocket Streaming Pipeline

```python
import websockets
from azure.cognitiveservices.speech import SpeechConfig, SpeechRecognizer, AudioConfig

async def voice_agent_session(ws: websockets.WebSocketServerProtocol):
    """Full-duplex voice conversation over WebSocket."""
    
    # Initialize streaming STT
    speech_config = SpeechConfig(subscription=SPEECH_KEY, region=REGION)
    speech_config.speech_recognition_language = "en-US"
    
    # Continuous recognition (streaming)
    recognizer = SpeechRecognizer(speech_config=speech_config,
        audio_config=AudioConfig(stream=AudioInputStream(ws)))
    
    session_context = SessionContext()
    
    async def on_recognized(evt):
        """Called when STT produces final text."""
        user_text = evt.result.text
        
        # Detect emotion from audio prosody
        emotion = analyze_prosody(evt.result.audio_data)
        session_context.update_emotion(emotion)
        
        # Stream LLM response
        async for chunk in stream_llm_response(user_text, session_context):
            if chunk.type == "function_call":
                # Play filler while calling API
                await play_filler(ws, "Let me look that up for you...")
                result = await execute_function(chunk.function, chunk.args)
                # Resume with function result
                async for token in continue_after_function(result, session_context):
                    audio = await stream_tts(token)
                    await ws.send(audio)
            else:
                # Stream TTS audio as tokens arrive
                audio = await stream_tts(chunk.text)
                await ws.send(audio)
    
    async def on_barge_in():
        """User starts speaking while agent is talking → stop TTS."""
        await stop_tts_playback()
        session_context.barge_in_count += 1
    
    recognizer.recognized.connect(on_recognized)
    recognizer.session_started.connect(lambda e: print("Session started"))
    
    await recognizer.start_continuous_recognition_async()
    await ws.wait_closed()
    await recognizer.stop_continuous_recognition_async()
```

## Step 3: Deploy Streaming TTS with Token-by-Token Synthesis

```python
async def stream_tts(text_chunk: str, voice: str = "en-US-JennyNeural") -> bytes:
    """Synthesize TTS immediately as each LLM token arrives."""
    
    # Buffer tokens until we have a complete phrase/sentence
    PHRASE_DELIMITERS = [".", "!", "?", ",", ";", ":", "\n"]
    
    token_buffer = []
    async def flush_buffer():
        if not token_buffer:
            return b""
        phrase = "".join(token_buffer)
        token_buffer.clear()
        
        ssml = f"""<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"
                    xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
            <voice name="{voice}">
                <mstts:express-as style="chat">
                    <prosody rate="+5%">{phrase}</prosody>
                </mstts:express-as>
            </voice>
        </speak>"""
        
        return await tts_client.synthesize_ssml(ssml)
    
    token_buffer.append(text_chunk)
    if any(d in text_chunk for d in PHRASE_DELIMITERS):
        return await flush_buffer()
    return b""  # Buffer not full yet

# Latency target: < 500ms from user stops speaking to first audio byte (TTFT)
LATENCY_BUDGET = {
    "stt_final": 200,      # ms — STT recognition
    "llm_first_token": 200, # ms — LLM starts generating
    "tts_first_audio": 100,  # ms — TTS produces first audio chunk
    "total_ttft": 500        # ms — Total time to first byte
}
```

## Step 4: Deploy Function Calling Mid-Conversation

```python
VOICE_AGENT_TOOLS = [
    {
        "name": "lookup_order",
        "description": "Look up customer order status by order ID",
        "parameters": {"order_id": {"type": "string"}}
    },
    {
        "name": "transfer_to_human",
        "description": "Transfer call to human agent in specified department",
        "parameters": {"department": {"type": "string", "enum": ["billing", "support", "sales"]}}
    },
    {
        "name": "schedule_callback",
        "description": "Schedule a callback at a specific date/time",
        "parameters": {"datetime": {"type": "string"}, "reason": {"type": "string"}}
    },
    {
        "name": "check_account_balance",
        "description": "Check customer account balance",
        "parameters": {"account_id": {"type": "string"}}
    }
]

FILLER_PHRASES = [
    "Let me look that up for you...",
    "One moment please...",
    "I'm checking that now...",
    "Bear with me just a second..."
]
```

## Step 5: Deploy Emotion Detection

```python
async def analyze_prosody(audio_data: bytes) -> EmotionState:
    """Detect caller emotion from voice prosody features."""
    
    PROSODY_FEATURES = {
        "pitch_mean": "Average fundamental frequency (Hz)",
        "pitch_variance": "Pitch variation (monotone = low energy)",
        "speaking_rate_wpm": "Words per minute",
        "volume_mean": "Average loudness (dB)",
        "pause_frequency": "Pauses per minute (confusion indicator)",
        "speech_to_silence_ratio": "Talking vs silence"
    }
    
    features = extract_prosody(audio_data)
    
    EMOTION_RULES = {
        "frustrated": {"pitch_variance": ">high", "speaking_rate": ">fast", "volume": ">loud"},
        "confused": {"pause_frequency": ">high", "speaking_rate": "<slow", "pitch_variance": "<low"},
        "satisfied": {"pitch_mean": "normal", "speaking_rate": "normal", "volume": "normal"},
        "angry": {"volume": ">very_loud", "speaking_rate": ">very_fast", "pitch_mean": ">high"}
    }
    
    emotion = classify_emotion(features, EMOTION_RULES)
    
    # Adaptive response
    if emotion in ["frustrated", "angry"]:
        # Offer human transfer proactively
        return EmotionState(emotion=emotion, action="offer_human_transfer",
            response_modifier="empathetic_and_slower")
    
    return EmotionState(emotion=emotion)
```

## Step 6: Deploy Multi-Language Switching

```python
SUPPORTED_LANGUAGES = {
    "en-US": {"stt": "en-US", "tts_voice": "en-US-JennyNeural", "llm_lang": "English"},
    "es-ES": {"stt": "es-ES", "tts_voice": "es-ES-ElviraNeural", "llm_lang": "Spanish"},
    "fr-FR": {"stt": "fr-FR", "tts_voice": "fr-FR-DeniseNeural", "llm_lang": "French"},
    "de-DE": {"stt": "de-DE", "tts_voice": "de-DE-KatjaNeural", "llm_lang": "German"},
    "zh-CN": {"stt": "zh-CN", "tts_voice": "zh-CN-XiaoxiaoNeural", "llm_lang": "Chinese"},
    "ja-JP": {"stt": "ja-JP", "tts_voice": "ja-JP-NanamiNeural", "llm_lang": "Japanese"}
}

async def detect_and_switch_language(audio_chunk: bytes, current_lang: str) -> str:
    """Detect language mid-conversation and switch STT/TTS automatically."""
    detected = await language_detector.detect(audio_chunk)
    if detected.language != current_lang and detected.confidence > 0.85:
        return detected.language  # Triggers STT/TTS reconfiguration
    return current_lang
```

## Step 7: Smoke Test

```bash
# Start WebSocket session
wscat -c wss://api-voice-v2.azurewebsites.net/ws/voice \
  -H "Authorization: Bearer $TOKEN"
# Send audio bytes, receive synthesized audio response

# Test function calling
curl -s https://api-voice-v2.azurewebsites.net/api/test-function \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"text": "Can you check my order status? Order ID is 12345"}' | jq '.'

# Check latency metrics
curl -s https://api-voice-v2.azurewebsites.net/api/metrics \
  -H "Authorization: Bearer $TOKEN" | jq '.ttft_p50_ms, .ttft_p95_ms'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| TTFT > 1 second | Waiting for full LLM response before TTS | Enable streaming TTS with phrase-level buffering |
| Barge-in not working | Not detecting user speech during TTS | Lower VAD sensitivity, check WebSocket duplex |
| Function call creates silence | No filler speech during API call | Add filler phrases before function execution |
| Language switch flickering | Detection threshold too low | Raise confidence to 0.85, require 2+ consecutive detections |
| Emotion detection wrong | Only using rule-based | Add ML model trained on labeled prosody data |
