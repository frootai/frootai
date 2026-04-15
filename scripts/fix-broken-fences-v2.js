const fs = require('fs');
const path = require('path');

const dir = 'c:/CodeSpace/frootai/skills';
let affected = [];
let totalFixes = 0;

for (const folder of fs.readdirSync(dir)) {
    const p = path.join(dir, folder, 'SKILL.md');
    if (!fs.existsSync(p)) continue;
    let content = fs.readFileSync(p, 'utf8');
    let changed = false;

    // Pattern: backtick + backspace (0x08) + "ash" = corrupted ```bash
    // The backspace ate the second backtick visually, leaving `\bash
    // Fix: replace ` + \x08 + ash with ```bash
    const corruptedOpen = /`\x08ash/g;
    let matches = content.match(corruptedOpen);
    if (matches) {
        content = content.replace(corruptedOpen, '```bash');
        totalFixes += matches.length;
        changed = true;
    }

    // Also check for any other backspace-corrupted fences
    const corruptedGeneral = /`\x08([a-z]+)/g;
    matches = content.match(corruptedGeneral);
    if (matches) {
        content = content.replace(corruptedGeneral, '```$1');
        totalFixes += matches.length;
        changed = true;
    }

    // Fix closing fence: lone backtick on a line (after an opening ```)
    // Check for single ` that should be ```
    const lines = content.split('\n');
    let inCodeBlock = false;
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (/^```[a-z]*$/.test(trimmed)) {
            inCodeBlock = true;
        } else if (trimmed === '```') {
            inCodeBlock = false;
        } else if (inCodeBlock && trimmed === '`') {
            lines[i] = lines[i].replace(/`/, '```');
            totalFixes++;
            changed = true;
            inCodeBlock = false;
        }
    }

    if (changed) {
        content = lines.join('\n');
        fs.writeFileSync(p, content, 'utf8');
        affected.push(folder);
    }
}

console.log('Fixed files:', affected.length);
console.log('Total fixes:', totalFixes);
affected.forEach(f => console.log('  ' + f));
