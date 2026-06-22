/**
 * [ZF.1] Tests — exact o200k_base tokenizer + shared countTokens().
 *
 * Row literal: "Add exact tokenizer (tiktoken/o200k_base) + shared
 *   countTokens() helper".
 *
 * Reference counts were captured directly from gpt-tokenizer's o200k_base
 * encoder (the basis GPT-4o / 4.1 / o-series use).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { countTokens, TOKEN_BASIS, TOKENS_EXACT } from "./tokens.js";
import { countTokensExact, isExact, ENCODING } from "./tokenizer.js";

test("[ZF.1] the exact o200k_base encoder is available", () => {
  assert.equal(isExact(), true);
  assert.equal(TOKENS_EXACT, true);
  assert.equal(ENCODING, "o200k_base");
  assert.equal(TOKEN_BASIS, "o200k_base");
});

test("[ZF.1] empty string is zero tokens", () => {
  assert.equal(countTokens(""), 0);
  assert.equal(countTokensExact(""), 0);
});

test("[ZF.1] reference counts match the o200k_base tokenizer exactly", () => {
  const cases = [
    ["hello world", 2],
    ["You MUST never log secrets.", 6],
    ["const out = compile(md);", 6],
    ["FROOT_API_KEY", 4],
    ["The quick brown fox jumps over the lazy dog.", 10],
  ];
  for (const [text, expected] of cases) {
    assert.equal(countTokens(text), expected, `count for ${JSON.stringify(text)}`);
  }
});

test("[ZF.1] countTokens is deterministic", () => {
  const s = "Determinism: same input, same token count, every time.";
  assert.equal(countTokens(s), countTokens(s));
});

test("[ZF.1] exact count differs from the old chars/4 estimate (it is not a passthrough)", () => {
  const s = "tokenization is not the same as dividing character length by four";
  assert.notEqual(countTokens(s), Math.round(s.length / 4));
});
