---
name: backup-restore-ai
description: "Back up AI data, vector indexes, and configuration state — recover prompts, conversations, and search assets after failures"
---

# Backup & Restore for AI Workloads

## What to Backup

AI workloads have unique data assets beyond traditional application tiers:

| Asset | Location | Criticality | Backup Frequency |
|-------|----------|-------------|-----------------|
| Model deployment configs | Azure OpenAI resource | High | On change |
| Prompt versions | `config/openai.json`, prompt library | Critical | Every commit |
| Vector indexes | Azure AI Search | High | Daily |
| Conversation history | Cosmos DB | Medium | Continuous (PITR) |
| Evaluation datasets | Blob Storage `evaluation/` | High | Weekly |
| Guardrail configs | `config/guardrails.json` | Critical | Every commit |
| Embeddings cache | Cosmos DB / Redis | Low | Weekly |
| Fine-tuning artifacts | AI Foundry / Blob | High | On completion |

## Disaster Recovery Targets

| Tier | RTO | RPO | Scope |
|------|-----|-----|-------|
| **Tier 1** — Config & prompts | 5 min | 0 (git) | Git restore, no infra needed |
| **Tier 2** — Vector indexes | 30 min | 24h | Rebuild from source docs or snapshot |
| **Tier 3** — Conversation history | 1h | 1h | Cosmos DB PITR |
| **Tier 4** — Full environment | 4h | 24h | Full IaC redeploy + data restore |

## Step 1: Configuration Backup (Git-Based)

All tunable AI parameters live in `config/`. Version them alongside code:

```bash
# Tag config snapshots before deployment
CONFIG_HASH=$(sha256sum config/*.json | sha256sum | cut -d' ' -f1)
git tag "config-${CONFIG_HASH:0:8}-$(date +%Y%m%d)" 
git push origin --tags

# Export Azure OpenAI deployment config as backup
az cognitiveservices account deployment list \
  --name $AOAI_NAME -g $RG \
  --query "[].{name:name,model:properties.model.name,version:properties.model.version,capacity:sku.capacity}" \
  -o json > backups/aoai-deployments-$(date +%Y%m%d).json
```

## Step 2: Cosmos DB Continuous Backup (PITR)

Enable point-in-time restore for conversation history and session state:

```bicep
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: cosmosName
  location: location
  properties: {
    backupPolicy: {
      type: 'Continuous'
      continuousModeProperties: {
        tier: 'Continuous7Days' // or 'Continuous30Days' for prod
      }
    }
    databaseAccountOfferType: 'Standard'
    locations: [
      { locationName: location, failoverPriority: 0 }
    ]
  }
}
```

Restore a specific container to a point in time:

```bash
# Restore Cosmos DB to a specific timestamp
az cosmosdb restore \
  --account-name $COSMOS_NAME \
  --resource-group $RG \
  --target-database-account-name "${COSMOS_NAME}-restored" \
  --restore-timestamp "2026-04-13T10:00:00Z" \
  --location $LOCATION \
  --databases-to-restore name=chatdb collections=conversations sessions
```

## Step 3: Blob Storage Backup (Evaluation Datasets & Docs)

Enable versioning and soft delete for source documents and eval datasets:

```bicep
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_GRS' } // geo-redundant for DR
  properties: {
    allowBlobPublicAccess: false
  }

  resource blobService 'blobServices' = {
    name: 'default'
    properties: {
      isVersioningEnabled: true
      deleteRetentionPolicy: {
        enabled: true
        days: 30
      }
      containerDeleteRetentionPolicy: {
        enabled: true
        days: 14
      }
    }
  }
}
```

Lifecycle management to tier old backups and control costs:

```bicep
resource lifecyclePolicy 'Microsoft.Storage/storageAccounts/managementPolicies@2023-05-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    policy: {
      rules: [
        {
          name: 'tierBackupsAfter30Days'
          type: 'Lifecycle'
          definition: {
            actions: {
              version: {
                tierToCool: { daysAfterCreationGreaterThan: 30 }
                tierToArchive: { daysAfterCreationGreaterThan: 90 }
                delete: { daysAfterCreationGreaterThan: 365 }
              }
            }
            filters: {
              blobTypes: [ 'blockBlob' ]
              prefixMatch: [ 'backups/', 'evaluation/' ]
            }
          }
        }
      ]
    }
  }
}
```

## Step 4: AI Search Index Snapshots

AI Search has no native backup API. Export index data to Blob for recovery:

```bash
#!/usr/bin/env bash
# backup-search-index.sh — Export AI Search index documents to Blob
set -euo pipefail

SEARCH_NAME="${1:?Usage: backup-search-index.sh <search-name> <index-name>}"
INDEX_NAME="${2:?}"
CONTAINER="search-backups"
TIMESTAMP=$(date +%Y%m%dT%H%M%S)
API_KEY=$(az search admin-key show --service-name $SEARCH_NAME -g $RG --query primaryKey -o tsv)
API_VERSION="2024-07-01"

# Paginate through all documents using search POST
SKIP=0
BATCH=1000
OUTFILE="/tmp/${INDEX_NAME}-${TIMESTAMP}.ndjson"
> "$OUTFILE"

while true; do
  RESULT=$(curl -s "https://${SEARCH_NAME}.search.windows.net/indexes/${INDEX_NAME}/docs/search?api-version=${API_VERSION}" \
    -H "Content-Type: application/json" \
    -H "api-key: ${API_KEY}" \
    -d "{\"search\":\"*\",\"top\":${BATCH},\"skip\":${SKIP},\"select\":\"*\"}")

  COUNT=$(echo "$RESULT" | jq '.value | length')
  [ "$COUNT" -eq 0 ] && break

  echo "$RESULT" | jq -c '.value[]' >> "$OUTFILE"
  SKIP=$((SKIP + BATCH))
done

# Upload to Blob Storage
az storage blob upload \
  --account-name $STORAGE_NAME \
  --container-name $CONTAINER \
  --name "${INDEX_NAME}/${TIMESTAMP}.ndjson" \
  --file "$OUTFILE" \
  --auth-mode login

echo "Backed up $(wc -l < "$OUTFILE") documents from ${INDEX_NAME}"
```

## Step 5: Automated Backup Schedule

```bash
#!/usr/bin/env bash
# daily-ai-backup.sh — Run as Azure Automation or cron
set -euo pipefail

BACKUP_DATE=$(date +%Y%m%d)
BACKUP_DIR="backups/${BACKUP_DATE}"

# 1. Config snapshot
cp -r config/ "${BACKUP_DIR}/config/"

# 2. Azure OpenAI deployment export
az cognitiveservices account deployment list \
  --name $AOAI_NAME -g $RG -o json > "${BACKUP_DIR}/aoai-deployments.json"

# 3. AI Search index backup
./scripts/backup-search-index.sh $SEARCH_NAME "documents-index"
./scripts/backup-search-index.sh $SEARCH_NAME "embeddings-index"

# 4. Export evaluation baselines
az storage blob download-batch \
  --source evaluation --destination "${BACKUP_DIR}/evaluation/" \
  --account-name $STORAGE_NAME --auth-mode login

# 5. Verify backup integrity
TOTAL=$(find "${BACKUP_DIR}" -type f | wc -l)
echo "Backup complete: ${TOTAL} files archived to ${BACKUP_DIR}"
```

## Step 6: Restore Procedure

| Scenario | Command | Recovery Time |
|----------|---------|--------------|
| Config rollback | `git checkout <tag> -- config/` | 1 min |
| Cosmos DB restore | `az cosmosdb restore` (see Step 2) | 30-60 min |
| Search index rebuild | Re-run indexer: `az search indexer run --name doc-indexer` | 15-45 min |
| Search from snapshot | Upload NDJSON + `az search document index` | 10-30 min |
| Full environment | `azd provision && azd deploy` + data restores | 2-4h |
| Blob versioning | `az storage blob set-tier --version-id <id>` | 5 min |

## Step 7: Backup Validation Testing

Run monthly to verify recoverability:

```bash
# Validate Cosmos DB backup is restorable
az cosmosdb restorable-database-account list \
  --account-name $COSMOS_NAME \
  --query "[0].{oldestRestore:oldestRestorableTime,id:id}" -o table

# Validate search backup files are valid JSON
LATEST=$(az storage blob list --container-name search-backups \
  --account-name $STORAGE_NAME --auth-mode login \
  --query "sort_by([],&properties.lastModified)[-1].name" -o tsv)
az storage blob download --container-name search-backups \
  --name "$LATEST" --account-name $STORAGE_NAME \
  --auth-mode login --file /tmp/validate.ndjson
head -1 /tmp/validate.ndjson | jq . > /dev/null && echo "VALID" || echo "CORRUPT"

# Validate config backup matches current schema
node -e "const s=require('./schemas/openai-config.schema.json'); \
  const c=require('./backups/latest/config/openai.json'); \
  console.log('Config schema: OK')"
```

## Cost Optimization

- **Cosmos DB**: Use `Continuous7Days` tier (free) instead of `Continuous30Days` for non-prod
- **Blob lifecycle**: Auto-tier backups to Cool (30d) → Archive (90d) → Delete (365d)
- **Search snapshots**: Store as NDJSON in Cool tier — ~$0.01/GB/month vs rebuilding
- **GRS vs LRS**: Use GRS only for Tier 1/2 data; LRS is sufficient for eval dataset backups
- **Retention policy**: Keep 7 daily + 4 weekly + 3 monthly snapshots, prune older

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Cosmos restore fails | Target account name exists | Use unique name with `-restored` suffix |
| Search export returns 0 docs | API key expired or wrong index | Regenerate key: `az search admin-key renew` |
| Blob versioning not working | Feature not enabled on account | Enable via `az storage account blob-service-properties update --enable-versioning` |
| Archive tier restore slow | Archive rehydration takes up to 15h | Use `High` priority: `--rehydrate-priority High` |
| Backup script auth fails | Managed identity not assigned | Assign Storage Blob Data Contributor role |
- [Azure Best Practices](https://learn.microsoft.com/azure/well-architected/)
- [FAI Protocol](https://frootai.dev/fai-protocol)
