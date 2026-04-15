/**
 * Phase 1: Fix all 17 repo-level workflows
 * - P1-1: Add timeout-minutes to all jobs
 * - P1-2: Add concurrency group to deploy-chatbot.yml
 * - P1-3: Add npm cache to validate-mcp.yml, version-check.yml
 * - P1-4: Pin action versions consistently
 */

const fs = require('fs');
const path = require('path');

const wfDir = 'c:/CodeSpace/frootai/.github/workflows';
const files = fs.readdirSync(wfDir).filter(f => f.endsWith('.yml'));

// Pinned action versions (SHA-pinned where available)
const PINS = {
    'actions/checkout@v4': 'actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2',
    'actions/setup-node@v4': 'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0',
    'actions/setup-python@v5': 'actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065 # v5.6.0',
    'docker/login-action@v3': 'docker/login-action@74a5d142397b4f367a81961eba4e8cd7edddf772 # v3.4.0',
    'docker/setup-buildx-action@v3': 'docker/setup-buildx-action@b5ca514318bd6ebac0fb2aedd5d36ec1b5c232a2 # v3.10.0',
    'docker/setup-qemu-action@v3': 'docker/setup-qemu-action@29109295f81e9208d7d86ff1c6c12d2833863392 # v3.6.0',
    'docker/metadata-action@v5': 'docker/metadata-action@902fa8ec7d6ecbf8d84d538b9b233a880e428804 # v5.7.0',
    'docker/build-push-action@v5': 'docker/build-push-action@263435318d21b8e681c14492fe198e19c3b9cfa1 # v6.18.0',
    'azure/webapps-deploy@v3': 'azure/webapps-deploy@v3',
    'actions/github-script@v7': 'actions/github-script@60a0d83039c74a4aee543508d2ffcb1c3799cdea # v7.0.1',
    'softprops/action-gh-release@v2': 'softprops/action-gh-release@da05d552573ad5aba039eaac05058a918a7bf631 # v2.2.2',
};

// Timeout-minutes per workflow type
const TIMEOUTS = {
    'auto-generate.yml': 10,
    'consistency-check.yml': 10,
    'content-sync.yml': 10,
    'deploy-chatbot.yml': 15,
    'docker-publish.yml': 30,
    'mcp-ci.yml': 15,
    'npm-publish.yml': 15,
    'pypi-publish.yml': 15,
    'refresh-knowledge.yml': 20,
    'release.yml': 10,
    'sync-readme.yml': 10,
    'uptime.yml': 5,
    'validate-mcp.yml': 10,
    'validate-plays.yml': 20,
    'validate-primitives.yml': 15,
    'version-check.yml': 10,
    'vsce-publish.yml': 15,
};

let changes = { pins: 0, timeouts: 0, cache: 0, concurrency: 0 };

for (const file of files) {
    const fp = path.join(wfDir, file);
    let content = fs.readFileSync(fp, 'utf8');
    let modified = false;

    // P1-4: Pin action versions
    for (const [unpinned, pinned] of Object.entries(PINS)) {
        // Match uses: unpinned (but not already pinned)
        const regex = new RegExp(`uses:\\s*${unpinned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'gm');
        if (regex.test(content) && !content.includes(pinned)) {
            content = content.replace(
                new RegExp(`uses:\\s*${unpinned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'),
                `uses: ${pinned}`
            );
            changes.pins++;
            modified = true;
        }
    }

    // P1-1: Add timeout-minutes to all jobs
    const timeout = TIMEOUTS[file];
    if (timeout && !content.includes('timeout-minutes')) {
        // Insert timeout-minutes after 'runs-on: ubuntu-latest'
        content = content.replace(
            /runs-on:\s*ubuntu-latest\n/g,
            `runs-on: ubuntu-latest\n    timeout-minutes: ${timeout}\n`
        );
        changes.timeouts++;
        modified = true;
    }

    // P1-2: Add concurrency group to deploy-chatbot.yml
    if (file === 'deploy-chatbot.yml' && !content.includes('concurrency:')) {
        content = content.replace(
            'permissions:\n  contents: read\n',
            'permissions:\n  contents: read\n\nconcurrency:\n  group: deploy-chatbot-${{ github.ref }}\n  cancel-in-progress: false\n'
        );
        changes.concurrency++;
        modified = true;
    }

    // P1-3: Add npm cache to workflows missing it
    if (['validate-mcp.yml', 'version-check.yml'].includes(file)) {
        if (!content.includes("cache: 'npm'") && !content.includes('cache: npm')) {
            // Add cache to setup-node step
            const nodeSetupMatch = content.match(/uses:.*setup-node.*\n\s+with:\n\s+node-version:.*/);
            if (nodeSetupMatch) {
                const original = nodeSetupMatch[0];
                const replacement = original + "\n          cache: 'npm'";
                content = content.replace(original, replacement);
                changes.cache++;
                modified = true;
            }
        }
    }

    // validate-mcp: also change npm install to npm ci
    if (file === 'validate-mcp.yml') {
        if (content.includes('npm install') && !content.includes('npm ci')) {
            content = content.replace('run: npm install', 'run: npm ci');
            modified = true;
        }
    }

    if (modified) {
        fs.writeFileSync(fp, content, 'utf8');
        console.log(`✅ Fixed: ${file}`);
    } else {
        console.log(`  (no changes needed): ${file}`);
    }
}

console.log('\n--- Phase 1 Summary ---');
console.log(`Action pins upgraded: ${changes.pins}`);
console.log(`timeout-minutes added: ${changes.timeouts}`);
console.log(`npm cache added: ${changes.cache}`);
console.log(`Concurrency groups added: ${changes.concurrency}`);
