// @ts-check
/**
 * M5.20 — Trust elicitation (pure core).
 *
 * Row literal: when `fai_attach_mcp` returns `requiresApproval: true`,
 * render a `vscode.window.showWarningMessage` with `Allow` / `Allow once`
 * / `Block` buttons; persist choice to user trust file.
 *
 * Pure: zero `vscode` imports + zero IO. Deps-injected so the gate
 * exercises every branch in plain Node — `ux.showTrustPrompt` returns
 * the picked button label (or undefined on dismiss), `trustStore` is a
 * thin read/write contract over the JSON trust file.
 *
 * Decisions:
 *   - Three button labels are FROZEN to the row literal: "Allow",
 *     "Allow once", "Block". Operators read the dialog and grep the
 *     codebase for the same strings — paraphrasing breaks both
 *     muscle memories.
 *   - Persistence semantics by button:
 *       Allow      → write `{tier: "allowed"}` to trust file (sticks
 *                    across sessions; future attaches skip the prompt).
 *       Allow once → DO NOT persist; return retry-permitted for THIS
 *                    session only. Next session re-prompts.
 *       Block      → write `{tier: "blocked"}` to trust file (sticks
 *                    across sessions; future attaches refuse).
 *       Dismiss    → no persistence + no retry. Operator declined to
 *                    decide; treat as cancel, NOT as block (a hidden
 *                    block would surprise on next attach).
 *   - The retry-permitted flag is the ONLY post-elicitation signal
 *     the caller needs — the actual retry-attach is the caller's job
 *     so this core stays single-purpose.
 *   - trustStore.write failures are TOLERATED (best-effort) but
 *     surfaced in the outcome so the caller can warn the operator
 *     "your decision wasn't persisted; you'll be re-prompted next time".
 *     The decision still applies for THIS session.
 */
"use strict";

const BUTTON_ALLOW = "Allow";
const BUTTON_ALLOW_ONCE = "Allow once";
const BUTTON_BLOCK = "Block";

/** Trust-file tier labels (pinned by M5.20 for user-decided overrides). */
const TIER_ALLOWED = "allowed";
const TIER_BLOCKED = "blocked";

/** Trust-file schema version. Bump if the on-disk shape ever changes. */
const TRUST_FILE_VERSION = 1;

/**
 * @typedef {"allow" | "allow-once" | "block" | "cancelled"} ElicitDecision
 *
 * @typedef {object} TrustOverride
 * @property {string} tier         "allowed" | "blocked"
 * @property {string} [decidedAt]  ISO timestamp
 *
 * @typedef {object} TrustFile
 * @property {number} version
 * @property {Record<string, TrustOverride>} overrides
 *
 * @typedef {object} TrustStore
 * @property {() => Promise<TrustFile>} read       Read the on-disk file. Returns
 *                                                 a fresh empty TrustFile when
 *                                                 absent / corrupt (NEVER throws).
 * @property {(file: TrustFile) => Promise<void>} write   Write the file atomically.
 *                                                 May throw on IO failure.
 *
 * @typedef {object} TrustElicitationUx
 * @property {(opts: { areaName: string, prompt: string, buttons: ReadonlyArray<string> })
 *           => Promise<string | undefined>} showTrustPrompt
 *           Show the warning dialog with the 3 buttons; return picked
 *           button label or undefined on dismiss.
 * @property {(message: string) => void} showInfo
 * @property {(message: string) => void} showError
 *
 * @typedef {object} TrustElicitationDeps
 * @property {string} areaName     Slug (validated upstream by attach flow).
 * @property {string} [reason]     Human-readable reason from the kernel
 *                                  (e.g. "Publisher 'shady-pub' is unverified").
 * @property {TrustElicitationUx} ux
 * @property {TrustStore} trustStore
 * @property {() => string} [now]  Injectable clock for gate determinism.
 *
 * @typedef {{ status: "allowed",       persisted: boolean, retry: true } |
 *           { status: "allow-once",    persisted: false,   retry: true } |
 *           { status: "blocked",       persisted: boolean, retry: false } |
 *           { status: "cancelled",     persisted: false,   retry: false } |
 *           { status: "error",         code: string, message: string }} TrustElicitationOutcome
 */

/**
 * Pure: format the warning prompt body.
 *
 *   formatTrustPrompt("azure")            → "FrootAI Federation requires approval to attach `azure`."
 *   formatTrustPrompt("azure", "Unknown publisher")
 *                                         → "FrootAI Federation requires approval to attach `azure`. Unknown publisher."
 *
 * @param {string} areaName
 * @param {string} [reason]
 * @returns {string}
 */
function formatTrustPrompt(areaName, reason) {
  const safeName = (typeof areaName === "string" && areaName.length > 0) ? areaName : "(unknown)";
  const base = `FrootAI Federation requires approval to attach \`${safeName}\`.`;
  if (typeof reason === "string" && reason.trim().length > 0) {
    return `${base} ${reason.trim()}`;
  }
  return base;
}

/**
 * Pure: map a `showWarningMessage` button-pick result to the canonical
 * decision tag. Recognises the 3 row-literal buttons exactly +
 * undefined / unknown response → "cancelled" (NEVER "blocked" — see
 * decision notes).
 *
 * @param {string | undefined | null} response
 * @returns {ElicitDecision}
 */
function decodeButtonResponse(response) {
  switch (response) {
    case BUTTON_ALLOW: return "allow";
    case BUTTON_ALLOW_ONCE: return "allow-once";
    case BUTTON_BLOCK: return "block";
    default: return "cancelled";
  }
}

/**
 * Pure: execute the trust-elicitation flow.
 *
 * @param {TrustElicitationDeps} deps
 * @returns {Promise<TrustElicitationOutcome>}
 */
async function executeTrustElicitation(deps) {
  if (!deps || !deps.ux || !deps.trustStore || typeof deps.areaName !== "string") {
    return {
      status: "error",
      code: "user_error",
      message: "executeTrustElicitation: deps.areaName + deps.ux + deps.trustStore are required",
    };
  }
  const now = (typeof deps.now === "function") ? deps.now : () => new Date().toISOString();
  const buttons = Object.freeze([BUTTON_ALLOW, BUTTON_ALLOW_ONCE, BUTTON_BLOCK]);
  const prompt = formatTrustPrompt(deps.areaName, deps.reason);

  // ── Step 1: prompt ───────────────────────────────────────────
  /** @type {string | undefined} */
  let raw;
  try {
    raw = await deps.ux.showTrustPrompt({ areaName: deps.areaName, prompt, buttons });
  } catch (err) {
    const message = (err && /** @type {any} */ (err).message) || String(err);
    deps.ux.showError(`Trust prompt failed: ${message}`);
    return { status: "error", code: "ux_prompt_failed", message };
  }
  const decision = decodeButtonResponse(raw);

  // ── Step 2: dispatch on decision ─────────────────────────────
  if (decision === "cancelled") {
    return { status: "cancelled", persisted: false, retry: false };
  }
  if (decision === "allow-once") {
    // SESSION-ONLY: do NOT persist. The caller may now retry the
    // attach with `trustOverride: true` for this single attempt.
    return { status: "allow-once", persisted: false, retry: true };
  }

  // "allow" or "block" → persist to trust file (best-effort).
  /** @type {TrustFile} */
  let file;
  try {
    file = await deps.trustStore.read();
  } catch {
    // Read failure is tolerated — start a fresh file.
    file = { version: TRUST_FILE_VERSION, overrides: {} };
  }
  if (!file || typeof file !== "object") file = { version: TRUST_FILE_VERSION, overrides: {} };
  if (!file.overrides || typeof file.overrides !== "object") file.overrides = {};
  if (typeof file.version !== "number") file.version = TRUST_FILE_VERSION;

  file.overrides[deps.areaName] = {
    tier: decision === "allow" ? TIER_ALLOWED : TIER_BLOCKED,
    decidedAt: now(),
  };

  /** @type {boolean} */
  let persisted = true;
  try {
    await deps.trustStore.write(file);
  } catch (err) {
    persisted = false;
    const message = (err && /** @type {any} */ (err).message) || String(err);
    deps.ux.showError(`Trust decision recorded for this session, but could not be saved: ${message}`);
  }

  if (decision === "allow") {
    if (persisted) {
      deps.ux.showInfo(`\`${deps.areaName}\` allowed. Future attaches will skip this prompt.`);
    }
    return { status: "allowed", persisted, retry: true };
  }
  // decision === "block"
  if (persisted) {
    deps.ux.showInfo(`\`${deps.areaName}\` blocked. Future attaches will refuse without re-prompting.`);
  }
  return { status: "blocked", persisted, retry: false };
}

module.exports = {
  BUTTON_ALLOW,
  BUTTON_ALLOW_ONCE,
  BUTTON_BLOCK,
  TIER_ALLOWED,
  TIER_BLOCKED,
  TRUST_FILE_VERSION,
  formatTrustPrompt,
  decodeButtonResponse,
  executeTrustElicitation,
};
