/**
 * [Z0.4] Lean Compiler — Stage 3a: PROSE compressor.
 *
 * Terse-imperative rewrite of explanatory text — the first real token saving.
 * Runs ONLY on blocks classified `PROSE` ([Z0.3]); behaviour-bearing roles
 * (IMPERATIVE/TRIGGER/PARAM/GUARDRAIL) and code/examples never reach here.
 *
 * Safety by construction:
 *   - inline code (`…`) and links ([text](url)) are protected and restored
 *     verbatim, so params / paths / identifiers inside prose survive intact;
 *   - rules are conservative phrase-shortenings + filler removals — they drop
 *     ceremony, hedges, and intensifiers, never the subject/verb of a sentence;
 *   - the compressor is monotone: output length ≤ input length, and idempotent.
 */

const PH = "\u0000"; // placeholder sentinel for protected spans

/** Ordered rewrite rules: [pattern, replacement]. Applied to PROSE only. */
const RULES = [
  // verbose phrase → concise
  [/\bin order to\b/gi, "to"],
  [/\b(?:due to the fact that|owing to the fact that)\b/gi, "because"],
  [/\bin the event that\b/gi, "if"],
  [/\b(?:at this point in time|at the present time)\b/gi, "now"],
  [/\ba large number of\b/gi, "many"],
  [/\bthe majority of\b/gi, "most"],
  [/\bhas the ability to\b/gi, "can"],
  [/\bmake use of\b/gi, "use"],
  [/\bin spite of the fact that\b/gi, "although"],
  [/\b(?:with regard to|with respect to|in relation to)\b/gi, "for"],
  [/\bfor the purpose of\b/gi, "to"],
  // pure filler removals (carry no meaning)
  [/\b(?:it is important to note that|it is worth noting that|please note that|it should be noted that|note that)\s*/gi, ""],
  [/\bas (?:mentioned|noted|stated)(?: above| earlier| previously| before)?\b,?\s*/gi, ""],
  [/\bas you can see\b,?\s*/gi, ""],
  [/\b(?:I'd recommend|I would recommend|we recommend|it is recommended|it's recommended|we suggest)\b(?: that you)?\s*/gi, ""],
  [/\b(?:basically|essentially|simply|actually|of course|naturally|obviously|in fact)\b,?\s*/gi, ""],
  // intensifiers
  [/\b(?:very|really|quite|extremely|fairly|rather)\s+/gi, ""],
];

/**
 * Compress a single PROSE block's text.
 * @param {string} text
 * @returns {string}
 */
function compressProse(text) {
  if (!text) return text;

  // Remember whether the block began as a capitalised sentence, so we can
  // restore the capital after a leading filler (e.g. "Basically, ") is removed.
  const startedUpper = /^\s*[A-Z]/.test(text);

  // Protect inline code + links so their contents are never rewritten.
  const spans = [];
  let t = text.replace(/`[^`]*`|\[[^\]]*\]\([^)]*\)/g, (m) => {
    spans.push(m);
    return PH + (spans.length - 1) + PH;
  });

  for (const [re, rep] of RULES) t = t.replace(re, rep);

  // Tidy artefacts left by removals.
  t = t
    .replace(/[ \t]{2,}/g, " ") // collapse runs of spaces
    .replace(/(^|\n)[ \t]*,[ \t]*/g, "$1") // stray leading comma
    .replace(/ +([.,;:!?])/g, "$1") // space before punctuation
    .replace(/[ \t]+$/gm, ""); // trailing spaces

  // Re-capitalise the first letter only if the sentence originally started
  // with a capital (so lowercase-led prose like `someVar notes…` is untouched).
  if (startedUpper) t = t.replace(/^(\s*)([a-z])/, (_, ws, c) => ws + c.toUpperCase());

  // Restore protected spans.
  t = t.replace(new RegExp(PH + "(\\d+)" + PH, "g"), (_, i) => spans[Number(i)]);

  // Monotone guard: never return something longer than the input.
  return t.length <= text.length ? t : text;
}

export { compressProse, RULES };
