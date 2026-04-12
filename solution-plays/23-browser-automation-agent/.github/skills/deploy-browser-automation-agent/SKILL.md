---
name: deploy-browser-automation-agent
description: "Deploy Browser Automation Agent — configure Playwright, GPT-4o vision for page understanding, DOM state extraction, action execution, domain allowlists. Use when: deploy, provision browser agent."
---

# Deploy Browser Automation Agent

## When to Use
- Deploy an AI agent that navigates web pages using Playwright
- Configure GPT-4o vision for screenshot-based page understanding
- Set up DOM state extraction for structured page interaction
- Configure domain allowlists and credential management
- Deploy containerized browser with headless Chrome/Chromium

## Prerequisites
1. Node.js 18+ with Playwright installed: `npx playwright install`
2. Azure OpenAI with GPT-4o (vision capability for screenshots)
3. Azure Container Apps or ACI (headless browser hosting)
4. Domain allowlist prepared (which sites the agent can access)
5. Credentials vault for site-specific login (Key Vault)

## Step 1: Deploy Infrastructure
```bash
az bicep lint -f infra/main.bicep
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
```
Resources:
- Container Apps (headless Chromium + Playwright runtime)
- Azure OpenAI (GPT-4o for page analysis + action planning)
- Key Vault (site credentials, API tokens)
- Azure Storage (screenshot archive for debugging)
- Application Insights (action logs, success tracking)

## Step 2: Configure Browser Agent
```json
{
  "browser": {
    "headless": true,
    "viewport": { "width": 1280, "height": 720 },
    "timeout_ms": 30000,
    "user_agent": "FrootAI-BrowserAgent/1.0",
    "screenshot_on_action": true
  },
  "security": {
    "allowed_domains": ["*.company.com", "portal.azure.com"],
    "blocked_domains": ["*.malware.com"],
    "max_navigation_depth": 10,
    "credential_source": "keyvault"
  }
}
```

## Step 3: Configure Agent Action Loop
```
1. Navigate to URL
2. Take screenshot → GPT-4o vision analyzes page state
3. Extract DOM (accessible elements: buttons, inputs, links)
4. Agent decides next action (click, type, scroll, wait)
5. Execute action via Playwright
6. Take new screenshot → verify action succeeded
7. Repeat until task complete or max steps reached
```

## Step 4: Configure Page State Extraction
| Method | What It Captures | When to Use |
|--------|-----------------|-------------|
| Screenshot + vision | Visual layout, charts, images | Complex pages, visual decisions |
| DOM accessibility tree | Interactive elements, labels | Form filling, button clicking |
| Page text content | Raw text on page | Data extraction, reading content |
| Network requests | API calls, responses | Debugging, data capture |

## Step 5: Configure Credential Management
```bash
# Store site credentials in Key Vault
az keyvault secret set --vault-name $VAULT --name "portal-username" --value $USER
az keyvault secret set --vault-name $VAULT --name "portal-password" --value $PASS
```
- Never hardcode credentials in automation scripts
- Rotate credentials on schedule (90 days)
- Log all credential access for audit trail

## Step 6: Post-Deployment Verification
- [ ] Browser launches headless in container
- [ ] Screenshot capture working (saved to Storage)
- [ ] GPT-4o vision analyzing screenshots correctly
- [ ] DOM extraction returning interactive elements
- [ ] Domain allowlist blocking unauthorized navigation
- [ ] Credential retrieval from Key Vault working
- [ ] Action loop completing within step limit
- [ ] Error recovery on page load failures

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Browser crashes in container | Insufficient memory | Increase container memory to 2GB+ |
| Screenshot blank | Headless rendering issue | Add `--no-sandbox` flag |
| Vision misidentifies elements | Low resolution screenshot | Increase viewport to 1920x1080 |
| Login form fails | Dynamic selectors | Use accessible name selectors, not CSS |
| Page timeout | Slow site or SPA loading | Increase timeout, wait for network idle |
| Blocked by CAPTCHA | Bot detection | Add proxy rotation, human-in-the-loop |
| Wrong action taken | Ambiguous DOM state | Add more context to GPT-4o prompt |
