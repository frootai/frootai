// @ts-check
/**
 * [Z8.2] `frootai lean <path>` — compile a local markdown file to its lossless
 * Lean form, locally, with no network.
 *
 * The transform is the deterministic LOSSLESS floor — the same whitespace
 * reclaim the MCP `leanCompact` ([Z6.2]) applies and the engine's Lean compiler
 * uses as its safe baseline: strip trailing whitespace per line, collapse 3+
 * blank lines to one, and normalise the leading/trailing edges. NO semantic
 * change — guardrails, parameters, and code blocks are untouched.
 *
 * Honesty: this reports the measured BYTE saving. The exact token saving is a
 * build-time o200k_base measurement (see the website `/lean` benchmark); the
 * CLI ships no tokenizer, so it does not fabricate a token number here.
 */
"use strict";

const fsP = require("node:fs/promises");
const path = require("node:path");

/**
 * Lossless whitespace reclaim — deterministic, idempotent, no semantic change.
 * Ported verbatim from the MCP `leanCompact` so the CLI and MCP agree byte-for-byte.
 * @param {string} text
 * @returns {string}
 */
function leanCompact(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/[ \t]+$/gm, "") // strip trailing spaces/tabs per line
    .replace(/\n{3,}/g, "\n\n") // collapse 3+ newlines to one blank line
    .replace(/^\n+/, "") // drop leading blank lines
    .replace(/\s+$/, "\n"); // exactly one trailing newline
}

/**
 * Derive the Lean output path for a source file:
 * - `foo.md`       → `foo.lean.md`
 * - `foo.lean.md`  → `foo.lean.md` (already lean — compiled in place)
 * - `foo.txt`      → `foo.txt.lean.md`
 * @param {string} srcPath
 * @returns {string}
 */
function leanOutPath(srcPath) {
  if (srcPath.endsWith(".lean.md")) return srcPath;
  if (srcPath.endsWith(".md")) return `${srcPath.slice(0, -3)}.lean.md`;
  return `${srcPath}.lean.md`;
}

/**
 * Measured byte savings of a Full → Lean compile.
 * @param {string} full
 * @param {string} lean
 */
function computeSavings(full, lean) {
  const bytesFull = Buffer.byteLength(full, "utf8");
  const bytesLean = Buffer.byteLength(lean, "utf8");
  const savedBytes = bytesFull - bytesLean;
  const savedPct = bytesFull > 0 ? Math.round((savedBytes / bytesFull) * 1000) / 10 : 0;
  return { bytesFull, bytesLean, savedBytes, savedPct };
}

/**
 * Compile a local markdown file to its lossless Lean form.
 * @param {{ srcPath: string, outPath?: string, write?: boolean,
 *   readFile?: (p: string, enc: string) => Promise<string>,
 *   writeFile?: (p: string, data: string, enc: string) => Promise<void> }} opts
 */
async function compileLean(opts) {
  const {
    srcPath,
    outPath,
    write = true,
    readFile = fsP.readFile,
    writeFile = fsP.writeFile,
  } = opts || {};
  if (!srcPath) throw new Error("a source file path is required");
  const full = await readFile(srcPath, "utf8");
  const lean = leanCompact(full);
  const savings = computeSavings(full, lean);
  const dest = outPath || leanOutPath(srcPath);
  if (write) {
    await fsP.mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, lean, "utf8");
  }
  return { lean, dest, savings };
}

module.exports = { leanCompact, leanOutPath, computeSavings, compileLean };
