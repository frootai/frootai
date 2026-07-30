#!/usr/bin/env node
// @ts-check
/**
 * [X5.9] 14-day review-SLA tracker for community `mcp-spec` PRs.
 *
 * GitHub PR objects come in; stale verdicts, reminder comments, and a Slack
 * payload come out. GitHub and Slack mutations remain owned by the workflow.
 */
"use strict";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const filename = fileURLToPath(import.meta.url);

export const SLA_DAYS_DEFAULT = 14;
export const MCP_SPEC_LABEL = "mcp-spec";

/**
 * @typedef {object} GhLabel
 * @property {string} name
 */

/**
 * @typedef {object} GhReview
 * @property {string} state
 */

/**
 * @typedef {object} GhPR
 * @property {number} number
 * @property {string} title
 * @property {string} url
 * @property {string} author
 * @property {string} createdAt
 * @property {GhLabel[]} labels
 * @property {GhReview[]} reviews
 * @property {boolean} [isDraft]
 */

export function hasMcpSpecLabel(pr) {
  return Array.isArray(pr?.labels) && pr.labels.some((label) => label?.name === MCP_SPEC_LABEL);
}

export function isUnreviewed(pr) {
  const reviews = Array.isArray(pr?.reviews) ? pr.reviews : [];
  return !reviews.some((review) =>
    review && (review.state === "APPROVED" || review.state === "CHANGES_REQUESTED")
  );
}

export function ageDays(pr, nowMs = Date.now()) {
  const created = Date.parse(pr?.createdAt || "");
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, (nowMs - created) / (24 * 60 * 60 * 1000));
}

export function isStale(pr, nowMs = Date.now(), slaDays = SLA_DAYS_DEFAULT) {
  if (!hasMcpSpecLabel(pr) || pr?.isDraft || !isUnreviewed(pr)) return false;
  return ageDays(pr, nowMs) > slaDays;
}

export function composeNagComment(pr, slaDays = SLA_DAYS_DEFAULT) {
  const age = Math.floor(ageDays(pr));
  return [
    "## :clock1: 14-day SLA reminder",
    "",
    `This community \`mcp-spec\` PR has been open for **${age} days** without a substantive review (the [X5.2] contributing guide promises a ${slaDays}-day SLA).`,
    "",
    "**Unblock**: a maintainer needs to either approve, request changes, or leave a concrete blocker note. `@pavle` has been pinged on the [#mcp-marketplace Slack channel](https://frootai.dev/internal/slack).",
    "",
    "_Posted by [`sla-watcher.mjs`](https://github.com/frootai/frootai/blob/main/scripts/marketplace/sla-watcher.mjs) - edits in place; will not spam._",
  ].join("\n");
}

export function composeSlackMessage(stalePrs, slaDays = SLA_DAYS_DEFAULT) {
  if (!stalePrs.length) {
    return { text: `:white_check_mark: MCP-spec SLA watcher: 0 PRs over ${slaDays} days. Good.` };
  }
  const lines = stalePrs.map((pr) =>
    `  - <${pr.url}|#${pr.number} ${pr.title}> - ${Math.floor(ageDays(pr))}d (${pr.author || "unknown"})`
  );
  return {
    text: `:warning: MCP-spec SLA watcher: *${stalePrs.length}* PR(s) over ${slaDays} days awaiting founder review:\n${lines.join("\n")}`,
  };
}

/**
 * @param {GhPR[]} prs
 * @param {{ nowMs?: number, slaDays?: number }} [opts]
 */
export function auditOpenPRs(prs, opts = {}) {
  const nowMs = typeof opts.nowMs === "number" ? opts.nowMs : Date.now();
  const slaDays = typeof opts.slaDays === "number" ? opts.slaDays : SLA_DAYS_DEFAULT;
  /** @type {GhPR[]} */
  const stale = [];
  /** @type {GhPR[]} */
  const fresh = [];
  for (const pr of Array.isArray(prs) ? prs : []) {
    if (!hasMcpSpecLabel(pr)) continue;
    (isStale(pr, nowMs, slaDays) ? stale : fresh).push(pr);
  }
  return { stale, fresh, slaDays, nowMs };
}

function parseArgs(argv) {
  const result = { prJson: undefined, now: undefined, slaDays: SLA_DAYS_DEFAULT };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--pr-json") result.prJson = argv[++index];
    else if (argument === "--now") result.now = argv[++index];
    else if (argument === "--sla-days") result.slaDays = Number(argv[++index]) || SLA_DAYS_DEFAULT;
  }
  return result;
}

async function readJsonStdinOrFile(file) {
  if (file && file !== "-") return JSON.parse(fs.readFileSync(file, "utf8"));
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const isMain = path.resolve(process.argv[1] || "") === filename;
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const nowMs = args.now ? Date.parse(args.now) : Date.now();
  const prs = await readJsonStdinOrFile(args.prJson);
  const { stale, fresh, slaDays } = auditOpenPRs(prs, { nowMs, slaDays: args.slaDays });
  console.log(
    `[X5.9] sla-watcher: ${stale.length} stale, ${fresh.length} fresh ` +
      `(SLA=${slaDays}d, ${stale.length + fresh.length} total mcp-spec PRs)`
  );
  for (const pr of stale) {
    console.log(`  #${pr.number} (${Math.floor(ageDays(pr, nowMs))}d) ${pr.title}`);
  }
  process.stderr.write(JSON.stringify({
    stale: stale.map((pr) => ({ number: pr.number, comment: composeNagComment(pr, slaDays) })),
    slack: composeSlackMessage(stale, slaDays),
  }, null, 2) + "\n");
}