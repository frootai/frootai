// @ts-check
/**
 * FAI MCP CLI — `frootai mcp list` (M4.3 ship).
 *
 * Renders the operator's current federation pre-attach roster + last
 * health-check snapshot from `~/.frootai/mcp-state.json`. CLI-only view:
 * the runtime `fai_list_attached()` shape requires a live kernel and
 * lives at M4.10/M4.11 (`test`).
 *
 * Behaviour:
 *   - State file absent → empty roster + zero-row table (or `[]` JSON),
 *     exit 0. First-run UX must NOT error.
 *   - Each row column:
 *       name        area name from preAttach OR lastHealthCheck
 *       trust       Tier-1 trust tier resolved via `tier1-trust.js`
 *       attached    "yes" / "no"  (membership in preAttach[])
 *       idle-min    minutes since lastHealthCheck.checkedAt; "—" if never
 *       tool-count  lastHealthCheck.toolCount; "—" if never
 *   - `--json` emits the underlying array (one object per area).
 *
 * Flags:
 *   --json       machine-readable output
 *   --no-color   disable ANSI colour in the text table
 *
 * Deps injection (for tests):
 *   deps.homeDir   override $HOME so we never touch the operator's real
 *                  `~/.frootai/` in unit tests.
 *   deps.now       override `Date.now()` for deterministic idle-min.
 *   deps.log/err   stdout/stderr captures (provided by dispatch.js).
 */
"use strict";

const { readState } = require("../state");
const { resolveTier1Trust } = require("../tier1-trust");
const { color, renderTable } = require("../../orchard/output");

/**
 * Compute the merged roster rows.
 * Pure — no IO. Returns `{ rows: Array<row> }` ordered alphabetically by name.
 *
 * @param {object} state
 * @param {object} [opts]
 * @param {number} [opts.nowMs]
 * @returns {{ rows: Array<{ name: string, trust: string, attached: boolean, idleMinutes: number | null, toolCount: number | null, lastCheckedAt: string | null, lastStatus: string | null }> }}
 */
function buildRows(state, opts) {
  const o = opts || {};
  const nowMs = typeof o.nowMs === "number" ? o.nowMs : Date.now();
  const preAttach = Array.isArray(state && state.preAttach) ? state.preAttach : [];
  const healthChecks = Array.isArray(state && state.lastHealthCheck)
    ? state.lastHealthCheck
    : [];

  /** @type {Map<string, any>} */
  const byName = new Map();
  for (const name of preAttach) {
    if (typeof name !== "string" || !name) continue;
    if (!byName.has(name)) byName.set(name, { name, attached: true });
  }
  for (const entry of healthChecks) {
    if (!entry || typeof entry.area !== "string" || !entry.area) continue;
    const existing = byName.get(entry.area) || { name: entry.area, attached: false };
    existing.lastStatus = typeof entry.status === "string" ? entry.status : null;
    existing.lastCheckedAt = typeof entry.checkedAt === "string" ? entry.checkedAt : null;
    existing.toolCount = typeof entry.toolCount === "number" ? entry.toolCount : null;
    if (existing.lastCheckedAt) {
      const checkedMs = Date.parse(existing.lastCheckedAt);
      existing.idleMinutes = Number.isFinite(checkedMs)
        ? Math.max(0, Math.floor((nowMs - checkedMs) / 60000))
        : null;
    } else {
      existing.idleMinutes = null;
    }
    byName.set(entry.area, existing);
  }
  // Mark trust + ensure every row has both keys.
  for (const row of byName.values()) {
    row.attached = Boolean(row.attached);
    if (typeof row.idleMinutes !== "number" && row.idleMinutes !== null) row.idleMinutes = null;
    if (typeof row.toolCount !== "number" && row.toolCount !== null) row.toolCount = null;
    if (!("lastStatus" in row)) row.lastStatus = null;
    if (!("lastCheckedAt" in row)) row.lastCheckedAt = null;
    row.trust = resolveTier1Trust(row.name);
  }
  const rows = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { rows };
}

function _renderTextTable(rows, opts) {
  const o = opts || {};
  if (rows.length === 0) {
    return [
      "",
      color("dim", "  No attached areas configured.", o),
      color("dim", "  Run `frootai mcp attach <name>` to pre-attach a Tier-1 area,", o),
      color("dim", "  or `frootai mcp discover` to browse the catalog.", o),
      "",
    ].join("\n");
  }
  const tableRows = rows.map((r) => ({
    name: r.name,
    trust: r.trust,
    attached: r.attached ? "yes" : "no",
    idle: r.idleMinutes == null ? "—" : `${r.idleMinutes}m`,
    tools: r.toolCount == null ? "—" : String(r.toolCount),
  }));
  return [
    "",
    color("bold", `  Attached federated areas: ${rows.length}`, o),
    "",
    renderTable(tableRows, [
      { key: "name",     label: "NAME",       width: 14 },
      { key: "trust",    label: "TRUST",      width: 22 },
      { key: "attached", label: "ATTACHED",   width: 10 },
      { key: "idle",     label: "IDLE",       width: 8 },
      { key: "tools",    label: "TOOL-COUNT", width: 12 },
    ], o),
    "",
  ].join("\n");
}

/**
 * Dispatcher-compatible exec entry.
 *
 * @param {object} args   parsed argv (output of `arg-parser.parseArgs`)
 * @param {object} [deps] injection hooks
 * @returns {Promise<{exitCode: number, output: string}>}
 */
async function execList(args, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));

  const state = readState(d);
  const { rows } = buildRows(state, { nowMs: typeof d.now === "function" ? d.now() : undefined });

  if (args && args.json) {
    const json = JSON.stringify(rows);
    log(json);
    return { exitCode: 0, output: json };
  }

  const out = _renderTextTable(rows, { color: !(args && args["no-color"]) });
  log(out);
  return { exitCode: 0, output: out };
}

module.exports = { execList, buildRows };
