---
name: deploy-copilot-studio-bot
description: "Deploy Copilot Studio Bot — configure topics, triggers, actions, knowledge sources, authentication, Microsoft Graph connectors. Use when: deploy, publish."
---

# Deploy Copilot Studio Bot

## When to Use
- Create and configure a Copilot Studio bot from scratch
- Set up topics, triggers, and conversation flows
- Configure knowledge sources (SharePoint, Dataverse, websites)
- Set up authentication (Azure AD, SSO)
- Publish to Teams, web, or custom channels

## Prerequisites
1. Microsoft 365 license with Power Platform access
2. Copilot Studio environment provisioned
3. Azure AD app registration for authentication
4. SharePoint sites / Dataverse tables for knowledge
5. Teams admin access (if publishing to Teams)

## Step 1: Create Bot in Copilot Studio
- Navigate to copilotstudio.microsoft.com
- Create new bot with descriptive name and language
- Select environment (dev/test/prod)
- Configure bot icon, greeting message, and description

## Step 2: Configure Knowledge Sources
| Source Type | Configuration | Best For |
|------------|--------------|---------|
| SharePoint | Site URL + pages filter | Policy docs, HR FAQs, wikis |
| Dataverse | Table + view selection | Structured data (products, tickets) |
| Websites | URL + crawl depth | Public docs, help centers |
| Custom API | Power Automate connector | Real-time data (inventory, status) |
| Files | Upload PDFs/docs directly | Static reference material |

**Best practices**:
- Limit to 3-5 knowledge sources per bot (reduces confusion)
- Use page-level filtering in SharePoint (not entire sites)
- Set content refresh schedule (daily for dynamic, weekly for static)

## Step 3: Design Topic Architecture
| Topic Type | Trigger | Use Case |
|-----------|---------|----------|
| System topics | Greeting, Escalation, Fallback | Built-in, customize only |
| Custom topics | Keyword/phrase triggers | Specific business workflows |
| Generative answers | No topic match → AI answers | Catch-all from knowledge |

**Topic design rules**:
- Keep topics focused (1 intent = 1 topic)
- Use trigger phrases (5-10 per topic for accuracy)
- Add confirmation nodes before actions
- Always provide an escape route ("Talk to human")
- Limit conversation depth to 5 turns per topic

## Step 4: Configure Actions (Power Automate)
- Create Power Automate flows for backend operations
- Pass variables from bot to flow and back
- Examples: create ticket, look up order, reset password
- Set timeout: 30 seconds max for user-facing actions

## Step 5: Set Up Authentication
```
Azure AD → App Registration → Configure:
- Client ID: {from app registration}
- Client Secret: {stored in Key Vault}
- Scope: User.Read, Sites.Read.All (minimum needed)
- Redirect URI: https://token.botframework.com/.auth/web/redirect
```
- Enable SSO for Teams channel (seamless authentication)
- Configure Conditional Access policies if required

## Step 6: Publish Bot
| Channel | Configuration | Notes |
|---------|--------------|-------|
| Teams | Manifest + admin approval | Most common enterprise channel |
| Web widget | Embed script on website | Customer-facing scenarios |
| Custom app | Direct Line API | Full control over UI |
| SharePoint | Web part integration | Embedded in intranet |

## Step 7: Post-Deployment Verification
- [ ] Bot responds to greeting
- [ ] All topics trigger correctly on test phrases
- [ ] Knowledge sources returning relevant answers
- [ ] Authentication flow works end-to-end
- [ ] Power Automate actions completing successfully
- [ ] Escalation to human agent works
- [ ] Analytics dashboard showing conversations

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Bot not responding | Environment not published | Publish to target channel |
| Wrong topic triggered | Overlapping trigger phrases | Deduplicate triggers across topics |
| Knowledge returns irrelevant | Too many sources indexed | Filter to specific pages/tables |
| Auth fails in Teams | Wrong redirect URI | Use exact Bot Framework redirect |
| Power Automate timeout | Flow too complex | Simplify flow, use async pattern |
| Generative answers hallucinate | No grounding instruction | Set system prompt with "only from context" |
| Bot unavailable in Teams | Admin approval pending | Submit for admin review |
