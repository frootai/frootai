const fs = require('fs'), path = require('path');
const dir = 'c:/CodeSpace/frootai/workflows';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'README.md');
console.log('=== WORKFLOW PRIMITIVES AUDIT ===');
console.log('Total:', files.length, '\n');

const results = [];

for (const f of files) {
    const c = fs.readFileSync(path.join(dir, f), 'utf8');
    const lines = c.split('\n').length;
    const hasName = /^name:/m.test(c);
    const hasDesc = /^description:/m.test(c);
    const nameMatch = c.match(/^name:\s*(.+)$/m);
    const nameVal = nameMatch ? nameMatch[1].trim().replace(/["']/g, '') : 'NONE';
    const hasFai = nameVal.startsWith('FAI-') || nameVal.startsWith('fai-');
    const hasFrontmatter = c.startsWith('---');
    const hasEngine = /^engine:/m.test(c);
    const hasTools = /^tools:/m.test(c);
    const hasSafeOutputs = /safe-outputs/m.test(c);
    const hasTimeout = /timeout/m.test(c);
    const hasPermissions = /^permissions:/m.test(c);
    const hasTrigger = /^on:/m.test(c);
    const hasCodeBlock = /```/.test(c);
    const hasBashCommands = /\b(git |find |grep |jq |node -e|gh |npm |curl )/m.test(c);
    const hasErrorHandling = /error|fail|fallback|recovery|graceful/im.test(c);
    const hasReportTemplate = /\|.*\|.*\|/m.test(c);

    const checks = {
        name: hasName, desc: hasDesc, fai: hasFai, frontmatter: hasFrontmatter,
        engine: hasEngine, tools: hasTools, safeOutputs: hasSafeOutputs, timeout: hasTimeout,
        permissions: hasPermissions, trigger: hasTrigger, codeBlock: hasCodeBlock,
        bashCmds: hasBashCommands, errorHandling: hasErrorHandling, reportTemplate: hasReportTemplate
    };

    const passed = Object.values(checks).filter(Boolean).length;
    const missing = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    const grade = passed >= 13 ? 'A+' : passed >= 11 ? 'A' : passed >= 9 ? 'B' : passed >= 7 ? 'C' : 'D';

    results.push({ file: f, lines, nameVal, passed, grade, missing });
    console.log(`${grade} ${f.replace('.md', '')} (${lines}L, ${passed}/14) ${missing.length ? 'MISSING: ' + missing.join(', ') : ''}`);
}

// Summary
const grades = { 'A+': 0, A: 0, B: 0, C: 0, D: 0 };
results.forEach(r => grades[r.grade]++);
const allLines = results.map(r => r.lines);
console.log('\n--- SUMMARY ---');
console.log(`A+: ${grades['A+']}, A: ${grades.A}, B: ${grades.B}, C: ${grades.C}, D: ${grades.D}`);
console.log(`Lines: min=${Math.min(...allLines)}, max=${Math.max(...allLines)}, avg=${Math.round(allLines.reduce((a, b) => a + b, 0) / allLines.length)}`);

// Common issues
const allMissing = {};
results.forEach(r => r.missing.forEach(m => { allMissing[m] = (allMissing[m] || 0) + 1; }));
if (Object.keys(allMissing).length > 0) {
    console.log('\n--- COMMON ISSUES ---');
    Object.entries(allMissing).sort(([, a], [, b]) => b - a).forEach(([k, v]) => {
        console.log(`  ${k}: ${v}/${files.length} missing`);
    });
}

// Naming consistency check
console.log('\n--- NAME VALUES ---');
results.forEach(r => {
    const expectedName = r.file.replace('.md', '');
    const nameMatches = r.nameVal.toLowerCase() === expectedName.toLowerCase();
    console.log(`  ${nameMatches ? '✅' : '❌'} ${r.file} → name: "${r.nameVal}"`);
});
