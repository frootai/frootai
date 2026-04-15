const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'skills');
const folders = fs.readdirSync(dir).filter(f =>
    fs.statSync(path.join(dir, f)).isDirectory()
);

let fixed = 0;
let mismatches = [];

for (const folder of folders) {
    const skillPath = path.join(dir, folder, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;

    const content = fs.readFileSync(skillPath, 'utf8');
    const match = content.match(/^name:\s*(.+)$/m);
    if (!match) continue;

    const nameVal = match[1].trim().replace(/['"]/g, '');
    if (nameVal !== folder) {
        mismatches.push({ folder, nameVal });
        // Replace name: line
        const updated = content.replace(
            /^name:\s*.+$/m,
            `name: ${folder}`
        );
        fs.writeFileSync(skillPath, updated, 'utf8');
        fixed++;
        console.log(`  Fixed: ${folder} (was: ${nameVal})`);
    }
}

console.log(`\nTotal mismatches found and fixed: ${fixed}`);
console.log(`Total skills: ${folders.length}`);
