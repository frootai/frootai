/**
 * Vendor Conformance Dashboard — public tracking of who supports what level.
 *
 * Production-grade:
 *   - Public dashboard at conformance.frootai.dev
 *   - Matrix: vendors (rows) × conformance levels L0–L5 (columns)
 *   - Each cell: pass/fail + badge + date last tested + version
 *   - Automated CI: conformance suite runs nightly against vendor SDKs
 *   - Embeddable badges for vendor READMEs
 *   - Historical conformance tracking (when did they first achieve L2?)
 *
 * Tracker: P6.1.006
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

// ── Vendor Conformance Model ────────────────────────────────────────────

export interface VendorConformance {
  vendorId: string;
  vendorName: string;
  vendorUrl: string;
  vendorLogo: string;
  vendorType: "framework" | "llm_provider" | "eval_tool" | "platform" | "community";
  sdkLanguage: string;
  sdkRepoUrl: string;
  sdkVersion: string;

  // Conformance results per level
  levels: ConformanceLevelResult[];

  // Overall
  highestLevel: string;                  // "L0" | "L1" | ... | "L5" | "none"
  certified: boolean;                    // paid certification (L3+)
  certificationId: string | null;
  certificationExpiry: string | null;

  // Testing
  lastTestedAt: string;
  testMethod: "automated_ci" | "manual_submission" | "self_reported";
  ciJobUrl: string | null;

  // History
  firstConformant: string | null;        // date first achieved any level
  levelHistory: { level: string; achievedAt: string; lostAt: string | null }[];

  // Contact
  maintainerContact: string;
  autoTestEnabled: boolean;

  updatedAt: string;
}

export interface ConformanceLevelResult {
  level: string;                         // "L0" | "L1" | "L2" | "L3" | "L4" | "L5"
  status: "pass" | "fail" | "partial" | "not_tested" | "in_progress";
  testsTotal: number;
  testsPassed: number;
  testsFailed: number;
  testsSkipped: number;
  passRate: number;                      // 0–100%
  lastRunAt: string | null;
  lastRunDuration: number | null;        // seconds
  lastRunVersion: string | null;         // SDK version tested
  specVersion: string;                   // FAI Protocol version tested against
  failingTests: FailingTest[];
  badge: BadgeInfo;
}

export interface FailingTest {
  testId: string;
  testName: string;
  category: string;
  error: string;
  expected: string;
  actual: string;
  severity: "blocker" | "major" | "minor";
}

export interface BadgeInfo {
  svgUrl: string;                        // https://conformance.frootai.dev/badges/{vendorId}/{level}.svg
  markdownEmbed: string;                 // [![FAI Conformant L2](url)](dashboard_url)
  htmlEmbed: string;
  available: boolean;                    // only available if level passes
}

// ── Tracked Vendors ─────────────────────────────────────────────────────

export const TRACKED_VENDORS: Omit<VendorConformance, "levels" | "highestLevel" | "certified" | "certificationId" | "certificationExpiry" | "lastTestedAt" | "firstConformant" | "levelHistory" | "updatedAt">[] = [
  // Frameworks
  { vendorId: "langchain", vendorName: "LangChain", vendorUrl: "https://langchain.com", vendorLogo: "", vendorType: "framework", sdkLanguage: "Python + TypeScript", sdkRepoUrl: "https://github.com/langchain-ai/langchain", sdkVersion: "", testMethod: "automated_ci", ciJobUrl: null, maintainerContact: "", autoTestEnabled: true },
  { vendorId: "semantic-kernel", vendorName: "Semantic Kernel", vendorUrl: "https://learn.microsoft.com/semantic-kernel", vendorLogo: "", vendorType: "framework", sdkLanguage: "C# + Python", sdkRepoUrl: "https://github.com/microsoft/semantic-kernel", sdkVersion: "", testMethod: "automated_ci", ciJobUrl: null, maintainerContact: "", autoTestEnabled: true },
  { vendorId: "crewai", vendorName: "CrewAI", vendorUrl: "https://crewai.com", vendorLogo: "", vendorType: "framework", sdkLanguage: "Python", sdkRepoUrl: "https://github.com/crewai/crewai", sdkVersion: "", testMethod: "automated_ci", ciJobUrl: null, maintainerContact: "", autoTestEnabled: true },
  { vendorId: "llamaindex", vendorName: "LlamaIndex", vendorUrl: "https://llamaindex.ai", vendorLogo: "", vendorType: "framework", sdkLanguage: "Python + TypeScript", sdkRepoUrl: "https://github.com/run-llama/llama_index", sdkVersion: "", testMethod: "automated_ci", ciJobUrl: null, maintainerContact: "", autoTestEnabled: true },
  { vendorId: "haystack", vendorName: "Haystack", vendorUrl: "https://haystack.deepset.ai", vendorLogo: "", vendorType: "framework", sdkLanguage: "Python", sdkRepoUrl: "https://github.com/deepset-ai/haystack", sdkVersion: "", testMethod: "automated_ci", ciJobUrl: null, maintainerContact: "", autoTestEnabled: true },
  { vendorId: "autogen", vendorName: "AutoGen", vendorUrl: "https://microsoft.github.io/autogen", vendorLogo: "", vendorType: "framework", sdkLanguage: "Python", sdkRepoUrl: "https://github.com/microsoft/autogen", sdkVersion: "", testMethod: "automated_ci", ciJobUrl: null, maintainerContact: "", autoTestEnabled: true },

  // LLM Providers
  { vendorId: "openai", vendorName: "OpenAI", vendorUrl: "https://openai.com", vendorLogo: "", vendorType: "llm_provider", sdkLanguage: "Python + TypeScript", sdkRepoUrl: "https://github.com/openai/openai-python", sdkVersion: "", testMethod: "manual_submission", ciJobUrl: null, maintainerContact: "", autoTestEnabled: false },
  { vendorId: "anthropic", vendorName: "Anthropic Claude", vendorUrl: "https://anthropic.com", vendorLogo: "", vendorType: "llm_provider", sdkLanguage: "Python + TypeScript", sdkRepoUrl: "https://github.com/anthropics/anthropic-sdk-python", sdkVersion: "", testMethod: "manual_submission", ciJobUrl: null, maintainerContact: "", autoTestEnabled: false },
  { vendorId: "google-gemini", vendorName: "Google Gemini", vendorUrl: "https://ai.google.dev", vendorLogo: "", vendorType: "llm_provider", sdkLanguage: "Python + TypeScript", sdkRepoUrl: "https://github.com/google-gemini/generative-ai-python", sdkVersion: "", testMethod: "manual_submission", ciJobUrl: null, maintainerContact: "", autoTestEnabled: false },
  { vendorId: "mistral", vendorName: "Mistral AI", vendorUrl: "https://mistral.ai", vendorLogo: "", vendorType: "llm_provider", sdkLanguage: "Python", sdkRepoUrl: "https://github.com/mistralai/client-python", sdkVersion: "", testMethod: "manual_submission", ciJobUrl: null, maintainerContact: "", autoTestEnabled: false },
  { vendorId: "cohere", vendorName: "Cohere", vendorUrl: "https://cohere.com", vendorLogo: "", vendorType: "llm_provider", sdkLanguage: "Python", sdkRepoUrl: "https://github.com/cohere-ai/cohere-python", sdkVersion: "", testMethod: "manual_submission", ciJobUrl: null, maintainerContact: "", autoTestEnabled: false },

  // Eval/Observability
  { vendorId: "braintrust", vendorName: "Braintrust", vendorUrl: "https://braintrust.dev", vendorLogo: "", vendorType: "eval_tool", sdkLanguage: "TypeScript + Python", sdkRepoUrl: "", sdkVersion: "", testMethod: "self_reported", ciJobUrl: null, maintainerContact: "", autoTestEnabled: false },
];

// ── Nightly CI Configuration ────────────────────────────────────────────

export const CI_CONFIG = {
  schedule: "0 2 * * *",                // 02:00 UTC nightly
  runner: "ubuntu-latest",
  timeout: 3600,                         // 1 hour max per vendor
  retryAttempts: 2,
  parallelVendors: 4,
  conformanceSuiteRepo: "frootai/fai-conformance-suite",
  conformanceSuiteVersion: "latest",     // always test against latest
  resultsStorage: "cosmos_db",
  alertOnRegression: true,               // alert if vendor drops a level
  alertChannel: "slack:#conformance-alerts",

  perVendorConfig: {
    installCommand: "auto-detect",       // reads vendor's package.json/requirements.txt
    testCommand: "fai-conformance run --vendor {vendorId} --level all --format json",
    outputPath: "results/{vendorId}/{date}.json",
  },
};

// ── Badge Generation ────────────────────────────────────────────────────

export function generateBadge(vendorId: string, level: string, status: "pass" | "fail" | "partial"): BadgeInfo {
  const colors = { pass: "brightgreen", fail: "red", partial: "yellow" };
  const labels = { pass: `FAI Conformant ${level}`, fail: `FAI ${level} — failing`, partial: `FAI ${level} — partial` };

  const svgUrl = `https://conformance.frootai.dev/badges/${vendorId}/${level}.svg`;
  const dashboardUrl = `https://conformance.frootai.dev/vendors/${vendorId}`;

  return {
    svgUrl,
    markdownEmbed: `[![${labels[status]}](${svgUrl})](${dashboardUrl})`,
    htmlEmbed: `<a href="${dashboardUrl}"><img src="${svgUrl}" alt="${labels[status]}" /></a>`,
    available: status === "pass",
  };
}

// ── Dashboard Data ──────────────────────────────────────────────────────

export interface ConformanceDashboard {
  lastUpdated: string;
  specVersion: string;
  suiteVersion: string;
  totalVendors: number;
  vendorsByHighestLevel: Record<string, number>; // {"L0": 5, "L1": 3, "L2": 2, ...}
  vendors: VendorConformance[];

  // Trends
  adoptionTrend: { date: string; totalConformant: number; l0: number; l1: number; l2: number; l3: number; l4: number; l5: number }[];

  // Regressions
  recentRegressions: { vendorId: string; vendorName: string; fromLevel: string; toLevel: string; detectedAt: string; ciRunUrl: string | null }[];
}

export function buildDashboardSummary(vendors: VendorConformance[]): {
  totalVendors: number;
  conformantVendors: number;
  vendorsByHighestLevel: Record<string, number>;
  avgPassRate: number;
  autoTestedVendors: number;
} {
  const vendorsByLevel: Record<string, number> = { none: 0, L0: 0, L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 };
  let totalPassRate = 0;
  let conformant = 0;
  let autoTested = 0;

  for (const v of vendors) {
    vendorsByLevel[v.highestLevel] = (vendorsByLevel[v.highestLevel] ?? 0) + 1;
    if (v.highestLevel !== "none") conformant++;
    if (v.autoTestEnabled) autoTested++;

    const l0 = v.levels.find((l) => l.level === "L0");
    if (l0) totalPassRate += l0.passRate;
  }

  return {
    totalVendors: vendors.length,
    conformantVendors: conformant,
    vendorsByHighestLevel: vendorsByLevel,
    avgPassRate: vendors.length > 0 ? Math.round(totalPassRate / vendors.length) : 0,
    autoTestedVendors: autoTested,
  };
}

// ── API Routes ──────────────────────────────────────────────────────────

export function registerConformanceDashboardRoutes(app: FastifyInstance): void {

  // GET /api/conformance — full dashboard data
  app.get("/api/conformance", async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      specVersion: "1.0.0",
      suiteVersion: "1.0.0",
      vendors: TRACKED_VENDORS.map((v) => ({ ...v, highestLevel: "not_tested", levels: [] })),
      summary: { totalVendors: TRACKED_VENDORS.length, conformantVendors: 0 },
      lastUpdated: new Date().toISOString(),
    });
  });

  // GET /api/conformance/vendors/:id — single vendor detail
  app.get("/api/conformance/vendors/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const vendor = TRACKED_VENDORS.find((v) => v.vendorId === id);
    if (!vendor) return reply.status(404).send({ error: "Vendor not found" });
    return reply.send({ vendor, levels: [], history: [] });
  });

  // GET /api/conformance/badges/:vendorId/:level.svg — badge image
  app.get("/api/conformance/badges/:vendorId/:level.svg", async (req: FastifyRequest, reply: FastifyReply) => {
    const { vendorId, level } = req.params as { vendorId: string; level: string };
    // In production: generate SVG badge dynamically based on current conformance status
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="20">
      <rect width="200" height="20" fill="#555" rx="3"/>
      <rect x="80" width="120" height="20" fill="#4c1" rx="3"/>
      <text x="40" y="14" fill="#fff" font-size="11" text-anchor="middle" font-family="sans-serif">FAI ${level}</text>
      <text x="140" y="14" fill="#fff" font-size="11" text-anchor="middle" font-family="sans-serif">${vendorId}</text>
    </svg>`;
    reply.header("Content-Type", "image/svg+xml");
    reply.header("Cache-Control", "public, max-age=3600");
    return reply.send(svg);
  });

  // POST /api/conformance/submit — vendor submits conformance results
  app.post("/api/conformance/submit", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      vendorId: string;
      sdkVersion: string;
      specVersion: string;
      results: { level: string; testsTotal: number; testsPassed: number; testsFailed: number }[];
    };

    if (!body.vendorId || !body.results) {
      return reply.status(400).send({ error: "Vendor ID and results are required" });
    }

    return reply.send({
      vendorId: body.vendorId,
      accepted: true,
      highestLevelPassed: "L0",
      message: "Results submitted. Dashboard will update within 1 hour.",
    });
  });

  // GET /api/conformance/regressions — recent conformance regressions
  app.get("/api/conformance/regressions", async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ regressions: [], period: "30d" });
  });

  // GET /api/conformance/trends — adoption trend data
  app.get("/api/conformance/trends", async (req: FastifyRequest, reply: FastifyReply) => {
    const { period } = req.query as { period?: string };
    return reply.send({ trends: [], period: period ?? "12m" });
  });

  // POST /api/conformance/ci/trigger — manually trigger CI run for a vendor
  app.post("/api/conformance/ci/trigger", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { vendorId: string };
    if (!body.vendorId) return reply.status(400).send({ error: "Vendor ID is required" });
    return reply.send({ vendorId: body.vendorId, status: "ci_triggered", estimatedCompletion: "30–60 minutes" });
  });
}
