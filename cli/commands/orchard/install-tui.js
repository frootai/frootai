// @ts-check
/**
 * [H8.25] install-tui.js — Interactive picker for
 * `frootai orchard install --as-play` when no URL is provided.
 *
 * Contract (verbatim from masterplan §3 row [H8.25]):
 *   Interactive `frootai orchard install --as-play` (no URL provided):
 *   TUI to browse harvest-free-list, pick repo, confirm `--out` dir
 *
 * Pure picker library. Lives at `cli/commands/orchard/install-tui.js`
 * so the bin-reconciliation sub-phase can wire it into H8.9 install.js
 * via `deps.interactivePicker` WITHOUT changing the 67 existing install
 * tests. This file ships only the library + a thin two-surface handler
 * `runWithDeps(args, ctx, deps)` + `run(args, ctx)` that an integrator
 * (or e2e CLI test) can call directly.
 *
 * **Why a paged numbered list** (not a full curses/ink/blessed TUI):
 *   - Zero third-party deps (third-party-requires invariant)
 *   - Works in the dumbest pipe-or-TTY shell — Git Bash on Windows,
 *     PowerShell, plain xterm, Cygwin, msys
 *   - Re-rendering is just a writeLn loop; no termcap / no escape
 *     sequences other than optional ANSI dim for the header
 *   - Hermetically testable — `runWithDeps` takes a fully injected
 *     `{readLine, writeLn, writeErr, isTTY, loadFreeList, env, mkdir,
 *      existsSync}` and never touches process.stdin/out/err
 *
 * **TUI flow** (3 prompts):
 *   1. Browse — render page N of M (default page size 10), prompt:
 *      `[n] next  [p] prev  [/<query>] filter  [<N>] pick  [q] quit >`
 *      - bare digit string → pick item by absolute index
 *      - `n` / `next` → next page; bounded — last page stops emitting
 *      - `p` / `prev` → previous page
 *      - `/foo` → filter list (case-insensitive substring on full_name);
 *         empty `/` clears filter
 *      - `q` / `quit` / EOF (null line) → exit OK with no pick (USAGE-ish
 *         from the caller's POV; the picker returns ok:false reason:"quit")
 *   2. Confirm slug — print `Selected: <full_name>. Proceed? [Y/n] >`
 *      enter / `y` / `yes` → continue; `n` / `no` → back to step 1
 *   3. Out dir — print `Output directory [tmp/plays/<slug>]: >`
 *      enter → use default; otherwise use the typed path. If the dir
 *      already exists AND is non-empty, re-prompt `Overwrite? [y/N] >`.
 *      Confirmed result: `{ok: true, fullName, outDir}`.
 *
 * **Subcommand argv grammar** (everything AFTER the future
 * `--interactive` flag — for now, callers pass the args directly):
 *   --page-size <n>      override default page-size (default 10)
 *   --workdir-root <p>   override the parent for the default --out
 *                         suggestion (default: `tmp/plays`)
 *   --json               machine-readable JSON to stdout (result only,
 *                         prompts still go to stderr)
 *   --help, -h           print help + exit OK
 *
 * **Exit codes** (sysexits-aligned):
 *   0    OK             — user picked + confirmed; result emitted
 *   64   USAGE          — bad flags / quit-without-pick / non-TTY without
 *                          --json (refuses to render a TUI to a non-TTY
 *                          stdin)
 *   66   NOINPUT        — free list unreadable
 *   70   SOFTWARE       — unexpected internal error
 *
 * **Non-goals for THIS ship**:
 *   - Wiring into H8.9 install.js (deferred to bin-reconciliation per
 *     H8.x doctrine; would risk the 67 existing install tests)
 *   - Spinner / ETA (H8.26 owns)
 *   - Coloured output (kept dim-only ANSI; full theming deferred)
 *   - Multi-pick (one repo per invocation)
 *
 * License: CC0-1.0.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const freeList = require("../auth/free-list.js");

const EXIT = Object.freeze({
  OK: 0,
  USAGE: 64,
  NOINPUT: 66,
  SOFTWARE: 70,
});

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_WORKDIR_ROOT = "tmp/plays";

const VALUE_FLAGS = new Set([
  "--page-size",
  "--workdir-root",
]);

const BOOL_FLAGS = new Set([
  "--json",
  "--help",
  "-h",
]);

class InstallTuiError extends Error {
  /** @param {string} code @param {string} message @param {{exitCode?: number, cause?: Error}} [opts] */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "InstallTuiError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Parse argv (everything AFTER `install-tui`).
 *
 * @param {string[]} argv
 * @returns {{pageSize: number, workdirRoot: string, json: boolean, help: boolean}}
 */
function parseInstallTuiArgs(argv) {
  if (!Array.isArray(argv)) throw new TypeError("parseInstallTuiArgs: argv must be an array");
  const out = {
    pageSize: DEFAULT_PAGE_SIZE,
    workdirRoot: DEFAULT_WORKDIR_ROOT,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (typeof a !== "string") throw new InstallTuiError("usage", `argv[${i}] must be a string`, { exitCode: EXIT.USAGE });
    if (a === "--help" || a === "-h") { out.help = true; continue; }
    if (a === "--json") { out.json = true; continue; }
    // --flag=value form
    const eq = a.indexOf("=");
    if (a.startsWith("--") && eq > 0) {
      const flag = a.slice(0, eq);
      const value = a.slice(eq + 1);
      if (!VALUE_FLAGS.has(flag)) {
        throw new InstallTuiError("usage", `unknown flag: ${flag}`, { exitCode: EXIT.USAGE });
      }
      applyValueFlag(out, flag, value);
      continue;
    }
    // --flag value form
    if (VALUE_FLAGS.has(a)) {
      const v = argv[++i];
      if (typeof v !== "string") {
        throw new InstallTuiError("usage", `${a} requires a value`, { exitCode: EXIT.USAGE });
      }
      applyValueFlag(out, a, v);
      continue;
    }
    if (a.startsWith("--") || a.startsWith("-")) {
      throw new InstallTuiError("usage", `unknown flag: ${a}`, { exitCode: EXIT.USAGE });
    }
    if (!BOOL_FLAGS.has(a)) {
      throw new InstallTuiError("usage", `unexpected positional argument: ${a}`, { exitCode: EXIT.USAGE });
    }
  }
  return out;
}

/** @param {{pageSize: number, workdirRoot: string}} out @param {string} flag @param {string} value */
function applyValueFlag(out, flag, value) {
  if (flag === "--page-size") {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      throw new InstallTuiError("usage", `--page-size must be an integer 1..100 (got: ${value})`, { exitCode: EXIT.USAGE });
    }
    out.pageSize = n;
    return;
  }
  if (flag === "--workdir-root") {
    if (!value) throw new InstallTuiError("usage", `--workdir-root requires a non-empty value`, { exitCode: EXIT.USAGE });
    out.workdirRoot = value;
    return;
  }
}

function buildHelp() {
  return [
    "Usage: frootai orchard install --interactive [OPTIONS]",
    "",
    "Interactive picker (TUI) for `frootai orchard install --as-play`",
    "when no URL is provided. Browse the harvest free-list, pick a repo,",
    "confirm the output directory.",
    "",
    "Options:",
    "  --page-size <n>      page size for the list (default 10)",
    "  --workdir-root <p>   parent dir for default --out (default tmp/plays)",
    "  --json               emit JSON result to stdout (prompts still on stderr)",
    "  --help, -h           print this help",
    "",
    "Browse prompt accepts: <N>=pick, n=next, p=prev, /query=filter, q=quit",
    "",
    "License: CC0-1.0.",
  ].join("\n");
}

/**
 * Apply a case-insensitive substring filter to a list of `{full_name}`
 * items. Empty query returns the full list. Pure.
 *
 * @param {Array<{full_name: string}>} items
 * @param {string} query
 * @returns {Array<{full_name: string}>}
 */
function filterItems(items, query) {
  if (!Array.isArray(items)) return [];
  const q = typeof query === "string" ? query.trim().toLowerCase() : "";
  if (!q) return items.slice();
  return items.filter((it) => it && typeof it.full_name === "string" && it.full_name.toLowerCase().includes(q));
}

/**
 * Render one page of items as a numbered list. Returns the joined
 * lines (no trailing newline). Indices shown are 1-based and absolute
 * (within the filtered list). Pure.
 *
 * @param {Array<{full_name: string}>} items — already filtered
 * @param {number} page — 0-based
 * @param {number} pageSize
 * @returns {{text: string, page: number, totalPages: number, start: number, end: number}}
 */
function renderPage(items, page, pageSize) {
  const total = Array.isArray(items) ? items.length : 0;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const clampedPage = clampPage(page, totalPages);
  const start = clampedPage * pageSize;
  const end = Math.min(start + pageSize, total);
  const lines = [];
  lines.push(`Free list (${total} entries) — page ${clampedPage + 1}/${totalPages}`);
  if (total === 0) {
    lines.push("  (no entries match the current filter)");
  } else {
    const width = String(end).length;
    for (let i = start; i < end; i++) {
      const it = items[i];
      const num = String(i + 1).padStart(width, " ");
      lines.push(`  [${num}] ${it.full_name}`);
    }
  }
  return { text: lines.join("\n"), page: clampedPage, totalPages, start, end };
}

/** @param {number} page @param {number} totalPages */
function clampPage(page, totalPages) {
  if (!Number.isInteger(page) || page < 0) return 0;
  if (page >= totalPages) return totalPages - 1;
  return page;
}

/**
 * Parse one line of input at the browse prompt. Pure. Returns an
 * action descriptor. The caller maps `{action: "pick", index}` to the
 * confirm step, etc.
 *
 * @param {string|null} line — raw input (null for EOF)
 * @param {number} totalFiltered — total items in current filtered list
 * @returns {{action: "pick", index: number}
 *          | {action: "next"}
 *          | {action: "prev"}
 *          | {action: "filter", query: string}
 *          | {action: "clear-filter"}
 *          | {action: "quit"}
 *          | {action: "error", message: string}}
 */
function parseBrowseInput(line, totalFiltered) {
  if (line === null) return { action: "quit" };
  if (typeof line !== "string") return { action: "error", message: "input must be a string" };
  const s = line.trim();
  if (!s) return { action: "error", message: "empty input — type n, p, /query, <number>, or q" };
  const lower = s.toLowerCase();
  if (lower === "q" || lower === "quit" || lower === "exit") return { action: "quit" };
  if (lower === "n" || lower === "next") return { action: "next" };
  if (lower === "p" || lower === "prev" || lower === "previous") return { action: "prev" };
  if (s === "/") return { action: "clear-filter" };
  if (s.startsWith("/")) return { action: "filter", query: s.slice(1).trim() };
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    const idx = n - 1;
    if (idx < 0 || idx >= totalFiltered) {
      return { action: "error", message: `pick out of range: ${n} (valid 1..${totalFiltered})` };
    }
    return { action: "pick", index: idx };
  }
  return { action: "error", message: `unrecognized input: ${s}` };
}

/**
 * Parse a Y/N confirm answer. Default applies on empty input.
 * Pure.
 *
 * @param {string|null} line
 * @param {"y"|"n"} dflt
 * @returns {boolean|null} — true=yes, false=no, null=EOF/quit
 */
function parseYesNo(line, dflt) {
  if (line === null) return null;
  if (typeof line !== "string") return null;
  const s = line.trim().toLowerCase();
  if (!s) return dflt === "y";
  if (s === "y" || s === "yes") return true;
  if (s === "n" || s === "no") return false;
  return null;
}

/**
 * Derive the default output directory for a picked slug. Mirrors H8.9
 * install.js default: `<workdirRoot>/<slug>`. The "slug" is the last
 * segment of `owner/repo` (i.e. just `repo`). Pure.
 *
 * @param {string} fullName — `owner/repo`
 * @param {string} workdirRoot
 * @returns {string}
 */
function defaultOutDir(fullName, workdirRoot) {
  if (typeof fullName !== "string" || !fullName.includes("/")) {
    throw new InstallTuiError("usage", `defaultOutDir: bad fullName ${fullName}`, { exitCode: EXIT.USAGE });
  }
  const slug = fullName.split("/").pop() || "play";
  const root = workdirRoot || DEFAULT_WORKDIR_ROOT;
  return path.posix.join(root, slug);
}

/**
 * Decide whether the chosen out dir requires an overwrite confirm.
 * Pure (deps injected). Returns true if dir exists AND is non-empty.
 *
 * @param {string} outDir
 * @param {(p: string) => boolean} existsSync
 * @param {(p: string) => string[]} readdirSync
 * @returns {boolean}
 */
function outDirRequiresOverwrite(outDir, existsSync, readdirSync) {
  if (!existsSync(outDir)) return false;
  try {
    const entries = readdirSync(outDir);
    return Array.isArray(entries) && entries.length > 0;
  } catch {
    // Treat unreadable as "needs confirm" — safer default.
    return true;
  }
}

/**
 * Build a header banner for the browse prompt. Pure.
 *
 * @param {string} workdirRoot
 * @returns {string}
 */
function buildBrowseHeader(workdirRoot) {
  return [
    "FrootAI Orchard — interactive install",
    `Pick a repo from the free list (output suggested under ${workdirRoot}/<slug>).`,
    "",
  ].join("\n");
}

/**
 * Build the JSON result payload. Pure. Stable shape.
 *
 * @param {{fullName: string, outDir: string, overwriteConfirmed: boolean}} args
 * @returns {{ok: true, fullName: string, slug: string, outDir: string, overwriteConfirmed: boolean}}
 */
function buildResultPayload(args) {
  const { fullName, outDir, overwriteConfirmed } = args || /** @type {*} */ ({});
  if (typeof fullName !== "string" || !fullName.includes("/")) {
    throw new InstallTuiError("usage", `buildResultPayload: bad fullName ${fullName}`, { exitCode: EXIT.USAGE });
  }
  if (typeof outDir !== "string" || !outDir) {
    throw new InstallTuiError("usage", `buildResultPayload: bad outDir ${outDir}`, { exitCode: EXIT.USAGE });
  }
  const slug = fullName.split("/").pop() || fullName;
  return {
    ok: true,
    fullName,
    slug,
    outDir,
    overwriteConfirmed: Boolean(overwriteConfirmed),
  };
}

/**
 * Default readLine impl wrapping `node:readline/promises`. Returns
 * `null` on close (EOF). Created lazily so test runs never construct
 * a real readline interface.
 *
 * @returns {{question: (prompt: string) => Promise<string|null>, close: () => void}}
 */
function defaultReadlineWrapper() {
  // Lazy require — kept inside the function so dependency injection in
  // tests bypasses node:readline entirely.
  // eslint-disable-next-line global-require
  const readline = require("node:readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  let closed = false;
  return {
    question(prompt) {
      if (closed) return Promise.resolve(/** @type {string|null} */ (null));
      return new Promise((resolve) => {
        rl.question(prompt, (answer) => resolve(answer));
        rl.once("close", () => { closed = true; resolve(null); });
      });
    },
    close() { if (!closed) { closed = true; rl.close(); } },
  };
}

/**
 * Hermetic runner. Returns the sysexits exit code. The full picker
 * flow uses injected deps so tests never touch real stdin/out/err.
 *
 * @param {string[]} argv — everything AFTER `install-tui`
 * @param {object} [ctx]
 * @param {object} [deps]
 * @param {(prompt: string) => Promise<string|null>} [deps.readLine]
 * @param {(text: string) => void} [deps.writeLn]
 * @param {(text: string) => void} [deps.writeErr]
 * @param {() => boolean} [deps.isTTY]
 * @param {(opts?: object) => {ok: boolean, items?: Array<{full_name: string}>, error?: string}} [deps.loadFreeList]
 * @param {(p: string) => boolean} [deps.existsSync]
 * @param {(p: string) => string[]} [deps.readdirSync]
 * @param {NodeJS.ProcessEnv} [deps.env]
 * @returns {Promise<number>}
 */
async function runWithDeps(argv, ctx, deps) {
  const d = deps || {};
  const writeLn = typeof d.writeLn === "function" ? d.writeLn : (s) => { process.stdout.write(String(s) + "\n"); };
  const writeErr = typeof d.writeErr === "function" ? d.writeErr : (s) => { process.stderr.write(String(s) + "\n"); };
  const isTTY = typeof d.isTTY === "function" ? d.isTTY : () => Boolean(process.stdin && process.stdin.isTTY);
  const loadFn = typeof d.loadFreeList === "function" ? d.loadFreeList : freeList.loadFreeList;
  const existsSync = typeof d.existsSync === "function" ? d.existsSync : fs.existsSync;
  const readdirSync = typeof d.readdirSync === "function" ? d.readdirSync : ((p) => fs.readdirSync(p));

  /** @type {{question: (prompt: string) => Promise<string|null>, close?: () => void}} */
  let readlineImpl;
  if (typeof d.readLine === "function") {
    readlineImpl = { question: d.readLine };
  } else {
    readlineImpl = defaultReadlineWrapper();
  }

  let parsed;
  try { parsed = parseInstallTuiArgs(argv); }
  catch (err) {
    const m = err && err.message ? err.message : String(err);
    writeErr(`error: ${m}`);
    writeErr(buildHelp());
    return EXIT.USAGE;
  }
  if (parsed.help) {
    writeLn(buildHelp());
    return EXIT.OK;
  }

  if (!isTTY() && !parsed.json) {
    writeErr("error: refusing to render an interactive TUI to a non-TTY stdin; pass --json to capture the result");
    return EXIT.USAGE;
  }

  const fl = loadFn({});
  if (!fl || !fl.ok) {
    writeErr(`error: ${fl && fl.error ? fl.error : "free list load failed"}`);
    return EXIT.NOINPUT;
  }
  const allItems = Array.isArray(fl.items) ? fl.items : [];

  try {
    writeErr(buildBrowseHeader(parsed.workdirRoot));

    let filter = "";
    let view = filterItems(allItems, filter);
    let page = 0;
    let pickedIndex = /** @type {number|null} */ (null);

    // Browse loop
    while (pickedIndex === null) {
      const rp = renderPage(view, page, parsed.pageSize);
      page = rp.page;
      writeErr(rp.text);
      const line = await readlineImpl.question("> [<N>=pick / n=next / p=prev / /query=filter / q=quit] ");
      const act = parseBrowseInput(line, view.length);
      if (act.action === "quit") {
        writeErr("aborted by user");
        return EXIT.USAGE;
      }
      if (act.action === "error") { writeErr(act.message); continue; }
      if (act.action === "next") { if (page + 1 < rp.totalPages) page += 1; continue; }
      if (act.action === "prev") { if (page > 0) page -= 1; continue; }
      if (act.action === "filter") {
        filter = act.query;
        view = filterItems(allItems, filter);
        page = 0;
        writeErr(`filter: "${filter}" (${view.length} matches)`);
        continue;
      }
      if (act.action === "clear-filter") {
        filter = "";
        view = filterItems(allItems, filter);
        page = 0;
        writeErr("filter cleared");
        continue;
      }
      if (act.action === "pick") {
        const picked = view[act.index];
        const confirm = await readlineImpl.question(`Selected: ${picked.full_name}. Proceed? [Y/n] `);
        const yn = parseYesNo(confirm, "y");
        if (yn === null) { writeErr("aborted by user"); return EXIT.USAGE; }
        if (!yn) { writeErr("changed mind — back to browse"); continue; }
        pickedIndex = act.index;
        break;
      }
    }

    const picked = view[pickedIndex];
    const fullName = picked.full_name;
    const suggested = defaultOutDir(fullName, parsed.workdirRoot);

    const outAns = await readlineImpl.question(`Output directory [${suggested}]: `);
    if (outAns === null) { writeErr("aborted by user"); return EXIT.USAGE; }
    const outDir = outAns.trim() ? outAns.trim() : suggested;

    let overwriteConfirmed = false;
    if (outDirRequiresOverwrite(outDir, existsSync, readdirSync)) {
      const ow = await readlineImpl.question(`Directory ${outDir} exists and is non-empty. Overwrite? [y/N] `);
      const yn = parseYesNo(ow, "n");
      if (yn === null) { writeErr("aborted by user"); return EXIT.USAGE; }
      if (!yn) { writeErr("aborted by user — refusing to overwrite"); return EXIT.USAGE; }
      overwriteConfirmed = true;
    }

    const payload = buildResultPayload({ fullName, outDir, overwriteConfirmed });
    if (parsed.json) {
      writeLn(JSON.stringify(payload));
    } else {
      writeLn(`OK ${payload.slug} -> ${payload.outDir}`);
    }
    return EXIT.OK;
  } catch (err) {
    if (err && typeof err.exitCode === "number") {
      writeErr(`error: ${err.message}`);
      return err.exitCode;
    }
    writeErr(`error: ${err && err.message ? err.message : String(err)}`);
    return EXIT.SOFTWARE;
  } finally {
    if (typeof readlineImpl.close === "function") readlineImpl.close();
  }
}

/**
 * Router-facing default-deps wire.
 * @param {string[]} argv
 * @param {object} [ctx]
 * @returns {Promise<number>}
 */
function run(argv, ctx) { return runWithDeps(argv, ctx, {}); }

module.exports = {
  EXIT,
  DEFAULT_PAGE_SIZE,
  DEFAULT_WORKDIR_ROOT,
  VALUE_FLAGS,
  BOOL_FLAGS,
  InstallTuiError,
  parseInstallTuiArgs,
  buildHelp,
  filterItems,
  renderPage,
  parseBrowseInput,
  parseYesNo,
  defaultOutDir,
  outDirRequiresOverwrite,
  buildBrowseHeader,
  buildResultPayload,
  runWithDeps,
  run,
};
