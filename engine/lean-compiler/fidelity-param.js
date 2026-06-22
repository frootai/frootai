/**
 * [Z1.3] Fidelity Gate — Parameter / env / flag / path retention checker.
 *
 * Third of the five retention classes (see [Z1.1] for the gate's rationale).
 * Unlike the imperative ([Z1.1]) and trigger ([Z1.2]) checkers, which work at
 * LINE granularity, parameters are verified at TOKEN granularity — because a
 * `--flag`, a `$ENV_VAR`, a `SCREAMING_SNAKE` constant or a `path/to/file.ts`
 * usually lives INLINE inside prose. A correct Lean may freely reword the
 * sentence around the token, but it must NOT drop the token itself: the exact
 * identifier is the behaviour. Matching is therefore CASE-SENSITIVE (flags and
 * env vars are case-sensitive) and boundary-aware (so `FROOT_API_KEY` is not
 * falsely "retained" by `FROOT_API_KEY_V2`).
 *
 * Complementary to the line-level checkers rather than overlapping: a guardrail
 * line "MUST set `FROOT_API_KEY`" is verified as a directive by [Z1.4] AND its
 * `FROOT_API_KEY` token by this checker — two different properties, both must
 * hold. The [Z1.6] score weights the axes; this is defense-in-depth, by design.
 */

// ── Param token patterns (high-signal, case-SENSITIVE) ───────────────────────
const FLAG_RE = /--[A-Za-z][\w-]*/g; // long flags: --write, --output-dir
const ENV_REF_RE = /\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g; // $VAR / ${VAR} → bare name
const SCREAMING_RE = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/g; // FROOT_API_KEY, API_BASE_URL
const PATH_RES = [
  /\.{1,2}\/[\w.\-/]*[\w/]/g, // ./x, ../lib/y
  /(?:\.?[\w-]+\/)+[\w.\-]+\.[A-Za-z][A-Za-z0-9]{0,4}/g, // a/b/file.ts, .github/agents/x.md
];

/** True when `ch` would continue a path/identifier token (so the match is embedded). */
const isTokenChar = (ch) => ch !== undefined && /[\w./-]/.test(ch);

/**
 * Extract the DISTINCT, case-sensitive parameter tokens from a document.
 * Flags and SCREAMING_SNAKE keep their literal form; env refs are reduced to
 * the bare variable name so `$VAR`, `${VAR}` and a prose mention all unify.
 * @param {string} text
 * @returns {Set<string>}
 */
function extractParams(text) {
  const src = String(text).replace(/\r\n/g, "\n");
  const tokens = new Set();

  for (const m of src.matchAll(FLAG_RE)) tokens.add(m[0]);
  for (const m of src.matchAll(ENV_REF_RE)) tokens.add(m[1]);

  for (const m of src.matchAll(SCREAMING_RE)) {
    // A SCREAMING name immediately after '-' is the tail of a flag (--FOO_BAR),
    // already captured by FLAG_RE — don't also count it as a bare constant.
    if (m.index > 0 && src[m.index - 1] === "-") continue;
    tokens.add(m[0]);
  }

  for (const re of PATH_RES) {
    for (const m of src.matchAll(re)) {
      // Skip a path embedded in a longer token (URL tail, longer path) — its
      // leading char would continue the token.
      if (m.index > 0 && isTokenChar(src[m.index - 1])) continue;
      tokens.add(m[0]);
    }
  }

  return tokens;
}

/** Boundary-aware, case-sensitive presence test for one param token. */
function tokenRetained(token, leanText) {
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\w/-])${esc}(?![\\w/-])`).test(leanText);
}

/**
 * Check how many of Full's parameter tokens survive into Lean.
 *
 * @param {string} full  the Full (readable) source
 * @param {string} lean  the Lean (compressed) candidate
 * @returns {{kind:"param", total:number, retained:number, missing:string[], ratio:number}}
 */
function checkParamRetention(full, lean) {
  const wanted = extractParams(full);
  const haystack = String(lean).replace(/\r\n/g, "\n");
  const missing = [];
  let retained = 0;

  for (const token of wanted) {
    if (tokenRetained(token, haystack)) retained += 1;
    else missing.push(token);
  }

  const total = wanted.size;
  return {
    kind: "param",
    total,
    retained,
    missing,
    ratio: total === 0 ? 1 : retained / total,
  };
}

export { checkParamRetention, extractParams, tokenRetained };
