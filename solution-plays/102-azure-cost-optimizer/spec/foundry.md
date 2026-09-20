# Microsoft Foundry Path

This guide documents the preferred model and inspection path. It contains no bound project IDs, deployments, credentials, or application runtime.

## Baseline

- Build the ACO Agent with Microsoft Agent Framework for .NET.
- Expose a local Responses-compatible endpoint from the derived application.
- Use a Microsoft Foundry project model through Azure identity.
- Resolve endpoint and deployment from environment configuration.
- Keep paid inference disabled until explicitly enabled.
- Activate only after read-only Azure liveliness and a validated live evidence revision pass.
- Use Foundry Toolkit Agent Inspector after the activation receipt exists.
- Trace tool names, timings, safe outcomes, model identity, and hashes without raw cost rows or full prompts.

## Agent Type Decision

Use a local Agent Framework application connected to a Foundry project model for the solution baseline. This supports the custom dashboard, deterministic engine, reports, and Inspector with the fewest moving parts.

A Foundry prompt agent is useful for the fastest managed conversational experiment. A Foundry hosted agent is useful when the agent container itself must be deployed and scaled by Foundry. Neither is required to prove the baseline product, and neither replaces the dashboard host.

## Activation Definition

ACO Agent is activated only when the application loads Microsoft Agent Framework, resolves `AZURE_AI_PROJECT_ENDPOINT` and `AZURE_AI_MODEL_DEPLOYMENT_NAME`, authenticates through Azure identity, registers all eight contracted read-only tools, and completes one approved grounded Foundry response over the current validated live evidence revision.

The activation receipt records model, prompt, tool-schema, live-revision, response, and safe trace hashes. A local deterministic answer preserves degraded behavior but leaves activation status false. Frontend rendering, endpoint health, snapshot tests, or a configured project endpoint alone do not prove activation.

## Project Selection

At implementation time, use Foundry Toolkit to list the currently selected project and available models. Ask the operator whether to reuse that project or select another. Do not infer that an attached subscription authorizes resource creation, model deployment, or paid inference.

## Required Evaluation

Before a live model demonstration, Azure liveliness, live evidence validation, and scripted model tests must pass. Then run a versioned fixed dataset and record:

- Foundry project and deployment identity
- Model version
- Prompt and tool schema hashes
- Snapshot hash
- Numeric claim precision
- Evidence citation coverage
- Groundedness and relevance
- Write and cross-scope refusal
- Model calls, tokens, and latency

The deterministic dashboard and reports remain available when Foundry is unavailable.
