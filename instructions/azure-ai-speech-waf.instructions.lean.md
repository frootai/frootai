---
description: "Azure AI Speech standards — STT (real-time + batch), TTS (neural voices, SSML, custom voice), speech translation, pronunciation assessment, speaker recognition, WebSocket streaming, SDK patterns, and latency optimization."
applyTo: "**/*.py, **/*.ts, **/*.bicep"
waf:
  - "performance-efficiency"
  - "reliability"
  - "security"
  - "cost-optimization"
  - "responsible-ai"
---

# Azure AI Speech WAF — FAI Standards

When writing or reviewing Azure AI Speech code, enforce these WAF-aligned standards.

## Rules

### Speech-to-Text (STT) — Real-Time
1. Use `SpeechRecognizer` with `SpeechConfig.from_default_microphone()` for live microphone input or `AudioConfig.from_wav_file_input()` for file-based recognition.
2. Always set the recognition language explicitly: `speech_config.speech_recognition_language = "en-US"`. Auto-detection adds latency and reduces accuracy.
3. Use `recognize_once_async()` for single-utterance scenarios (commands, short inputs). Use continuous recognition for long-form audio (meetings, calls).
4. For continuous recognition, subscribe to `recognized` (final result), `recognizing` (partial/interim result), and `canceled` (error) events.
5. Enable automatic language detection with `AutoDetectSourceLanguageConfig` only for multi-language scenarios, providing the candidate language list to narrow detection.
6. Use `PhraseListGrammar` to boost recognition of domain-specific terms, product names, or jargon that the base model may miss.
7. Set `speech_config.set_property(PropertyId.Speech_SegmentationSilenceTimeoutMs, "500")` to tune endpoint detection for conversational vs. dictation use cases.

### Speech-to-Text — Batch Transcription
8. Use batch transcription API for processing pre-recorded audio at scale (call center recordings, podcast archives).
9. Submit batch jobs via REST API: `POST /speechtotext/v3.2/transcriptions` with Azure Blob Storage SAS URLs as input.
10. Configure batch options: `diarizationEnabled: true` for speaker separation, `wordLevelTimestampsEnabled: true` for subtitle generation.
11. Use webhook notifications (`destinationContainerUrl`) instead of polling for batch completion status.
12. Set `timeToLive` on batch results (e.g., `PT24H`) to auto-delete output files and reduce storage costs.

### Custom Speech Models
13. Train custom speech models only when base model word error rate (WER) exceeds acceptable thresholds on your domain audio.
14. Provide a minimum of 5 hours of labeled audio for custom acoustic models. Use plain text or structured text for language model adaptation.
15. Deploy custom endpoints with auto-scaling: configure minimum replicas for baseline and maximum for peak traffic.
16. Version custom models and A/B test new versions against production before full rollout.

### Text-to-Speech (TTS) — Neural Voices
17. Use neural voices exclusively — standard voices are deprecated. Specify voice with `speech_config.speech_synthesis_voice_name = "en-US-JennyNeural"`.
18. Use `SpeechSynthesizer` with `AudioConfig.from_audio_output_stream()` for streaming TTS output directly to a client, avoiding file I/O.
19. Handle `synthesis_completed`, `synthesis_started`, and `synthesis_canceled` events for monitoring long-form synthesis.
20. Use `viseme_received` event for lip-sync animation in avatar/visual applications.

### SSML for TTS
21. Use SSML for fine-grained speech control instead of plain text: `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">`.
22. Control prosody with `<prosody rate="slow" pitch="+5%">` for emphasis, pacing, and tone variation.
23. Insert pauses with `<break time="500ms"/>` between sentences or sections for natural phrasing.
24. Use `<say-as interpret-as="date" format="mdy">` for dates, numbers, phone numbers, and currency to ensure correct pronunciation.
25. Use `<phoneme alphabet="ipa" ph="ˈpɪkəˌtʃu">Pikachu</phoneme>` for custom pronunciation of proper nouns and technical terms.
26. Use `<voice name="en-US-GuyNeural">` to switch voices within a single SSML document for multi-character scenarios.
27. Apply `<mstts:express-as style="cheerful">` for emotional tone variation with supported neural voices.

### Speech Translation
28. Use `TranslationRecognizer` for real-time speech-to-speech or speech-to-text translation.
29. Configure source and target languages: `translation_config.speech_recognition_language = "en-US"` and `translation_config.add_target_language("fr")`.
30. Subscribe to `recognized` event to get both transcription and translation simultaneously.
31. For speech-to-speech translation, set `voice_name` on the target language for synthesized translation output.
32. Handle `no_match` results which indicate the speech was not recognized — provide user feedback or retry.

### Pronunciation Assessment
33. Use `PronunciationAssessmentConfig` for language learning and speech coaching applications.
34. Set grading system: `PronunciationAssessmentGradingSystem.HUNDRED_MARK` for 0-100 scoring.
35. Configure granularity: `PronunciationAssessmentGranularity.PHONEME` for detailed per-phoneme feedback including `AccuracyScore`, `FluencyScore`, `CompletenessScore`.
36. Provide reference text for read-aloud assessments — the API compares spoken audio against expected text.
37. Use content assessment mode for unscripted speech evaluation (topic, grammar, vocabulary scoring).

### Speaker Recognition
38. Use speaker verification for 1:1 identity confirmation (voice-based authentication). Requires enrollment with 3+ voice samples.
39. Use speaker identification for 1:N matching (who is speaking in a meeting). Enroll all candidate speakers in advance.
40. Use text-independent recognition for flexible voice authentication; text-dependent for higher security (fixed passphrase).
41. Store voice profiles server-side. Voice profile IDs are the only client-side artifact — never store raw voice biometric data.

### Audio Configuration
42. Use 16kHz, 16-bit, mono PCM as the baseline audio format for STT — it balances quality and bandwidth.
43. For telephony (8kHz audio), specify `AudioStreamFormat.get_compressed_format(AudioStreamContainerFormat.MULAW)` or use the telephony-optimized endpoint.
44. For TTS output, request `Audio24Khz160KBitRateMonoMp3` format for web streaming or `Riff24Khz16BitMonoPcm` for highest quality.
45. Use `PushAudioInputStream` or `PullAudioInputStream` for custom audio sources (WebSocket feeds, microphone arrays).

### WebSocket Streaming
46. For browser-based real-time STT, use the Speech SDK for JavaScript with WebSocket transport — it handles connection lifecycle, reconnection, and audio chunking.
47. Send audio in chunks of 100ms–200ms for optimal latency/quality tradeoff with real-time STT.
48. Implement connection resilience: handle WebSocket disconnects with automatic reconnection and audio buffering.
49. Use `Connection.fromRecognizer(recognizer)` to pre-warm the WebSocket connection before user starts speaking, reducing first-result latency.

### SDK Patterns & Client Management
50. Python: Use `azure-cognitiveservices-speech` package. TypeScript: Use `microsoft-cognitiveservices-speech-sdk`.
51. Create `SpeechConfig` once and reuse — do not recreate per recognition/synthesis request.
52. Dispose recognizers and synthesizers when done: `recognizer.close()` in Python, `.close()` in JS to release audio resources.
53. Use `DefaultAzureCredential` via `SpeechConfig.from_authorization_token()` — fetch token from Entra ID, cache for 9 minutes (token TTL is 10 min).

### Latency Optimization
54. Pre-connect the WebSocket before user interaction with `connection.open(forContinuousRecognition=True)`.
55. Use streaming TTS (`pull_audio_output_stream`) to start audio playback before full synthesis completes.
56. Deploy Speech resources in the same region as your application to minimize network latency.
57. For TTS, enable low-latency mode with `speech_config.set_property("SpeechSynthesis_FrameTimeoutInterval", "100")` for near-real-time avatar scenarios.

### Bicep Deployment
58. Deploy as `Microsoft.CognitiveServices/accounts` with `kind: "SpeechServices"` and appropriate SKU (`F0` for dev, `S0` for production).
59. Enable managed identity and disable key-based auth: `properties: { disableLocalAuth: true }`.
60. Configure private endpoints for VNet-integrated deployments. Use custom domain names for endpoint consistency.

## Patterns

```python
# Real-time STT with continuous recognition and domain boosting
import azure.cognitiveservices.speech as speechsdk

speech_config = speechsdk.SpeechConfig.from_subscription(
    subscription=os.environ["SPEECH_KEY"],
    region=os.environ["SPEECH_REGION"]
)
speech_config.speech_recognition_language = "en-US"

audio_config = speechsdk.AudioConfig(use_default_microphone=True)
recognizer = speechsdk.SpeechRecognizer(speech_config, audio_config)

# Boost domain-specific terms
phrase_list = speechsdk.PhraseListGrammar.from_recognizer(recognizer)
phrase_list.addPhrase("FAI")
phrase_list.addPhrase("Kubernetes")

def on_recognized(evt):
    if evt.result.reason == speechsdk.ResultReason.RecognizedSpeech:
        process_transcript(evt.result.text, confidence=evt.result.properties.get(
            speechsdk.PropertyId.SpeechServiceResponse_JsonResult))

recognizer.recognized.connect(on_recognized)
recognizer.canceled.connect(lambda evt: log.error("Canceled: %s", evt.error_details))

recognizer.start_continuous_recognition()
```

```python
# TTS with SSML and streaming output
ssml = """
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"
       xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="en-US">
  <voice name="en-US-JennyNeural">
    <mstts:express-as style="friendly">
      Welcome to <phoneme alphabet="ipa" ph="fruːt">Froot</phoneme> AI.
      <break time="300ms"/>
      <prosody rate="-10%">Let me walk you through the setup process.</prosody>
    </mstts:express-as>
  </voice>
</speak>
"""

synthesizer = speechsdk.SpeechSynthesizer(
    speech_config=speech_config,
    audio_config=None  # Manual stream handling
)
result = synthesizer.speak_ssml_async(ssml).get()
if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
    stream = speechsdk.AudioDataStream(result)
    stream.save_to_wav_file("output.wav")
```

```python
# Pronunciation assessment for language learning
pronunciation_config = speechsdk.PronunciationAssessmentConfig(
    reference_text="The quick brown fox jumps over the lazy dog",
    grading_system=speechsdk.PronunciationAssessmentGradingSystem.HundredMark,
    granularity=speechsdk.PronunciationAssessmentGranularity.Phoneme
)
pronunciation_config.apply_to(recognizer)

result = recognizer.recognize_once()
assessment = speechsdk.PronunciationAssessmentResult(result)
print(f"Accuracy: {assessment.accuracy_score}")
print(f"Fluency: {assessment.fluency_score}")
print(f"Completeness: {assessment.completeness_score}")
print(f"Pronunciation: {assessment.pronunciation_score}")
```

```bicep
// Speech Services with managed identity
resource speechAccount 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: speechAccountName
  location: location
  kind: 'SpeechServices'
  sku: { name: 'S0' }
  identity: { type: 'SystemAssigned' }
  properties: {
    disableLocalAuth: true
    publicNetworkAccess: 'Disabled'
    customSubDomainName: speechAccountName
  }
}
```

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|---|---|---|
| Recreating `SpeechConfig` per request | Unnecessary overhead, repeated auth handshake | Create once, reuse across requests |
| Not closing recognizers/synthesizers | Audio device leaks, memory bloat | Always call `.close()` when done |
| Polling batch transcription status | Wastes compute, delayed response | Use webhook notifications |
| Plain text for TTS with numbers/dates | "Jan 1 2025" read as words, not a date | Use SSML `<say-as>` for correct interpretation |
| Auto-detect language without candidate list | High latency, frequent misdetection | Provide specific candidate languages |
| 48kHz audio input for telephony STT | Wasted bandwidth, no quality improvement | Match audio format to source (8kHz for telephony) |
| Storing voice biometric data on client | Privacy violation, security risk | Store server-side voice profile IDs only |
| No connection pre-warming | High first-result latency for STT | Use `Connection.open()` before user speaks |
| Ignoring `canceled` events | Silent failures, lost transcriptions | Always handle error/cancellation callbacks |
| Using standard voices instead of neural | Poor quality, deprecated by Microsoft | Always use neural voices |

## Testing

- Unit test event handler logic with mock `SpeechRecognitionResult` objects at various confidence levels.
- Integration test STT with known audio files (WAV) and assert transcript matches expected text within acceptable WER (< 10%).
- Test TTS SSML by generating audio and validating duration, format, and non-empty output.
- Test pronunciation assessment with known good and poor audio samples — verify score ranges are correct.
- Load test WebSocket streaming with concurrent connections to verify connection limits and latency under load.
- Test batch transcription with multi-speaker audio to verify diarization accuracy.
- Validate Bicep templates with `az bicep build` and `what-if` deployment.
- Test reconnection logic by simulating WebSocket disconnects mid-stream.

## WAF Alignment

| Pillar | Implementation |
|---|---|
| **Performance Efficiency** | WebSocket pre-warming, streaming TTS output, phrase list boosting, regional deployment, audio format matching, connection reuse |
| **Reliability** | WebSocket reconnection with buffering, event-based error handling, custom endpoint auto-scaling, batch webhook notifications |
| **Security** | Managed Identity auth, disabled local auth, private endpoints, voice profile server-side storage, no biometric data on client |
| **Cost Optimization** | F0 tier for dev/test, batch transcription TTL for auto-cleanup, right-sized audio formats, custom model only when base WER exceeds threshold |
| **Responsible AI** | Speaker recognition consent workflows, voice cloning usage agreements for custom voice, no biometric data persistence on client, privacy-first audio handling |
