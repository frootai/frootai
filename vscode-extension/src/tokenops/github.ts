import type { GithubCopilotDay, GithubCopilotUsage } from "./domain";

const integer = (value: unknown): number => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
const optionalInteger = (value: unknown): number | null => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;

function reportDays(raw: unknown): Record<string, any>[] {
  const reports = Array.isArray(raw) ? raw : [raw];
  return reports.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    return Array.isArray((candidate as any).day_totals) ? (candidate as any).day_totals : [candidate];
  });
}

function surfaceTokens(surface: any, field: "prompt_tokens_sum" | "output_tokens_sum"): number | null {
  return optionalInteger(surface?.token_usage?.[field]);
}

export function normalizeCopilotMetrics(raw: unknown, organization: string, now = new Date()): GithubCopilotUsage {
  const days: GithubCopilotDay[] = reportDays(raw).flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const value = candidate as Record<string, any>;
    const date = String(value.day || value.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    const phaseUsers = Array.isArray(value.totals_by_ai_adoption_phase) ? value.totals_by_ai_adoption_phase.reduce((total: number, phase: any) => total + integer(phase?.total_engaged_users), 0) : null;
    const cliInput = surfaceTokens(value.totals_by_cli, "prompt_tokens_sum");
    const appInput = surfaceTokens(value.totals_by_copilot_app, "prompt_tokens_sum");
    const cliOutput = surfaceTokens(value.totals_by_cli, "output_tokens_sum");
    const appOutput = surfaceTokens(value.totals_by_copilot_app, "output_tokens_sum");
    return [{
      date,
      totalActiveUsers: integer(value.daily_active_users ?? value.total_active_users),
      totalEngagedUsers: phaseUsers,
      codeCompletionsEngagedUsers: optionalInteger(value.copilot_ide_code_completions?.total_engaged_users),
      chatEngagedUsers: optionalInteger(value.monthly_active_chat_users ?? value.copilot_ide_chat?.total_engaged_users),
      interactions: integer(value.user_initiated_interaction_count),
      codeGenerations: integer(value.code_generation_activity_count),
      codeAcceptances: integer(value.code_acceptance_activity_count),
      surfacedInputTokens: cliInput == null && appInput == null ? null : (cliInput || 0) + (appInput || 0),
      surfacedOutputTokens: cliOutput == null && appOutput == null ? null : (cliOutput || 0) + (appOutput || 0),
    }];
  });
  if (!days.length) throw new Error("GitHub report contained no valid daily organization metrics.");
  return {
    status: "ready",
    organization,
    days,
    asOf: now.toISOString(),
    source: `GitHub REST API /orgs/${organization}/copilot/metrics/reports/organization-28-day/latest`,
    detail: "Aggregated organization report. Token sums cover reported Copilot CLI and Copilot app surfaces only; IDE hidden prompts and private orchestration remain unavailable.",
    evidenceGrade: "observed",
  };
}

export async function fetchCopilotMetrics(organization: string, accessToken: string): Promise<GithubCopilotUsage> {
  const org = organization.trim();
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(org)) {
    throw new Error("Configure a valid GitHub organization login.");
  }
  const response = await fetch(`https://api.github.com/orgs/${encodeURIComponent(org)}/copilot/metrics/reports/organization-28-day/latest`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2026-03-10",
      "User-Agent": "frootai-tokenops",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const error = new Error(`GitHub Copilot metrics returned HTTP ${response.status}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  const envelope = await response.json() as { download_links?: unknown };
  const links = Array.isArray(envelope.download_links) ? envelope.download_links.filter((link): link is string => typeof link === "string") : [];
  if (!links.length) throw new Error("GitHub Copilot metrics response did not contain a signed report link.");
  const reports: unknown[] = [];
  let totalBytes = 0;
  for (const link of links) {
    const reportUrl = new URL(link);
    if (reportUrl.protocol !== "https:") throw new Error("GitHub returned a non-HTTPS report link.");
    // Signed report URLs are bearer credentials themselves. Never forward the GitHub access token.
    const reportResponse = await fetch(reportUrl, { headers: { Accept: "application/json, application/x-ndjson, text/plain" }, redirect: "follow", signal: AbortSignal.timeout(20_000) });
    if (!reportResponse.ok) throw new Error(`GitHub signed Copilot report returned HTTP ${reportResponse.status}`);
    const reportText = await reportResponse.text();
    totalBytes += Buffer.byteLength(reportText, "utf8");
    if (totalBytes > 20 * 1024 * 1024) throw new Error("GitHub Copilot reports exceeded the 20 MB aggregate safety limit.");
    try { reports.push(JSON.parse(reportText)); }
    catch { reports.push(...reportText.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))); }
  }
  return normalizeCopilotMetrics(reports, org);
}

export function unavailableCopilotUsage(organization: string | null, error?: unknown): GithubCopilotUsage {
  const status = (error as any)?.status;
  return {
    status: status === 403 ? "forbidden" : status === 404 || status === 410 ? "unavailable" : "failed",
    organization,
    days: [],
    asOf: new Date().toISOString(),
    source: organization ? `GitHub REST API /orgs/${organization}/copilot/metrics/reports/organization-28-day/latest` : "GitHub Copilot metrics",
    detail: status === 403 ? "The signed-in account lacks organization Copilot metrics permission." : status === 404 || status === 410 ? "The organization endpoint is unavailable, disabled, or retired. No token usage was inferred." : error instanceof Error ? error.message : "GitHub usage could not be collected.",
    evidenceGrade: "unavailable",
  };
}
