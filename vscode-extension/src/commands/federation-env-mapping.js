// @ts-check
/**
 * FAI VS Code — federation settings → env-var mapping (M5.14 ship).
 *
 * Pure deps-injected mapper from the `frootai.federation.*` settings
 * surface (M5.1) into the env-var record the spawned `frootai-mcp`
 * federation kernel subprocess inherits. Lives in `.js` so the gate
 * can `require()` it without VS Code being resolvable.
 *
 * Split per the masterplan:
 *   M5.14 (this row): FROOTAI_PREATTACH only.
 *   M5.15:            FROOTAI_TRUST_FILE, FROOTAI_IDLE_DISCONNECT_MIN,
 *                     FROOTAI_FEDERATION=off (the disable path).
 *
 * Contract carry-over from M4 CLI:
 *   - Area names match `^[a-zA-Z0-9_-]+$` (Doctrine #5 — no dots, no
 *     spaces). Invalid entries are silently dropped to mirror the M4.5
 *     attach validator + the M5.1 settings JSON-schema items.pattern.
 *   - Empty / missing input arrays resolve to `{}` (an empty env-map),
 *     NEVER `{FROOTAI_PREATTACH: \"\"}`. Setting the env var to an empty
 *     string would mean \"preattach nothing explicitly\" vs \"don't
 *     mention preattach at all\" — the kernel treats both the same in
 *     practice but the cleaner contract is to omit the key entirely so
 *     `process.env` introspection reports the absence honestly.
 *   - The returned map is FROZEN so callers can spread it into a larger
 *     env without worrying about mutation.
 */
"use strict";

const AREA_NAME_RE = /^[a-zA-Z0-9_-]+$/;
const MAX_AREA_NAME_LENGTH = 64;
const PREATTACH_ENV_KEY = "FROOTAI_PREATTACH";
// M5.15 — env-key literals for the three sibling mappings shipped in
// this row. The pure builder never invents env keys at runtime; every
// key the federation kernel might receive is enumerated here so the
// gate can drift-detect a typo / rename in one place.
const TRUST_FILE_ENV_KEY = "FROOTAI_TRUST_FILE";
const IDLE_DISCONNECT_ENV_KEY = "FROOTAI_IDLE_DISCONNECT_MIN";
const FEDERATION_DISABLE_ENV_KEY = "FROOTAI_FEDERATION";
const FEDERATION_DISABLE_VALUE = "off";
// [Z6.12] Lean federation — lossless low-calorie compaction of federated
// tool descriptions. Maps `frootai.federation.lean = true` → the env flag the
// kernel's area-base reads to drop ceremony + compact whitespace.
const LEAN_FEDERATION_ENV_KEY = "FROOTAI_LEAN_FEDERATION";
const LEAN_FEDERATION_VALUE = "1";
const MIN_IDLE_DISCONNECT_MINUTES = 1;
const MAX_IDLE_DISCONNECT_MINUTES = 1440;

/**
 * @typedef {object} FederationSettings
 * @property {boolean} [enabled]
 * @property {string[]} [preAttach]
 * @property {string} [trustFile]                  reserved for M5.15
 * @property {number} [idleDisconnectMinutes]      reserved for M5.15
 * @property {boolean} [autoAttachFromPlayManifest] no env mapping
 *                                                 (consumed in-extension at M5.18)
 * @property {boolean} [lean]                       [Z6.12] low-calorie federation
 */

/**
 * Normalise + dedupe + validate a `preAttach` settings array into the
 * sequence the env var will carry. Pure.
 *
 * @param {unknown} raw
 * @returns {string[]}
 */
function _normalisePreAttach(raw) {
  if (!Array.isArray(raw)) return [];
  /** @type {string[]} */
  const out = [];
  const seen = new Set();
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_AREA_NAME_LENGTH) continue;
    if (!AREA_NAME_RE.test(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * Build the env-var record for the M5.14 `FROOTAI_PREATTACH` mapping.
 * Pure. Returns a FROZEN object with the env key present only when the
 * normalised preAttach list is non-empty.
 *
 * @param {FederationSettings | null | undefined} settings
 * @returns {Readonly<Record<string, string>>}
 */
function mapPreAttachToEnv(settings) {
  const s = settings || {};
  const names = _normalisePreAttach(s.preAttach);
  if (names.length === 0) return Object.freeze({});
  return Object.freeze({ [PREATTACH_ENV_KEY]: names.join(",") });
}

/**
 * M5.15 — map `frootai.federation.trustFile` to `FROOTAI_TRUST_FILE`.
 * Pure. Returns frozen `{FROOTAI_TRUST_FILE: "<path>"}` only when the
 * setting is a non-empty trimmed string; empty string (the M5.1 default,
 * meaning "use the XDG fallback `~/.frootai/trust.json`") resolves to
 * frozen `{}` so the kernel applies its own default rather than
 * receiving an empty-path override that would be ambiguous.
 *
 * No path-shape validation here — the kernel's trust-manifest reader
 * is the authoritative validator and surfaces the real error when an
 * invalid path is hit. Trimming whitespace catches the common copy-paste
 * mistake without lying about path correctness.
 *
 * @param {FederationSettings | null | undefined} settings
 * @returns {Readonly<Record<string, string>>}
 */
function mapTrustFileToEnv(settings) {
  const s = settings || {};
  if (typeof s.trustFile !== "string") return Object.freeze({});
  const trimmed = s.trustFile.trim();
  if (trimmed.length === 0) return Object.freeze({});
  return Object.freeze({ [TRUST_FILE_ENV_KEY]: trimmed });
}

/**
 * M5.15 — map `frootai.federation.idleDisconnectMinutes` to
 * `FROOTAI_IDLE_DISCONNECT_MIN`. Pure. Returns frozen
 * `{FROOTAI_IDLE_DISCONNECT_MIN: "<integer-string>"}` only when the
 * setting is a finite integer in `[1, 1440]` (matches M5.1 settings
 * schema `minimum:1, maximum:1440`). Invalid / out-of-range / missing
 * values resolve to frozen `{}` so the kernel applies its own default
 * (10 minutes per M5.1).
 *
 * @param {FederationSettings | null | undefined} settings
 * @returns {Readonly<Record<string, string>>}
 */
function mapIdleDisconnectToEnv(settings) {
  const s = settings || {};
  const raw = s.idleDisconnectMinutes;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return Object.freeze({});
  const n = Math.floor(raw);
  if (n < MIN_IDLE_DISCONNECT_MINUTES || n > MAX_IDLE_DISCONNECT_MINUTES) return Object.freeze({});
  return Object.freeze({ [IDLE_DISCONNECT_ENV_KEY]: String(n) });
}

/**
 * M5.15 — map `frootai.federation.enabled = false` to
 * `FROOTAI_FEDERATION=off` per the row literal. Pure. Returns frozen
 * `{FROOTAI_FEDERATION: "off"}` ONLY when `enabled === false`; any
 * other value (true / undefined / null / missing) resolves to frozen
 * `{}` so the kernel's default `FROOTAI_FEDERATION=on` posture is
 * inherited without our explicit assertion (cleaner failure analysis:
 * if the operator sees the env key, the extension set it).
 *
 * @param {FederationSettings | null | undefined} settings
 * @returns {Readonly<Record<string, string>>}
 */
function mapEnabledToEnv(settings) {
  const s = settings || {};
  if (s.enabled !== false) return Object.freeze({});
  return Object.freeze({ [FEDERATION_DISABLE_ENV_KEY]: FEDERATION_DISABLE_VALUE });
}

/**
 * [Z6.12] Map `frootai.federation.lean = true` to `FROOTAI_LEAN_FEDERATION=1`.
 * Pure. Returns frozen `{FROOTAI_LEAN_FEDERATION: "1"}` ONLY when `lean === true`;
 * any other value (false / undefined / null / missing) resolves to frozen `{}`
 * so the kernel's default (full descriptions) is inherited without an explicit
 * assertion. Lean federation is a LOSSLESS whitespace/ceremony compaction of
 * federated tool descriptions — never alters an imperative or parameter.
 *
 * @param {FederationSettings | null | undefined} settings
 * @returns {Readonly<Record<string, string>>}
 */
function mapLeanToEnv(settings) {
  const s = settings || {};
  if (s.lean !== true) return Object.freeze({});
  return Object.freeze({ [LEAN_FEDERATION_ENV_KEY]: LEAN_FEDERATION_VALUE });
}

/**
 * Composite env-var builder for the federation kernel spawn. M5.14
 * shipped `FROOTAI_PREATTACH`; M5.15 folds in the other 3 keys via
 * additional `Object.assign` segments. The composition order is
 * deterministic but doesn't matter for correctness — every mapper
 * returns a disjoint key-set so there are no overrides.
 *
 * @param {FederationSettings | null | undefined} settings
 * @returns {Readonly<Record<string, string>>}
 */
function buildFederationEnv(settings) {
  const out = {};
  Object.assign(out, mapPreAttachToEnv(settings));
  Object.assign(out, mapTrustFileToEnv(settings));
  Object.assign(out, mapIdleDisconnectToEnv(settings));
  Object.assign(out, mapEnabledToEnv(settings));
  Object.assign(out, mapLeanToEnv(settings));
  return Object.freeze(out);
}

module.exports = {
  AREA_NAME_RE,
  MAX_AREA_NAME_LENGTH,
  PREATTACH_ENV_KEY,
  TRUST_FILE_ENV_KEY,
  IDLE_DISCONNECT_ENV_KEY,
  FEDERATION_DISABLE_ENV_KEY,
  FEDERATION_DISABLE_VALUE,
  LEAN_FEDERATION_ENV_KEY,
  LEAN_FEDERATION_VALUE,
  MIN_IDLE_DISCONNECT_MINUTES,
  MAX_IDLE_DISCONNECT_MINUTES,
  _normalisePreAttach,
  mapPreAttachToEnv,
  mapTrustFileToEnv,
  mapIdleDisconnectToEnv,
  mapEnabledToEnv,
  mapLeanToEnv,
  buildFederationEnv,
};
