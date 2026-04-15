---
name: fai-azure-app-config
description: |
  Set up Azure App Configuration for centralized settings, feature flags, key-value
  references, and environment-labeled configuration. Use when managing config across
  multiple services or implementing feature flag rollouts.
---

# Azure App Configuration

Centralize application settings with labels, feature flags, and Key Vault references.

## When to Use

- Managing configuration across multiple microservices
- Implementing feature flags for gradual rollout
- Centralizing settings that change between dev/staging/prod
- Referencing secrets from Key Vault without embedding them

---

## Bicep Provisioning

```bicep
resource appConfig 'Microsoft.AppConfiguration/configurationStores@2023-03-01' = {
  name: appConfigName
  location: location
  sku: { name: 'standard' }
  identity: { type: 'SystemAssigned' }
  properties: {
    publicNetworkAccess: 'Disabled'
    disableLocalAuth: true
    softDeleteRetentionInDays: 7
  }
}
```

## Label Strategy

Use labels to separate environments — same key, different values:

```bash
# Set value per environment
az appconfig kv set --name $STORE --key "app:MaxTokens" \
  --value 4096 --label dev
az appconfig kv set --name $STORE --key "app:MaxTokens" \
  --value 2048 --label prod

# Reference Key Vault secret
az appconfig kv set-keyvault --name $STORE \
  --key "app:OpenAIKey" --label prod \
  --secret-identifier "https://kv-prod.vault.azure.net/secrets/openai-key"
```

## Feature Flags

```bash
# Create a feature flag with targeting filter
az appconfig feature set --name $STORE \
  --feature "UseGPT4o" --label prod

# Add percentage filter (10% rollout)
az appconfig feature filter add --name $STORE \
  --feature "UseGPT4o" --label prod \
  --filter-name "Microsoft.Percentage" \
  --filter-parameters Percent=10
```

## .NET Integration

```csharp
builder.Configuration.AddAzureAppConfiguration(options =>
{
    options.Connect(new Uri(appConfigEndpoint), new DefaultAzureCredential())
           .Select(KeyFilter.Any, "prod")
           .ConfigureKeyVault(kv => kv.SetCredential(new DefaultAzureCredential()))
           .ConfigureRefresh(refresh =>
           {
               refresh.Register("app:Sentinel", refreshAll: true)
                      .SetRefreshInterval(TimeSpan.FromSeconds(30));
           })
           .UseFeatureFlags(flags =>
           {
               flags.Label = "prod";
               flags.CacheExpirationInterval = TimeSpan.FromSeconds(30);
           });
});
```

## Python Integration

```python
from azure.appconfiguration.provider import load
from azure.identity import DefaultAzureCredential

config = load(
    endpoint="https://appcfg-prod.azconfig.io",
    credential=DefaultAzureCredential(),
    selects=[{"key_filter": "app:*", "label_filter": "prod"}],
    keyvault_credential=DefaultAzureCredential(),
    refresh_on=[{"key": "app:Sentinel", "label": "prod"}],
    refresh_interval=30,
)

max_tokens = config["app:MaxTokens"]
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Config drift between environments | No label discipline | Enforce label strategy and promote via pipeline |
| Key Vault reference fails | MI missing Key Vault Secrets User | Grant RBAC role on Key Vault |
| Feature flag not activating | Stale cache | Trigger sentinel key update to force refresh |
| Slow startup | Loading too many keys | Narrow select filter with key prefix |
