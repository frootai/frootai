const fs = require('fs');
const path = require('path');
const dir = 'c:/CodeSpace/frootai/skills';

const tuneSkills = [
    'fai-tune-15-multi-modal-docproc',
    'fai-tune-16-copilot-teams-extension',
    'fai-tune-17-ai-observability',
    'fai-tune-18-prompt-management',
    'fai-tune-19-edge-ai-phi4',
    'fai-tune-20-anomaly-detection',
    'fai-tune-21-agentic-rag',
    'fai-tune-22-multi-agent-swarm',
    'fai-tune-23-browser-automation-agent'
];

const deploySkills = [
    'fai-deploy-06-document-intelligence',
    'fai-deploy-07-multi-agent-service',
    'fai-deploy-08-copilot-studio-bot',
    'fai-deploy-09-ai-search-portal',
    'fai-deploy-10-content-moderation',
    'fai-deploy-11-ai-landing-zone-advanced',
    'fai-deploy-12-model-serving-aks',
    'fai-deploy-13-fine-tuning-workflow',
    'fai-deploy-14-cost-optimized-ai-gateway',
    'fai-deploy-15-multi-modal-docproc'
];

console.log('=== TUNE SKILLS ===');
for (const s of tuneSkills) {
    const c = fs.readFileSync(path.join(dir, s, 'SKILL.md'), 'utf8');
    const hasTripleFence = c.includes('```');
    const lines = c.split('\n');
    // Find bare language markers (json, bash, etc on own line without ```)
    const bareLines = lines.filter((l, i) => /^(json|bash|python|yaml|bicep|typescript|javascript|powershell)\s*$/.test(l.trim()));
    console.log(`${s}: ${lines.length}L fence=${hasTripleFence} bareLanguageLines=${bareLines.length}`);
}

console.log('\n=== DEPLOY SKILLS ===');
for (const s of deploySkills) {
    const c = fs.readFileSync(path.join(dir, s, 'SKILL.md'), 'utf8');
    const hasTripleFence = c.includes('```');
    const hasGeneric = c.includes('Confirm business outcome') && c.includes('Monitor post-release behavior');
    const lines = c.split('\n');
    console.log(`${s}: ${lines.length}L fence=${hasTripleFence} generic=${hasGeneric}`);
}
