// @ts-check
/**
 * FAI CLI auth — A4.10 dispatcher for top-level login/logout/whoami subcommands.
 *
 * Invoked from bin.js via `frootai login`, `frootai logout`, `frootai whoami`.
 *
 * Design: matches the orchard/dispatch.js shape (returns {exitCode, output}) so
 * tests can drive it without spawning the bin. All IO is injectable via `deps`.
 *
 * Subcommands:
 *   login    — opens browser to frootai.dev/login + polls until token arrives
 *   logout   — clears token + clears last_user in config (preserves anonymous_mode + first_run_at)
 *   whoami   — prints current auth state (subject, email, tier, expires_at)
 */
"use strict";

const os = require("node:os");
const { parseArgs } = require("../orchard/arg-parser");
const { OrchardCliError } = require("../orchard/cli-error");
const { color, status, renderKeyValue } = require("../orchard/output");
const {
  generateState,
  buildLoginUrl,
  openBrowser,
  pollForToken,
  DEFAULT_LOGIN_BASE_URL,
} = require("./login");
const {
  readConfigFile,
  updateConfig,
} = require("./config-store");
const {
  clearEntitlementsCache,
} = require("./entitlements");
const { createIdentityCoordinator } = require("../agent/identity-coordinator.js");

const AUTH_COMMANDS = Object.freeze(["login", "logout", "whoami"]);

/** Render a one-paragraph auth-help block. */
function renderAuthHelp(opts) {
  const o = opts || {};
  const lines = [];
  lines.push("");
  lines.push(color("bold", "frootai auth — sign in for Pro features", o));
  lines.push("");
  lines.push(color("dim", "  Free commands work without sign-in. Sign in to unlock paid Plays + bushel sync.", o));
  lines.push("");
  lines.push(color("bold", "Commands:", o));
  lines.push(`  ${color("cyan", "frootai login   ", o)}${color("dim", "Open browser to sign in (device-code flow)", o)}`);
  lines.push(`  ${color("cyan", "frootai logout  ", o)}${color("dim", "Clear local token + cached entitlements", o)}`);
  lines.push(`  ${color("cyan", "frootai whoami  ", o)}${color("dim", "Show current sign-in + tier", o)}`);
  lines.push("");
  return lines.join("\n");
}

// ─── login ─────────────────────────────────────────────────────────

async function execLogin(args, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));
  const colorOpts = { color: !args["no-color"] };

  const coordinator = d.identityCoordinator || createIdentityCoordinator({
    now: d.now,
    tokenBackend: d.tokenBackend,
    tokenPath: d.tokenPath,
    credentialsOptions: { backend: d.credentialsBackend, path: d.credentialsPath },
    entitlementStore: { clear: () => (d.clearEntitlementsCache || clearEntitlementsCache)(d.entitlementsCachePath) },
    sessionStore: d.sessionStore,
    organizationStore: d.organizationStore,
    identityState: d.identityState,
    configCoordinator: d.configCoordinator,
    operationLock: d.identityOperationLock,
    legacyConfigStore: d.legacyConfigStore || {
      clearLoginHints: () => (d.updateConfig || updateConfig)({ anonymous_mode: false, last_user: null, last_user_email: null }, { configPath: d.configPath, nowIso: d.nowIso }),
      clearAccountHints: () => (d.updateConfig || updateConfig)({ anonymous_mode: true, last_user: null, last_user_email: null }, { configPath: d.configPath, nowIso: d.nowIso }),
    },
  });
  let reservation;
  try { reservation = await coordinator.prepareLogin(); }
  catch { throw new OrchardCliError("identity_login_failed", "Local identity preparation failed."); }

  const state = generateState(undefined, d.rng);
  const loginUrl = buildLoginUrl({
    state,
    device: d.hostname || os.hostname(),
    baseUrl: d.loginBaseUrl,
  });

  // Open browser (best-effort).
  const openResult = await (d.openBrowser || openBrowser)(loginUrl, { spawnImpl: d.spawnImpl, platform: d.platform });

  const lines = [];
  lines.push("");
  lines.push(status("info", "Sign in to FrootAI", colorOpts));
  lines.push("");
  if (openResult.opened) {
    lines.push(`  ${color("dim", "Opened your browser to:", colorOpts)} ${color("cyan", loginUrl, colorOpts)}`);
  } else {
    lines.push(`  ${color("yellow", "Couldn't open your browser automatically.", colorOpts)}`);
    lines.push(`  ${color("dim", "Open this URL manually:", colorOpts)}`);
    lines.push(`    ${color("cyan", loginUrl, colorOpts)}`);
  }
  lines.push("");
  lines.push(`  ${color("dim", "Waiting for sign-in to complete (timeout 5 minutes)…", colorOpts)}`);
  log(lines.join("\n"));

  // Poll for token.
  const { token } = await (d.pollForToken || pollForToken)({
    state,
    pollUrlBase: d.pollUrlBase,
    intervalMs: d.intervalMs,
    timeoutMs: d.timeoutMs,
    requestTimeoutMs: d.requestTimeoutMs,
    fetchImpl: d.fetchImpl,
    sleepImpl: d.sleepImpl,
    now: d.now,
  });

  let completion;
  try { completion = await coordinator.completeLogin(token, reservation); }
  catch { throw new OrchardCliError("identity_login_failed", "Sign-in completed, but local identity activation failed."); }
  if (completion.status !== "authenticated") {
    throw new OrchardCliError("identity_login_failed", "Sign-in completed, but local identity activation failed.");
  }

  const successLines = [];
  successLines.push("");
  successLines.push(status("ok", "Signed in", colorOpts));
  successLines.push(renderKeyValue([
    { label: "Tier", value: token.tier || "free" },
    { label: "Expires", value: token.expires_at || color("dim", "(never)", colorOpts) },
  ], colorOpts));
  successLines.push("");
  successLines.push(color("dim", "  Run `frootai whoami` any time to see current sign-in.", colorOpts));
  const out = successLines.join("\n");
  log(out);
  return { exitCode: 0, output: out, identity: { status: "authenticated", tier: token.tier === "enterprise" ? "enterprise" : token.tier === "free" ? "free" : "paid" } };
}

// ─── logout ────────────────────────────────────────────────────────

async function execLogout(args, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));
  const colorOpts = { color: !args["no-color"] };

  const coordinator = d.identityCoordinator || createIdentityCoordinator({
    now: d.now,
    tokenBackend: d.tokenBackend,
    tokenPath: d.tokenPath,
    credentialsOptions: { backend: d.credentialsBackend, path: d.credentialsPath },
    entitlementStore: { clear: () => (d.clearEntitlementsCache || clearEntitlementsCache)(d.entitlementsCachePath) },
    sessionStore: d.sessionStore,
    organizationStore: d.organizationStore,
    identityState: d.identityState,
    configCoordinator: d.configCoordinator,
    operationLock: d.identityOperationLock,
    legacyConfigStore: d.legacyConfigStore || {
      clearAccountHints: () => (d.updateConfig || updateConfig)({
        anonymous_mode: true,
        last_user: null,
        last_user_email: null,
      }, { configPath: d.configPath, nowIso: d.nowIso }),
    },
    revoke: d.revoke,
  });
  const result = await coordinator.logout();
  const lines = [];
  if (result.localPurge === "complete") {
    lines.push(status("ok", `Signed out locally. Server revocation: ${result.revocation}.`, colorOpts));
  } else {
    lines.push(status("warn", `Local sign-out is partial. Server revocation: ${result.revocation}.`, colorOpts));
  }
  const out = lines.join("\n");
  log(out);
  return { exitCode: result.localPurge === "complete" ? 0 : 1, output: out, localPurge: result.localPurge, revocation: result.revocation };
}

// ─── whoami ────────────────────────────────────────────────────────

async function execWhoami(args, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));
  const colorOpts = { color: !args["no-color"] };

  const coordinator = d.identityCoordinator || createIdentityCoordinator({
    now: d.now,
    tokenBackend: d.tokenBackend,
    tokenPath: d.tokenPath,
    credentialsOptions: { backend: d.credentialsBackend, path: d.credentialsPath },
    verifiedOrganizationResolver: d.verifiedOrganizationResolver,
    identityState: d.identityState,
    sessionStore: d.sessionStore,
    organizationStore: d.organizationStore,
    configCoordinator: d.configCoordinator,
    operationLock: d.identityOperationLock,
    legacyConfigStore: d.legacyConfigStore,
  });
  const identity = await coordinator.resolveIdentity({ autoMigrate: true });
  const cfg = await (d.readConfig || readConfigFile)({ configPath: d.configPath, nowIso: d.nowIso });

  if (identity.status === "anonymous") {
    const lines = [];
    lines.push("");
    lines.push(status("info", "Not signed in (anonymous mode)", colorOpts));
    lines.push("");
    lines.push(renderKeyValue([
      { label: "Anonymous mode", value: cfg.anonymous_mode ? "yes" : "no" },
      { label: "Telemetry opt-in", value: cfg.telemetry_opt_in ? "yes" : "no" },
      { label: "First run", value: cfg.first_run_at || color("dim", "(unknown)", colorOpts) },
    ], colorOpts));
    lines.push("");
    lines.push(color("dim", "  Run `frootai login` to sign in.", colorOpts));
    if (args.json) {
      const j = JSON.stringify({ signed_in: false, identity, config: { anonymous_mode: cfg.anonymous_mode, telemetry_opt_in: cfg.telemetry_opt_in, first_run_at: cfg.first_run_at } }, null, 2);
      log(j);
      return { exitCode: 0, output: j, signed_in: false };
    }
    const out = lines.join("\n");
    log(out);
    return { exitCode: 0, output: out, signed_in: false };
  }

  if (args.json) {
    const j = JSON.stringify({
      signed_in: identity.status === "authenticated",
      identity,
      config: { anonymous_mode: cfg.anonymous_mode, telemetry_opt_in: cfg.telemetry_opt_in, first_run_at: cfg.first_run_at },
    }, null, 2);
    log(j);
    return { exitCode: 0, output: j, signed_in: identity.status === "authenticated" };
  }

  const lines = [];
  lines.push("");
  if (identity.status === "expired") {
    lines.push(status("warn", "Sign-in expired", colorOpts));
    lines.push(color("dim", "  Run `frootai login` to refresh.", colorOpts));
  } else {
    lines.push(status(identity.status === "authenticated" ? "ok" : "warn", identity.status === "authenticated" ? "Signed in" : "Identity conflict", colorOpts));
  }
  lines.push("");
  lines.push(renderKeyValue([
    { label: "Identity", value: identity.status },
    { label: "Principal", value: identity.principalType },
    { label: "Tier", value: identity.tier },
    { label: "Credentials", value: identity.credentialGeneration },
    { label: "Organization context", value: identity.organization.status },
    { label: "Telemetry opt-in", value: cfg.telemetry_opt_in ? "yes" : "no" },
  ], colorOpts));
  lines.push("");

  const out = lines.join("\n");
  log(out);
  return { exitCode: 0, output: out, signed_in: true };
}

// ─── Dispatcher ────────────────────────────────────────────────────

const AUTH_EXECS = Object.freeze({
  login: execLogin,
  logout: execLogout,
  whoami: execWhoami,
});

/**
 * Dispatch a top-level auth subcommand.
 *
 * @param {string} sub   one of "login" | "logout" | "whoami"
 * @param {string[]} argv  remaining argv after sub
 * @param {object} [deps]  injection
 * @returns {Promise<{exitCode: number, output: string}>}
 */
async function dispatchAuth(sub, argv, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));
  const err = d.err || ((s) => process.stderr.write(s + "\n"));
  const args = parseArgs(argv || []);
  const exec = AUTH_EXECS[sub];
  if (!exec) {
    const msg = status("error", `Unknown auth subcommand: "${sub}"`) + "\n" + renderAuthHelp({ color: !args["no-color"] });
    err(msg);
    return { exitCode: 1, output: msg };
  }
  try {
    return await exec(args, d);
  } catch (e) {
    if (e instanceof OrchardCliError) {
      const lines = [];
      lines.push(status("error", `${e.code}: ${e.message}`));
      if (e.context && typeof e.context === "object" && e.context.hint) {
        lines.push(`  ${color("dim", "Hint:")} ${e.context.hint}`);
      }
      const msg = lines.join("\n");
      err(msg);
      return { exitCode: 1, output: msg };
    }
    const stack = (e && e.stack) ? e.stack : String(e);
    const msg = status("error", `Unexpected error: ${e instanceof Error ? e.message : String(e)}`) +
      (process.env.DEBUG ? "\n" + stack : "");
    err(msg);
    return { exitCode: 2, output: msg };
  }
}

module.exports = {
  AUTH_COMMANDS,
  AUTH_EXECS,
  dispatchAuth,
  renderAuthHelp,
  execLogin,
  execLogout,
  execWhoami,
};
