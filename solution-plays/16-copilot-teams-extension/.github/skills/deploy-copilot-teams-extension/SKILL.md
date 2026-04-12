---
name: deploy-copilot-teams-extension
description: "Deploy Copilot Teams Extension — configure Teams app manifest, Bot Service, SSO, Adaptive Cards, Microsoft Graph API, admin approval. Use when: deploy, publish, configure Teams app."
---

# Deploy Copilot Teams Extension

## When to Use
- Create and deploy a Teams message extension or bot
- Configure Azure Bot Service with SSO
- Set up Microsoft Graph API integration
- Design Adaptive Card templates for rich responses
- Submit for Teams admin approval and publish

## Prerequisites
1. Azure CLI authenticated: `az account show`
2. Teams Toolkit CLI: `npm install -g @microsoft/teamsapp-cli`
3. Azure AD app registration with Teams permissions
4. M365 developer tenant or production tenant with admin access
5. Node.js 18+ (Teams bot runtime)

## Step 1: Create Teams App Project
```bash
# Initialize with Teams Toolkit
teamsapp new --template ai-bot --name copilot-teams-ext
cd copilot-teams-ext
```

## Step 2: Configure App Registration
```bash
# Register app in Azure AD
az ad app create --display-name "Copilot Teams Extension" \
  --sign-in-audience AzureADMyOrg \
  --web-redirect-uris "https://token.botframework.com/.auth/web/redirect"
```

**Required Graph API Permissions** (least privilege):
| Permission | Type | Purpose |
|-----------|------|---------|
| `User.Read` | Delegated | Read user profile for personalization |
| `Files.Read.All` | Delegated | Access SharePoint docs for knowledge |
| `Chat.ReadWrite` | Delegated | Read/write in Teams conversations |
| `TeamsActivity.Send` | Application | Send proactive notifications |

## Step 3: Configure Bot Service
```bash
az bot create --resource-group $RG --name $BOT_NAME \
  --kind registration --app-type SingleTenant \
  --appid $APP_ID --tenant-id $TENANT_ID
```
- Endpoint: `https://$APP_SERVICE.azurewebsites.net/api/messages`
- Enable Teams channel in Bot Service settings

## Step 4: Design Adaptive Cards
```json
{
  "type": "AdaptiveCard",
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "version": "1.5",
  "body": [
    { "type": "TextBlock", "text": "${title}", "weight": "Bolder", "size": "Medium" },
    { "type": "TextBlock", "text": "${summary}", "wrap": true },
    { "type": "FactSet", "facts": [
      { "title": "Source:", "value": "${source}" },
      { "title": "Confidence:", "value": "${confidence}" }
    ]}
  ],
  "actions": [
    { "type": "Action.OpenUrl", "title": "View Source", "url": "${sourceUrl}" },
    { "type": "Action.Submit", "title": "👍 Helpful", "data": { "feedback": "positive" } }
  ]
}
```

## Step 5: Configure SSO
- Enable SSO in Teams app manifest (`webApplicationInfo` section)
- Configure token exchange for seamless authentication
- Set `accessTokenAcceptedVersion: 2` in app registration manifest
- Test SSO flow: user opens extension → token acquired silently → Graph API accessible

## Step 6: Deploy to Azure
```bash
teamsapp deploy --env prod
# Or manual deployment
az webapp deploy --resource-group $RG --name $APP_NAME --src-path dist/
```

## Step 7: Submit for Admin Approval
```bash
# Package Teams app
teamsapp package --env prod --output-file teams-app.zip

# Upload to Teams admin center
# https://admin.teams.microsoft.com → Teams apps → Manage apps → Upload
```

## Step 8: Smoke Test
```bash
# Test in Teams
teamsapp preview --env dev
# Or install from admin center and test in Teams client
```
- [ ] Bot responds to messages in Teams
- [ ] Adaptive Cards render correctly
- [ ] SSO token acquired without user prompt
- [ ] Graph API calls returning data
- [ ] Feedback buttons working (thumbs up/down)

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Bot not responding in Teams | Endpoint URL wrong | Verify Bot Service endpoint matches App Service URL |
| SSO fails silently | Wrong redirect URI | Use exact `https://token.botframework.com/.auth/web/redirect` |
| Adaptive Card not rendering | Schema version mismatch | Use `version: "1.5"` for latest Teams support |
| Graph API 403 | Missing admin consent | Grant admin consent in Azure AD portal |
| Rate limited (429) | Too many Graph calls | Implement batching with `$batch` endpoint |
| Card actions not working | Missing `Action.Submit` handler | Add `onAdaptiveCardInvoke` in bot code |
| App not visible in Teams | Not published by admin | Upload to admin center, approve, publish |
