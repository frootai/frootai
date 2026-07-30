#!/usr/bin/env node
// @ts-check
"use strict";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const filename = fileURLToPath(import.meta.url);

export const TIER_ORDER = Object.freeze(["untrusted", "community", "verified-publisher", "first-party-ms"]);
export const TIER_RANK = Object.freeze(Object.fromEntries(TIER_ORDER.map((tier, index) => [tier, index])));
export const APPROVAL_MARKER = "/approve-promotion";
export const APPROVAL_APPROVER_DEFAULT = "pavle";

export function tierRank(tier) {
  return Object.prototype.hasOwnProperty.call(TIER_RANK, tier) ? TIER_RANK[tier] : -1;
}

export function classifyTransition(before, after) {
  if (!before && !after || before === after) return "none";
  const beforeRank = tierRank(before);
  const afterRank = tierRank(after);
  if (beforeRank < 0 || afterRank < 0) return "none";
  if (afterRank > beforeRank) return "escalation";
  if (afterRank < beforeRank) return "de-escalation";
  return "lateral";
}

export function detectSpecEscalations(diffs) {
  const escalations = [];
  for (const diff of Array.isArray(diffs) ? diffs : []) {
    const from = diff.before?.trust;
    const to = diff.after?.trust;
    if (classifyTransition(from, to) !== "escalation") continue;
    escalations.push({
      file: diff.file,
      slug: diff.after?.slug || diff.before?.slug,
      publisher: diff.after?.publisher || diff.before?.publisher,
      from,
      to,
      kind: "spec-trust-flip",
    });
  }
  return escalations;
}

export function detectEvidenceEscalations(events) {
  const escalations = [];
  for (const event of Array.isArray(events) ? events : []) {
    if (event.status !== "added") continue;
    const match = String(event.file || "").match(/orchard\/registry\/mcp-trust-evidence\/([^/_][^/]*)\.md$/);
    if (match) escalations.push({ file: event.file, publisher: match[1], kind: "evidence-added" });
  }
  return escalations;
}

export function hasFounderApproval(comments, opts = {}) {
  const approver = String(opts.approver || APPROVAL_APPROVER_DEFAULT).toLowerCase();
  const scopes = [];
  let by = null;
  for (const comment of Array.isArray(comments) ? comments : []) {
    if (String(comment?.author?.login || "").toLowerCase() !== approver) continue;
    for (const line of String(comment?.body || "").split(/\r?\n/)) {
      const match = line.match(/\/approve-promotion(?:\s+([@\w-][\w./-]*))?\b/i);
      if (!match) continue;
      scopes.push(match[1] ? match[1].replace(/^@/, "").toLowerCase() : "*");
      by = comment.author.login;
    }
  }
  if (!by) return { approved: false, by: null, scoped: [] };
  return { approved: true, by, scoped: scopes.includes("*") ? ["*"] : [...new Set(scopes)] };
}

export function evaluateGate(opts) {
  const escalations = Array.isArray(opts.escalations) ? opts.escalations : [];
  const noApproval = { approved: false, by: null, scoped: [] };
  if (!escalations.length) return { blocked: false, reason: "no-escalation", unapproved: [], approval: noApproval };
  const approval = hasFounderApproval(opts.comments || [], { approver: opts.approver });
  if (!approval.approved) return { blocked: true, reason: "missing-approval", unapproved: escalations, approval };
  if (approval.scoped.includes("*")) return { blocked: false, reason: "approved-bare", unapproved: [], approval };
  const scoped = new Set(approval.scoped);
  const unapproved = escalations.filter((item) => !scoped.has(String(item.publisher || "").toLowerCase()));
  return unapproved.length
    ? { blocked: true, reason: "partial-approval", unapproved, approval }
    : { blocked: false, reason: "approved-scoped", unapproved: [], approval };
}

export function composeApprovalRequestComment(escalations, opts = {}) {
  const approver = opts.approver || APPROVAL_APPROVER_DEFAULT;
  const rows = escalations.map((item) =>
    `- \`${item.publisher || "?"}\`${item.slug ? ` (spec \`${item.slug}\`)` : ""}: **${item.from || "none"} -> ${item.to || "none"}**`
  ).join("\n");
  return [
    "## :rotating_light: Trust-escalation gate - founder approval required",
    "",
    "This PR raises trust for:",
    "",
    rows || "- Evidence-only escalation",
    "",
    `@${approver} must comment \`${APPROVAL_MARKER}\` or \`${APPROVAL_MARKER} <publisher>\`.`,
    "",
    "_Posted by [`trust-escalation.mjs`](https://github.com/frootai/frootai/blob/main/scripts/marketplace/trust-escalation.mjs) ([X5.12])._",
  ].join("\n");
}

function parseArgs(argv) {
  const result = { approver: APPROVAL_APPROVER_DEFAULT };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--spec-diffs") result.specDiffs = argv[++index];
    else if (argument === "--evidence-events") result.evidenceEvents = argv[++index];
    else if (argument === "--comments") result.comments = argv[++index];
    else if (argument === "--approver") result.approver = argv[++index];
  }
  return result;
}

function readJson(file) {
  return file ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
}

if (path.resolve(process.argv[1] || "") === filename) {
  const args = parseArgs(process.argv.slice(2));
  const escalations = [
    ...detectSpecEscalations(readJson(args.specDiffs)),
    ...detectEvidenceEscalations(readJson(args.evidenceEvents)),
  ];
  const result = evaluateGate({ escalations, comments: readJson(args.comments), approver: args.approver });
  console.log(JSON.stringify(result, null, 2));
  if (result.blocked) {
    process.stderr.write(composeApprovalRequestComment(result.unapproved, { approver: args.approver }) + "\n");
    process.exit(1);
  }
}