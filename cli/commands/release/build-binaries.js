// @ts-check
/**
 * [H8.18] build-binaries.js — standalone-binary build matrix + manifest.
 *
 * Contract (verbatim from masterplan §3 row [H8.18]):
 *   Standalone binaries via `pkg` or `bun build --compile`:
 *   `frootai-linux-x64`, `frootai-macos-arm64`, `frootai-macos-x64`,
 *   `frootai-windows-x64`; built in CI; sha256 published per release
 *
 * Library module that the CI workflow `.github/workflows/build-binaries.yml`
 * consumes to know WHAT to build, HOW to build it, and HOW to publish
 * the sha256 manifest. NOT a command handler — there's no `frootai
 * build-binaries` subcommand (the build runs in CI, not on a user's
 * machine; running pkg or bun-compile against a local repo is a
 * developer convenience the bin-reconciliation sub-phase can add).
 *
 * **The 4-target matrix is FROZEN** at the exact names the masterplan
 * row pins. Each target has:
 *   - `name` — the binary filename WITHOUT extension (so `.exe` only
 *     attached on win32 at packaging time)
 *   - `runner` — the GitHub Actions runs-on label
 *   - `pkgTarget` — Vercel pkg target triplet (`node20-linux-x64`)
 *   - `bunTarget` — bun's compile target triplet
 *     (`bun-linux-x64`)
 *   - `os` / `arch` — Node `process.platform` / `process.arch` values
 *   - `extension` — `.exe` on win32; empty elsewhere
 *
 * **Two builders supported** — the masterplan §3 wording is "via `pkg`
 * OR `bun build --compile`". `buildCommand({target, tool, entry, outDir})`
 * returns the exact `argv[]` for whichever tool the operator picks. Today
 * the CI defaults to `pkg` (mature, well-known); a future ship can flip
 * `DEFAULT_TOOL` to `bun` once Bun cross-compile matures further.
 *
 * **sha256 manifest** — after CI builds the 4 binaries, the workflow
 * passes the file paths to `buildShaManifest(files, {readFile?})` which
 * returns:
 *   {
 *     schema_version: 1,
 *     generated_at: <ISO>,
 *     cli_version: <from package.json>,
 *     items: [{ name, size_bytes, sha256 }, ...],
 *   }
 * The manifest is published alongside the binaries on the GitHub release
 * (and uploaded to the npm registry under `dist/binaries/`). Per
 * masterplan: "sha256 published per release".
 *
 * **Public API:**
 *   - `BUILD_TARGETS` — frozen 4-entry array
 *   - `TOOLS` — `["pkg", "bun"]`
 *   - `DEFAULT_TOOL` — `"pkg"`
 *   - `findTarget(nameOrTriplet)` — case-insensitive lookup
 *   - `binaryFilename(target)` — name + extension
 *   - `buildCommand({target, tool, entry, outDir})` — returns argv[]
 *   - `buildPkgCommand` / `buildBunCommand` — internal but exported for
 *     direct use
 *   - `sha256OfBuffer(buf)` — pure
 *   - `buildShaManifest(files, opts)` — pure (uses readFile injection)
 *   - `formatShaTextFile(manifest)` — pure; emits `sha256 <hex>  <name>`
 *     lines compatible with `sha256sum -c`
 *
 * License: CC0-1.0.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const SCHEMA_VERSION = 1;
const NODE_TARGET = "node20"; // pkg's --targets uses node major
const DEFAULT_TOOL = "pkg";
const TOOLS = Object.freeze(["pkg", "bun"]);

/**
 * FROZEN matrix of the 4 binaries the masterplan row pins. The order
 * here is intentionally `linux-x64, macos-arm64, macos-x64, windows-x64`
 * matching the masterplan §3 row enumeration so the release notes stay
 * alphabetically grouped by OS.
 */
const BUILD_TARGETS = Object.freeze([
  Object.freeze({
    name: "frootai-linux-x64",
    runner: "ubuntu-latest",
    pkgTarget: `${NODE_TARGET}-linux-x64`,
    bunTarget: "bun-linux-x64",
    os: "linux",
    arch: "x64",
    extension: "",
  }),
  Object.freeze({
    name: "frootai-macos-arm64",
    runner: "macos-14",   // Apple-silicon runner
    pkgTarget: `${NODE_TARGET}-macos-arm64`,
    bunTarget: "bun-darwin-arm64",
    os: "darwin",
    arch: "arm64",
    extension: "",
  }),
  Object.freeze({
    name: "frootai-macos-x64",
    runner: "macos-13",   // Intel mac runner
    pkgTarget: `${NODE_TARGET}-macos-x64`,
    bunTarget: "bun-darwin-x64",
    os: "darwin",
    arch: "x64",
    extension: "",
  }),
  Object.freeze({
    name: "frootai-windows-x64",
    runner: "windows-latest",
    pkgTarget: `${NODE_TARGET}-win-x64`,
    bunTarget: "bun-windows-x64",
    os: "win32",
    arch: "x64",
    extension: ".exe",
  }),
]);

/** Error carrying a sysexits exit code. */
class BuildBinariesError extends Error {
  /**
   * @param {string} code @param {string} message
   * @param {{ exitCode?: number, cause?: Error }} [opts]
   */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "BuildBinariesError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : 70;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Find a BUILD_TARGETS entry by name (exact, case-insensitive) OR by
 * pkg/bun triplet. Returns null when not found.
 *
 * @param {string|null|undefined} input
 * @returns {object|null}
 */
function findTarget(input) {
  if (typeof input !== "string" || input.length === 0) return null;
  const lc = input.toLowerCase();
  for (const t of BUILD_TARGETS) {
    if (t.name.toLowerCase() === lc) return t;
    if (t.pkgTarget.toLowerCase() === lc) return t;
    if (t.bunTarget.toLowerCase() === lc) return t;
  }
  return null;
}

/**
 * Compose the binary filename for a target — name + extension (`.exe`
 * on win32; empty elsewhere). Pure.
 *
 * @param {{name: string, extension: string}} target
 * @returns {string}
 */
function binaryFilename(target) {
  if (!target || typeof target.name !== "string") {
    throw new BuildBinariesError("invalid_target", "binaryFilename requires a target object with .name", { exitCode: 64 });
  }
  return `${target.name}${target.extension || ""}`;
}

/**
 * Build the pkg argv. The CI workflow runs this as
 * `npx ${argv.join(" ")}`. Pure.
 *
 * @param {object} opts — `{target, entry, outDir}`
 * @returns {string[]}
 */
function buildPkgCommand(opts) {
  const { target, entry, outDir } = opts || {};
  if (!target || typeof target.pkgTarget !== "string") {
    throw new BuildBinariesError("invalid_target", "buildPkgCommand requires a target with .pkgTarget", { exitCode: 64 });
  }
  if (typeof entry !== "string" || entry.length === 0) {
    throw new BuildBinariesError("invalid_entry", "buildPkgCommand requires opts.entry", { exitCode: 64 });
  }
  if (typeof outDir !== "string" || outDir.length === 0) {
    throw new BuildBinariesError("invalid_out", "buildPkgCommand requires opts.outDir", { exitCode: 64 });
  }
  const outPath = path.posix.join(outDir.replace(/\\/g, "/"), binaryFilename(target));
  return [
    "pkg",
    entry,
    "--targets", target.pkgTarget,
    "--output", outPath,
    "--compress", "GZip",
  ];
}

/**
 * Build the bun argv. The CI runs `bun ${argv.join(" ")}`. Pure.
 *
 * @param {object} opts — `{target, entry, outDir}`
 * @returns {string[]}
 */
function buildBunCommand(opts) {
  const { target, entry, outDir } = opts || {};
  if (!target || typeof target.bunTarget !== "string") {
    throw new BuildBinariesError("invalid_target", "buildBunCommand requires a target with .bunTarget", { exitCode: 64 });
  }
  if (typeof entry !== "string" || entry.length === 0) {
    throw new BuildBinariesError("invalid_entry", "buildBunCommand requires opts.entry", { exitCode: 64 });
  }
  if (typeof outDir !== "string" || outDir.length === 0) {
    throw new BuildBinariesError("invalid_out", "buildBunCommand requires opts.outDir", { exitCode: 64 });
  }
  const outPath = path.posix.join(outDir.replace(/\\/g, "/"), binaryFilename(target));
  return [
    "build",
    entry,
    "--compile",
    "--target", target.bunTarget,
    "--outfile", outPath,
    "--minify",
  ];
}

/**
 * Build the command argv for whichever tool the operator chose. Pure.
 *
 * @param {object} opts — `{target, tool?, entry, outDir}`
 * @returns {{ tool: string, argv: string[] }}
 */
function buildCommand(opts) {
  const tool = (opts && typeof opts.tool === "string") ? opts.tool.toLowerCase() : DEFAULT_TOOL;
  if (!TOOLS.includes(tool)) {
    throw new BuildBinariesError(
      "unknown_tool",
      `unknown tool "${tool}" (one of: ${TOOLS.join(", ")})`,
      { exitCode: 64 },
    );
  }
  const argv = tool === "bun" ? buildBunCommand(opts) : buildPkgCommand(opts);
  return { tool, argv };
}

/** Pure — sha256 hex digest of a Buffer or string. */
function sha256OfBuffer(input) {
  const hash = crypto.createHash("sha256");
  hash.update(input);
  return hash.digest("hex");
}

/**
 * Build the sha256 manifest given a list of binary file paths. Pure +
 * injectable. The `readFile` impl receives an absolute path and MUST
 * return a Buffer (NOT utf8) — binaries aren't text.
 *
 * @param {string[]} files — absolute paths to built binaries
 * @param {object} [opts]
 * @param {(p: string) => Buffer} [opts.readFile]
 * @param {string} [opts.cliVersion]
 * @param {string} [opts.generatedAtIso]
 * @returns {{ schema_version: number, generated_at: string, cli_version: string|null, items: Array<{ name: string, size_bytes: number, sha256: string }> }}
 */
function buildShaManifest(files, opts = {}) {
  if (!Array.isArray(files)) {
    throw new BuildBinariesError("invalid_files", "buildShaManifest requires files: string[]", { exitCode: 64 });
  }
  const readFile = opts.readFile || ((p) => fs.readFileSync(p));
  const items = [];
  for (const f of files) {
    if (typeof f !== "string" || f.length === 0) {
      throw new BuildBinariesError("invalid_file_entry", `each file must be a non-empty string (got: ${typeof f})`, { exitCode: 64 });
    }
    const buf = readFile(f);
    if (!Buffer.isBuffer(buf)) {
      throw new BuildBinariesError("invalid_read", `readFile(${f}) must return a Buffer`, { exitCode: 70 });
    }
    items.push({
      name: path.basename(f),
      size_bytes: buf.length,
      sha256: sha256OfBuffer(buf),
    });
  }
  // Byte-stable name sort for deterministic manifest output
  items.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return {
    schema_version: SCHEMA_VERSION,
    generated_at: typeof opts.generatedAtIso === "string" && opts.generatedAtIso.length > 0
      ? opts.generatedAtIso
      : new Date().toISOString(),
    cli_version: typeof opts.cliVersion === "string" && opts.cliVersion.length > 0 ? opts.cliVersion : null,
    items,
  };
}

/**
 * Emit a `sha256sum -c`-compatible text file from a manifest. One line
 * per item: `<hex>  <name>` (two spaces — the sha256sum format). Pure.
 *
 * @param {ReturnType<typeof buildShaManifest>} manifest
 * @returns {string}
 */
function formatShaTextFile(manifest) {
  if (!manifest || !Array.isArray(manifest.items)) {
    throw new BuildBinariesError("invalid_manifest", "formatShaTextFile requires a manifest with items[]", { exitCode: 64 });
  }
  const lines = [];
  for (const it of manifest.items) {
    if (!it || typeof it.sha256 !== "string" || typeof it.name !== "string") continue;
    lines.push(`${it.sha256}  ${it.name}`);
  }
  return lines.join("\n") + (lines.length > 0 ? "\n" : "");
}

/**
 * Build the verify-installation snippet a release-notes generator can
 * paste under each binary's download link. Pure.
 *
 * @param {{ name: string, sha256: string }} item
 * @returns {string}
 */
function buildVerifyInstructions(item) {
  if (!item || typeof item.name !== "string" || typeof item.sha256 !== "string") {
    throw new BuildBinariesError("invalid_item", "buildVerifyInstructions requires { name, sha256 }", { exitCode: 64 });
  }
  return [
    `# Verify ${item.name}`,
    `echo "${item.sha256}  ${item.name}" | sha256sum -c -`,
  ].join("\n");
}

module.exports = {
  SCHEMA_VERSION,
  NODE_TARGET,
  DEFAULT_TOOL,
  TOOLS,
  BUILD_TARGETS,
  BuildBinariesError,
  findTarget,
  binaryFilename,
  buildPkgCommand,
  buildBunCommand,
  buildCommand,
  sha256OfBuffer,
  buildShaManifest,
  formatShaTextFile,
  buildVerifyInstructions,
};
