const fs = require('fs');
const path = require('path');

const oldNames = [
    'agent-chain-configure', 'api-rate-limit-configure', 'app-insights-configure',
    'audit-log-implement', 'azure-openai-setup', 'backup-restore-ai', 'bicep-module-create',
    'canary-deploy-ai', 'circuit-breaker-add', 'compliance-audit-run', 'content-safety-configure',
    'cost-dashboard-create', 'data-chunking-optimize', 'database-migrate-ai', 'docker-containerize',
    'embedding-model-select', 'evaluation-pipeline-create', 'feature-flag-ai',
    'github-actions-ai-pipeline', 'health-check-implement', 'incident-runbook-create',
    'key-vault-integrate', 'load-test-ai-endpoint', 'managed-identity-setup',
    'model-comparison-benchmark', 'multi-model-routing', 'observability-dashboard',
    'pii-detection-setup', 'prompt-version-manage', 'rag-pipeline-test', 'rbac-setup-play',
    'semantic-cache-implement', 'sla-monitor-setup', 'ssl-cert-configure',
    'streaming-response-implement', 'structured-output-enforce', 'token-budget-enforce',
    'vector-index-create', 'webhook-ai-event'
];

const root = 'c:/CodeSpace/frootai';

function walk(dir, exts) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (['node_modules', '.git', '.internal'].includes(entry.name)) continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== 'skills') results = results.concat(walk(full, exts));
            } else if (exts.some(x => entry.name.endsWith(x))) {
                results.push(full);
            }
        }
    } catch (e) { }
    return results;
}

const files = walk(root, ['.md', '.json', '.js', '.ts', '.yml', '.yaml']);
let totalHits = 0;

for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const name of oldNames) {
        // Search for old name NOT preceded by fai-
        const regex = new RegExp('(?<!fai-)\\b' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
        const matches = content.match(regex);
        if (matches) {
            const rel = path.relative(root, file);
            console.log(rel + ': ' + name + ' (' + matches.length + ' occurrences)');
            totalHits += matches.length;
        }
    }
}

console.log('\nTotal remaining old references: ' + totalHits);
