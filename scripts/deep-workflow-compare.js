const fs = require('fs'), path = require('path');
const dir = 'c:/CodeSpace/frootai/workflows';
const compDir = 'c:/CodeSpace/frootai/.internal/competitor/awesome-copilot/workflows';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'README.md');
const compFiles = fs.readdirSync(compDir).filter(f => f.endsWith('.md'));

console.log('=== DEEP COMPARISON ===\n');
console.log('FrootAI workflow primitives:', files.length);
console.log('Competitor workflow primitives:', compFiles.length);

// Naming case
console.log('\n--- NAMING CASE ---');
for (const f of files) {
    const c = fs.readFileSync(path.join(dir, f), 'utf8');
    const m = c.match(/^name:\s*(.+)$/m);
    if (m) {
        const val = m[1].trim().replace(/["']/g, '');
        const expected = f.replace('.md', '');
        const caseMatch = val === expected;
        if (!caseMatch) console.log('MISMATCH:', f, 'name=' + val, 'expected=' + expected);
        else console.log('OK:', f);
    }
}

// Stale numbers
console.log('\n--- STALE DATA ---');
for (const f of files) {
    const c = fs.readFileSync(path.join(dir, f), 'utf8');
    const stale = [];
    if (c.includes('187 agents') || c.includes('187 agent')) stale.push('187 agents (now 238)');
    if (c.includes('175 instructions') || c.includes('175 instruction')) stale.push('175 instructions (now 176)');
    if (c.includes('271 skills') || c.includes('271 skill')) stale.push('271 skills (now 322)');
    if (/\b68\b.*plays/i.test(c) || /plays.*\b68\b/i.test(c)) stale.push('68 plays (now 100+)');
    if (stale.length > 0) console.log('STALE:', f.replace('.md', ''), stale.join(', '));
}

// Descriptions
console.log('\n--- DESCRIPTION LENGTHS ---');
for (const f of files) {
    const c = fs.readFileSync(path.join(dir, f), 'utf8');
    const m = c.match(/^description:\s*"([^"]+)"/m);
    if (m) console.log(f.replace('.md', '') + ':', m[1].length + 'ch');
    else {
        const m2 = c.match(/^description:\s*(.+)$/m);
        if (m2) console.log(f.replace('.md', '') + ':', m2[1].trim().length + 'ch');
    }
}

console.log('\n--- DISTRIBUTION SYNC ---');
// Check if workflows are referenced in knowledge.json, website data, etc.
const kp = 'c:/CodeSpace/frootai/mcp-server/knowledge.json';
if (fs.existsSync(kp)) {
    const k = fs.readFileSync(kp, 'utf8');
    const hasWf = k.includes('workflow') || k.includes('fai-contributors');
    console.log('knowledge.json references workflows:', hasWf);
}

// Check README
const readme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
const readmeLines = readme.split('\n').length;
console.log('workflows/README.md:', readmeLines, 'lines');
const readmeWorkflows = files.filter(f => readme.includes(f.replace('.md', '')));
console.log('README references:', readmeWorkflows.length + '/' + files.length, 'workflows');
