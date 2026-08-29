// @ts-check
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { isDeepStrictEqual } = require("node:util");

let cached;
function ucs2length(value) { return [...value].length; }
function validDateTime(value) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d[Tt]\d\d:\d\d:(?:[0-5]\d|60)(?:\.\d+)?(?:[Zz]|[+-]\d\d(?::?\d\d)?)$/u.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}
function validUri(value) {
  if (typeof value !== "string" || !/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value) || /[\u0000-\u0020\u007f-\u009f]/u.test(value)) return false;
  try { new URL(value); return true; } catch { return false; }
}
function loadValidators() {
  if (cached) return cached;
  const filename = path.join(__dirname, "contracts", "validators.cjs");
  const source = fs.readFileSync(filename, "utf8");
  const factory = vm.runInThisContext(`(function(exports, require, module, __filename, __dirname) {${source}\n})`, { filename });
  const module = { exports: {} };
  const runtimeRequire = (specifier) => {
    if (specifier === "ajv/dist/runtime/ucs2length") return { default: ucs2length };
    if (specifier === "ajv/dist/runtime/equal") return { default: isDeepStrictEqual };
    if (specifier === "ajv-formats/dist/formats") return { fullFormats: { "date-time": { validate: validDateTime }, uri: validUri } };
    throw new Error("Vendored validator requested an unapproved runtime helper");
  };
  factory(module.exports, runtimeRequire, module, filename, path.dirname(filename));
  cached = Object.freeze(module.exports);
  return cached;
}

function validate(name, value) {
  const validator = loadValidators()[name];
  if (typeof validator !== "function") throw new Error(`Unknown vendored validator ${name}`);
  return { valid: validator(value), errors: validator.errors || [] };
}

module.exports = { loadValidators, validate };