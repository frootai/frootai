---
name: "deploy-ai-data-marketplace"
description: "Deploy AI Data Marketplace — dataset discovery with quality scoring, privacy-preserving sharing, synthetic data augmentation, license management, data lineage."
---

# Deploy AI Data Marketplace

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- Dataset catalog (metadata for available datasets)
- Python 3.11+ with `azure-openai`, `azure-search-documents`, `sdv` (synthetic data)

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-data-marketplace \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure OpenAI | Dataset description generation + semantic search | S0 |
| Azure AI Search | Dataset catalog with semantic + vector search | Standard S1 |
| Azure Purview | Data lineage tracking + governance | Standard |
| Cosmos DB | Dataset metadata, listings, transactions, reviews | Serverless |
| Azure Storage | Dataset files, samples, synthetic outputs | Standard LRS |
| Azure Functions | Quality scoring + privacy scanning pipelines | Consumption |
| Container Apps | Marketplace API + portal | Consumption |
| Azure Key Vault | API keys + data provider credentials | Standard |

## Step 2: Deploy Dataset Quality Scoring Engine

```python
QUALITY_DIMENSIONS = {
    "completeness": {
        "description": "Percentage of non-null values across all columns",
        "weight": 0.25,
        "method": "null_count_ratio",
        "threshold": {"excellent": 0.98, "good": 0.90, "fair": 0.80, "poor": 0.70}
    },
    "consistency": {
        "description": "Values match expected format/schema",
        "weight": 0.20,
        "method": "schema_validation + regex_match",
        "checks": ["data_type_match", "format_consistency", "range_validation"]
    },
    "accuracy": {
        "description": "Spot-check sample against authoritative source",
        "weight": 0.25,
        "method": "sample_verification",
        "sample_size": 100
    },
    "timeliness": {
        "description": "How recent is the data? When last updated?",
        "weight": 0.15,
        "method": "last_updated_age",
        "threshold": {"excellent": 7, "good": 30, "fair": 90, "poor": 365}  # days
    },
    "uniqueness": {
        "description": "Duplicate record rate",
        "weight": 0.15,
        "method": "duplicate_detection",
        "threshold": {"excellent": 0.01, "good": 0.05, "fair": 0.10, "poor": 0.20}
    }
}

async def score_dataset(dataset: Dataset) -> QualityReport:
    """Score dataset quality across 5 dimensions."""
    scores = {}
    for dim, config in QUALITY_DIMENSIONS.items():
        score = await evaluate_dimension(dataset, dim, config)
        scores[dim] = {"score": score, "weight": config["weight"],
            "grade": grade_score(score, config["threshold"])}
    
    overall = sum(s["score"] * s["weight"] for s in scores.values())
    return QualityReport(scores=scores, overall=overall, grade=overall_grade(overall))
```

## Step 3: Deploy Privacy-Preserving Data Sharing

```python
PRIVACY_LEVELS = {
    "public": {
        "description": "Open data, no PII, free to use",
        "checks": ["no_pii_scan", "license_verified"],
        "access": "open"
    },
    "anonymized": {
        "description": "PII removed via k-anonymity / differential privacy",
        "checks": ["pii_removed", "k_anonymity_verified", "re_identification_risk_low"],
        "access": "registered_users",
        "techniques": ["k_anonymity", "l_diversity", "differential_privacy"]
    },
    "synthetic": {
        "description": "AI-generated synthetic data preserving statistical properties",
        "checks": ["no_real_records", "statistical_fidelity_verified"],
        "access": "registered_users",
        "generator": "sdv_gaussian_copula"
    },
    "confidential": {
        "description": "Confidential compute — data never leaves enclave",
        "checks": ["enclave_verified", "access_logged", "nda_signed"],
        "access": "approved_only",
        "compute": "azure_confidential_computing"
    }
}

async def prepare_for_sharing(dataset: Dataset, target_level: str) -> PreparedDataset:
    """Apply privacy controls before listing."""
    level = PRIVACY_LEVELS[target_level]
    
    # Scan for PII
    pii_results = await scan_for_pii(dataset)
    if pii_results.has_pii and target_level in ["public", "anonymized"]:
        if target_level == "anonymized":
            dataset = await anonymize_dataset(dataset, method="k_anonymity", k=5)
        else:
            raise ValueError(f"Dataset contains PII, cannot list as {target_level}")
    
    # Generate sample preview
    sample = dataset.sample(n=min(100, len(dataset)), random_state=42)
    
    return PreparedDataset(data=dataset, privacy_level=target_level, sample=sample,
        pii_scan=pii_results, quality_score=await score_dataset(dataset))
```

## Step 4: Deploy Synthetic Data Generator

```python
from sdv.single_table import GaussianCopulaSynthesizer

async def generate_synthetic(original: Dataset, num_rows: int) -> SyntheticDataset:
    """Generate privacy-safe synthetic data preserving statistical properties."""
    
    # 1. Learn statistical distribution
    synthesizer = GaussianCopulaSynthesizer(metadata)
    synthesizer.fit(original.to_dataframe())
    
    # 2. Generate synthetic rows
    synthetic = synthesizer.sample(num_rows=num_rows)
    
    # 3. Validate statistical fidelity
    fidelity = evaluate_synthetic_quality(original, synthetic)
    # Checks: column distributions match, correlations preserved, no real records copied
    
    # 4. Verify no real records leaked
    overlap = check_record_overlap(original, synthetic)
    assert overlap == 0, f"Synthetic data contains {overlap} real records!"
    
    return SyntheticDataset(data=synthetic, fidelity_score=fidelity,
        real_record_overlap=overlap, method="gaussian_copula")
```

## Step 5: Deploy Dataset Catalog + Search

```python
# Index dataset catalog for semantic search
CATALOG_SCHEMA = {
    "id": str, "name": str, "description": str,
    "provider": str, "category": str,
    "schema_summary": str,  # Columns + types + sample values
    "quality_score": float, "privacy_level": str,
    "license": str, "price": float,
    "row_count": int, "column_count": int,
    "last_updated": str, "tags": list,
    "embedding": list  # Semantic embedding of description + schema
}

async def search_datasets(query: str, filters: dict = None) -> list[DatasetListing]:
    """Semantic search over dataset catalog."""
    embedding = await embed(query)
    results = await search_client.search(
        vector=embedding, top=20,
        filter=build_filter(filters),  # e.g., "quality_score gt 80 and privacy_level eq 'public'"
        select=["id", "name", "description", "quality_score", "privacy_level", "price"]
    )
    return results
```

## Step 6: Deploy License & Lineage Management

```python
LICENSE_TYPES = {
    "cc_by_4": {"commercial": True, "attribution": True, "share_alike": False},
    "cc_by_sa_4": {"commercial": True, "attribution": True, "share_alike": True},
    "commercial": {"commercial": True, "attribution": False, "custom_terms": True},
    "research_only": {"commercial": False, "attribution": True, "academic_only": True},
    "restricted": {"commercial": False, "nda_required": True, "approved_use_only": True}
}

# Data lineage tracking via Azure Purview
LINEAGE_EVENTS = ["ingestion", "transformation", "anonymization", "synthetic_generation",
                   "listing", "purchase", "download"]
```

## Step 7: Smoke Test

```bash
# Search datasets
curl -s https://api-marketplace.azurewebsites.net/api/search \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query": "customer demographics US 2025", "filters": {"quality_score_min": 80}}' | jq '.datasets[:3]'

# Get quality report
curl -s https://api-marketplace.azurewebsites.net/api/quality \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"dataset_id": "ds-001"}' | jq '.overall, .scores'

# Generate synthetic version
curl -s https://api-marketplace.azurewebsites.net/api/synthetic \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"dataset_id": "ds-001", "num_rows": 10000}' | jq '.fidelity_score, .real_record_overlap'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Quality score always low | Threshold too strict | Calibrate per data type (logs vs curated) |
| PII scan false positives | Names in product columns | Add column-type hints to PII scanner |
| Synthetic data distribution skewed | Too few training rows | Need ≥1000 rows for Gaussian Copula |
| Search returns irrelevant datasets | Schema not in embedding | Embed description + schema summary together |
| Lineage gaps | Provider didn't register source | Enforce mandatory lineage at ingestion |
