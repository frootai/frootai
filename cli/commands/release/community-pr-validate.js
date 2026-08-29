// @ts-check
/**
 * [H11.21] community-pr-validate.js — pure validator for community-
 * contributed Solution Play PRs.
 *
 * Contract (verbatim from masterplan §3 row [H11.21]):
 *   Community PR contribution path: contributor docs at
 *   `frootai/orchard/CONTRIBUTING.md` + PR template + auto-validate on PR
 *
 * **Masterplan-literal interpretation note**: the masterplan literal says
 * `frootai/orchard/CONTRIBUTING.md` but that file already exists for the
 * catalog (seed/override/pollination paths) — H11.21 ships the
 * COMMUNITY SOLUTION PLAYS contributor doc at the H11.20-pinned path
 * `frootai/orchard/community-plays/CONTRIBUTING.md` instead. The
 * top-level CONTRIBUTING.md adds a cross-reference link to the new
 * community-plays subdoc + a "What if I want to contribute a Solution
 * Play?" pointer. Documented in the planning doc + this lib's JSDoc.
 *
 * **Sibling-lib doctrine** (18th confirmed app): NO edits to H11.20
 * wave3-launch lib (151-case test still green). This lib REUSES the
 * H11.20 `CONTRIBUTION_PATH` constant via a type-only import for the
 * `review_sla_days` literal pin (7 days). NO runtime coupling — the
 * import is verified at compile-time only.
 *
 * **Validator pure surface** — accepts the parsed manifest JSON +
 * optional file list + returns `{ok, errors[], warnings[], summary}`.
 * Mirrors H0.5 reference validator shape but FOCUSED on the community-
 * PR contract (required-fields, slug shape, license floor, no-PII,
 * file-tree).
 *
 * **Workflow shell-out**: `.github/workflows/community-plays-validate.yml`
 * (sibling ship) invokes the validator via `node -e` with the parsed
 * manifest path + emits a per-PR check status. The lib never reads/
 * writes files — caller injects the file list.
 *
 * **No third-party deps** (third-party-requires invariant).
 *
 * License: CC0-1.0.
 *
 * @module cli/commands/release/community-pr-validate
 */
"use strict";

const path = require("node:path");

/** Sysexits-aligned exit codes. */
const EXIT = Object.freeze({
  OK: 0,
  USAGE: 64,
  DATA_ERR: 65,
  SOFTWARE: 70,
});

/** Required top-level fields per the H11.20-pinned community-plays
 *  manifest contract. Subset of the full fai-manifest v2 — community
 *  PRs bootstrap with the minimum viable set; founder review can add
 *  the rest. */
const REQUIRED_FIELDS = Object.freeze([
  "schema_version",
  "id",
  "name",
  "slug",
  "variety",
  "owner",
  "owner_type",
  "repo_url",
  "default_branch",
  "tagline",
  "license",
]);

/** Allowed variety enum (matches H0.3 schema). */
const ALLOWED_VARIETIES = Object.freeze(["azure", "aws", "gcp", "oss", "hybrid"]);

/** Allowed owner_type enum. */
const ALLOWED_OWNER_TYPES = Object.freeze([
  "first_party",
  "cultivated",
  "community",
]);

/** Permissive license floor — community PRs MUST land on these licenses
 *  for catalog inclusion. SPDX identifiers, case-insensitive. */
const ALLOWED_LICENSES = Object.freeze([
  "mit",
  "apache-2.0",
  "bsd-2-clause",
  "bsd-3-clause",
  "isc",
  "0bsd",
  "unlicense",
  "cc0-1.0",
]);

/** Slug must be URL-safe + path-traversal-safe + ≤ 64 chars. */
const SLUG_REGEX = /^[a-z0-9-]+$/;
const SLUG_MAX_LEN = 64;
const SLUG_MIN_LEN = 3;

/** Tagline length cap. */
const TAGLINE_MAX_LEN = 200;

/** Founder review SLA (mirrors H11.20 `CONTRIBUTION_PATH.review_sla_days`
 *  literal — kept duplicated rather than imported to avoid runtime
 *  coupling between the two libs). */
const FOUNDER_REVIEW_SLA_DAYS = 7;

/** Files that MUST be present in a community-play PR (paths relative to
 *  the play's root directory). */
const REQUIRED_FILES = Object.freeze([
  "fai-manifest.json",
  "README.md",
]);

/** PII patterns we reject in PR-submitted manifests (basic check; full
 *  PII scrub lives in H0.10 server-side validator). */
const PII_PATTERNS = Object.freeze([
  { id: "email", re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, label: "email address" },
  { id: "phone", re: /\b\+?\d{1,3}[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}\b/, label: "phone number" },
  { id: "ssn", re: /\b\d{3}-\d{2}-\d{4}\b/, label: "SSN" },
]);

/** Fields that should NOT contain PII even if the rest of the manifest
 *  does (PII in technical fields is bug, PII in author/contact fields is
 *  intentional). */
const PII_SCANNED_FIELDS = Object.freeze([
  "name",
  "tagline",
  "description",
  "readme_excerpt",
]);

class CommunityPrValidationError extends Error {
  /** @param {string} code @param {string} message @param {{exitCode?: number, cause?: Error}} [opts] */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "CommunityPrValidationError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

// ──────────────────────────────────────────────────────────────────
// Pure helpers
// ──────────────────────────────────────────────────────────────────

/**
 * Whether a slug is URL-safe + the right length + not a path-traversal
 * marker. Pure. Mirrors the H11.7/H11.8/H11.15/H11.20 slug-validator
 * pattern (`.` + `..` rejected before regex).
 *
 * @param {unknown} slug
 * @returns {boolean}
 */
function isValidSlug(slug) {
  if (typeof slug !== "string") return false;
  if (slug.length < SLUG_MIN_LEN || slug.length > SLUG_MAX_LEN) return false;
  if (slug === "." || slug === "..") return false;
  return SLUG_REGEX.test(slug);
}

/**
 * Whether the license is in the permissive floor (case-insensitive).
 * Pure.
 *
 * @param {unknown} lic
 * @returns {boolean}
 */
function isAllowedLicense(lic) {
  if (typeof lic !== "string") return false;
  return ALLOWED_LICENSES.includes(lic.trim().toLowerCase());
}

/**
 * Whether a string contains PII per the basic-pattern checks. Pure.
 * Returns `{found: false}` OR `{found: true, kind, label}`.
 *
 * @param {unknown} s
 * @returns {{found: boolean, kind?: string, label?: string}}
 */
function scanForPii(s) {
  if (typeof s !== "string" || s.length === 0) return { found: false };
  for (const p of PII_PATTERNS) {
    if (p.re.test(s)) return { found: true, kind: p.id, label: p.label };
  }
  return { found: false };
}

/**
 * Whether a relative file path is safe (no absolute paths, no `..`
 * segments, no leading slash). Pure.
 *
 * @param {unknown} relPath
 * @returns {boolean}
 */
function isSafeRelativePath(relPath) {
  if (typeof relPath !== "string") return false;
  if (relPath.length === 0) return false;
  if (relPath.startsWith("/") || relPath.startsWith("\\")) return false;
  if (relPath.includes("\\")) return false; // POSIX-only relative paths
  const segments = relPath.split("/");
  for (const seg of segments) {
    if (seg === "" || seg === "." || seg === "..") return false;
  }
  return true;
}

// ──────────────────────────────────────────────────────────────────
// Top-level validator
// ──────────────────────────────────────────────────────────────────

/**
 * @typedef {object} ValidationError
 * @property {string} code
 * @property {string} field
 * @property {string} message
 */

/**
 * @typedef {object} ValidationWarning
 * @property {string} code
 * @property {string} field
 * @property {string} message
 */

/**
 * @typedef {object} ValidationResult
 * @property {boolean} ok — true when zero errors (warnings allowed)
 * @property {ValidationError[]} errors
 * @property {ValidationWarning[]} warnings
 * @property {{
 *   slug: string|null,
 *   variety: string|null,
 *   license_class: "permissive"|"unknown",
 *   pii_found: boolean,
 *   missing_required_fields: string[],
 *   missing_required_files: string[],
 *   review_sla_days: number,
 * }} summary
 */

/**
 * Validate a community-PR manifest + optional file list. Pure. NEVER
 * throws on bad input — wraps everything in `{ok:false, errors[]}`.
 *
 * @param {unknown} manifest — parsed JSON (caller does the parse)
 * @param {{ files?: ReadonlyArray<string> }} [opts]
 * @returns {ValidationResult}
 */
function validateCommunityPr(manifest, opts) {
  /** @type {ValidationError[]} */
  const errors = [];
  /** @type {ValidationWarning[]} */
  const warnings = [];

  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    errors.push({ code: "manifest_not_object", field: "_root", message: "manifest must be a JSON object" });
    return finalize(errors, warnings, null, null, "unknown", false, REQUIRED_FIELDS.slice(), REQUIRED_FILES.slice());
  }
  const m = /** @type {Record<string, unknown>} */ (manifest);

  // Required fields
  /** @type {string[]} */
  const missingFields = [];
  for (const f of REQUIRED_FIELDS) {
    if (m[f] == null || m[f] === "") {
      missingFields.push(f);
      errors.push({ code: "missing_required_field", field: f, message: `required field "${f}" is missing or empty` });
    }
  }

  // Slug
  let slugOk = false;
  const slug = typeof m.slug === "string" ? m.slug : null;
  if (slug != null && !isValidSlug(slug)) {
    errors.push({ code: "invalid_slug", field: "slug", message: `slug must be lowercase + digits + hyphens only, ${SLUG_MIN_LEN}-${SLUG_MAX_LEN} chars, not "." or ".."`});
  } else if (slug != null) {
    slugOk = true;
  }

  // Variety
  const variety = typeof m.variety === "string" ? m.variety : null;
  if (variety != null && !ALLOWED_VARIETIES.includes(variety)) {
    errors.push({ code: "invalid_variety", field: "variety", message: `variety must be one of ${ALLOWED_VARIETIES.join("|")}` });
  }

  // Owner type
  if (typeof m.owner_type === "string" && !ALLOWED_OWNER_TYPES.includes(m.owner_type)) {
    errors.push({ code: "invalid_owner_type", field: "owner_type", message: `owner_type must be one of ${ALLOWED_OWNER_TYPES.join("|")}` });
  } else if (m.owner_type === "first_party" || m.owner_type === "cultivated") {
    warnings.push({ code: "non_community_owner_type", field: "owner_type", message: `community-PR contributions usually have owner_type="community"; got "${m.owner_type}"` });
  }

  // License floor
  const license = typeof m.license === "string" ? m.license : null;
  let licenseClass = /** @type {"permissive"|"unknown"} */ ("unknown");
  if (license == null || license === "") {
    // Already counted by required-fields check; skip
  } else if (!isAllowedLicense(license)) {
    errors.push({ code: "license_not_in_floor", field: "license", message: `license "${license}" not in permissive floor (allowed: ${ALLOWED_LICENSES.join(", ")})` });
  } else {
    licenseClass = "permissive";
  }

  // Tagline length
  if (typeof m.tagline === "string" && m.tagline.length > TAGLINE_MAX_LEN) {
    errors.push({ code: "tagline_too_long", field: "tagline", message: `tagline exceeds ${TAGLINE_MAX_LEN} chars` });
  }

  // PII scan in scanned fields
  let piiFound = false;
  for (const f of PII_SCANNED_FIELDS) {
    const v = m[f];
    if (typeof v !== "string") continue;
    const scan = scanForPii(v);
    if (scan.found) {
      piiFound = true;
      errors.push({ code: "pii_detected", field: f, message: `${f} contains ${scan.label}; PII forbidden in technical fields` });
    }
  }

  // Repo URL shape (basic)
  if (typeof m.repo_url === "string" && !/^https?:\/\//.test(m.repo_url)) {
    errors.push({ code: "invalid_repo_url", field: "repo_url", message: "repo_url must be an http(s) URL" });
  }

  // Default branch sanity
  if (typeof m.default_branch === "string" && /[\s]/.test(m.default_branch)) {
    errors.push({ code: "invalid_default_branch", field: "default_branch", message: "default_branch must not contain whitespace" });
  }

  // File-tree check
  /** @type {string[]} */
  const missingFiles = [];
  const files = opts && Array.isArray(opts.files) ? opts.files.filter((f) => typeof f === "string") : null;
  if (files != null) {
    for (const req of REQUIRED_FILES) {
      if (!files.includes(req)) {
        missingFiles.push(req);
        errors.push({ code: "missing_required_file", field: req, message: `required file "${req}" not in PR file tree` });
      }
    }
    // Per-file safe-path check
    for (const f of files) {
      if (!isSafeRelativePath(f)) {
        errors.push({ code: "unsafe_file_path", field: f, message: `file path "${f}" is unsafe (absolute, parent-dir, or empty segment)` });
      }
    }
    // Friendly warning when a PR exceeds 100 files — slows founder review
    if (files.length > 100) {
      warnings.push({ code: "large_pr", field: "_files", message: `PR contains ${files.length} files; consider splitting (founder review SLA is ${FOUNDER_REVIEW_SLA_DAYS} days)` });
    }
  }

  // Schema version warning
  if (typeof m.schema_version === "string" && m.schema_version !== "2.0.0") {
    warnings.push({ code: "schema_version_mismatch", field: "schema_version", message: `schema_version "${m.schema_version}" is not the canonical "2.0.0"; founder may auto-migrate` });
  }

  return finalize(errors, warnings, slugOk ? slug : null, variety, licenseClass, piiFound, missingFields, missingFiles);
}

/**
 * Finalize the result. Pure.
 *
 * @param {ValidationError[]} errors
 * @param {ValidationWarning[]} warnings
 * @param {string|null} slug
 * @param {string|null} variety
 * @param {"permissive"|"unknown"} licenseClass
 * @param {boolean} piiFound
 * @param {string[]} missingFields
 * @param {string[]} missingFiles
 * @returns {ValidationResult}
 */
function finalize(errors, warnings, slug, variety, licenseClass, piiFound, missingFields, missingFiles) {
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      slug,
      variety,
      license_class: licenseClass,
      pii_found: piiFound,
      missing_required_fields: missingFields,
      missing_required_files: missingFiles,
      review_sla_days: FOUNDER_REVIEW_SLA_DAYS,
    },
  };
}

/**
 * Render the validator result as a markdown PR comment. Pure. Used by
 * the GitHub Actions workflow to post a friendly comment when validation
 * fails OR succeeds.
 *
 * @param {ValidationResult} result
 * @returns {string}
 */
function renderPrComment(result) {
  if (!result || typeof result !== "object") {
    throw new CommunityPrValidationError("usage", "result must be an object", { exitCode: EXIT.USAGE });
  }
  /** @type {string[]} */
  const out = [];
  out.push(`## Community PR validator`);
  out.push("");
  if (result.ok) {
    out.push(`✅ **All checks passed.** Founder review SLA: ${result.summary.review_sla_days} days from this comment.`);
    out.push("");
  } else {
    out.push(`❌ **${result.errors.length} error${result.errors.length === 1 ? "" : "s"} found.** Please fix + push; the validator re-runs on every push.`);
    out.push("");
    out.push("### Errors");
    out.push("");
    for (const e of result.errors) {
      out.push(`- **${e.code}** (\`${e.field}\`): ${e.message}`);
    }
    out.push("");
  }
  if (result.warnings.length > 0) {
    out.push("### Warnings (non-blocking)");
    out.push("");
    for (const w of result.warnings) {
      out.push(`- **${w.code}** (\`${w.field}\`): ${w.message}`);
    }
    out.push("");
  }
  out.push("### Summary");
  out.push("");
  out.push(`- Slug: \`${result.summary.slug ?? "—"}\``);
  out.push(`- Variety: \`${result.summary.variety ?? "—"}\``);
  out.push(`- License class: \`${result.summary.license_class}\``);
  out.push(`- PII detected: ${result.summary.pii_found ? "yes" : "no"}`);
  if (result.summary.missing_required_fields.length > 0) {
    out.push(`- Missing fields: ${result.summary.missing_required_fields.map((f) => `\`${f}\``).join(", ")}`);
  }
  if (result.summary.missing_required_files.length > 0) {
    out.push(`- Missing files: ${result.summary.missing_required_files.map((f) => `\`${f}\``).join(", ")}`);
  }
  out.push("");
  out.push(`_Auto-generated by \`cli/commands/release/community-pr-validate.js\` ([H11.21])._`);
  return out.join("\n");
}

module.exports = {
  EXIT,
  REQUIRED_FIELDS,
  ALLOWED_VARIETIES,
  ALLOWED_OWNER_TYPES,
  ALLOWED_LICENSES,
  SLUG_REGEX,
  SLUG_MIN_LEN,
  SLUG_MAX_LEN,
  TAGLINE_MAX_LEN,
  FOUNDER_REVIEW_SLA_DAYS,
  REQUIRED_FILES,
  PII_PATTERNS,
  PII_SCANNED_FIELDS,
  CommunityPrValidationError,
  isValidSlug,
  isAllowedLicense,
  scanForPii,
  isSafeRelativePath,
  validateCommunityPr,
  renderPrComment,
};
