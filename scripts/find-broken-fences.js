const fs = require('fs');
const path = require('path');

const dir = 'c:/CodeSpace/frootai/skills';
const patterns = [
    /`ash\b/g,
    /`(bash|sh|json|yaml|yml|python|typescript|javascript|bicep|csharp|powershell|hcl|xml|html|css|sql|terraform|dockerfile)\b/g,
    /^`[a-z]+$/gm,
];

let totalFiles = 0;
let affectedFiles = [];

for (const folder of fs.readdirSync(dir)) {
    const p = path.join(dir, folder, 'SKILL.md');
    if (!fs.existsSync(p)) continue;
    totalFiles++;
    const content = fs.readFileSync(p, 'utf8');

    // Check for single-backtick code fence (should be triple)
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match lines that look like broken code fences: `ash, `bash, `json etc
        // but NOT inside inline code
        if (/^`[a-z]+$/.test(line.trim()) && !line.trim().startsWith('```')) {
            affectedFiles.push({ folder, line: i + 1, text: line.trim() });
        }
    }
}

console.log('Total SKILL.md files:', totalFiles);
console.log('Broken fence occurrences:', affectedFiles.length);
console.log('Unique files:', new Set(affectedFiles.map(f => f.folder)).size);
affectedFiles.forEach(f => console.log(`  ${f.folder} L${f.line}: ${f.text}`));
