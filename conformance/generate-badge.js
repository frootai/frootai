#!/usr/bin/env node
/**
 * FAI Conformance Badge Generator
 *
 * Runs the L0 conformance suite via the bundled CLI library, then writes:
 *   - badge.svg              (hand-crafted shields-style flat-square, ~150x20)
 *   - badge-endpoint.json    (shields.io endpoint format, consumable via
 *                             https://img.shields.io/endpoint?url=...)
 *
 * Both artefacts are committed back to the repo by .github/workflows/conformance-badge.yml.
 *
 * Zero runtime dependencies. Node 18+ built-ins only.
 *
 * Spec: github.com/frootai/frootai/blob/main/fai-protocol/README.md#9-conformance
 * Tracker: P1.2.009
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ── Locate the bundled L0 runner via the sibling frootai-core CLI checkout
// In CI, both repos are checked out side-by-side. Locally, follow the same convention.
const CANDIDATE_LIB_PATHS = [
  path.join(__dirname, "..", "..", "frootai-core", "cli", "conformance", "lib.js"),
  path.join(__dirname, "lib.js"), // self-contained fallback
];

let lib;
for (const candidate of CANDIDATE_LIB_PATHS) {
  if (fs.existsSync(candidate)) {
    lib = require(candidate);
    break;
  }
}

if (!lib) {
  console.error("error: could not locate conformance lib.js in either:");
  CANDIDATE_LIB_PATHS.forEach((p) => console.error("  -", p));
  process.exit(2);
}

// ── Run L0 against the canonical examples directory
const EXAMPLES_DIR = path.join(__dirname, "..", "fai-protocol", "examples");
const OUT_DIR = __dirname;

console.log(`Running L0 conformance against ${EXAMPLES_DIR} ...`);

const report = lib.runAll(EXAMPLES_DIR, { recursive: false });

console.log(`  ${report.passed}/${report.manifestCount} passed in ${report.elapsedMs}ms`);

// ── Compute badge values
const allPassed = report.failed === 0 && report.manifestCount > 0;
const label = "FAI L0";
const status = allPassed
  ? `passing ${report.passed}/${report.manifestCount}`
  : `failing ${report.failed}/${report.manifestCount}`;

// Shields colours (hex without #)
const colour = report.manifestCount === 0
  ? "9f9f9f"            // grey — nothing to check (suspicious)
  : allPassed
    ? "4c1"             // green
    : "e05d44";         // red

// ── Hand-craft a shields-style flat-square SVG (no external dep on shields.io)
// Width math: monospace approximation ~6.5 px per character + 10 px padding each side
function approxWidth(text) {
  // Helvetica-Verdana 11px is roughly 6.5 wide for ASCII; we add padding
  return Math.ceil(text.length * 6.6) + 12;
}

const labelW = approxWidth(label);
const statusW = approxWidth(status);
const totalW = labelW + statusW;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="20" role="img" aria-label="${label}: ${status}">
  <title>${label}: ${status}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".7"/>
    <stop offset=".1" stop-color="#aaa" stop-opacity=".1"/>
    <stop offset=".9" stop-color="#000" stop-opacity=".3"/>
    <stop offset="1" stop-color="#000" stop-opacity=".5"/>
  </linearGradient>
  <clipPath id="r"><rect width="${totalW}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="20" fill="#555"/>
    <rect x="${labelW}" width="${statusW}" height="20" fill="#${colour}"/>
    <rect width="${totalW}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="110" text-rendering="geometricPrecision">
    <text transform="scale(.1)" x="${labelW * 5}" y="150" fill="#010101" fill-opacity=".3">${label}</text>
    <text transform="scale(.1)" x="${labelW * 5}" y="140">${label}</text>
    <text transform="scale(.1)" x="${(labelW + statusW / 2) * 10}" y="150" fill="#010101" fill-opacity=".3">${status}</text>
    <text transform="scale(.1)" x="${(labelW + statusW / 2) * 10}" y="140">${status}</text>
  </g>
</svg>
`;

// ── Shields.io endpoint JSON (alternate consumption path)
const endpoint = {
  schemaVersion: 1,
  label,
  message: status,
  color: allPassed ? "brightgreen" : "red",
  cacheSeconds: 300,
  namedLogo: undefined,
  // Custom fields (Shields ignores these; useful for our own audit trail)
  fai: {
    suite: report.suite,
    protocol: report.protocol,
    elapsedMs: report.elapsedMs,
    generatedAt: report.startedAt,
  },
};

// Strip undefined for cleaner JSON
const endpointJson = JSON.stringify(
  endpoint,
  (k, v) => (v === undefined ? undefined : v),
  2,
) + "\n";

// ── Write artefacts
const svgPath = path.join(OUT_DIR, "badge.svg");
const endpointPath = path.join(OUT_DIR, "badge-endpoint.json");

fs.writeFileSync(svgPath, svg, "utf8");
fs.writeFileSync(endpointPath, endpointJson, "utf8");

console.log(`  wrote ${path.relative(process.cwd(), svgPath)} (${svg.length} bytes)`);
console.log(`  wrote ${path.relative(process.cwd(), endpointPath)} (${endpointJson.length} bytes)`);

// ── Exit code mirrors the underlying conformance verdict
// 0 — all passed, badge is green
// 1 — at least one failed, badge is red (still wrote files so CI can publish red badge)
process.exit(allPassed ? 0 : 1);
