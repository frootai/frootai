// @ts-check
/**
 * A4.7 — `frootai orchard pollinate <slug-or-id> <play-id> [--relation X] [--confidence 0.9] [--reason "..."]`
 *
 * Community PR helper: produces a ready-to-paste pollinations edge + opens a
 * pre-filled GitHub URL in the user's browser (`gh pr create`-style, but
 * without requiring `gh` CLI — uses a plain URL with query params for
 * the title + body so the GitHub web UI pre-fills the new-file form).
 *
 * Reason: lowering the friction for community pollinations contributions is
 * the difference between "I'll do it later" and "I'll do it now" — same
 * insight as the website's pollinations PR deep-link button (A3.23).
 */
"use strict";

const { fetchIndexBundle, fetchVarietyBundle } = require("../cdn");
const { status, color, renderKeyValue } = require("../output");
const { OrchardCliError } = require("../cli-error");
const {
  VARIETY_ENUM, POLLINATION_RELATION_ENUM,
} = require("../types");

const POLLINATIONS_REGISTRY_PATH = "frootai/orchard/registry/pollinations.json";
const POLLINATIONS_README_URL = "https://github.com/frootai/frootai/blob/main/orchard/registry/pollinations.json";
const POLLINATIONS_EDIT_URL = "https://github.com/frootai/frootai/edit/main/orchard/registry/pollinations.json";

/**
 * Pure: build a canonical pollination edge object ready to paste into pollinations.json.
 */
function buildPollinationEdge(fruit, playId, opts) {
  const o = opts || {};
  const relation = o.relation || "uses_pattern";
  if (!POLLINATION_RELATION_ENUM.includes(relation)) {
    throw new OrchardCliError("invalid_relation",
      `relation "${relation}" not in enum [${POLLINATION_RELATION_ENUM.join(", ")}]`,
      { received: relation });
  }
  const confidence = Number(o.confidence);
  const finalConfidence = Number.isFinite(confidence) && confidence >= 0 && confidence <= 1 ? confidence : 0.8;
  return {
    accelerator_id: fruit.id,
    play_id: String(playId),
    play_slug: o.playSlug || null,
    relation,
    confidence: finalConfidence,
    reason: String(o.reason || "").trim() || `${fruit.name} maps to Play ${playId} — community-proposed via CLI.`,
    source: "community_pr",
    added_at: o.nowIso || new Date().toISOString(),
    added_by: o.addedBy || "github:UNKNOWN",
  };
}

async function execPollinate(args, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));

  const key = (args._ && args._[0]) || "";
  const playId = (args._ && args._[1]) || args.play;
  if (!key || !playId) {
    throw new OrchardCliError("invalid_input",
      "pollinate requires <slug-or-id> <play-id>: frootai orchard pollinate <slug> <play-id> [--relation X] [--reason \"...\"]",
      { hint: "frootai orchard pollinate azure-search-openai-demo 01 --relation baseline --reason \"matches Play 01 exactly\"" });
  }
  if (!/^\d{2,3}$/.test(String(playId))) {
    throw new OrchardCliError("invalid_play_id",
      `play-id "${playId}" must be 2-3 digits`,
      { received: playId });
  }

  const variety = args.variety;
  if (variety !== undefined && variety !== true && !VARIETY_ENUM.includes(variety)) {
    throw new OrchardCliError("invalid_variety", `--variety "${variety}" not in enum`, { received: variety });
  }

  const fetchIndex = d.fetchIndex || fetchIndexBundle;
  const fetchVariety = d.fetchVariety || fetchVarietyBundle;

  let resolvedVariety = variety;
  if (!resolvedVariety || resolvedVariety === true) {
    const index = await fetchIndex();
    const slim = (index.entries || []).find((e) => e.slug === key || e.id === key);
    if (!slim) throw new OrchardCliError("not_found", `no accelerator found with slug or id "${key}"`, { key });
    resolvedVariety = slim.variety;
  }
  const bundle = await fetchVariety(resolvedVariety);
  const fruit = (bundle.fruits || []).find((f) => f && (f.slug === key || f.id === key));
  if (!fruit) {
    throw new OrchardCliError("not_found",
      `no accelerator with slug/id "${key}" in variety "${resolvedVariety}"`,
      { key, variety: resolvedVariety });
  }

  const edge = buildPollinationEdge(fruit, playId, {
    relation: args.relation,
    confidence: args.confidence,
    reason: args.reason,
    addedBy: args["added-by"] || `github:${process.env.USER || process.env.USERNAME || "UNKNOWN"}`,
  });

  if (args.json) {
    const out = JSON.stringify(edge, null, 2);
    log(out);
    return { exitCode: 0, output: out, edge };
  }

  const lines = [];
  lines.push(status("ok", `Community pollination edge for ${color("bold", fruit.name)} → Play ${color("yellow", String(playId))}`));
  lines.push("");
  lines.push(renderKeyValue([
    { label: "Accelerator", value: edge.accelerator_id },
    { label: "Play id", value: edge.play_id },
    { label: "Relation", value: color("cyan", edge.relation) },
    { label: "Confidence", value: `${Math.round(edge.confidence * 100)}%` },
    { label: "Source", value: color("magenta", "community_pr") },
  ]));
  lines.push("");
  lines.push(color("dim", "  Paste this JSON object into:"));
  lines.push(`  ${color("cyan", POLLINATIONS_README_URL)}`);
  lines.push("");
  lines.push(color("dim", "  edges array entry:"));
  lines.push(JSON.stringify(edge, null, 2).split("\n").map((l) => "    " + l).join("\n"));
  lines.push("");
  lines.push(color("dim", "  Or edit directly in your browser:"));
  lines.push(`  ${color("cyan", POLLINATIONS_EDIT_URL)}`);
  lines.push("");
  lines.push(color("dim", `  Doctrine: source MUST be "community_pr" for hand-written edges (A2.25 + A2.24 invariant).`));

  const out = lines.join("\n");
  log(out);
  return { exitCode: 0, output: out, edge };
}

module.exports = {
  execPollinate, buildPollinationEdge,
  POLLINATIONS_REGISTRY_PATH, POLLINATIONS_README_URL, POLLINATIONS_EDIT_URL,
};
