#!/usr/bin/env node
/**
 * Spec-conformance audit for every FrootAI skill, using the OFFICIAL
 * `skills-ref` reference validator (agentskills.io standard).
 *
 * Dependency-free: resolves `skills-ref` from a local/global install or the
 * npx cache. If it can't be found, prints install guidance and exits 2 — it
 * never edits SKILL.md.
 *
 * Run:
 *   npx --yes skills-ref --version   # warms the npx cache (first time)
 *   node scripts/skill-spec-conformance.mjs [--json reports/spec-conformance.json]
 */
import { readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const require = createRequire(import.meta.url);

function loadSkillsRef() {
  // 1. Normal resolution (local node_modules or global with NODE_PATH).
  try {
    return require("skills-ref");
  } catch {}
  // 2. Scan the npx cache for a cached install.
  const npxCache = join(homedir(), "AppData", "Local", "npm-cache", "_npx");
  const altCache = join(homedir(), ".npm", "_npx"); // macOS/Linux
  for (const cache of [npxCache, altCache]) {
    if (!existsSync(cache)) continue;
    for (const entry of readdirSync(cache)) {
      const candidate = join(cache, entry, "node_modules", "skills-ref", "dist", "index.js");
      if (existsSync(candidate)) return require(candidate);
    }
  }
  return null;
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  if (entries.includes("SKILL.md")) {
    out.push(dir);
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
  }
  return out;
}

const sr = loadSkillsRef();
if (!sr || typeof sr.validate !== "function") {
  console.error(
    "skills-ref not found. Install it first:\n" +
      "  npm i -g skills-ref   (or)   npx --yes skills-ref --version\n" +
      "then re-run this script.",
  );
  process.exit(2);
}

const jsonFlag = process.argv.indexOf("--json");
const jsonOut = jsonFlag !== -1 ? process.argv[jsonFlag + 1] : null;

const dirs = [];
for (const r of ["skills", "solution-plays"]) walk(join(ROOT, r), dirs);

let valid = 0;
const invalid = [];
for (const d of dirs) {
  const rel = "./" + d.replace(ROOT + "\\", "").replace(ROOT + "/", "").split(/[\\/]/).join("/");
  try {
    const res = sr.validate(d);
    if (res && res.valid === false) {
      invalid.push({ skill: rel, errors: res.errors || [] });
    } else {
      valid++;
    }
  } catch (e) {
    invalid.push({ skill: rel, errors: [e.message] });
  }
}

console.log(`Official skills-ref v${sr.version || "?"} conformance audit`);
console.log(`  total=${dirs.length}  valid=${valid}  invalid=${invalid.length}`);
for (const i of invalid.slice(0, 20)) console.log(`  INVALID ${i.skill} -> ${i.errors.join("; ")}`);

if (jsonOut) {
  const out = join(ROOT, jsonOut);
  if (!existsSync(dirname(out))) mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    JSON.stringify(
      { tool: "skills-ref", version: sr.version, total: dirs.length, valid, invalid },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  console.log(`  report -> ${jsonOut}`);
}

process.exit(invalid.length === 0 ? 0 : 1);
