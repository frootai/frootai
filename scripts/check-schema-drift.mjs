#!/usr/bin/env node
/**
 * [H0.27] Schema-drift CI gate.
 *
 * The v2 manifest + policy-overlay-v1 schemas live in TWO places per the
 * source-inventory canonicalization at 2026-06-12:
 *
 *   - `frootai/orchard/schema/<name>.json`      (authoring / orchard-pipeline mirror)
 *   - `frootai/schemas/<name>.schema.json`      (canonical reference home)
 *
 * Until [H0.27] ships a richer bidirectional sync, this gate just enforces
 * that the two byte-for-byte SHA-256 hashes match. Any drift fails CI and
 * prints both hashes + the diff command to investigate.
 *
 * Run locally:
 *   node scripts/check-schema-drift.mjs
 *
 * CI uses it via .github/workflows/schema-drift.yml.
 *
 * Exit codes:
 *   0 = all pairs in sync
 *   1 = at least one pair drifted (CI fails)
 *   2 = expected file missing (CI fails)
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve, relative } from "node:path";

const ROOT = resolve(import.meta.dirname ?? ".", "..");

/** @type {{name: string, canonical: string, mirror: string}[]} */
const PAIRS = [
  {
    name: "fai-manifest-v2",
    canonical: "schemas/fai-manifest-v2.schema.json",
    mirror: "orchard/schema/fai-manifest-v2.json",
  },
  {
    name: "policy-overlay-v1",
    canonical: "schemas/policy-overlay-v1.schema.json",
    mirror: "orchard/schema/policy-overlay-v1.json",
  },
];

function sha256(filePath) {
  const bytes = readFileSync(filePath);
  return createHash("sha256").update(bytes).digest("hex");
}

let exitCode = 0;
const results = [];

for (const pair of PAIRS) {
  const canonAbs = resolve(ROOT, pair.canonical);
  const mirrorAbs = resolve(ROOT, pair.mirror);
  const canonExists = existsSync(canonAbs);
  const mirrorExists = existsSync(mirrorAbs);

  if (!canonExists || !mirrorExists) {
    console.error(`[FAIL] ${pair.name}: missing file`);
    if (!canonExists) console.error(`  canonical: ${pair.canonical} NOT FOUND`);
    if (!mirrorExists) console.error(`  mirror:    ${pair.mirror} NOT FOUND`);
    exitCode = Math.max(exitCode, 2);
    continue;
  }

  const canonHash = sha256(canonAbs);
  const mirrorHash = sha256(mirrorAbs);
  const match = canonHash === mirrorHash;
  results.push({ pair, canonHash, mirrorHash, match });

  if (match) {
    console.log(`[OK]   ${pair.name}  sha256=${canonHash.slice(0, 16)}...`);
  } else {
    console.error(`[FAIL] ${pair.name}  DRIFT detected`);
    console.error(`  canonical: ${pair.canonical}`);
    console.error(`             sha256=${canonHash}`);
    console.error(`  mirror:    ${pair.mirror}`);
    console.error(`             sha256=${mirrorHash}`);
    console.error(
      `  investigate: diff "${pair.canonical}" "${pair.mirror}"`,
    );
    exitCode = Math.max(exitCode, 1);
  }
}

if (exitCode === 0) {
  console.log("");
  console.log(`schema-drift gate: all ${PAIRS.length} pair(s) in sync`);
} else {
  console.error("");
  console.error(
    "schema-drift gate: FAILED. Pick a canonical winner, copy it over the drifted file, recommit.",
  );
}

process.exit(exitCode);
