const fs = require('fs');
const path = require('path');
const dir = 'c:/CodeSpace/frootai/skills';
let good = 0, short = 0, none = 0, shortList = [];

for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f, 'SKILL.md');
    if (!fs.existsSync(p)) continue;
    const c = fs.readFileSync(p, 'utf8');

    // Extract full description (inline or block scalar)
    let desc = '';
    const fmMatch = c.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (fmMatch) {
        const fm = fmMatch[1];
        // Block scalar (description: |)
        const blockMatch = fm.match(/^description:\s*[|>]\s*\r?\n((?:\s+.*\r?\n)*)/m);
        if (blockMatch) {
            desc = blockMatch[1].replace(/^\s+/gm, '').trim();
        } else {
            // Inline (description: 'xxx' or description: xxx)
            const inlineMatch = fm.match(/^description:\s*['"]?(.*?)['"]?\s*$/m);
            if (inlineMatch) desc = inlineMatch[1].trim();
        }
    }

    if (desc.length >= 30) good++;
    else if (desc.length > 0) { short++; shortList.push({ f, len: desc.length, d: desc.substring(0, 50) }); }
    else { none++; shortList.push({ f, len: 0, d: '(empty)' }); }
}

console.log('Good (>=30ch):', good);
console.log('Short (<30ch):', short);
console.log('None:', none);
if (shortList.length > 0 && shortList.length <= 20) {
    shortList.forEach(s => console.log(`  ${s.f}: ${s.len}ch "${s.d}"`));
}
