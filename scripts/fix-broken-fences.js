const fs = require('fs');
const path = require('path');

const dir = 'c:/CodeSpace/frootai/skills';
let affected = [];
let totalFixed = 0;

for (const folder of fs.readdirSync(dir)) {
    const p = path.join(dir, folder, 'SKILL.md');
    if (!fs.existsSync(p)) continue;
    let content = fs.readFileSync(p, 'utf8');
    let changed = false;

    // Pattern 1: Opening fence - `ash or `bash or `json etc (single backtick + lang)
    // Should be ```bash etc (triple backtick + lang)
    const openPattern = /^(`)(ash|bash|sh|json|yaml|yml|python|py|typescript|ts|javascript|js|bicep|csharp|cs|powershell|ps1|hcl|xml|html|css|sql|terraform|tf|dockerfile|plaintext|text|markdown|md|toml|ini|env|shell|zsh)$/gm;
    let openMatches = content.match(openPattern);
    if (openMatches) {
        content = content.replace(openPattern, '```$2');
        changed = true;
        totalFixed += openMatches.length;
    }

    // Pattern 2: Closing fence - lone ` on its own line (should be ```)
    // Only fix if there's a corresponding opening ```
    const lines = content.split('\n');
    let inCodeBlock = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('```') && lines[i].trim() !== '```') {
            inCodeBlock = true;
        } else if (lines[i].trim() === '```') {
            inCodeBlock = false;
        } else if (inCodeBlock && lines[i].trim() === '`') {
            lines[i] = lines[i].replace(/^(\s*)`$/, '$1```');
            changed = true;
            totalFixed++;
        }
    }

    if (changed) {
        content = lines.join('\n');
        fs.writeFileSync(p, content, 'utf8');
        affected.push(folder);
    }
}

console.log('Fixed files:', affected.length);
console.log('Total fixes:', totalFixed);
affected.forEach(f => console.log('  ' + f));
