// @ts-check
/**
 * FAI Orchard CLI — schema-pinned frozen enums (mirror of
 * frootai.dev/src/lib/orchard/types.ts but in JS via JSDoc + Object.freeze).
 *
 * Single source of truth for the CLI's enum validation. Drift vs the website's
 * types is tested by frootai-core/scripts/orchard/test/cli-orchard-types.test.js
 * which loads both files + asserts byte-equal enum values.
 */
"use strict";

const VARIETY_ENUM = Object.freeze(["azure", "gcp", "aws", "oss", "hybrid"]);
const OWNER_TYPE_ENUM = Object.freeze(["first_party", "community", "partner", "frootai"]);
const FROOT_LAYER_ENUM = Object.freeze(["F", "R", "O1", "O2", "T"]);
const RIPENESS_ENUM = Object.freeze(["Seedling", "Sapling", "Bearing", "Mature"]);
const SEASON_ENUM = Object.freeze(["Spring", "Summer", "Autumn", "Winter"]);
const CATEGORY_ENUM = Object.freeze([
  "rag", "agent", "multi-agent", "voice", "vision", "chat", "doc", "code",
  "infra", "mcp", "security", "search", "data", "eval", "edge",
  "industry-healthcare", "industry-finance", "industry-retail", "industry-public-sector",
]);
const TRUST_BADGE_ENUM = Object.freeze([
  "microsoft_official", "google_official", "aws_official",
  "azd_template",
  "frootai_compatible_full", "frootai_compatible_partial", "frootai_pollinated",
  "eval_proven", "safety_layer", "production_ready",
]);
const ORIGIN_ENUM = Object.freeze(["harvested", "cultivated", "first_party"]);
const POLLINATION_RELATION_ENUM = Object.freeze([
  "baseline", "extends_to", "alternative", "uses_pattern", "provides_infra",
]);
const POLLINATION_SOURCE_ENUM = Object.freeze(["auto", "manual", "community_pr"]);
const NO_PLAY_MATCH_TAG = "no-play-match";

module.exports = {
  VARIETY_ENUM,
  OWNER_TYPE_ENUM,
  FROOT_LAYER_ENUM,
  RIPENESS_ENUM,
  SEASON_ENUM,
  CATEGORY_ENUM,
  TRUST_BADGE_ENUM,
  ORIGIN_ENUM,
  POLLINATION_RELATION_ENUM,
  POLLINATION_SOURCE_ENUM,
  NO_PLAY_MATCH_TAG,
};
