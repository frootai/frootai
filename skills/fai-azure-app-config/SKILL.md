---
name: fai-azure-app-config
description: Wire Azure App Configuration with feature flag targeting filters, Key Vault reference chaining, .NET/Python SDK refresh polling, and blue/green rollout strategies — eliminating hard-coded config values and restart-required deployments.
---

# FAI Azure App Configuration

Configures Azure App Configuration to serve feature flags, AI model parameters, and application settings dynamically -- with Key Vault reference chaining for secrets and sentinel-key-based refresh triggers. Eliminates the two most disruptive deployment patterns: hardcoded `appsettings.json` values and full restarts required to pick up configuration changes.

## When to Invoke

| Signal | Example |
|--------|---------|
| Model name or temperature is hard-coded | `model = "gpt-4o"` in source code |
| Feature rollout requires a redeployment | Enabling a new AI feature for 10% of users |
| Secrets appear in appsettings.json | `"ApiKey": "sk-..."` in a config file |
| Separate configs per environment are manual | Dev/staging/prod values copied by hand |

## Workflow

### Step 1 — Provision App Configuration Store

```bicep
// infra/app-config.bicep
resource appConfig 'Microsoft.AppConfiguration/configurationStores@2023-03-01' = {
  name: appConfigName
  location: location
  sku: { name: 'Standard' }
  identity: { type: 'SystemAssigned' }
  properties: {
    publicNetworkAccess: 'Disabled'    // Add private endpoint for production
    disableLocalAuth: true             // Force Managed Identity -- no access keys
  }
}

// RBAC -- App Configuration Data Reader for the app's Managed Identity
var appConfigDataReaderRoleId = '516239f1-63e1-4d78-a4de-a74fb236a071'

resource readerRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(appConfig.id, appIdentityId, appConfigDataReaderRoleId)
  scope: appConfig
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', appConfigDataReaderRoleId)
    principalId: appIdentityId
    principalType: 'ServicePrincipal'
  }
}
```

### Step 2 — Seed Configuration Values

```bash
# Seed model settings with labels for environment isolation
az appconfig kv set --name $APP_CONFIG_NAME \
  --key "AiSettings:Model" --value "gpt-4o-mini" --label dev
az appconfig kv set --name $APP_CONFIG_NAME \
  --key "AiSettings:Model" --value "gpt-4o" --label prod

az appconfig kv set --name $APP_CONFIG_NAME \
  --key "AiSettings:MaxTokens" --value "512" --label dev
az appconfig kv set --name $APP_CONFIG_NAME \
  --key "AiSettings:MaxTokens" --value "2048" --label prod

# Key Vault reference -- secret stays in Key Vault, reference pointer in App Config
az appconfig kv set-keyvault --name $APP_CONFIG_NAME \
  --key "AiSettings:OpenAiEndpoint" \
  --secret-identifier "https://${KV_NAME}.vault.azure.net/secrets/aoai-endpoint"

# Sentinel key -- flip this value to trigger refresh in all running instances
az appconfig kv set --name $APP_CONFIG_NAME \
  --key "App:Sentinel" --value "$(date -u +%s)"
```

### Step 3 — .NET SDK with Refresh Polling

```csharp
// Program.cs -- wire App Configuration with sentinel-key refresh
var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddAzureAppConfiguration(options =>
{
    options
        .Connect(
            new Uri(builder.Configuration["APP_CONFIG_ENDPOINT"]!),
            new DefaultAzureCredential())
        // Load all keys matching the label for this environment
        .Select("AiSettings:*", builder.Environment.EnvironmentName.ToLower())
        // Watch the sentinel key -- refresh all settings when it changes
        .ConfigureRefresh(refresh =>
        {
            refresh
                .Register("App:Sentinel", refreshAll: true)
                .SetRefreshInterval(TimeSpan.FromSeconds(30));
        })
        // Resolve Key Vault references automatically using Managed Identity
        .ConfigureKeyVault(kv => kv.SetCredential(new DefaultAzureCredential()));
});

builder.Services.AddAzureAppConfiguration();
builder.Services.Configure<AiSettings>(builder.Configuration.GetSection("AiSettings"));

var app = builder.Build();
app.UseAzureAppConfiguration();          // Middleware that checks for refresh
app.Run();
```

```csharp
// Strongly-typed settings record
public record AiSettings
{
    public required string Model          { get; init; }
    public          int    MaxTokens      { get; init; } = 512;
    public required string OpenAiEndpoint { get; init; }
}
```

### Step 4 — Python SDK with Refresh Polling

```python
from azure.appconfiguration.provider import load, WatchKey
from azure.identity import DefaultAzureCredential

config = load(
    endpoint=APP_CONFIG_ENDPOINT,
    credential=DefaultAzureCredential(),
    selects=[{"label_filter": "prod"}],
    refresh_on=[WatchKey("App:Sentinel")],
    refresh_interval=30,                        # seconds
    key_vault_options={"credential": DefaultAzureCredential()},
)

model      = config["AiSettings:Model"]
max_tokens = int(config["AiSettings:MaxTokens"])

# Refresh check -- call before each request in long-running processes
config.refresh()
```

### Step 5 — Feature Flag with Targeting Filter

```bash
# Create a feature flag with percentage rollout
az appconfig feature set --name $APP_CONFIG_NAME \
  --feature "streaming-responses" --label prod

az appconfig feature filter add --name $APP_CONFIG_NAME \
  --feature "streaming-responses" \
  --filter-name Microsoft.Targeting \
  --filter-parameters '{"Audience": {"DefaultRolloutPercentage": 10}}'

# Promote to 50% when metrics look good
az appconfig feature filter update --name $APP_CONFIG_NAME \
  --feature "streaming-responses" \
  --filter-name Microsoft.Targeting \
  --filter-parameters '{"Audience": {"DefaultRolloutPercentage": 50}}'
```

```csharp
// .NET feature flag check in endpoint handler
public async Task<IResult> HandleCompletionAsync(
    CompletionRequest req,
    IFeatureManager featureManager,
    IOptionsSnapshot<AiSettings> settings)
{
    bool useStreaming = await featureManager.IsEnabledAsync("streaming-responses");
    return useStreaming
        ? await HandleStreamingAsync(req, settings.Value)
        : await HandleStandardAsync(req, settings.Value);
}
```

## Label Strategy

| Label | Environment | Notes |
|-------|-------------|-------|
| `dev` | Development | Smaller models, lower token limits |
| `staging` | Pre-production | Same models as prod, lower rate limits |
| `prod` | Production | Full capacity models |
| _(no label)_ | Shared | Cross-environment defaults |

## WAF Alignment

| Pillar | Contribution |
|--------|-------------|
| Operational Excellence | Sentinel-key refresh enables config changes in running services without redeployment |
| Security | `disableLocalAuth: true` enforces Managed Identity; secrets remain in Key Vault, never in App Config values |
| Reliability | Config refresh polling means a misconfigured value can be corrected in <= 30 seconds without a restart |

## Compatible Solution Plays

- **Play 14** — Cost-Optimized AI Gateway (dynamic model routing config)
- **Play 03** — Deterministic Agent (model and temperature controlled via config)
- **Play 01** — Enterprise RAG (index name, chunk size as runtime config values)

## Notes

- `disableLocalAuth: true` means only Managed Identity works -- assign `App Configuration Data Reader` role before enabling this flag
- The sentinel key pattern avoids polling every individual key; one check drives a full refresh
- Labels are case-sensitive; use lowercase consistently (`dev`, `staging`, `prod`)
- Key Vault references require the App Config MSI to have `Key Vault Secrets User` on the Key Vault
