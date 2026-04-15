---
name: fai-backup-restore-ai
description: 'Set up backup and restore procedures for AI application data, model configs, and index state.'
---

# Backup Restore AI

## Purpose

This skill defines a production-ready workflow for implementing backup and restore procedures for AI application components including vector indexes, model configurations, prompt templates, and evaluation datasets. It enforces full six-phase coverage, WAF-aligned quality gates, and reproducible delivery outcomes.

## Inputs

| Input | Description |
|---|---|
| Data assets | Vector indexes, prompt templates, evaluation datasets, config files |
| RPO target | Recovery point objective (how much data loss is acceptable) |
| RTO target | Recovery time objective (how fast must recovery complete) |
| Storage target | Azure Blob Storage, geo-redundant replication tier |

## Prerequisites

- Inventory of all AI-specific data assets and their storage locations.
- RPO and RTO targets approved by stakeholders.
- Azure Blob Storage with GRS or RA-GRS configured.
- Managed Identity with read access to all source data stores.

## Full Phases Coverage

### Phase 1: Discover

- Catalog all AI data assets: vector indexes, embeddings, prompt libraries, eval sets, model weights.
- Map storage locations and access patterns for each asset.
- Assess current backup gaps — which assets have no recovery path?
- Document RPO/RTO requirements per asset class.

### Phase 2: Design

- Define backup strategy per asset type:

| Asset | Backup Method | Frequency | Retention |
|-------|--------------|-----------|-----------|
| AI Search index | Index snapshot via REST API | Daily | 30 days |
| Prompt templates | Git versioning + blob copy | On change | Indefinite |
| Eval datasets | Blob snapshot | Weekly | 90 days |
| Config files | Git + Blob immutable copy | On change | 1 year |

- Design automated backup pipeline:

```python
from azure.storage.blob import BlobServiceClient
from azure.identity import DefaultAzureCredential
import datetime

def backup_config(source_container, backup_container, blob_name):
    credential = DefaultAzureCredential()
    client = BlobServiceClient(account_url, credential=credential)
    source = client.get_blob_client(source_container, blob_name)
    timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d-%H%M%S")
    backup = client.get_blob_client(backup_container, f"{timestamp}/{blob_name}")
    backup.start_copy_from_url(source.url)
```

### Phase 3: Implement

- Create backup automation (Azure Function or Logic App on schedule).
- Implement index snapshot for AI Search:

```bash
# Snapshot AI Search index
az search index create --name backup-index \
  --resource-group rg-ai --service-name search-prod \
  --fields @index-schema.json

# Copy documents via indexer reset
az search indexer reset --name backup-indexer \
  --resource-group rg-ai --service-name search-prod
```

- Configure blob versioning and soft delete as safety net.
- Set up geo-redundant replication for disaster recovery.

### Phase 4: Validate

- Execute a backup cycle for every asset type and verify blob contents.
- Test full restore procedure: delete index → restore from snapshot → verify query results.
- Measure restore time against RTO targets.
- Validate backup integrity with checksums.

### Phase 5: Deploy

- Deploy backup automation to dev — run one full cycle.
- Promote to staging — verify scheduled triggers fire correctly.
- Deploy to production — validate first automated backup completes.
- Document restore runbook with step-by-step commands.

### Phase 6: Operate

- Monitor backup job success/failure — alert on any missed cycle.
- Run quarterly restore drills to verify RTO is still met.
- Review retention policies annually against compliance requirements.
- Track backup storage costs and optimize tier selection.

## WAF-Aligned Quality Gates

### Reliability

- Retry, timeout, and fallback behavior are validated.
- Dependency health checks and alerting are active.
- Degraded operation paths are tested and documented.

### Security

- Secrets are externalized via Key Vault or Managed Identity.
- Least-privilege RBAC is enforced on all resources.
- Audit trails capture all critical operations.

### Cost Optimization

- Resource sizing is evidence-based and right-sized.
- Expensive operations are measured and optimized.
- Budget alerts are configured per resource group.

### Operational Excellence

- CI/CD pipelines validate before every deployment.
- Runbooks and rollback procedures are current and tested.
- Metrics and traces support rapid root-cause diagnosis.

### Performance Efficiency

- SLO targets are explicit, monitored, and alerted.
- Hot paths are benchmarked under realistic load.
- Operational overhead is minimized.

### Responsible AI

- Content safety filters are applied where AI is used.
- Model outputs are transparent and explainable to users.
- Human escalation exists for high-impact or ambiguous decisions.

## Deliverables

| Artifact | Purpose |
|---|---|
| Implementation artifacts | Code, config, and infrastructure files |
| Validation evidence | Test results, compliance checks, quality metrics |
| Rollback guide | Step-by-step reversal and mitigation procedures |
| Operate handoff | Monitoring setup, ownership, and escalation paths |

## Completion Checklist

- [ ] Phase 1 discovery documented with scope and success criteria.
- [ ] Phase 2 design approved with tradeoff rationale.
- [ ] Phase 3 implementation reviewed and merged.
- [ ] Phase 4 validation passed with evidence collected.
- [ ] Phase 5 staged rollout completed through all environments.
- [ ] Phase 6 operate handoff accepted by operations team.

## Troubleshooting

### Symptom: Deployment fails in staging but works in dev

- Compare environment configuration (feature flags, network rules, RBAC).
- Verify service principal permissions match between environments.
- Check for region-specific resource availability differences.

### Symptom: Quality metrics degrade after deployment

- Compare baseline metrics with post-deployment measurements.
- Check for configuration drift between environments.
- Roll back and isolate the change that caused degradation.

### Symptom: Monitoring gaps or missing telemetry

- Verify instrumentation is deployed to all service instances.
- Check sampling rates — increase temporarily for debugging.
- Confirm diagnostic settings route to the correct Log Analytics workspace.

## Definition of Done

The skill is complete when all six phases have objective evidence, quality gates pass, and another engineer can reproduce outcomes without tribal knowledge.

## Metadata

- Category: Infrastructure
- WAF Pillars: Reliability, Security, Operational Excellence
- Maintainer: FAI Skill System
- Review cadence: Quarterly and after major platform changes
