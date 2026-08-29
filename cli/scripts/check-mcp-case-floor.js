#!/usr/bin/env node
// @ts-check
/**
 * FAI MCP CLI — case-floor counter + asserter (M4.22 ship).
 *
 * Walks every `cli-mcp-*.test.js` file in the orchard test directory,
 * counts `await test(` invocations, and asserts the live counts meet
 * the floors pinned in `cli/lib/mcp/_floors.js`.
 *
 * Run via: `node cli/scripts/check-mcp-case-floor.js [--json]`
 *
 * Exit codes:
 *   0  every floor met
 *   1  at least one floor failed (operator action: write more tests, or
 *      explicitly retire tests + lower the floor in `_floors.js`)
 *   2  fatal error (counter itself is broken)
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const TESTS_DIR = path.resolve(REPO_ROOT, "frootai-core", "scripts", "orchard", "test");
const FLOORS = require(path.resolve(REPO_ROOT, "frootai-core", "cli", "lib", "mcp", "_floors"));

const TEST_FILE_GLOB = /^cli-mcp-.*\.test\.js$/;
const AWAIT_TEST_RE = /await test\(/g;

/**
 * Walk the test dir and count `await test(` invocations per file.
 *
 * @returns {{ files: Array<{ basename: string, path: string, count: number, body: string }>, total: number }}
 */
function countCases() {
  const entries = fs.readdirSync(TESTS_DIR);
  const files = [];
  let total = 0;
  for (const name of entries) {
    if (!TEST_FILE_GLOB.test(name)) continue;
    const abs = path.join(TESTS_DIR, name);
    const body = fs.readFileSync(abs, "utf8");
    const count = (body.match(AWAIT_TEST_RE) || []).length;
    files.push({ basename: name.replace(/\.test\.js$/, ""), path: abs, count, body });
    total += count;
  }
  files.sort((a, b) => a.basename.localeCompare(b.basename));
  return { files, total };
}

/**
 * @param {ReturnType<typeof countCases>} stats
 * @returns {{ ok: boolean, errors: string[], summary: object }}
 */
function checkFloors(stats) {
  const errors = [];
  const byBasename = new Map(stats.files.map((f) => [f.basename, f]));

  // ── 1. aggregate floor ──────────────────────────────────────────
  if (stats.total < FLOORS.TOTAL_CASE_FLOOR) {
    errors.push(
      `aggregate: live=${stats.total} < floor=${FLOORS.TOTAL_CASE_FLOOR} (M4.22 ratchet)`,
    );
  }

  // ── 2. per-subcommand floor ─────────────────────────────────────
  /** @type {Record<string, number>} */
  const perSubcommandLive = {};
  for (const [sub, fileList] of Object.entries(FLOORS.SUBCOMMAND_TO_FILES)) {
    let live = 0;
    for (const fb of fileList) {
      const f = byBasename.get(fb);
      if (!f) {
        errors.push(`subcommand "${sub}": gate file missing — ${fb}.test.js`);
        continue;
      }
      live += f.count;
    }
    perSubcommandLive[sub] = live;
    const floor = FLOORS.PER_SUBCOMMAND_FLOOR[sub];
    if (typeof floor !== "number") {
      errors.push(`subcommand "${sub}": no floor configured`);
      continue;
    }
    if (live < floor) {
      errors.push(`subcommand "${sub}": live=${live} < floor=${floor}`);
    }
  }

  // ── 3. per-error-code floor ─────────────────────────────────────
  /** @type {Record<string, number>} */
  const perCodeLive = {};
  for (const [code, floor] of Object.entries(FLOORS.PER_ERROR_CODE_FLOOR)) {
    const literalDouble = `"${code}"`;
    const literalSingle = `'${code}'`;
    let fileHits = 0;
    for (const f of stats.files) {
      if (f.body.includes(literalDouble) || f.body.includes(literalSingle)) {
        fileHits += 1;
      }
    }
    perCodeLive[code] = fileHits;
    if (fileHits < floor) {
      errors.push(`error code "${code}": live=${fileHits} files reference it < floor=${floor}`);
    }
  }

  // ── 4. round-trip requirements ──────────────────────────────────
  for (const req of FLOORS.ROUNDTRIP_REQUIREMENTS) {
    const f = byBasename.get(req.file);
    if (!f) {
      errors.push(`round-trip: gate file missing — ${req.file}.test.js`);
      continue;
    }
    if (!req.namePattern.test(f.body)) {
      errors.push(`round-trip: ${req.file} missing test matching ${req.namePattern}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      totalFloor: FLOORS.TOTAL_CASE_FLOOR,
      total: stats.total,
      perFile: Object.fromEntries(stats.files.map((f) => [f.basename, f.count])),
      perSubcommand: perSubcommandLive,
      perErrorCode: perCodeLive,
    },
  };
}

function main() {
  const args = process.argv.slice(2);
  const wantJson = args.includes("--json");

  let stats;
  try { stats = countCases(); }
  catch (err) {
    process.stderr.write(`[check-mcp-case-floor] FATAL: ${err && err.message}\n`);
    process.exit(2);
  }
  const report = checkFloors(stats);

  if (wantJson) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    process.exit(report.ok ? 0 : 1);
  }

  process.stdout.write(`MCP case floors (M4.22 ratchet)\n`);
  process.stdout.write(`-----------------------------------\n`);
  process.stdout.write(`Total cases: ${stats.total} (floor ${FLOORS.TOTAL_CASE_FLOOR})\n\n`);
  for (const f of stats.files) {
    process.stdout.write(`  ${f.basename.padEnd(40)} ${String(f.count).padStart(4)}\n`);
  }
  process.stdout.write(`\nPer subcommand:\n`);
  for (const [sub, live] of Object.entries(report.summary.perSubcommand)) {
    const floor = FLOORS.PER_SUBCOMMAND_FLOOR[sub];
    process.stdout.write(`  ${sub.padEnd(12)} ${String(live).padStart(4)} (floor ${floor})\n`);
  }
  process.stdout.write(`\nPer error code (file references):\n`);
  for (const [code, live] of Object.entries(report.summary.perErrorCode)) {
    const floor = FLOORS.PER_ERROR_CODE_FLOOR[code];
    process.stdout.write(`  ${code.padEnd(36)} ${String(live).padStart(2)} (floor ${floor})\n`);
  }
  process.stdout.write(`-----------------------------------\n`);
  if (report.ok) {
    process.stdout.write(`OK: every floor met.\n`);
  } else {
    process.stdout.write(`FAIL: ${report.errors.length} floor violation(s):\n`);
    for (const e of report.errors) process.stdout.write(`  - ${e}\n`);
  }
  process.exit(report.ok ? 0 : 1);
}

if (require.main === module) main();

module.exports = { countCases, checkFloors };
