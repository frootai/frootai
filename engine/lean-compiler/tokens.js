/**
 * [Z0.1]/[ZF.1] Token counter for the Lean Compiler.
 *
 * As of [ZF.1] this delegates to the EXACT o200k_base tokenizer (the basis used
 * by GPT-4o / 4.1 / o-series) via `tokenizer.js`, so all Lean savings numbers
 * are provable against a real model tokenizer instead of the historical
 * `chars / 4` estimate. The estimate survives only as a resilience fallback for
 * environments where the tokenizer package is unavailable — `TOKEN_BASIS`
 * reports which path is live so the UI can render `≈` only when truly estimated.
 *
 * @param {string} text
 * @returns {number} token count
 */

import { isExact, countTokensExact, ENCODING } from "./tokenizer.js";

/** "o200k_base" when exact; "chars/4" when falling back to the estimate. */
const TOKEN_BASIS = isExact() ? ENCODING : "chars/4";

/** True when token counts come from the exact model tokenizer. */
const TOKENS_EXACT = isExact();

function countTokens(text) {
  if (!text) return 0;
  return TOKENS_EXACT ? countTokensExact(text) : Math.round(text.length / 4);
}

export { countTokens, TOKEN_BASIS, TOKENS_EXACT };
