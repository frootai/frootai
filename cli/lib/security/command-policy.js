// @ts-check
"use strict";

const POLICY_VERSION = 1;
const EXTERNAL_APPROVAL_FLAG = "--confirm-external";
const FORCE_APPROVAL_FLAG = "--confirm-force";

const RISK = Object.freeze({
  READ: "read",
  LOCAL_WRITE: "local-write",
  EXTERNAL_MUTATION: "external-mutation",
});

function has(argv, value) {
  return argv.includes(value);
}

function classifyCommand(argv, env = process.env) {
  const command = argv[0] || "help";
  const subcommand = argv[1] || null;
  const dryRun = has(argv, "--dry-run") || env.FROOTAI_DRY_RUN === "1";

  if (command === "agent") {
    return require("../agent/command-registry.generated.js").classify(argv.slice(1));
  }

  if ((command === "ship" || command === "release") && !dryRun) {
    return { risk: RISK.EXTERNAL_MUTATION, operation: `release.${subcommand || "unknown"}` };
  }
  if (command === "factory" && subcommand === "ship" && !dryRun) {
    return { risk: RISK.EXTERNAL_MUTATION, operation: `factory.ship.${argv[2] || "unknown"}` };
  }
  if (command === "engine" && subcommand === "commit" && has(argv, "--upgrade-to-play") && !dryRun) {
    return { risk: RISK.EXTERNAL_MUTATION, operation: "engine.commit.publish" };
  }
  if (command === "update" && has(argv, "--apply") && !dryRun) {
    return { risk: RISK.EXTERNAL_MUTATION, operation: "update.apply" };
  }

  const localWrite =
    ((command === "ship" || command === "release") && dryRun) ||
    command === "scaffold" ||
    command === "install" ||
    (command === "lean" && !has(argv, "--stdout")) ||
    (command === "factory" && !["status", "validate", "diff", null].includes(subcommand)) ||
    (command === "engine" && !["--help", "-h", null].includes(subcommand)) ||
    (command === "orchard" && ["install", "pollinate", "bushel"].includes(subcommand)) ||
    (command === "mcp" && ["attach", "detach", "trust", "publish"].includes(subcommand)) ||
    (command === "config" && subcommand === "set") ||
    (command === "docs" && subcommand === "generate" && !has(argv, "--dry-run")) ||
    (command === "update" && has(argv, "--apply")) ||
    (command === "telemetry" && ["on", "off", "reset", "export"].includes(subcommand)) ||
    ["login", "logout"].includes(command);

  return localWrite
    ? { risk: RISK.LOCAL_WRITE, operation: `${command}.${subcommand || "run"}` }
    : { risk: RISK.READ, operation: `${command}.${subcommand || "run"}` };
}

function authorizeCommand(argv, env = process.env) {
  const cleanedArgv = argv[0] === "agent" ? [...argv] : argv.filter((arg) => arg !== EXTERNAL_APPROVAL_FLAG && arg !== FORCE_APPROVAL_FLAG);
  const classified = classifyCommand(cleanedArgv, env);
  const ciApproval = env.CI === "true" && env.FROOTAI_APPROVE_EXTERNAL === "1";
  const externalApproval = has(argv, EXTERNAL_APPROVAL_FLAG) || ciApproval;
  const forceApproval = has(argv, FORCE_APPROVAL_FLAG) || (ciApproval && env.FROOTAI_APPROVE_FORCE === "1");

  if (classified.risk === RISK.EXTERNAL_MUTATION && !externalApproval) {
    return {
      ...classified,
      policyVersion: POLICY_VERSION,
      allowed: false,
      exitCode: 77,
      reason: `external mutation requires ${EXTERNAL_APPROVAL_FLAG} (interactive) or CI=true with FROOTAI_APPROVE_EXTERNAL=1`,
      argv: cleanedArgv,
    };
  }
  if (classified.risk === RISK.EXTERNAL_MUTATION && has(cleanedArgv, "--force") && !forceApproval) {
    return {
      ...classified,
      policyVersion: POLICY_VERSION,
      allowed: false,
      exitCode: 77,
      reason: `forced external mutation also requires ${FORCE_APPROVAL_FLAG} or FROOTAI_APPROVE_FORCE=1 in approved CI`,
      argv: cleanedArgv,
    };
  }
  return {
    ...classified,
    policyVersion: POLICY_VERSION,
    allowed: true,
    exitCode: 0,
    reason: classified.risk === RISK.EXTERNAL_MUTATION ? "explicit approval verified" : "policy allows operation",
    argv: cleanedArgv,
  };
}

module.exports = {
  POLICY_VERSION,
  EXTERNAL_APPROVAL_FLAG,
  FORCE_APPROVAL_FLAG,
  RISK,
  classifyCommand,
  authorizeCommand,
};