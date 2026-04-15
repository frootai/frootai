const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const oldNames = [
    'fai-agent-chain-configure', 'fai-api-rate-limit-configure', 'fai-app-insights-configure',
    'fai-audit-log-implement', 'fai-azure-openai-setup', 'fai-backup-restore-ai', 'fai-bicep-module-create',
    'fai-canary-deploy-ai', 'fai-circuit-breaker-add', 'fai-compliance-audit-run', 'fai-content-safety-configure',
    'fai-cost-dashboard-create', 'fai-data-chunking-optimize', 'fai-database-migrate-ai', 'fai-docker-containerize',
    'fai-embedding-model-select', 'fai-evaluation-pipeline-create', 'fai-feature-flag-ai',
    'fai-github-actions-ai-pipeline', 'fai-health-check-implement', 'fai-incident-runbook-create',
    'fai-key-vault-integrate', 'fai-load-test-ai-endpoint', 'fai-managed-identity-setup',
    'fai-model-comparison-benchmark', 'fai-multi-model-routing', 'fai-observability-dashboard',
    'fai-pii-detection-setup', 'fai-prompt-version-manage', 'fai-rag-pipeline-test', 'fai-rbac-setup-play',
    'fai-semantic-cache-implement', 'fai-sla-monitor-setup', 'fai-ssl-cert-configure',
    'fai-streaming-response-implement', 'fai-structured-output-enforce', 'fai-token-budget-enforce',
    'fai-vector-index-create', 'fai-webhook-ai-event'
];

const root = path.resolve(__dirname, '..');

// Directories to search (exclude skills/, node_modules/, .git/, .internal/)
const searchDirs = [
    'plugins', 'hooks', 'cookbook', 'website-data', 'docs',
    'mcp-server', 'vscode-extension/src', 'python-sdk', 'config',
    'solution-plays', 'scripts', 'workshops'
];

function walk(dir, exts) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        if (entry.isDirectory()) {
            results = results.concat(walk(full, exts));
        } else if (exts.some(ext => entry.name.endsWith(ext))) {
            results.push(full);
        }
    }
    return results;
}

const exts = ['.md', '.json', '.js', '.ts', '.yml', '.yaml'];
let allFiles = [];
for (const d of searchDirs) {
    allFiles = allFiles.concat(walk(path.join(root, d), exts));
}

// Build regex that matches old names NOT preceded by 'fai-'
// We need word boundary matching to avoid partial matches
let totalFixes = 0;
let fixedFiles = new Set();

for (const file of allFiles) {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    for (const oldName of oldNames) {
        // Match the old name but NOT when preceded by 'fai-'
        // Use negative lookbehind
        const regex = new RegExp(`(?<!fai-)\\b${oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
        const matches = content.match(regex);
        if (matches && matches.length > 0) {
            content = content.replace(regex, `fai-${oldName}`);
            totalFixes += matches.length;
            changed = true;
        }
    }

    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
        fixedFiles.add(file);
        const rel = path.relative(root, file);
        console.log(`  Fixed: ${rel}`);
    }
}

console.log(`\nTotal fixes: ${totalFixes} across ${fixedFiles.size} files`);
