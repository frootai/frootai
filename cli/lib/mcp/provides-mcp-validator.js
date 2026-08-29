// @ts-check
/**
 * FAI MCP CLI — `providesMcp` schema validator (M4.14 ship).
 *
 * Minimal hand-rolled validator for the `providesMcp` block on
 * `plugin.json`, mirroring `frootai/schemas/provides-mcp-v1.schema.json`.
 * Hand-rolled (no Ajv dep) because we only need the v1 shape — the schema
 * itself is small (3 required fields + 4 optional + 1 conditional).
 *
 * Returns `{ valid: boolean, errors: string[] }`. Pure; no IO.
 *
 * Anti-corruption note: this validator MUST stay byte-equivalent to the
 * shipped schema enums + patterns. A drift gate could be added later that
 * parses the schema JSON and asserts our constants match; for now the
 * file is small enough to eyeball-audit during reviews.
 */
"use strict";

const NAME_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const PUBLISHER_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const TRANSPORTS = Object.freeze(["stdio", "http-sse", "http-streaming"]);
const TRUSTS = Object.freeze(["first-party-ms", "verified-publisher", "community", "untrusted"]);
const ALLOWED_KEYS = Object.freeze(["name", "transport", "trust", "publisher", "command", "args", "url"]);

/**
 * @param {unknown} body
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateProvidesMcp(body) {
  const errors = [];
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { valid: false, errors: ["providesMcp must be an object"] };
  }
  const b = /** @type {Record<string, unknown>} */ (body);

  // additionalProperties: false
  for (const k of Object.keys(b)) {
    if (!ALLOWED_KEYS.includes(k)) errors.push(`unknown property: ${k}`);
  }

  // required fields
  for (const req of ["name", "transport", "trust"]) {
    if (!(req in b)) errors.push(`missing required property: ${req}`);
  }

  if ("name" in b) {
    const n = b.name;
    if (typeof n !== "string") errors.push("name must be a string");
    else {
      if (n.length < 2 || n.length > 64) errors.push("name length must be 2..64");
      if (!NAME_PATTERN.test(n)) errors.push(`name must match ${NAME_PATTERN}`);
    }
  }

  if ("transport" in b) {
    const t = b.transport;
    if (typeof t !== "string" || !TRANSPORTS.includes(t)) {
      errors.push(`transport must be one of: ${TRANSPORTS.join(" | ")}`);
    }
  }

  if ("trust" in b) {
    const t = b.trust;
    if (typeof t !== "string" || !TRUSTS.includes(t)) {
      errors.push(`trust must be one of: ${TRUSTS.join(" | ")}`);
    }
  }

  if ("publisher" in b) {
    const p = b.publisher;
    if (typeof p !== "string") errors.push("publisher must be a string");
    else {
      if (p.length < 2 || p.length > 64) errors.push("publisher length must be 2..64");
      if (!PUBLISHER_PATTERN.test(p)) errors.push(`publisher must match ${PUBLISHER_PATTERN}`);
    }
  }

  if ("command" in b) {
    const c = b.command;
    if (typeof c !== "string" || c.length < 1 || c.length > 256) {
      errors.push("command must be a string of length 1..256");
    }
  }

  if ("args" in b) {
    const a = b.args;
    if (!Array.isArray(a)) errors.push("args must be an array");
    else if (a.length > 32) errors.push("args length must be ≤ 32");
    else if (!a.every((x) => typeof x === "string")) errors.push("args items must be strings");
  }

  if ("url" in b) {
    const u = b.url;
    if (typeof u !== "string") errors.push("url must be a string");
    else {
      try { new URL(u); } catch { errors.push("url must be a valid URI"); }
    }
  }

  // Conditional: transport=stdio requires command; transport=http-* requires url.
  const transport = typeof b.transport === "string" ? b.transport : null;
  if (transport === "stdio" && !("command" in b)) {
    errors.push("transport=stdio requires `command`");
  }
  if ((transport === "http-sse" || transport === "http-streaming") && !("url" in b)) {
    errors.push(`transport=${transport} requires \`url\``);
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateProvidesMcp,
  NAME_PATTERN,
  PUBLISHER_PATTERN,
  TRANSPORTS,
  TRUSTS,
  ALLOWED_KEYS,
};
