// @ts-check
/**
 * [H8.26] progress.js — verbose progress reporter for long-running orchard
 * subcommands.
 *
 * Contract (verbatim from masterplan §3 row [H8.26]):
 *   Verbose progress: every long-running subcommand emits per-stage
 *   progress (Spinner + ETA) when stdout is a TTY; pure JSON otherwise
 *
 * Top-level group `progress/` parallels `completions/` (H8.24) per
 * H8.x group-per-domain doctrine. Library lives at
 * `cli/commands/progress/progress.js` so the bin-reconciliation
 * sub-phase can wire it into every long-running handler via
 * `deps.progress = createReporter({...})` WITHOUT changing the
 * existing 1839 H8.x tests. This file ships ONLY the library +
 * `runWithDeps(args, ctx, deps)` + `run(args, ctx)` demo runner
 * (drives a fake pipeline for documentation / smoke purposes).
 *
 * **Dual mode** (the masterplan's "Spinner + ETA on TTY; pure JSON
 * otherwise"):
 *   - tty mode  — animated spinner frame + stage label + elapsed +
 *                  ETA on a single \r-overwritten line on stderr.
 *                  Final state replaces the line with a checkmark + the
 *                  stage label. Stdout untouched.
 *   - json mode — one NDJSON event per state transition on stderr,
 *                  each `{ts, event, stage?, ok?, error?, elapsedMs,
 *                  etaMs?}`. Stdout untouched. Safe for piping into
 *                  log aggregators.
 *   - Auto-detection: `mode === "auto"` (default) picks `tty` when
 *                  `isTTY()===true` AND `--no-progress` NOT set;
 *                  otherwise `json`. Force with `mode: "tty"` /
 *                  `"json"` / `"silent"`.
 *
 * **Reporter API** (returned by `createReporter`):
 *   reporter.start(stage, opts?)   — begin a stage; record startMs
 *   reporter.update(stage, opts?)  — re-render the current frame
 *                                     (spinner advance, ETA recompute)
 *   reporter.succeed(stage, opts?) — mark stage complete; OK
 *   reporter.fail(stage, opts?)    — mark stage failed; carries error
 *   reporter.skip(stage, opts?)    — mark stage skipped (--no-retrieve)
 *   reporter.note(msg)             — interleave a one-line note
 *                                     (tty: writes above the spinner;
 *                                      json: emits `{event:"note", msg}`)
 *   reporter.done(summary?)        — flush + cleanup (stop spinner
 *                                     timer if any); idempotent
 *   reporter.toSummary()           — pure: returns `{totalMs, stages:
 *                                     [{stage, status, durationMs}...]}`
 *                                     for the caller to JSON-stringify
 *                                     at end-of-run
 *
 * **Spinner frames**: 10 unicode braille frames (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`) — the
 * de-facto standard from ora; falls back to ASCII (`|/-\`) when
 * `useUnicode === false` (Windows legacy console / `TERM=dumb` / CI).
 *
 * **ETA model**: estimate-from-prior-stage-durations. When we've seen
 * K of N stages complete, ETA(remaining) = (totalElapsed / K) * (N - K).
 * For the FIRST stage (K=0), ETA is `null` (we print `--` in tty mode).
 * `weights[stageName]` may be supplied to scale per-stage durations
 * unevenly (e.g. scaffold weighs 3x extract); default all weights = 1.
 *
 * **Animation timer**: in tty mode, the reporter sets a 100ms interval
 * via the injected `setInterval`/`clearInterval` to re-render the
 * spinner frame. Hermetic tests inject controllable scheduler
 * stubs so the interval never actually fires.
 *
 * **Stage roster** — frozen list mirroring the H8.9 install.js pipeline
 * (and re-usable for any subset): `discover` → `fetch` → `extract` →
 * `retrieve` → `scaffold` → `compose-infra` → `validate` → `write`.
 * Callers may pass any subset/order via `createReporter({stages})`.
 *
 * **Subcommand argv grammar** (`frootai progress demo [OPTIONS]` —
 * `demo` is the only subcommand; runs a fake pipeline w/ 4 stages):
 *   --mode <tty|json|silent|auto>  force reporter mode (default auto)
 *   --no-progress                  alias for --mode silent
 *   --no-unicode                   force ASCII spinner frames
 *   --stages <comma-list>          override the demo's 4-stage roster
 *   --interval-ms <n>              spinner re-render interval (default 100)
 *   --json                         emit final summary as JSON to stdout
 *                                   (NDJSON progress events still on stderr)
 *   --help, -h                     print help + exit OK
 *
 * **Exit codes**:
 *   0    OK             — demo ran to completion
 *   64   USAGE          — bad flags / unknown mode
 *   70   SOFTWARE       — unexpected internal error
 *
 * **Non-goals for THIS ship**:
 *   - Wiring `deps.progress` into H8.2..H8.12 stage handlers (deferred
 *     to bin-reconciliation; would risk the 873 existing tests).
 *   - Coloured output (kept ANSI-less in tty mode beyond \r + spinner
 *     frames; full theming is out of scope).
 *   - Multi-line progress for nested pipelines (one active spinner at
 *     a time; nested stages render as inline notes).
 *
 * License: CC0-1.0.
 */
"use strict";

const EXIT = Object.freeze({
  OK: 0,
  USAGE: 64,
  SOFTWARE: 70,
});

const MODES = Object.freeze(["tty", "json", "silent", "auto"]);

const SPINNER_FRAMES_UNICODE = Object.freeze([
  "\u280B", "\u2819", "\u2839", "\u2838",
  "\u283C", "\u2834", "\u2826", "\u2827",
  "\u2807", "\u280F",
]);
const SPINNER_FRAMES_ASCII = Object.freeze(["|", "/", "-", "\\"]);

const DEFAULT_INTERVAL_MS = 100;

const STAGE_ROSTER = Object.freeze([
  "discover", "fetch", "extract", "retrieve",
  "scaffold", "compose-infra", "validate", "write",
]);

const STATUS = Object.freeze({
  PENDING: "pending",
  RUNNING: "running",
  OK: "ok",
  FAIL: "fail",
  SKIP: "skip",
});

const VALUE_FLAGS = new Set([
  "--mode",
  "--stages",
  "--interval-ms",
]);

const BOOL_FLAGS = new Set([
  "--no-progress",
  "--no-unicode",
  "--json",
  "--help",
  "-h",
]);

class ProgressError extends Error {
  /** @param {string} code @param {string} message @param {{exitCode?: number, cause?: Error}} [opts] */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "ProgressError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Parse argv for the `progress demo` subcommand.
 *
 * @param {string[]} argv
 * @returns {{mode: string, stages: string[]|null, intervalMs: number, useUnicode: boolean, json: boolean, help: boolean}}
 */
function parseProgressArgs(argv) {
  if (!Array.isArray(argv)) throw new TypeError("parseProgressArgs: argv must be an array");
  const out = {
    mode: "auto",
    stages: /** @type {string[]|null} */ (null),
    intervalMs: DEFAULT_INTERVAL_MS,
    useUnicode: true,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (typeof a !== "string") throw new ProgressError("usage", `argv[${i}] must be a string`, { exitCode: EXIT.USAGE });
    if (a === "--help" || a === "-h") { out.help = true; continue; }
    if (a === "--json") { out.json = true; continue; }
    if (a === "--no-progress") { out.mode = "silent"; continue; }
    if (a === "--no-unicode") { out.useUnicode = false; continue; }
    const eq = a.indexOf("=");
    if (a.startsWith("--") && eq > 0) {
      const flag = a.slice(0, eq);
      const value = a.slice(eq + 1);
      if (!VALUE_FLAGS.has(flag)) {
        throw new ProgressError("usage", `unknown flag: ${flag}`, { exitCode: EXIT.USAGE });
      }
      applyValueFlag(out, flag, value);
      continue;
    }
    if (VALUE_FLAGS.has(a)) {
      const v = argv[++i];
      if (typeof v !== "string") throw new ProgressError("usage", `${a} requires a value`, { exitCode: EXIT.USAGE });
      applyValueFlag(out, a, v);
      continue;
    }
    if (a.startsWith("-")) throw new ProgressError("usage", `unknown flag: ${a}`, { exitCode: EXIT.USAGE });
    if (!BOOL_FLAGS.has(a)) throw new ProgressError("usage", `unexpected positional argument: ${a}`, { exitCode: EXIT.USAGE });
  }
  return out;
}

/** @param {*} out @param {string} flag @param {string} value */
function applyValueFlag(out, flag, value) {
  if (flag === "--mode") {
    if (!MODES.includes(value)) {
      throw new ProgressError("usage", `--mode must be one of ${MODES.join("|")} (got: ${value})`, { exitCode: EXIT.USAGE });
    }
    out.mode = value;
    return;
  }
  if (flag === "--stages") {
    const list = value.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) throw new ProgressError("usage", `--stages must be a non-empty comma-list`, { exitCode: EXIT.USAGE });
    out.stages = list;
    return;
  }
  if (flag === "--interval-ms") {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 10 || n > 10000) {
      throw new ProgressError("usage", `--interval-ms must be 10..10000 (got: ${value})`, { exitCode: EXIT.USAGE });
    }
    out.intervalMs = n;
    return;
  }
}

function buildHelp() {
  return [
    "Usage: frootai progress demo [OPTIONS]",
    "",
    "Drive a fake 4-stage pipeline and emit progress (spinner+ETA on TTY,",
    "NDJSON on non-TTY). For documentation + smoke-test purposes.",
    "",
    "Options:",
    "  --mode <tty|json|silent|auto>   force reporter mode (default auto)",
    "  --no-progress                   alias for --mode silent",
    "  --no-unicode                    force ASCII spinner frames",
    "  --stages <comma-list>           override the demo's 4-stage roster",
    "  --interval-ms <n>               spinner re-render interval (default 100)",
    "  --json                          emit final summary JSON to stdout",
    "  --help, -h                      print this help",
    "",
    "License: CC0-1.0.",
  ].join("\n");
}

/**
 * Resolve the effective mode given parsed flags + tty detection. Pure.
 *
 * @param {string} mode — `tty`/`json`/`silent`/`auto`
 * @param {boolean} isTTY
 * @returns {"tty"|"json"|"silent"}
 */
function resolveMode(mode, isTTY) {
  if (mode === "tty" || mode === "json" || mode === "silent") return mode;
  return isTTY ? "tty" : "json";
}

/**
 * Pure ms→`HHh MMm SSs` (or `MMm SSs` or `SSs`) formatter. Used in
 * the spinner line + summary JSON. Negative or NaN ms → `--`.
 *
 * @param {number|null|undefined} ms
 * @returns {string}
 */
function formatDuration(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return "--";
  const totalSec = Math.floor(ms / 1000);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const pad = (n) => String(n).padStart(2, "0");
  if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`;
  if (m > 0) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}

/**
 * Estimate remaining-ms ETA from completed-stage durations. Pure.
 *
 * Algorithm:
 *   - completedCount === 0 → null (insufficient data)
 *   - per-stage avg = sum(completed.durationMs) / sum(completed.weight)
 *   - remaining = sum(remainingStages.weight) * per-stage avg
 *
 * @param {Array<{stage: string, durationMs: number}>} completed
 * @param {Array<string>} remainingStages
 * @param {Record<string, number>} [weights]
 * @returns {number|null}
 */
function estimateEtaMs(completed, remainingStages, weights) {
  if (!Array.isArray(completed) || completed.length === 0) return null;
  if (!Array.isArray(remainingStages) || remainingStages.length === 0) return 0;
  const w = weights || {};
  const wOf = (s) => (typeof w[s] === "number" && w[s] > 0 ? w[s] : 1);
  let sumDur = 0;
  let sumW = 0;
  for (const c of completed) {
    if (!c || typeof c.durationMs !== "number") continue;
    sumDur += c.durationMs;
    sumW += wOf(c.stage);
  }
  if (sumW <= 0) return null;
  const perUnit = sumDur / sumW;
  let remW = 0;
  for (const s of remainingStages) remW += wOf(s);
  return Math.max(0, Math.round(perUnit * remW));
}

/**
 * Render one tty spinner line. Pure. NO trailing newline; caller
 * controls `\r` and the eventual final `\n`.
 *
 * @param {object} args
 * @param {string} args.frame — one spinner glyph
 * @param {string} args.stage — current stage label
 * @param {number} args.elapsedMs
 * @param {number|null} args.etaMs
 * @param {number} args.completedCount
 * @param {number} args.totalCount
 * @returns {string}
 */
function renderTtyLine(args) {
  const { frame, stage, elapsedMs, etaMs, completedCount, totalCount } = args || /** @type {*} */ ({});
  const elapsed = formatDuration(elapsedMs);
  const eta = etaMs == null ? "--" : `~${formatDuration(etaMs)}`;
  return `${frame} [${completedCount}/${totalCount}] ${stage}  (${elapsed} elapsed; ETA ${eta})`;
}

/**
 * Build one NDJSON progress event. Pure. Returns the
 * JSON.stringify'd line (no trailing newline; caller adds it).
 *
 * @param {object} args
 * @param {string} args.event — start/update/succeed/fail/skip/note/done
 * @param {string} [args.stage]
 * @param {boolean} [args.ok]
 * @param {string} [args.error]
 * @param {string} [args.msg]
 * @param {number} args.elapsedMs
 * @param {number|null} [args.etaMs]
 * @param {number} args.ts — ms since epoch
 * @returns {string}
 */
function buildJsonEvent(args) {
  const { event, stage, ok, error, msg, elapsedMs, etaMs, ts } = args || /** @type {*} */ ({});
  const out = { ts, event, elapsedMs };
  if (stage !== undefined) out.stage = stage;
  if (ok !== undefined) out.ok = ok;
  if (error !== undefined) out.error = error;
  if (msg !== undefined) out.msg = msg;
  if (etaMs !== undefined) out.etaMs = etaMs;
  return JSON.stringify(out);
}

/**
 * Build the final-summary payload from the reporter's internal state.
 * Pure. Stable shape for downstream tooling.
 *
 * @param {object} args
 * @param {number} args.startedAt
 * @param {number} args.now
 * @param {Array<{stage: string, status: string, startedAt?: number, finishedAt?: number, error?: string}>} args.stages
 * @returns {{startedAt: number, finishedAt: number, totalMs: number, stages: Array<{stage: string, status: string, durationMs: number, error?: string}>}}
 */
function buildSummaryPayload(args) {
  const { startedAt, now, stages } = args || /** @type {*} */ ({});
  const outStages = (Array.isArray(stages) ? stages : []).map((s) => {
    const dur = (typeof s.finishedAt === "number" && typeof s.startedAt === "number")
      ? Math.max(0, s.finishedAt - s.startedAt)
      : 0;
    /** @type {*} */
    const e = { stage: s.stage, status: s.status, durationMs: dur };
    if (s.error) e.error = s.error;
    return e;
  });
  return {
    startedAt,
    finishedAt: now,
    totalMs: Math.max(0, now - startedAt),
    stages: outStages,
  };
}

/**
 * Create a stateful reporter instance. Fully injectable for tests:
 * `{now, write, setInterval, clearInterval, isTTY, frames, useUnicode}`.
 *
 * The reporter does NOT touch real stderr/stdout unless `write` is
 * omitted. Tests pass a writer that records lines.
 *
 * @param {object} opts
 * @param {string[]} opts.stages — pipeline stage roster (e.g. STAGE_ROSTER)
 * @param {string} [opts.mode] — `tty`/`json`/`silent`/`auto` (default auto)
 * @param {boolean} [opts.useUnicode] — default true
 * @param {Record<string, number>} [opts.weights] — per-stage weight
 * @param {number} [opts.intervalMs] — spinner re-render interval (default 100)
 * @param {object} [deps]
 * @param {() => number} [deps.now]
 * @param {(s: string) => void} [deps.write] — writes to stderr by default
 * @param {(fn: () => void, ms: number) => *} [deps.setInterval]
 * @param {(handle: *) => void} [deps.clearInterval]
 * @param {() => boolean} [deps.isTTY]
 * @returns {object}
 */
function createReporter(opts, deps) {
  if (!opts || !Array.isArray(opts.stages) || opts.stages.length === 0) {
    throw new ProgressError("usage", "createReporter: opts.stages must be a non-empty array", { exitCode: EXIT.USAGE });
  }
  const d = deps || {};
  const now = typeof d.now === "function" ? d.now : () => Date.now();
  const write = typeof d.write === "function" ? d.write : (s) => { process.stderr.write(s); };
  const setInt = typeof d.setInterval === "function" ? d.setInterval : (fn, ms) => setInterval(fn, ms);
  const clearInt = typeof d.clearInterval === "function" ? d.clearInterval : (h) => clearInterval(h);
  const isTTY = typeof d.isTTY === "function" ? d.isTTY : () => Boolean(process.stderr && process.stderr.isTTY);

  const mode = resolveMode(opts.mode || "auto", isTTY());
  const useUnicode = opts.useUnicode === false ? false : true;
  const frames = useUnicode ? SPINNER_FRAMES_UNICODE : SPINNER_FRAMES_ASCII;
  const weights = opts.weights || {};
  const intervalMs = Number.isInteger(opts.intervalMs) && opts.intervalMs > 0 ? opts.intervalMs : DEFAULT_INTERVAL_MS;

  const startedAt = now();
  /** @type {Array<{stage: string, status: string, startedAt?: number, finishedAt?: number, error?: string}>} */
  const stagesState = opts.stages.map((s) => ({ stage: s, status: STATUS.PENDING }));
  let frameIdx = 0;
  let activeStage = /** @type {string|null} */ (null);
  let timerHandle = /** @type {*} */ (null);
  let lineActive = false;
  let done = false;

  function emitJson(event, extra) {
    const ts = now();
    const elapsedMs = ts - startedAt;
    const line = buildJsonEvent(Object.assign({ event, ts, elapsedMs }, extra || {}));
    write(line + "\n");
  }

  function findState(stage) {
    return stagesState.find((s) => s.stage === stage);
  }

  function completedDurations() {
    return stagesState
      .filter((s) => s.status === STATUS.OK || s.status === STATUS.SKIP || s.status === STATUS.FAIL)
      .filter((s) => typeof s.startedAt === "number" && typeof s.finishedAt === "number")
      .map((s) => ({ stage: s.stage, durationMs: (s.finishedAt || 0) - (s.startedAt || 0) }));
  }

  function remainingStageNames() {
    return stagesState.filter((s) => s.status === STATUS.PENDING || s.status === STATUS.RUNNING).map((s) => s.stage);
  }

  function eraseLine() {
    if (lineActive) {
      write("\r\u001b[K");
      lineActive = false;
    }
  }

  function renderFrame() {
    if (mode !== "tty") return;
    if (!activeStage) return;
    eraseLine();
    const completed = completedDurations();
    const remaining = remainingStageNames();
    const etaMs = estimateEtaMs(completed, remaining, weights);
    const elapsedMs = now() - startedAt;
    const line = renderTtyLine({
      frame: frames[frameIdx % frames.length],
      stage: activeStage,
      elapsedMs,
      etaMs,
      completedCount: completed.length,
      totalCount: stagesState.length,
    });
    write("\r" + line);
    lineActive = true;
    frameIdx += 1;
  }

  function startTimer() {
    if (mode !== "tty") return;
    if (timerHandle) return;
    timerHandle = setInt(renderFrame, intervalMs);
  }

  function stopTimer() {
    if (timerHandle) {
      clearInt(timerHandle);
      timerHandle = null;
    }
  }

  function finalLineForStage(s) {
    const checkmark = useUnicode
      ? (s.status === STATUS.OK ? "\u2713" : s.status === STATUS.FAIL ? "\u2717" : s.status === STATUS.SKIP ? "\u2298" : "?")
      : (s.status === STATUS.OK ? "OK" : s.status === STATUS.FAIL ? "X" : s.status === STATUS.SKIP ? "-" : "?");
    const dur = (typeof s.finishedAt === "number" && typeof s.startedAt === "number")
      ? formatDuration(s.finishedAt - s.startedAt) : "--";
    return `${checkmark} ${s.stage} (${dur})${s.error ? ` — ${s.error}` : ""}`;
  }

  return {
    mode,
    useUnicode,

    /**
     * @param {string} stage @param {{etaHintMs?: number}} [opts2]
     */
    start(stage, opts2) {
      const st = findState(stage);
      if (!st) throw new ProgressError("usage", `unknown stage: ${stage}`, { exitCode: EXIT.USAGE });
      st.status = STATUS.RUNNING;
      st.startedAt = now();
      activeStage = stage;
      if (mode === "json") {
        emitJson("start", { stage });
      } else if (mode === "tty") {
        startTimer();
        renderFrame();
      }
      void opts2;
    },

    update(stage) {
      if (mode === "tty") renderFrame();
      else if (mode === "json") {
        const elapsedMs = now() - startedAt;
        const etaMs = estimateEtaMs(completedDurations(), remainingStageNames(), weights);
        emitJson("update", { stage: stage || activeStage, etaMs });
      }
    },

    /** @param {string} stage */
    succeed(stage) {
      const st = findState(stage);
      if (!st) throw new ProgressError("usage", `unknown stage: ${stage}`, { exitCode: EXIT.USAGE });
      st.status = STATUS.OK;
      st.finishedAt = now();
      if (mode === "tty") {
        eraseLine();
        write(finalLineForStage(st) + "\n");
        if (activeStage === stage) activeStage = null;
      } else if (mode === "json") {
        emitJson("succeed", { stage, ok: true });
      }
    },

    /** @param {string} stage @param {{error?: string}} [opts2] */
    fail(stage, opts2) {
      const st = findState(stage);
      if (!st) throw new ProgressError("usage", `unknown stage: ${stage}`, { exitCode: EXIT.USAGE });
      st.status = STATUS.FAIL;
      st.finishedAt = now();
      st.error = opts2 && opts2.error ? String(opts2.error) : undefined;
      if (mode === "tty") {
        eraseLine();
        write(finalLineForStage(st) + "\n");
        if (activeStage === stage) activeStage = null;
      } else if (mode === "json") {
        emitJson("fail", { stage, ok: false, error: st.error });
      }
    },

    /** @param {string} stage */
    skip(stage) {
      const st = findState(stage);
      if (!st) throw new ProgressError("usage", `unknown stage: ${stage}`, { exitCode: EXIT.USAGE });
      st.status = STATUS.SKIP;
      st.startedAt = st.startedAt || now();
      st.finishedAt = now();
      if (mode === "tty") {
        eraseLine();
        write(finalLineForStage(st) + "\n");
        if (activeStage === stage) activeStage = null;
      } else if (mode === "json") {
        emitJson("skip", { stage });
      }
    },

    /** @param {string} msg */
    note(msg) {
      if (mode === "silent") return;
      const text = String(msg == null ? "" : msg);
      if (mode === "tty") {
        eraseLine();
        write(text + "\n");
        if (activeStage) renderFrame();
      } else if (mode === "json") {
        emitJson("note", { msg: text });
      }
    },

    done() {
      if (done) return;
      done = true;
      stopTimer();
      if (mode === "tty") {
        eraseLine();
      } else if (mode === "json") {
        emitJson("done", {});
      }
    },

    toSummary() {
      return buildSummaryPayload({ startedAt, now: now(), stages: stagesState });
    },

    _state: { stagesState, get activeStage() { return activeStage; }, get done() { return done; } },
  };
}

/**
 * Demo runner: spins through a 4-stage fake pipeline with hard-coded
 * (but injectable) per-stage durations. Used as a smoke target + the
 * exit-code surface for `frootai progress demo`.
 *
 * @param {string[]} argv
 * @param {object} [ctx]
 * @param {object} [deps]
 * @param {(opts: object, deps: object) => object} [deps.createReporter]
 * @param {(s: string) => void} [deps.write]
 * @param {(s: string) => void} [deps.writeLn] — stdout writer (final summary)
 * @param {() => boolean} [deps.isTTY]
 * @param {(ms: number) => Promise<void>} [deps.sleep] — between stages
 * @param {() => number} [deps.now]
 * @returns {Promise<number>}
 */
async function runWithDeps(argv, ctx, deps) {
  const d = deps || {};
  const writeErr = typeof d.write === "function" ? d.write : (s) => { process.stderr.write(s); };
  const writeLn = typeof d.writeLn === "function" ? d.writeLn : (s) => { process.stdout.write(String(s) + "\n"); };
  const isTTY = typeof d.isTTY === "function" ? d.isTTY : () => Boolean(process.stderr && process.stderr.isTTY);
  const sleep = typeof d.sleep === "function" ? d.sleep : ((/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms)));
  const factory = typeof d.createReporter === "function" ? d.createReporter : createReporter;

  let parsed;
  try { parsed = parseProgressArgs(argv); }
  catch (err) {
    const m = err && err.message ? err.message : String(err);
    writeErr(`error: ${m}\n`);
    writeErr(buildHelp() + "\n");
    return EXIT.USAGE;
  }
  if (parsed.help) {
    writeLn(buildHelp());
    return EXIT.OK;
  }
  const stages = parsed.stages || ["discover", "fetch", "extract", "scaffold"];
  const reporter = factory({
    stages,
    mode: parsed.mode,
    useUnicode: parsed.useUnicode,
    intervalMs: parsed.intervalMs,
  }, {
    isTTY,
    write: writeErr,
    now: d.now,
  });

  try {
    for (const s of stages) {
      reporter.start(s);
      await sleep(10);
      reporter.succeed(s);
    }
    reporter.done();
    if (parsed.json) {
      writeLn(JSON.stringify(reporter.toSummary()));
    }
    return EXIT.OK;
  } catch (err) {
    reporter.done();
    writeErr(`error: ${err && err.message ? err.message : String(err)}\n`);
    return err && typeof err.exitCode === "number" ? err.exitCode : EXIT.SOFTWARE;
  }
}

function run(argv, ctx) { return runWithDeps(argv, ctx, {}); }

module.exports = {
  EXIT,
  MODES,
  STATUS,
  STAGE_ROSTER,
  SPINNER_FRAMES_UNICODE,
  SPINNER_FRAMES_ASCII,
  DEFAULT_INTERVAL_MS,
  VALUE_FLAGS,
  BOOL_FLAGS,
  ProgressError,
  parseProgressArgs,
  buildHelp,
  resolveMode,
  formatDuration,
  estimateEtaMs,
  renderTtyLine,
  buildJsonEvent,
  buildSummaryPayload,
  createReporter,
  runWithDeps,
  run,
};
