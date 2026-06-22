#!/usr/bin/env node
/**
 * [Z0.12] Lean Compiler — CLI.
 *
 * Compile a Full markdown primitive into its Lean variant from the command
 * line, for local runs and CI:
 *
 *   node engine/lean-compiler/cli.mjs <path...> [options]
 *
 * Options:
 *   -w, --write     Write <name>.lean.md + <name>.lean.json next to each source.
 *       --stdout    Print the Lean markdown to stdout (single input only).
 *       --json      Print the sidecar stats as JSON.
 *       --type <t>  Primitive type hint (skill|agent|instruction|hook).
 *       --check     Verify idempotence; exit 1 if any input is not a fixed point.
 *   -q, --quiet     Suppress the per-file summary line.
 *   -h, --help      Show this help.
 *
 * The core is exported as `runCli(args, io)` with injectable IO so it can be
 * unit-tested without spawning a process or touching the disk.
 */

import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compile, isFixedPoint } from "./index.js";
import { artifactPaths, serializeSidecar } from "./emit.js";

const HELP = `lean-compiler — compile a Full markdown primitive into its Lean variant.

Usage:
  node engine/lean-compiler/cli.mjs <path...> [options]

Options:
  -w, --write     Write <name>.lean.md + <name>.lean.json next to each source.
      --stdout    Print the Lean markdown to stdout (single input only).
      --json      Print the sidecar stats as JSON.
      --type <t>  Primitive type hint (skill|agent|instruction|hook).
      --check     Verify idempotence; exit 1 if any input is not a fixed point.
  -q, --quiet     Suppress the per-file summary line.
  -h, --help      Show this help.
`;

/**
 * Parse argv into an options object. Unknown flags are captured in `unknown`.
 * @param {string[]} args
 */
function parseArgs(args) {
  const opts = {
    paths: [],
    write: false,
    stdout: false,
    json: false,
    check: false,
    quiet: false,
    help: false,
    type: undefined,
    unknown: undefined,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    switch (a) {
      case "-w":
      case "--write":
        opts.write = true;
        break;
      case "--stdout":
        opts.stdout = true;
        break;
      case "--json":
        opts.json = true;
        break;
      case "--check":
        opts.check = true;
        break;
      case "-q":
      case "--quiet":
        opts.quiet = true;
        break;
      case "-h":
      case "--help":
        opts.help = true;
        break;
      case "--type":
        opts.type = args[++i];
        break;
      default:
        if (a.startsWith("-")) opts.unknown = a;
        else opts.paths.push(a);
    }
  }
  return opts;
}

/**
 * Run the CLI. Returns a process exit code (0 ok, 1 error).
 * @param {string[]} args - argv without node/script.
 * @param {{log?:Function, error?:Function, readFile?:Function, writeFile?:Function}} [io]
 * @returns {number}
 */
function runCli(args, io = {}) {
  const log = io.log || ((...m) => console.log(...m));
  const err = io.error || ((...m) => console.error(...m));
  const read = io.readFile || ((p) => readFileSync(p, "utf8"));
  const write = io.writeFile || ((p, c) => writeFileSync(p, c));

  if (args.length === 0) {
    log(HELP);
    return 1;
  }
  const opts = parseArgs(args);
  if (opts.help) {
    log(HELP);
    return 0;
  }
  if (opts.unknown) {
    err(`unknown option: ${opts.unknown}`);
    return 1;
  }
  if (opts.paths.length === 0) {
    err("no input path given");
    return 1;
  }
  if (opts.stdout && opts.paths.length > 1) {
    err("--stdout requires a single input file");
    return 1;
  }

  let failures = 0;
  for (const p of opts.paths) {
    let md;
    try {
      md = read(p);
    } catch (e) {
      err(`cannot read ${p}: ${e.message}`);
      failures++;
      continue;
    }

    const { lean, sidecar } = compile(md, { type: opts.type });

    if (opts.check && !isFixedPoint(md, { type: opts.type })) {
      err(`not a fixed point: ${p}`);
      failures++;
      continue;
    }

    if (opts.write) {
      const ap = artifactPaths(p);
      write(ap.lean, lean);
      write(ap.sidecar, serializeSidecar(sidecar));
      if (!opts.quiet) {
        log(`${p}  ${sidecar.tokens}→${sidecar.tokensLean} tok (-${sidecar.saved}%)  wrote ${ap.lean} + ${ap.sidecar}`);
      }
    } else if (opts.stdout) {
      log(lean);
    } else if (opts.json) {
      log(serializeSidecar(sidecar).trimEnd());
    } else if (!opts.quiet) {
      log(`${p}  ${sidecar.tokens}→${sidecar.tokensLean} tok (-${sidecar.saved}%)  ${sidecar.bytes}→${sidecar.bytesLean} bytes`);
    }
  }
  return failures > 0 ? 1 : 0;
}

// ── main guard (Windows-safe path comparison) ───────────────────────────────
let invokedAsMain = false;
try {
  invokedAsMain =
    !!process.argv[1] &&
    realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
} catch {
  invokedAsMain = false;
}
if (invokedAsMain) {
  process.exit(runCli(process.argv.slice(2)));
}

export { runCli, parseArgs, HELP };
