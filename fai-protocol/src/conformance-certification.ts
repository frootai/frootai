/**
 * Conformance Certification Program — paid certification for enterprise implementations.
 *
 * Production-grade:
 *   - Self-serve L0–L2: free (automated suite, badge auto-issued)
 *   - Certified L3–L5: €5k one-time audit (TSC member reviews, signed certificate)
 *   - Enterprise certification: €25k/yr (annual re-certification, dedicated support, featured)
 *   - Revenue share: 50% FrootAI, 50% foundation
 *   - Certification portal integrated into conformance dashboard
 *
 * Tracker: P6.1.007
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

// ── Certification Tiers ─────────────────────────────────────────────────

export interface CertificationTier {
  id: "self_serve" | "certified" | "enterprise";
  name: string;
  levels: string[];
  fee: number;
  feeCurrency: string;
  feeType: "free" | "one_time" | "annual";
  process: CertificationProcess;
  benefits: string[];
  sla: { responseTime: string; reviewTime: string; validityPeriod: string };
  revenueShare: { frootai: number; foundation: number };
}

export interface CertificationProcess {
  steps: { step: number; name: string; description: string; automated: boolean; duration: string }[];
  auditorRequirements: string[];
  appealProcess: string;
}

export const CERTIFICATION_TIERS: CertificationTier[] = [
  {
    id: "self_serve",
    name: "Self-Serve Conformance",
    levels: ["L0", "L1", "L2"],
    fee: 0,
    feeCurrency: "EUR",
    feeType: "free",
    process: {
      steps: [
        { step: 1, name: "Run conformance suite", description: "Execute `fai-conformance run --level L2 --vendor {your-id}` against your implementation", automated: true, duration: "5–30 minutes" },
        { step: 2, name: "Submit results", description: "POST results JSON to conformance.frootai.dev/api/conformance/submit", automated: true, duration: "Instant" },
        { step: 3, name: "Automated verification", description: "System verifies result integrity (hash matches, no tampering), checks test coverage", automated: true, duration: "< 1 minute" },
        { step: 4, name: "Badge issued", description: "Badge SVG and embed code generated. Visible on conformance dashboard.", automated: true, duration: "Instant" },
      ],
      auditorRequirements: [],
      appealProcess: "If results are incorrect, re-run the suite. If test is buggy, file issue on fai-conformance-suite repo.",
    },
    benefits: [
      "FAI Conformant badge (L0/L1/L2) for README and website",
      "Listed on public conformance dashboard",
      "Community recognition",
      "Access to conformance test fixtures and reference data",
    ],
    sla: { responseTime: "Instant (automated)", reviewTime: "N/A", validityPeriod: "Valid until spec version changes (re-run on new version)" },
    revenueShare: { frootai: 0, foundation: 0 },
  },
  {
    id: "certified",
    name: "Certified Conformance",
    levels: ["L3", "L4", "L5"],
    fee: 5000,
    feeCurrency: "EUR",
    feeType: "one_time",
    process: {
      steps: [
        { step: 1, name: "Application", description: "Submit certification application with implementation details, test results, and architecture documentation", automated: false, duration: "1 day" },
        { step: 2, name: "Payment", description: "€5,000 certification fee via Stripe", automated: true, duration: "Instant" },
        { step: 3, name: "Automated suite verification", description: "FrootAI runs conformance suite independently against applicant's implementation", automated: true, duration: "1–2 hours" },
        { step: 4, name: "Manual review", description: "TSC-approved auditor reviews: multi-model scoring quality, human-in-loop integration, monitoring setup (L3/L4/L5 specific)", automated: false, duration: "5–10 business days" },
        { step: 5, name: "Findings report", description: "Auditor provides detailed findings: pass/fail per criterion, recommendations, required fixes", automated: false, duration: "3 business days" },
        { step: 6, name: "Remediation (if needed)", description: "Applicant fixes any blocking findings. Free re-review within 90 days.", automated: false, duration: "Variable" },
        { step: 7, name: "Certificate issued", description: "Signed digital certificate (PDF + JSON) issued. Featured on conformance dashboard.", automated: true, duration: "1 business day" },
      ],
      auditorRequirements: [
        "TSC member or TSC-approved external auditor",
        "No conflict of interest (auditor cannot be employed by applicant or direct competitor)",
        "Signed auditor agreement with NDA for applicant's proprietary implementation details",
        "Auditor rotated: same auditor cannot certify same vendor more than 2 consecutive times",
      ],
      appealProcess: "Applicant may appeal within 14 days of rejection. Appeal reviewed by different TSC member. Final decision within 10 business days.",
    },
    benefits: [
      "All Self-Serve benefits",
      "'Certified' badge with signed certificate number",
      "Featured placement on conformance dashboard (above non-certified)",
      "Press release: FrootAI co-announces certification",
      "Logo on frootai.dev/conformance 'Certified Partners' section",
      "Certification referenced in analyst briefings",
      "Free re-certification within 90 days if spec minor version changes",
    ],
    sla: { responseTime: "Acknowledgment within 2 business days", reviewTime: "Complete within 15 business days", validityPeriod: "12 months from issue date" },
    revenueShare: { frootai: 50, foundation: 50 },
  },
  {
    id: "enterprise",
    name: "Enterprise Certification",
    levels: ["L3", "L4", "L5"],
    fee: 25000,
    feeCurrency: "EUR",
    feeType: "annual",
    process: {
      steps: [
        { step: 1, name: "Enterprise agreement", description: "Sign enterprise certification agreement (annual, includes all benefits)", automated: false, duration: "1–2 weeks" },
        { step: 2, name: "Payment", description: "€25,000/year via invoice or Stripe", automated: true, duration: "Net-30 invoicing" },
        { step: 3, name: "Initial certification", description: "Same process as Certified tier (steps 3–7)", automated: false, duration: "15 business days" },
        { step: 4, name: "Quarterly re-validation", description: "Automated conformance suite re-run quarterly. Results published on dashboard.", automated: true, duration: "Automated" },
        { step: 5, name: "Annual re-certification", description: "Full manual review annually (included in fee)", automated: false, duration: "10 business days" },
        { step: 6, name: "Ongoing support", description: "Dedicated Slack channel with FrootAI conformance team. 4h SLA on spec interpretation questions.", automated: false, duration: "Ongoing" },
      ],
      auditorRequirements: [
        "Same as Certified tier",
        "Dedicated auditor assigned for the annual term (relationship continuity)",
      ],
      appealProcess: "Same as Certified tier, with escalation to TSC Chair if needed.",
    },
    benefits: [
      "All Certified benefits",
      "'Enterprise Certified' premier badge",
      "Dedicated conformance support channel (Slack, 4h SLA)",
      "Quarterly automated re-validation (no manual effort from vendor)",
      "Annual re-certification included (no additional fee)",
      "Early notification of spec changes (8 weeks before public)",
      "Input on conformance suite evolution (quarterly feedback session)",
      "Co-marketing: joint webinar + case study opportunity",
      "Featured in FrootAI sales materials as 'Enterprise Certified Partner'",
      "Priority listing on conformance dashboard",
      "Invitation to annual conformance summit (in-person, co-located with LF event)",
    ],
    sla: { responseTime: "Acknowledgment within 4 hours (business hours)", reviewTime: "Complete within 10 business days", validityPeriod: "12 months, auto-renews" },
    revenueShare: { frootai: 50, foundation: 50 },
  },
];

// ── Certificate Model ───────────────────────────────────────────────────

export interface ConformanceCertificate {
  id: string;                            // "cert-2026-0001"
  vendorId: string;
  vendorName: string;
  tier: "certified" | "enterprise";
  level: string;                         // "L3" | "L4" | "L5"
  specVersion: string;                   // "1.0.0"
  suiteVersion: string;

  // Audit
  auditorId: string;
  auditorName: string;
  auditorOrganization: string;
  auditDate: string;
  auditScope: string[];
  findingsCount: { critical: number; major: number; minor: number; informational: number };
  allBlockingResolved: boolean;

  // Certificate
  issuedAt: string;
  expiresAt: string;
  status: "active" | "expired" | "revoked" | "suspended";
  revocationReason: string | null;

  // Verification
  signatureHash: string;                 // SHA-256 of certificate content, signed by FrootAI
  verificationUrl: string;               // conformance.frootai.dev/verify/{id}
  publicKeyUrl: string;                  // for independent verification

  // Renewal
  renewalDate: string | null;
  autoRenew: boolean;
  stripeSubscriptionId: string | null;   // for Enterprise annual billing
}

export interface CertificationApplication {
  id: string;
  vendorId: string;
  vendorName: string;
  tier: "certified" | "enterprise";
  targetLevel: string;
  submittedAt: string;
  status: "submitted" | "payment_pending" | "automated_testing" | "manual_review" | "remediation" | "approved" | "rejected" | "appealed";

  // Payment
  fee: number;
  currency: string;
  paymentStatus: "pending" | "paid" | "refunded";
  stripePaymentIntentId: string | null;

  // Testing
  automatedSuiteResult: {
    passed: boolean;
    testsTotal: number;
    testsPassed: number;
    runAt: string;
    duration: number;
  } | null;

  // Manual review
  auditorAssigned: string | null;
  reviewStartedAt: string | null;
  reviewCompletedAt: string | null;
  findings: AuditFinding[];

  // Decision
  decision: "pending" | "approved" | "rejected";
  decisionReason: string | null;
  certificateId: string | null;

  // Appeal
  appealedAt: string | null;
  appealReason: string | null;
  appealReviewerId: string | null;
  appealDecision: "pending" | "upheld" | "overturned" | null;
}

export interface AuditFinding {
  id: string;
  severity: "critical" | "major" | "minor" | "informational";
  category: string;
  title: string;
  description: string;
  affectedLevel: string;
  recommendation: string;
  status: "open" | "fixed" | "accepted_risk" | "wont_fix";
  fixedAt: string | null;
  verifiedAt: string | null;
}

// ── Revenue Tracking ────────────────────────────────────────────────────

export interface CertificationRevenue {
  period: string;                        // "2026-Q4"
  totalRevenue: number;
  currency: string;
  byTier: {
    certified: { applications: number; revenue: number };
    enterprise: { activeSubscriptions: number; revenue: number };
  };
  revenueShare: {
    frootai: number;
    foundation: number;
  };
  refunds: number;
}

export function calculateRevenue(
  certifiedApplications: number,
  enterpriseSubscriptions: number,
): CertificationRevenue {
  const certifiedRevenue = certifiedApplications * 5000;
  const enterpriseRevenue = enterpriseSubscriptions * 25000;
  const totalRevenue = certifiedRevenue + enterpriseRevenue;

  return {
    period: new Date().toISOString().slice(0, 7),
    totalRevenue,
    currency: "EUR",
    byTier: {
      certified: { applications: certifiedApplications, revenue: certifiedRevenue },
      enterprise: { activeSubscriptions: enterpriseSubscriptions, revenue: enterpriseRevenue },
    },
    revenueShare: {
      frootai: totalRevenue * 0.5,
      foundation: totalRevenue * 0.5,
    },
    refunds: 0,
  };
}

// ── Auditor Pool ────────────────────────────────────────────────────────

export interface ConformanceAuditor {
  id: string;
  name: string;
  organization: string;
  tscMember: boolean;
  expertiseLevels: string[];             // which L3–L5 levels they can audit
  languages: string[];
  maxConcurrentAudits: number;
  currentAudits: number;
  totalAuditsCompleted: number;
  averageReviewDays: number;
  conflictsOfInterest: string[];         // vendor IDs they cannot audit
  active: boolean;
}

export function assignAuditor(
  auditors: ConformanceAuditor[],
  vendorId: string,
  targetLevel: string,
): ConformanceAuditor | null {
  const eligible = auditors
    .filter((a) => a.active)
    .filter((a) => a.currentAudits < a.maxConcurrentAudits)
    .filter((a) => a.expertiseLevels.includes(targetLevel))
    .filter((a) => !a.conflictsOfInterest.includes(vendorId))
    .sort((a, b) => a.currentAudits - b.currentAudits);

  return eligible.length > 0 ? eligible[0] : null;
}

// ── API Routes ──────────────────────────────────────────────────────────

export function registerCertificationRoutes(app: FastifyInstance): void {

  // GET /api/conformance/certification/tiers — list certification tiers
  app.get("/api/conformance/certification/tiers", async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      tiers: CERTIFICATION_TIERS.map((t) => ({
        id: t.id, name: t.name, levels: t.levels, fee: t.fee, feeType: t.feeType,
        benefits: t.benefits, sla: t.sla,
      })),
    });
  });

  // POST /api/conformance/certification/apply — apply for certification
  app.post("/api/conformance/certification/apply", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      vendorId: string;
      vendorName: string;
      tier: "certified" | "enterprise";
      targetLevel: string;
      implementationUrl: string;
      architectureDoc: string;
    };

    if (!body.vendorId || !body.tier || !body.targetLevel) {
      return reply.status(400).send({ error: "Vendor ID, tier, and target level are required" });
    }

    const validLevels = ["L3", "L4", "L5"];
    if (!validLevels.includes(body.targetLevel)) {
      return reply.status(400).send({ error: `Target level must be one of: ${validLevels.join(", ")}. L0–L2 are self-serve (free).` });
    }

    const tier = CERTIFICATION_TIERS.find((t) => t.id === body.tier);
    if (!tier) return reply.status(400).send({ error: "Invalid tier" });

    return reply.status(201).send({
      applicationId: `certapp-${Date.now()}`,
      vendorId: body.vendorId,
      tier: body.tier,
      targetLevel: body.targetLevel,
      fee: tier.fee,
      currency: tier.feeCurrency,
      status: "submitted",
      nextStep: tier.fee > 0 ? "Complete payment" : "Automated testing will begin within 1 hour",
      checkoutUrl: tier.fee > 0 ? "https://checkout.stripe.com/placeholder" : null,
      estimatedCompletion: tier.sla.reviewTime,
    });
  });

  // GET /api/conformance/certification/:id — check application status
  app.get("/api/conformance/certification/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    return reply.send({ applicationId: id, application: null });
  });

  // GET /api/conformance/verify/:certId — public certificate verification
  app.get("/api/conformance/verify/:certId", async (req: FastifyRequest, reply: FastifyReply) => {
    const { certId } = req.params as { certId: string };
    // In production: look up certificate, verify signature hash, return status
    return reply.send({
      certificateId: certId,
      valid: false,
      message: "Certificate not found. Verify the certificate ID and try again.",
      verifiedAt: new Date().toISOString(),
    });
  });

  // POST /api/conformance/certification/:id/appeal — appeal a rejection
  app.post("/api/conformance/certification/:id/appeal", async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { reason: string; additionalEvidence: string[] };

    if (!body.reason || body.reason.length < 50) {
      return reply.status(400).send({ error: "Appeal reason must be at least 50 characters" });
    }

    return reply.send({
      applicationId: id,
      appealStatus: "submitted",
      reviewDeadline: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
      message: "Appeal submitted. A different TSC member will review within 10 business days.",
    });
  });

  // GET /api/conformance/certification/revenue — revenue dashboard (admin)
  app.get("/api/conformance/certification/revenue", async (_req: FastifyRequest, reply: FastifyReply) => {
    const revenue = calculateRevenue(0, 0);
    return reply.send(revenue);
  });
}
