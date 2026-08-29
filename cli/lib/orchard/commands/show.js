// @ts-check
/**
 * A4.3 — `frootai orchard show <slug-or-id> [--variety azure] [--json]`
 *
 * Pretty-prints a full accelerator manifest. Resolution strategy:
 *   1. If --variety supplied, fetch that variety bundle + find by slug/id
 *   2. Else fetch index, find by slug/id, infer variety, then fetch the variety bundle
 *   3. Pollinations panel fetched separately from pollinations.json
 *
 * Output sections mirror the website detail page (A3.20-A3.24):
 *   - Hero (name + tagline + ripeness/season + trust badges)
 *   - Tech & cost
 *   - Deployment & eval signals
 *   - Pollinations (3-way source discrimination)
 *   - Provenance
 *   - Install CTA
 */
"use strict";

const { fetchIndexBundle, fetchVarietyBundle, fetchPollinationsBundle } = require("../cdn");
const { renderKeyValue, status, color } = require("../output");
const { OrchardCliError } = require("../cli-error");
const { VARIETY_ENUM } = require("../types");

const SOURCE_PRIORITY = Object.freeze({ manual: 0, community_pr: 1, auto: 2 });

/**
 * Pure: pick a fruit from a variety bundle by slug OR id.
 */
function findFruit(bundle, key) {
  if (!bundle || !Array.isArray(bundle.fruits)) return null;
  return bundle.fruits.find((f) => f && (f.slug === key || f.id === key)) || null;
}

/**
 * Pure: filter + sort pollinations for a given fruit id.
 */
function filterFruitPollinations(edges, fruitId) {
  if (!Array.isArray(edges) || !fruitId) return [];
  return edges
    .filter((e) => e && e.accelerator_id === fruitId)
    .slice()
    .sort((a, b) => {
      const sd = (SOURCE_PRIORITY[a.source] ?? 99) - (SOURCE_PRIORITY[b.source] ?? 99);
      if (sd !== 0) return sd;
      return Number(b.confidence || 0) - Number(a.confidence || 0);
    });
}

async function execShow(args, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));

  const key = (args._ && args._[0]) || "";
  if (!key || typeof key !== "string" || key.trim().length === 0) {
    throw new OrchardCliError("invalid_input",
      "show requires a slug or id: frootai orchard show <slug-or-id>",
      { hint: "frootai orchard show azure-search-openai-demo" });
  }

  let variety = args.variety;
  if (variety !== undefined && variety !== true && !VARIETY_ENUM.includes(variety)) {
    throw new OrchardCliError("invalid_variety",
      `--variety "${variety}" not in enum [${VARIETY_ENUM.join(", ")}]`,
      { received: variety });
  }

  const fetchIndex = d.fetchIndex || fetchIndexBundle;
  const fetchVariety = d.fetchVariety || fetchVarietyBundle;
  const fetchPolls = d.fetchPollinations || fetchPollinationsBundle;

  // Resolve variety via index if not supplied.
  if (!variety || variety === true) {
    const index = await fetchIndex();
    const slim = (index.entries || []).find((e) => e.slug === key || e.id === key);
    if (!slim) {
      throw new OrchardCliError("not_found",
        `no accelerator found with slug or id "${key}"`,
        { key, hint: "Try `frootai orchard search <term>` to discover the slug." });
    }
    variety = slim.variety;
  }

  const [varietyBundle, pollinations] = await Promise.all([
    fetchVariety(variety),
    fetchPolls().catch(() => ({ edges: [] })),  // pollinations missing is non-fatal
  ]);

  const fruit = findFruit(varietyBundle, key);
  if (!fruit) {
    throw new OrchardCliError("not_found",
      `no accelerator with slug/id "${key}" in variety "${variety}"`,
      { key, variety });
  }

  if (args.json) {
    const pollEdges = filterFruitPollinations(pollinations.edges, fruit.id);
    const out = JSON.stringify({ fruit, pollinations: pollEdges }, null, 2);
    log(out);
    return { exitCode: 0, output: out };
  }

  const pollEdges = filterFruitPollinations(pollinations.edges, fruit.id);
  const lines = renderShowSections(fruit, pollEdges);
  const out = lines.join("\n");
  log(out);
  return { exitCode: 0, output: out };
}

/**
 * Pure: render the show output as an array of lines. Tested for stable structure.
 */
function renderShowSections(fruit, pollEdges) {
  const lines = [];

  // Hero
  lines.push(color("bold", fruit.name || "(unnamed)"));
  lines.push(color("dim", `  ${fruit.variety || "?"} · ${fruit.slug || "?"} · ${fruit.repo_url || ""}`));
  lines.push("");
  if (fruit.tagline) lines.push(`  ${fruit.tagline}`);
  if (Array.isArray(fruit.trust_badges) && fruit.trust_badges.length > 0) {
    lines.push("");
    lines.push(color("dim", `  Trust: ${fruit.trust_badges.join(", ")}`));
  }
  lines.push("");

  // Tech & cost
  lines.push(color("bold", "Tech & cost"));
  lines.push(renderKeyValue([
    { label: "Categories", value: (fruit.categories || []).join(", ") || color("dim", "(none)") },
    { label: "Tech", value: (fruit.tech || []).join(", ") || color("dim", "(none)") },
    { label: "Languages", value: (fruit.languages || []).join(", ") || color("dim", "(none)") },
    { label: "Cost band", value: fruit.cost_band || color("dim", "(no estimate)") },
    { label: "Ripeness", value: fruit.ripeness || color("dim", "(unknown)") },
    { label: "Season", value: fruit.season || color("dim", "(unknown)") },
    { label: "License", value: fruit.license || color("dim", "(unknown)") },
  ]));
  lines.push("");

  // Deployment
  const d = fruit.deployment || {};
  lines.push(color("bold", "Deployment"));
  lines.push(renderKeyValue([
    { label: "azd template", value: _bool(d.azd_template) },
    { label: "Containers", value: _bool(d.containers) },
    { label: "Serverless", value: _bool(d.serverless) },
    { label: "IaC", value: (d.iac || []).join(", ") || color("dim", "(none)") },
    { label: "Deploy time", value: d.estimated_deploy_minutes ? `${d.estimated_deploy_minutes} min` : color("dim", "(unknown)") },
  ]));
  lines.push("");

  // Pollinations
  lines.push(color("bold", `Pollinations (${pollEdges.length})`));
  if (pollEdges.length === 0) {
    lines.push(`  ${color("dim", "No Plays match this accelerator yet.")}`);
  } else {
    for (const e of pollEdges) {
      const srcColor = e.source === "manual" ? "green" : e.source === "community_pr" ? "magenta" : "gray";
      lines.push(`  ${color(srcColor, "[" + e.source + "]")} Play ${e.play_id} ${color("dim", "(" + (e.play_slug || "?") + ")")} · ${color("cyan", e.relation)} · confidence ${Math.round((e.confidence || 0) * 100)}%`);
      if (e.reason) lines.push(`     ${color("dim", String(e.reason).slice(0, 200))}`);
    }
  }
  lines.push("");

  // Provenance
  const p = fruit.provenance || {};
  lines.push(color("bold", "Provenance"));
  lines.push(renderKeyValue([
    { label: "Harvested at", value: p.harvested_at || color("dim", "(unknown)") },
    { label: "Harvested by", value: p.harvested_by || color("dim", "(unknown)") },
    { label: "Source", value: p.source || color("dim", "(unknown)") },
  ]));
  if (Array.isArray(p.enriched_by) && p.enriched_by.length > 0) {
    lines.push(`  ${color("dim", "Enriched by:")}`);
    for (const s of p.enriched_by) {
      lines.push(`    · ${color("yellow", s.step || "?")} · ${s.model || "?"} · ${s.at || "?"}`);
    }
  }
  if (Array.isArray(p.overrides_applied) && p.overrides_applied.length > 0) {
    lines.push(`  ${color("dim", "Community corrections:")}`);
    for (const o of p.overrides_applied) lines.push(`    · ${color("green", o)}`);
  }
  lines.push("");

  // Install CTA
  lines.push(color("bold", "Install"));
  lines.push(`  ${color("green", "$ frootai orchard install " + fruit.id)}`);
  lines.push(`  ${color("dim", "Or upgrade to Pro for the paid Play layer:")}`);
  lines.push(`  ${color("yellow", "$ frootai orchard install " + fruit.id + " --upgrade-to-play <play-id>")}`);

  return lines;
}

function _bool(v) {
  if (v === true) return color("green", "✓ yes");
  if (v === false) return color("dim", "✗ no");
  return color("dim", "(unknown)");
}

module.exports = { execShow, findFruit, filterFruitPollinations, renderShowSections, SOURCE_PRIORITY };
