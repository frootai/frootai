#!/usr/bin/env node
/**
 * seed-good-first-issues.mjs
 *
 * Creates the 5 curated "good first issue" issues from
 * `.github/good-first-issues-seed.json` via the GitHub CLI (`gh`).
 *
 * Idempotent: skips any issue whose EXACT title already exists (open) in the repo,
 * so re-running is safe and never produces duplicates.
 *
 * Tracker reference: P1.6.008 (First-PR magical experience · PRD-008 §5.3 —
 * "5 good first issues curated: typos, doc improvements, test coverage gaps,
 * config lint fixes, i18n strings").
 *
 * Prerequisites:
 *   - `gh` CLI installed + authenticated (`gh auth status`).
 *   - Labels `good first issue` + `help wanted` exist (gh creates issues only;
 *     create labels once via the runbook if missing).
 *
 * Usage:
 *   node scripts/seed-good-first-issues.mjs --dry-run     # print what WOULD be created
 *   node scripts/seed-good-first-issues.mjs               # create the issues
 *   node scripts/seed-good-first-issues.mjs --repo frootai/frootai
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(__dirname, "..", ".github", "good-first-issues-seed.json");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const repoFlagIdx = args.indexOf("--repo");
const repo = repoFlagIdx !== -1 ? args[repoFlagIdx + 1] : undefined; // default: gh infers from cwd

function gh(cliArgs, { capture = false } = {}) {
    const full = repo ? [...cliArgs, "--repo", repo] : cliArgs;
    if (capture) {
        return execFileSync("gh", full, { encoding: "utf8" });
    }
    execFileSync("gh", full, { stdio: "inherit" });
    return "";
}

function loadSeed() {
    const raw = readFileSync(SEED_PATH, "utf8");
    const seed = JSON.parse(raw);
    if (!Array.isArray(seed.issues) || seed.issues.length === 0) {
        throw new Error("seed file has no issues");
    }
    return seed;
}

function existingOpenTitles() {
    // gh issue list returns JSON; match on exact title.
    const out = gh(["issue", "list", "--state", "open", "--limit", "200", "--json", "title"], {
        capture: true,
    });
    try {
        return new Set(JSON.parse(out).map((i) => i.title));
    } catch {
        return new Set();
    }
}

function main() {
    const seed = loadSeed();
    const baseLabels = seed.labels || ["good first issue", "help wanted"];

    let existing = new Set();
    if (!dryRun) {
        try {
            existing = existingOpenTitles();
        } catch (e) {
            console.warn(`⚠️  Could not list existing issues (${e.message}). Proceeding without dedup.`);
        }
    }

    let created = 0;
    let skipped = 0;

    for (const issue of seed.issues) {
        const labels = [...baseLabels, ...(issue.extra_labels || [])];
        if (existing.has(issue.title)) {
            console.log(`⏭️  Skip (already open): ${issue.title}`);
            skipped++;
            continue;
        }

        if (dryRun) {
            console.log(`\n── [dry-run] would create ──`);
            console.log(`title:  ${issue.title}`);
            console.log(`labels: ${labels.join(", ")}`);
            console.log(`file:   ${issue.file_pointer}`);
            console.log(`body:\n${issue.body}\n`);
            created++;
            continue;
        }

        const cliArgs = ["issue", "create", "--title", issue.title, "--body", issue.body];
        for (const l of labels) cliArgs.push("--label", l);

        try {
            gh(cliArgs);
            console.log(`✅ Created: ${issue.title}`);
            created++;
        } catch (e) {
            console.error(`❌ Failed to create "${issue.title}": ${e.message}`);
            console.error(`   (Do the labels [${labels.join(", ")}] exist? Create them first — see the runbook.)`);
        }
    }

    console.log(`\n${dryRun ? "[dry-run] " : ""}Done — ${created} ${dryRun ? "would be created" : "created"}, ${skipped} skipped.`);
    if (!dryRun && created < 5 && skipped < 5) {
        console.log("Note: fewer than 5 issues are present. Check label existence + gh auth.");
    }
}

main();
