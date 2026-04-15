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
    let lines = content.split('\n');
    let changed = false;

    // Find pattern: line[i] = "```", line[i+1] = "}" or "]"
    // Swap them so brace is inside the fence
    for (let i = 0; i < lines.length - 1; i++) {
        const curr = lines[i].replace(/\r$/, '').trim();
        const next = lines[i + 1].replace(/\r$/, '').trim();
        if (curr === '```' && /^[}\]]$/.test(next)) {
            // Swap: put brace before fence
            const temp = lines[i];
            lines[i] = lines[i + 1];
            lines[i + 1] = temp;
            changed = true;
        }
    }

    if (changed) {
        content = lines.join('\n');
        fs.writeFileSync(p, content, 'utf8');
        fixed++;
        console.log(`Fixed ${skill}`);
    }
}
console.log(`\nSwapped: ${fixed}/9`);

// Verify
for (const skill of tuneSkills) {
    const p = path.join(dir, skill, 'SKILL.md');
    const c = fs.readFileSync(p, 'utf8');
    const ls = c.split('\n');
    let ok = true;
    for (let i = 0; i < ls.length - 1; i++) {
        if (ls[i].replace(/\r$/, '').trim() === '```' && /^[}\]]$/.test(ls[i + 1].replace(/\r$/, '').trim())) {
            ok = false;
        }
    }
    const hasFence = c.includes('```');
    console.log(`${skill}: fence=${hasFence} clean=${ok}`);
}
