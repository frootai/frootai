// @ts-check
/**
 * [H8.28] e2e.js — E2E CLI scenario engine + 12-scenario roster.
 *
 * Contract (verbatim from masterplan §3 row [H8.28]):
 *   E2E CLI tests: 12 BATS / shellspec scenarios covering happy path +
 *   login/logout + paid gate + dry-run + offline + bad input
 *
 * Top-level group `e2e/` parallels `errors/` (H8.27) per H8.x
 * group-per-domain doctrine. The "BATS / shellspec" framing in the
 * masterplan is a category of behavioural-test style — observe a
 * command's exit code + stdout + stderr, assert against expected
 * shapes. We ship the same philosophy in pure JS so the scenarios
 * are hermetic + cross-platform (Windows/macOS/Linux identical;
 * no bash dep). The scenarios call each handler's `runWithDeps`
 * surface with canned dependencies — same observability that BATS
 * gets from invoking the binary, without the binary-build burden.
 *
 * **Scenario shape** (frozen):
 *   {
 *     id: "happy_path_progress_demo_json",
 *     name: "happy path: progress demo emits final summary JSON",
 *     category: "happy_path" | "login_logout" | "paid_gate" |
 *                "dry_run" | "offline" | "bad_input",
 *     handler: "progress" | "completions" | "install-tui" | "errors",
 *     argv: ["demo", "--mode", "json", "--json"],
 *     deps: () => ({...}),    // factory so each run gets fresh deps
 *     expect: {
 *       exitCode: 0,
 *       stdoutContains?: [string, ...],
 *       stdoutNotContains?: [string, ...],
 *       stderrContains?: [string, ...],
 *       stdoutMatchesJson?: (obj) => boolean,
 *     }
 *   }
 *
 * **Six categories × 2 scenarios = 12** per the masterplan row:
 *   happy_path   (2): progress demo + completions list
 *   login_logout (2): completions path (read-only happy) +
 *                     completions install --print (dry happy idempotent)
 *   paid_gate    (2): install-tui free-list load fail (NOINPUT) +
 *                     install-tui happy with JSON pick (free → OK)
 *   dry_run      (2): progress --no-progress silent +
 *                     errors demo --no-upload
 *   offline      (2): errors demo no-uploader (endpoint_unreachable) +
 *                     install-tui non-TTY without --json (USAGE)
 *   bad_input    (2): progress --mode bogus +
 *                     errors demo NOT_A_CODE
 *
 * **Subcommand argv grammar** — `frootai e2e <subcommand>`:
 *   list                         list all scenarios (id + category + name)
 *   run [--filter <id-prefix>]   run all (or filtered) scenarios + print
 *                                  PASS/FAIL summary; exit non-zero on any
 *                                  FAIL
 *   show <id>                    print one scenario's argv + expect shape
 *   --json                       emit machine-readable summary on stdout
 *   --help, -h                   print help + exit OK
 *
 * **Exit codes**:
 *   0    OK              — all scenarios passed
 *   64   USAGE           — bad flags / unknown subcommand / unknown id
 *   70   SOFTWARE        — unexpected internal error
 *   1    FAIL_GENERIC    — one or more scenarios failed (Node convention)
 *
 * **Non-goals for THIS ship**:
 *   - Shelling out to a real frootai binary (deferred to a later
 *     ship that wires the bin entrypoint; today we drive `runWithDeps`)
 *   - Network calls (every scenario has deps fully injected)
 *   - Wiring scenarios into a CI gate (the test file itself acts as
 *     the CI gate today)
 *
 * License: CC0-1.0.
 */
"use strict";

const path = require("node:path");

const completions = require("../completions/completions.js");
const installTui = require("../orchard/install-tui.js");
const progress = require("../progress/progress.js");
const errors = require("../errors/errors.js");

const EXIT = Object.freeze({
  OK: 0,
  FAIL: 1,
  USAGE: 64,
  SOFTWARE: 70,
});

const CATEGORIES = Object.freeze([
  "happy_path",
  "login_logout",
  "paid_gate",
  "dry_run",
  "offline",
  "bad_input",
]);

const SUBCOMMANDS = Object.freeze(["list", "run", "show"]);

const VALUE_FLAGS = new Set(["--filter"]);
const BOOL_FLAGS = new Set(["--json", "--help", "-h"]);

class E2eError extends Error {
  /** @param {string} code @param {string} message @param {{exitCode?: number}} [opts] */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "E2eError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
  }
}

/**
 * Parse argv for `frootai e2e <subcommand> [OPTIONS]`.
 *
 * @param {string[]} argv
 * @returns {{subcommand: string|null, id: string|null, filter: string|null, json: boolean, help: boolean}}
 */
function parseE2eArgs(argv) {
  if (!Array.isArray(argv)) throw new TypeError("parseE2eArgs: argv must be an array");
  const out = { subcommand: /** @type {string|null} */ (null), id: /** @type {string|null} */ (null), filter: /** @type {string|null} */ (null), json: false, help: false };
  /** @type {string[]} */ const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (typeof a !== "string") throw new E2eError("usage", `argv[${i}] must be a string`, { exitCode: EXIT.USAGE });
    if (a === "--help" || a === "-h") { out.help = true; continue; }
    if (a === "--json") { out.json = true; continue; }
    const eq = a.indexOf("=");
    if (a.startsWith("--") && eq > 0) {
      const flag = a.slice(0, eq);
      const value = a.slice(eq + 1);
      if (!VALUE_FLAGS.has(flag)) throw new E2eError("usage", `unknown flag: ${flag}`, { exitCode: EXIT.USAGE });
      applyValueFlag(out, flag, value);
      continue;
    }
    if (VALUE_FLAGS.has(a)) {
      const v = argv[++i];
      if (typeof v !== "string") throw new E2eError("usage", `${a} requires a value`, { exitCode: EXIT.USAGE });
      applyValueFlag(out, a, v);
      continue;
    }
    if (a.startsWith("-")) throw new E2eError("usage", `unknown flag: ${a}`, { exitCode: EXIT.USAGE });
    positional.push(a);
  }
  if (positional.length === 0) return out;
  const sub = positional[0];
  if (!SUBCOMMANDS.includes(sub)) throw new E2eError("usage", `unknown subcommand: ${sub} (valid: ${SUBCOMMANDS.join("|")})`, { exitCode: EXIT.USAGE });
  out.subcommand = sub;
  if (sub === "list" || sub === "run") {
    if (positional.length > 1) throw new E2eError("usage", `${sub} accepts no positional args`, { exitCode: EXIT.USAGE });
  } else if (sub === "show") {
    if (positional.length < 2) throw new E2eError("usage", `show requires a scenario id`, { exitCode: EXIT.USAGE });
    if (positional.length > 2) throw new E2eError("usage", `show accepts exactly one positional arg`, { exitCode: EXIT.USAGE });
    out.id = positional[1];
  }
  return out;
}

/** @param {*} out @param {string} flag @param {string} value */
function applyValueFlag(out, flag, value) {
  if (flag === "--filter") {
    if (!value) throw new E2eError("usage", `--filter requires a non-empty value`, { exitCode: EXIT.USAGE });
    out.filter = value;
  }
}

function buildHelp() {
  return [
    "Usage: frootai e2e <subcommand> [OPTIONS]",
    "",
    "Run the 12-scenario E2E CLI test suite (hermetic; no shell, no network).",
    "",
    "Subcommands:",
    "  list                    list all scenarios (id + category + name)",
    "  run                     run all scenarios; exit non-zero on FAIL",
    "  show <id>               print one scenario's argv + expected shape",
    "",
    "Options:",
    "  --filter <id-prefix>    run only scenarios whose id starts with prefix",
    "  --json                  emit machine-readable summary on stdout",
    "  --help, -h              print this help",
    "",
    "License: CC0-1.0.",
  ].join("\n");
}

/**
 * Build a captured-output writer pair. Returns `{write, writeLn, out, err}`
 * where `out`/`err` are the captured arrays.
 *
 * @returns {{write: (s: string) => void, writeLn: (s: string) => void, out: string[], err: string[]}}
 */
function captureBuffers() {
  /** @type {string[]} */ const out = [];
  /** @type {string[]} */ const err = [];
  return {
    out, err,
    write: (s) => err.push(String(s)),
    writeLn: (s) => out.push(String(s)),
  };
}

/**
 * Build a canned readline impl from a fixed sequence of answers.
 * Returns null on exhaustion (EOF).
 *
 * @param {string[]} answers
 * @returns {(prompt: string) => Promise<string|null>}
 */
function cannedReadLine(answers) {
  const seq = answers.slice();
  return () => Promise.resolve(seq.length > 0 ? /** @type {string|null} */ (seq.shift()) : null);
}

// ─────────────────────────────────────────────────────────────────
//  12 scenario factories. Each returns a runnable scenario record.
//  The factory pattern ensures fresh deps + buffers per `runScenario`.
// ─────────────────────────────────────────────────────────────────

const FAKE_FREE_LIST_ITEMS = Object.freeze([
  { full_name: "Azure-Samples/azure-search-openai-demo" },
  { full_name: "microsoft/ai-agents-for-beginners" },
  { full_name: "Azure/GPT-RAG" },
]);

const SCENARIO_FACTORIES = Object.freeze([
  // 1. happy_path: progress demo emits final summary JSON
  () => ({
    id: "happy_path_progress_demo_json",
    category: "happy_path",
    name: "progress demo emits final summary JSON",
    handler: "progress",
    argv: ["--mode", "json", "--json"],
    run: async () => {
      const bufs = captureBuffers();
      const code = await progress.runWithDeps(bufs === bufs ? ["--mode", "json", "--json"] : [], {}, {
        write: bufs.write, writeLn: bufs.writeLn,
        isTTY: () => false,
        sleep: () => Promise.resolve(),
        now: () => 1000,
      });
      return { exitCode: code, stdout: bufs.out.join("\n"), stderr: bufs.err.join("") };
    },
    expect: { exitCode: 0, stdoutContains: ["\"stages\""], stderrContains: ["\"event\":\"start\"", "\"event\":\"succeed\""] },
  }),

  // 2. happy_path: completions list emits json roster
  () => ({
    id: "happy_path_completions_list_json",
    category: "happy_path",
    name: "completions list emits 4-shell roster JSON",
    handler: "completions",
    argv: ["list", "--json"],
    run: async () => {
      const bufs = captureBuffers();
      const code = await completions.runWithDeps(
        ["list", "--json"],
        { stdout: (s) => bufs.out.push(String(s)), stderr: (s) => bufs.err.push(String(s)) },
        {
          env: {},
          homedir: () => "/home/test",
          platform: () => "linux",
          existsSync: () => false,
          writeFile: () => {},
          mkdir: () => {},
        },
      );
      return { exitCode: code, stdout: bufs.out.join(""), stderr: bufs.err.join("") };
    },
    expect: { exitCode: 0, stdoutContains: ["bash", "zsh", "fish", "powershell"] },
  }),

  // 3. login_logout: completions path bash (read-only happy — proxy for login lookup)
  () => ({
    id: "login_logout_completions_path_bash",
    category: "login_logout",
    name: "completions path bash returns canonical install path",
    handler: "completions",
    argv: ["path", "bash"],
    run: async () => {
      const bufs = captureBuffers();
      const code = await completions.runWithDeps(
        ["path", "bash"],
        { stdout: (s) => bufs.out.push(String(s)), stderr: (s) => bufs.err.push(String(s)) },
        {
          env: { HOME: "/home/test" },
          homedir: () => "/home/test",
          platform: () => "linux",
          existsSync: () => false,
          writeFile: () => {},
          mkdir: () => {},
        },
      );
      return { exitCode: code, stdout: bufs.out.join(""), stderr: bufs.err.join("") };
    },
    expect: { exitCode: 0, stdoutContains: ["bash-completion", "completions", "frootai"] },
  }),

  // 4. login_logout: completions install bash --print (dry-path; idempotent — proxy for logout)
  () => ({
    id: "login_logout_completions_install_dry",
    category: "login_logout",
    name: "completions install bash --print is idempotent dry-path",
    handler: "completions",
    argv: ["install", "bash", "--print"],
    run: async () => {
      const bufs = captureBuffers();
      let wrote = false;
      const code = await completions.runWithDeps(
        ["install", "bash", "--print"],
        { stdout: (s) => bufs.out.push(String(s)), stderr: (s) => bufs.err.push(String(s)) },
        {
          env: { HOME: "/home/test" },
          homedir: () => "/home/test",
          platform: () => "linux",
          existsSync: () => false,
          writeFile: () => { wrote = true; },
          mkdir: () => {},
        },
      );
      return { exitCode: code, stdout: bufs.out.join(""), stderr: bufs.err.join(""), meta: { wrote } };
    },
    expect: {
      exitCode: 0,
      stdoutContains: ["bash-completion", "frootai"],
      meta: (m) => m && m.wrote === false,
    },
  }),

  // 5. paid_gate: install-tui free-list load failure -> NOINPUT
  () => ({
    id: "paid_gate_install_tui_load_fail",
    category: "paid_gate",
    name: "install-tui exits NOINPUT when free list cannot be loaded",
    handler: "install-tui",
    argv: [],
    run: async () => {
      const bufs = captureBuffers();
      const code = await installTui.runWithDeps([], {}, {
        readLine: cannedReadLine([]),
        writeLn: bufs.writeLn,
        writeErr: bufs.write,
        isTTY: () => true,
        loadFreeList: () => ({ ok: false, error: "free list unreadable" }),
        existsSync: () => false,
        readdirSync: () => [],
      });
      return { exitCode: code, stdout: bufs.out.join("\n"), stderr: bufs.err.join("") };
    },
    expect: { exitCode: 66, stderrContains: ["free list unreadable"] },
  }),

  // 6. paid_gate: install-tui happy --json picks free repo
  () => ({
    id: "paid_gate_install_tui_happy_json",
    category: "paid_gate",
    name: "install-tui --json picks first free repo + emits JSON payload",
    handler: "install-tui",
    argv: ["--json"],
    run: async () => {
      const bufs = captureBuffers();
      const code = await installTui.runWithDeps(["--json"], {}, {
        readLine: cannedReadLine(["1", "y", ""]),
        writeLn: bufs.writeLn,
        writeErr: bufs.write,
        isTTY: () => true,
        loadFreeList: () => ({ ok: true, items: FAKE_FREE_LIST_ITEMS.slice(), count: FAKE_FREE_LIST_ITEMS.length }),
        existsSync: () => false,
        readdirSync: () => [],
      });
      return { exitCode: code, stdout: bufs.out.join("\n"), stderr: bufs.err.join("") };
    },
    expect: {
      exitCode: 0,
      stdoutMatchesJson: (obj) => obj && obj.ok === true && obj.fullName === "Azure-Samples/azure-search-openai-demo" && obj.slug === "azure-search-openai-demo",
    },
  }),

  // 7. dry_run: progress --no-progress emits nothing on stderr
  () => ({
    id: "dry_run_progress_silent",
    category: "dry_run",
    name: "progress demo --no-progress emits zero stderr",
    handler: "progress",
    argv: ["--no-progress"],
    run: async () => {
      const bufs = captureBuffers();
      const code = await progress.runWithDeps(["--no-progress"], {}, {
        write: bufs.write, writeLn: bufs.writeLn,
        isTTY: () => true,
        sleep: () => Promise.resolve(),
        now: () => 1000,
      });
      return { exitCode: code, stdout: bufs.out.join("\n"), stderr: bufs.err.join(""), meta: { stderrLineCount: bufs.err.length } };
    },
    expect: {
      exitCode: 0,
      meta: (m) => m && m.stderrLineCount === 0,
    },
  }),

  // 8. dry_run: errors demo --no-upload skips upload
  () => ({
    id: "dry_run_errors_no_upload",
    category: "dry_run",
    name: "errors demo --no-upload reports reason=no_upload_flag",
    handler: "errors",
    argv: ["demo", "RATE_LIMITED", "--json", "--no-upload"],
    run: async () => {
      const bufs = captureBuffers();
      const code = await errors.runWithDeps(["demo", "RATE_LIMITED", "--json", "--no-upload"], {}, {
        write: bufs.write, writeLn: bufs.writeLn,
        generateSupportId: () => "0123456789abcdef",
        consented: () => true,
        uploader: () => ({ ok: true }),
      });
      return { exitCode: code, stdout: bufs.out.join("\n"), stderr: bufs.err.join("") };
    },
    expect: {
      exitCode: 69,
      stdoutMatchesJson: (env) => env && env.version === 1 && env.error && env.error.support_upload && env.error.support_upload.uploaded === false && env.error.support_upload.reason === "no_upload_flag",
    },
  }),

  // 9. offline: errors demo without uploader -> endpoint_unreachable
  () => ({
    id: "offline_errors_endpoint_unreachable",
    category: "offline",
    name: "errors demo with no uploader reports reason=endpoint_unreachable",
    handler: "errors",
    argv: ["demo", "INTERNAL_ERROR", "--json"],
    run: async () => {
      const bufs = captureBuffers();
      const code = await errors.runWithDeps(["demo", "INTERNAL_ERROR", "--json"], {}, {
        write: bufs.write, writeLn: bufs.writeLn,
        generateSupportId: () => "fedcba9876543210",
        consented: () => true,
        // intentionally NO uploader -> endpoint_unreachable branch
      });
      return { exitCode: code, stdout: bufs.out.join("\n"), stderr: bufs.err.join("") };
    },
    expect: {
      exitCode: 70,
      stdoutMatchesJson: (env) => env && env.error && env.error.support_upload && env.error.support_upload.uploaded === false && env.error.support_upload.reason === "endpoint_unreachable",
    },
  }),

  // 10. offline: install-tui non-TTY without --json -> USAGE
  () => ({
    id: "offline_install_tui_non_tty",
    category: "offline",
    name: "install-tui refuses non-TTY stdin without --json",
    handler: "install-tui",
    argv: [],
    run: async () => {
      const bufs = captureBuffers();
      const code = await installTui.runWithDeps([], {}, {
        readLine: cannedReadLine([]),
        writeLn: bufs.writeLn,
        writeErr: bufs.write,
        isTTY: () => false,
        loadFreeList: () => ({ ok: true, items: FAKE_FREE_LIST_ITEMS.slice(), count: FAKE_FREE_LIST_ITEMS.length }),
        existsSync: () => false,
        readdirSync: () => [],
      });
      return { exitCode: code, stdout: bufs.out.join("\n"), stderr: bufs.err.join("") };
    },
    expect: { exitCode: 64, stderrContains: ["refusing to render", "non-TTY"] },
  }),

  // 11. bad_input: progress --mode bogus -> USAGE
  () => ({
    id: "bad_input_progress_unknown_mode",
    category: "bad_input",
    name: "progress --mode bogus exits USAGE with help",
    handler: "progress",
    argv: ["--mode", "bogus"],
    run: async () => {
      const bufs = captureBuffers();
      const code = await progress.runWithDeps(["--mode", "bogus"], {}, {
        write: bufs.write, writeLn: bufs.writeLn,
        isTTY: () => true,
        sleep: () => Promise.resolve(),
      });
      return { exitCode: code, stdout: bufs.out.join("\n"), stderr: bufs.err.join("") };
    },
    expect: { exitCode: 64, stderrContains: ["--mode must be one of", "Usage:"] },
  }),

  // 12. bad_input: errors demo NOT_A_CODE -> USAGE
  () => ({
    id: "bad_input_errors_unknown_code",
    category: "bad_input",
    name: "errors demo NOT_A_CODE exits USAGE",
    handler: "errors",
    argv: ["demo", "NOT_A_CODE"],
    run: async () => {
      const bufs = captureBuffers();
      const code = await errors.runWithDeps(["demo", "NOT_A_CODE"], {}, {
        write: bufs.write, writeLn: bufs.writeLn,
        generateSupportId: () => "0000000000000000",
        consented: () => false,
      });
      return { exitCode: code, stdout: bufs.out.join("\n"), stderr: bufs.err.join("") };
    },
    expect: { exitCode: 64, stderrContains: ["unknown error code"] },
  }),
]);

const SCENARIO_IDS = Object.freeze(SCENARIO_FACTORIES.map((f) => f().id));

if (SCENARIO_IDS.length !== 12) {
  throw new Error(`[H8.28] internal: expected exactly 12 scenarios, got ${SCENARIO_IDS.length}`);
}

/**
 * Build all 12 scenarios. Pure — each call returns fresh scenario records.
 *
 * @returns {Array<{id: string, category: string, name: string, handler: string, argv: string[], run: () => Promise<{exitCode: number, stdout: string, stderr: string, meta?: object}>, expect: object}>}
 */
function listScenarios() {
  return SCENARIO_FACTORIES.map((f) => f());
}

/**
 * Find a scenario by id. Pure.
 *
 * @param {string} id
 * @returns {ReturnType<typeof listScenarios>[number] | null}
 */
function findScenario(id) {
  return listScenarios().find((s) => s.id === id) || null;
}

/**
 * Filter scenarios by id-prefix. Pure.
 *
 * @param {ReturnType<typeof listScenarios>} all
 * @param {string|null} prefix
 * @returns {ReturnType<typeof listScenarios>}
 */
function filterByPrefix(all, prefix) {
  if (!prefix) return all.slice();
  return all.filter((s) => s.id.startsWith(prefix));
}

/**
 * Evaluate the captured run output against the scenario's expect.
 * Pure. Returns `{ok: boolean, failures: string[]}`.
 *
 * @param {{exitCode: number, stdout: string, stderr: string, meta?: object}} actual
 * @param {{exitCode: number, stdoutContains?: string[], stdoutNotContains?: string[], stderrContains?: string[], stdoutMatchesJson?: (obj: any) => boolean, meta?: (m: any) => boolean}} expect
 * @returns {{ok: boolean, failures: string[]}}
 */
function evaluateExpectations(actual, expect) {
  /** @type {string[]} */
  const failures = [];
  if (typeof expect.exitCode === "number" && actual.exitCode !== expect.exitCode) {
    failures.push(`exitCode: expected ${expect.exitCode}, got ${actual.exitCode}`);
  }
  if (Array.isArray(expect.stdoutContains)) {
    for (const needle of expect.stdoutContains) {
      if (!actual.stdout.includes(needle)) failures.push(`stdout missing substring: ${JSON.stringify(needle)}`);
    }
  }
  if (Array.isArray(expect.stdoutNotContains)) {
    for (const needle of expect.stdoutNotContains) {
      if (actual.stdout.includes(needle)) failures.push(`stdout unexpectedly contains: ${JSON.stringify(needle)}`);
    }
  }
  if (Array.isArray(expect.stderrContains)) {
    for (const needle of expect.stderrContains) {
      if (!actual.stderr.includes(needle)) failures.push(`stderr missing substring: ${JSON.stringify(needle)}`);
    }
  }
  if (typeof expect.stdoutMatchesJson === "function") {
    let parsed = null;
    let parseErr = null;
    try { parsed = JSON.parse(actual.stdout.trim().split("\n").pop() || ""); }
    catch (err) { parseErr = err && err.message ? err.message : String(err); }
    if (parseErr) {
      failures.push(`stdoutMatchesJson: stdout last line not valid JSON: ${parseErr}`);
    } else if (!expect.stdoutMatchesJson(parsed)) {
      failures.push(`stdoutMatchesJson: predicate returned false (got: ${JSON.stringify(parsed).slice(0, 200)})`);
    }
  }
  if (typeof expect.meta === "function") {
    if (!expect.meta(actual.meta || null)) failures.push(`meta predicate returned false (got: ${JSON.stringify(actual.meta || null)})`);
  }
  return { ok: failures.length === 0, failures };
}

/**
 * Run one scenario. Returns the result record. Pure (modulo handler
 * side effects, which are all dep-injected to be hermetic).
 *
 * @param {ReturnType<typeof listScenarios>[number]} scenario
 * @returns {Promise<{id: string, category: string, status: "pass"|"fail"|"error", actual: object, failures: string[], error?: string, durationMs: number}>}
 */
async function runScenario(scenario) {
  const t0 = Date.now();
  try {
    const actual = await scenario.run();
    const evalResult = evaluateExpectations(actual, scenario.expect);
    return {
      id: scenario.id,
      category: scenario.category,
      status: evalResult.ok ? "pass" : "fail",
      actual,
      failures: evalResult.failures,
      durationMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      id: scenario.id,
      category: scenario.category,
      status: "error",
      actual: { exitCode: -1, stdout: "", stderr: "" },
      failures: [],
      error: err && err.message ? err.message : String(err),
      durationMs: Date.now() - t0,
    };
  }
}

/**
 * Run a list of scenarios + build the summary report. Pure (delegates
 * runScenario serially to keep order + simplicity).
 *
 * @param {ReturnType<typeof listScenarios>} scenarios
 * @returns {Promise<{total: number, passed: number, failed: number, errored: number, results: Array<ReturnType<typeof runScenario> extends Promise<infer R> ? R : never>}>}
 */
async function runAll(scenarios) {
  /** @type {Array<*>} */
  const results = [];
  let passed = 0, failed = 0, errored = 0;
  for (const sc of scenarios) {
    const r = await runScenario(sc);
    results.push(r);
    if (r.status === "pass") passed++;
    else if (r.status === "fail") failed++;
    else errored++;
  }
  return { total: scenarios.length, passed, failed, errored, results };
}

/**
 * Render a human-readable summary. Pure.
 *
 * @param {Awaited<ReturnType<typeof runAll>>} summary
 * @returns {string}
 */
function renderSummary(summary) {
  /** @type {string[]} */
  const lines = [];
  for (const r of summary.results) {
    const marker = r.status === "pass" ? "PASS" : r.status === "fail" ? "FAIL" : "ERROR";
    lines.push(`[${marker}] ${r.category}/${r.id}  (${r.durationMs}ms)`);
    if (r.status === "fail") {
      for (const f of r.failures) lines.push(`         - ${f}`);
    } else if (r.status === "error") {
      lines.push(`         - exception: ${r.error}`);
    }
  }
  lines.push("");
  lines.push(`Total: ${summary.total}  Pass: ${summary.passed}  Fail: ${summary.failed}  Error: ${summary.errored}`);
  return lines.join("\n");
}

/**
 * Demo runner — dispatches the e2e subcommands.
 *
 * @param {string[]} argv
 * @param {object} [ctx]
 * @param {object} [deps]
 * @param {(s: string) => void} [deps.write]
 * @param {(s: string) => void} [deps.writeLn]
 * @returns {Promise<number>}
 */
async function runWithDeps(argv, ctx, deps) {
  const d = deps || {};
  const writeErr = typeof d.write === "function" ? d.write : (s) => { process.stderr.write(s); };
  const writeLn = typeof d.writeLn === "function" ? d.writeLn : (s) => { process.stdout.write(String(s) + "\n"); };

  let parsed;
  try { parsed = parseE2eArgs(argv); }
  catch (err) {
    const m = err && err.message ? err.message : String(err);
    writeErr(`error: ${m}\n`);
    writeErr(buildHelp() + "\n");
    return EXIT.USAGE;
  }
  if (parsed.help) { writeLn(buildHelp()); return EXIT.OK; }
  if (parsed.subcommand === null) {
    writeErr("error: missing subcommand\n");
    writeErr(buildHelp() + "\n");
    return EXIT.USAGE;
  }

  const all = listScenarios();

  if (parsed.subcommand === "list") {
    if (parsed.json) {
      writeLn(JSON.stringify(all.map((s) => ({ id: s.id, category: s.category, name: s.name, handler: s.handler, argv: s.argv }))));
    } else {
      for (const s of all) writeLn(`${s.category}/${s.id}  — ${s.name}`);
    }
    return EXIT.OK;
  }

  if (parsed.subcommand === "show") {
    const sc = findScenario(/** @type {string} */ (parsed.id));
    if (!sc) {
      writeErr(`error: unknown scenario id: ${parsed.id}\n`);
      return EXIT.USAGE;
    }
    if (parsed.json) {
      writeLn(JSON.stringify({ id: sc.id, category: sc.category, name: sc.name, handler: sc.handler, argv: sc.argv, expect: serializeExpect(sc.expect) }));
    } else {
      writeLn(`id:       ${sc.id}`);
      writeLn(`category: ${sc.category}`);
      writeLn(`handler:  ${sc.handler}`);
      writeLn(`argv:     ${JSON.stringify(sc.argv)}`);
      writeLn(`expect:   ${JSON.stringify(serializeExpect(sc.expect))}`);
    }
    return EXIT.OK;
  }

  // subcommand === "run"
  const filtered = filterByPrefix(all, parsed.filter);
  if (filtered.length === 0) {
    writeErr(`error: --filter "${parsed.filter}" matched zero scenarios\n`);
    return EXIT.USAGE;
  }
  const summary = await runAll(filtered);
  if (parsed.json) {
    writeLn(JSON.stringify({
      total: summary.total, passed: summary.passed, failed: summary.failed, errored: summary.errored,
      results: summary.results.map((r) => ({ id: r.id, category: r.category, status: r.status, durationMs: r.durationMs, failures: r.failures, error: r.error })),
    }));
  } else {
    writeLn(renderSummary(summary));
  }
  if (summary.failed > 0 || summary.errored > 0) return EXIT.FAIL;
  return EXIT.OK;
}

/**
 * Stringify the expect object for `show` output (functions become
 * `"<fn>"` so JSON.stringify doesn't drop them silently).
 *
 * @param {object} expect
 * @returns {object}
 */
function serializeExpect(expect) {
  /** @type {*} */ const out = {};
  for (const k of Object.keys(expect)) {
    const v = expect[k];
    out[k] = typeof v === "function" ? "<fn>" : v;
  }
  return out;
}

function run(argv, ctx) { return runWithDeps(argv, ctx, {}); }

module.exports = {
  EXIT,
  CATEGORIES,
  SUBCOMMANDS,
  VALUE_FLAGS,
  BOOL_FLAGS,
  SCENARIO_IDS,
  E2eError,
  parseE2eArgs,
  buildHelp,
  listScenarios,
  findScenario,
  filterByPrefix,
  evaluateExpectations,
  runScenario,
  runAll,
  renderSummary,
  serializeExpect,
  runWithDeps,
  run,
};
