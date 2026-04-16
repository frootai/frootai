---
name: fai-azure-container-registry
description: Configure Azure Container Registry with geo-replication across regions, image scanning for vulnerabilities, Managed Identity pull access, and OCI artifact support — enabling secure, distributed container delivery.
---

# FAI Azure Container Registry

Sets up ACR with geo-replication, vulnerability scanning, RBAC Managed Identity pull, webhook triggers, and private endpoint networking. Prevents registry setup friction: replicas in wrong regions, manual image replication, pull requiring admin credentials, and no vulnerability checks before deployment.

## When to Invoke

| Signal | Example |
|--------|---------|
| Container images deployed across regions | AKS clusters in East US and West Europe |
| Manual image promotion workflow exists | Pull from dev, retag, push to prod |
| No pre-deployment security scan | Container images deployed without CVE check |
| Registry pull uses admin key | Service principal managing image pull |

## Workflow

### Step 1 — Create Registry with Geo-Replication

```bicep
// infra/container-registry.bicep
param location string
param acrName string

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: { name: 'Premium' }
  identity: { type: 'SystemAssigned' }
  properties: {
    publicNetworkAccess: 'Disabled'
    adminUserEnabled: false          // Force Managed Identity
    anonymousPullEnabled: false       // No anonymous access
  }
}

// Geo-replication — images synced automatically
resource replication 'Microsoft.ContainerRegistry/registries/replications@2023-07-01' = [
  for region in ['East US', 'West Europe', 'Southeast Asia']: {
    parent: acr
    name: region
    location: region
    properties: { enabled: true }
  }
]
```

### Step 2 — Enable Image Scanning

```bash
# Enable vulnerability scanning on each push
az acr config content-trust update --registry $ACR_NAME --status Enabled

# Enable scan on push
az acr task create \
  --registry $ACR_NAME \
  --name scan-on-push \
  --image '{{.Run.Registry}}/{{.Run.Repository}}:{{.Run.Tag}}' \
  --cmd 'trivy image --exit-code 0 $Registry/$Repository:$Tag'
```

### Step 3 — Managed Identity Pull Configuration

```python
from azure.containerregistry import ContainerRegistryClient
from azure.identity import DefaultAzureCredential, ClientSecretCredential

# Grant app's MSI AcrPull role
az role assignment create \
  --assignee $APP_IDENTITY_ID \
  --role AcrPull \
  --scope "/subscriptions/$SUB_ID/resourceGroups/$RG_NAME/providers/Microsoft.ContainerRegistry/registries/$ACR_NAME"

# Application code — pull images via Managed Identity
client = ContainerRegistryClient(
    endpoint=f"https://{ACR_NAME}.azurecr.io",
    credential=DefaultAzureCredential(),
)

# Verify ability to read repositories
for repository in client.list_repository_names():
    print(f"  {repository}")
```

### Step 4 — CI/CD Push and Scan Pipeline

```yaml
# .github/workflows/acr-push.yml
name: Build and Push to ACR

on:
  push:
    branches: [main]

env:
  REGISTRY: ${{ secrets.ACR_NAME }}.azurecr.io
  IMAGE_NAME: myapp

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write

    steps:
      - uses: actions/checkout@v4
      
      - name: Login to ACR
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ secrets.ACR_USERNAME }}
          password: ${{ secrets.ACR_PASSWORD }}

      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}

      - name: Scan image for CVEs
        run: |
          trivy image --severity HIGH,CRITICAL \
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
```

### Step 5 — Webhook on Successful Scan

```bash
# Trigger deployment only if scan passes
az acr webhook create \
  --registry $ACR_NAME \
  --name deploy-on-scan-pass \
  --actions push \
  --scope "$IMAGE_NAME:*" \
  --uri "https://your-deployment-api/webhook/acr"
```

## Image Scanning Results

Example `trivy` output:

```
IMAGE: acr-name.azurecr.io/myapp:v1.0.0
Vulnerabilities (HIGH/CRITICAL):

  2024-001234 (CRITICAL): OpenSSL remote code execution
    - Package: openssl (1.1.1a)
    - Fixed in: openssl (1.1.1q)
    - CVE URL: https://nvd.nist.gov/vuln/detail/CVE-2024-001234
```

## WAF Alignment

| Pillar | Contribution |
|--------|-------------|
| Security | Managed Identity pull (no hardcoded admin keys); vulnerability scanning prevents bad images reaching prod |
| Reliability | Geo-replication ensures image availability in all regions automatically |
| Cost Optimization | Premium tier with replication is cost-effective for multi-region deployments |

## Compatible Solution Plays

- **Play 02** — AI Landing Zone (centralized registry)
- **Play 12** — Model Serving AKS (image pulls)
- **Play 37** — DevOps AI (CI/CD scanning)

## Notes

- Premium SKU required for geo-replication; Standard sufficient for single-region
- `adminUserEnabled: false` forces all access through Managed Identity or SPN
- Trivy scanning can be integrated into `az acr task` for automated image analysis on push
- Set webhook scan action to `fail` to reject images with HIGH/CRITICAL CVEs
