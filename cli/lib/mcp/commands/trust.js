// @ts-check
/**
 * FAI MCP CLI — `frootai mcp trust <list|set|unset>` (M4.7 ship).
 *
 * Sub-command dispatcher pattern: the dispatcher routes `mcp trust` to this
 * file, which switches on the FIRST positional (`list` / `set` / `unset`).
 * Only `list` is implemented at M4.7. `set` is pinned at [M4.8],
 * `unset` at [M4.9] — both raise `not_yet_implemented` until those rows
 * land, mirroring the M4.1 dispatcher stub shape exactly.
 *
 * `trust list` shows the merged view of the shipped manifest at
 * `frootai-core/npm-mcp/src/federation/trust.json` plus the operator's
 * overrides at `~/.frootai/trust.json` (Doctrine #3 — overlay `policies`
 * are silently dropped and counted in `droppedPoliciesCount`).
 *
 * Args:
 *   list [--json] [--no-color]
 *   set / unset     not yet implemented (M4.8 / M4.9)
 *
 * Exit codes (via dispatcher):
 *   0  ok
 *   1  user_error (unknown sub-action)
 *   1  trust_shipped_read_failed / trust_user_read_failed (loader errors)
 */
"use strict";

const {
  readShippedTrustManifest,
  readUserTrustFile,
  writeUserTrustFile,
  mergeTrustManifest,
  VALID_TIERS,
} = require("../trust-manifest");
const { McpCliError } = require("../cli-error");
const { color, status, renderTable } = require("../../orchard/output");

const SUB_ACTIONS = Object.freeze(["list", "set", "unset", "export"]);

/**
 * Build the rendering rows for `trust list`. Pure.
 *
 * @param {ReturnType<typeof readShippedTrustManifest>} shipped
 * @param {ReturnType<typeof readUserTrustFile>} user
 * @returns {Array<{ publisher: string, tier: string, source: "shipped" | "user-override" | "user-flip" }>}
 */
function buildTrustRows(shipped, user) {
  const userKnown = (user && user.knownPublishers) ? user.knownPublishers : {};
  const publishers = new Set([
    ...Object.keys(shipped.knownPublishers),
    ...Object.keys(userKnown),
  ]);
  const rows = [];
  for (const pub of publishers) {
    const shippedTier = shipped.knownPublishers[pub];
    const userTier = userKnown[pub];
    let tier, source;
    if (userTier && shippedTier && userTier !== shippedTier) {
      tier = userTier; source = "user-flip";
    } else if (userTier && !shippedTier) {
      tier = userTier; source = "user-override";
    } else if (userTier && shippedTier === userTier) {
      // Explicit user re-declaration that matches the shipped value.
      tier = userTier; source = "user-override";
    } else {
      tier = shippedTier; source = "shipped";
    }
    rows.push({ publisher: pub, tier, source });
  }
  rows.sort((a, b) => a.publisher.localeCompare(b.publisher));
  return rows;
}

/**
 * `trust unset <publisher>` — delete a single user-override entry from
 * `~/.frootai/trust.json` `knownPublishers[publisher]`, preserving all
 * other user entries + the `overrides` block. The merged manifest then
 * falls back to the shipped tier (if any) for that publisher.
 *
 * Behaviour:
 *   - Validates `<publisher>` slug `/^[a-zA-Z0-9_-]+$/`.
 *   - Idempotent: when the user file is absent OR the publisher is not
 *     pinned in it, the response reports `alreadyUnset: true` and no
 *     write occurs (no file is ever created on a no-op).
 *   - Reports `previousTier` (the prior user-pinned tier) and
 *     `fallbackTier` (the shipped tier the merged manifest will now
 *     resolve, or `"unknown"` when the publisher is not in the shipped
 *     manifest at all).
 *   - When the removal empties `knownPublishers`, the key is preserved
 *     as `{}` rather than dropped (mirrors M4.6 `preAttach: []` shape).
 *
 * @param {object} args
 * @param {object} [deps]
 * @returns {Promise<{exitCode: number, output: string}>}
 */
async function _execUnset(args, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));
  const a = args || {};
  const positional = Array.isArray(a._) ? a._ : [];

  if (positional.length < 1) {
    throw new McpCliError(
      "user_error",
      "frootai mcp trust unset requires <publisher>",
      { hint: "Usage: frootai mcp trust unset <publisher>" },
    );
  }
  const publisher = String(positional[0]).trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(publisher)) {
    throw new McpCliError(
      "user_error",
      `invalid publisher name "${publisher}"`,
      { hint: "Allowed: letters, digits, underscore, hyphen (no dots or slashes)." },
    );
  }

  const shipped = readShippedTrustManifest(d);
  const user = readUserTrustFile(d);
  const userKnown = (user && user.knownPublishers) ? user.knownPublishers : {};
  const userOverrides = (user && user.overrides) ? user.overrides : {};
  const wasPinned = Object.prototype.hasOwnProperty.call(userKnown, publisher);
  const previousTier = wasPinned ? userKnown[publisher] : null;
  const fallbackTier = Object.prototype.hasOwnProperty.call(shipped.knownPublishers, publisher)
    ? shipped.knownPublishers[publisher]
    : "unknown";

  let writtenPath = null;
  if (wasPinned) {
    const nextKnown = { ...userKnown };
    delete nextKnown[publisher];
    writtenPath = writeUserTrustFile(
      { knownPublishers: nextKnown, overrides: userOverrides },
      d,
    );
    // Re-read to confirm the write removed the entry.
    const after = readUserTrustFile(d);
    if (after && Object.prototype.hasOwnProperty.call(after.knownPublishers, publisher)) {
      throw new McpCliError(
        "trust_write_verification_failed",
        `removed ${publisher} from ${writtenPath} but re-read still shows it pinned to ${after.knownPublishers[publisher]}`,
        { hint: "Filesystem may have rejected the rename; check disk + permissions.", path: writtenPath },
      );
    }
  }

  const colorOpts = { color: !a["no-color"] };
  const payload = {
    publisher,
    removed: wasPinned,
    alreadyUnset: !wasPinned,
    previousTier,
    fallbackTier,
    source: wasPinned ? "user-removed" : "noop-not-present",
    statePath: writtenPath,
  };

  if (a.json) {
    const json = JSON.stringify(payload);
    log(json);
    return { exitCode: 0, output: json };
  }

  const headline = wasPinned
    ? status("ok",
        `trust override removed: "${publisher}" (was "${previousTier}")`,
        colorOpts)
    : status("info",
        `"${publisher}" had no user override (no-op)`,
        colorOpts);
  const fallbackLine = fallbackTier === "unknown"
    ? `  Fallback: unknown publisher (no shipped tier)`
    : `  Fallback: shipped tier "${fallbackTier}"`;
  const out = [
    "",
    headline,
    color("dim", fallbackLine, colorOpts),
    color("dim", `  User file: ${writtenPath || "(unchanged)"}`, colorOpts),
    "",
  ].join("\n");
  log(out);
  return { exitCode: 0, output: out };
}

/**
 * `trust set <publisher> <tier>` — write a single user-override entry
 * to `~/.frootai/trust.json` `knownPublishers[publisher] = tier`,
 * preserving any pre-existing user entries + the `overrides` block.
 *
 * Behaviour:
 *   - Validates `<publisher>` matches `/^[a-zA-Z0-9_-]+$/` (publisher
 *     slugs are npm-shaped — no dots, slashes, or whitespace).
 *   - Validates `<tier>` is in {@link VALID_TIERS} (case-insensitive).
 *   - Idempotent: if the user file already pins `publisher` to the same
 *     `tier`, no write occurs; the response reports `alreadyAtTier: true`.
 *   - Tracks `previousTier` (`null` when the publisher was unknown in
 *     the merged manifest, the prior user-pinned tier when present, the
 *     shipped tier when no prior user override existed).
 *   - Re-reads the file after write + asserts the new tier is present;
 *     mismatch raises `McpCliError('trust_write_verification_failed')`.
 *
 * @param {object} args
 * @param {object} [deps]
 * @returns {Promise<{exitCode: number, output: string}>}
 */
async function _execSet(args, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));
  const a = args || {};
  const positional = Array.isArray(a._) ? a._ : [];

  if (positional.length < 2) {
    throw new McpCliError(
      "user_error",
      "frootai mcp trust set requires <publisher> <tier>",
      { hint: `Allowed tiers: ${VALID_TIERS.join(" | ")}` },
    );
  }
  const publisher = String(positional[0]).trim();
  const rawTier = String(positional[1]).trim();
  const tier = rawTier.toLowerCase();

  if (!/^[a-zA-Z0-9_-]+$/.test(publisher)) {
    throw new McpCliError(
      "user_error",
      `invalid publisher name "${publisher}"`,
      { hint: "Allowed: letters, digits, underscore, hyphen (no dots or slashes)." },
    );
  }
  if (!VALID_TIERS.includes(tier)) {
    throw new McpCliError(
      "user_error",
      `invalid tier "${rawTier}"`,
      { hint: `Allowed: ${VALID_TIERS.join(" | ")}` },
    );
  }

  const shipped = readShippedTrustManifest(d);
  const user = readUserTrustFile(d);
  const userKnown = (user && user.knownPublishers) ? user.knownPublishers : {};
  const userOverrides = (user && user.overrides) ? user.overrides : {};
  const priorUserTier = Object.prototype.hasOwnProperty.call(userKnown, publisher) ? userKnown[publisher] : null;
  const shippedTier = Object.prototype.hasOwnProperty.call(shipped.knownPublishers, publisher) ? shipped.knownPublishers[publisher] : null;
  const previousTier = priorUserTier || shippedTier || null;

  const alreadyAtTier = priorUserTier === tier;
  let writtenPath = null;
  let verifiedTier = tier;
  if (!alreadyAtTier) {
    writtenPath = writeUserTrustFile(
      { knownPublishers: { ...userKnown, [publisher]: tier }, overrides: userOverrides },
      d,
    );
    // Re-read to confirm the write landed.
    const after = readUserTrustFile(d);
    if (!after || after.knownPublishers[publisher] !== tier) {
      throw new McpCliError(
        "trust_write_verification_failed",
        `wrote ${publisher}=${tier} to ${writtenPath} but re-read returned ${after && after.knownPublishers[publisher]}`,
        { hint: "Filesystem may have rejected the rename; check disk + permissions.", path: writtenPath },
      );
    }
    verifiedTier = after.knownPublishers[publisher];
  }

  const colorOpts = { color: !a["no-color"] };
  const payload = {
    publisher,
    tier: verifiedTier,
    previousTier,
    alreadyAtTier,
    source: priorUserTier ? "user-update" : (shippedTier ? "user-flip" : "user-add"),
    statePath: writtenPath,
  };

  if (a.json) {
    const json = JSON.stringify(payload);
    log(json);
    return { exitCode: 0, output: json };
  }

  const headline = alreadyAtTier
    ? status("info", `"${publisher}" was already pinned to "${tier}" (no-op)`, colorOpts)
    : status("ok",
        previousTier
          ? `trust override updated: "${publisher}" "${previousTier}" \u2192 "${tier}"`
          : `trust override set: "${publisher}" = "${tier}"`,
        colorOpts);
  const out = [
    "",
    headline,
    color("dim", `  Source: ${payload.source}`, colorOpts),
    color("dim", `  User file: ${writtenPath || "(unchanged)"}`, colorOpts),
    "",
  ].join("\n");
  log(out);
  return { exitCode: 0, output: out };
}

async function _execList(args, deps) {  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));
  const a = args || {};

  const shipped = readShippedTrustManifest(d);
  const user = readUserTrustFile(d);
  const rows = buildTrustRows(shipped, user);

  const payload = {
    rows,
    shippedPublisherCount: Object.keys(shipped.knownPublishers).length,
    userOverrideCount: (user && user.knownPublishers) ? Object.keys(user.knownPublishers).length : 0,
    droppedPoliciesCount: user ? (user.droppedPoliciesCount || 0) : 0,
    userFilePresent: user !== null,
    validTiers: Array.from(VALID_TIERS),
  };

  if (a.json) {
    const json = JSON.stringify(payload);
    log(json);
    return { exitCode: 0, output: json };
  }

  const colorOpts = { color: !a["no-color"] };
  const summary = `Trust manifest: ${rows.length} publisher${rows.length === 1 ? "" : "s"}` +
    ` (shipped: ${payload.shippedPublisherCount}, user-overrides: ${payload.userOverrideCount})`;
  const lines = ["", color("bold", "  " + summary, colorOpts), ""];
  if (rows.length > 0) {
    lines.push(renderTable(
      rows.map((r) => ({ publisher: r.publisher, tier: r.tier, source: r.source })),
      [
        { key: "publisher", label: "PUBLISHER", width: 18 },
        { key: "tier",      label: "TIER",      width: 22 },
        { key: "source",    label: "SOURCE",    width: 14 },
      ],
      colorOpts,
    ));
    lines.push("");
  }
  if (payload.droppedPoliciesCount > 0) {
    lines.push(color("dim",
      `  Dropped ${payload.droppedPoliciesCount} \`policies\` entr${payload.droppedPoliciesCount === 1 ? "y" : "ies"} ` +
      `from user file (Doctrine #3 — overlay policies never honoured).`, colorOpts));
    lines.push("");
  }
  const out = lines.join("\n");
  log(out);
  return { exitCode: 0, output: out };
}

/**
 * `trust export` — emit the operator's `~/.frootai/trust.json` overrides as a
 * clean, shareable trust.json to stdout (so `frootai mcp trust export >
 * my-trust.json` captures it for a teammate). Pure JSON, no decoration.
 *
 * Per Doctrine #3, overlay `policies` are NOT honoured and are NOT exported —
 * only `knownPublishers` + `overrides` (the tier decisions a team would share).
 * When the user has no override file, a valid empty skeleton is emitted so the
 * output is always a usable trust.json.
 *
 * @param {object} args
 * @param {object} [deps]
 * @returns {Promise<{exitCode: number, output: string}>}
 */
async function _execExport(args, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));
  const user = readUserTrustFile(d);
  const manifest = {
    $schema: "https://frootai.dev/schemas/fai-mcp-trust-v1.json",
    version: 1,
    knownPublishers: (user && user.knownPublishers) ? user.knownPublishers : {},
    overrides: (user && user.overrides) ? user.overrides : {},
  };
  const json = JSON.stringify(manifest, null, 2);
  log(json);
  return { exitCode: 0, output: json };
}

/**
 * Dispatcher-compatible exec entry.
 *
 * @param {object} args
 * @param {object} [deps]
 * @returns {Promise<{exitCode: number, output: string}>}
 */
async function execTrust(args, deps) {
  const a = args || {};
  const positional = Array.isArray(a._) ? a._ : [];
  const action = positional.length > 0 ? String(positional[0]).toLowerCase() : "";

  if (!action) {
    throw new McpCliError(
      "user_error",
      "frootai mcp trust requires a sub-action",
      { hint: `Usage: frootai mcp trust <${SUB_ACTIONS.join("|")}>` },
    );
  }
  if (!SUB_ACTIONS.includes(action)) {
    throw new McpCliError(
      "user_error",
      `unknown trust sub-action "${action}"`,
      { hint: `Allowed: ${SUB_ACTIONS.join(" | ")}` },
    );
  }

  // Strip the action from the positional list so sub-impls see clean args.
  const subArgs = { ...a, _: positional.slice(1) };

  if (action === "list") return _execList(subArgs, deps);
  if (action === "set") return _execSet(subArgs, deps);
  if (action === "unset") return _execUnset(subArgs, deps);
  if (action === "export") return _execExport(subArgs, deps);

  // Defensive fall-through — every action in SUB_ACTIONS must be routed above.
  throw new McpCliError(
    "not_yet_implemented",
    `frootai mcp trust ${action}: dispatcher missing a route (this is a bug)`,
    { hint: `Report this output to the maintainers.` },
  );
}

module.exports = {
  execTrust,
  buildTrustRows,
  SUB_ACTIONS,
};