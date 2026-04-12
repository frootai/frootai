---
name: "deploy-visual-product-search"
description: "Deploy Visual Product Search — CLIP/Florence visual encoding, product catalog vector indexing, multi-modal search (image+text), reranking, shoppable image recognition."
---

# Deploy Visual Product Search

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- Product catalog with images (≥1,000 products with photos)
- Python 3.11+ with `azure-openai`, `azure-search-documents`, `Pillow`, `transformers`

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-visual-search \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure OpenAI | CLIP/Florence visual encoding + attribute extraction | S0 |
| Azure AI Search | Product vector index with hybrid search | Standard S1 |
| Azure Storage | Product images + query image uploads | Standard LRS |
| Azure CDN | Image delivery with resizing transforms | Standard |
| Cosmos DB | Product metadata, search analytics, click-through logs | Serverless |
| Container Apps | Visual search API | Consumption |
| Azure Key Vault | API keys | Standard |
| Azure Content Safety | Moderate user-uploaded images | S0 |

## Step 2: Build Product Visual Index

```python
# Product catalog indexing pipeline
async def index_product_catalog(products: list[Product]) -> IndexStats:
    """Generate visual embeddings for entire product catalog."""
    stats = {"indexed": 0, "failed": 0}
    
    for product in products:
        for image_url in product.image_urls:
            # 1. Download and preprocess
            img = await download_image(image_url)
            
            # 2. Remove background (focus on product)
            product_crop = await remove_background(img)
            
            # 3. Generate visual embedding (CLIP ViT-L/14 = 768-dim)
            embedding = await vision_encoder.encode(product_crop)
            
            # 4. Extract attributes (color, category, pattern, material)
            attributes = await extract_attributes(product_crop)
            
            # 5. Index in AI Search
            await search_client.upload_documents([{
                "id": f"{product.id}_{hash(image_url)}",
                "product_id": product.id,
                "embedding": embedding.tolist(),  # Vector field
                "title": product.title,
                "category": product.category,
                "price": product.price,
                "in_stock": product.in_stock,
                "color": attributes.color,
                "pattern": attributes.pattern,
                "material": attributes.material,
                "image_url": image_url
            }])
            stats["indexed"] += 1
    
    return stats

# Visual attribute extraction
PRODUCT_ATTRIBUTES = {
    "color": ["red", "blue", "green", "black", "white", "brown", "navy", "beige", "pink", "gray"],
    "pattern": ["solid", "striped", "floral", "plaid", "geometric", "animal_print", "abstract"],
    "material": ["cotton", "leather", "silk", "denim", "polyester", "wool", "metal", "wood"],
    "style": ["casual", "formal", "sporty", "vintage", "modern", "bohemian", "minimalist"],
    "shape": ["round", "square", "rectangular", "oval", "irregular"]
}
```

## Step 3: Deploy Multi-Modal Search Engine

```python
async def visual_search(query_image: bytes, text_hint: str = None, filters: dict = None) -> list[ProductMatch]:
    """Multi-modal visual product search."""
    
    # 1. Content safety check on uploaded image
    safety = await content_safety.analyze(query_image)
    if safety.is_unsafe:
        raise ValueError("Uploaded image flagged for content safety")
    
    # 2. Generate query embedding
    image_embedding = await vision_encoder.encode(query_image)
    
    # 3. Multi-modal fusion (image + text)
    if text_hint:
        text_embedding = await text_encoder.encode(text_hint)
        query_vector = fuse_embeddings(
            image_embedding, text_embedding,
            weights=(0.7, 0.3)  # Image-dominant, text refines
        )
    else:
        query_vector = image_embedding
    
    # 4. Vector search with optional filters
    search_options = {
        "vector": query_vector,
        "top": 20,
        "select": ["product_id", "title", "price", "image_url", "color", "category"]
    }
    if filters:
        odata_filter = build_filter(filters)  # e.g., "price lt 100 and in_stock eq true"
        search_options["filter"] = odata_filter
    
    results = await search_client.search(**search_options)
    
    # 5. Rerank by visual similarity + business factors
    reranked = rerank(results, weights={
        "visual_similarity": 0.50,
        "in_stock": 0.15,
        "popularity": 0.15,
        "price_relevance": 0.10,
        "recency": 0.10
    })
    
    return reranked[:10]
```

## Step 4: Deploy Shoppable Image Recognition

```python
async def detect_shoppable_items(scene_image: bytes) -> list[ShoppableItem]:
    """Detect and match individual products within a scene/lifestyle image."""
    
    # 1. Object detection (find individual products in scene)
    detections = await object_detector.detect(scene_image, categories=["clothing", "furniture", "accessories", "electronics"])
    
    shoppable = []
    for det in detections:
        # 2. Crop detected product region
        crop = crop_region(scene_image, det.bbox)
        
        # 3. Visual search for matching catalog products
        matches = await visual_search(crop, top_k=5)
        
        shoppable.append(ShoppableItem(
            bbox=det.bbox,
            category=det.category,
            matches=matches,
            confidence=det.confidence
        ))
    
    return shoppable
```

## Step 5: Deploy Click-Through Feedback Loop

```python
# Track user interactions to improve ranking
FEEDBACK_EVENTS = {
    "search_performed": {"fields": ["query_image_hash", "text_hint", "result_count"]},
    "result_clicked": {"fields": ["query_image_hash", "clicked_product_id", "position"]},
    "product_added_to_cart": {"fields": ["query_image_hash", "product_id"]},
    "product_purchased": {"fields": ["query_image_hash", "product_id"]}
}

# Periodically retrain reranking model on click-through data
async def retrain_reranker():
    """Fine-tune reranking weights from click-through data."""
    clicks = await get_click_data(days=30)
    # Learn: which visual features predict click-through
    # Update reranking weights accordingly
    new_weights = train_reranker(clicks)
    await update_reranking_config(new_weights)
```

## Step 6: Smoke Test

```bash
# Visual search with image
curl -s https://api-visual-search.azurewebsites.net/api/search \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@evaluation/data/sample_shoe.jpg" | jq '.results[:3] | .[].title'

# Multi-modal search (image + text)
curl -s https://api-visual-search.azurewebsites.net/api/search \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@evaluation/data/sample_dress.jpg" \
  -F "text_hint=blue version" | jq '.results[:3]'

# Shoppable image
curl -s https://api-visual-search.azurewebsites.net/api/shoppable \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@evaluation/data/lifestyle_photo.jpg" | jq '.items[:3] | .[].category'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Poor visual match quality | Generic embeddings, not fine-tuned | Fine-tune encoder on product catalog images |
| Background noise in matches | Original product images have cluttered background | Apply background removal before encoding |
| Slow search (>500ms) | Vector index not optimized | Enable HNSW index, reduce embedding dimensions |
| Multi-modal ignores text | Text weight too low | Increase text weight from 0.3 to 0.5 |
| Shoppable detection misses items | Object detector not trained on product types | Fine-tune detector on retail scene dataset |
