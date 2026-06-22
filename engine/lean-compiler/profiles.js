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

/** The `.instructions.md` profile — preserve the `applyTo` glob (+ waf/identity). */
export const INSTRUCTION_PROFILE = {
  type: "instruction",
  sourceExt: ".instructions.md",
  // `applyTo` is the load-bearing field: the glob that scopes the instruction to
  // specific files. Dropping or mutating it silently changes WHERE the guidance
  // applies, so it must survive byte-for-byte alongside the identity/waf fields.
  preservedFrontmatterKeys: ["name", "description", "applyTo", "waf"],
};

/**
 * The hook profile. A hook is a FOLDER — a `README.md` (docs, the markdown that
 * gets Lean-compiled) + a `hooks.json` manifest (event → command/env/timeout
 * config) + scripts. The compiler only ever touches the README; the manifest is
 * never compiled, so the events + their config are preserved by construction.
 * The README carries NO YAML frontmatter, so the load-bearing contract for hooks
 * lives in the manifest (checked by `assertHookManifestPreserved`), not in
 * frontmatter keys.
 */
export const HOOK_PROFILE = {
  type: "hook",
  sourceExt: "README.md",
  manifestFile: "hooks.json",
  preservedFrontmatterKeys: [],
};

/** Registry of known profiles, keyed by primitive type. */
const PROFILES = {
  agent: AGENT_PROFILE,
  instruction: INSTRUCTION_PROFILE,
  hook: HOOK_PROFILE,
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

/**
 * [Z4.3] Event names declared by a `hooks.json` manifest — the keys of its
 * `hooks` map (e.g. `["Stop"]`). Returns `[]` for malformed JSON.
 * @param {string} manifestText
 * @returns {string[]}
 */
export function hookEvents(manifestText) {
  try {
    const m = JSON.parse(manifestText);
    return m && m.hooks && typeof m.hooks === "object" ? Object.keys(m.hooks) : [];
  } catch {
    return [];
  }
}

/**
 * [Z4.3] Enforce the hook preservation contract: the Lean variant ships the same
 * `hooks.json` as the Full (the compiler only touches the README), so every
 * event AND its per-event command/env/timeout config must be identical. Guards
 * against an artifact generator accidentally rewriting the manifest.
 *
 * @param {string} fullManifest - the Full hook's hooks.json text.
 * @param {string} leanManifest - the Lean hook's hooks.json text.
 * @returns {{ ok:boolean, events:string[], missingEvents:string[], reason:string }}
 */
export function assertHookManifestPreserved(fullManifest, leanManifest) {
  const events = hookEvents(fullManifest);
  const leanEvents = hookEvents(leanManifest);
  const missingEvents = events.filter((e) => !leanEvents.includes(e));

  let configPreserved = false;
  try {
    configPreserved =
      JSON.stringify(JSON.parse(fullManifest)) === JSON.stringify(JSON.parse(leanManifest));
  } catch {
    configPreserved = false;
  }

  const ok = missingEvents.length === 0 && configPreserved;
  const reason = ok ? "ok" : missingEvents.length ? "event-dropped" : "config-mutated";
  return { ok, events, missingEvents, reason };
}
