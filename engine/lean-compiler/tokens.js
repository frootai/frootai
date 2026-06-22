/**
 * [Z0.1] Token estimator for the Lean Compiler.
 *
 * v1 = `chars / 4` approximation (the same basis used by the catalog badges).
 * [ZF.1] (Foundation Hardening, right after the compiler) replaces this with an
 * EXACT tokenizer (tiktoken / o200k_base) — every call site stays identical, so
 * the swap is a one-file change and all Lean savings numbers become provable.
 *
 * @param {string} text
 * @returns {number} estimated token count
 */
function countTokens(text) {
  if (!text) return 0;
  return Math.round(text.length / 4);
}

export { countTokens };
