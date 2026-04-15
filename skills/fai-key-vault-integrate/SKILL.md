---
name: fai-key-vault-integrate
description: "Integrate Azure Key Vault using Managed Identity, RBAC, secret rotation policy, and application configuration wiring."
---

# Key Vault Integrate

## Objective

Eliminate hardcoded secrets by wiring apps to Azure Key Vault with identity-based access.

## Architecture

- App Service / AKS / Function with system-assigned or user-assigned managed identity
- Key Vault with RBAC authorization
- Secret retrieval via SDK or Key Vault references

## Step 1 - Enable Managed Identity

```bash
az webapp identity assign --name app-demo --resource-group rg-demo
```

## Step 2 - Grant RBAC Access

```bash
az role assignment create --assignee <principalId> --role "Key Vault Secrets User" --scope /subscriptions/<sub>/resourceGroups/rg-demo/providers/Microsoft.KeyVault/vaults/kv-demo
```

## Step 3 - Retrieve Secret in App Code

```python
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient

vault_url = "https://kv-demo.vault.azure.net"
client = SecretClient(vault_url=vault_url, credential=DefaultAzureCredential())
api_key = client.get_secret("openai-api-key").value
```

## Step 4 - Configure Rotation and Expiry

```json
{
  "secret_name": "openai-api-key",
  "expires_in_days": 90,
  "rotation_alert_days": 14,
  "owner": "platform-security"
}
```

## Security Rules

- Never store secrets in source control.
- Prefer RBAC over legacy access policies.
- Disable public access where possible.
- Audit secret access events.

## Validation Checklist

| Check | Expected |
|------|----------|
| Identity auth | Works without client secret |
| Secret retrieval | Returns expected value |
| Rotation policy | Defined and monitored |
| Access scope | Least privilege role |

## Troubleshooting

| Issue | Cause | Fix |
|------|-------|-----|
| 403 from Key Vault | Missing RBAC role or propagation delay | Assign role, wait, retry |
| Works locally, fails in Azure | Wrong identity context | Verify managed identity principal id |
| Secret not found | Name/version mismatch | Confirm exact secret name and active version |

## Advanced Implementation Notes

### Operational Guardrails

- Define measurable SLOs before rollout.
- Capture baseline metrics and compare deltas post-change.
- Add alert thresholds with explicit on-call ownership.
- Use environment-specific overrides for dev/staging/prod.

### CI/CD and Validation Expansion

```bash
# Example verification sequence
npm run lint
npm test
npm run build
```

```json
{
  "quality_gate": {
    "required": true,
    "min_score": 0.8,
    "block_on_failure": true
  }
}
```

### Security and Compliance Checks

| Control | Requirement |
|--------|-------------|
| Secret handling | No plaintext secrets in repo |
| Access model | Least privilege role assignments |
| Logging | Redact sensitive data before persistence |
| Auditability | Keep immutable trace of critical actions |

### Performance and Cost Notes

- Budget requests and tokens per endpoint/class of workload.
- Profile p95 and p99 latency as separate objectives.
- Add caching only where correctness is preserved.
- Use periodic reports to catch drift in cost/quality.

### Extended Troubleshooting

| Symptom | Likely Cause | Recommended Action |
|--------|--------------|--------------------|
| Validation gate failures | Threshold too strict or wrong baseline | Recalibrate using a fixed reference dataset |
| Unexpected regressions | Missing scenario coverage | Add targeted regression tests and rerun |
| Production-only issues | Environment mismatch | Diff environment config and identity settings |
| Slow recovery during incidents | Unclear ownership/runbook steps | Add explicit owner and sequence in runbook |
