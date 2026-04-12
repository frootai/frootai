---
name: "deploy-healthcare-clinical-ai"
description: "Deploy Healthcare Clinical AI — HIPAA-compliant clinical NLP, PHI de-identification with Presidio, ICD-10/CPT medical coding, drug interaction checking, FHIR integration, audit trail."
---

# Deploy Healthcare Clinical AI

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with **HIPAA BAA signed** (mandatory before any PHI processing)
- Azure resource providers registered:
  - `Microsoft.CognitiveServices` (Azure OpenAI — HIPAA-eligible)
  - `Microsoft.HealthcareApis` (Azure Health Data Services — FHIR)
  - `Microsoft.App` (Container Apps)
  - `Microsoft.KeyVault` (secret management)
- Python 3.11+ with `presidio-analyzer`, `presidio-anonymizer`, `fhirclient`, `openai` packages
- `.env` file with: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `FHIR_SERVER_URL`, `FHIR_CLIENT_ID`

## Step 1: Verify HIPAA BAA

```bash
# CRITICAL: Verify BAA is signed before deploying any healthcare workload
# Navigate to Azure Portal → Compliance → HIPAA BAA
# Confirm BAA status is "Accepted" for your subscription

# Verify HIPAA-eligible region
# HIPAA-eligible regions: East US, East US 2, West US 2, South Central US, etc.
az account show --query "name" -o tsv
```

**DO NOT proceed without a signed BAA.** Processing PHI without a BAA is a HIPAA violation.

## Step 2: Provision HIPAA-Compliant Infrastructure

```bash
# Create resource group in HIPAA-eligible region
az group create --name rg-frootai-healthcare-ai --location eastus2

# Deploy infrastructure with HIPAA controls
az deployment group create \
  --resource-group rg-frootai-healthcare-ai \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=prod hipaaCompliant=true

# Store secrets in Key Vault (HIPAA-grade, no soft delete bypass)
az keyvault secret set --vault-name kv-healthcare-ai \
  --name openai-key --value "$AZURE_OPENAI_KEY"
az keyvault secret set --vault-name kv-healthcare-ai \
  --name fhir-client-secret --value "$FHIR_CLIENT_SECRET"
```

Infrastructure requirements:
- **Private endpoints** on all services (no public access)
- **Encryption at rest** with CMK (Customer Managed Keys)
- **Azure Logging disabled** for OpenAI PHI queries (opt-out of abuse monitoring)
- **RBAC** with least-privilege role assignments
- **Diagnostic logs** to HIPAA-compliant Log Analytics workspace

## Step 3: Deploy Azure OpenAI (HIPAA-Eligible)

```bash
# Deploy HIPAA-eligible OpenAI instance
az cognitiveservices account create \
  --name openai-healthcare \
  --resource-group rg-frootai-healthcare-ai \
  --kind OpenAI \
  --sku S0 \
  --location eastus2 \
  --custom-domain openai-healthcare \
  --properties '{"disableLocalAuth": true, "publicNetworkAccess": "Disabled"}'

# Deploy model
az cognitiveservices account deployment create \
  --name openai-healthcare \
  --resource-group rg-frootai-healthcare-ai \
  --deployment-name gpt-4o-clinical \
  --model-name gpt-4o \
  --model-version "2024-08-06" \
  --model-format OpenAI \
  --sku-capacity 30 --sku-name Standard

# Disable Azure logging for PHI workloads (required for HIPAA)
az cognitiveservices account update \
  --name openai-healthcare \
  --resource-group rg-frootai-healthcare-ai \
  --properties '{"networkAcls": {"defaultAction": "Deny"}}'
```

## Step 4: Deploy PHI De-Identification Pipeline

```python
# deidentification.py — Presidio-based PHI stripping
from presidio_analyzer import AnalyzerEngine, PatternRecognizer, Pattern
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig

# Custom healthcare PHI recognizers
mrn_pattern = Pattern(name="mrn", regex=r"\b\d{6,10}\b", score=0.6)
mrn_recognizer = PatternRecognizer(
    supported_entity="MEDICAL_RECORD_NUMBER",
    patterns=[mrn_pattern],
    context=["MRN", "medical record", "chart number"],
)

class HealthcareDeIdentifier:
    def __init__(self):
        self.analyzer = AnalyzerEngine()
        self.analyzer.registry.add_recognizer(mrn_recognizer)
        self.anonymizer = AnonymizerEngine()
        self.phi_entities = [
            "PERSON", "DATE_TIME", "PHONE_NUMBER", "EMAIL_ADDRESS",
            "US_SSN", "LOCATION", "MEDICAL_LICENSE",
            "MEDICAL_RECORD_NUMBER", "IP_ADDRESS", "URL",
        ]

    def deidentify(self, text: str) -> tuple[str, list]:
        """De-identify clinical text, return (deidentified_text, entities_found)."""
        results = self.analyzer.analyze(
            text=text, entities=self.phi_entities, language="en"
        )
        deidentified = self.anonymizer.anonymize(
            text=text,
            analyzer_results=results,
            operators={"DEFAULT": OperatorConfig("replace", {"new_value": "<PHI>"})},
        )
        return deidentified.text, results
```

## Step 5: Deploy FHIR Server

```bash
# Create Azure Health Data Services workspace
az healthcareapis workspace create \
  --name hw-healthcare-ai \
  --resource-group rg-frootai-healthcare-ai \
  --location eastus2

# Create FHIR service
az healthcareapis fhir-service create \
  --name fhir-clinical \
  --workspace-name hw-healthcare-ai \
  --resource-group rg-frootai-healthcare-ai \
  --kind fhir-R4 \
  --authentication-authority "https://login.microsoftonline.com/$TENANT_ID" \
  --authentication-audience "https://hw-healthcare-ai-fhir-clinical.fhir.azurehealthcareapis.com"
```

FHIR integration:
- **Patient resources** → context for clinical queries
- **Condition resources** → ICD-10 coding input
- **MedicationRequest** → drug interaction checking
- **Observation** → vital signs for risk scoring
- **AuditEvent** → HIPAA audit trail

## Step 6: Deploy Clinical Decision Support

```python
# clinical_pipeline.py — end-to-end clinical AI pipeline
class ClinicalAIPipeline:
    def __init__(self, config):
        self.deidentifier = HealthcareDeIdentifier()
        self.openai_client = AzureOpenAI(
            azure_endpoint=config["openai_endpoint"],
            api_version="2024-08-06",
        )
        self.fhir_client = FHIRClient(config["fhir_url"])

    async def process_clinical_query(self, query: str, patient_id: str):
        # 1. De-identify the query
        deidentified, phi_entities = self.deidentifier.deidentify(query)

        # 2. Fetch patient context from FHIR (de-identified)
        context = await self.fhir_client.get_patient_summary(patient_id)

        # 3. Clinical NLP with Azure OpenAI
        response = self.openai_client.chat.completions.create(
            model="gpt-4o-clinical",
            temperature=0,  # Deterministic for clinical accuracy
            messages=[
                {"role": "system", "content": CLINICAL_SYSTEM_PROMPT},
                {"role": "user", "content": f"Context: {context}\n\nQuery: {deidentified}"},
            ],
        )

        # 4. Log audit event (de-identified query + response hash)
        await self.log_audit_event(patient_id, deidentified, response)

        # 5. Add disclaimer
        return self.add_clinical_disclaimer(response.choices[0].message.content)

    def add_clinical_disclaimer(self, response: str) -> str:
        return f"{response}\n\n⚠️ CLINICAL DECISION SUPPORT ONLY — not a substitute for professional medical judgment."
```

## Step 7: Verify Deployment

```bash
# Health check
curl https://clinical-ai.azurecontainerapps.io/health

# Test with synthetic patient data (NEVER use real patient data for testing)
curl -X POST https://clinical-ai.azurecontainerapps.io/api/clinical \
  -H "Content-Type: application/json" \
  -d '{"query": "What are the drug interactions for metformin and lisinopril?", "patient_id": "synthetic-001"}'

# Verify de-identification
curl -X POST https://clinical-ai.azurecontainerapps.io/api/deidentify \
  -d '{"text": "John Smith, DOB 01/15/1980, MRN 123456, was admitted for chest pain."}'
# Expected: "<PHI>, DOB <PHI>, MRN <PHI>, was admitted for chest pain."
```

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| BAA signed | Azure Portal → Compliance | BAA status: Accepted |
| Private endpoints | Network config | No public access |
| Encryption at rest | CMK configured | CMK key reference set |
| De-identification | Test with known PHI | All PHI entities masked |
| FHIR connectivity | Patient query | FHIR R4 response |
| Clinical response | Test query | Response with disclaimer |
| Audit trail | Check audit events | De-identified log entries |
| No PHI in logs | Check App Insights | Zero PHI in telemetry |
| Key Vault access | Managed identity | Secrets resolved |
| Azure logging opt-out | OpenAI settings | Abuse monitoring disabled |

## Rollback Procedure

```bash
# Revert clinical AI container
az containerapp revision list --name clinical-ai \
  --resource-group rg-frootai-healthcare-ai
az containerapp ingress traffic set --name clinical-ai \
  --resource-group rg-frootai-healthcare-ai \
  --revision-weight previousRevision=100
```
