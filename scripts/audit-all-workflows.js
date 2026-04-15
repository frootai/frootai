/**
 * Phase 5: Full Workflow Audit
 * Checks all workflow files across repo + solution plays
 */
const fs = require('fs');
const path = require('path');

const repoWfDir = 'c:/CodeSpace/frootai/.github/workflows';
const playsDir = 'c:/CodeSpace/frootai/solution-plays';

const stats = {
    repoTotal: 0,
    playTotal: 0,
    timeout: { repo: 0, play: 0 },
    pinned: { repo: 0, play: 0 },
    summary: { repo: 0, play: 0 },
    concurrency: { repo: 0 },
    play01Leaks: 0,
    errors: [],
};

// Audit repo-level workflows
console.log('=== REPO-LEVEL WORKFLOWS ===');
const repoFiles = fs.readdirSync(repoWfDir).filter(f => f.endsWith('.yml'));
stats.repoTotal = repoFiles.length;

for (const file of repoFiles) {
    const c = fs.readFileSync(path.join(repoWfDir, file), 'utf8');
    const checks = {
        timeout: c.includes('timeout-minutes'),
        pinned: !(/uses:\s*\S+@v\d+\s*$/m.test(c)),
        summary: c.includes('GITHUB_STEP_SUMMARY'),
        concurrency: c.includes('concurrency:') || !['auto-generate.yml', 'consistency-check.yml', 'content-sync.yml', 'deploy-chatbot.yml', 'sync-readme.yml', 'validate-primitives.yml'].includes(file),
    };

    if (checks.timeout) stats.timeout.repo++;
    if (checks.pinned) stats.pinned.repo++;
    if (checks.summary) stats.summary.repo++;
    if (checks.concurrency) stats.concurrency.repo++;

    const status = Object.values(checks).every(v => v) ? '✅' : '⚠️';
    const missing = Object.entries(checks).filter(([k, v]) => !v).map(([k]) => k).join(', ');
    console.log(`${status} ${file} ${missing ? '(missing: ' + missing + ')' : ''}`);

    if (missing) stats.errors.push(`${file}: missing ${missing}`);
}

// Audit play workflows
console.log('\n=== SOLUTION-PLAY WORKFLOWS ===');
const plays = fs.readdirSync(playsDir).filter(f => {
    const fp = path.join(playsDir, f);
    return fs.statSync(fp).isDirectory() && /^\d+/.test(f);
});

for (const play of plays) {
    const wfDir = path.join(playsDir, play, '.github/workflows');
    if (!fs.existsSync(wfDir)) continue;

    const wfs = fs.readdirSync(wfDir).filter(f => f.endsWith('.yml'));

    for (const wf of wfs) {
        stats.playTotal++;
        const c = fs.readFileSync(path.join(wfDir, wf), 'utf8');

        if (c.includes('timeout-minutes')) stats.timeout.play++;
        if (!/uses:\s*\S+@v\d+\s*$/m.test(c)) stats.pinned.play++;
        if (c.includes('GITHUB_STEP_SUMMARY')) stats.summary.play++;

        if (play !== '01-enterprise-rag' && c.includes('01-enterprise-rag')) {
            stats.play01Leaks++;
            stats.errors.push(`${play}/${wf}: Play 01 path leak`);
        }
    }
}

// Final report
console.log('\n========================================');
console.log('       WORKFLOW AUDIT RESULTS');
console.log('========================================');
console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
console.log(`\nTotal workflow files: ${stats.repoTotal + stats.playTotal}`);
console.log(`  Repo-level: ${stats.repoTotal}`);
console.log(`  Solution-play: ${stats.playTotal}`);

console.log('\n--- Quality Gates ---');
const g = (n, t) => `${n}/${t} (${Math.round(n / t * 100)}%)`;
console.log(`timeout-minutes (repo):     ${g(stats.timeout.repo, stats.repoTotal)}`);
console.log(`timeout-minutes (play):     ${g(stats.timeout.play, stats.playTotal)}`);
console.log(`Pinned actions (repo):      ${g(stats.pinned.repo, stats.repoTotal)}`);
console.log(`Pinned actions (play):      ${g(stats.pinned.play, stats.playTotal)}`);
console.log(`GITHUB_STEP_SUMMARY (repo): ${g(stats.summary.repo, stats.repoTotal)}`);
console.log(`Concurrency groups (repo):  ${g(stats.concurrency.repo, stats.repoTotal)}`);
console.log(`Play 01 path leaks:         ${stats.play01Leaks}`);

if (stats.errors.length > 0) {
    console.log(`\n--- Issues (${stats.errors.length}) ---`);
    stats.errors.slice(0, 20).forEach(e => console.log(`  ⚠️ ${e}`));
    if (stats.errors.length > 20) console.log(`  ... and ${stats.errors.length - 20} more`);
}

// Grade
const critical = stats.play01Leaks;
const repoTimeoutPct = stats.timeout.repo / stats.repoTotal;
const playTimeoutPct = stats.timeout.play / stats.playTotal;
const summaryPct = stats.summary.repo / stats.repoTotal;

console.log('\n--- GRADE ---');
if (critical === 0 && repoTimeoutPct === 1 && playTimeoutPct >= 0.99) {
    if (summaryPct >= 0.8) console.log('A+ (EXCELLENT)');
    else console.log('A (SOLID)');
} else if (critical === 0) {
    console.log('B+ (GOOD — minor gaps)');
} else {
    console.log('NEEDS WORK (' + critical + ' critical issues)');
}
