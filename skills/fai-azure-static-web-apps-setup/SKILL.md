---
name: fai-azure-static-web-apps-setup
description: |
  Set up Azure Static Web Apps with custom auth, staged preview environments, API
  backend linking, and route-level access control. Use when deploying frontend apps
  with serverless APIs, GitHub/Azure DevOps CI/CD, and role-based route protection.
---

# Azure Static Web Apps Setup

Deploy frontend apps with serverless APIs, preview environments, and role-based routing.

## When to Use

- Deploying React, Next.js, or other SPA frameworks to Azure
- Setting up preview environments per pull request
- Connecting Azure Functions as API backend
- Configuring route-level auth with AAD or custom providers

---

## Bicep Provisioning

```bicep
resource swa 'Microsoft.Web/staticSites@2023-12-01' = {
  name: swaName
  location: location
  sku: { name: 'Standard', tier: 'Standard' }
  properties: {
    repositoryUrl: repoUrl
    branch: 'main'
    buildProperties: {
      appLocation: '/'
      apiLocation: 'api'
      outputLocation: 'out'
    }
  }
}
```

## Route Configuration

```json
{
  "routes": [
    { "route": "/admin/*", "allowedRoles": ["admin"] },
    { "route": "/api/*", "allowedRoles": ["authenticated"] },
    { "route": "/*", "allowedRoles": ["anonymous"] }
  ],
  "auth": {
    "identityProviders": {
      "azureActiveDirectory": {
        "registration": { "openIdIssuer": "https://login.microsoftonline.com/{tenant}/v2.0",
          "clientIdSettingName": "AAD_CLIENT_ID" }
      }
    }
  },
  "responseOverrides": {
    "401": { "redirect": "/.auth/login/aad", "statusCode": 302 },
    "403": { "rewrite": "/unauthorized.html" }
  },
  "navigationFallback": { "rewrite": "/index.html",
    "exclude": ["/api/*", "/images/*", "/*.{css,js,png,svg}"] }
}
```

## GitHub Actions Workflow

```yaml
name: Deploy SWA
on:
  push: { branches: [main] }
  pull_request: { types: [opened, synchronize, closed], branches: [main] }

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.SWA_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: upload
          app_location: /
          api_location: api
          output_location: out
```

## Custom Domain + Edge Caching

```bash
# Add custom domain
az staticwebapp hostname set --name $SWA --hostname app.example.com

# Configure cache headers in staticwebapp.config.json
# Already handled via globalHeaders
```

```json
{
  "globalHeaders": {
    "Cache-Control": "public, max-age=300",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY"
  }
}
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Auth bypass on preview envs | Role rules not applied per route | Define routes in staticwebapp.config.json |
| API returns 404 | api_location mismatch in build config | Verify apiLocation matches Functions folder |
| Deploy fails on PR | Token not set for fork PRs | Use repository_dispatch or restrict to same-repo PRs |
| Stale cache after deploy | Aggressive cache-control | Use versioned asset filenames, set short max-age for HTML |
