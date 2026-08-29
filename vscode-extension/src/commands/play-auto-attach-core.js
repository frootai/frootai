// @ts-check
/**
 * M5.18 — Auto-attach on Play open (pure core).
 *
 * Row literal: when `frootai.federation.autoAttachFromPlayManifest = true`
 * and the user opens a Play with `mcp_scope.attached`, show a
 * notification "This Play requires: azure. Attach now?" with an Attach
 * button.
 *
 * Pure: zero `vscode` imports + zero IO. Deps-injected so the gate can
 * exercise every branch in plain Node.
 *
 * Cousin of M5.9 `executeAttachFromManifest` but with a CRUCIAL UX
 * difference: M5.9 is OPERATOR-INITIATED (explicit command palette)
 * with a modal CONFIRM BATCH; M5.18 is AUTOMATIC (Play-open trigger)
 * with a NON-MODAL TOAST NOTIFICATION + single Attach button. The
 * doctrine is "automatic ship surfaces must NEVER block on a modal" —
 * the operator's primary action is opening the Play, not approving an
 * attach, so the toast must be dismissable without consuming focus.
 */
"use strict";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const CHIP_CORE = require("../providers/orchard-mcp-chip-core.js");

/** Row-literal prompt prefix. Operators grep this exact string. */
const AUTO_ATTACH_PROMPT_PREFIX = "This Play requires: ";
const AUTO_ATTACH_PROMPT_SUFFIX = ". Attach now?";

/** Toast button label per row literal. */
const ATTACH_BUTTON_LABEL = "Attach";

/**
 * @typedef {object} ManifestLike
 * @property {{ attached?: unknown }} [mcp_scope]
 *
 * @typedef {object} AutoAttachSettings
 * @property {boolean} [enabled]   `frootai.federation.enabled`
 * @property {boolean} [autoAttachFromPlayManifest]
 *
 * @typedef {object} AutoAttachUx
 * @property {(prompt: string, button: string) => Promise<"attach" | "dismiss" | undefined>} showAutoAttachPrompt
 *           Show a non-modal notification with an Attach button.
 *           Returns "attach" when the operator clicks Attach,
 *           "dismiss" when they explicitly dismiss, undefined when
 *           the toast times out / loses focus without action.
 * @property {(message: string) => void} showInfo
 * @property {(message: string) => void} showError
 * @property {() => void | Promise<void>} [refreshAttachedView]
 *
 * @typedef {object} PlayAutoAttachDeps
 * @property {{ listAttached: () => Promise<Array<{name: string}>>,
 *              attach: (args: {name: string, trustOverride?: boolean}) =>
 *                       Promise<{attached: boolean, blocked?: boolean,
 *                                reason?: string, humanMessage?: string}> }} client
 * @property {AutoAttachUx} ux
 * @property {AutoAttachSettings} settings
 * @property {ManifestLike | null | undefined} manifest
 *           The Play / accelerator manifest object (whatever the
 *           OrchardTreeProvider FRUIT carries on `node.fruit`).
 *
 * @typedef {{ status: "ok",                attached: string[], failed: Array<{name:string,code:string,message:string}>, prompted: string[] } |
 *           { status: "disabled" } |
 *           { status: "setting-off" } |
 *           { status: "no-areas" } |
 *           { status: "already-attached", areas: string[] } |
 *           { status: "cancelled",        at: "prompt" } |
 *           { status: "error",            code: string, message: string }} PlayAutoAttachOutcome
 */

/**
 * Format the row-literal prompt: "This Play requires: <areas>. Attach now?"
 *
 * @param {ReadonlyArray<string>} areas
 * @returns {string}
 */
function formatAutoAttachPrompt(areas) {
  if (!Array.isArray(areas) || areas.length === 0) return "";
  return `${AUTO_ATTACH_PROMPT_PREFIX}${areas.join(", ")}${AUTO_ATTACH_PROMPT_SUFFIX}`;
}

/**
 * Execute the M5.18 Play-open auto-attach flow. Pure (deps injected).
 *
 * @param {PlayAutoAttachDeps} deps
 * @returns {Promise<PlayAutoAttachOutcome>}
 */
async function executePlayAutoAttach(deps) {
  if (!deps || !deps.client || !deps.ux || !deps.settings) {
    return {
      status: "error",
      code: "user_error",
      message: "executePlayAutoAttach: deps.client + deps.ux + deps.settings are required",
    };
  }
  const settings = deps.settings;

  // ── Step 1: settings gates ────────────────────────────────────
  if (settings.enabled === false) {
    return { status: "disabled" };
  }
  if (settings.autoAttachFromPlayManifest !== true) {
    // Setting OFF (default for safety per M5.1 schema). No notification —
    // silent no-op. The auto-attach surface MUST NOT prompt unless the
    // operator explicitly opted in.
    return { status: "setting-off" };
  }

  // ── Step 2: extract areas via M5.17 chip pure-core ────────────
  // Re-use the same validation + dedupe + sort path as M5.17's chip
  // rendering so the toast prompt and the chip ALWAYS reflect the
  // same area list — operators see consistent UI.
  const areas = CHIP_CORE.extractMcpRequires(deps.manifest);
  if (areas.length === 0) {
    return { status: "no-areas" };
  }

  // ── Step 3: skip already-attached areas ──────────────────────
  /** @type {Set<string>} */
  let attachedSet = new Set();
  try {
    const list = await deps.client.listAttached();
    if (Array.isArray(list)) {
      for (const entry of list) {
        if (entry && typeof entry.name === "string" && entry.name.length > 0) {
          attachedSet.add(entry.name);
        }
      }
    }
  } catch {
    // PIN_ONE_AHEAD: M5.4's `buildPendingFederationClient` throws
    // `kernel_connection_pending` until M5.19+ wires the real kernel.
    // Treat the "kernel not ready" case as "no areas attached yet" so
    // the prompt still fires — better to ask once and have the attach
    // call also fail than to silently swallow the row literal flow.
    attachedSet = new Set();
  }
  const missing = areas.filter((a) => !attachedSet.has(a));
  if (missing.length === 0) {
    return { status: "already-attached", areas: areas.slice() };
  }

  // ── Step 4: show notification (non-modal toast) ──────────────
  const prompt = formatAutoAttachPrompt(missing);
  let response;
  try {
    response = await deps.ux.showAutoAttachPrompt(prompt, ATTACH_BUTTON_LABEL);
  } catch (err) {
    const message = (err && /** @type {any} */ (err).message) || String(err);
    return { status: "error", code: "ux_prompt_failed", message };
  }
  if (response !== "attach") {
    // "dismiss" or undefined (toast timeout / focus loss). Either way
    // the operator did NOT consent — no attach, no further notification.
    return { status: "cancelled", at: "prompt" };
  }

  // ── Step 5: per-area attach (sequential, errors collected) ────
  /** @type {string[]} */
  const attached = [];
  /** @type {Array<{name: string, code: string, message: string}>} */
  const failed = [];
  for (const name of missing) {
    let result;
    try {
      result = await deps.client.attach({ name, trustOverride: true });
    } catch (err) {
      const message = (err && /** @type {any} */ (err).message) || String(err);
      const code = (err && /** @type {any} */ (err).code) || "attach_failed";
      failed.push({ name, code, message });
      continue;
    }
    if (!result || result.attached !== true) {
      const code = (result && result.blocked === true) ? "trust_block" : "attach_failed";
      const message = (result && (result.humanMessage || result.reason)) || "kernel returned attached:false";
      failed.push({ name, code, message });
      continue;
    }
    attached.push(name);
  }

  // ── Step 6: refresh + summary ─────────────────────────────────
  if (typeof deps.ux.refreshAttachedView === "function") {
    try { await deps.ux.refreshAttachedView(); } catch { /* best-effort */ }
  }
  if (failed.length === 0) {
    deps.ux.showInfo(`Attached ${attached.length} area${attached.length === 1 ? "" : "s"}: ${attached.join(", ")}.`);
  } else if (attached.length === 0) {
    deps.ux.showError(`Auto-attach failed for all ${failed.length} area${failed.length === 1 ? "" : "s"}.`);
  } else {
    deps.ux.showError(`Auto-attached ${attached.length} — ${failed.length} failed (${failed.map((f) => f.name).join(", ")}).`);
  }
  return { status: "ok", attached, failed, prompted: missing.slice() };
}

module.exports = {
  AUTO_ATTACH_PROMPT_PREFIX,
  AUTO_ATTACH_PROMPT_SUFFIX,
  ATTACH_BUTTON_LABEL,
  formatAutoAttachPrompt,
  executePlayAutoAttach,
};
