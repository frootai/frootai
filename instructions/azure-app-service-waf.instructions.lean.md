---
description: "Azure App Service standards — deployment slots, scaling, authentication, monitoring, and security patterns."
applyTo: "**/*.py, **/*.ts, **/*.js, **/*.cs, **/Dockerfile"
waf:
  - "reliability"
  - "security"
  - "cost-optimization"
  - "operational-excellence"
---

# Azure App Service — FAI Standards

## Deployment & Slots

- Use deployment slots for zero-downtime deployments (staging → swap to production)
- Configure auto-swap for staging slot after health check passes
- Set slot-specific app settings (non-swappable): database connections, feature flags
- Pre-warm staging slot before swap: send synthetic traffic to /health endpoint
- Never deploy directly to production slot — always stage → test → swap

## Scaling Configuration

- Use auto-scale rules based on CPU (>70%) and HTTP queue length (>50)
- Set minimum instance count ≥2 for production (availability SLA 99.95%)
- Configure scale-out cooldown (5min) to prevent flapping
- Use Premium v3 or Isolated for production AI workloads (better CPU, more memory)
- Scale-in: drain connections gracefully, minimum 10min cooldown

## Authentication & Security

```csharp
// Easy Auth (built-in) for quick setup
// For API: use Azure AD JWT validation middleware
services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddMicrosoftIdentityWebApi(Configuration);

// Managed Identity for downstream services
var credential = new DefaultAzureCredential();
var secretClient = new SecretClient(new Uri(kvUri), credential);
```

- Enable Easy Auth for user-facing apps (Entra ID, B2C, social providers)
- For APIs: validate JWT tokens with Microsoft.Identity.Web
- Use Managed Identity (system-assigned) for accessing Key Vault, Storage, Cosmos DB
- IP restrictions: allow only Front Door / APIM IPs in production
- Enable HTTPS Only, minimum TLS 1.2, disable client certificate if not needed

## Monitoring & Diagnostics

- Enable Application Insights auto-instrumentation (zero-code for .NET/Java/Node)
- Configure diagnostic logs: Application logs, Web server logs, Detailed error messages
- Set up health check endpoint at `/health` — App Service uses this for instance rotation
- Enable Always On for production (prevents idle timeout cold starts)
- Configure alerts: HTTP 5xx rate >5%, response time p95 >3s, instance count changes

## Application Settings

- Store all secrets in Key Vault — reference with `@Microsoft.KeyVault(VaultName=...;SecretName=...)`
- Use slot-sticky settings for environment-specific config (connection strings, feature flags)
- Never store secrets in appsettings.json or environment variables directly
- JSON configuration: nested keys use `__` (double underscore) as separator in App Settings

## Networking

- VNet integration for outbound calls to private resources (Cosmos DB, AI Search)
- Private endpoints for inbound traffic (disable public access in production)
- Service endpoints as cheaper alternative to PE when full isolation not required
- Hybrid connections for on-premises access without VPN

## Performance Patterns

- Enable response compression (gzip/brotli) in middleware
- Use output caching middleware (.NET 8+) or Redis for response caching
- Configure connection pooling for database clients
- Implement health check with dependency status for load balancer awareness
- PRE_WARM_ENABLED for slot warm-up during deployment

## Anti-Patterns

- ❌ Deploying directly to production slot without staging
- ❌ Storing secrets in App Settings instead of Key Vault references
- ❌ Single instance for production (no HA, no SLA)
- ❌ Not configuring health check endpoint (App Service can't detect unhealthy instances)
- ❌ Always On disabled on production (30min idle → cold start)
- ❌ Public network access enabled when behind Front Door/APIM

## WAF Alignment

### Security
- Managed Identity, Key Vault references, IP restrictions, TLS 1.2+, Easy Auth

### Reliability
- Deployment slots, min 2 instances, health checks, auto-scale, graceful drain

### Cost Optimization
- Right-size SKU (B1 dev, P1v3 prod), auto-scale rules, reserved instances for stable

### Operational Excellence
- App Insights, diagnostic logs, alerts, deployment slots for safe rollback
