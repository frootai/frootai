/**
 * [Z0.3] Lean Compiler — Stage 2: Segment.
 *
 * Classifies each parsed block by its semantic ROLE, which decides the
 * compression policy applied in Stage 3 ([Z0.4]-[Z0.6]):
 *
 *   PRESERVED verbatim (behaviour-bearing — never compressed):
 *     TRIGGER    — USE FOR / DO NOT USE FOR / Use when / Triggers / applyTo / events
 *     GUARDRAIL  — MUST / NEVER / security / limit directives
 *     PARAM      — env vars, flags, paths, named parameters
 *     IMPERATIVE — directive verb-phrases (the actual instructions)
 *
 *   COMPRESSIBLE:
 *     EXAMPLE    — fenced code (keep signature + 1 canonical example later)
 *     PROSE      — explanatory text, tables, callouts (terse rewrite later)
 *     META       — headings, blank runs (light touch)
 *
 * This is a HEURISTIC classifier on purpose: the Fidelity Gate ([Z1]) is the
 * safety net that rejects any Lean that actually drops a behaviour-bearing
 * token, so segmentation only needs to be *good*, not perfect. Roles are added
 * to blocks WITHOUT touching `raw`, so the round-trip invariant is preserved.
 */

/** Roles whose blocks must pass through compression untouched. */
const PRESERVED_ROLES = new Set(["TRIGGER", "GUARDRAIL", "PARAM", "IMPERATIVE"]);

// ── Signal patterns (ordered by precedence in roleFromText) ──────────────
const TRIGGER_RE =
  /\bUSE FOR\b|\bDO NOT USE FOR\b|\bUSE WHEN\b|\bTRIGGERS?\b|\bUse when\b|\bapplyTo\b/;
const GUARDRAIL_RE =
  /\b(MUST NOT|MUST|NEVER|SHALL|REQUIRED|DO NOT)\b|\b(no secrets?|hard-?cod|managed identity|never (log|commit|expose)|rate.?limit|sanitiz|owasp|least privilege|defaul[t]? deny)\b/i;
const PARAM_RE =
  /(?:^|\s)--[a-z][\w-]+|\$\{?[A-Z][A-Z0-9_]{2,}\}?|\b[A-Z][A-Z0-9]{2,}_[A-Z0-9_]+\b|\b(parameter|environment variable|env var|flag|--option)\b/;
const IMPERATIVE_RE =
  /^\s*(?:[-*+]\s+|\d+\.\s+)?(Run|Create|Configure|Deploy|Add|Set|Use|Install|Generate|Define|Wire|Enforce|Validate|Build|Write|Update|Remove|Enable|Disable|Provision|Apply|Register|Implement|Scaffold|Connect|Map|Resolve|Read|Fetch|Call|Return|Ensure|Check|Verify|Replace|Import|Export|Bind|Mount|Expose|Route|Cache|Compress|Select|Choose|Pick|Avoid|Prefer|Include|Exclude|Store|Load|Parse|Emit)\b/m;

/**
 * Classify free text into a behaviour-bearing role, or null for plain prose.
 * Precedence: TRIGGER > GUARDRAIL > PARAM > IMPERATIVE.
 * @param {string} text
 * @returns {"TRIGGER"|"GUARDRAIL"|"PARAM"|"IMPERATIVE"|null}
 */
function roleFromText(text) {
  if (TRIGGER_RE.test(text)) return "TRIGGER";
  if (GUARDRAIL_RE.test(text)) return "GUARDRAIL";
  if (PARAM_RE.test(text)) return "PARAM";
  if (IMPERATIVE_RE.test(text)) return "IMPERATIVE";
  return null;
}

/**
 * Classify a single parsed block.
 * @param {{type:string, raw:string}} block
 * @returns {string} role
 */
function classifyBlock(block) {
  switch (block.type) {
    case "fence":
      return "EXAMPLE";
    case "heading":
    case "blank":
      return "META";
    case "blockquote":
    case "table":
    case "list":
    case "paragraph":
      return roleFromText(block.raw) || "PROSE";
    default:
      return "PROSE";
  }
}

/**
 * Stage 2 — attach a `role` to every block.
 * @param {Array<{type:string, raw:string}>} blocks
 * @returns {Array<{type:string, raw:string, role:string, preserved:boolean}>}
 */
function segment(blocks) {
  return blocks.map((b) => {
    const role = classifyBlock(b);
    return { ...b, role, preserved: PRESERVED_ROLES.has(role) };
  });
}

export { segment, classifyBlock, roleFromText, PRESERVED_ROLES };
