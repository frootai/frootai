/**
 * Phase 2: Fix all 201 solution-play workflows
 * - P2-1/P2-3: Fix Play 01 path leaks in review workflows (replace paths + play references)
 * - P2-2/P2-4: Fix Play 01 path leaks in deploy workflows
 * - Add timeout-minutes: 20 to ALL play workflows
 * - Pin action versions
 */
const fs = require('fs');
const path = require('path');

const dir = 'c:/CodeSpace/frootai/solution-plays';
const plays = fs.readdirSync(dir).filter(f => {
    const fp = path.join(dir, f);
    return fs.statSync(fp).isDirectory() && /^\d+/.test(f);
});

const PINS = {
    'actions/checkout@v4': 'actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2',
    'actions/setup-node@v4': 'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0',
    'actions/github-script@v7': 'actions/github-script@60a0d83039c74a4aee543508d2ffcb1c3799cdea # v7.0.1',
    'azure/login@v2': 'azure/login@a457da9ea143d694b1b9c7c869ebb04ebe844ef5 # v2.3.0',
};

let stats = {
    leaksFixed: 0,
    timeoutsAdded: 0,
    pinsUpgraded: 0,
    reviewsRewritten: 0,
    deploysRewritten: 0,
    totalFiles: 0,
};

for (const play of plays) {
    const wfDir = path.join(dir, play, '.github/workflows');
    if (!fs.existsSync(wfDir)) continue;

    const wfs = fs.readdirSync(wfDir).filter(f => f.endsWith('.yml'));

    for (const wf of wfs) {
        const fp = path.join(wfDir, wf);
        let content = fs.readFileSync(fp, 'utf8');
        let modified = false;
        stats.totalFiles++;

        // Determine if this is a review or deploy workflow
        const isReview = wf.includes('review') || content.includes('Review');
        const isDeploy = wf.includes('deploy') || content.includes('Deploy');

        // Fix Play 01 path leaks
        if (play !== '01-enterprise-rag' && content.includes('01-enterprise-rag')) {
            // Replace ALL occurrences of 01-enterprise-rag with the correct play path
            content = content.replace(/solution-plays\/01-enterprise-rag/g, `solution-plays/${play}`);
            content = content.replace(/01-enterprise-rag/g, play);
            stats.leaksFixed++;
            modified = true;

            if (isReview) stats.reviewsRewritten++;
            if (isDeploy) stats.deploysRewritten++;
        }

        // Add timeout-minutes if missing
        if (!content.includes('timeout-minutes')) {
            const lines = content.split('\n');
            const newLines = [];
            for (let i = 0; i < lines.length; i++) {
                newLines.push(lines[i]);
                const match = lines[i].match(/^(\s+)runs-on:\s*ubuntu-latest/);
                if (match) {
                    newLines.push(`${match[1]}timeout-minutes: 20`);
                    stats.timeoutsAdded++;
                }
            }
            content = newLines.join('\n');
            modified = true;
        }

        // Pin action versions
        for (const [unpinned, pinned] of Object.entries(PINS)) {
            const escaped = unpinned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Only match unpinned (no # comment after)
            const regex = new RegExp(`uses:\\s*${escaped}\\s*$`, 'gm');
            if (regex.test(content)) {
                content = content.replace(
                    new RegExp(`(uses:\\s*)${escaped}`, 'g'),
                    `$1${pinned}`
                );
                stats.pinsUpgraded++;
                modified = true;
            }
        }

        if (modified) {
            fs.writeFileSync(fp, content, 'utf8');
        }
    }
}

console.log('=== Phase 2 Summary ===');
console.log(`Total play workflow files processed: ${stats.totalFiles}`);
console.log(`Play 01 path leaks fixed: ${stats.leaksFixed}`);
console.log(`  - Review workflows rewritten: ${stats.reviewsRewritten}`);
console.log(`  - Deploy workflows rewritten: ${stats.deploysRewritten}`);
console.log(`timeout-minutes added: ${stats.timeoutsAdded} jobs`);
console.log(`Action pins upgraded: ${stats.pinsUpgraded} files`);
