---
name: "deploy-ai-podcast-generator"
description: "Deploy AI Podcast Generator — script writing from topics, multi-voice TTS with SSML prosody, audio post-processing, music integration, publishing automation."
---

# Deploy AI Podcast Generator

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- Azure Speech Service with Neural Voice access
- Python 3.11+ with `azure-openai`, `azure-cognitiveservices-speech`, `pydub`

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-podcast \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure OpenAI | Script generation + research (gpt-4o) | S0 |
| Azure Speech Service | Multi-voice Neural TTS with SSML | S0 |
| Azure Content Safety | Script content moderation | S0 |
| Azure AI Search | Source material retrieval for research | Basic |
| Azure Storage | Audio files, scripts, music assets | Standard LRS |
| Azure CDN | Audio delivery for podcast hosting | Standard |
| Container Apps | Generation API + management dashboard | Consumption |
| Azure Key Vault | API keys | Standard |

## Step 2: Deploy Script Generation Engine

```python
SCRIPT_FORMATS = {
    "interview": {
        "speakers": [{"role": "Host", "style": "curious_engaging"}, {"role": "Expert", "style": "knowledgeable_friendly"}],
        "structure": ["intro_hook", "topic_overview", "deep_dive_q1", "deep_dive_q2", "deep_dive_q3", "takeaways", "outro"],
        "avg_duration_min": 20
    },
    "monologue": {
        "speakers": [{"role": "Host", "style": "storytelling"}],
        "structure": ["hook", "context", "main_point_1", "main_point_2", "main_point_3", "conclusion", "call_to_action"],
        "avg_duration_min": 10
    },
    "debate": {
        "speakers": [{"role": "Moderator", "style": "neutral"}, {"role": "Pro", "style": "passionate_advocate"}, {"role": "Con", "style": "skeptical_critic"}],
        "structure": ["intro", "opening_statements", "round_1", "round_2", "rebuttals", "closing"],
        "avg_duration_min": 25
    },
    "panel": {
        "speakers": [{"role": "Host", "style": "moderator"}, {"role": "Panelist1", "style": "expert"}, {"role": "Panelist2", "style": "practitioner"}, {"role": "Panelist3", "style": "contrarian"}],
        "structure": ["intro", "round_robin", "discussion", "audience_questions", "takeaways"],
        "avg_duration_min": 30
    }
}

SCRIPT_PROMPT = """Write a podcast script on: {topic}

Format: {format_type}
Speakers: {speakers}
Target duration: {duration_min} minutes (~{word_count} words at 150 words/min)
Sources: {sources}

Rules:
1. Write as NATURAL conversation, not article. Include "um", "right?", "that's interesting"
2. Each speaker has distinct personality and word choices
3. Include source citations: "According to [Source]..."
4. Add [PAUSE:2s] markers for natural breaks
5. Mark emotions: [LAUGH], [EMPHASIS], [THOUGHTFUL]
6. Hook the listener in first 30 seconds
7. End with clear takeaway or call to action
8. No two speakers should agree on everything — include respectful disagreement"""
```

## Step 3: Deploy Multi-Voice TTS with SSML

```python
VOICE_ASSIGNMENTS = {
    "Host_male": "en-US-GuyNeural",
    "Host_female": "en-US-JennyNeural",
    "Expert_male": "en-US-DavisNeural",
    "Expert_female": "en-US-AriaNeural",
    "Narrator": "en-US-BrandonNeural",
    "Casual_male": "en-US-JasonNeural",
    "Casual_female": "en-US-SaraNeural"
}

def generate_ssml(text: str, speaker: Speaker, emotion: str = None) -> str:
    """Generate SSML for natural-sounding speech."""
    ssml = f"""<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" 
               xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
    <voice name="{speaker.voice_id}">
        <mstts:express-as style="{emotion or 'chat'}">
            <prosody rate="{speaker.speaking_rate}" pitch="{speaker.pitch}">
                {process_markers(text)}
            </prosody>
        </mstts:express-as>
    </voice>
    </speak>"""
    return ssml

def process_markers(text: str) -> str:
    """Convert script markers to SSML."""
    text = text.replace("[PAUSE:2s]", '<break time="2s"/>')
    text = text.replace("[PAUSE:1s]", '<break time="1s"/>')
    text = text.replace("[EMPHASIS]", '<emphasis level="strong">')
    text = text.replace("[/EMPHASIS]", '</emphasis>')
    text = text.replace("[LAUGH]", '<break time="500ms"/>')  # Pause for laughter
    return text
```

## Step 4: Deploy Audio Post-Processing

```python
from pydub import AudioSegment, effects

async def post_process(segments: list[AudioSegment], config: PostProcessConfig) -> AudioSegment:
    """Assemble and polish final podcast audio."""
    
    # 1. Add intro music (fade in 3s)
    intro = AudioSegment.from_mp3(config.intro_music)
    intro = intro[:15000].fade_in(3000).fade_out(2000)  # 15s intro
    
    # 2. Crossfade between speaker segments
    podcast = intro
    for i, segment in enumerate(segments):
        if i > 0:
            # Add transition sound between speakers
            transition = AudioSegment.from_mp3(config.transition_sound)
            podcast = podcast.append(transition[:500], crossfade=200)
        podcast = podcast.append(segment, crossfade=100)
    
    # 3. Add outro music (fade out 5s)
    outro = AudioSegment.from_mp3(config.outro_music)
    outro = outro[:20000].fade_in(2000).fade_out(5000)
    podcast = podcast.append(outro, crossfade=2000)
    
    # 4. Loudness normalization (-16 LUFS for podcasts)
    podcast = effects.normalize(podcast)
    podcast = podcast.apply_gain(-16 - podcast.dBFS)
    
    # 5. Export as MP3 320kbps
    podcast.export("output.mp3", format="mp3", bitrate="320k",
        tags={"title": config.title, "artist": config.show_name, "album": config.show_name})
    
    return podcast
```

## Step 5: Deploy Publishing Pipeline

```python
PUBLISHING_TARGETS = {
    "rss_feed": {
        "description": "Generate RSS feed for podcast directories",
        "fields": ["title", "description", "audio_url", "duration", "pub_date", "image"],
        "spec": "RSS 2.0 with iTunes namespace"
    },
    "blob_storage": {
        "description": "Upload audio to Azure Blob + CDN",
        "container": "podcast-episodes",
        "cdn_endpoint": "https://podcast.azureedge.net"
    },
    "transcript": {
        "description": "Generate searchable transcript from script",
        "format": "SRT + full text",
        "include_timestamps": True
    }
}

async def publish_episode(episode: PodcastEpisode, config: PublishConfig) -> PublishResult:
    # Upload audio to blob + CDN
    audio_url = await upload_to_blob(episode.audio, f"episodes/{episode.id}.mp3")
    
    # Generate RSS entry
    rss_entry = generate_rss_item(episode, audio_url)
    await update_rss_feed(rss_entry)
    
    # Generate transcript (SRT + full text)
    transcript = await generate_transcript(episode.script)
    
    return PublishResult(audio_url=audio_url, rss_updated=True, transcript=transcript)
```

## Step 6: Smoke Test

```bash
# Generate a podcast episode
curl -s https://api-podcast.azurewebsites.net/api/generate \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"topic": "The future of AI in healthcare", "format": "interview", "duration_min": 15}' | jq '.episode_id, .duration_sec'

# Get script preview
curl -s https://api-podcast.azurewebsites.net/api/preview \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"episode_id": "..."}' | jq '.script.segments[:3]'

# Publish episode
curl -s https://api-podcast.azurewebsites.net/api/publish \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"episode_id": "..."}' | jq '.audio_url, .rss_updated'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Script sounds like article | Temperature too low | Increase to 0.7, add conversational markers |
| TTS robotic voice | No SSML prosody | Add rate/pitch variation, express-as styles |
| Volume spikes between speakers | No normalization | Apply -16 LUFS normalization in post-processing |
| Episode too long/short | Word count mismatch | Calibrate: ~150 words/min for speech |
| Content safety flag on script | Generated inappropriate content | Pre-check script with Content Safety before TTS |
