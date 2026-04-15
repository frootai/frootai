---
name: fai-ssl-cert-configure
description: "Configure SSL certificates for custom domains on Azure App Service/AKS"
---

# SSL/TLS Certificate Configuration for AI Applications

## Key Vault Certificate Management

Store all certificates in Azure Key Vault. Never embed PFX files in repos or container images.

```bicep
// Key Vault with certificate management permissions
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
    }
  }
}

// Import a PFX certificate into Key Vault
resource certificate 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'api-tls-cert'
  properties: {
    contentType: 'application/x-pkcs12'
    value: pfxBase64  // pass via @secure() param, never hardcode
  }
}
```

```bash
# Import PFX into Key Vault (preferred over Bicep for rotation)
az keyvault certificate import \
  --vault-name kv-fai-prod \
  --name api-tls-cert \
  --file ./cert.pfx \
  --password "$PFX_PASSWORD"

# Create a self-signed cert for dev/test
az keyvault certificate create \
  --vault-name kv-fai-dev \
  --name dev-cert \
  --policy "$(az keyvault certificate get-default-policy)"
```

## App Service Custom Domain + SSL Binding

```bicep
param customDomain string
param certificateThumbprint string

resource appService 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  properties: {
    httpsOnly: true
    siteConfig: {
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      http20Enabled: true
    }
  }
}

resource hostBinding 'Microsoft.Web/sites/hostNameBindings@2023-12-01' = {
  parent: appService
  name: customDomain
  properties: {
    sslState: 'SniEnabled'
    thumbprint: certificateThumbprint
  }
}
```

## Managed Certificate vs Bring-Your-Own

Use **App Service Managed Certificates** for simple single-domain TLS — zero cost, auto-renewed:

```bash
# Create managed certificate (free, auto-renewed by Azure)
az webapp config ssl create \
  --resource-group rg-fai-prod \
  --name app-fai-api \
  --hostname api.contoso.com

# Bind the managed cert
az webapp config ssl bind \
  --resource-group rg-fai-prod \
  --name app-fai-api \
  --certificate-thumbprint "$THUMBPRINT" \
  --ssl-type SNI
```

Bring your own when you need: wildcard certs, EV certs, multi-SAN, or certificates from internal CA. Store in Key Vault, reference by secret URI.

## TLS 1.2+ Enforcement

Enforce across all services — AI endpoints carry sensitive prompts and PII in payloads.

```bicep
// App Service — enforce TLS 1.2
resource siteConfig 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: appService
  name: 'web'
  properties: {
    minTlsVersion: '1.2'
    scmMinTlsVersion: '1.2'
    ftpsState: 'Disabled'
  }
}

// Azure SQL — enforce TLS 1.2
resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: sqlName
  location: location
  properties: {
    minimalTlsVersion: '1.2'
  }
}

// Storage account — enforce TLS 1.2
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}
```

## Certificate Rotation Automation

```bash
#!/bin/bash
# Rotate certificate via Key Vault + Event Grid
# Trigger: Event Grid subscription on SecretNearExpiry event

VAULT="kv-fai-prod"
CERT="api-tls-cert"

# Check expiry (alert if <30 days)
EXPIRY=$(az keyvault certificate show --vault-name $VAULT --name $CERT \
  --query 'attributes.expires' -o tsv)
DAYS_LEFT=$(( ($(date -d "$EXPIRY" +%s) - $(date +%s)) / 86400 ))

if [ "$DAYS_LEFT" -lt 30 ]; then
  echo "Certificate expires in $DAYS_LEFT days — rotating"
  # Renew via ACME or re-import from CA
  az keyvault certificate create --vault-name $VAULT --name $CERT \
    --policy "$(az keyvault certificate get-default-policy)"
fi
```

Set up Event Grid to fire on `Microsoft.KeyVault.CertificateNearExpiry`:

```bash
az eventgrid event-subscription create \
  --source-resource-id "/subscriptions/$SUB/resourceGroups/$RG/providers/Microsoft.KeyVault/vaults/$VAULT" \
  --name cert-expiry-alert \
  --endpoint "$LOGIC_APP_URL" \
  --included-event-types Microsoft.KeyVault.CertificateNearExpiry
```

## Front Door SSL Termination

Front Door handles TLS termination at the edge — AI API traffic decrypted at PoP, re-encrypted to origin.

```bicep
resource frontDoor 'Microsoft.Cdn/profiles@2024-02-01' = {
  name: fdName
  location: 'global'
  sku: { name: 'Premium_AzureFrontDoor' }
}

resource customDomainFd 'Microsoft.Cdn/profiles/customDomains@2024-02-01' = {
  parent: frontDoor
  name: 'api-domain'
  properties: {
    hostName: 'api.contoso.com'
    tlsSettings: {
      certificateType: 'ManagedCertificate'    // Free, auto-renewed
      minimumTlsVersion: 'TLS12'
    }
  }
}
```

For BYOC on Front Door, reference Key Vault:

```bicep
tlsSettings: {
  certificateType: 'CustomerCertificate'
  secret: { id: 'https://kv-fai-prod.vault.azure.net/secrets/api-tls-cert' }
  minimumTlsVersion: 'TLS12'
}
```

## Container Apps Custom Domain

```bash
# Add custom domain with managed cert to Container App
az containerapp hostname add \
  --resource-group rg-fai-prod \
  --name ca-fai-api \
  --hostname api.contoso.com

# Bind managed certificate
az containerapp hostname bind \
  --resource-group rg-fai-prod \
  --name ca-fai-api \
  --hostname api.contoso.com \
  --environment cae-fai-prod \
  --validation-method CNAME
```

For BYOC on Container Apps, upload to the environment first:

```bash
az containerapp env certificate upload \
  --resource-group rg-fai-prod \
  --name cae-fai-prod \
  --certificate-file ./cert.pfx \
  --password "$PFX_PASSWORD"
```

## Monitoring Certificate Expiry

```bash
# Query all certificates expiring within 30 days across subscriptions
az keyvault certificate list --vault-name kv-fai-prod \
  --query "[?attributes.expires < '$(date -u -d '+30 days' +%Y-%m-%dT%H:%M:%SZ)'].{name:name, expires:attributes.expires}" \
  -o table

# Azure Monitor alert rule for certificate expiry (KQL)
# AppServiceCertificates
# | where ExpirationDate < now() + 30d
# | project CertificateName, ExpirationDate, DaysUntilExpiry = datetime_diff('day', ExpirationDate, now())
```

## mTLS for Service-to-Service

AI microservices (embedding service ↔ orchestrator ↔ vector DB proxy) should use mTLS for zero-trust:

```bicep
// App Service — require client certificates
resource appMtls 'Microsoft.Web/sites@2023-12-01' = {
  name: 'app-fai-embedding-svc'
  location: location
  properties: {
    clientCertEnabled: true
    clientCertMode: 'Required'           // Reject requests without valid client cert
    clientCertExclusionPaths: '/health'  // Health probes exempt
    httpsOnly: true
  }
}
```

```bash
# Generate client cert signed by internal CA (stored in Key Vault)
az keyvault certificate create \
  --vault-name kv-fai-prod \
  --name svc-client-cert \
  --policy @mtls-policy.json

# Test mTLS connectivity
curl --cert client.pem --key client-key.pem \
  https://app-fai-embedding-svc.azurewebsites.net/embeddings
```

## Let's Encrypt Automation

For non-Azure-managed scenarios (self-hosted, AKS ingress):

```bash
# cert-manager on AKS with Let's Encrypt
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true
```

```yaml
# ClusterIssuer for Let's Encrypt production
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: platform-team@contoso.com
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
      - http01:
          ingress:
            class: nginx
---
# Certificate for AI API ingress
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: ai-api-tls
  namespace: fai-prod
spec:
  secretName: ai-api-tls-secret
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
    - api.contoso.com
    - inference.contoso.com
  renewBefore: 360h   # Renew 15 days before expiry
```

## Checklist

- [ ] All certificates stored in Key Vault — none in repos or images
- [ ] TLS 1.2 minimum enforced on every service (App Service, SQL, Storage, Redis)
- [ ] Certificate expiry monitoring with 30-day alerting via Event Grid
- [ ] Managed certificates used where possible (App Service, Front Door, Container Apps)
- [ ] mTLS enabled between AI microservices carrying embeddings or model responses
- [ ] FTPS disabled, HTTPS-only enabled on all web services
- [ ] Let's Encrypt + cert-manager for AKS ingress with auto-renewal
