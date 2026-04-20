---
sidebar_position: 13
title: "O6: Copilot Ecosystem"
description: "The Microsoft Copilot ecosystem — architecture, Copilot Stack, M365 Copilot, GitHub Copilot, Copilot Studio, Security Copilot, and how to extend them with plugins and declarative agents."
---

# O6: Copilot Ecosystem

"Copilot" is a **brand and product family**, not a single product. Microsoft has embedded Copilot across its entire stack — from code editors to security operations. This module maps the ecosystem, explains the shared architecture, and shows how to extend Copilots with custom capabilities. For AI agent patterns that Copilots build on, see [O2: AI Agents Deep Dive](./o2-agents-deep-dive.md). For the platform hosting Copilot models, see [O4: Azure AI Foundry](./o4-azure-ai-foundry.md).

## Core Architecture

Every Microsoft Copilot shares the same foundational pattern:

```
┌─────────────────────────────────────────────┐
│              Copilot Experience              │
│  (Chat UI, inline suggestions, side panel)   │
├─────────────────────────────────────────────┤
│            Orchestration Layer               │
│  (Prompt construction, tool routing, safety) │
├──────────┬──────────────┬───────────────────┤
│  LLM     │  Grounding   │  Product          │
│  (GPT-4o)│  Data        │  Integration      │
│          │  (Graph, code,│  (Editor, Office, │
│          │   docs, web)  │   Azure portal)   │
└──────────┴──────────────┴───────────────────┘
```

The **grounding data** is what makes each Copilot different — same model, different context.

## The Copilot Stack

| Layer | What It Does | Components |
|-------|-------------|------------|
| **User Layer** | Surface Copilot in the product UX | Chat panel, inline completions, side panes |
| **Orchestration** | Construct prompts, route tools, enforce safety | Semantic Kernel, Prompt Flow, content filters |
| **Data & Intelligence** | Ground responses in real data | Microsoft Graph, Azure AI Search, code index |
| **Foundation** | Core reasoning | Azure OpenAI (GPT-4o, GPT-4o-mini) |

## Copilot Comparison

| Copilot | Domain | Grounding Data | Licensing |
|---------|--------|---------------|-----------|
| **M365 Copilot** | Productivity (Word, Excel, Teams, Outlook) | Microsoft Graph (emails, files, calendar, chats) | $30/user/month add-on |
| **GitHub Copilot** | Software development | Code repositories, docs, web | $10–39/user/month |
| **Copilot for Azure** | Cloud operations | Azure resources, docs, Monitor logs | Free (in Azure Portal) |
| **Copilot Studio** | Custom copilot builder | Customer data sources (configurable) | Per-message pricing |
| **Security Copilot** | Security operations | Sentinel, Defender, threat intelligence | Per SCU (Security Compute Unit) |
| **Copilot in Windows** | Desktop assistant | Local files, web, settings | Included with Windows 11 |
| **Copilot in Dynamics 365** | CRM/ERP | Dataverse, customer records | Included with Dynamics license |

:::info Key Insight
Every Copilot uses the same underlying LLM (GPT-4o). The differentiation is **grounding** — M365 Copilot is grounded in your Graph data, GitHub Copilot is grounded in your code, Security Copilot is grounded in threat intelligence.
:::

## Microsoft 365 Copilot

| Capability | What It Does |
|------------|-------------|
| **Word** | Draft documents, summarize, rewrite with tone control |
| **Excel** | Analyze data, generate formulas, create charts from natural language |
| **PowerPoint** | Generate presentations from Word docs or prompts |
| **Outlook** | Summarize email threads, draft replies, prioritize inbox |
| **Teams** | Meeting summaries, action items, catch-up on missed meetings |
| **Business Chat** | Cross-app queries grounded in all your M365 data |

**Grounding**: Microsoft Graph — your emails, files, calendar, chats, contacts. Copilot sees what you have access to (respects existing permissions and RBAC).

## GitHub Copilot

GitHub Copilot has evolved from code completion into a full development platform:

| Feature | What It Does |
|---------|-------------|
| **Code Completion** | Inline suggestions as you type (single line and multi-line) |
| **Copilot Chat** | Natural language Q&A about code in the editor |
| **Copilot Edits** | Multi-file code changes from natural language descriptions |
| **Copilot Agents** | Autonomous coding agents for issues and PRs |
| **CLI Assistant** | Terminal command suggestions and explanations |
| **Extensions** | Third-party tools integrated into Copilot Chat |

**Grounding**: Your open files, repository context, language documentation, web search.

```
# GitHub Copilot tiers
Individual:  $10/month  — code completion + chat
Business:    $19/month  — + org policies, audit logs
Enterprise:  $39/month  — + knowledge bases, fine-tuning
```

:::tip
GitHub Copilot's agent mode (`@workspace`) can autonomously plan, implement, and test code changes across multiple files. For agent patterns beyond code, see [O2: AI Agents Deep Dive](./o2-agents-deep-dive.md).
:::

## Copilot for Azure

Available directly in the Azure Portal — no additional cost:

| Capability | Example |
|------------|---------|
| **Resource management** | "Show me all VMs that are stopped" |
| **Troubleshooting** | "Why is my App Service returning 503?" |
| **Cost analysis** | "What are my top 5 cost drivers this month?" |
| **IaC generation** | "Generate Bicep for a web app with SQL backend" |
| **KQL queries** | "Write a query to find failed requests in the last hour" |

**Grounding**: Azure Resource Graph, Azure Monitor, Azure documentation.

## Copilot Studio

Copilot Studio is the **low-code platform for building custom copilots**:

| Feature | Description |
|---------|-------------|
| **Topics** | Conversation flows — trigger phrases → actions → responses |
| **Generative answers** | Ground responses in your data (SharePoint, websites, files) |
| **Plugins** | Extend with custom actions (Power Automate, HTTP connectors) |
| **Channels** | Deploy to Teams, web, Slack, custom apps |
| **Analytics** | Session tracking, resolution rates, escalation metrics |

Best for: customer support bots, HR assistants, IT help desks — where non-developers need to build and maintain AI experiences.

## Security Copilot

Purpose-built for security operations:

| Capability | Grounding Source |
|------------|-----------------|
| Incident investigation | Microsoft Sentinel alerts |
| Threat analysis | Microsoft Defender Threat Intelligence |
| Vulnerability assessment | Defender for Cloud |
| Script analysis | Reverse engineering, malware detection |
| Report generation | Cross-product security data |

## Extensibility

### Plugins
Plugins extend Copilot's capabilities with custom actions:

```json
{
  "schema_version": "v1",
  "name": "contoso-crm",
  "description": "Look up customer information in Contoso CRM",
  "functions": [{
    "name": "get_customer",
    "description": "Get customer details by name or ID",
    "parameters": {
      "customer_id": { "type": "string", "description": "Customer ID or name" }
    }
  }]
}
```

### Declarative Agents
Custom Copilot personas with specific knowledge, instructions, and tool access — deployed as M365 Copilot extensions:

| Component | Purpose |
|-----------|---------|
| **Instructions** | System prompt defining persona and behavior |
| **Knowledge** | Grounding sources (SharePoint, Graph connectors) |
| **Actions** | Plugins the agent can invoke |
| **Starter prompts** | Suggested conversation starters |

### Extension Types

| Type | What It Is | Built With | Deployed To |
|------|-----------|------------|-------------|
| **Plugin** | Single action/API | OpenAPI spec | M365, Copilot Studio |
| **Declarative Agent** | Custom persona + knowledge + actions | Teams Toolkit | M365 Copilot |
| **Copilot Studio Agent** | Full custom copilot | Copilot Studio | Teams, web, Slack |
| **GitHub Copilot Extension** | Chat participant in VS Code | GitHub App + API | GitHub Copilot Chat |

## Key Takeaways

1. **Copilot = brand**, not product — same LLM, different grounding data per domain
2. The Copilot Stack: User Layer → Orchestration → Data & Intelligence → Foundation
3. **M365 Copilot** is grounded in Microsoft Graph (your org's data)
4. **GitHub Copilot** has evolved into a full development platform with agents
5. **Copilot Studio** enables non-developers to build custom copilots
6. Extend any Copilot via **plugins** (actions), **declarative agents** (personas), or **Copilot Studio** (full custom)
7. Security, cost, and grounding data sources are the key differentiators across the family
