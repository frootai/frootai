---
name: "tune-healthcare-clinical-ai"
description: "Tune Healthcare Clinical AI — de-identification entity config, clinical coding prompts, drug interaction grounding, audit retention, evidence sourcing, cost optimization."
---

# Tune Healthcare Clinical AI

## Prerequisites

- Deployed clinical AI pipeline with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`
- Evaluation baseline from `evaluate-healthcare-clinical-ai` skill

## Step 1: Tune De-Identification

### PHI Entity Configuration
```json
// config/guardrails.json
{
  "deidentification": {
    "engine": "presidio",
    "entities": [
      "PERSON", "DATE_TIME", "PHONE_NUMBER", "EMAIL_ADDRESS",
      "US_SSN", "LOCATION", "MEDICAL_LICENSE",
      "MEDICAL_RECORD_NUMBER", "IP_ADDRESS", "URL"
    ],
    "custom_entities": [
      {
        "name": "MEDICAL_RECORD_NUMBER",
        "patterns": ["\\b\\d{6,10}\\b"],
        "context": ["MRN", "chart", "medical record", "patient ID"],
        "score": 0.6
      }
    ],
    "operator": "replace",
    "replacement_format": "<PHI_TYPE>",
    "confidence_threshold": 0.5,
    "allow_list": ["Dr.", "MD", "RN", "NP"]
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `confidence_threshold` | 0.5 | Lower = more aggressive (higher recall, more false positives) |
| `entities` list | 10 types | Add custom entity types for specialized PHI |
| `allow_list` | 4 terms | Prevent common clinical terms from being masked |
| `replacement_format` | `<PHI_TYPE>` | `<PHI>` for simpler, `<PHI_TYPE>` for preserving structure |

### De-Identification Tuning Guide
| Symptom | Adjustment |
|---------|-----------|
| PHI recall < 98% | Lower confidence_threshold to 0.3, add custom recognizers |
| Too many false positives (>10%) | Raise confidence_threshold to 0.7, expand allow_list |
| Missing MRN formats | Add custom regex patterns for your EMR system |
| Dates over-masked | Add allow_list for clinical date terms ("q.d.", "b.i.d.") |
| Provider names masked | Add provider names to allow_list |

## Step 2: Tune Clinical NLP

### Model Configuration
```json
// config/openai.json
{
  "clinical": {
    "model": "gpt-4o",
    "temperature": 0,
    "max_tokens": 2048,
    "seed": 42,
    "system_prompt": "You are a clinical decision support assistant. Provide evidence-based responses. Always cite sources. Never make definitive diagnoses. Always recommend physician consultation."
  },
  "coding": {
    "model": "gpt-4o",
    "temperature": 0,
    "max_tokens": 500,
    "system_prompt": "Assign ICD-10 and CPT codes to the clinical description. Return codes with confidence level. Use current coding guidelines."
  },
  "drug_interaction": {
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 800,
    "grounding": {
      "source": "fda_drug_database",
      "require_citation": true,
      "flag_ungrounded": true
    }
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `temperature` | 0 | ALWAYS 0 for clinical — deterministic, reproducible |
| `model` (clinical) | gpt-4o | Do NOT use mini for clinical decisions |
| `model` (drug) | gpt-4o-mini | Acceptable for grounded lookups |
| `seed` | 42 | Ensures reproducible responses |
| `require_citation` | true | Prevents hallucinated drug interactions |

### Clinical Prompt Optimization
```python
# If ICD-10 category accuracy < 90%:
#   - Add few-shot examples of common coding patterns
#   - Include "use ICD-10-CM 2025 guidelines" in system prompt
#   - Provide specialty-specific context (cardiology vs orthopedics)

# If drug interaction detection < 95%:
#   - Ground ALL responses in FDA database lookup
#   - Flag any interaction not found in reference DB
#   - Add "Do not report interactions not in FDA database" to prompt

# If clinical safety issues:
#   - Add explicit guardrails: "NEVER recommend stopping medication"
#   - Add "If uncertain, say 'I don't have enough information'"
#   - Require "Consult your physician" in every response
```

## Step 3: Tune FHIR Integration

```json
// config/agents.json
{
  "fhir": {
    "server_url": "${FHIR_SERVER_URL}",
    "api_version": "R4",
    "resources_to_fetch": ["Patient", "Condition", "MedicationRequest", "Observation", "AllergyIntolerance"],
    "max_history_items": 20,
    "cache_ttl_seconds": 300,
    "timeout_ms": 5000
  },
  "patient_context": {
    "include_demographics": false,
    "include_conditions": true,
    "include_medications": true,
    "include_allergies": true,
    "include_vitals": true,
    "max_context_tokens": 2000
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `resources_to_fetch` | 5 types | More = richer context, slower queries |
| `max_history_items` | 20 | More = comprehensive, higher token cost |
| `cache_ttl_seconds` | 300 | Higher = faster, but stale data risk |
| `include_demographics` | false | true = better context, but more PHI exposure |
| `max_context_tokens` | 2000 | Balance between context richness and cost |

## Step 4: Tune Audit Trail

```json
// config/guardrails.json
{
  "audit": {
    "enabled": true,
    "log_query": true,
    "log_response_hash": true,
    "log_phi_entities_found": true,
    "log_raw_phi": false,
    "retention_days": 2555,
    "immutable_storage": true,
    "export_format": "FHIR_AuditEvent"
  },
  "consent": {
    "require_patient_consent": true,
    "consent_resource": "FHIR_Consent",
    "block_without_consent": true
  }
}
```

HIPAA audit requirements:
| Requirement | Implementation |
|-------------|---------------|
| Access logging | Every query logged with user + timestamp |
| PHI tracking | PHI entities found logged (types, not values) |
| Retention | 6+ years (HIPAA requires 6, set 7 for safety) |
| Immutability | Write-once storage, no deletion |
| Export | FHIR AuditEvent format for compliance auditors |
| Consent | Patient consent verified before AI processing |

## Step 5: Cost Optimization

```python
# Healthcare AI cost breakdown per 1000 clinical queries:
# - De-identification (Presidio, local): $0 (runs on-device)
# - Clinical NLP (gpt-4o): ~$15 (1500 token avg)
# - Drug interactions (gpt-4o-mini): ~$0.50
# - FHIR queries: ~$0.10 (API calls)
# - Total: ~$15.60 per 1000 queries

# Cost reduction strategies:
# 1. Use gpt-4o-mini for drug lookup (grounded, structured)
# 2. Cache common clinical Q&A (FAQ-type queries)
# 3. Rule-based coding for common ICD-10 codes
# 4. Batch FHIR queries (fetch all resources at once)
# 5. Local Presidio (no cloud cost for de-identification)
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| gpt-4o-mini for drug lookup | ~90% drug cost | Requires strong grounding |
| Cache common queries | ~30% LLM cost | Stale cached answers |
| Rule-based ICD-10 | ~40% coding cost | Only covers common codes |
| Batch FHIR queries | ~60% FHIR cost | Slightly higher latency |
| Local de-identification | 100% (already free) | No trade-off |

**NEVER compromise clinical accuracy for cost.** Patient safety > cost optimization.

## Step 6: Verify Tuning Impact

```bash
python evaluation/eval_deidentification.py --test-data evaluation/data/
python evaluation/eval_coding.py --test-data evaluation/data/
python evaluation/eval_drugs.py --test-data evaluation/data/
python evaluation/eval_safety.py --test-data evaluation/data/
python evaluation/eval_hipaa.py --deployment-config infra/parameters.json

python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| PHI recall | baseline | +1-2% | > 98% |
| ICD-10 category | baseline | +5-10% | > 90% |
| Drug interaction detection | baseline | +3-5% | > 95% |
| Hallucination rate | baseline | -1-2% | < 1% |
| Cost per 1K queries | ~$15.60 | ~$10-12 | < $20 |
| Harmful advice | 0% | 0% | 0% (non-negotiable) |
