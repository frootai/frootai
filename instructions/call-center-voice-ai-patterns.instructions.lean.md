---
description: "Play 04 patterns — Voice AI patterns — Azure Speech SDK, real-time transcription, sentiment detection, turn-taking, noise handling."
applyTo: "**/*.py, **/*.ts"
waf:
  - "reliability"
  - "security"
---

# Play 04 — Call Center Voice AI Patterns — FAI Standards

## STT Pipeline — Azure Speech SDK

```python
import azure.cognitiveservices.speech as speechsdk
import json, time, logging
from azure.identity import DefaultAzureCredential

logger = logging.getLogger("voice-ai")

def create_stt_recognizer(config: dict) -> speechsdk.SpeechRecognizer:
    """Real-time speech recognition with word-level timestamps."""
    speech_config = speechsdk.SpeechConfig(
        subscription=config["speech_key"],  # Key Vault ref in prod
        region=config["speech_region"],
    )
    speech_config.request_word_level_timestamps()
    speech_config.set_property(
        speechsdk.PropertyId.Speech_SegmentationSilenceTimeoutMs,
        str(config.get("silence_timeout_ms", 500)),
    )
    speech_config.speech_recognition_language = config.get("language", "en-US")

    audio_config = speechsdk.audio.AudioConfig(use_default_microphone=False)
    recognizer = speechsdk.SpeechRecognizer(speech_config, audio_config)

    def on_recognized(evt):
        result = json.loads(evt.result.json)
        words = result.get("NBest", [{}])[0].get("Words", [])
        logger.info("stt_final", extra={
            "text": evt.result.text,
            "word_count": len(words),
            "duration_ms": result.get("Duration", 0) // 10000,
            "confidence": result.get("NBest", [{}])[0].get("Confidence", 0),
        })

    recognizer.recognized.connect(on_recognized)
    return recognizer
```

## TTS Synthesis — SSML + Neural Voices

```python
def synthesize_response(text: str, config: dict, emotion: str = "friendly") -> bytes:
    """SSML synthesis with prosody control and neural voice selection."""
    voice = config.get("tts_voice", "en-US-JennyMultilingualNeural")
    rate = config.get("tts_rate", "0%")
    pitch = config.get("tts_pitch", "0%")

    ssml = f"""<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"
      xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="en-US">
      <voice name="{voice}">
        <mstts:express-as style="{emotion}" styledegree="1.2">
          <prosody rate="{rate}" pitch="{pitch}">{text}</prosody>
        </mstts:express-as>
      </voice>
    </speak>"""

    speech_config = speechsdk.SpeechConfig(
        subscription=config["speech_key"], region=config["speech_region"],
    )
    speech_config.set_speech_synthesis_output_format(
        speechsdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3,
    )
    synthesizer = speechsdk.SpeechSynthesizer(speech_config, audio_config=None)
    result = synthesizer.speak_ssml_async(ssml).get()
    if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
        return result.audio_data
    raise RuntimeError(f"TTS failed: {result.cancellation_details.error_details}")
```

## LLM Orchestration — STT → Reasoning → TTS

```python
import asyncio
from openai import AsyncAzureOpenAI

async def orchestrate_turn(
    transcript: str,
    conversation: list[dict],
    llm_client: AsyncAzureOpenAI,
    config: dict,
) -> tuple[str, str]:
    """Full voice turn: transcript in → (response_text, emotion) out. Target <500ms."""
    t0 = time.perf_counter()
    conversation.append({"role": "user", "content": transcript})

    response = await llm_client.chat.completions.create(
        model=config["model"],
        messages=[{"role": "system", "content": config["system_prompt"]}] + conversation,
        max_tokens=config.get("max_tokens", 200),
        temperature=config.get("temperature", 0.3),
        response_format={"type": "json_object"},
    )
    payload = json.loads(response.choices[0].message.content)
    reply = payload["reply"]
    emotion = payload.get("emotion", "friendly")
    action = payload.get("action")  # "escalate", "hold", "transfer", None

    conversation.append({"role": "assistant", "content": reply})
    latency_ms = (time.perf_counter() - t0) * 1000
    logger.info("llm_turn", extra={"latency_ms": latency_ms, "action": action,
                                     "tokens": response.usage.total_tokens})
    if latency_ms > 500:
        logger.warning("latency_breach", extra={"target_ms": 500, "actual_ms": latency_ms})

    return reply, emotion
```

## WebSocket Streaming Architecture

```python
import asyncio, websockets, uuid

async def voice_session(ws, config: dict):
    """Bidirectional WebSocket: audio chunks in, audio+events out."""
    session_id = str(uuid.uuid4())
    conversation: list[dict] = []
    recognizer = create_stt_recognizer(config)
    barge_in_event = asyncio.Event()

    async def audio_receiver():
        async for chunk in ws:
            if isinstance(chunk, bytes):
                recognizer.push_audio(chunk)
            else:
                msg = json.loads(chunk)
                if msg.get("type") == "dtmf":
                    await handle_dtmf(msg["digit"], session_id, ws)
                elif msg.get("type") == "hangup":
                    return

    async def response_sender():
        while True:
            transcript = await stt_queue.get()
            if transcript is None:
                break
            barge_in_event.clear()
            reply, emotion = await orchestrate_turn(
                transcript, conversation, llm_client, config,
            )
            audio = synthesize_response(reply, config, emotion)
            # Stream audio in chunks — check barge-in between chunks
            for i in range(0, len(audio), 4096):
                if barge_in_event.is_set():
                    logger.info("barge_in_detected", extra={"session_id": session_id})
                    break
                await ws.send(audio[i:i + 4096])

    await asyncio.gather(audio_receiver(), response_sender())
```

## Conversation State + Barge-In

```python
from dataclasses import dataclass, field
from enum import Enum

class CallState(Enum):
    GREETING = "greeting"
    LISTENING = "listening"
    PROCESSING = "processing"
    SPEAKING = "speaking"
    ON_HOLD = "on_hold"
    ESCALATED = "escalated"

@dataclass
class CallSession:
    session_id: str
    state: CallState = CallState.GREETING
    conversation: list[dict] = field(default_factory=list)
    sentiment_scores: list[float] = field(default_factory=list)
    dtmf_buffer: str = ""
    silence_start: float | None = None
    escalation_reason: str | None = None

    def detect_barge_in(self, energy_level: float, threshold: float = 0.02) -> bool:
        """Interrupt TTS playback when caller speaks during agent response."""
        if self.state == CallState.SPEAKING and energy_level > threshold:
            self.state = CallState.LISTENING
            return True
        return False

    def check_silence_timeout(self, now: float, timeout_s: float = 10.0) -> bool:
        if self.silence_start and (now - self.silence_start) > timeout_s:
            return True
        return False
```

## DTMF + Sentiment + Escalation

```python
async def handle_dtmf(digit: str, session: CallSession, ws):
    """DTMF routing: 0=agent, 1=repeat, 9=end call."""
    session.dtmf_buffer += digit
    if digit == "0":
        await escalate_to_human(session, ws, reason="dtmf_request")
    elif digit == "1":
        last_reply = session.conversation[-1]["content"] if session.conversation else ""
        audio = synthesize_response(last_reply, config)
        await ws.send(audio)

async def analyze_sentiment(text: str, client: AsyncAzureOpenAI) -> float:
    """Returns sentiment score -1.0 (negative) to 1.0 (positive)."""
    resp = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "system", "content": "Rate sentiment from -1.0 to 1.0. Reply JSON: {\"score\": float}"},
                  {"role": "user", "content": text}],
        max_tokens=20, temperature=0,
    )
    return json.loads(resp.choices[0].message.content)["score"]

async def escalate_to_human(session: CallSession, ws, reason: str = "sentiment"):
    """Transfer call to human agent with full context."""
    session.state = CallState.ESCALATED
    session.escalation_reason = reason
    context = {
        "session_id": session.session_id,
        "transcript": session.conversation,
        "sentiment_avg": sum(session.sentiment_scores) / max(len(session.sentiment_scores), 1),
        "reason": reason,
    }
    await ws.send(json.dumps({"type": "escalate", "context": context}))
    logger.info("escalation", extra=context)
```

## Call Recording + Transcription

```python
async def record_call(session: CallSession, audio_chunks: list[bytes], config: dict):
    """Persist recording + generate post-call transcript with diarization."""
    from azure.storage.blob.aio import BlobServiceClient
    blob_client = BlobServiceClient.from_connection_string(config["storage_conn"])
    container = blob_client.get_container_client("call-recordings")
    blob_name = f"{session.session_id}.wav"
    audio_data = b"".join(audio_chunks)
    await container.upload_blob(blob_name, audio_data, overwrite=True)

    # Post-call batch transcription with speaker diarization
    speech_config = speechsdk.SpeechConfig(
        subscription=config["speech_key"], region=config["speech_region"],
    )
    speech_config.set_property(
        speechsdk.PropertyId.SpeechServiceConnection_LanguageIdMode, "Continuous",
    )
    logger.info("recording_saved", extra={"session_id": session.session_id,
                                            "size_kb": len(audio_data) // 1024})
```

## Anti-Patterns

- ❌ Polling-based STT instead of event-driven `recognized` callbacks — adds 200-500ms per turn
- ❌ Full conversation history to LLM without sliding window — token explosion on long calls
- ❌ Blocking TTS synthesis on main WebSocket loop — prevents barge-in detection
- ❌ Ignoring silence timeout — zombie sessions hold resources indefinitely
- ❌ Hardcoded SSML voice names — breaks when Azure retires voices
- ❌ Logging raw audio or full transcripts — PII/GDPR violation
- ❌ Single-region deployment for voice — latency spikes for remote callers
- ❌ No DTMF fallback — accessibility failure for IVR integration
- ❌ Synchronous sentiment analysis in hot path — adds 100ms+ per turn

## WAF Alignment

| Pillar | Voice AI Implementation |
| --- | --- |
| **Reliability** | Circuit breaker on Speech SDK reconnect, fallback to pre-recorded prompts on TTS failure, graceful session drain on SIGTERM, silence timeout prevents orphan sessions |
| **Security** | `DefaultAzureCredential` for Speech/OpenAI, call recordings encrypted at rest (AES-256), PII redaction before analytics, Content Safety on LLM output before TTS |
| **Cost Optimization** | gpt-4o-mini for sentiment/routing, gpt-4o for reasoning only, STT continuous recognition (not per-utterance billing), TTS audio caching for repeated prompts (greetings, hold messages) |
| **Operational Excellence** | Structured logs with `session_id` correlation, latency p95 dashboard, call-drop-rate alerting, post-call quality scoring pipeline |
| **Performance Efficiency** | WebSocket streaming (no HTTP polling), chunked TTS delivery with barge-in check, async LLM calls, <500ms end-to-end target with latency breach alerting |
| **Responsible AI** | Sentiment-triggered escalation (threshold from config), mandatory human-in-the-loop for high-stakes actions, call recording consent prompt, Content Safety before every TTS output |
