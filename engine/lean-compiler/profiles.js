/**
 * [Z4.1] Lean Compiler — per-type compiler PROFILES.
 *
 * A profile declares, for one primitive type, the source extension and the
 * frontmatter keys that are *load-bearing* — the structural fields a runtime
 * relies on (an agent's `tools` / `model` / `waf`, an instruction's `applyTo`,
 * a hook's `events`). The compiler already preserves the frontmatter block
 * byte-for-byte (`reassemble` re-emits `frontmatter.raw` verbatim; only body
 * blocks are ever compressed), so a profile does not CHANGE compression — it
 * codifies and ENFORCES the preservation contract so a future compressor change
 * (or the [Z4.7] per-type tuning) can never silently drop a structural field.
 *
 * This row ([Z4.1]) ships the AGENT profile. [Z4.2] adds instructions, [Z4.3]
 * hooks; all three are consumed by the [Z4.4–6] artifact generators + the
 * [Z4.10] per-type tests.
 */

/** The `.agent.md` profile — preserve tools / model / WAF (and identity fields). */
export const AGENT_PROFILE = {
  type: "agent",
  sourceExt: ".agent.md",
  // Frontmatter keys whose presence must survive compilation. `tools`, `model`
  // and `waf` are the behaviour-bearing trio called out by the masterplan;
  // `name` / `description` / `plays` are identity/wiring fields kept alongside.
  preservedFrontmatterKeys: ["name", "description", "tools", "model", "waf", "plays"],
};

/** Registry of known profiles, keyed by primitive type. */
const PROFILES = {
  agent: AGENT_PROFILE,
};

/**
 * Look up a compiler profile by primitive type.
 * @param {string} type - e.g. "agent" (later: "instruction" | "hook").
 * @returns {typeof AGENT_PROFILE | null} the profile, or null if none is registered.
 */
export function getProfile(type) {
  return PROFILES[type] || null;
}

/**
 * Extract the leading frontmatter block (`---\n…\n---`) from a markdown string,
 * CRLF-normalised. Returns "" when there is no frontmatter.
 * @param {string} md
 * @returns {string}
 */
export function extractFrontmatter(md) {
  const m = String(md).replace(/\r\n/g, "\n").match(/^(---\n[\s\S]*?\n---\n?)/);
  return m ? m[1] : "";
}

/** Does `key:` appear at the start of a line in the frontmatter block? */
function hasFrontmatterKey(frontmatter, key) {
  return new RegExp("^" + key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ":", "m").test(frontmatter);
}

/**
 * Enforce a profile's preservation contract between a Full source and its Lean
 * output: the frontmatter block must survive byte-for-byte, and every declared
 * preserved key that exists in the Full must still exist in the Lean.
 *
 * @param {typeof AGENT_PROFILE} profile
 * @param {string} full - the Full source markdown.
 * @param {string} lean - the compiled Lean markdown.
 * @returns {{ ok: boolean, frontmatterPreserved: boolean, missingKeys: string[], reason: string }}
 */
export function assertProfilePreserved(profile, full, lean) {
  const fullFm = extractFrontmatter(full);
  const leanFm = extractFrontmatter(lean);
  const frontmatterPreserved = fullFm === leanFm;

  // Keys declared by the profile, present in Full, that went missing in Lean.
  const missingKeys = profile.preservedFrontmatterKeys.filter(
    (k) => hasFrontmatterKey(fullFm, k) && !hasFrontmatterKey(leanFm, k),
  );

  const ok = frontmatterPreserved && missingKeys.length === 0;
  const reason = ok
    ? "ok"
    : !frontmatterPreserved
      ? "frontmatter-block-mutated"
      : "preserved-key-dropped";

  return { ok, frontmatterPreserved, missingKeys, reason };
}
