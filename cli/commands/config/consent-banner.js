// @ts-check
/**
 * [H8.16] consent-banner.js — first-run telemetry consent banner.
 *
 * Pure builder. Renders the consent banner text and consumes a user
 * response string into a boolean answer. The interactive prompting + the
 * recording call live in the caller (typically the bin.js dispatcher) so
 * this module stays hermetically testable.
 *
 * **Doctrine** (matches H8.13's stderr-for-prompts rule):
 *   - Banner is written to STDERR — never stdout — so JSON mode stays clean.
 *   - `DO_NOT_TRACK=1` env override is checked by `shouldShowConsentBanner`
 *     (in config-store); this module assumes the caller has already cleared
 *     that gate before invoking the banner.
 *   - One-shot: once `recordConsent()` writes `consent_recorded_at`, the
 *     banner is never shown again.
 *
 * **Wiring** (deferred per H8.10/H8.13/H8.14/H8.15 doctrine): bin.js will
 * call `if (shouldShowConsentBanner(cfg, env)) {
 *          await promptAndRecordConsent({stdin, stderr, configBackend});
 *        }` BEFORE dispatching any subcommand. Wiring lands when the
 * future bin-reconciliation sub-phase ships.
 *
 * License: CC0-1.0.
 */
"use strict";

/** Build the consent banner string. Pure. */
function buildConsentBanner(opts = {}) {
  const product = opts.product || "frootai";
  const docsUrl = opts.docsUrl || "https://frootai.dev/docs/cli/telemetry";
  const lines = [
    "",
    "  ┌─ Anonymous usage telemetry ──────────────────────────────",
    `  │ ${product} can send anonymous usage events (subcommand`,
    "  │ names, exit codes, duration) to help us prioritize bugs",
    "  │ + features. No source code, no file paths, no auth",
    "  │ tokens, no PII.",
    "  │",
    `  │ Details: ${docsUrl}`,
    "  │",
    "  │ Opt in?  [y/N]  (you can change this later with",
    `  │   \`${product} config set telemetry true\` / \`... false\`)`,
    "  └─",
    "",
  ];
  return lines.join("\n");
}

/**
 * Parse a user response into a boolean. Empty / default / "no" / "n" /
 * "false" / "0" → false. "yes" / "y" / "true" / "1" → true.
 * Anything else → null (caller decides to re-prompt or default).
 *
 * @param {string|null|undefined} raw
 * @returns {boolean|null}
 */
function parseConsentResponse(raw) {
  if (raw === null || raw === undefined) return false;
  const v = String(raw).trim().toLowerCase();
  if (v === "" || v === "n" || v === "no" || v === "false" || v === "0") return false;
  if (v === "y" || v === "yes" || v === "true" || v === "1") return true;
  return null;
}

/**
 * Build the post-consent thank-you / acknowledgment line. Pure.
 * @param {boolean} accepted @param {object} [opts]
 */
function buildConsentAckMessage(accepted, opts = {}) {
  const product = opts.product || "frootai";
  if (accepted) {
    return `Thanks — anonymous telemetry is ON. Disable any time with \`${product} config set telemetry false\`.`;
  }
  return `OK — telemetry stays OFF. Enable any time with \`${product} config set telemetry true\`.`;
}

module.exports = {
  buildConsentBanner,
  parseConsentResponse,
  buildConsentAckMessage,
};
