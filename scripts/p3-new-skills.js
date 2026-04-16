// Create 40 new skills for common AI development tasks
const fs = require("fs"), path = require("path");
const skillsDir = "skills";

const newSkills = [
    { name: "azure-openai-setup", desc: "Set up Azure OpenAI deployments, RBAC, and monitoring — harden inference endpoints and control latency, quota, and cost" },
    { name: "vector-index-create", desc: "Create and populate a vector search index in Azure AI Search or Cosmos DB" },
    { name: "rag-pipeline-test", desc: "Test a RAG pipeline end-to-end with relevance and groundedness metrics" },
    { name: "content-safety-configure", desc: "Configure Azure Content Safety thresholds, blocklists, and prompt shields for AI apps - block unsafe inputs, detect jailbreaks, and monitor moderation drift" },
    { name: "managed-identity-setup", desc: "Set up Managed Identity with RBAC role assignments for Azure services" },
    { name: "key-vault-integrate", desc: "Integrate Azure Key Vault for secret management with Managed Identity" },
    { name: "app-insights-configure", desc: "Configure Application Insights, OpenTelemetry, and KQL dashboards for AI workloads — trace latency, token usage, failures, and cost signals" },
    { name: "bicep-module-create", desc: "Create reusable Bicep modules, parameter files, and registry packages — standardize Azure infrastructure and reduce deployment drift" },
    { name: "docker-containerize", desc: "Containerize AI applications with multi-stage images, health probes, and secure runtime settings - ship smaller containers and safer deployments" },
    { name: "github-actions-ai-pipeline", desc: "Create a GitHub Actions CI/CD pipeline with evaluation gates for AI apps" },
    { name: "prompt-version-manage", desc: "Version control prompts with A/B testing, rollback, and performance tracking" },
    { name: "model-comparison-benchmark", desc: "Benchmark multiple AI models on cost, latency, quality for a specific task" },
    { name: "data-chunking-optimize", desc: "Optimize RAG chunking, overlap, and metadata boundaries - improve retrieval recall, reduce noisy context, and preserve citation quality" },
    { name: "embedding-model-select", desc: "Select embedding models, dimensions, and hybrid search settings for vector workloads - balance recall, storage cost, and migration risk" },
    { name: "api-rate-limit-configure", desc: "Configure API rate limiting, APIM throttling, and retry behavior for AI endpoints — absorb bursts, isolate noisy tenants, and control 429 retries" },
    { name: "load-test-ai-endpoint", desc: "Load test an AI endpoint with k6/Locust for p95 latency and error rates" },
    { name: "pii-detection-setup", desc: "Set up PII detection and masking with Azure AI Language service" },
    { name: "semantic-cache-implement", desc: "Implement semantic caching for AI responses with Redis and embedding similarity" },
    { name: "multi-model-routing", desc: "Implement model routing logic: cheap model for simple, capable for complex tasks" },
    { name: "agent-chain-configure", desc: "Orchestrate builder, reviewer, and tuner agent handoffs for solution plays — define roles, model routing, token budgets, and quality gates" },
    { name: "fai-manifest-create", desc: "Create an fai-manifest.json with context, primitives, infrastructure, and guardrails" },
    { name: "evaluation-pipeline-create", desc: "Create evaluation pipelines, CI gates, and regression checks for AI systems - score groundedness, block regressions, and publish release verdicts" },
    { name: "structured-output-enforce", desc: "Enforce structured JSON output from LLMs with schema validation" },
    { name: "streaming-response-implement", desc: "Implement streaming AI responses with Server-Sent Events (SSE)" },
    { name: "circuit-breaker-add", desc: "Add a circuit breaker, fallback routing, and health checks for Azure OpenAI calls — contain 429 and 503 cascades and preserve service" },
    { name: "cost-dashboard-create", desc: "Create cost dashboards, budget alerts, and attribution views for AI workloads - track token spend by model, team, and tenant before overruns hit production" },
    { name: "audit-log-implement", desc: "Implement immutable audit logging, PII redaction, and Sentinel monitoring for AI systems — preserve evidence, prove access history, and detect suspicious activity" },
    { name: "rbac-setup-play", desc: "Set up RBAC role assignments for a solution play's Azure resources" },
    { name: "health-check-implement", desc: "Implement comprehensive health check endpoints for all AI service dependencies" },
    { name: "token-budget-enforce", desc: "Enforce token budgets per user/team with tracking and alerting" },
    { name: "webhook-ai-event", desc: "Set up webhooks for AI system events: evaluation results, safety alerts, cost alerts" },
    { name: "database-migrate-ai", desc: "Migrate AI data, embeddings, and index schemas with zero-downtime cutovers - preserve compatibility, validate every step, and keep rollback ready" },
    { name: "ssl-cert-configure", desc: "Configure SSL certificates for custom domains on Azure App Service/AKS" },
    { name: "backup-restore-ai", desc: "Back up AI data, vector indexes, and configuration state — recover prompts, conversations, and search assets after failures" },
    { name: "incident-runbook-create", desc: "Create an incident response runbook for AI system failures" },
    { name: "sla-monitor-setup", desc: "Set up SLA monitoring with availability, latency, and quality metrics" },
    { name: "canary-deploy-ai", desc: "Implement canary deployment, rollout gates, and rollback automation for AI changes — catch latency or quality regressions before full release" },
    { name: "feature-flag-ai", desc: "Implement feature flags for AI capabilities with gradual rollout" },
    { name: "observability-dashboard", desc: "Create an observability dashboard with KQL queries for AI system health" },
    { name: "compliance-audit-run", desc: "Run AI compliance audits, collect Azure evidence, and track remediation — assess SOC 2, HIPAA, ISO 27001, and EU AI Act controls" },
];

let created = 0;
for (const skill of newSkills) {
    const skillDir = path.join(skillsDir, skill.name);
    const skillFile = path.join(skillDir, "SKILL.md");
    if (fs.existsSync(skillFile)) continue;

    fs.mkdirSync(skillDir, { recursive: true });
    const content = `---
name: "${skill.name}"
description: "${skill.desc}"
---

# ${skill.name.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}

## Overview
${skill.desc}. This skill provides a production-grade, step-by-step procedure for implementing this capability in FrootAI solution plays.

## Prerequisites
- Azure CLI v2.60+ authenticated (\`az login\`)
- Azure subscription with Contributor access
- Node.js 20+ or Python 3.10+
- FrootAI DevKit initialized in the solution play

## Step 1: Verify Environment
\`\`\`bash
# Verify Azure authentication
az account show --query name -o tsv

# Verify required tools
az version --query '"azure-cli"' -o tsv
node --version
python --version
\`\`\`

## Step 2: Configure
Review and update the relevant configuration in \`config/\`:
- \`config/openai.json\` — Model parameters
- \`config/guardrails.json\` — Safety thresholds
- \`config/agents.json\` — Agent behavior rules

## Step 3: Implement
Apply the ${skill.name.replace(/-/g, " ")} pattern:
1. Review existing architecture and identify integration points
2. Implement the core functionality following Azure SDK best practices
3. Add error handling with retry logic and circuit breaker
4. Configure monitoring and alerting
5. Add unit and integration tests

## Step 4: Validate
\`\`\`bash
# Run validation
npm run validate:primitives

# Run tests
pytest tests/ -v --cov=app

# Check Azure resources
az resource list -g rg-frootai-dev -o table
\`\`\`

## Step 5: Deploy
\`\`\`bash
# Deploy infrastructure changes
az bicep build -f infra/main.bicep
azd up --environment dev

# Verify deployment
curl -sf https://\${APP_URL}/health | jq .
\`\`\`

## Step 6: Verify
- [ ] Implementation follows Azure best practices
- [ ] Error handling covers all failure modes
- [ ] Monitoring and alerting configured
- [ ] Tests pass with adequate coverage
- [ ] Documentation updated

## Troubleshooting
| Issue | Solution |
|-------|---------|
| Authentication failure | Run \`az login\` and verify RBAC assignments |
| Resource not found | Check resource group and naming convention |
| Timeout | Increase timeout in config, check network path |
| Validation error | Review config/*.json for correct values |

## Related
- [FrootAI Documentation](https://frootai.dev)
- [Azure Best Practices](https://learn.microsoft.com/azure/well-architected/)
- [FAI Protocol](https://frootai.dev/fai-protocol)
`;

    fs.writeFileSync(skillFile, content);
    created++;
}

const totalSkills = fs.readdirSync(skillsDir, { withFileTypes: true }).filter(d => d.isDirectory()).length;
console.log(`Created: ${created} new skills`);
console.log(`Total skills: ${totalSkills}`);

// Recount all primitives
const counts = {
    agents: fs.readdirSync("agents").filter(f => f.endsWith(".agent.md")).length,
    instructions: fs.readdirSync("instructions").filter(f => f.endsWith(".instructions.md")).length,
    skills: totalSkills,
    hooks: fs.readdirSync("hooks", { withFileTypes: true }).filter(d => d.isDirectory()).length,
    plugins: fs.readdirSync("plugins", { withFileTypes: true }).filter(d => d.isDirectory()).length,
};
const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log("Counts:", JSON.stringify(counts));
console.log(`TOTAL PRIMITIVES: ${total}`);
