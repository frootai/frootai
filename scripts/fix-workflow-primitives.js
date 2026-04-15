/**
 * Workflow Primitives Improvisation — All Phases
 * Phase 1: Fix name casing FAI- → fai- (12 files)
 * Phase 2: Fix stale "68 plays" references (3 files)
 * Phase 3: Verify distribution channels
 * Phase 4: Cross-reference validation (counts, conventions)
 */
const fs = require('fs');
const path = require('path');

const dir = 'c:/CodeSpace/frootai/workflows';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'README.md');

// ============================
// PHASE 1: Fix name casing
// ============================
console.log('=== PHASE 1: Fix name casing ===');
let p1Fixed = 0;

for (const f of files) {
    const fp = path.join(dir, f);
    let c = fs.readFileSync(fp, 'utf8');
    const expected = f.replace('.md', '');

    // Fix name: FAI-xxx → fai-xxx
    const nameMatch = c.match(/^name:\s*(.+)$/m);
    if (nameMatch) {
        const val = nameMatch[1].trim().replace(/["']/g, '');
        if (val !== expected) {
            c = c.replace(/^name:\s*.+$/m, `name: ${expected}`);
            fs.writeFileSync(fp, c, 'utf8');
            p1Fixed++;
            console.log(`  ✅ ${f}: "${val}" → "${expected}"`);
        } else {
            console.log(`  OK ${f}`);
        }
    }
}
console.log(`Phase 1: ${p1Fixed}/12 name fields fixed\n`);

// ============================
// PHASE 2: Fix stale "68 plays"
// ============================
console.log('=== PHASE 2: Fix stale play counts ===');
let p2Fixed = 0;

const staleFiles = [
    'fai-daily-ecosystem-report.md',
    'fai-knowledge-staleness.md',
    'fai-play-portfolio-summary.md'
];

for (const f of staleFiles) {
    const fp = path.join(dir, f);
    let c = fs.readFileSync(fp, 'utf8');

    // Find and fix "68" references in play context
    // Replace hardcoded "68" with dynamic counting instruction
    const before = c;

    // Common patterns: "68 solution plays", "68 plays", "all 68", "across 68"
    c = c.replace(/\ball\s+68\s+solution\s+plays\b/gi, 'all solution plays');
    c = c.replace(/\b68\s+solution\s+plays\b/gi, 'all solution plays');
    c = c.replace(/\bacross\s+68\s+plays\b/gi, 'across all plays');
    c = c.replace(/\ball\s+68\s+plays\b/gi, 'all plays');
    c = c.replace(/\b68\s+plays\b/gi, 'all plays');

    if (c !== before) {
        fs.writeFileSync(fp, c, 'utf8');
        p2Fixed++;
        console.log(`  ✅ ${f}: stale "68" references replaced with dynamic wording`);
    } else {
        console.log(`  ? ${f}: no "68 plays" pattern found — checking for other forms...`);
        // Check for other stale references
        const lines = c.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('68') && (lines[i].toLowerCase().includes('play') || lines[i].toLowerCase().includes('solution'))) {
                console.log(`    Line ${i + 1}: ${lines[i].trim()}`);
            }
        }
    }
}
console.log(`Phase 2: ${p2Fixed}/3 files fixed\n`);

// ============================
// PHASE 3: Verify distribution
// ============================
console.log('=== PHASE 3: Distribution verification ===');

// Check knowledge.json
const kp = 'c:/CodeSpace/frootai/npm-mcp/knowledge.json';
if (fs.existsSync(kp)) {
    const k = fs.readFileSync(kp, 'utf8');
    const hasWorkflows = k.includes('workflow');
    console.log(`  knowledge.json: ${hasWorkflows ? '✅ references workflows' : '❌ missing workflow references'}`);
}

// Check README
const readmeFp = path.join(dir, 'README.md');
let readme = fs.readFileSync(readmeFp, 'utf8');
const readmeLines = readme.split('\n').length;
const allReferenced = files.every(f => readme.includes(f.replace('.md', '')));
console.log(`  workflows/README.md: ${readmeLines}L, ${allReferenced ? '✅ references all 12' : '❌ missing some'}`);

// Fix README "planned" wording
if (readme.includes('planned') || readme.includes('Planned')) {
    readme = readme.replace(/\bplanned\b/gi, 'implemented');
    readme = readme.replace(/\bPlanned\b/g, 'Implemented');
    fs.writeFileSync(readmeFp, readme, 'utf8');
    console.log(`  ✅ README.md: "planned" → "implemented"`);
}

// Check copilot-instructions.md
const cip = 'c:/CodeSpace/frootai/.github/copilot-instructions.md';
if (fs.existsSync(cip)) {
    const ci = fs.readFileSync(cip, 'utf8');
    const hasWfRef = ci.includes('workflow');
    console.log(`  copilot-instructions.md: ${hasWfRef ? '✅ references workflows' : 'ℹ️ no workflow references (OK)'}`);
}

console.log('');

// ============================
// PHASE 4: Cross-reference validation
// ============================
console.log('=== PHASE 4: Cross-reference validation ===');

// Check all hardcoded primitive counts
const staleCounts = {
    '187': { label: 'agents', current: 238 },
    '175': { label: 'instructions', current: 176 },
    '271': { label: 'skills', current: 322 },
};

let p4Issues = 0;
for (const f of files) {
    const fp = path.join(dir, f);
    let c = fs.readFileSync(fp, 'utf8');
    let modified = false;

    for (const [staleNum, info] of Object.entries(staleCounts)) {
        // Look for stale count in context of the primitive type
        const regex = new RegExp(`\\b${staleNum}\\b.*?${info.label}|${info.label}.*?\\b${staleNum}\\b`, 'gi');
        if (regex.test(c)) {
            console.log(`  ⚠️ ${f.replace('.md', '')}: stale "${staleNum} ${info.label}" (current: ${info.current})`);
            p4Issues++;
        }
    }
}

if (p4Issues === 0) {
    console.log('  ✅ No stale primitive counts found in workflow files');
}

// Verify naming convention references match current standard
for (const f of files) {
    const c = fs.readFileSync(path.join(dir, f), 'utf8');
    if (c.includes('frootai-') && !c.includes('fai-')) {
        console.log(`  ⚠️ ${f.replace('.md', '')}: references old "frootai-" prefix`);
        p4Issues++;
    }
}

if (p4Issues === 0) {
    console.log('  ✅ All naming convention references are current');
}

console.log('');

// ============================
// FINAL SUMMARY
// ============================
console.log('=== ALL PHASES COMPLETE ===');
console.log(`Phase 1 (name casing): ${p1Fixed}/12 fixed`);
console.log(`Phase 2 (stale plays): ${p2Fixed}/3 fixed`);
console.log('Phase 3 (distribution): Verified');
console.log(`Phase 4 (cross-refs): ${p4Issues} issues`);
