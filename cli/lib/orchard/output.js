// @ts-check
/**
 * FAI Orchard CLI — terminal output helpers (no external deps).
 *
 * ANSI color escapes inline (chalk would add an unjustified dep for a CLI
 * that already exists). Color disabled when:
 *   - process.env.NO_COLOR is set (https://no-color.org/)
 *   - process.stdout.isTTY === false (piped output)
 *   - opts.color === false
 *
 * Pure functions for table rendering + colored chips so tests can assert
 * the exact rendered output.
 */
"use strict";

const _RESET = "\u001b[0m";
const _CODES = Object.freeze({
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  red: "\u001b[31m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  blue: "\u001b[34m",
  magenta: "\u001b[35m",
  cyan: "\u001b[36m",
  gray: "\u001b[90m",
});

function _colorEnabled(opts) {
  if (opts && opts.color === false) return false;
  if (opts && opts.color === true) return true;
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== "") return false;
  if (process.stdout && process.stdout.isTTY === false) return false;
  return true;
}

function color(name, text, opts) {
  if (!_colorEnabled(opts)) return String(text);
  const code = _CODES[name];
  if (!code) return String(text);
  return `${code}${text}${_RESET}`;
}

const _STATUS_COLORS = Object.freeze({
  ok: "green", warn: "yellow", error: "red", info: "blue", dim: "gray",
});

/** Render a one-line status header: "[level] message" */
function status(level, message, opts) {
  const c = _STATUS_COLORS[level] || "cyan";
  return `${color(c, "[" + level + "]", opts)} ${message}`;
}

/**
 * Pad a string to a fixed column width (truncates with `…` if too long).
 * Pure.
 */
function padCol(text, width) {
  const s = String(text == null ? "" : text);
  if (s.length === width) return s;
  if (s.length > width) return width > 1 ? s.slice(0, width - 1) + "…" : s.slice(0, width);
  return s + " ".repeat(width - s.length);
}

/**
 * Render an array of objects as a column-aligned table.
 *
 * @param {Array<Record<string, any>>} rows
 * @param {Array<{key: string, label: string, width: number}>} columns
 * @param {object} [opts]
 * @returns {string}
 */
function renderTable(rows, columns, opts) {
  if (!Array.isArray(rows) || !Array.isArray(columns) || columns.length === 0) return "";
  const lines = [];
  const headerCells = columns.map((c) => color("bold", padCol(c.label, c.width), opts));
  const separator = columns.map((c) => "-".repeat(c.width)).join("  ");
  lines.push(headerCells.join("  "));
  lines.push(color("dim", separator, opts));
  for (const row of rows) {
    lines.push(columns.map((c) => padCol(row[c.key], c.width)).join("  "));
  }
  return lines.join("\n");
}

/** Render a key/value section (alignment + dim labels). */
function renderKeyValue(pairs, opts) {
  if (!Array.isArray(pairs) || pairs.length === 0) return "";
  const labelWidth = Math.max(...pairs.map((p) => String(p.label || "").length));
  return pairs.map((p) => `  ${color("dim", padCol(p.label, labelWidth) + ":", opts)} ${p.value == null ? "" : p.value}`).join("\n");
}

module.exports = {
  color,
  status,
  padCol,
  renderTable,
  renderKeyValue,
  _colorEnabled,
  _CODES,
};
