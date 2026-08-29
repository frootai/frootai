// @ts-check
/**
 * [H8.22] homebrew-tap.js — Homebrew tap formula renderer + publish helper.
 *
 * Contract (verbatim from masterplan §3 row [H8.22]):
 *   Homebrew tap: `homebrew-frootai` repo with `frootai.rb` formula;
 *   `brew tap frootai/frootai && brew install frootai`
 *
 * Pure rendering library (no shelling out, no side effects). Fifth
 * release lib after H8.18/H8.19/H8.20/H8.21. The CI workflow runs the
 * H8.18 binary build first; this library then renders the new
 * `frootai.rb` formula referencing the GitHub Release URLs + sha256
 * digests, and the publish job commits the rendered file to the
 * separate `homebrew-frootai` repo via `git push`.
 *
 * **brew tap mechanics (per masterplan):** Homebrew's "tap" convention
 * maps `frootai/frootai` → the GitHub repo `frootai/homebrew-frootai`
 * (note the `homebrew-` prefix is REQUIRED + stripped at tap time). A
 * tap repo contains one `Formula/<name>.rb` per package. The user runs:
 *   $ brew tap frootai/frootai
 *   $ brew install frootai
 * brew clones the tap repo into
 * `$(brew --prefix)/Library/Taps/frootai/homebrew-frootai`, then
 * resolves `frootai` to `Formula/frootai.rb` inside it.
 *
 * **Bottle vs source formula (key doctrine):** the masterplan-pinned
 * artifact path is the H8.18 standalone binary, NOT a build-from-source
 * recipe. The formula MUST download the prebuilt macOS binaries
 * `frootai-macos-arm64` + `frootai-macos-x64` from the GitHub Release,
 * verify sha256, install via a 1-line `bin.install` block. This is
 * what Homebrew calls an "URL + sha256 + install" formula (NOT a
 * bottle, which is a tarball with Homebrew-internal metadata). The
 * formula uses `on_arm`/`on_intel` blocks to ship the right binary per
 * machine.
 *
 * **Public API:**
 *   - `DEFAULT_TAP_USER` — `"frootai"` (masterplan: `frootai/frootai`)
 *   - `DEFAULT_FORMULA_NAME` — `"frootai"`
 *   - `DEFAULT_HOMEPAGE` — `"https://frootai.dev"`
 *   - `DEFAULT_LICENSE` — `"CC0-1.0"`
 *   - `BOTTLE_BINARY_BY_ARCH` — `{arm64: "frootai-macos-arm64",
 *      x64: "frootai-macos-x64"}` — maps brew arch → H8.18 binary name
 *   - `validateFormulaInputs(opts)` — `{ok, missing[], present[]}`
 *   - `buildReleaseDownloadUrl({owner, repo, version, binaryName})` —
 *      canonical GitHub Releases asset URL
 *   - `renderFormula({name, version, description, homepage, license,
 *      bottles: [{arch, url, sha256}], caveats?})` — emits the .rb file
 *   - `buildGitConfigCommands({userName?, userEmail?})` — sets identity
 *      on the tap-clone runner
 *   - `buildTapCheckoutCommand({tapDir, owner?, repo?})` — clones
 *      `<owner>/homebrew-<owner>` (with the masterplan-required
 *      `homebrew-` prefix already attached)
 *   - `buildTapCommitCommands({tapDir, formulaName, version})` —
 *      2-step `git add Formula/<name>.rb` + `git commit -m "..."`
 *   - `buildTapPushCommand({tapDir, branch?})` — `git push origin <branch>`
 *   - `buildBrewInstallSnippet({tapUser?, formulaName?})` — user-facing
 *      `brew tap` + `brew install` blurb for release notes / docs
 *   - `parseGitCommitOutput(stdout)` — `{ok, sha?, error?}` — extracts
 *      the new commit's SHA from `git commit` stdout
 *
 * **Frozen exit codes:** library throws HomebrewTapError with sysexits
 * exit codes per orchard-handler doctrine.
 *
 * License: CC0-1.0.
 */
"use strict";

const path = require("node:path");

const DEFAULT_TAP_USER = "frootai";
const DEFAULT_FORMULA_NAME = "frootai";
const DEFAULT_HOMEPAGE = "https://frootai.dev";
const DEFAULT_LICENSE = "CC0-1.0";
const DEFAULT_DESCRIPTION = "FrootAI CLI — repo-to-solution-play converter";

/**
 * Map of brew arch token → H8.18 BUILD_TARGETS binary name. Brew's
 * `on_arm`/`on_intel` blocks address arm64 + x86_64 respectively.
 */
const BOTTLE_BINARY_BY_ARCH = Object.freeze({
  arm64: "frootai-macos-arm64",
  x64: "frootai-macos-x64",
});

/** sha256 hex-digest pattern: exactly 64 lowercase hex chars (Homebrew
 *  convention is lowercase; the sha256sums.txt from H8.18 emits lower). */
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

/** GitHub Releases URL builder regex anchor (defensive). */
const SEMVER_PATTERN = /^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

/** Default git user identity for the tap-commit step. */
const DEFAULT_GIT_USER_NAME = "frootai-release-bot";
const DEFAULT_GIT_USER_EMAIL = "noreply@frootai.dev";

/** Error carrying a sysexits exit code. */
class HomebrewTapError extends Error {
  /**
   * @param {string} code @param {string} message
   * @param {{ exitCode?: number, cause?: Error }} [opts]
   */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "HomebrewTapError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : 70;
    if (opts.cause) this.cause = opts.cause;
  }
}

/**
 * Pure — true when value is a 64-char lowercase hex sha256 digest.
 * Homebrew's formula-style strings are lowercase by convention.
 *
 * @param {string|null|undefined} sha
 */
function isValidSha256(sha) {
  if (typeof sha !== "string") return false;
  return SHA256_PATTERN.test(sha);
}

/**
 * Pure — true when value looks like a semver (with optional `v` prefix
 * + optional prerelease/build).
 *
 * @param {string|null|undefined} version
 */
function isValidVersion(version) {
  if (typeof version !== "string") return false;
  return SEMVER_PATTERN.test(version);
}

/**
 * Strip a leading `v` from a version string. Homebrew formula bodies
 * use the bare-number form (`1.2.3`), but the release-tag input is
 * usually `v1.2.3`. Pure.
 *
 * @param {string} version
 */
function stripVPrefix(version) {
  if (typeof version !== "string") return version;
  return version.replace(/^v/i, "");
}

/**
 * Pure — build the canonical GitHub Release asset URL for one binary.
 *
 *   https://github.com/<owner>/<repo>/releases/download/<tag>/<binary>
 *
 * The tag is `cli-v<ver>` per H8.18 doctrine (matches the workflow
 * trigger pattern). Caller passes `tag` directly when not following
 * that convention (e.g. one-off releases).
 *
 * @param {object} opts — `{owner, repo, version, binaryName, tag?}`
 * @returns {string}
 */
function buildReleaseDownloadUrl(opts) {
  const o = opts || {};
  if (typeof o.owner !== "string" || o.owner.length === 0) {
    throw new HomebrewTapError("bad_owner", "buildReleaseDownloadUrl requires owner", { exitCode: 64 });
  }
  if (typeof o.repo !== "string" || o.repo.length === 0) {
    throw new HomebrewTapError("bad_repo", "buildReleaseDownloadUrl requires repo", { exitCode: 64 });
  }
  if (typeof o.binaryName !== "string" || o.binaryName.length === 0) {
    throw new HomebrewTapError("bad_binary", "buildReleaseDownloadUrl requires binaryName", { exitCode: 64 });
  }
  if (!o.tag && !isValidVersion(o.version)) {
    throw new HomebrewTapError("bad_version", "buildReleaseDownloadUrl requires version OR tag", { exitCode: 64 });
  }
  const tag = typeof o.tag === "string" && o.tag.length > 0
    ? o.tag
    : `cli-v${stripVPrefix(o.version)}`;
  return `https://github.com/${o.owner}/${o.repo}/releases/download/${tag}/${o.binaryName}`;
}

/**
 * Validate the inputs `renderFormula` needs. Returns `{ok, missing[],
 * present[]}`. Pure.
 *
 * @param {object} opts
 */
function validateFormulaInputs(opts) {
  const o = opts || {};
  const required = ["name", "version", "bottles"];
  const missing = [];
  const present = [];
  for (const k of required) {
    if (k === "bottles") {
      if (Array.isArray(o.bottles) && o.bottles.length > 0) present.push(k);
      else missing.push(k);
    } else {
      const v = o[k];
      if (typeof v === "string" && v.length > 0) present.push(k);
      else missing.push(k);
    }
  }
  return { ok: missing.length === 0, missing, present };
}

/**
 * Pure — render the `frootai.rb` Homebrew formula body. Emits the
 * canonical "URL + sha256 + bin.install" shape with `on_macos` +
 * `on_arm`/`on_intel` per-arch dispatch.
 *
 * The class name follows Homebrew's Ruby convention:
 * `Formula/frootai.rb` → `class Frootai < Formula`. Multi-word names
 * are PascalCased (`my-tool` → `class MyTool`).
 *
 * @param {object} opts — `{name, version, description?, homepage?,
 *   license?, bottles: [{arch, url, sha256}], caveats?, head?}`
 * @returns {string}
 */
function renderFormula(opts) {
  const o = opts || {};
  const v = validateFormulaInputs(o);
  if (!v.ok) {
    throw new HomebrewTapError(
      "bad_inputs",
      `renderFormula missing: ${v.missing.join(", ")}`,
      { exitCode: 64 },
    );
  }
  const name = String(o.name).trim();
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    throw new HomebrewTapError("bad_name", `formula name must be lowercase-kebab (got "${name}")`, { exitCode: 64 });
  }
  const version = stripVPrefix(o.version);
  if (!isValidVersion(o.version) && !isValidVersion(version)) {
    throw new HomebrewTapError("bad_version", `bad version "${o.version}"`, { exitCode: 64 });
  }
  const className = name
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  const description = (typeof o.description === "string" && o.description.length > 0
    ? o.description : DEFAULT_DESCRIPTION)
    .replace(/"/g, '\\"');
  const homepage = typeof o.homepage === "string" && o.homepage.length > 0 ? o.homepage : DEFAULT_HOMEPAGE;
  const license = typeof o.license === "string" && o.license.length > 0 ? o.license : DEFAULT_LICENSE;

  // Validate every bottle entry.
  /** @type {Record<string, { url: string, sha256: string }>} */
  const byArch = {};
  for (const b of o.bottles) {
    if (!b || typeof b.arch !== "string") {
      throw new HomebrewTapError("bad_bottle", "each bottle entry must have arch", { exitCode: 64 });
    }
    if (!Object.prototype.hasOwnProperty.call(BOTTLE_BINARY_BY_ARCH, b.arch)) {
      throw new HomebrewTapError(
        "bad_arch",
        `bottle arch must be one of: ${Object.keys(BOTTLE_BINARY_BY_ARCH).join(", ")} (got "${b.arch}")`,
        { exitCode: 64 },
      );
    }
    if (typeof b.url !== "string" || b.url.length === 0) {
      throw new HomebrewTapError("bad_bottle_url", `bottle[${b.arch}] missing url`, { exitCode: 64 });
    }
    if (!isValidSha256(b.sha256)) {
      throw new HomebrewTapError(
        "bad_bottle_sha",
        `bottle[${b.arch}] sha256 must be 64 lowercase hex chars (got "${b.sha256}")`,
        { exitCode: 64 },
      );
    }
    byArch[b.arch] = { url: b.url, sha256: b.sha256 };
  }
  if (!byArch.arm64 || !byArch.x64) {
    throw new HomebrewTapError("missing_bottle",
      "renderFormula requires bottles for BOTH arm64 AND x64 (Homebrew formula needs per-arch dispatch)",
      { exitCode: 64 });
  }

  const lines = [];
  lines.push(`# typed: false`);
  lines.push(`# frozen_string_literal: true`);
  lines.push(``);
  lines.push(`# Auto-generated by H8.22 renderFormula (frootai-core/cli/commands/release/homebrew-tap.js).`);
  lines.push(`# Do NOT edit by hand — the release workflow regenerates this file on every cli-v* tag.`);
  lines.push(``);
  lines.push(`class ${className} < Formula`);
  lines.push(`  desc "${description}"`);
  lines.push(`  homepage "${homepage}"`);
  lines.push(`  version "${version}"`);
  lines.push(`  license "${license}"`);
  lines.push(``);
  lines.push(`  on_macos do`);
  lines.push(`    on_arm do`);
  lines.push(`      url "${byArch.arm64.url}"`);
  lines.push(`      sha256 "${byArch.arm64.sha256}"`);
  lines.push(``);
  lines.push(`      def install`);
  lines.push(`        bin.install "${BOTTLE_BINARY_BY_ARCH.arm64}" => "${name}"`);
  lines.push(`      end`);
  lines.push(`    end`);
  lines.push(``);
  lines.push(`    on_intel do`);
  lines.push(`      url "${byArch.x64.url}"`);
  lines.push(`      sha256 "${byArch.x64.sha256}"`);
  lines.push(``);
  lines.push(`      def install`);
  lines.push(`        bin.install "${BOTTLE_BINARY_BY_ARCH.x64}" => "${name}"`);
  lines.push(`      end`);
  lines.push(`    end`);
  lines.push(`  end`);
  lines.push(``);
  lines.push(`  test do`);
  lines.push(`    assert_match version.to_s, shell_output("#{bin}/${name} --version")`);
  lines.push(`  end`);

  if (typeof o.caveats === "string" && o.caveats.length > 0) {
    const caveatBody = o.caveats.split("\n").map((line) => `      ${line}`).join("\n");
    lines.push(``);
    lines.push(`  def caveats`);
    lines.push(`    <<~EOS`);
    lines.push(caveatBody);
    lines.push(`    EOS`);
    lines.push(`  end`);
  }

  lines.push(`end`);
  lines.push(``);
  return lines.join("\n");
}

/**
 * Build the formula on-disk path relative to the tap-repo root:
 *   `Formula/<name>.rb`
 * Homebrew taps look for `Formula/<formula>.rb` (capital F is the
 * convention; lowercase `formula/` also works but git tooling assumes
 * the capital).
 *
 * @param {string} name @returns {string}
 */
function formulaRelPath(name) {
  if (typeof name !== "string" || !/^[a-z][a-z0-9-]*$/.test(name)) {
    throw new HomebrewTapError("bad_name", "formulaRelPath requires lowercase-kebab name", { exitCode: 64 });
  }
  return path.posix.join("Formula", `${name}.rb`);
}

/**
 * Build the `git config` argv pair to set the runner identity on the
 * tap-clone before any commits land. Returns `[{argv}, {argv}]` so the
 * workflow runs both in order.
 *
 * @param {object} [opts] — `{userName?, userEmail?}`
 * @returns {Array<{ step: string, tool: string, argv: string[] }>}
 */
function buildGitConfigCommands(opts = {}) {
  const userName = typeof opts.userName === "string" && opts.userName.length > 0 ? opts.userName : DEFAULT_GIT_USER_NAME;
  const userEmail = typeof opts.userEmail === "string" && opts.userEmail.length > 0 ? opts.userEmail : DEFAULT_GIT_USER_EMAIL;
  return [
    { step: "git-config-name", tool: "git", argv: ["config", "user.name", userName] },
    { step: "git-config-email", tool: "git", argv: ["config", "user.email", userEmail] },
  ];
}

/**
 * Build the `git clone` argv to check out the tap repo. The masterplan
 * pins `homebrew-<user>` per Homebrew tap naming.
 *
 * @param {object} opts — `{tapDir, owner?, repo?, token?}`
 * @returns {{ tapRepoName: string, argv: string[] }}
 */
function buildTapCheckoutCommand(opts) {
  const o = opts || {};
  if (typeof o.tapDir !== "string" || o.tapDir.length === 0) {
    throw new HomebrewTapError("bad_dir", "buildTapCheckoutCommand requires tapDir", { exitCode: 64 });
  }
  const owner = typeof o.owner === "string" && o.owner.length > 0 ? o.owner : DEFAULT_TAP_USER;
  const repo = typeof o.repo === "string" && o.repo.length > 0 ? o.repo : `homebrew-${DEFAULT_TAP_USER}`;
  const url = typeof o.token === "string" && o.token.length > 0
    ? `https://x-access-token:${o.token}@github.com/${owner}/${repo}.git`
    : `https://github.com/${owner}/${repo}.git`;
  return {
    tapRepoName: `${owner}/${repo}`,
    argv: ["clone", "--depth", "1", url, o.tapDir],
  };
}

/**
 * Build the 2-step add+commit plan for landing a new formula version.
 *
 * @param {object} opts — `{tapDir, formulaName, version}`
 * @returns {Array<{ step: string, tool: string, argv: string[] }>}
 */
function buildTapCommitCommands(opts) {
  const o = opts || {};
  if (typeof o.tapDir !== "string" || o.tapDir.length === 0) {
    throw new HomebrewTapError("bad_dir", "buildTapCommitCommands requires tapDir", { exitCode: 64 });
  }
  if (typeof o.formulaName !== "string" || o.formulaName.length === 0) {
    throw new HomebrewTapError("bad_name", "buildTapCommitCommands requires formulaName", { exitCode: 64 });
  }
  if (typeof o.version !== "string" || o.version.length === 0) {
    throw new HomebrewTapError("bad_version", "buildTapCommitCommands requires version", { exitCode: 64 });
  }
  const v = stripVPrefix(o.version);
  const rel = formulaRelPath(o.formulaName);
  const msg = `chore(${o.formulaName}): bump to ${v}`;
  return [
    { step: "git-add", tool: "git", argv: ["-C", o.tapDir, "add", rel] },
    { step: "git-commit", tool: "git", argv: ["-C", o.tapDir, "commit", "-m", msg, "--allow-empty"] },
  ];
}

/**
 * Build the `git push` argv. Defaults to pushing the current branch
 * (which clone sets to the remote's default — usually `main`).
 *
 * @param {object} opts — `{tapDir, branch?}`
 */
function buildTapPushCommand(opts) {
  const o = opts || {};
  if (typeof o.tapDir !== "string" || o.tapDir.length === 0) {
    throw new HomebrewTapError("bad_dir", "buildTapPushCommand requires tapDir", { exitCode: 64 });
  }
  const branch = typeof o.branch === "string" && o.branch.length > 0 ? o.branch : "HEAD";
  return ["-C", o.tapDir, "push", "origin", branch];
}

/**
 * Pure — emit the user-facing brew install snippet for release notes
 * and the docs site.
 *
 * @param {object} [opts] — `{tapUser?, formulaName?}`
 * @returns {string}
 */
function buildBrewInstallSnippet(opts = {}) {
  const user = typeof opts.tapUser === "string" && opts.tapUser.length > 0 ? opts.tapUser : DEFAULT_TAP_USER;
  const formula = typeof opts.formulaName === "string" && opts.formulaName.length > 0 ? opts.formulaName : DEFAULT_FORMULA_NAME;
  return [
    "## macOS (Homebrew)",
    "",
    "```bash",
    `brew tap ${user}/${user}`,
    `brew install ${formula}`,
    "```",
    "",
    `Upgrade with \`brew upgrade ${formula}\`. The tap is at`,
    `<https://github.com/${user}/homebrew-${user}>.`,
  ].join("\n");
}

/**
 * Pure — extract the new commit SHA from `git commit -m ...` stdout.
 * Format on success:
 *   [main 7d4f3a9] chore(frootai): bump to 1.2.3
 *
 * @param {string|null|undefined} stdout
 * @returns {{ ok: boolean, sha: string|null, error: string|null }}
 */
function parseGitCommitOutput(stdout) {
  if (typeof stdout !== "string" || stdout.length === 0) {
    return { ok: false, sha: null, error: "empty git commit output" };
  }
  const m = /\[[^\s\]]+\s+([0-9a-f]{7,40})\]/i.exec(stdout);
  if (!m) {
    return { ok: false, sha: null, error: "git commit output did not contain a sha" };
  }
  return { ok: true, sha: m[1], error: null };
}

/**
 * Build the FULL publish-tap pipeline plan. Returns
 * `[{step, tool, argv}, ...]` in execution order. The CI runs them
 * sequentially against an ephemeral tap-clone working directory.
 *
 * Steps: clone → config-user-name → config-user-email → write-formula
 *         (no argv — caller writes the file itself) → add → commit → push
 *
 * The caller is responsible for the `write-formula` step (the library
 * returns a `{step: 'write-formula', tool: 'node', path, content}`
 * entry the workflow recognises + handles inline; we use `tool:'node'`
 * so the workflow's switch statement falls through to its own
 * write-file branch).
 *
 * @param {object} opts — `{tapDir, formula: {name, version, ...}, bottles, owner?, token?, gitUserName?, gitUserEmail?, branch?}`
 * @returns {Array<{ step: string, tool: string, argv?: string[], path?: string, content?: string }>}
 */
function buildPublishPipeline(opts) {
  const o = opts || {};
  if (typeof o.tapDir !== "string" || o.tapDir.length === 0) {
    throw new HomebrewTapError("bad_dir", "buildPublishPipeline requires tapDir", { exitCode: 64 });
  }
  if (!o.formula || typeof o.formula.name !== "string" || typeof o.formula.version !== "string") {
    throw new HomebrewTapError("bad_formula", "buildPublishPipeline requires formula with name + version", { exitCode: 64 });
  }
  const content = renderFormula({
    name: o.formula.name,
    version: o.formula.version,
    description: o.formula.description,
    homepage: o.formula.homepage,
    license: o.formula.license,
    bottles: o.bottles,
    caveats: o.formula.caveats,
  });
  const relPath = formulaRelPath(o.formula.name);
  const plan = [];
  const checkout = buildTapCheckoutCommand({
    tapDir: o.tapDir,
    owner: o.owner,
    repo: o.repo,
    token: o.token,
  });
  plan.push({ step: "git-clone", tool: "git", argv: checkout.argv });
  for (const cfg of buildGitConfigCommands({ userName: o.gitUserName, userEmail: o.gitUserEmail })) {
    plan.push({
      step: cfg.step,
      tool: cfg.tool,
      argv: ["-C", o.tapDir, ...cfg.argv],
    });
  }
  plan.push({
    step: "write-formula",
    tool: "node",
    path: path.posix.join(o.tapDir.replace(/\\/g, "/"), relPath),
    content,
  });
  for (const c of buildTapCommitCommands({
    tapDir: o.tapDir, formulaName: o.formula.name, version: o.formula.version,
  })) {
    plan.push(c);
  }
  plan.push({
    step: "git-push",
    tool: "git",
    argv: buildTapPushCommand({ tapDir: o.tapDir, branch: o.branch }),
  });
  return plan;
}

module.exports = {
  DEFAULT_TAP_USER,
  DEFAULT_FORMULA_NAME,
  DEFAULT_HOMEPAGE,
  DEFAULT_LICENSE,
  DEFAULT_DESCRIPTION,
  DEFAULT_GIT_USER_NAME,
  DEFAULT_GIT_USER_EMAIL,
  BOTTLE_BINARY_BY_ARCH,
  SHA256_PATTERN,
  SEMVER_PATTERN,
  HomebrewTapError,
  isValidSha256,
  isValidVersion,
  stripVPrefix,
  buildReleaseDownloadUrl,
  validateFormulaInputs,
  renderFormula,
  formulaRelPath,
  buildGitConfigCommands,
  buildTapCheckoutCommand,
  buildTapCommitCommands,
  buildTapPushCommand,
  buildBrewInstallSnippet,
  parseGitCommitOutput,
  buildPublishPipeline,
};
