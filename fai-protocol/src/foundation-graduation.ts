/**
 * Foundation Graduation — exit incubation to full project status.
 *
 * Production-grade:
 *   - Graduation criteria mapping with evidence requirements
 *   - Adoption metrics thresholds (≥ 50 implementations, ≥ 5 orgs)
 *   - Security audit completion
 *   - Stable governance proof (≥ 12 months)
 *   - Graduation application + review process
 *   - Public announcement with case studies + adoption data
 *
 * Tracker: P6.1.005
 */

// ── Graduation Criteria ─────────────────────────────────────────────────

export interface GraduationCriterion {
  id: string;
  criterion: string;
  threshold: string;
  evidenceRequired: string[];
  currentValue: string | number | null;
  met: boolean;
  blocker: boolean;
  notes: string;
}

export const GRADUATION_CRITERIA: GraduationCriterion[] = [
  {
    id: "GC-001",
    criterion: "Stable governance for ≥ 12 months",
    threshold: "TSC operational for ≥ 12 consecutive months without governance failure",
    evidenceRequired: [
      "12 months of published TSC meeting minutes",
      "≥ 24 TSC meetings held (bi-weekly cadence)",
      "≥ 75% average attendance rate",
      "0 quorum failures in last 6 months",
      "Charter version history showing stability (≤ 2 amendments in 12 months)",
      "Conflict-of-interest disclosures documented for all members",
    ],
    currentValue: null,
    met: false,
    blocker: true,
    notes: "Clock starts when TSC holds first formal meeting under foundation governance",
  },
  {
    id: "GC-002",
    criterion: "Proven adoption: ≥ 50 conformant implementations",
    threshold: "≥ 50 distinct implementations declaring FAI conformance (L0 or higher)",
    evidenceRequired: [
      "Conformance dashboard showing ≥ 50 implementations",
      "Implementations span ≥ 3 programming languages",
      "Implementations include ≥ 5 commercial products (not just hobby projects)",
      "Conformance suite version matches current spec version",
      "At least 10 implementations at L2+ (full eval execution, not just schema parsing)",
    ],
    currentValue: null,
    met: false,
    blocker: true,
    notes: "Conformance dashboard tracks this automatically. Count verified implementations only.",
  },
  {
    id: "GC-003",
    criterion: "Diverse contributor base: ≥ 5 organizations",
    threshold: "Contributions from employees of ≥ 5 different organizations in trailing 12 months",
    evidenceRequired: [
      "GitHub contribution analytics showing ≥ 5 distinct org domains in commit authors",
      "At least 2 organizations with ≥ 10 commits each (not just typo fixes)",
      "TSC composition from ≥ 5 organizations",
      "No single organization contributes > 50% of commits",
      "Contributor diversity report (geographic, organizational, role)",
    ],
    currentValue: null,
    met: false,
    blocker: true,
    notes: "FrootAI will likely be the largest contributor, but must be < 50% of total",
  },
  {
    id: "GC-004",
    criterion: "Security audit completed",
    threshold: "Independent security audit of protocol spec + conformance suite + reference implementation",
    evidenceRequired: [
      "Audit report from recognized security firm (Trail of Bits, NCC Group, Cure53, or equivalent)",
      "Audit scope: protocol spec (injection vectors, trust boundaries), conformance suite (false passes), reference implementation (standard OWASP)",
      "All critical and high findings resolved",
      "Remediation verified by auditor (or independent reviewer)",
      "Audit report published (with responsible redaction of exploit details)",
    ],
    currentValue: null,
    met: false,
    blocker: true,
    notes: "Budget: $50k–$80k for comprehensive audit. Can be co-funded by foundation or member companies.",
  },
  {
    id: "GC-005",
    criterion: "Production usage at scale",
    threshold: "Protocol used in production by organizations processing ≥ 1M evaluations/month collectively",
    evidenceRequired: [
      "Anonymized usage data from ≥ 3 production deployments",
      "Combined evaluation volume ≥ 1M/month",
      "Zero protocol-level incidents in trailing 6 months (implementation bugs don't count)",
      "At least 1 deployment in regulated industry (healthcare, financial services, government)",
    ],
    currentValue: null,
    met: false,
    blocker: false,
    notes: "FrootAI Cloud alone may meet the 1M threshold. Third-party data strengthens the case.",
  },
  {
    id: "GC-006",
    criterion: "Complete and maintained documentation",
    threshold: "Spec, guides, and references are current, comprehensive, and actively maintained",
    evidenceRequired: [
      "Specification document current with latest release",
      "Getting Started guide tested monthly (works as documented)",
      "API reference generated from schema (auto-updated on spec changes)",
      "Migration guide from v0.9-rc1 → v1.0 published and tested",
      "FAQ covering top 20 community questions",
      "Documentation translated into ≥ 2 languages (English + 1 other)",
    ],
    currentValue: null,
    met: false,
    blocker: false,
    notes: "Documentation must be on foundation-hosted infrastructure (not frootai.dev)",
  },
  {
    id: "GC-007",
    criterion: "Specification stability",
    threshold: "v1.x has been stable for ≥ 6 months with zero breaking changes",
    evidenceRequired: [
      "Changelog shows no breaking changes in last 6 months",
      "All minor versions (v1.1, v1.2, etc.) are strict supersets of v1.0",
      "Backward-compatibility test suite passes continuously (CI green for 6 months)",
      "No community reports of unexpected breakage",
    ],
    currentValue: null,
    met: false,
    blocker: true,
    notes: "This is the most important signal: enterprises need stability before adopting a standard",
  },
  {
    id: "GC-008",
    criterion: "Vendor neutrality demonstrated",
    threshold: "Protocol governance has made ≥ 3 decisions that were not in FrootAI's commercial interest",
    evidenceRequired: [
      "TSC meeting minutes documenting decisions where FrootAI was outvoted or compromised",
      "At least 1 feature requested by FrootAI that TSC rejected or modified",
      "At least 1 feature from a competing vendor that TSC accepted",
      "No evidence of FrootAI blocking or delaying community contributions",
    ],
    currentValue: null,
    met: false,
    blocker: false,
    notes: "This is the hardest to demonstrate but the most important for credibility",
  },
];

// ── Graduation Application ──────────────────────────────────────────────

export interface GraduationApplication {
  projectName: string;
  currentStatus: "incubating";
  targetStatus: "graduated";
  submissionDate: string | null;
  reviewDate: string | null;
  decision: "pending" | "approved" | "deferred" | "rejected" | null;

  criterionSummary: {
    total: number;
    met: number;
    blockersMet: number;
    blockersTotal: number;
  };

  evidencePackage: {
    governanceEvidence: string;       // URL to 12 months of meeting minutes
    adoptionEvidence: string;         // URL to conformance dashboard
    contributorEvidence: string;      // URL to contributor analytics
    securityAuditReport: string;      // URL to published audit report
    stabilityEvidence: string;        // URL to backward-compat CI dashboard
    vendorNeutralityEvidence: string; // URL to relevant TSC minutes
  };

  timeline: GraduationMilestone[];
}

export interface GraduationMilestone {
  month: number;
  milestone: string;
  status: "not_started" | "in_progress" | "completed";
  dependencies: string[];
}

export const GRADUATION_TIMELINE: GraduationMilestone[] = [
  { month: 28, milestone: "Begin tracking graduation criteria evidence systematically", status: "not_started", dependencies: ["Incubation accepted"] },
  { month: 29, milestone: "Commission security audit (RFP to 3 firms, select, scope)", status: "not_started", dependencies: ["Budget approved"] },
  { month: 30, milestone: "Security audit fieldwork (4–6 weeks)", status: "not_started", dependencies: ["Audit firm engaged"] },
  { month: 30, milestone: "Collect adoption evidence: conformance dashboard ≥ 30 implementations", status: "not_started", dependencies: ["Conformance dashboard operational"] },
  { month: 31, milestone: "Security audit report received; remediate critical/high findings", status: "not_started", dependencies: ["Audit complete"] },
  { month: 31, milestone: "Contributor diversity report: verify ≥ 5 organizations", status: "not_started", dependencies: ["12 months of contribution data"] },
  { month: 32, milestone: "Governance stability: verify 12 months of TSC operations", status: "not_started", dependencies: ["12 months since first TSC meeting"] },
  { month: 32, milestone: "Vendor neutrality evidence: compile TSC decisions demonstrating independence", status: "not_started", dependencies: ["≥ 3 qualifying decisions documented"] },
  { month: 32, milestone: "Self-assessment: all graduation criteria reviewed, gaps identified", status: "not_started", dependencies: ["All evidence collected"] },
  { month: 33, milestone: "Submit graduation application to foundation TAC", status: "not_started", dependencies: ["Self-assessment passes"] },
  { month: 34, milestone: "Foundation TAC review (6–8 week process)", status: "not_started", dependencies: ["Application submitted"] },
  { month: 35, milestone: "Graduation decision received", status: "not_started", dependencies: ["TAC review complete"] },
  { month: 35, milestone: "Public announcement: FAI Protocol graduates to full project status", status: "not_started", dependencies: ["Graduation approved"] },
];

// ── Security Audit ──────────────────────────────────────────────────────

export interface SecurityAudit {
  id: string;
  auditFirm: string;
  scope: string[];
  status: "rfp" | "engaged" | "in_progress" | "report_received" | "remediated" | "published";
  startDate: string | null;
  endDate: string | null;
  budget: number;
  currency: string;
  findings: SecurityFinding[];
  reportUrl: string | null;
}

export interface SecurityFinding {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "informational";
  title: string;
  description: string;
  component: "spec" | "conformance_suite" | "reference_impl";
  status: "open" | "in_progress" | "resolved" | "accepted_risk";
  resolvedAt: string | null;
  verifiedBy: string | null;
}

export const SECURITY_AUDIT_SCOPE = {
  targetFirms: ["Trail of Bits", "NCC Group", "Cure53"],
  budgetRange: { min: 50000, max: 80000, currency: "USD" },
  duration: "4–6 weeks",
  scope: [
    "Protocol specification: injection vectors in eval prompts, trust boundary analysis, data flow security",
    "Conformance suite: false-pass scenarios (implementation passes suite but is insecure), test coverage gaps",
    "Reference implementation (FrootAI Engine): OWASP Top 10, auth/authz, input validation, encryption, secrets management",
    "Schema validation: schema bypass attacks, malformed manifest handling, DoS via complex schemas",
    "Hook/extension security: code injection via hooks, sandbox escape, resource exhaustion",
  ],
  deliverables: [
    "Detailed finding report with severity, exploitability, and remediation guidance",
    "Executive summary suitable for public publication (redacted)",
    "Remediation verification (re-test after fixes applied)",
    "Final attestation letter (suitable for foundation graduation evidence)",
  ],
};

// ── Announcement ────────────────────────────────────────────────────────

export const GRADUATION_ANNOUNCEMENT = {
  headline: "FAI Protocol Graduates to Full Linux Foundation Project Status",
  keyMessages: [
    "FAI Protocol is now an officially graduated Linux Foundation project — the highest tier of maturity",
    "50+ conformant implementations across the AI ecosystem prove the protocol is a de facto standard",
    "Independent security audit completed with zero unresolved critical findings",
    "Governed by a 7-member TSC with representatives from 5+ organizations — no single-vendor control",
    "Used in production by 150+ Enterprise customers across healthcare, financial services, and government",
  ],
  celebrationActions: [
    "Press release co-authored with Linux Foundation",
    "Dedicated Friday Letter edition",
    "Founder keynote at next LF event (KubeCon or LF Member Summit)",
    "Case study compilation: '50 ways the world uses FAI Protocol'",
    "Thank-you video to all TSC members and contributors",
    "Limited-edition 'FAI v1.0 Graduated' swag for top 100 contributors",
  ],
};

// ── Readiness Gate ──────────────────────────────────────────────────────

export function isReadyForGraduation(criteria: GraduationCriterion[]): {
  ready: boolean;
  blockersMet: number;
  blockersTotal: number;
  nonBlockersMet: number;
  nonBlockersTotal: number;
  gaps: string[];
} {
  const blockers = criteria.filter((c) => c.blocker);
  const nonBlockers = criteria.filter((c) => !c.blocker);

  const blockersMet = blockers.filter((c) => c.met).length;
  const nonBlockersMet = nonBlockers.filter((c) => c.met).length;

  const gaps = criteria
    .filter((c) => !c.met)
    .map((c) => `${c.id}${c.blocker ? " [BLOCKER]" : ""}: ${c.criterion} — ${c.notes}`);

  return {
    ready: blockersMet === blockers.length,
    blockersMet,
    blockersTotal: blockers.length,
    nonBlockersMet,
    nonBlockersTotal: nonBlockers.length,
    gaps,
  };
}
