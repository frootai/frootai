import { computeSimilarity } from './knowledge.js';

export interface ScaffoldOptions {
  name: string;
  model?: string;
  wafPillars?: string[];
  generateInfra?: boolean;
  dryRun?: boolean;
  description?: string;
  temperature?: number;
}

export interface ScaffoldResult {
  playDir: string;
  filesCreated: string[];
  wiredStatus?: string;
}

/**
 * Convert a string to kebab-case.
 */
function kebabCase(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Generate the file tree for a new solution play (24+ files).
 * Returns a Map of relative path → file content strings.
 * The generated structure matches the Play 101 golden template:
 *   agent.md, .github/ (agents, instructions, prompts, skills, hooks),
 *   .vscode/, config/, evaluation/, infra/, spec/, README.md
 */
export function generatePlayStructure(options: ScaffoldOptions): Map<string, string> {
  const {
    name,
    model = 'gpt-4o',
    wafPillars = ['security', 'reliability', 'cost-optimization'],
    generateInfra = true,
    description,
    temperature = 0.1,
  } = options;

  const slug = kebabCase(name);
  const desc = description ?? `${name} — AI-powered solution built with the FAI Protocol.`;
  const wafJson = JSON.stringify(wafPillars);
  const files = new Map<string, string>();

  // ── agent.md (root orchestrator)
  files.set('agent.md', `---
description: "${desc}"
tools: ["terminal", "file", "search"]
model: ["${model}", "gpt-4o-mini"]
waf: ${wafJson}
handoffs:
  - agent: "builder"
    prompt: "Build features for ${name}"
  - agent: "reviewer"
    prompt: "Review implementation for ${name}"
  - agent: "tuner"
    prompt: "Validate production readiness for ${name}"
---

# ${name}

Production agent for ${name}. Orchestrates builder → reviewer → tuner workflow.

## How to Use
1. Describe what you want to build
2. I'll delegate to the Builder agent for implementation
3. Then to the Reviewer for security + quality audit
4. Then to the Tuner for production readiness validation
`);

  // ── .github/copilot-instructions.md
  files.set('.github/copilot-instructions.md', `---
description: "${name} domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# ${name} — Domain Knowledge

This workspace implements ${desc}

## Key Architecture Decisions
- **Model**: ${model} (temperature: ${temperature})
- **WAF Pillars**: ${wafPillars.join(', ')}

## Project Conventions
- Use config/*.json for all AI parameters — never hardcode
- Use Azure Managed Identity for authentication — no API keys in code
- All responses must include citations when using retrieved context
- Follow the FAI Protocol: every primitive is wired through fai-manifest.json
`);

  // ── .github/agents/
  const roles = ['builder', 'reviewer', 'tuner'] as const;
  const roleDescs: Record<string, string> = {
    builder: `Implements features for ${name} — coding, API integration, pipeline setup`,
    reviewer: `Reviews ${name} implementation — security (OWASP LLM Top 10), quality, Azure best practices`,
    tuner: `Validates ${name} for production — config tuning, evaluation thresholds, infrastructure readiness`,
  };

  for (const role of roles) {
    files.set(`.github/agents/${role}.agent.md`, `---
description: "${roleDescs[role]}"
tools: ["read", "edit", "search", "execute"]
model: ["${model}", "gpt-4o-mini"]
waf: ${wafJson}
---

# ${role.charAt(0).toUpperCase() + role.slice(1)} Agent — ${name}

You are the **${role.charAt(0).toUpperCase() + role.slice(1)} Agent** for ${name}.

## File Discovery
Always use \`list_dir\` to discover files, then \`read_file\` with exact paths.

## Read Config Before Acting
- \`read_file config/openai.json\` for model parameters
- \`read_file config/guardrails.json\` for safety rules
`);
  }

  // ── .github/instructions/
  files.set(`.github/instructions/${slug}-patterns.instructions.md`, `---
description: "${name} implementation patterns and coding standards"
applyTo: "**/*.{py,ts,js,bicep}"
---

# ${name} — Implementation Patterns

## Architecture
- Use Azure Managed Identity for all service-to-service authentication
- Store secrets in Azure Key Vault — never in code or environment variables
- Implement retry logic with exponential backoff for all Azure SDK calls

## Error Handling
- Wrap all Azure SDK calls in try/catch with structured logging
- Return meaningful error messages — never expose raw exceptions to users
- Log correlation IDs for distributed tracing
`);

  // ── .github/prompts/
  const prompts: Array<[string, string]> = [
    ['deploy', 'Deploy to Azure'],
    ['test', 'Run test suite'],
    ['review', 'Code review'],
    ['evaluate', 'Run evaluation pipeline'],
  ];
  for (const [cmd, purpose] of prompts) {
    files.set(`.github/prompts/${cmd}.prompt.md`, `---
description: "${purpose} for ${name}"
---

# /${cmd}

${purpose} for ${name}.

## Steps
1. Read the relevant config files in config/
2. Execute the ${cmd} workflow
3. Report results with pass/fail status
`);
  }

  // ── .github/skills/
  for (const skill of ['deploy', 'evaluate', 'tune']) {
    const action = skill === 'deploy'
      ? 'Run Bicep deployment via `az deployment group create`'
      : skill === 'evaluate'
        ? 'Run `python evaluation/eval.py --ci-gate`'
        : 'Validate all config thresholds against best practices';

    files.set(`.github/skills/${skill}-${slug}/SKILL.md`, `---
name: "${skill}-${slug}"
description: "${skill.charAt(0).toUpperCase() + skill.slice(1)} skill for ${name}"
---

# ${skill.charAt(0).toUpperCase() + skill.slice(1)} — ${name}

This skill handles the ${skill} workflow for ${name}.

## Prerequisites
- Azure CLI authenticated (\`az login\`)
- Config files in config/ validated

## Steps
1. Read config from \`config/openai.json\` and \`config/guardrails.json\`
2. ${action}
3. Report results
`);
  }

  // ── .github/hooks/
  files.set('.github/hooks/guardrails.json', JSON.stringify({
    version: 1,
    hooks: {
      SessionStart: [{ type: 'command', bash: `echo 'FAI guardrails active for ${name}'` }],
    },
  }, null, 2));

  // ── .vscode/
  files.set('.vscode/mcp.json', JSON.stringify({
    servers: { frootai: { type: 'stdio', command: 'npx', args: ['frootai-mcp@latest'] } },
  }, null, 2));

  files.set('.vscode/settings.json', JSON.stringify({
    'chat.agent.enabled': true,
    'github.copilot.chat.agent.thinkingTool': true,
  }, null, 2));

  // ── config/ (TuneKit)
  files.set('config/openai.json', JSON.stringify({
    model, api_version: '2024-12-01-preview',
    temperature, top_p: 0.9, max_tokens: 1000,
    frequency_penalty: 0, presence_penalty: 0, seed: 42,
    _comments: {
      temperature: `${temperature} for ${temperature <= 0.3 ? 'factual/deterministic' : 'creative'} tasks`,
      model: 'Switch to gpt-4o-mini for cost reduction',
    },
  }, null, 2));

  files.set('config/guardrails.json', JSON.stringify({
    content_safety: { enabled: true, categories: ['hate', 'self_harm', 'sexual', 'violence'], severity_threshold: 2, action: 'block' },
    pii_detection: { enabled: true, categories: ['email', 'phone', 'ssn', 'credit_card'], action: 'redact' },
    prompt_injection: { enabled: true, action: 'block' },
    business_rules: { max_response_tokens: 1000, require_citations: true, min_confidence_to_answer: 0.7, abstention_message: "I don't have enough verified information to answer this accurately." },
  }, null, 2));

  // ── evaluation/
  files.set('evaluation/eval.py', `"""
Evaluation Pipeline for ${name}
FrootAI Solution Play — Azure AI Evaluation SDK

Usage:
    python evaluation/eval.py
    python evaluation/eval.py --test-set evaluation/test-set.jsonl
    python evaluation/eval.py --ci-gate --config config/guardrails.json
"""

import json
import sys
from pathlib import Path

def load_test_set(path="evaluation/test-set.jsonl"):
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]

def evaluate(test_cases):
    results = {"groundedness": 0.0, "relevance": 0.0, "coherence": 0.0, "fluency": 0.0, "safety": 0}
    # TODO: Implement evaluation using Azure AI Evaluation SDK
    print(f"Evaluated {len(test_cases)} test cases")
    return results

if __name__ == "__main__":
    test_set = load_test_set()
    scores = evaluate(test_set)
    print(json.dumps(scores, indent=2))
`);

  files.set('evaluation/test-set.jsonl',
    `{"question": "What does ${name} do?", "ground_truth": "${desc}", "context": ""}\n{"question": "How is ${name} deployed?", "ground_truth": "Deployed on Azure using Bicep IaC templates.", "context": ""}\n`
  );

  // ── infra/ (optional)
  if (generateInfra) {
    files.set('infra/main.bicep', `// ${name} — Azure Infrastructure
// Generated by FrootAI scaffold_play

targetScope = 'resourceGroup'

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Environment name')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

@description('Project name used for resource naming')
param projectName string = '${slug}'

// TODO: Add Azure resources for ${name}
// Common services: Azure OpenAI, AI Search, Container Apps, Key Vault
`);

    files.set('infra/parameters.json', JSON.stringify({
      '$schema': 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#',
      contentVersion: '1.0.0.0',
      parameters: { location: { value: 'eastus2' }, environment: { value: 'dev' }, projectName: { value: slug } },
    }, null, 2));
  }

  // ── spec/ (SpecKit + fai-manifest.json)
  const manifestContent = {
    play: `NN-${slug}`,
    version: '1.0.0',
    context: {
      knowledge: ['F1-GenAI-Foundations', 'R1-Prompt-Engineering', 'T3-Production-Patterns'],
      waf: wafPillars,
      scope: slug,
    },
    primitives: {
      agents: ['./agent.md'],
      instructions: [`./.github/instructions/${slug}-patterns.instructions.md`],
      skills: [`./.github/skills/deploy-${slug}/`, `./.github/skills/evaluate-${slug}/`, `./.github/skills/tune-${slug}/`],
      hooks: ['./.github/hooks/'],
      guardrails: { groundedness: 0.95, coherence: 0.90, relevance: 0.85, safety: 0, costPerQuery: 0.01 },
    },
    infrastructure: generateInfra ? { bicep: './infra/main.bicep', parameters: './infra/parameters.json' } : undefined,
    toolkit: { devkit: './.github/', tunekit: './config/', speckit: './spec/' },
  };

  files.set('spec/fai-manifest.json', JSON.stringify(manifestContent, null, 2));

  files.set('spec/play-spec.json', JSON.stringify({
    name, description: desc, version: '1.0.0',
    services: ['Azure OpenAI', 'Azure AI Search', 'Azure Container Apps', 'Azure Key Vault'],
    complexity: 'Medium', waf: wafPillars,
  }, null, 2));

  files.set('spec/CHANGELOG.md', `# ${name} — Changelog\n\n## 1.0.0 (${new Date().toISOString().slice(0, 10)})\n- Initial scaffold generated by FrootAI\n`);

  // ── README.md
  files.set('README.md', `# ${name}\n\n> ${desc}\n\n## Quick Start\n\n\`\`\`bash\nnpx frootai-mcp  # Start MCP server\n\`\`\`\n\n## Architecture\n\n- **Model**: ${model} (temperature: ${temperature})\n- **WAF**: ${wafPillars.join(', ')}\n- **DevKit**: .github/ Agentic OS (3 agents, 4 prompts, 3 skills)\n- **TuneKit**: config/ (openai.json, guardrails.json)\n- **SpecKit**: spec/ (fai-manifest.json)\n\n## FAI Protocol\n\nThis play is wired through the FAI Protocol. Run \`wire_play\` to verify.\n`);

  return files;
}

/**
 * Generate a single primitive file with proper frontmatter and naming.
 * Returns the relative path and the full file content string.
 */
export function generatePrimitive(
  type: 'agent' | 'instruction' | 'skill',
  name: string,
  options: { waf?: string[]; plays?: string[]; description?: string } = {}
): { path: string; content: string } {
  const slug = kebabCase(name);
  const waf = options.waf ?? [];
  const plays = options.plays ?? [];
  const desc = options.description ?? `${type.charAt(0).toUpperCase() + type.slice(1)} for ${name}`;
  const titleCase = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  if (type === 'agent') {
    const faiName = slug.startsWith('fai-') ? slug : `fai-${slug}`;
    return {
      path: `agents/${faiName}.agent.md`,
      content: `---
description: "${desc}"
tools: ["read", "edit", "search", "execute"]
model: ["gpt-4o", "gpt-4o-mini"]
waf: ${JSON.stringify(waf)}
plays: ${JSON.stringify(plays)}
---

# ${titleCase}

${desc}

## Responsibilities
- Implement features related to ${name}
- Follow WAF pillars: ${waf.join(', ') || 'none specified'}
- Read config files before making changes

## File Discovery
Always use \`list_dir\` to discover files, then \`read_file\` with exact paths.
`,
    };
  }

  if (type === 'instruction') {
    return {
      path: `instructions/${slug}.instructions.md`,
      content: `---
description: "${desc}"
applyTo: "**/*.{py,ts,js,bicep,json}"
waf: ${JSON.stringify(waf)}
---

# ${titleCase}

${desc}

## Patterns
- Follow Azure best practices for all service integrations
- Use Managed Identity for authentication
- Implement retry logic with exponential backoff
`,
    };
  }

  // skill
  const faiName = slug.startsWith('fai-') ? slug : `fai-${slug}`;
  return {
    path: `skills/${faiName}/SKILL.md`,
    content: `---
name: "${faiName}"
description: "${desc}"
---

# ${titleCase}

${desc}

## Prerequisites
- Azure CLI authenticated
- Required config files present

## Steps
1. Read configuration from config/
2. Execute the ${name} workflow
3. Report results with pass/fail status
`,
  };
}

/**
 * Semantic search for matching plays, returning scored results.
 * Uses keyword-based similarity between the query and each play's
 * name + pattern text.
 */
export function smartScaffold(
  query: string,
  plays: Array<{ id: string; name: string; pattern: string }>
): Array<{ id: string; name: string; score: number }> {
  return plays
    .map(play => ({
      id: play.id,
      name: play.name,
      score: computeSimilarity(query, `${play.name} ${play.pattern}`),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);
}
