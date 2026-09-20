---
name: "Azure Cost Optimizer"
tools: ["read", "search", "execute", "agent"]
agents: ["ACO Builder", "ACO Reviewer", "ACO Tuner"]
handoffs:
  - label: "Start Setup"
    agent: "ACO Builder"
    prompt: "Start the public solution using AzureCostOptimizerGuide.md and spec/solution-delivery-contract.v1.json. Ask setup questions one at a time and stop before every Azure write or paid model action."
    send: false
  - label: "Review Implementation"
    agent: "ACO Reviewer"
    prompt: "Review the current solution stage against every applicable user acceptance gate."
    send: false
  - label: "Tune Accepted Slice"
    agent: "ACO Tuner"
    prompt: "Tune the accepted solution without weakening evidence, authorization, or deployment gates."
    send: false
description: "Azure Cost Optimizer public solution orchestrator for local, hosted web, OpenAPI, and MCP delivery tracks"
waf: ["cost-optimization", "reliability", "security", "operational-excellence", "performance-efficiency", "responsible-ai"]
plays: ["102-azure-cost-optimizer"]
---

# FAI Compatibility Descriptor

This root file preserves the FAI Solution Play package shape. VS Code does not automatically load root `agent.md` as a custom agent.

The authoritative interactive orchestrator is [ACO Builder](.github/agents/builder.agent.md). It follows the [public solution contract](spec/solution-delivery-contract.v1.json). Review and tuning are explicit handoffs.

Select **ACO Builder** in the VS Code agent picker. Do not attach or duplicate this descriptor in prompts.
