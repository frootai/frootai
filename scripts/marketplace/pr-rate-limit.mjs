#!/usr/bin/env node
// @ts-check
"use strict";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const filename = fileURLToPath(import.meta.url);

export const MAX_OPEN_PRS_DEFAULT = 3;
export const SPECS_PATH_PREFIX = "orchard/registry/mcp-specs/";
export const COAUTHOR_ATTEST_MARKER = "/coauthor-attest";

export function countOpenPrsByAuthor(prs) {
  const counts = new Map();
  for (const pr of Array.isArray(prs) ? prs : []) {
    if (pr.state && pr.state !== "open") continue;
    if (!(pr.files || []).some((file) => typeof file === "string" && file.startsWith(SPECS_PATH_PREFIX))) continue;
    const login = pr?.author?.login || "";
    if (!login) continue;
    const current = counts.get(login) || { count: 0, prNumbers: [] };
    current.count += 1;
    current.prNumbers.push(pr.number);
    counts.set(login, current);
  }
  return counts;
}

export function findRateLimitViolations(prs, max = MAX_OPEN_PRS_DEFAULT) {
  const violations = [];
  for (const [login, { count, prNumbers }] of countOpenPrsByAuthor(prs)) {
    if (count > max) violations.push({ login, count, prNumbers });
  }
  return violations.sort((left, right) => right.count - left.count);
}

export function looksLikePublisherInsider(login, publisher, spec, evidence) {
  const normalizedLogin = String(login || "").toLowerCase();
  if (!normalizedLogin) return false;
  return normalizedLogin === String(publisher || "").toLowerCase()
    || normalizedLogin === String(spec?.reviewer || "").toLowerCase()
    || normalizedLogin === String(evidence?.reviewer || "").toLowerCase();
}

export function findInsiderCoauthorAttest(pr, publisher, spec, evidence) {
  for (const comment of Array.isArray(pr?.comments) ? pr.comments : []) {
    const login = String(comment?.author?.login || "");
    if (!looksLikePublisherInsider(login, publisher, spec, evidence)) continue;
    for (const line of String(comment?.body || "").split(/\r?\n/)) {
      const match = line.match(/\/coauthor-attest(?:\s+([@\w-][\w./-]*))?\b/i);
      if (!match) continue;
      const scope = match[1] ? match[1].replace(/^@/, "").toLowerCase() : "*";
      if (scope === "*" || scope === String(publisher).toLowerCase()) return { by: login, scope };
    }
  }
  return null;
}

export function detectSockPuppetPromotion(pr, spec, evidence, prior) {
  const publisher = String(spec?.publisher || "");
  if (!publisher) return null;
  const before = prior?.before?.trust;
  const after = spec?.trust;
  const escalation = before === "community" && ["verified-publisher", "first-party-ms"].includes(after)
    || before === "verified-publisher" && after === "first-party-ms";
  if (!escalation) return null;
  const author = String(pr?.author?.login || "");
  if (looksLikePublisherInsider(author, publisher, spec, evidence)) return null;
  if (findInsiderCoauthorAttest(pr, publisher, spec, evidence)) return null;
  return {
    publisher,
    author,
    from: before,
    to: after,
    reasons: [
      `PR author \`${author}\` is not a known insider of \`${publisher}\` (no login match, no \`reviewer\` field match in spec/evidence).`,
      `No \`${COAUTHOR_ATTEST_MARKER} ${publisher}\` comment from a known insider on this PR.`,
    ],
  };
}

export function composeRateLimitComment(login, count, prNumbers, max = MAX_OPEN_PRS_DEFAULT) {
  const list = prNumbers.slice().sort((left, right) => left - right).map((number) => `#${number}`).join(", ");
  return [
    `## :no_entry: MCP-spec PR cap reached - @${login}`,
    "",
    `You currently have **${count}** open PRs touching \`${SPECS_PATH_PREFIX}**\` (${list}). The per-author cap is **${max}**.`,
    "",
    `**Unblock**: merge or close at least one PR so the count drops to ${max} or fewer.`,
    "",
    "_Posted by [`pr-rate-limit.mjs`](https://github.com/frootai/frootai/blob/main/scripts/marketplace/pr-rate-limit.mjs) ([X5.13])._",
  ].join("\n");
}

export function composeSockPuppetComment(pr, publisher, reasons) {
  const author = pr?.author?.login || "?";
  return [
    `## :rotating_light: Sock-puppet promotion guard - \`${publisher}\``,
    "",
    `This PR promotes \`${publisher}\`, but @${author} is not a known publisher insider:`,
    "",
    ...reasons.map((reason) => `- ${reason}`),
    "",
    `**Unblock**: add a matching reviewer identity, or ask a known insider to comment \`${COAUTHOR_ATTEST_MARKER} ${publisher}\`.`,
    "",
    "_Posted by [`pr-rate-limit.mjs`](https://github.com/frootai/frootai/blob/main/scripts/marketplace/pr-rate-limit.mjs) ([X5.13])._",
  ].join("\n");
}

export function evaluateAbuseGate(opts) {
  const max = typeof opts.max === "number" ? opts.max : MAX_OPEN_PRS_DEFAULT;
  const reasons = [];
  const verdict = {};
  const login = opts.currentPR?.author?.login || "";
  const authorCount = countOpenPrsByAuthor(opts.openPrs || []).get(login) || { count: 0, prNumbers: [] };
  if (authorCount.count > max) {
    verdict.rateLimit = { login, count: authorCount.count, prNumbers: authorCount.prNumbers, max };
    reasons.push("rate-limit");
  }
  if (opts.spec) {
    const sockPuppet = detectSockPuppetPromotion(opts.currentPR, opts.spec, opts.evidence, opts.prior);
    if (sockPuppet) {
      verdict.sockPuppet = sockPuppet;
      reasons.push("sock-puppet");
    }
  }
  return { blocked: reasons.length > 0, reasons, verdict };
}

function parseArgs(argv) {
  const result = { max: MAX_OPEN_PRS_DEFAULT };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--open-prs") result.openPrs = argv[++index];
    else if (argument === "--current-pr") result.currentPR = argv[++index];
    else if (argument === "--spec") result.spec = argv[++index];
    else if (argument === "--evidence") result.evidence = argv[++index];
    else if (argument === "--prior") result.prior = argv[++index];
    else if (argument === "--max") result.max = Number(argv[++index]) || MAX_OPEN_PRS_DEFAULT;
  }
  return result;
}

function readJson(file) {
  return file ? JSON.parse(fs.readFileSync(file, "utf8")) : undefined;
}

if (path.resolve(process.argv[1] || "") === filename) {
  const args = parseArgs(process.argv.slice(2));
  const currentPR = readJson(args.currentPR) || {};
  const result = evaluateAbuseGate({
    openPrs: readJson(args.openPrs) || [],
    currentPR,
    spec: readJson(args.spec),
    evidence: readJson(args.evidence),
    prior: readJson(args.prior),
    max: args.max,
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.blocked) {
    const comments = [];
    if (result.verdict.rateLimit) {
      const rate = result.verdict.rateLimit;
      comments.push(composeRateLimitComment(rate.login, rate.count, rate.prNumbers, rate.max));
    }
    if (result.verdict.sockPuppet) {
      comments.push(composeSockPuppetComment(currentPR, result.verdict.sockPuppet.publisher, result.verdict.sockPuppet.reasons));
    }
    process.stderr.write(comments.join("\n\n---\n\n") + "\n");
    process.exit(1);
  }
}