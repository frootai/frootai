#!/usr/bin/env node
// @ts-check
/**
 * FAI Protocol L0 Conformance — CLI runner
 *
 * Invoked by:    `frootai conformance [target-dir] [flags]`
 *                `fai conformance       [target-dir] [flags]`
 *                `node run.js           [target-dir] [flags]`
 *
 * Flags:
 *   --json          Output a single JSON document instead of human-readable text
 *   --quiet         Suppress per-file PASS lines (only show FAILs + summary)
 *   --no-recursive  Do not descend into subdirectories
 *   --help, -h      Show usage
 *
 * Exit codes:
 *   0  All manifests passed all 5 L0 checks
 *   1  One or more manifests failed at least one check
 *   2  Invocation error (bad flag, target dir missing, no manifests found)
 *
 * Zero runtime dependencies — Node 18+ built-ins only.
 */

"use strict";

const path = require("path");
const lib = require("./lib");

function parseArgs(argv) {
  const args = {
    targetDir: process.cwd(),
    json: false,
    quiet: false,
    recursive: true,
    help: false,
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--json":
        args.json = true;
        break;
      case "--quiet":
      case "-q":
        args.quiet = true;
        break;
      case "--no-recursive":
        args.recursive = false;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        if (a.startsWith("--")) {
          process.stderr.write(`unknown flag: ${a}\n`);
          process.exit(2);
        }
        positional.push(a);
    }
  }
  if (positional[0]) args.targetDir = positional[0];
  return args;
}

function usage() {
  return `\
\x1b[32m🍊 FAI Protocol L0 Conformance Runner\x1b[0m
Suite: ${lib.SUITE_VERSION} · Protocol: ${lib.PROTOCOL_VERSION}

Usage:
  fai conformance [target-dir] [flags]

Description:
  Runs the 5 L0 conformance checks against every *.fai-manifest.json file
  found in the target directory (default: current working directory).
  Recursive by default; skips node_modules, .git, .internal, dotfiles.

Flags:
  --json          Emit a single JSON document instead of text
  --quiet, -q     Show only failures + summary
  --no-recursive  Do not descend into subdirectories
  --help, -h      Show this message

The 5 L0 checks:
  1. manifest-parse       (spec §3.1)  Valid JSON; root is an object
  2. schema-validation    (spec §3)    Required fields, types, patterns
  3. path-syntax          (spec §5.1)  Paths use ./ or ../../ only
  4. knowledge-ids        (spec §4.1)  FROOT taxonomy or X-prefix
  5. guardrail-ranges     (spec §3.4)  Declared guardrails within bounds

Exit codes:
  0  all passed
  1  one or more failures
  2  invocation error

Examples:
  fai conformance                           # scan current directory
  fai conformance ./my-play                 # scan a specific play
  fai conformance ./plays --quiet           # show only failures
  fai conformance . --json > report.json    # emit machine-readable report

Reference:
  Spec        https://frootai.dev/spec
  Conformance https://github.com/frootai/frootai/tree/main/conformance
`;
}

// ─── Pretty (text) output ───────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

function colorise() {
  // Disable colour when piped or in CI without a TTY
  return process.stdout.isTTY ? C : Object.fromEntries(Object.keys(C).map((k) => [k, ""]));
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function printText(report, args) {
  const col = colorise();

  process.stdout.write("\n");
  process.stdout.write(`${col.bold}${col.cyan}┌──────────────────────────────────────────────────────────┐${col.reset}\n`);
  process.stdout.write(`${col.bold}${col.cyan}│   FAI Protocol Conformance Suite — Level 0               │${col.reset}\n`);
  process.stdout.write(`${col.bold}${col.cyan}│   Suite: ${pad(lib.SUITE_VERSION, 48)}│${col.reset}\n`);
  process.stdout.write(`${col.bold}${col.cyan}└──────────────────────────────────────────────────────────┘${col.reset}\n`);
  process.stdout.write(`${col.dim}Target: ${report.targetDir}${col.reset}\n\n`);

  if (report.manifestCount === 0) {
    process.stdout.write(`${col.yellow}⚠ No *.fai-manifest.json files found in ${report.targetDir}.${col.reset}\n`);
    process.stdout.write(`${col.dim}   Conformance has nothing to check. (Use --no-recursive to limit scope, or change directory.)${col.reset}\n\n`);
    return;
  }

  for (const result of report.results) {
    const rel = path.relative(report.targetDir, result.file) || path.basename(result.file);
    if (result.passed) {
      if (!args.quiet) {
        process.stdout.write(`${col.green}✅ PASS${col.reset}  ${rel}\n`);
      }
    } else {
      process.stdout.write(`${col.red}❌ FAIL${col.reset}  ${rel}\n`);
      for (const check of result.checks) {
        if (!check.passed) {
          process.stdout.write(`        ${col.red}└─${col.reset} ${check.id} (${check.spec})\n`);
          for (const err of check.errors) {
            process.stdout.write(`              ${col.dim}- ${err}${col.reset}\n`);
          }
        }
      }
    }
  }

  process.stdout.write(`\n${col.dim}────────────────────────────────────────────────────────────${col.reset}\n`);
  const elapsedSec = (report.elapsedMs / 1000).toFixed(2);
  if (report.failed === 0) {
    process.stdout.write(`${col.green}✅ All ${report.manifestCount} manifest(s) passed all 5 L0 checks (${elapsedSec}s).${col.reset}\n`);
    process.stdout.write(`${col.dim}   These manifests conform to FAI Protocol ${lib.PROTOCOL_VERSION}, L0.${col.reset}\n\n`);
  } else {
    process.stdout.write(`${col.red}❌ ${report.failed} of ${report.manifestCount} manifest(s) failed L0 (${elapsedSec}s).${col.reset}\n`);
    process.stdout.write(`${col.dim}   ${report.passed} passed.${col.reset}\n\n`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(usage());
    process.exit(0);
  }

  let report;
  try {
    report = lib.runAll(args.targetDir, { recursive: args.recursive });
  } catch (err) {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(2);
  }

  if (args.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    printText(report, args);
  }

  if (report.manifestCount === 0) {
    process.exit(2);
  }
  process.exit(report.failed === 0 ? 0 : 1);
}

main();
