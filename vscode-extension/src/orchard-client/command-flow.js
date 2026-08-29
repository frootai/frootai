// @ts-check
/**
 * A5.21 — Pure command-flow logic for the 4 Orchard commands.
 *
 * Each `plan*` function takes the parsed user choices + an orchard-client +
 * an auth snapshot, and returns a structured plan object:
 *
 *   { ok: true, kind: "install"|"diff"|"bushel-add"|"...",
 *     steps: [...], confirm_message?: "...", warning?: "..." }
 * OR
 *   { ok: false, error_code: "...", hint: "..." }
 *
 * The thin VSCode wrapper takes that plan, shows the confirm dialog +
 * progress UI, and calls the client. The plan→execution split is what
 * makes this testable in plain Node.
 *
 * Doctrine:
 *   - NEVER throws. Auth/network failures → ok:false with error_code+hint.
 *   - Auth-gated flows (install --upgrade-to-play, diff --apply) check the
 *     A5.22 auth snapshot for the `upgrade-to-play` entitlement BEFORE
 *     issuing the call. This prevents a wasted network round-trip + gives
 *     the UI a chance to show an "upgrade now" CTA inline.
 *   - All commands surface a structured `confirm_message` so the VSCode
 *     wrapper can show a modal dialog with a deterministic preview of
 *     what's about to happen.
 */
"use strict";

const path = require("node:path");

const UPGRADE_ENTITLEMENT = "upgrade-to-play";
const BUSHEL_SYNC_ENTITLEMENT = "bushel-sync";

const ERR_NO_FRUIT = "no_fruit_id";
const ERR_NO_WORKSPACE = "no_workspace_open";
const ERR_NOT_SIGNED_IN = "not_signed_in";
const ERR_TOKEN_EXPIRED = "token_expired";
const ERR_ENTITLEMENT_REQUIRED = "entitlement_required";
const ERR_INVALID_PLAY_ID = "invalid_play_id";

const PLAY_ID_RE = /^[0-9]{2}$/;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Pure: validate fruit id shape (slug pattern allowed: `owner/repo` or `slug`).
 *
 * @param {unknown} id
 * @returns {boolean}
 */
function isValidFruitId(id) {
  if (typeof id !== "string" || id.length === 0 || id.length > 256) return false;
  // Allow letters/numbers/dashes/underscores/dots/slashes/colons
  return /^[a-zA-Z0-9._\-/:]+$/.test(id);
}

/**
 * Pure: validate that a play id matches `^[0-9]{2}$`.
 *
 * @param {unknown} id
 * @returns {boolean}
 */
function isValidPlayId(id) {
  return typeof id === "string" && PLAY_ID_RE.test(id);
}

/**
 * Pure: assert the snapshot is signed in + non-expired + has the entitlement.
 * Returns {ok:true} OR {ok:false, error_code, hint}.
 *
 * @param {object} snapshot
 * @param {string} entitlement
 * @returns {{ok: true} | {ok: false, error_code: string, hint: string}}
 */
function requireEntitlement(snapshot, entitlement) {
  if (!snapshot || snapshot.anonymous) {
    return {
      ok: false,
      error_code: ERR_NOT_SIGNED_IN,
      hint: "Run `frootai login` in a terminal to sign in, then refresh the Orchard view.",
    };
  }
  // Check expired BEFORE the generic signed_in check so users with an
  // expired token get the "refresh your token" hint, not the "sign in" hint.
  if (snapshot.expired) {
    return {
      ok: false,
      error_code: ERR_TOKEN_EXPIRED,
      hint: "Your access token has expired. Run `frootai login` to refresh it.",
    };
  }
  if (!snapshot.signed_in) {
    return {
      ok: false,
      error_code: ERR_NOT_SIGNED_IN,
      hint: "Run `frootai login` in a terminal to sign in, then refresh the Orchard view.",
    };
  }
  if (!Array.isArray(snapshot.entitlements) || !snapshot.entitlements.includes(entitlement)) {
    return {
      ok: false,
      error_code: ERR_ENTITLEMENT_REQUIRED,
      hint: `This action requires the "${entitlement}" entitlement. Upgrade at https://frootai.dev/upgrade`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Plan builders — pure, NEVER touch IO themselves
// ---------------------------------------------------------------------------

/**
 * Plan a `frootai orchard install` flow.
 *
 * @param {object} input
 * @param {string} input.fruitId
 * @param {string} [input.workspacePath]
 * @param {string} [input.playId]              when present → `--upgrade-to-play <id>` path
 * @param {boolean} [input.force]
 * @param {boolean} [input.dryRun]
 * @param {object} [input.authSnapshot]
 * @returns {object}  Plan
 */
function planInstall(input) {
  const i = input || {};
  if (!isValidFruitId(i.fruitId)) {
    return { ok: false, error_code: ERR_NO_FRUIT, hint: "Pick an accelerator from the Orchard tree." };
  }
  if (!i.workspacePath || typeof i.workspacePath !== "string") {
    return { ok: false, error_code: ERR_NO_WORKSPACE, hint: "Open a folder in VSCode before installing." };
  }
  const wantsPlay = typeof i.playId === "string" && i.playId.length > 0;
  if (wantsPlay && !isValidPlayId(i.playId)) {
    return { ok: false, error_code: ERR_INVALID_PLAY_ID, hint: 'Play id must be two digits (e.g. "01").' };
  }
  if (wantsPlay) {
    const check = requireEntitlement(i.authSnapshot, UPGRADE_ENTITLEMENT);
    if (!check.ok) return check;
  }
  /** @type {Record<string, unknown>} */
  const flags = { "target-dir": i.workspacePath };
  if (i.force) flags.force = true;
  if (i.dryRun) flags["dry-run"] = true;
  if (wantsPlay) flags["upgrade-to-play"] = i.playId;
  return {
    ok: true,
    kind: wantsPlay ? "install-with-play" : "install",
    fruit_id: i.fruitId,
    play_id: wantsPlay ? i.playId : null,
    workspace: i.workspacePath,
    confirm_message: wantsPlay
      ? `Install "${i.fruitId}" with Play ${i.playId} into ${i.workspacePath}?`
      : `Install "${i.fruitId}" into ${i.workspacePath}?`,
    steps: wantsPlay
      ? ["Verify entitlement", "Clone fruit", "Write fai-manifest.json", "Drop Play recipe", "Detect + run hooks (advisory)"]
      : ["Clone fruit", "Write fai-manifest.json"],
    call: {
      subcommand: "install",
      positional: [i.fruitId],
      flags,
    },
    requires_entitlement: wantsPlay ? UPGRADE_ENTITLEMENT : null,
  };
}

/**
 * Plan a `frootai orchard diff --target ... --apply` flow.
 *
 * @param {object} input
 * @param {string} input.fruitId
 * @param {string} input.playId
 * @param {string} input.workspacePath
 * @param {boolean} [input.apply]
 * @param {boolean} [input.force]
 * @param {object} [input.authSnapshot]
 * @returns {object}
 */
function planDiff(input) {
  const i = input || {};
  if (!isValidFruitId(i.fruitId)) {
    return { ok: false, error_code: ERR_NO_FRUIT, hint: "Pick an accelerator from the Orchard tree." };
  }
  if (!isValidPlayId(i.playId)) {
    return { ok: false, error_code: ERR_INVALID_PLAY_ID, hint: 'Play id must be two digits (e.g. "01").' };
  }
  if (!i.workspacePath || typeof i.workspacePath !== "string") {
    return { ok: false, error_code: ERR_NO_WORKSPACE, hint: "Open a folder in VSCode before diffing." };
  }
  if (i.apply) {
    const check = requireEntitlement(i.authSnapshot, UPGRADE_ENTITLEMENT);
    if (!check.ok) return check;
  }
  /** @type {Record<string, unknown>} */
  const flags = { target: i.workspacePath };
  if (i.apply) flags.apply = true;
  if (i.force) flags.force = true;
  flags["upgrade-to-play"] = i.playId;
  return {
    ok: true,
    kind: i.apply ? "diff-apply" : "diff-preview",
    fruit_id: i.fruitId,
    play_id: i.playId,
    workspace: i.workspacePath,
    confirm_message: i.apply
      ? `Apply Play ${i.playId} to "${i.fruitId}" in ${i.workspacePath}? (Files may be overwritten.)`
      : `Preview Play ${i.playId} diff against "${i.fruitId}" — no files will be modified.`,
    steps: i.apply
      ? ["Verify entitlement", "Load recipe", "Compute diff", "Write changed files"]
      : ["Load recipe", "Compute diff", "Render preview"],
    call: {
      subcommand: "diff",
      positional: [i.fruitId],
      flags,
    },
    requires_entitlement: i.apply ? UPGRADE_ENTITLEMENT : null,
  };
}

/**
 * Plan a `frootai orchard bushel add` flow.
 *
 * @param {object} input
 * @param {string} input.fruitId
 * @param {object} [input.authSnapshot]
 * @returns {object}
 */
function planBushelAdd(input) {
  const i = input || {};
  if (!isValidFruitId(i.fruitId)) {
    return { ok: false, error_code: ERR_NO_FRUIT, hint: "Pick an accelerator from the Orchard tree." };
  }
  // Bushel basics are free (local file). Cross-machine sync requires bushel-sync
  // entitlement — we DO NOT block the local add on that. The CLI will handle
  // the sync side server-side.
  return {
    ok: true,
    kind: "bushel-add",
    fruit_id: i.fruitId,
    confirm_message: null,   // no confirm — single-keystroke action
    steps: ["Add to ~/.frootai/bushels.json"],
    call: {
      subcommand: "bushel",
      positional: ["add", i.fruitId],
      flags: {},
    },
    requires_entitlement: null,
    sync_available: !!(i.authSnapshot && Array.isArray(i.authSnapshot.entitlements) && i.authSnapshot.entitlements.includes(BUSHEL_SYNC_ENTITLEMENT)),
  };
}

/**
 * Plan a "show details" flow — used by tree-node click. Free + no validation
 * beyond fruit id shape.
 *
 * @param {object} input
 * @param {string} input.fruitId
 * @returns {object}
 */
function planShow(input) {
  const i = input || {};
  if (!isValidFruitId(i.fruitId)) {
    return { ok: false, error_code: ERR_NO_FRUIT, hint: "Pick an accelerator from the Orchard tree." };
  }
  return {
    ok: true,
    kind: "show",
    fruit_id: i.fruitId,
    confirm_message: null,
    steps: ["Fetch manifest", "Render detail"],
    call: {
      subcommand: "show",
      positional: [i.fruitId],
      flags: {},
    },
    requires_entitlement: null,
  };
}

// ---------------------------------------------------------------------------
// Executor — runs a plan via the client; NEVER throws.
// ---------------------------------------------------------------------------

/**
 * Execute a plan against the orchard-client.
 *
 * @param {object} plan
 * @param {object} client
 * @returns {Promise<{ok: boolean, exitCode: number, output: string, parsed: unknown, plan_kind: string}>}
 */
async function executePlan(plan, client) {
  if (!plan || plan.ok !== true || !plan.call) {
    return {
      ok: false,
      exitCode: 1,
      output: plan && plan.hint ? plan.hint : "invalid plan",
      parsed: null,
      plan_kind: (plan && plan.kind) || "unknown",
    };
  }
  if (!client || typeof client.call !== "function") {
    return {
      ok: false,
      exitCode: 1,
      output: "orchard-client missing",
      parsed: null,
      plan_kind: plan.kind,
    };
  }
  let result;
  try {
    result = await client.call({ ...plan.call, json: true });
  } catch (e) {
    return {
      ok: false,
      exitCode: 2,
      output: e instanceof Error ? e.message : String(e),
      parsed: null,
      plan_kind: plan.kind,
    };
  }
  return {
    ok: !!result.ok,
    exitCode: result.exitCode,
    output: result.output,
    parsed: result.parsed,
    plan_kind: plan.kind,
  };
}

module.exports = {
  // Plan builders
  planInstall,
  planDiff,
  planBushelAdd,
  planShow,
  // Executor
  executePlan,
  // Pure helpers
  isValidFruitId,
  isValidPlayId,
  requireEntitlement,
  // Constants
  UPGRADE_ENTITLEMENT,
  BUSHEL_SYNC_ENTITLEMENT,
  PLAY_ID_RE,
  ERR_NO_FRUIT,
  ERR_NO_WORKSPACE,
  ERR_NOT_SIGNED_IN,
  ERR_TOKEN_EXPIRED,
  ERR_ENTITLEMENT_REQUIRED,
  ERR_INVALID_PLAY_ID,
};
