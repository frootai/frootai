// @ts-check
/**
 * M5.19 — Federation status bar item (pure core).
 *
 * Row literal: status bar item: shows currently attached count +
 * idle-disconnect-warning amber when any area is < 1 min from
 * idle-timeout.
 *
 * Pure: zero `vscode` imports + zero IO. Given an attached-area list
 * + the configured `idleDisconnectMinutes` from M5.1 settings, computes
 * a frozen `StatusBarState` descriptor the .ts wrapper applies to a
 * `vscode.StatusBarItem`.
 *
 * Decisions:
 *   - The status bar item ALWAYS renders, even at count=0 — operators
 *     need a single fixed glance-target to know whether federation is
 *     active. Hiding at 0 would force them to remember "is the
 *     extension loaded?" vs "are areas attached?". Color "none" maps
 *     to the default theme color so 0-state is visually quiet.
 *   - Warning fires when `(idleDisconnectMinutes - idleMinutes) <
 *     IDLE_WARNING_THRESHOLD_MIN` (i.e. the area has < 1 minute of
 *     idle slack remaining). When `idleMinutes > idleDisconnectMinutes`
 *     (kernel hasn't disconnected yet for some reason), STILL warn —
 *     "imminent" is closer to "already-passed" than to "fine".
 *   - Areas with missing / NaN / negative `idleMinutes` do NOT warn —
 *     no data means no warning. A missing-data warning would fire
 *     constantly under the M5.4 PIN_ONE_AHEAD stub (which returns
 *     empty data) and habituate operators to ignore it.
 *   - The icon flips from `$(plug)` (default) to `$(warning)` only
 *     when `color === "warning"` so the amber background + icon are
 *     correlated. A status bar item with amber bg but plug icon would
 *     be visually confusing.
 *
 * Output structure consumed by the .ts wrapper (frozen):
 *   {
 *     text: string,            // e.g. "$(plug) 2 federated"
 *     tooltip: string,         // markdown
 *     color: "none" | "warning",
 *     count: number,
 *     warningAreas: string[],  // empty when color !== "warning"
 *   }
 */
"use strict";

/** Status bar text is amber-warning when any area has < this many minutes left. */
const IDLE_WARNING_THRESHOLD_MIN = 1;

/** Default idle timeout per M5.1 settings (`idleDisconnectMinutes` default). */
const DEFAULT_IDLE_DISCONNECT_MIN = 10;

/** Codicon literals embedded in the status bar text. */
const ICON_PLUG = "$(plug)";
const ICON_WARNING = "$(warning)";

/** Click target — the M5.6 list-attached command surface. */
const STATUS_BAR_COMMAND = "frootai.federation.listAttached";

/** Preferred status bar alignment per VS Code conventions for "ambient state" items. */
const STATUS_BAR_ALIGNMENT = "right";
/** Lower priority value = further to the right when aligned right. */
const STATUS_BAR_PRIORITY = 100;

/**
 * @typedef {object} AttachedAreaInput
 * @property {string} name
 * @property {number} [toolCount]
 * @property {number} [idleMinutes]
 *
 * @typedef {object} ComputeStatusBarInput
 * @property {ReadonlyArray<AttachedAreaInput> | null | undefined} attached
 * @property {number} [idleDisconnectMinutes]   Defaults to 10 (M5.1 default).
 *
 * @typedef {object} StatusBarState
 * @property {string} text
 * @property {string} tooltip
 * @property {"none" | "warning"} color
 * @property {number} count
 * @property {ReadonlyArray<string>} warningAreas
 */

/**
 * Pure: format the count-only status bar text (no warning state).
 *
 *   formatStatusBarText(0) → "$(plug) 0 federated"
 *   formatStatusBarText(2) → "$(plug) 2 federated"
 *
 * @param {number} count
 * @returns {string}
 */
function formatStatusBarText(count) {
  const n = Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0;
  return `${ICON_PLUG} ${n} federated`;
}

/**
 * Pure: compute the StatusBarState descriptor.
 *
 * @param {ComputeStatusBarInput} input
 * @returns {Readonly<StatusBarState>}
 */
function computeStatusBarState(input) {
  const inp = input || /** @type {ComputeStatusBarInput} */ ({});
  const attached = Array.isArray(inp.attached) ? inp.attached.filter(_isValidArea) : [];
  const limit = (typeof inp.idleDisconnectMinutes === "number" && Number.isFinite(inp.idleDisconnectMinutes) && inp.idleDisconnectMinutes > 0)
    ? inp.idleDisconnectMinutes
    : DEFAULT_IDLE_DISCONNECT_MIN;

  /** @type {string[]} */
  const warningAreas = [];
  for (const area of attached) {
    const idle = area.idleMinutes;
    // Honest no-data posture: skip warnings when idleMinutes is absent
    // or invalid. The PIN_ONE_AHEAD M5.4 stub returns empty data so
    // every status-bar refresh under the stub would warn-flicker
    // without this guard.
    if (typeof idle !== "number" || !Number.isFinite(idle) || idle < 0) continue;
    const slack = limit - idle;
    if (slack < IDLE_WARNING_THRESHOLD_MIN) {
      warningAreas.push(area.name);
    }
  }
  warningAreas.sort();

  const count = attached.length;
  const isWarning = warningAreas.length > 0;
  const icon = isWarning ? ICON_WARNING : ICON_PLUG;
  const text = `${icon} ${count} federated`;
  const color = isWarning ? "warning" : "none";

  // Tooltip: markdown bullet list. Operators hover for full state
  // because the status bar text itself is intentionally terse.
  const tooltip = _buildTooltip(attached, limit, warningAreas);

  return Object.freeze({
    text,
    tooltip,
    color,
    count,
    warningAreas: Object.freeze(warningAreas.slice()),
  });
}

/**
 * Pure: filter helper — an area must have a non-empty string name to
 * count toward the status bar.
 *
 * @param {AttachedAreaInput | null | undefined} area
 * @returns {area is AttachedAreaInput}
 */
function _isValidArea(area) {
  return !!area && typeof area === "object" && typeof area.name === "string" && area.name.length > 0;
}

/**
 * Pure: build the markdown tooltip body.
 *
 * @param {ReadonlyArray<AttachedAreaInput>} attached
 * @param {number} idleLimit
 * @param {ReadonlyArray<string>} warningAreas
 * @returns {string}
 */
function _buildTooltip(attached, idleLimit, warningAreas) {
  if (attached.length === 0) {
    return "**FrootAI Federation** — no areas attached.\n\nClick to discover MCP areas.";
  }
  const lines = ["**FrootAI Federation** — attached areas:", ""];
  const sorted = attached.slice().sort((a, b) => a.name.localeCompare(b.name));
  for (const area of sorted) {
    const idle = (typeof area.idleMinutes === "number" && Number.isFinite(area.idleMinutes) && area.idleMinutes >= 0)
      ? area.idleMinutes
      : null;
    const slack = idle === null ? null : idleLimit - idle;
    const isWarn = warningAreas.includes(area.name);
    const idleNote = idle === null
      ? "idle: ?"
      : isWarn
        ? `idle: ${idle}m / ${idleLimit}m \u26a0 < ${IDLE_WARNING_THRESHOLD_MIN}m left`
        : `idle: ${idle}m / ${idleLimit}m`;
    const tools = (typeof area.toolCount === "number" && Number.isFinite(area.toolCount) && area.toolCount >= 0)
      ? `${area.toolCount} tool${area.toolCount === 1 ? "" : "s"}`
      : "?";
    lines.push(`- \`${area.name}\` \u2014 ${tools} \u00b7 ${idleNote}`);
  }
  if (warningAreas.length > 0) {
    lines.push("");
    lines.push(`\u26a0 ${warningAreas.length} area${warningAreas.length === 1 ? "" : "s"} near idle-disconnect (< ${IDLE_WARNING_THRESHOLD_MIN}m left).`);
  }
  return lines.join("\n");
}

module.exports = {
  IDLE_WARNING_THRESHOLD_MIN,
  DEFAULT_IDLE_DISCONNECT_MIN,
  ICON_PLUG,
  ICON_WARNING,
  STATUS_BAR_COMMAND,
  STATUS_BAR_ALIGNMENT,
  STATUS_BAR_PRIORITY,
  formatStatusBarText,
  computeStatusBarState,
};
