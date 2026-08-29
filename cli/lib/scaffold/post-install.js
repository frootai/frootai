// @ts-check
/**
 * A4.18 — Post-install hooks.
 *
 * Doctrine:
 *   - Hooks are ADVISORY by default — we print the commands the user SHOULD run.
 *   - With `--run-hooks`, the engine actually executes them.
 *   - Hook resolution is driven by the fruit manifest's `deployment` block
 *     (set by the harvester in Phase A1) — same data that drives `frootai orchard show`.
 *   - Hooks NEVER block install success; they're a UX nudge after the scaffold lands.
 *
 * Supported hooks (v1):
 *   - azd_init       — when fruit.deployment.azd_template === true
 *   - npm_install    — when package.json present in target
 *   - pip_install    — when requirements.txt or pyproject.toml present in target
 *   - dotnet_restore — when *.csproj or *.sln present in target
 *
 * Each hook is { id, label, command, cwd, when, advisory_text }.
 *
 * Tests inject `existsSync` + `spawnImpl` to avoid real disk + process spawning.
 */
"use strict";

const fs = require("node:fs");
const { spawn } = require("node:child_process");
const path = require("node:path");
const { OrchardCliError } = require("../orchard/cli-error");

const HOOK_TIMEOUT_MS = 5 * 60_000;

/**
 * Pure: detect which hooks apply for the given fruit + target dir.
 * Returns an array of hook objects in deterministic order.
 *
 * @param {object} fruit
 * @param {string} targetDir
 * @param {object} [deps]
 * @param {Function} [deps.existsSync]
 */
function detectHooks(fruit, targetDir, deps) {
  if (!fruit || typeof fruit !== "object") {
    throw new OrchardCliError("invalid_input", "detectHooks requires fruit object", {});
  }
  if (!targetDir || typeof targetDir !== "string") {
    throw new OrchardCliError("invalid_input", "detectHooks requires targetDir string", {});
  }
  const d = deps || {};
  const existsImpl = d.existsSync || fs.existsSync;

  const hooks = [];
  const dep = (fruit && fruit.deployment) || {};

  if (dep.azd_template === true) {
    hooks.push({
      id: "azd_init",
      label: "Initialize Azure Developer CLI",
      command: "azd",
      args: ["init", "--from-code"],
      cwd: targetDir,
      when: "azd_template",
      advisory_text: `cd ${targetDir} && azd init --from-code`,
      doc_url: "https://learn.microsoft.com/azure/developer/azure-developer-cli/",
    });
  }
  if (existsImpl(path.join(targetDir, "package.json"))) {
    hooks.push({
      id: "npm_install",
      label: "Install Node.js dependencies",
      command: "npm",
      args: ["install"],
      cwd: targetDir,
      when: "package.json present",
      advisory_text: `cd ${targetDir} && npm install`,
      doc_url: "https://docs.npmjs.com/cli/install",
    });
  }
  if (
    existsImpl(path.join(targetDir, "requirements.txt")) ||
    existsImpl(path.join(targetDir, "pyproject.toml"))
  ) {
    const usingPyproject = existsImpl(path.join(targetDir, "pyproject.toml")) && !existsImpl(path.join(targetDir, "requirements.txt"));
    hooks.push({
      id: "pip_install",
      label: "Install Python dependencies",
      command: "pip",
      args: usingPyproject ? ["install", "-e", "."] : ["install", "-r", "requirements.txt"],
      cwd: targetDir,
      when: usingPyproject ? "pyproject.toml present" : "requirements.txt present",
      advisory_text: `cd ${targetDir} && pip install ${usingPyproject ? "-e ." : "-r requirements.txt"}`,
      doc_url: "https://pip.pypa.io/en/stable/cli/pip_install/",
    });
  }
  // .NET — match *.csproj or *.sln at root (cheap heuristic; deep scan would slow things).
  try {
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    if (entries.some((e) => e.isFile() && (e.name.endsWith(".csproj") || e.name.endsWith(".sln")))) {
      hooks.push({
        id: "dotnet_restore",
        label: "Restore .NET dependencies",
        command: "dotnet",
        args: ["restore"],
        cwd: targetDir,
        when: ".csproj or .sln present",
        advisory_text: `cd ${targetDir} && dotnet restore`,
        doc_url: "https://learn.microsoft.com/dotnet/core/tools/dotnet-restore",
      });
    }
  } catch { /* directory might not exist yet in --dry-run */ }

  return hooks;
}

/**
 * Run a single hook. Always returns an outcome — NEVER throws.
 * Failure surfaces in `outcome.ok === false` + `outcome.error`.
 */
async function runHook(hook, deps) {
  const d = deps || {};
  const spawnImpl = d.spawnImpl || spawn;
  const timeoutMs = d.timeoutMs || HOOK_TIMEOUT_MS;

  return new Promise((resolve) => {
    const stdoutChunks = [];
    const stderrChunks = [];
    let settled = false;
    let timer;

    let child;
    try {
      child = spawnImpl(hook.command, hook.args || [], {
        cwd: hook.cwd,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, CI: "1" },
      });
    } catch (err) {
      return resolve({
        ok: false,
        hook_id: hook.id,
        error: `failed to spawn ${hook.command}: ${err instanceof Error ? err.message : String(err)}`,
        not_installed: err && /** @type {any} */(err).code === "ENOENT",
      });
    }

    const settle = (outcome) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(outcome);
    };

    if (child.stdout) child.stdout.on("data", (c) => stdoutChunks.push(String(c)));
    if (child.stderr) child.stderr.on("data", (c) => stderrChunks.push(String(c)));

    child.on("error", (err) => {
      const code = err && /** @type {any} */(err).code;
      settle({
        ok: false,
        hook_id: hook.id,
        error: err && err.message ? err.message : String(err),
        not_installed: code === "ENOENT",
      });
    });

    child.on("exit", (exitCode, signal) => {
      const ok = exitCode === 0;
      settle({
        ok,
        hook_id: hook.id,
        exitCode,
        signal,
        stdout: stdoutChunks.join("").slice(-2048),
        stderr: stderrChunks.join("").slice(-4096),
      });
    });

    timer = setTimeout(() => {
      try { child.kill("SIGTERM"); } catch { /* */ }
      settle({
        ok: false,
        hook_id: hook.id,
        error: `hook timed out after ${Math.round(timeoutMs / 1000)}s`,
        timeout: true,
      });
    }, timeoutMs);
  });
}

/**
 * Run all hooks sequentially. Each outcome is collected; never throws.
 * Returns {outcomes, ran, failed, skipped_install_missing}.
 *
 * `runMode`:
 *   - "advisory" — does NOT run; returns outcomes with ran:false + advisory_text
 *   - "execute"  — actually runs each hook
 */
async function runHooks(hooks, opts, deps) {
  if (!Array.isArray(hooks)) {
    throw new OrchardCliError("invalid_input", "runHooks requires hooks array", {});
  }
  const o = opts || {};
  const mode = o.runMode === "execute" ? "execute" : "advisory";

  const outcomes = [];
  for (const hook of hooks) {
    if (mode === "advisory") {
      outcomes.push({ ok: true, hook_id: hook.id, ran: false, advisory_text: hook.advisory_text, advisory: true });
      continue;
    }
    const outcome = await runHook(hook, deps);
    outcomes.push({ ...outcome, ran: true, advisory: false });
  }
  return {
    mode,
    outcomes,
    ran: outcomes.filter((o) => o.ran && o.ok).length,
    failed: outcomes.filter((o) => o.ran && !o.ok).length,
    skipped_install_missing: outcomes.filter((o) => o.not_installed === true).length,
  };
}

module.exports = {
  HOOK_TIMEOUT_MS,
  detectHooks,
  runHook,
  runHooks,
};
