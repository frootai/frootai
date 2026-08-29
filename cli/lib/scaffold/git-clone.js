// @ts-check
/**
 * A4.13 — Real git clone engine for the FAI Orchard scaffolder.
 *
 * Doctrine:
 *   - Shells out to `git` via child_process — the standard convention.
 *     Alternatives (libgit2 bindings, isomorphic-git) would add native deps
 *     or 1+ MB of JS. `git` is universally installed; if it isn't, we surface
 *     a clear error pointing at install docs.
 *   - Pinned to `--depth 1` + `--single-branch` for fast clones (RAG repos
 *     can be 100 MB+ with full history).
 *   - Optional `--branch <branch>` when accelerator has non-default branch.
 *   - `--no-tags` to skip release tag fetching (we don't need them).
 *   - Output captured + surfaced on failure (so users see "Permission denied
 *     (publickey)" or "Repository not found" verbatim from git).
 *   - Target dir must NOT exist OR must be empty — `git clone` refuses
 *     otherwise; we pre-check + emit a clean error.
 *   - INJECTABLE spawnImpl so tests don't actually clone the internet.
 *
 * Failure codes:
 *   - git_not_installed     — spawn ENOENT on `git`
 *   - target_not_empty      — target exists and has files
 *   - clone_failed          — git exited non-zero (stderr captured in .context)
 *   - timeout               — clone exceeded budget (default 10 min)
 *
 * Test design: defaultDeps inject {spawn, existsSync, readdir} so the unit
 * suite can simulate git success / git failure / git missing / dirty target
 * without touching the network or filesystem.
 */
"use strict";

const fs = require("node:fs");
const fsP = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { OrchardCliError } = require("../orchard/cli-error");

const DEFAULT_CLONE_TIMEOUT_MS = 10 * 60_000;
const DEFAULT_GIT_BIN = "git";

/**
 * Pure: build the argv for git clone.
 * @param {string} url
 * @param {string} dest
 * @param {object} [opts]
 * @returns {string[]}
 */
function buildGitCloneArgs(url, dest, opts) {
  const o = opts || {};
  const args = ["clone", "--no-tags"];
  if (o.depth === undefined || o.depth === null || o.depth > 0) {
    args.push("--depth", String(o.depth || 1));
    args.push("--single-branch");
  }
  if (o.branch && typeof o.branch === "string" && o.branch.length > 0) {
    args.push("--branch", o.branch);
  }
  // Disable any interactive prompts (avoids hung process on bad credentials).
  args.push("--config", "core.askPass=");
  args.push(url, dest);
  return args;
}

/** Pure: validate clone URL — reject obviously-malformed inputs (allow http(s) + ssh + git). */
function isValidCloneUrl(url) {
  if (!url || typeof url !== "string" || url.length === 0 || url.length > 2048) return false;
  if (/[\r\n\0]/.test(url)) return false; // no control chars
  // Allow https://, http://, ssh://, git://, git@host:owner/repo style
  return /^(https?:\/\/|ssh:\/\/|git:\/\/|git@[A-Za-z0-9._-]+:)/.test(url);
}

/** Check whether dest exists + is empty (or doesn't exist at all). */
async function isCleanTarget(dest, deps) {
  const d = deps || {};
  const existsImpl = d.existsSync || fs.existsSync;
  const readdirImpl = d.readdir || fsP.readdir;
  if (!existsImpl(dest)) return true;
  try {
    const entries = await readdirImpl(dest);
    return entries.length === 0;
  } catch (err) {
    // If readdir fails for any reason other than "not a dir", treat as not-clean (caller errors out).
    if (err && /** @type {any} */(err).code === "ENOTDIR") {
      return false; // a file exists at dest path
    }
    throw new OrchardCliError("io_error",
      `failed to inspect target dir ${dest}: ${err instanceof Error ? err.message : String(err)}`,
      { path: dest });
  }
}

/**
 * Run git clone.
 *
 * @param {object} opts
 * @param {string} opts.url
 * @param {string} opts.dest
 * @param {string} [opts.branch]
 * @param {number} [opts.depth]
 * @param {number} [opts.timeoutMs]
 * @param {string} [opts.gitBin]
 * @param {boolean} [opts.force]      if true, accepts non-empty target (skips pre-check)
 * @param {object} [deps]
 * @param {Function} [deps.spawnImpl]
 * @param {Function} [deps.existsSync]
 * @param {Function} [deps.readdir]
 * @returns {Promise<{exitCode: number, stdout: string, stderr: string, dest: string}>}
 */
async function gitClone(opts, deps) {
  if (!opts || typeof opts !== "object") {
    throw new OrchardCliError("invalid_input", "gitClone requires opts {url, dest, ...}", {});
  }
  if (!isValidCloneUrl(opts.url)) {
    throw new OrchardCliError("invalid_input",
      `Invalid git URL: ${JSON.stringify(opts.url)}`,
      { hint: "Must be https://, http://, ssh://, git://, or git@host:owner/repo style" });
  }
  if (!opts.dest || typeof opts.dest !== "string") {
    throw new OrchardCliError("invalid_input", "gitClone requires opts.dest", {});
  }

  const d = deps || {};
  const spawnImpl = d.spawnImpl || spawn;
  const timeoutMs = opts.timeoutMs || DEFAULT_CLONE_TIMEOUT_MS;
  const gitBin = opts.gitBin || DEFAULT_GIT_BIN;

  // Pre-flight: target must be clean (unless force).
  if (!opts.force) {
    const clean = await isCleanTarget(opts.dest, d);
    if (!clean) {
      throw new OrchardCliError("target_not_empty",
        `Target dir ${opts.dest} is not empty. Re-run with --force to overwrite (only the new files will be written; existing files are left alone unless overwritten).`,
        { path: opts.dest });
    }
  }

  const args = buildGitCloneArgs(opts.url, opts.dest, { branch: opts.branch, depth: opts.depth });

  return new Promise((resolve, reject) => {
    const stdoutChunks = [];
    const stderrChunks = [];
    let settled = false;
    let timer;

    let child;
    try {
      child = spawnImpl(gitBin, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          // Avoid interactive prompts on bad credentials / unknown hosts.
          ...process.env,
          GIT_TERMINAL_PROMPT: "0",
          GIT_ASKPASS: "echo",
        },
      });
    } catch (err) {
      return reject(new OrchardCliError("git_not_installed",
        `Failed to spawn '${gitBin}': ${err instanceof Error ? err.message : String(err)}. Install git from https://git-scm.com/downloads.`,
        { gitBin }));
    }

    const settle = (fn) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      fn();
    };

    if (child.stdout) child.stdout.on("data", (chunk) => stdoutChunks.push(String(chunk)));
    if (child.stderr) child.stderr.on("data", (chunk) => stderrChunks.push(String(chunk)));

    child.on("error", (err) => {
      settle(() => {
        const code = err && /** @type {any} */(err).code;
        if (code === "ENOENT") {
          return reject(new OrchardCliError("git_not_installed",
            `git command not found. Install git from https://git-scm.com/downloads.`,
            { gitBin, originalCode: code }));
        }
        reject(new OrchardCliError("clone_failed",
          `git clone failed: ${err && err.message ? err.message : String(err)}`,
          { gitBin, originalCode: code }));
      });
    });

    child.on("exit", (exitCode, signal) => {
      settle(() => {
        const stdout = stdoutChunks.join("");
        const stderr = stderrChunks.join("");
        if (exitCode === 0) {
          resolve({ exitCode: 0, stdout, stderr, dest: opts.dest });
          return;
        }
        reject(new OrchardCliError("clone_failed",
          `git clone exited with code ${exitCode}${signal ? ` (signal ${signal})` : ""}.\n${stderr.trim() || stdout.trim() || "(no output)"}`,
          { exitCode, signal, stderr: stderr.slice(-4096), stdout: stdout.slice(-2048), url: opts.url, dest: opts.dest }));
      });
    });

    timer = setTimeout(() => {
      try { child.kill("SIGTERM"); } catch { /* */ }
      settle(() => {
        reject(new OrchardCliError("timeout",
          `git clone timed out after ${Math.round(timeoutMs / 1000)}s for ${opts.url}`,
          { url: opts.url, dest: opts.dest, timeoutMs }));
      });
    }, timeoutMs);
  });
}

module.exports = {
  DEFAULT_CLONE_TIMEOUT_MS,
  DEFAULT_GIT_BIN,
  buildGitCloneArgs,
  isValidCloneUrl,
  isCleanTarget,
  gitClone,
};
