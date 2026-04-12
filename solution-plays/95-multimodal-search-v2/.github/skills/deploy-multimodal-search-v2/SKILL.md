---
name: "deploy-multimodal-search-v2"
description: "Deploy Multimodal Search V2 — unified text+image+audio+video indexing, cross-modal retrieval (text→image, image→text), late fusion ranking, personalization."
---

# Deploy Multimodal Search V2

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- Multi-format content library (documents, images, audio, video)
- Python 3.11+ with `azure-openai`, `azure-search-documents`, `librosa`, `Pillow`

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-multimodal-search \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure OpenAI | Text embedding (text-embedding-3-large) + CLIP visual | S0 |
| Azure AI Search | 4 vector indices (text, image, audio, video) | Standard S1 |
| Azure Speech (Whisper) | Audio → transcript for embedding | S0 |
| Azure AI Vision | Video key frame extraction | S0 |
| Azure Storage | Source media files (images, audio, video) | Standard LRS |
| Azure CDN | Media delivery | Standard |
| Cosmos DB | User preferences, search analytics | Serverless |
| Container Apps | Multimodal search API | Consumption |

## Step 2: Build Per-Modality Encoding Pipeline

```python
# Modality-specific encoders
ENCODERS = {
    "text": {
        "model": "text-embedding-3-large",
        "dimensions": 1536,
        "input": "raw text or document content"
    },
    "image": {
        "model": "clip-vit-large-patch14",
        "dimensions": 768,
        "input": "image pixels (preprocessed 224x224)"
    },
    "audio": {
        "model": "whisper-large-v3 → text-embedding-3-large",
        "dimensions": 1536,
        "input": "audio file → transcript → text embedding",
        "pipeline": ["transcribe", "chunk", "embed"]
    },
    "video": {
        "model": "key_frames → clip + transcript → text-embedding-3-large",
        "dimensions": {"visual": 768, "transcript": 1536},
        "input": "extract key frames (1/sec) + audio transcript",
        "pipeline": ["extract_frames", "transcribe_audio", "embed_frames", "embed_transcript"]
    }
}

async def index_document(doc: MultimodalDocument):
    """Index a document across all relevant modality indices."""
    embeddings = {}
    
    if doc.text:
        embeddings["text"] = await text_encoder.encode(doc.text)
    
    if doc.images:
        for img in doc.images:
            embeddings[f"image_{img.id}"] = await vision_encoder.encode(img.data)
    
    if doc.audio:
        transcript = await whisper.transcribe(doc.audio)
        embeddings["audio"] = await text_encoder.encode(transcript)
        doc.metadata["transcript"] = transcript
    
    if doc.video:
        frames = extract_key_frames(doc.video, fps=1)
        transcript = await whisper.transcribe(doc.video.audio_track)
        embeddings["video_visual"] = await vision_encoder.encode(frames[len(frames)//2])  # Middle frame
        embeddings["video_transcript"] = await text_encoder.encode(transcript)
    
    # Index into per-modality search indices
    for modality, embedding in embeddings.items():
        await search_indices[modality.split("_")[0]].upload_documents([{
            "id": f"{doc.id}_{modality}",
            "doc_id": doc.id,
            "embedding": embedding.tolist(),
            "modality": modality.split("_")[0],
            "title": doc.title,
            "source": doc.source,
            "metadata": doc.metadata
        }])
```

## Step 3: Deploy Cross-Modal Search Engine

```python
async def multimodal_search(
    query_text: str = None,
    query_image: bytes = None,
    modalities: list[str] = ["text", "image", "audio", "video"],
    top_k: int = 20
) -> list[SearchResult]:
    """Unified search across all modalities with cross-modal retrieval."""
    
    # 1. Encode query in available representations
    query_vectors = {}
    if query_text:
        query_vectors["text"] = await text_encoder.encode(query_text)
        query_vectors["clip_text"] = await clip_text_encoder.encode(query_text)  # For cross-modal
    if query_image:
        query_vectors["image"] = await vision_encoder.encode(query_image)
    
    # 2. Search each modality index
    results_per_modality = {}
    
    if "text" in modalities and "text" in query_vectors:
        results_per_modality["text"] = await text_index.search(
            vector=query_vectors["text"], top=top_k)
    
    if "image" in modalities:
        # Cross-modal: text query → CLIP text embedding → image index
        vec = query_vectors.get("image") or query_vectors.get("clip_text")
        if vec:
            results_per_modality["image"] = await image_index.search(vector=vec, top=top_k)
    
    if "audio" in modalities and "text" in query_vectors:
        # Audio transcripts are text-embedded, so text query works
        results_per_modality["audio"] = await audio_index.search(
            vector=query_vectors["text"], top=top_k)
    
    if "video" in modalities:
        # Video has both visual + transcript embeddings
        vid_results = []
        if "text" in query_vectors:
            vid_results.extend(await video_transcript_index.search(
                vector=query_vectors["text"], top=top_k))
        if "clip_text" in query_vectors:
            vid_results.extend(await video_visual_index.search(
                vector=query_vectors["clip_text"], top=top_k))
        results_per_modality["video"] = deduplicate(vid_results)
    
    # 3. Late fusion: merge and re-rank
    merged = late_fusion_rank(results_per_modality, 
        weights={"text": 0.4, "image": 0.3, "audio": 0.2, "video": 0.1})
    
    return merged[:top_k]
```

## Step 4: Deploy Late Fusion Ranker

```python
def late_fusion_rank(
    results_per_modality: dict[str, list],
    weights: dict[str, float],
    user_preferences: dict = None
) -> list[SearchResult]:
    """Merge results from multiple modalities with weighted scoring."""
    
    all_results = {}
    for modality, results in results_per_modality.items():
        weight = weights.get(modality, 0.1)
        
        # Adjust weight by user preference
        if user_preferences and modality in user_preferences.get("preferred_modalities", []):
            weight *= 1.3  # Boost preferred formats
        
        for rank, result in enumerate(results):
            doc_id = result.doc_id
            if doc_id not in all_results:
                all_results[doc_id] = {"result": result, "score": 0, "modalities_matched": []}
            
            # Reciprocal rank fusion
            rrf_score = weight / (60 + rank)
            all_results[doc_id]["score"] += rrf_score
            all_results[doc_id]["modalities_matched"].append(modality)
    
    # Sort by fused score, bonus for multi-modal matches
    for doc_id, entry in all_results.items():
        multi_modal_bonus = len(entry["modalities_matched"]) * 0.05
        entry["score"] += multi_modal_bonus
    
    ranked = sorted(all_results.values(), key=lambda x: x["score"], reverse=True)
    return [r["result"] for r in ranked]
```

## Step 5: Deploy Video Processing Pipeline

```python
async def process_video(video_path: str) -> VideoIndexData:
    """Extract searchable content from video."""
    
    # 1. Extract key frames (1 per second, deduplicate similar)
    frames = extract_key_frames(video_path, fps=1)
    unique_frames = deduplicate_frames(frames, threshold=0.85)  # Keep visually distinct frames
    
    # 2. Transcribe audio track
    transcript = await whisper.transcribe(video_path)
    
    # 3. Scene detection (segment video into scenes)
    scenes = detect_scenes(video_path)
    
    # 4. Embed representative frame per scene + transcript per scene
    scene_data = []
    for scene in scenes:
        representative_frame = unique_frames[scene.middle_frame_idx]
        visual_embedding = await vision_encoder.encode(representative_frame)
        scene_transcript = transcript.slice(scene.start_sec, scene.end_sec)
        text_embedding = await text_encoder.encode(scene_transcript)
        
        scene_data.append(SceneIndex(
            scene_id=scene.id, visual_embedding=visual_embedding,
            text_embedding=text_embedding, transcript=scene_transcript,
            start_sec=scene.start_sec, end_sec=scene.end_sec
        ))
    
    return VideoIndexData(scenes=scene_data, full_transcript=transcript)
```

## Step 6: Smoke Test

```bash
# Text-to-all search
curl -s https://api-multimodal.azurewebsites.net/api/search \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query": "machine learning model training", "modalities": ["text", "image", "audio", "video"]}' | jq '.results[:3] | .[].modality'

# Image-to-similar search
curl -s https://api-multimodal.azurewebsites.net/api/search \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@evaluation/data/sample.jpg" \
  -F "modalities=image,video" | jq '.results[:3]'

# Cross-modal: text → video
curl -s https://api-multimodal.azurewebsites.net/api/search \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query": "how to deploy a Kubernetes cluster", "modalities": ["video"]}' | jq '.results[:3] | .[].title'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Cross-modal relevance poor | Text and image in different embedding spaces | Use CLIP for shared text-image space |
| Audio search misses content | Whisper transcription errors | Check transcript quality, use large-v3 model |
| Video indexing too slow | Processing every frame | Extract 1 frame/sec, deduplicate similar frames |
| Fusion favors one modality | Weights imbalanced | Adjust per-modality weights, validate with test queries |
| Results from wrong modality | No modality filtering | Add modality filter parameter to search |
