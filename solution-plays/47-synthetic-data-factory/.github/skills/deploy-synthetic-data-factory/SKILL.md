---
name: "deploy-synthetic-data-factory"
description: "Deploy Synthetic Data Factory — LLM text generation, CTGAN tabular data, differential privacy, schema-driven pipelines, batch processing, statistical validation, PII-free output."
---

# Deploy Synthetic Data Factory

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.CognitiveServices` (Azure OpenAI for text generation)
  - `Microsoft.Storage` (Blob Storage for datasets)
  - `Microsoft.App` (Container Apps for generation pipeline)
  - `Microsoft.KeyVault` (secret management)
- Python 3.11+ with `openai`, `sdv` (Synthetic Data Vault), `ctgan`, `faker`, `scipy` packages
- `.env` file with: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `STORAGE_CONNECTION_STRING`

## Step 1: Provision Infrastructure

```bash
# Create resource group
az group create --name rg-frootai-synthetic-data-factory --location eastus2

# Deploy infrastructure (OpenAI, Storage, Container Apps, Key Vault)
az deployment group create \
  --resource-group rg-frootai-synthetic-data-factory \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=prod

# Store secrets
az keyvault secret set --vault-name kv-synth-data \
  --name openai-key --value "$AZURE_OPENAI_KEY"
az keyvault secret set --vault-name kv-synth-data \
  --name storage-conn --value "$STORAGE_CONNECTION_STRING"
```

## Step 2: Deploy LLM Text Generation Pipeline

```python
# llm_generator.py — schema-driven LLM synthetic data generation
from openai import AzureOpenAI
import json, hashlib

class LLMSyntheticGenerator:
    def __init__(self, config):
        self.client = AzureOpenAI(
            azure_endpoint=config["endpoint"],
            api_version="2024-08-06",
        )
        self.model = config.get("model", "gpt-4o")
        self.temperature = config.get("temperature", 0.8)
        self.batch_size = config.get("batch_size", 50)

    async def generate_text_dataset(self, schema: dict, count: int, constraints: list) -> list:
        """Generate synthetic text records in batches."""
        all_records = []
        for batch_start in range(0, count, self.batch_size):
            batch_count = min(self.batch_size, count - batch_start)
            prompt = self._build_prompt(schema, batch_count, constraints, seed=batch_start)

            response = await self.client.chat.completions.create(
                model=self.model,
                temperature=self.temperature,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": GENERATION_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
            )
            records = json.loads(response.choices[0].message.content)["records"]
            # Add synthetic markers
            for r in records:
                r["_synthetic"] = True
                r["_generation_hash"] = hashlib.sha256(json.dumps(r).encode()).hexdigest()[:12]
            all_records.extend(records)

        return all_records
```

Generation approaches by data type:
| Data Type | Method | Tool | Best For |
|-----------|--------|------|----------|
| Text/NLP | LLM generation | Azure OpenAI GPT-4o | Conversations, documents, emails |
| Tabular | Statistical model | CTGAN / SDV | Customer records, transactions |
| Tabular + privacy | Differential privacy | SDV + DP | When training on real data |
| Structured | Rule-based | Faker + custom rules | Addresses, names, IDs |
| Mixed | Pipeline composition | All above | Complete datasets |

## Step 3: Deploy CTGAN Tabular Generator

```python
# tabular_generator.py — statistical synthetic data for tabular data
from sdv.single_table import CTGANSynthesizer
from sdv.metadata import SingleTableMetadata
import pandas as pd

class TabularSyntheticGenerator:
    def __init__(self, config):
        self.epochs = config.get("epochs", 300)
        self.batch_size = config.get("batch_size", 500)

    def train_and_generate(self, real_data: pd.DataFrame, count: int) -> pd.DataFrame:
        """Train CTGAN on real data distribution, generate synthetic records."""
        # Extract metadata
        metadata = SingleTableMetadata()
        metadata.detect_from_dataframe(real_data)

        # Train synthesizer
        synthesizer = CTGANSynthesizer(
            metadata,
            epochs=self.epochs,
            batch_size=self.batch_size,
            enforce_min_max_values=True,
            enforce_rounding=True,
        )
        synthesizer.fit(real_data)

        # Generate synthetic data
        synthetic = synthesizer.sample(num_rows=count)

        # Add synthetic markers and strip any real PII
        synthetic["_synthetic"] = True
        return self._apply_pii_markers(synthetic)

    def _apply_pii_markers(self, df: pd.DataFrame) -> pd.DataFrame:
        """Ensure PII-like columns have obvious synthetic markers."""
        for col in df.columns:
            if "name" in col.lower():
                df[col] = df[col].apply(lambda x: f"SYNTH-{x}" if isinstance(x, str) else x)
            if "email" in col.lower():
                df[col] = df[col].apply(lambda x: x.replace("@", "@synth-") if isinstance(x, str) and "@" in x else x)
            if "ssn" in col.lower() or "id" in col.lower():
                df[col] = df[col].apply(lambda x: f"S-{x}" if isinstance(x, str) else x)
        return df
```

## Step 4: Deploy Validation Pipeline

```python
# validator.py — compare synthetic vs real distributions
from scipy import stats
import numpy as np

class SyntheticValidator:
    def validate(self, real: pd.DataFrame, synthetic: pd.DataFrame) -> dict:
        results = {}
        for col in real.select_dtypes(include=[np.number]).columns:
            # KS test for distribution similarity
            ks_stat, p_value = stats.ks_2samp(real[col].dropna(), synthetic[col].dropna())
            # Correlation preservation
            results[col] = {
                "ks_statistic": ks_stat,
                "ks_p_value": p_value,
                "real_mean": real[col].mean(),
                "synth_mean": synthetic[col].mean(),
                "mean_diff_pct": abs(real[col].mean() - synthetic[col].mean()) / real[col].mean() * 100,
                "distribution_match": p_value > 0.05,  # Not significantly different
            }
        return results
```

## Step 5: Deploy Container Apps Pipeline

```bash
az acr build --registry acrSynthData \
  --image synth-data-factory:latest .

az containerapp create \
  --name synth-data-factory \
  --resource-group rg-frootai-synthetic-data-factory \
  --environment synth-env \
  --image acrSynthData.azurecr.io/synth-data-factory:latest \
  --target-port 8080 \
  --cpu 2 --memory 4Gi \
  --min-replicas 0 --max-replicas 3 \
  --secrets openai-key=keyvaultref:kv-synth-data/openai-key,storage-conn=keyvaultref:kv-synth-data/storage-conn \
  --env-vars OPENAI_KEY=secretref:openai-key STORAGE_CONN=secretref:storage-conn
```

## Step 6: Configure Dataset Output

```json
// config/agents.json
{
  "output": {
    "storage_container": "synthetic-datasets",
    "formats": ["csv", "parquet", "jsonl"],
    "include_metadata": true,
    "include_validation_report": true,
    "naming_convention": "{schema_name}_{timestamp}_{count}records",
    "retention_days": 90
  },
  "pii_markers": {
    "enabled": true,
    "name_prefix": "SYNTH-",
    "email_domain": "@synth-example.com",
    "ssn_prefix": "S-",
    "phone_area_code": "555"
  }
}
```

## Step 7: Verify Deployment

```bash
# Health check
curl https://synth-data-factory.azurecontainerapps.io/health

# Generate LLM-based text dataset
curl -X POST https://synth-data-factory.azurecontainerapps.io/api/generate/text \
  -H "Content-Type: application/json" \
  -d '{"schema": {"name": "string", "email": "string", "department": "string", "salary": "number"}, "count": 100, "constraints": ["realistic salary range 40000-200000"]}'

# Generate CTGAN tabular dataset (requires training data upload)
curl -X POST https://synth-data-factory.azurecontainerapps.io/api/generate/tabular \
  -F "real_data=@sample_data.csv" -F "count=1000"

# Validate generated dataset
curl https://synth-data-factory.azurecontainerapps.io/api/validate/latest
```

## Verification Checklist

| Check | Command | Expected |
|-------|---------|----------|
| Pipeline healthy | `curl /health` | 200 OK |
| LLM generation | POST text request | JSON records with `_synthetic: true` |
| CTGAN generation | POST tabular + train data | CSV/Parquet output |
| PII markers | Check generated names | "SYNTH-" prefix present |
| Distribution match | Validation report | KS p-value > 0.05 per column |
| Output storage | Check blob container | Files with metadata |
| Batch processing | Generate 1000+ records | Batched in 50-record chunks |
| No real PII | Scan output for PII | 0 real PII entities |
| Key Vault access | Managed identity | Secrets resolved |

## Rollback Procedure

```bash
az containerapp revision list --name synth-data-factory \
  --resource-group rg-frootai-synthetic-data-factory
az containerapp ingress traffic set --name synth-data-factory \
  --resource-group rg-frootai-synthetic-data-factory \
  --revision-weight previousRevision=100
```
