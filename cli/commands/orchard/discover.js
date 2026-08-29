// @ts-check
/**
 * [H8.2] discover.js — `frootai orchard discover <url>` handler.
 *
 * Contract (verbatim from masterplan §3 row [H8.2]):
 *   `frootai orchard discover <url> [--no-cache] [--json]` wired to [H1]
 *   library.
 *
 * This is a THIN ADAPTER that bridges the H8.1 router's handler contract
 * (`run(args, ctx) → number|Promise<number>`) to the H1.19 discover-cli's
 * `main(argv, hostOpts)`. The adapter:
 *
 *   1. Threads the router's global `--json` flag into the discover argv so
 *      the upstream module respects it (the discover-cli parses its own
 *      `--json` independently).
 *   2. Maps the router's `ctx.stdout` / `ctx.stderr` sinks into the
 *      discover-cli `hostOpts.stdout` / `hostOpts.stderr` shape.
 *   3. Builds a GitHub transport from `GH_TOKEN_1/2/3` env vars using the
 *      same `TokenPool` the standalone discover-cli uses.
 *   4. Passes the verbatim `rest` from the router (everything the user typed
 *      AFTER `discover`) through untouched so discover-cli owns its own flag
 *      grammar (`--no-cache`, `--cache-dir`, `--verbose`, `--subpath`,
 *      `--seed-list`, etc.).
 *
 * The handler MUST NOT duplicate discover-cli logic (flag parsing, output
 * formatting, error mapping) — it delegates entirely. All the adapter owns
 * is the transport-build at the process boundary + the sink bridge.
 *
 * Handler contract (from H8.1 index.js):
 *   `run(args: string[], ctx: { json, quiet, verbose, stdout, stderr,
 *     version, subcommand }) → number | Promise<number>`
 *
 * Exit codes flow through from discover-cli unchanged (sysexits 0/64/65/
 * 69/70/77).
 *
 * Non-goals for THIS ship (explicit):
 *   - Auth / entitlement gating — discover is FREE; no sign-in required.
 *   - Telemetry emission — deferred to H8.16 wiring; the discover-cli
 *     already has its own telemetry hooks via `opts.logger`.
 *   - Touching the standalone discover-cli invocation path — that stays
 *     intact so `node scripts/harvest/lib/discover/discover-cli.js` still
 *     works.
 *
 * License: CC0-1.0.
 */
"use strict";

const path = require("node:path");

/**
 * Resolve the path to the H1 discover-cli module relative to THIS file.
 * @returns {string}
 */
function discoverCliPath() {
  return path.resolve(
    __dirname, "..", "..", "..", "scripts", "harvest", "lib", "discover", "discover-cli.js"
  );
}

/**
 * Build a GitHub REST+GraphQL transport from env-var PATs using the same
 * `TokenPool` that the standalone discover-cli uses. Returns `null` when no
 * tokens are configured (the upstream discover-cli will surface a clean
 * "no transport configured" error in that case).
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {object | null}
 */
function buildTransport(env) {
  const e = env || process.env;
  try {
    const { TokenPool } = require(
      path.resolve(__dirname, "..", "..", "..", "scripts", "harvest", "lib", "discover", "token-pool.js")
    );
    // TokenPool expects [{ id, value }, ...] — convert env strings into the
    // required shape; the id is just a stable label per slot.
    const tokens = [
      { id: "GH_TOKEN_1", value: e.GH_TOKEN_1 },
      { id: "GH_TOKEN_2", value: e.GH_TOKEN_2 },
      { id: "GH_TOKEN_3", value: e.GH_TOKEN_3 },
    ].filter((t) => typeof t.value === "string" && t.value.length > 0);
    if (tokens.length === 0) return null;
    return new TokenPool({ tokens });
  } catch {
    return null;
  }
}

/**
 * Write a string to a sink that may be `(s: string) => void` or
 * `{ write: (s: string) => void }`.
 * @param {any} sink
 * @returns {(s: string) => void}
 */
function asFn(sink) {
  if (typeof sink === "function") return sink;
  if (sink && typeof sink.write === "function") return (s) => sink.write(s);
  return () => {};
}

/**
 * Handler entry-point invoked by the H8.1 router.
 *
 * @param {string[]} args  — verbatim argv tail AFTER `discover`
 *   (e.g. `["owner/repo", "--no-cache"]`).
 * @param {object} ctx     — router context.
 * @param {boolean} ctx.json
 * @param {boolean} ctx.quiet
 * @param {boolean} ctx.verbose
 * @param {any}     ctx.stdout
 * @param {any}     ctx.stderr
 * @param {string}  ctx.version
 * @param {string}  ctx.subcommand
 * @returns {Promise<number>}
 */
async function run(args, ctx) {
  // Lazy-require the H1 discover-cli so this module doesn't pay the import
  // cost when other subcommands run.
  const discoverCli = require(discoverCliPath());

  // Thread the router's global --json into the discover argv if it's not
  // already present (the user may have typed `frootai orchard --json discover …`
  // at the router level, OR `frootai orchard discover … --json` at the
  // discover level — both must work).
  const argv = [...args];
  if (ctx.json && !argv.includes("--json")) {
    argv.unshift("--json");
  }
  // Same for --verbose (short -v already handled by discover-cli).
  if (ctx.verbose && !argv.includes("--verbose") && !argv.includes("-v")) {
    argv.unshift("--verbose");
  }

  const transport = buildTransport();

  return discoverCli.main(argv, {
    transport,
    stdout: asFn(ctx.stdout),
    stderr: asFn(ctx.stderr),
  });
}

module.exports = { run, buildTransport, discoverCliPath };
