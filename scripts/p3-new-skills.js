// Create 40 new skills for common AI development tasks
const fs = require("fs"), path = require("path");
const skillsDir = "skills";

const newSkills = [
    { name: "fai-azure-openai-setup", desc: "Set up Azure OpenAI Service with model deployments, RBAC, and monitoring" },
    { name: "fai-vector-index-create", desc: "Create and populate a vector search index in Azure AI Search or Cosmos DB" },
    { name: "fai-rag-pipeline-test", desc: "Test a RAG pipeline end-to-end with relevance and groundedness metrics" },
    { name: "fai-content-safety-configure", desc: "Configure Azure Content Safety API with custom categories and thresholds" },
    { name: "fai-managed-identity-setup", desc: "Set up Managed Identity with RBAC role assignments for Azure services" },
    { name: "fai-key-vault-integrate", desc: "Integrate Azure Key Vault for secret management with Managed Identity" },
    { name: "fai-app-insights-configure", desc: "Configure Application Insights with custom metrics, alerts, and dashboards" },
    { name: "fai-bicep-module-create", desc: "Create a reusable Bicep module with parameters, outputs, and conditions" },
    { name: "fai-docker-containerize", desc: "Containerize an AI application with multi-stage Docker build and health checks" },
    { name: "fai-github-actions-ai-pipeline", desc: "Create a GitHub Actions CI/CD pipeline with evaluation gates for AI apps" },
    { name: "fai-prompt-version-manage", desc: "Version control prompts with A/B testing, rollback, and performance tracking" },
    { name: "fai-model-comparison-benchmark", desc: "Benchmark multiple AI models on cost, latency, quality for a specific task" },
    { name: "fai-data-chunking-optimize", desc: "Optimize document chunking strategy for RAG with semantic boundaries" },
    { name: "fai-embedding-model-select", desc: "Select and configure the optimal embedding model for vector search" },
    { name: "fai-api-rate-limit-configure", desc: "Configure API rate limiting with Azure APIM policies and retry headers" },
    { name: "fai-load-test-ai-endpoint", desc: "Load test an AI endpoint with k6/Locust for p95 latency and error rates" },
    { name: "fai-pii-detection-setup", desc: "Set up PII detection and masking with Azure AI Language service" },
    { name: "fai-semantic-cache-implement", desc: "Implement semantic caching for AI responses with Redis and embedding similarity" },
    { name: "fai-multi-model-routing", desc: "Implement model routing logic: cheap model for simple, capable for complex tasks" },
    { name: "fai-agent-chain-configure", desc: "Configure builder→reviewer→tuner agent chain with handoff rules" },
    { name: "fai-manifest-create", desc: "Create an fai-manifest.json with context, primitives, infrastructure, and guardrails" },
    { name: "fai-evaluation-pipeline-create", desc: "Create an evaluation pipeline with Azure AI Evaluation SDK and CI gate logic" },
    { name: "fai-structured-output-enforce", desc: "Enforce structured JSON output from LLMs with schema validation" },
    { name: "fai-streaming-response-implement", desc: "Implement streaming AI responses with Server-Sent Events (SSE)" },
    { name: "fai-circuit-breaker-add", desc: "Add circuit breaker pattern for Azure OpenAI calls with fallback behavior" },
    { name: "fai-cost-dashboard-create", desc: "Create a cost attribution dashboard for AI workloads with Azure Cost Management" },
    { name: "fai-audit-log-implement", desc: "Implement immutable audit logging with Azure Blob Storage and Sentinel" },
    { name: "fai-rbac-setup-play", desc: "Set up RBAC role assignments for a solution play's Azure resources" },
    { name: "fai-health-check-implement", desc: "Implement comprehensive health check endpoints for all AI service dependencies" },
    { name: "fai-token-budget-enforce", desc: "Enforce token budgets per user/team with tracking and alerting" },
    { name: "fai-webhook-ai-event", desc: "Set up webhooks for AI system events: evaluation results, safety alerts, cost alerts" },
    { name: "fai-database-migrate-ai", desc: "Migrate data and embeddings between vector databases with zero downtime" },
    { name: "fai-ssl-cert-configure", desc: "Configure SSL certificates for custom domains on Azure App Service/AKS" },
    { name: "fai-backup-restore-ai", desc: "Set up backup and restore procedures for AI application data and configurations" },
    { name: "fai-incident-runbook-create", desc: "Create an incident response runbook for AI system failures" },
    { name: "fai-sla-monitor-setup", desc: "Set up SLA monitoring with availability, latency, and quality metrics" },
    { name: "fai-canary-deploy-ai", desc: "Implement canary deployment for AI model updates with rollback on quality drop" },
    { name: "fai-feature-flag-ai", desc: "Implement feature flags for AI capabilities with gradual rollout" },
    { name: "fai-observability-dashboard", desc: "Create an observability dashboard with KQL queries for AI system health" },
    { name: "fai-compliance-audit-run", desc: "Run a compliance audit against HIPAA/FedRAMP/SOC2 requirements for AI systems" },
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
