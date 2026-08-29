// @ts-check
/**
 * [Z8.5] VS Code Lean compile + view toggle — PURE CORE (no `vscode` import).
 *
 * The thin command wrapper lives in `lean-compile.ts` (registers the two
 * commands against the VS Code API); this module holds the testable logic so
 * the gate (`scripts/orchard/test/vscode-mcp-lean-compile.test.js`) can verify
 * it with no editor host.
 *
 * The transform is the deterministic LOSSLESS floor — `leanCompact` ported
 * byte-for-byte from the MCP ([Z6.2]) / CLI ([Z8.2]) so every surface agrees.
 * Reports BYTE savings only; the exact token saving is the build-time
 * o200k_base measurement on the website `/lean` benchmark.
 */
"use strict";

/** Command ids — also declared in package.json `contributes.commands`. */
const LEAN_COMPILE_COMMAND = "frootai.lean.compile";
const LEAN_TOGGLE_COMMAND = "frootai.lean.toggleView";

/**
 * Lossless whitespace reclaim — deterministic, idempotent, no semantic change.
 * Identical to the MCP `leanCompact` and the CLI `leanCompact`.
 * @param {string} text
 * @returns {string}
 */
function leanCompact(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .replace(/\s+$/, "\n");
}

/**
 * Measured byte savings of a Full → Lean compile.
 * @param {string} full
 * @param {string} lean
 */
function computeLeanSavings(full, lean) {
  const bytesFull = Buffer.byteLength(String(full), "utf8");
  const bytesLean = Buffer.byteLength(String(lean), "utf8");
  const savedBytes = bytesFull - bytesLean;
  const savedPct = bytesFull > 0 ? Math.round((savedBytes / bytesFull) * 1000) / 10 : 0;
  return { bytesFull, bytesLean, savedBytes, savedPct };
}

/**
 * Derive the Lean output path for a source file:
 * `foo.md` → `foo.lean.md`, `foo.lean.md` stays, `foo.txt` → `foo.txt.lean.md`.
 * @param {string} srcPath
 * @returns {string}
 */
function leanOutPath(srcPath) {
  const p = String(srcPath || "");
  if (p.endsWith(".lean.md")) return p;
  if (p.endsWith(".md")) return `${p.slice(0, -".md".length)}.lean.md`;
  return `${p}.lean.md`;
}

/**
 * Toggle a path between its Full (`.md`) and Lean (`.lean.md`) variant.
 * @param {string} currentPath
 * @returns {{ path: string, mode: "lean" | "full" }}
 */
function toggleLeanPath(currentPath) {
  const p = String(currentPath || "");
  if (p.endsWith(".lean.md")) {
    return { path: `${p.slice(0, -".lean.md".length)}.md`, mode: "full" };
  }
  if (p.endsWith(".md")) {
    return { path: `${p.slice(0, -".md".length)}.lean.md`, mode: "lean" };
  }
  // Non-markdown: best-effort append (mirrors leanOutPath), opening the Lean view.
  return { path: `${p}.lean.md`, mode: "lean" };
}

/**
 * Human-readable savings line for the post-compile notification.
 * @param {{ bytesFull: number, bytesLean: number, savedBytes: number, savedPct: number }} s
 */
function formatSavings(s) {
  return s.savedBytes > 0
    ? `Lean saved ${s.savedBytes} bytes (~${s.savedPct}% · ${s.bytesFull}→${s.bytesLean}; exact token saving is build-time).`
    : `Already compact at ${s.bytesLean} bytes — Lean still wins on tokens (build-time).`;
}

/**
 * Gate helper: assert package.json declares both Lean commands with titles.
 * @param {{ contributes?: { commands?: Array<{ command: string, title?: string }> } }} pkg
 */
function checkLeanCommandsDeclared(pkg) {
  const commands = (pkg && pkg.contributes && pkg.contributes.commands) || [];
  /** @param {string} id */
  const find = (id) => commands.find((c) => c && c.command === id);
  const compile = find(LEAN_COMPILE_COMMAND);
  const toggle = find(LEAN_TOGGLE_COMMAND);
  return {
    compilePresent: Boolean(compile),
    togglePresent: Boolean(toggle),
    compileHasTitle: Boolean(compile && compile.title),
    toggleHasTitle: Boolean(toggle && toggle.title),
    ok: Boolean(compile && compile.title && toggle && toggle.title),
  };
}

module.exports = {
  LEAN_COMPILE_COMMAND,
  LEAN_TOGGLE_COMMAND,
  leanCompact,
  computeLeanSavings,
  leanOutPath,
  toggleLeanPath,
  formatSavings,
  checkLeanCommandsDeclared,
};
