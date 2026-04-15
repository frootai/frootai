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
    const lines = content.split('\n');
    let changed = false;

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        // Bare language marker on its own line (not already fenced)
        if (/^(json|bash|python|yaml|bicep|typescript|javascript|powershell|shell|sh)$/.test(trimmed)) {
            // Check that previous line is NOT ``` (already fenced)
            const prevTrimmed = i > 0 ? lines[i - 1].trim() : '';
            if (!prevTrimmed.startsWith('```')) {
                lines[i] = '```' + trimmed;
                changed = true;

                // Now find the closing — look for the next bare line that looks like end of block
                // Patterns: empty line after content, next header (##), next table (|), next list (-)
                let foundClose = false;
                for (let j = i + 1; j < lines.length; j++) {
                    const nextTrimmed = lines[j].trim();
                    // End of JSON/YAML block: closing brace/bracket alone, or "}" or "]"
                    if (/^[}\]]\s*$/.test(nextTrimmed)) {
                        // Insert ``` after this line
                        lines.splice(j + 1, 0, '```');
                        foundClose = true;
                        break;
                    }
                    // If we hit a header, table, or empty-line-then-header, close before it
                    if (nextTrimmed.startsWith('##') || nextTrimmed.startsWith('| ') ||
                        (nextTrimmed === '' && j + 1 < lines.length && lines[j + 1].trim().startsWith('##'))) {
                        lines.splice(j, 0, '```');
                        foundClose = true;
                        break;
                    }
                }
                if (!foundClose) {
                    // Safety: close at end
                    lines.push('```');
                }
            }
        }
    }

    if (changed) {
        fs.writeFileSync(p, lines.join('\n'), 'utf8');
        fixed++;
        const newLines = lines.length;
        const hasFence = lines.join('\n').includes('```');
        console.log(`Fixed ${skill}: ${newLines}L fence=${hasFence}`);
    }
}
console.log(`\nTotal fixed: ${fixed}`);
