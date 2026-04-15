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

let fixed = 0;
for (const skill of tuneSkills) {
    const p = path.join(dir, skill, 'SKILL.md');
    let content = fs.readFileSync(p, 'utf8');

    // Fix pattern: ```json\n...\n```\n}\n\n## → ```json\n...\n}\n```\n\n##
    // The closing ``` came before the closing brace
    content = content.replace(/```\n([}\]])\n\n/g, '$1\n```\n\n');

    // Also fix: ```\n}\n## → }\n```\n\n##
    content = content.replace(/```\n([}\]])\n(##)/g, '$1\n```\n\n$2');

    fs.writeFileSync(p, content, 'utf8');

    // Verify
    const lines = content.split('\n');
    const hasFence = content.includes('```');
    const orphanBrace = lines.some((l, i) => {
        if (!/^[}\]]\s*$/.test(l.trim())) return false;
        const prev = i > 0 ? lines[i - 1].trim() : '';
        return prev === '```';
    });
    console.log(`${skill}: ${lines.length}L fence=${hasFence} orphanBrace=${orphanBrace}`);
    if (!orphanBrace) fixed++;
}
console.log(`\nClean: ${fixed}/9`);
