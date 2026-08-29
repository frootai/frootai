// @ts-check
/**
 * FAI MCP CLI — `mcp-state.json` v1 schema validator (M4.15 ship).
 *
 * Hand-rolled (no Ajv dep, mirroring the M4.14 `provides-mcp-validator`
 * decision) but enforces the same constraints as the shipped JSON Schema
 * at `frootai/schemas/mcp-cli-state-v1.schema.json`.
 *
 * Returns `{ valid: boolean, errors: string[] }`. Pure; no IO.
 *
 * Tolerance contract: this validator is INVOKED ONLY against bodies that
 * were actually parsed from disk. The reader (`state.js readState`)
 * keeps treating a missing FILE as the empty default — first-run UX is
 * never an error. Within a file that does exist, the schema is strict
 * about types + patterns + enums + the v1 `version` literal.
 */
"use strict";

const NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
const HEALTH_ALLOWED_KEYS = Object.freeze([
  "area", "status", "latencyMs", "toolCount", "checkedAt", "errorCode",
]);
const ROOT_ALLOWED_KEYS = Object.freeze(["version", "preAttach", "lastHealthCheck"]);
const STATUS_ENUM = Object.freeze(["ok", "fail"]);
const PREATTACH_MAX = 256;
const HEALTH_MAX = 1024;
const NAME_MAX = 64;
const ERROR_CODE_MAX = 128;

// Simple ISO-8601 sanity gate: enough to flag "not a string we'd ever write"
// without pulling in a date-time grammar. Mirrors `Date.parse()` plus an
// anchor so trailing junk fails.
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function _isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function _isNonNegInt(v) {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

/**
 * Validate a parsed `mcp-state.json` body.
 *
 * @param {unknown} body
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateState(body) {
  const errors = [];
  if (!_isPlainObject(body)) {
    return { valid: false, errors: ["state root must be a JSON object"] };
  }
  const b = /** @type {Record<string, unknown>} */ (body);

  for (const k of Object.keys(b)) {
    if (!ROOT_ALLOWED_KEYS.includes(k)) errors.push(`unknown root property: ${k}`);
  }

  // version is required + must be exactly 1
  if (!("version" in b)) {
    errors.push("missing required property: version");
  } else if (b.version !== 1) {
    errors.push(`version must be the integer literal 1 (got ${JSON.stringify(b.version)})`);
  }

  if ("preAttach" in b) {
    const p = b.preAttach;
    if (!Array.isArray(p)) {
      errors.push("preAttach must be an array");
    } else {
      if (p.length > PREATTACH_MAX) errors.push(`preAttach length must be \u2264 ${PREATTACH_MAX}`);
      p.forEach((item, i) => {
        if (typeof item !== "string") {
          errors.push(`preAttach[${i}] must be a string`);
          return;
        }
        if (item.length < 1 || item.length > NAME_MAX) {
          errors.push(`preAttach[${i}] length must be 1..${NAME_MAX}`);
        }
        if (!NAME_PATTERN.test(item)) {
          errors.push(`preAttach[${i}] must match ${NAME_PATTERN}`);
        }
      });
    }
  }

  if ("lastHealthCheck" in b) {
    const h = b.lastHealthCheck;
    if (!Array.isArray(h)) {
      errors.push("lastHealthCheck must be an array");
    } else {
      if (h.length > HEALTH_MAX) errors.push(`lastHealthCheck length must be \u2264 ${HEALTH_MAX}`);
      h.forEach((entry, i) => {
        if (!_isPlainObject(entry)) {
          errors.push(`lastHealthCheck[${i}] must be an object`);
          return;
        }
        const e = /** @type {Record<string, unknown>} */ (entry);
        for (const k of Object.keys(e)) {
          if (!HEALTH_ALLOWED_KEYS.includes(k)) {
            errors.push(`lastHealthCheck[${i}] has unknown property: ${k}`);
          }
        }
        // area + status are required
        if (!("area" in e)) {
          errors.push(`lastHealthCheck[${i}] missing required property: area`);
        } else if (typeof e.area !== "string" || e.area.length < 1 || e.area.length > NAME_MAX) {
          errors.push(`lastHealthCheck[${i}].area must be a 1..${NAME_MAX}-char string`);
        } else if (!NAME_PATTERN.test(e.area)) {
          errors.push(`lastHealthCheck[${i}].area must match ${NAME_PATTERN}`);
        }
        if (!("status" in e)) {
          errors.push(`lastHealthCheck[${i}] missing required property: status`);
        } else if (typeof e.status !== "string" || !STATUS_ENUM.includes(e.status)) {
          errors.push(`lastHealthCheck[${i}].status must be one of: ${STATUS_ENUM.join(" | ")}`);
        }
        if ("latencyMs" in e && !_isNonNegInt(e.latencyMs)) {
          errors.push(`lastHealthCheck[${i}].latencyMs must be a non-negative integer`);
        }
        if ("toolCount" in e && !_isNonNegInt(e.toolCount)) {
          errors.push(`lastHealthCheck[${i}].toolCount must be a non-negative integer`);
        }
        if ("checkedAt" in e) {
          if (typeof e.checkedAt !== "string" || !ISO_DATE_PATTERN.test(e.checkedAt)) {
            errors.push(`lastHealthCheck[${i}].checkedAt must be an ISO-8601 date-time`);
          }
        }
        if ("errorCode" in e) {
          if (typeof e.errorCode !== "string" || e.errorCode.length < 1 || e.errorCode.length > ERROR_CODE_MAX) {
            errors.push(`lastHealthCheck[${i}].errorCode must be a 1..${ERROR_CODE_MAX}-char string`);
          }
        }
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateState,
  NAME_PATTERN,
  ISO_DATE_PATTERN,
  STATUS_ENUM,
  ROOT_ALLOWED_KEYS,
  HEALTH_ALLOWED_KEYS,
  PREATTACH_MAX,
  HEALTH_MAX,
  NAME_MAX,
  ERROR_CODE_MAX,
};
