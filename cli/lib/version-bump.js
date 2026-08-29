// @ts-check
/**
 * A5.9 — Version bump policy + changelog generator.
 *
 * Reads `planning/fai-orchard-masterplan.md` and computes:
 *   - Next semver based on changes since last released tag
 *   - Changelog section markdown for the new version
 *
 * Bump rules (deterministic):
 *   - MAJOR: any ✅ row contains "BREAKING:" prefix OR a new top-level
 *     phase tag is being released (orchard-v5.x → 6.0)
 *   - MINOR: any ✅ row mentions a new CLI subcommand / new endpoint
 *     (matches "ships? new subcommand|endpoint|public API" heuristic)
 *   - PATCH: everything else (bug fixes, doc updates, tests)
 *
 * The generator is intentionally CONSERVATIVE — when in doubt, defaults to
 * MINOR (we'd rather over-version a tiny change than miss signalling a real
 * new feature). Operator can override via explicit `--bump major|minor|patch`.
 *
 * Changelog format (Keep a Changelog 1.1.0):
 *   ## [x.y.z] — YYYY-MM-DD
 *   ### Added
 *   - <row description>
 *   ### Changed
 *   ### Fixed
 *
 * Doctrine:
 *   - PURE module — takes the masterplan text + last-version + now → returns
 *     {next_version, changelog_section, rows_included}. NO IO.
 *   - Caller (a `scripts/cli/bump-version.js` CLI) does the file IO.
 */
"use strict";

const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([a-z0-9.-]+))?$/i;
const ROW_RE = /^\|\s*`(\[A\d+\.\d{1,2}\])`\s*\|\s*([^|]+?)\s*\|\s*✅\s+(\d{4}-\d{2}-\d{2})\s*\|/;

const BUMP_ENUM = Object.freeze(["major", "minor", "patch"]);

/** Pure: parse a semver string → {major, minor, patch, prerelease?}. */
function parseSemver(s) {
  if (typeof s !== "string") return null;
  const m = s.match(VERSION_RE);
  if (!m) return null;
  return {
    major: parseInt(m[1], 10),
    minor: parseInt(m[2], 10),
    patch: parseInt(m[3], 10),
    prerelease: m[4] || null,
    raw: s,
  };
}

/** Pure: format semver → string. */
function formatSemver(v) {
  let s = `${v.major}.${v.minor}.${v.patch}`;
  if (v.prerelease) s += `-${v.prerelease}`;
  return s;
}

/** Pure: apply a bump to a semver. */
function bumpSemver(currentVersion, bump) {
  const v = parseSemver(currentVersion);
  if (!v) throw new Error(`invalid semver: ${currentVersion}`);
  if (!BUMP_ENUM.includes(bump)) throw new Error(`bump must be one of ${BUMP_ENUM.join("|")}`);
  if (bump === "major") return formatSemver({ major: v.major + 1, minor: 0, patch: 0 });
  if (bump === "minor") return formatSemver({ major: v.major, minor: v.minor + 1, patch: 0 });
  return formatSemver({ major: v.major, minor: v.minor, patch: v.patch + 1 });
}

/**
 * Pure: extract all ✅ rows from a masterplan section.
 * Returns [{id, description, closed_at}].
 */
function extractClosedRows(masterplanBody) {
  if (typeof masterplanBody !== "string") return [];
  const rows = [];
  for (const line of masterplanBody.split("\n")) {
    const m = line.match(ROW_RE);
    if (m) {
      rows.push({
        id: m[1],
        description: m[2].trim(),
        closed_at: m[3],
      });
    }
  }
  return rows;
}

/**
 * Pure: filter rows to those closed since `sinceDate` (ISO YYYY-MM-DD).
 * If sinceDate is null, returns all rows.
 */
function rowsClosedSince(rows, sinceDate) {
  if (!Array.isArray(rows)) return [];
  if (!sinceDate) return rows;
  return rows.filter((r) => r.closed_at > sinceDate);
}

/**
 * Pure: classify a row into changelog category based on its description text.
 *
 * Heuristic (keep deterministic):
 *   - "BREAKING:" / "breaking change" → "breaking"
 *   - "new subcommand" / "new endpoint" / "new module" / "new flag" / "+ ships?" → "added"
 *   - "renamed" / "moved" / "refactored" / "Changed" → "changed"
 *   - "fixed" / "bug" / "regression" / "caught pre-ship" → "fixed"
 *   - default → "added" (when in doubt, treat as a feature)
 */
function classifyRow(description) {
  if (typeof description !== "string") return "added";
  const d = description.toLowerCase();
  if (d.startsWith("breaking:") || d.includes("breaking change")) return "breaking";
  if (/\bfixed?\b|\bbug\b|\bregression\b|\bcaught pre-ship\b/.test(d)) return "fixed";
  if (/\brenamed\b|\bmoved\b|\brefactored\b|\bchanged\b/.test(d)) return "changed";
  return "added";
}

/**
 * Pure: decide bump kind from a set of rows.
 *   - Any "breaking" → major
 *   - Any "added" → minor
 *   - Only "fixed" / "changed" → patch
 */
function decideBump(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return "patch";
  let hasAdded = false;
  for (const r of rows) {
    const c = classifyRow(r.description);
    if (c === "breaking") return "major";
    if (c === "added") hasAdded = true;
  }
  return hasAdded ? "minor" : "patch";
}

/**
 * Pure: build a Keep a Changelog 1.1.0 section markdown for a new version.
 *
 * @param {object} input
 * @param {string} input.version    new version string
 * @param {string} input.date       YYYY-MM-DD
 * @param {Array<object>} input.rows
 * @returns {string}
 */
function buildChangelogSection(input) {
  if (!input || typeof input !== "object") throw new Error("buildChangelogSection requires input object");
  const version = input.version;
  const date = input.date;
  const rows = Array.isArray(input.rows) ? input.rows : [];
  if (!version) throw new Error("version required");
  if (!date) throw new Error("date required");

  const grouped = { added: [], changed: [], fixed: [], breaking: [] };
  for (const r of rows) {
    const cat = classifyRow(r.description);
    grouped[cat].push(`- ${r.id} — ${r.description.slice(0, 250)}`);
  }

  const lines = [`## [${version}] — ${date}`, ""];
  if (grouped.breaking.length > 0) {
    lines.push("### ⚠️ BREAKING CHANGES");
    lines.push(...grouped.breaking);
    lines.push("");
  }
  if (grouped.added.length > 0) {
    lines.push("### Added");
    lines.push(...grouped.added);
    lines.push("");
  }
  if (grouped.changed.length > 0) {
    lines.push("### Changed");
    lines.push(...grouped.changed);
    lines.push("");
  }
  if (grouped.fixed.length > 0) {
    lines.push("### Fixed");
    lines.push(...grouped.fixed);
    lines.push("");
  }
  if (rows.length === 0) {
    lines.push("_No notable changes._");
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * Pure top-level: compute next version + changelog section.
 *
 * @param {object} input
 * @param {string} input.masterplanBody
 * @param {string} input.currentVersion  e.g. "5.4.2"
 * @param {string} [input.sinceDate]     YYYY-MM-DD — only consider rows closed AFTER this date
 * @param {string} [input.releaseDate]   YYYY-MM-DD — defaults to today
 * @param {string} [input.bumpOverride]  force "major"|"minor"|"patch"
 * @returns {{next_version: string, bump: string, rows_included: Array, changelog_section: string}}
 */
function generateBumpAndChangelog(input) {
  if (!input || typeof input !== "object") throw new Error("generateBumpAndChangelog requires input");
  const { masterplanBody, currentVersion } = input;
  if (typeof masterplanBody !== "string") throw new Error("masterplanBody required");
  if (typeof currentVersion !== "string") throw new Error("currentVersion required");
  if (!parseSemver(currentVersion)) throw new Error(`invalid currentVersion: ${currentVersion}`);

  const rows = extractClosedRows(masterplanBody);
  const filtered = rowsClosedSince(rows, input.sinceDate);
  const bump = input.bumpOverride && BUMP_ENUM.includes(input.bumpOverride)
    ? input.bumpOverride
    : decideBump(filtered);
  const nextVersion = bumpSemver(currentVersion, bump);
  const releaseDate = input.releaseDate || new Date().toISOString().slice(0, 10);
  const section = buildChangelogSection({ version: nextVersion, date: releaseDate, rows: filtered });

  return {
    next_version: nextVersion,
    bump,
    rows_included: filtered,
    changelog_section: section,
  };
}

module.exports = {
  BUMP_ENUM,
  VERSION_RE,
  ROW_RE,
  parseSemver,
  formatSemver,
  bumpSemver,
  extractClosedRows,
  rowsClosedSince,
  classifyRow,
  decideBump,
  buildChangelogSection,
  generateBumpAndChangelog,
};
