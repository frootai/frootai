---
name: deploy-document-intelligence
description: "Deploy Document Intelligence — configure Azure Document Intelligence, prebuilt/custom models, indexers, validation rules, PII masking. Use when: deploy, provision."
---

# Deploy Document Intelligence

## When to Use
- Deploy Azure Document Intelligence resources and custom models
- Configure prebuilt models (invoices, receipts, ID documents, tax forms)
- Train and deploy custom extraction models
- Set up document processing pipelines with validation
- Configure PII detection and redaction on extracted content

## Prerequisites
1. Azure CLI authenticated: `az account show`
2. Bicep CLI: `az bicep version`
3. Azure Document Intelligence resource (S0 tier for production)
4. Training documents for custom models (minimum 5 labeled samples)
5. Azure Storage account for document uploads

## Step 1: Validate Infrastructure
```bash
az bicep lint -f infra/main.bicep
az bicep build -f infra/main.bicep
```
Verify resources:
- Azure Document Intelligence (S0 for production, F0 for dev)
- Azure Storage (document uploads, processed results)
- Azure OpenAI (post-extraction enrichment, if needed)
- Azure Key Vault (API keys, connection strings)
- Azure Monitor (processing metrics, error tracking)

## Step 2: Deploy Azure Resources
```bash
az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json
```

## Step 3: Configure Prebuilt Models
Select the appropriate prebuilt model per document type:

| Document Type | Prebuilt Model | Key Fields |
|---------------|---------------|------------|
| Invoices | `prebuilt-invoice` | vendor, amount, date, line items |
| Receipts | `prebuilt-receipt` | merchant, total, items, tax |
| ID Documents | `prebuilt-idDocument` | name, DOB, address, ID number |
| Tax Forms | `prebuilt-tax.us.w2` | employer, wages, withholding |
| Business Cards | `prebuilt-businessCard` | name, company, email, phone |
| General | `prebuilt-layout` | text, tables, selection marks |

## Step 4: Train Custom Models (If Needed)
```bash
# Upload training documents
az storage blob upload-batch --source training-docs/ --destination training --account-name $STORAGE

# Start training via REST API
python scripts/train_custom_model.py --training-data $BLOB_URL --model-id custom-contract-v1
```
Requirements for custom models:
- Minimum 5 labeled documents (recommended 15-20)
- Consistent document layout across samples
- Clear, high-resolution scans (300 DPI minimum)
- Label all target fields in Document Intelligence Studio

## Step 5: Set Up Processing Pipeline
```python
# Document processing flow:
# 1. Upload → Blob Storage trigger
# 2. Document Intelligence analysis (prebuilt or custom model)
# 3. Field extraction with confidence scores
# 4. Validation rules check
# 5. PII detection and redaction
# 6. Store structured results
# 7. Flag low-confidence fields for human review
```

## Step 6: Configure Validation Rules
- Field-level confidence threshold: reject < 0.80
- Cross-field validation (e.g., line item totals = invoice total)
- Required field check (reject documents missing mandatory fields)
- Format validation (dates, currency, phone numbers)

## Step 7: Configure PII Handling
- Enable PII detection on all extracted text
- Redact SSN, credit card, bank account numbers
- Mask personal addresses and phone numbers in logs
- Store original only in encrypted, access-controlled storage

## Step 8: Smoke Test
```bash
python scripts/test_extraction.py --document samples/invoice.pdf --model prebuilt-invoice
python scripts/test_extraction.py --document samples/receipt.jpg --model prebuilt-receipt
python scripts/test_extraction.py --document samples/contract.pdf --model custom-contract-v1
```

## Post-Deployment Verification
- [ ] Prebuilt models returning expected fields
- [ ] Custom model accuracy ≥ 90% on validation set
- [ ] Processing time < 10 seconds per page
- [ ] PII redaction active and verified
- [ ] Low-confidence fields flagged for human review
- [ ] Blob trigger pipeline functional
- [ ] Error logging and retry logic working

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Empty extraction results | Wrong model for document type | Use Layout model first to identify structure |
| Low confidence on all fields | Poor scan quality | Require 300 DPI, no skew, good contrast |
| Table extraction fails | Complex nested tables | Use Layout model, handle merged cells |
| Custom model poor accuracy | Too few training samples | Add more labeled samples (15-20 minimum) |
| Processing timeout | Large multi-page PDF | Split into single pages, process in parallel |
| PII not detected | Language mismatch | Set correct locale in analysis options |
