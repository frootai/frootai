#!/usr/bin/env node
// @ts-check
/**
 * FAI Protocol — L0 Conformance Library
 *
 * Pure functions. No console output. Returns structured results.
 *
 * 5 L0 checks implementing FAI Protocol v0.9-rc1 §9.1:
 *   1. manifest-parse        — valid JSON, root is object
 *   2. schema-validation     — required fields, types, patterns (per spec §3)
 *   3. path-syntax           — primitive paths use ./ or ../../ (per spec §5.1)
 *   4. knowledge-ids         — context.knowledge IDs are FROOT taxonomy or X-prefix
 *   5. guardrail-ranges      — declared guardrails fall in their valid ranges (§3.4)
 *
 * Canonical reference: github.com/frootai/frootai/tree/main/conformance
 * Spec: github.com/frootai/frootai/blob/main/fai-protocol/README.md#9-conformance
 *
 * Zero runtime dependencies (Node 18+ built-ins only).
 */

"use strict";

const fs = require("fs");
const path = require("path");

const SUITE_VERSION = "conformance-v0.9-rc1";
const PROTOCOL_VERSION = "v0.9-rc1";

// ─── Constants from FAI Protocol v0.9-rc1 spec ──────────────────────────────

const PLAY_PATTERN = /^[0-9]{2}-[a-z0-9-]+$/;
const SEMVER_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+(-[a-z0-9.]+)?$/;

const VALID_WAF = new Set([
  "security",
  "reliability",
  "cost-optimization",
  "operational-excellence",
  "performance-efficiency",
  "responsible-ai",
]);

// FROOT knowledge modules from spec §4.1
const FROOT_MODULES = new Set([
  // Foundations
  "F1-GenAI-Foundations", "F2-LLMs", "F3-Glossary", "F4-Agentic-OS",
  // Reasoning
  "R1-Prompts", "R2-RAG-Architecture", "R3-Deterministic-AI",
  // Orchestration
  "O1-Semantic-Kernel", "O2-Agents", "O3-MCP-Tools",
  "O4-Azure-AI-Services", "O5-Infrastructure", "O6-Copilot",
  // Transformation
  "T1-Fine-Tuning", "T2-Responsible-AI", "T3-Production-Patterns",
]);

const CUSTOM_KNOWLEDGE_PREFIX = /^X[0-9]+-/;
const VALID_PATH_PREFIXES = ["./", "../../"];
const PRIMITIVE_PATH_KEYS = ["agents", "instructions", "skills", "hooks", "workflows"];

// ─── Discovery ──────────────────────────────────────────────────────────────

/**
 * Discover manifest files in a target directory.
 *
 * @param {string} targetDir - Absolute or cwd-relative path to scan.
 * @param {{ recursive?: boolean }} [opts]
 * @returns {string[]} Sorted array of absolute paths to *.fai-manifest.json files.
 */
function discoverManifests(targetDir, opts = {}) {
  const recursive = opts.recursive !== false;
  const abs = path.resolve(targetDir);

  if (!fs.existsSync(abs)) {
    throw new Error(`target directory does not exist: ${abs}`);
  }
  if (!fs.statSync(abs).isDirectory()) {
    throw new Error(`target is not a directory: ${abs}`);
  }

  const results = [];

  function walk(dir, depth) {
    if (depth > 8) return; // sanity cap
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.endsWith(".fai-manifest.json")) {
        results.push(full);
      } else if (recursive && entry.isDirectory()) {
        // Skip common noise
        if (
          entry.name === "node_modules" ||
          entry.name === ".git" ||
          entry.name === ".internal" ||
          entry.name.startsWith(".")
        ) {
          continue;
        }
        walk(full, depth + 1);
      }
    }
  }

  walk(abs, 0);
  return results.sort();
}

// ─── Check 1: manifest-parse ────────────────────────────────────────────────

/**
 * @param {string} filePath
 * @returns {{ passed: boolean, errors: string[], parsed?: any }}
 */
function checkParse(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    return { passed: false, errors: [`unreadable: ${err instanceof Error ? err.message : String(err)}`] };
  }
  if (!raw.trim()) {
    return { passed: false, errors: ["file is empty"] };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { passed: false, errors: [`JSON parse error: ${err instanceof Error ? err.message : String(err)}`] };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { passed: false, errors: ["parsed root must be an object"] };
  }
  return { passed: true, errors: [], parsed };
}

// ─── Check 2: schema-validation (structural; spec §3) ───────────────────────

/**
 * @param {any} m
 * @returns {string[]}
 */
function checkSchema(m) {
  const errors = [];

  for (const field of ["play", "version", "context", "primitives"]) {
    if (!(field in m)) errors.push(`missing required field: ${field}`);
  }

  if (typeof m.play === "string" && !PLAY_PATTERN.test(m.play)) {
    errors.push(`play "${m.play}" does not match ^[0-9]{2}-[a-z0-9-]+$`);
  }

  if (typeof m.version === "string" && !SEMVER_PATTERN.test(m.version)) {
    errors.push(`version "${m.version}" is not semver`);
  }

  if (typeof m.context === "object" && m.context !== null) {
    if (!Array.isArray(m.context.knowledge) || m.context.knowledge.length < 1) {
      errors.push("context.knowledge must be a non-empty array");
    }
    if (!Array.isArray(m.context.waf) || m.context.waf.length < 1) {
      errors.push("context.waf must be a non-empty array");
    } else {
      for (const w of m.context.waf) {
        if (!VALID_WAF.has(w)) errors.push(`context.waf contains invalid pillar: "${w}"`);
      }
    }
  }

  if (typeof m.primitives === "object" && m.primitives !== null) {
    const hasAny = ["agents", "instructions", "skills", "hooks", "workflows", "guardrails"]
      .some((k) => k in m.primitives);
    if (!hasAny) {
      errors.push("primitives must declare at least one primitive type");
    }
  }

  return errors;
}

// ─── Check 3: path-syntax (spec §5.1) ───────────────────────────────────────

function checkPathPrefix(p) {
  if (typeof p !== "string") return `not a string: ${JSON.stringify(p)}`;
  if (p.length === 0) return "empty path";
  if (!VALID_PATH_PREFIXES.some((prefix) => p.startsWith(prefix))) {
    return `path "${p}" does not start with "./" or "../../"`;
  }
  return null;
}

/**
 * @param {any} m
 * @returns {string[]}
 */
function checkPaths(m) {
  const errors = [];
  if (m && m.primitives) {
    for (const key of PRIMITIVE_PATH_KEYS) {
      const arr = m.primitives[key];
      if (!Array.isArray(arr)) continue;
      arr.forEach((p, idx) => {
        const err = checkPathPrefix(p);
        if (err) errors.push(`primitives.${key}[${idx}]: ${err}`);
      });
    }
  }
  if (m && m.infrastructure) {
    for (const [key, val] of Object.entries(m.infrastructure)) {
      const err = checkPathPrefix(val);
      if (err) errors.push(`infrastructure.${key}: ${err}`);
    }
  }
  if (m && m.toolkit) {
    for (const [key, val] of Object.entries(m.toolkit)) {
      const err = checkPathPrefix(val);
      if (err) errors.push(`toolkit.${key}: ${err}`);
    }
  }
  return errors;
}

// ─── Check 4: knowledge-ids (spec §4.1) ─────────────────────────────────────

function checkKnowledgeId(id) {
  if (typeof id !== "string") return `not a string: ${JSON.stringify(id)}`;
  if (FROOT_MODULES.has(id)) return null;
  if (CUSTOM_KNOWLEDGE_PREFIX.test(id)) return null;
  return `unknown knowledge module ID: "${id}" (not in FROOT taxonomy and not X-prefixed)`;
}

/**
 * @param {any} m
 * @returns {string[]}
 */
function checkKnowledge(m) {
  const errors = [];
  const knowledge = (m && m.context && Array.isArray(m.context.knowledge)) ? m.context.knowledge : [];
  if (knowledge.length === 0) {
    return ["context.knowledge missing or empty"];
  }
  knowledge.forEach((id, idx) => {
    const err = checkKnowledgeId(id);
    if (err) errors.push(`context.knowledge[${idx}]: ${err}`);
  });
  return errors;
}

// ─── Check 5: guardrail-ranges (spec §3.4) ──────────────────────────────────

function inUnitRange(n) {
  return typeof n === "number" && n >= 0 && n <= 1;
}

/**
 * @param {any} m
 * @returns {string[]}
 */
function checkGuardrails(m) {
  const errors = [];
  const g = m && m.primitives && m.primitives.guardrails;
  if (!g) return errors; // optional — pass trivially
  if (typeof g !== "object" || g === null || Array.isArray(g)) {
    return ["primitives.guardrails must be an object"];
  }
  if ("groundedness" in g && !inUnitRange(g.groundedness)) {
    errors.push(`groundedness ${g.groundedness} is not in [0, 1]`);
  }
  if ("coherence" in g && !inUnitRange(g.coherence)) {
    errors.push(`coherence ${g.coherence} is not in [0, 1]`);
  }
  if ("relevance" in g && !inUnitRange(g.relevance)) {
    errors.push(`relevance ${g.relevance} is not in [0, 1]`);
  }
  if ("safety" in g && !(Number.isInteger(g.safety) && g.safety === 0)) {
    errors.push(`safety ${g.safety} must be integer 0 (production requirement per spec §3.4)`);
  }
  if ("costPerQuery" in g && !(typeof g.costPerQuery === "number" && g.costPerQuery >= 0)) {
    errors.push(`costPerQuery ${g.costPerQuery} must be a non-negative number (USD)`);
  }
  return errors;
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

const CHECK_DEFS = [
  { id: "manifest-parse", spec: "§3.1", fn: null }, // special — also yields parsed
  { id: "schema-validation", spec: "§3", fn: checkSchema },
  { id: "path-syntax", spec: "§5.1", fn: checkPaths },
  { id: "knowledge-ids", spec: "§4.1", fn: checkKnowledge },
  { id: "guardrail-ranges", spec: "§3.4", fn: checkGuardrails },
];

/**
 * Run all 5 L0 checks against a single manifest file.
 *
 * @param {string} filePath
 * @returns {{ file: string, passed: boolean, checks: Array<{ id: string, spec: string, passed: boolean, errors: string[] }> }}
 */
function runFile(filePath) {
  const checks = [];

  // Check 1 — parse (also yields the parsed object for subsequent checks)
  const parseResult = checkParse(filePath);
  checks.push({
    id: "manifest-parse",
    spec: "§3.1",
    passed: parseResult.passed,
    errors: parseResult.errors,
  });

  if (!parseResult.passed) {
    // Cannot run subsequent checks without a parsed object — mark them as skipped/failed
    for (let i = 1; i < CHECK_DEFS.length; i++) {
      checks.push({
        id: CHECK_DEFS[i].id,
        spec: CHECK_DEFS[i].spec,
        passed: false,
        errors: ["skipped: manifest-parse failed"],
      });
    }
    return { file: filePath, passed: false, checks };
  }

  const m = parseResult.parsed;

  // Checks 2-5
  for (let i = 1; i < CHECK_DEFS.length; i++) {
    const def = CHECK_DEFS[i];
    const errors = def.fn(m);
    checks.push({
      id: def.id,
      spec: def.spec,
      passed: errors.length === 0,
      errors,
    });
  }

  const passed = checks.every((c) => c.passed);
  return { file: filePath, passed, checks };
}

/**
 * Run L0 conformance against every manifest in a target directory.
 *
 * @param {string} targetDir
 * @param {{ recursive?: boolean }} [opts]
 * @returns {{
 *   suite: string,
 *   protocol: string,
 *   targetDir: string,
 *   startedAt: string,
 *   elapsedMs: number,
 *   manifestCount: number,
 *   passed: number,
 *   failed: number,
 *   results: ReturnType<typeof runFile>[]
 * }}
 */
function runAll(targetDir, opts = {}) {
  const startedAt = new Date().toISOString();
  const start = Date.now();

  const manifests = discoverManifests(targetDir, opts);
  const results = manifests.map(runFile);
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  return {
    suite: SUITE_VERSION,
    protocol: PROTOCOL_VERSION,
    targetDir: path.resolve(targetDir),
    startedAt,
    elapsedMs: Date.now() - start,
    manifestCount: manifests.length,
    passed,
    failed,
    results,
  };
}

module.exports = {
  SUITE_VERSION,
  PROTOCOL_VERSION,
  VALID_WAF,
  FROOT_MODULES,
  discoverManifests,
  checkParse,
  checkSchema,
  checkPaths,
  checkKnowledge,
  checkGuardrails,
  runFile,
  runAll,
};
