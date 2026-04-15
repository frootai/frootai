const fs = require('fs');
const path = require('path');

const dir = 'c:/CodeSpace/frootai/skills';
const folders = fs.readdirSync(dir).filter(f =>
    fs.statSync(path.join(dir, f)).isDirectory()
);

let stats = {
    total: folders.length,
    hasSkillMd: 0,
    hasName: 0,
    hasDescription: 0,
    nameMatchesFolder: 0,
    nameUnquoted: 0,
    descLenOk: 0,
    hasFaiPrefix: 0,
    linesGte100: 0,
    linesGte150: 0,
    linesLte500: 0,
    hasCodeBlock: 0,
    brokenFence: 0,
    backspaceCorruption: 0,
    genericTemplate: 0,
    lineLengths: [],
    under100: [],
    over500: [],
    noPrefix: [],
    brokenFenceFiles: [],
    genericFiles: [],
    noCodeBlock: [],
    nameMismatch: [],
    quotedName: [],
};

for (const folder of folders) {
    const p = path.join(dir, folder, 'SKILL.md');
    if (!fs.existsSync(p)) continue;
    stats.hasSkillMd++;

    const raw = fs.readFileSync(p);
    const content = fs.readFileSync(p, 'utf8');
    const lines = content.split('\n');
    const lineCount = lines.length;
    stats.lineLengths.push(lineCount);

    // fai- prefix
    if (folder.startsWith('fai-')) stats.hasFaiPrefix++;
    else stats.noPrefix.push(folder);

    // Line count checks
    if (lineCount >= 100) stats.linesGte100++;
    else stats.under100.push({ folder, lines: lineCount });

    if (lineCount >= 150) stats.linesGte150++;
    if (lineCount <= 500) stats.linesLte500++;
    else stats.over500.push({ folder, lines: lineCount });

    // Frontmatter
    const nameMatch = content.match(/^name:\s*(.+)$/m);
    const descMatch = content.match(/^description:\s*(.+)$/m);

    if (nameMatch) {
        stats.hasName++;
        let nameVal = nameMatch[1].trim();
        const isQuoted = (nameVal.startsWith('"') && nameVal.endsWith('"')) ||
            (nameVal.startsWith("'") && nameVal.endsWith("'"));
        if (isQuoted) stats.quotedName.push(folder);
        else stats.nameUnquoted++;

        nameVal = nameVal.replace(/['"]/g, '');
        if (nameVal === folder) stats.nameMatchesFolder++;
        else stats.nameMismatch.push({ folder, name: nameVal });
    }

    if (descMatch) {
        stats.hasDescription++;
        const descVal = descMatch[1].trim().replace(/^['"]|['"]$/g, '');
        if (descVal.length >= 30 && descVal.length <= 1024) stats.descLenOk++;
    }

    // Code blocks (triple backtick)
    if (/```[a-z]*/m.test(content)) stats.hasCodeBlock++;
    else stats.noCodeBlock.push(folder);

    // Broken fences (backspace corruption)
    if (raw.includes(Buffer.from([0x60, 0x08]))) {
        stats.backspaceCorruption++;
        stats.brokenFenceFiles.push(folder);
    }

    // Single-backtick fence (no backspace)
    const singleFence = lines.some(l => /^`[a-z]+$/.test(l.trim()) && !l.trim().startsWith('```'));
    if (singleFence) {
        stats.brokenFence++;
        if (!stats.brokenFenceFiles.includes(folder)) stats.brokenFenceFiles.push(folder);
    }

    // Generic template detection
    const hasPhase1Discover = content.includes('Phase 1: Discover') || content.includes('Phase 1 — Discover');
    const hasPhase6Operate = content.includes('Phase 6: Operate') || content.includes('Phase 6 — Operate');
    const isGeneric = hasPhase1Discover && hasPhase6Operate &&
        content.includes('Confirm business outcome') &&
        content.includes('Monitor post-release behavior');
    if (isGeneric) {
        stats.genericTemplate++;
        stats.genericFiles.push(folder);
    }
}

// Summary
const sorted = stats.lineLengths.sort((a, b) => a - b);
const min = sorted[0];
const max = sorted[sorted.length - 1];
const avg = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
const median = sorted[Math.floor(sorted.length / 2)];

console.log('=== FAI SKILLS LIVE AUDIT ===');
console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
console.log(`\nTotal folders: ${stats.total}`);
console.log(`Has SKILL.md: ${stats.hasSkillMd}/${stats.total}`);
console.log(`\n--- Spec Compliance ---`);
console.log(`name field present: ${stats.hasName}/${stats.total}`);
console.log(`name unquoted: ${stats.nameUnquoted}/${stats.total}`);
console.log(`name matches folder: ${stats.nameMatchesFolder}/${stats.total}`);
console.log(`description present: ${stats.hasDescription}/${stats.total}`);
console.log(`description 30-1024 chars: ${stats.descLenOk}/${stats.total}`);
console.log(`fai- prefix: ${stats.hasFaiPrefix}/${stats.total}`);
console.log(`\n--- Content Quality ---`);
console.log(`Lines ≥ 100 (Rule 24): ${stats.linesGte100}/${stats.total}`);
console.log(`Lines ≥ 150 (Rule 36): ${stats.linesGte150}/${stats.total}`);
console.log(`Lines ≤ 500 (spec max): ${stats.linesLte500}/${stats.total}`);
console.log(`Has code blocks: ${stats.hasCodeBlock}/${stats.total}`);
console.log(`Broken fences (backspace): ${stats.backspaceCorruption}`);
console.log(`Broken fences (single backtick): ${stats.brokenFence}`);
console.log(`Generic template: ${stats.genericTemplate}`);
console.log(`\n--- Line Stats ---`);
console.log(`Min: ${min}, Max: ${max}, Avg: ${avg}, Median: ${median}`);

if (stats.under100.length) {
    console.log(`\n--- Under 100 Lines (${stats.under100.length}) ---`);
    stats.under100.forEach(u => console.log(`  ${u.folder}: ${u.lines}L`));
}
if (stats.noPrefix.length) {
    console.log(`\n--- No fai- Prefix (${stats.noPrefix.length}) ---`);
    stats.noPrefix.forEach(f => console.log(`  ${f}`));
}
if (stats.brokenFenceFiles.length) {
    console.log(`\n--- Broken Fences (${stats.brokenFenceFiles.length}) ---`);
    stats.brokenFenceFiles.forEach(f => console.log(`  ${f}`));
}
if (stats.genericFiles.length) {
    console.log(`\n--- Generic Template (${stats.genericFiles.length}) ---`);
    stats.genericFiles.slice(0, 10).forEach(f => console.log(`  ${f}`));
    if (stats.genericFiles.length > 10) console.log(`  ... and ${stats.genericFiles.length - 10} more`);
}
if (stats.noCodeBlock.length) {
    console.log(`\n--- No Code Blocks (${stats.noCodeBlock.length}) ---`);
    stats.noCodeBlock.slice(0, 10).forEach(f => console.log(`  ${f}`));
    if (stats.noCodeBlock.length > 10) console.log(`  ... and ${stats.noCodeBlock.length - 10} more`);
}
if (stats.nameMismatch.length) {
    console.log(`\n--- Name Mismatches (${stats.nameMismatch.length}) ---`);
    stats.nameMismatch.forEach(m => console.log(`  ${m.folder} has name: ${m.name}`));
}
if (stats.quotedName.length) {
    console.log(`\n--- Quoted Names (${stats.quotedName.length}) ---`);
    stats.quotedName.forEach(f => console.log(`  ${f}`));
}

console.log('\n--- GRADE ---');
const critical = stats.backspaceCorruption + stats.brokenFence + stats.genericTemplate + stats.nameMismatch.length;
const warnings = stats.under100.length + stats.noCodeBlock.length + stats.noPrefix.length + stats.quotedName.length;
if (critical === 0 && warnings === 0) console.log('A+ (CLEAN)');
else if (critical === 0) console.log(`A (${warnings} warnings)`);
else console.log(`NEEDS WORK (${critical} critical, ${warnings} warnings)`);
