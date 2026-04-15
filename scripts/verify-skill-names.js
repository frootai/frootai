const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'skills');
const folders = fs.readdirSync(dir).filter(f =>
    fs.statSync(path.join(dir, f)).isDirectory()
);

let issues = 0;

// Check 1: All folders have fai- prefix
const noPrefix = folders.filter(f => !f.startsWith('fai-'));
if (noPrefix.length > 0) {
    console.log('FAIL: Folders without fai- prefix:', noPrefix.length);
    noPrefix.forEach(f => console.log('  ' + f));
    issues += noPrefix.length;
} else {
    console.log('PASS: All ' + folders.length + ' folders have fai- prefix');
}

// Check 2: name: field matches folder name
let nameIssues = 0;
for (const folder of folders) {
    const skillPath = path.join(dir, folder, 'SKILL.md');
    if (!fs.existsSync(skillPath)) { nameIssues++; continue; }
    const content = fs.readFileSync(skillPath, 'utf8');
    const match = content.match(/^name:\s*(.+)$/m);
    if (!match) { nameIssues++; continue; }
    const nameVal = match[1].trim().replace(/['"]/g, '');
    if (nameVal !== folder) {
        console.log('  MISMATCH: ' + folder + ' has name: ' + nameVal);
        nameIssues++;
    }
}
if (nameIssues === 0) {
    console.log('PASS: All ' + folders.length + ' SKILL.md name: fields match folder names');
} else {
    console.log('FAIL: ' + nameIssues + ' name mismatches');
}

issues += nameIssues;
console.log('\nTotal: ' + folders.length + ' skills, ' + issues + ' issues');
process.exit(issues > 0 ? 1 : 0);
