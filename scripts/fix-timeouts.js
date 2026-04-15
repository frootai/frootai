/**
 * Phase 1 v2: Add timeout-minutes to ALL 17 repo-level workflows
 * Handles various YAML formatting: if conditions, env blocks, etc.
 */
const fs = require('fs');
const path = require('path');

const wfDir = 'c:/CodeSpace/frootai/.github/workflows';

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

let fixed = 0;

for (const [file, timeout] of Object.entries(TIMEOUTS)) {
    const fp = path.join(wfDir, file);
    if (!fs.existsSync(fp)) { console.log(`SKIP: ${file} not found`); continue; }

    let content = fs.readFileSync(fp, 'utf8');

    if (content.includes('timeout-minutes')) {
        console.log(`OK: ${file} (already has timeout)`);
        continue;
    }

    // Strategy: find 'runs-on: ubuntu-latest' lines and insert timeout-minutes after
    const lines = content.split('\n');
    const newLines = [];

    for (let i = 0; i < lines.length; i++) {
        newLines.push(lines[i]);

        // Match 'runs-on: ubuntu-latest' with any indentation
        const match = lines[i].match(/^(\s+)runs-on:\s*ubuntu-latest/);
        if (match) {
            const indent = match[1];
            newLines.push(`${indent}timeout-minutes: ${timeout}`);
            fixed++;
        }
    }

    fs.writeFileSync(fp, newLines.join('\n'), 'utf8');
    console.log(`✅ Fixed: ${file} (timeout: ${timeout}min)`);
}

console.log(`\nTotal jobs with timeout-minutes added: ${fixed}`);
