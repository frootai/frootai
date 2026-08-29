// @ts-check
/**
 * A4.20 — Render a FileDiffSet as a colored unified-diff for terminal display.
 *
 * Color scheme (matches `git diff` convention):
 *   - `+` lines → green
 *   - `-` lines → red
 *   - ` ` context lines → default (no color)
 *   - `@@ -aStart,aLen +bStart,bLen @@` hunk header → cyan
 *   - per-file `--- a/<rel>` / `+++ b/<rel>` header → bold
 *   - summary at end → dim text + status chips
 *
 * Colors disabled when `opts.color === false` OR `NO_COLOR` env set OR
 * `process.stdout.isTTY === false`. Same convention as orchard/output.js.
 *
 * Pure functions. Tests assert exact rendered output.
 */
"use strict";

const { color, status, _colorEnabled } = require("../orchard/output");
const { KIND_NEW, KIND_IDENTICAL, KIND_MODIFIED } = require("./engine");

const KIND_LABELS = Object.freeze({
  [KIND_NEW]: "NEW",
  [KIND_MODIFIED]: "MOD",
  [KIND_IDENTICAL]: "SAME",
});
const KIND_COLORS = Object.freeze({
  [KIND_NEW]: "green",
  [KIND_MODIFIED]: "yellow",
  [KIND_IDENTICAL]: "dim",
});

/** Pure: format the per-file header `--- a/<rel>` + `+++ b/<rel>`. */
function renderFileHeader(file, opts) {
  const o = opts || {};
  const lines = [];
  const chip = `[${color(KIND_COLORS[file.kind] || "cyan", KIND_LABELS[file.kind] || file.kind, o)}]`;
  lines.push(color("bold", `${chip} .github/${file.rel}`, o));
  if (file.kind === KIND_NEW) {
    lines.push(color("dim", `--- /dev/null`, o));
    lines.push(color("dim", `+++ b/.github/${file.rel}`, o));
  } else if (file.kind === KIND_MODIFIED) {
    lines.push(color("dim", `--- a/.github/${file.rel}`, o));
    lines.push(color("dim", `+++ b/.github/${file.rel}`, o));
  }
  return lines.join("\n");
}

/** Pure: format a single hunk with colors. */
function renderHunk(hunk, opts) {
  const o = opts || {};
  const lines = [];
  const header = `@@ -${hunk.aStart},${hunk.aLen} +${hunk.bStart},${hunk.bLen} @@`;
  lines.push(color("cyan", header, o));
  for (const line of hunk.lines) {
    if (line.tag === "+") lines.push(color("green", `+${line.text}`, o));
    else if (line.tag === "-") lines.push(color("red", `-${line.text}`, o));
    else lines.push(` ${line.text}`);
  }
  return lines.join("\n");
}

/** Pure: format ONE file's diff (header + all hunks). */
function renderFileDiff(file, opts) {
  const o = opts || {};
  const parts = [renderFileHeader(file, o)];
  if (file.kind === KIND_IDENTICAL) {
    parts.push(color("dim", "  (identical — no changes)", o));
  } else if (file.diff && Array.isArray(file.diff.hunks)) {
    for (const h of file.diff.hunks) {
      parts.push(renderHunk(h, o));
    }
  }
  return parts.join("\n");
}

/**
 * Pure: render the full FileDiffSet with a header + per-file diffs + summary.
 *
 * @param {object} set
 * @param {object} [opts]
 * @param {boolean} [opts.color]                — explicit color override
 * @param {boolean} [opts.hideIdentical=true]   — omit identical files (always
 *                                                shown in summary count regardless)
 */
function renderFileDiffSet(set, opts) {
  if (!set || typeof set !== "object") return "";
  const o = opts || {};
  const hideIdentical = o.hideIdentical !== false;

  const out = [];
  out.push(color("bold", `Diff: Play ${set.play_id}-${set.play_slug} → ${set.target_dir}`, o));
  out.push("");

  const filesToShow = hideIdentical ? set.files.filter((f) => f.kind !== KIND_IDENTICAL) : set.files;
  for (const file of filesToShow) {
    out.push(renderFileDiff(file, o));
    out.push("");
  }

  // Summary block.
  const s = set.summary || {};
  const summaryLine = [
    `${color("green", `+${s.lines_added || 0}`, o)} ${color("dim", "added", o)}`,
    `${color("red", `-${s.lines_removed || 0}`, o)} ${color("dim", "removed", o)}`,
    `${color("dim", "across", o)} ${s.modified || 0} ${color("dim", "modified file" + (s.modified === 1 ? "" : "s") + ",", o)}`,
    `${color("green", String(s.new || 0), o)} ${color("dim", "new,", o)}`,
    `${color("dim", String(s.identical || 0) + " identical", o)}`,
  ].join(" ");
  out.push(summaryLine);
  if (hideIdentical && (s.identical || 0) > 0) {
    out.push(color("dim", `  (${s.identical} identical file${s.identical === 1 ? "" : "s"} hidden — pass --show-identical to view)`, o));
  }
  if ((s.modified || 0) > 0) {
    out.push("");
    out.push(color("yellow", `  Conflicts: ${s.modified} file${s.modified === 1 ? "" : "s"} would be MODIFIED. Re-run \`install --upgrade-to-play\` with --force to apply (or use \`diff --apply --force\`).`, o));
  }
  return out.join("\n");
}

/**
 * Pure: short one-liner summary of a FileDiffSet (used for --json adjuncts +
 * status emit on --apply).
 */
function renderShortSummary(set, opts) {
  const o = opts || {};
  if (!set || !set.summary) return "";
  const s = set.summary;
  return `${s.total} files: ${color("green", String(s.new || 0), o)} new, ${color("yellow", String(s.modified || 0), o)} modified, ${color("dim", String(s.identical || 0), o)} identical (${color("green", "+" + (s.lines_added || 0), o)} / ${color("red", "-" + (s.lines_removed || 0), o)})`;
}

module.exports = {
  KIND_LABELS,
  KIND_COLORS,
  renderFileHeader,
  renderHunk,
  renderFileDiff,
  renderFileDiffSet,
  renderShortSummary,
};
