/**
 * Foundation Incubation — achieve incubating project status in Linux Foundation.
 *
 * Production-grade:
 *   - Application submission with complete package
 *   - Incubation criteria mapping + evidence
 *   - Public announcement pipeline (Friday Letter, press, foundation blog)
 *   - Quarterly reporting cadence
 *   - Budget and membership planning
 *
 * Tracker: P6.1.004
 */

// ── Incubation Application ──────────────────────────────────────────────

export interface IncubationApplication {
  foundationTarget: "linux_foundation";
  projectName: string;
  submissionDate: string;
  status: "preparing" | "submitted" | "under_review" | "additional_info" | "accepted" | "rejected";
  reviewCommittee: string;
  expectedDecisionTimeline: string;
  applicationPackage: ApplicationItem[];
  incubationCriteria: IncubationCriterion[];
}

export interface ApplicationItem {
  name: string;
  description: string;
  documentUrl: string | null;
  status: "ready" | "in_progress" | "not_started";
}

export interface IncubationCriterion {
  id: string;
  criterion: string;
  evidence: string;
  met: boolean;
  notes: string;
}

export const INCUBATION_APPLICATION: IncubationApplication = {
  foundationTarget: "linux_foundation",
  projectName: "FAI Protocol (Framework for AI Agent Evaluation)",
  submissionDate: "",
  status: "preparing",
  reviewCommittee: "LF Technical Advisory Council (TAC)",
  expectedDecisionTimeline: "6–12 weeks from submission",

  applicationPackage: [
    { name: "Project Proposal", description: "One-page summary: problem, solution, why LF, governance model, community health", documentUrl: null, status: "in_progress" },
    { name: "Technical Charter", description: "TSC charter (v1.0), scope, IP policy, decision-making process", documentUrl: null, status: "ready" },
    { name: "Specification v1.0 GA", description: "Complete protocol spec with all 12 MUST-FIX resolved", documentUrl: null, status: "ready" },
    { name: "Conformance Suite", description: "184 automated tests, L0–L5 levels, backward-compat suite", documentUrl: null, status: "ready" },
    { name: "Reference Implementation", description: "FrootAI Cloud Engine (L0–L3 conformant) + ≥ 1 third-party L0", documentUrl: null, status: "ready" },
    { name: "Community Metrics Report", description: "GitHub stars, contributors, dependent repos, npm downloads, commercial adopters", documentUrl: null, status: "ready" },
    { name: "Endorsement Letters (≥ 3)", description: "Written endorsements from framework, cloud, and enterprise communities", documentUrl: null, status: "in_progress" },
    { name: "Contributor Guide", description: "How to contribute: RFC process, commit guidelines, review criteria", documentUrl: null, status: "ready" },
    { name: "Code of Conduct", description: "Contributor Covenant v2.1 adapted for protocol community", documentUrl: null, status: "ready" },
    { name: "IP Policy", description: "MIT license for spec, DCO for contributions, patent grant", documentUrl: null, status: "ready" },
    { name: "Budget Proposal", description: "Projected costs: infrastructure, events, documentation, legal", documentUrl: null, status: "in_progress" },
    { name: "Trademark Assignment Plan", description: "Plan for transferring FAI Protocol trademark to foundation", documentUrl: null, status: "in_progress" },
  ],

  incubationCriteria: [
    {
      id: "IC-001",
      criterion: "Production-quality specification with stable API surface",
      evidence: "FAI Protocol v1.0 GA: 12 MUST-FIX resolved, schema URI immutable, zero breaking changes, 104 plays validate",
      met: true,
      notes: "Spec is production-ready and battle-tested by FrootAI Cloud customers",
    },
    {
      id: "IC-002",
      criterion: "Active and diverse contributor community",
      evidence: "Contributors from ≥ 5 organizations, monthly active contributors ≥ 10, community Discord/forum active",
      met: false,
      notes: "Building toward this — currently FrootAI-dominated, need external contributors",
    },
    {
      id: "IC-003",
      criterion: "At least one reference implementation in production use",
      evidence: "FrootAI Cloud Engine: production-grade, serving Enterprise customers, L0–L3 conformant",
      met: true,
      notes: "Primary reference implementation with 40+ Enterprise customers",
    },
    {
      id: "IC-004",
      criterion: "Documented governance model with clear decision-making process",
      evidence: "TSC Charter v1.0: 7 seats (≥ 5 outside), voting rules, RFC process, conflict-of-interest policy",
      met: true,
      notes: "Charter ready, TSC recruitment in progress",
    },
    {
      id: "IC-005",
      criterion: "Clear IP framework (license, patent, trademark)",
      evidence: "MIT license (non-negotiable), DCO for contributions, patent grant in IP policy, trademark assignment plan",
      met: true,
      notes: "MIT license is permanent; trademark transfers to foundation on acceptance",
    },
    {
      id: "IC-006",
      criterion: "Interest from multiple vendors/organizations",
      evidence: "≥ 3 endorsement letters from external communities (frameworks, cloud providers, enterprise)",
      met: false,
      notes: "Endorsement collection in progress — targeting LangChain, Azure AI, and 1 enterprise adopter",
    },
    {
      id: "IC-007",
      criterion: "Viable path to broad adoption",
      evidence: "40+ Enterprise customers, 3 cloud marketplaces, 6 conformance levels, conformance suite enables vendor adoption",
      met: true,
      notes: "Adoption path proven by commercial traction + open protocol model",
    },
    {
      id: "IC-008",
      criterion: "No single-vendor lock-in in the specification",
      evidence: "Protocol is vendor-agnostic: works with any LLM, any framework, any cloud. No FrootAI-specific requirements in spec.",
      met: true,
      notes: "Explicitly designed for vendor neutrality from day 1",
    },
  ],
};

// ── Post-Acceptance Actions ─────────────────────────────────────────────

export interface PostAcceptanceAction {
  id: string;
  action: string;
  owner: string;
  deadline: string;
  status: "not_started" | "in_progress" | "completed";
  dependencies: string[];
}

export const POST_ACCEPTANCE_ACTIONS: PostAcceptanceAction[] = [
  {
    id: "PA-001",
    action: "Public announcement: Friday Letter + press release + foundation blog post",
    owner: "DevRel + Founder",
    deadline: "Within 7 days of acceptance",
    status: "not_started",
    dependencies: ["Foundation provides listing page URL and logo usage guidelines"],
  },
  {
    id: "PA-002",
    action: "Transfer protocol repositories to foundation GitHub organization",
    owner: "Founding Engineer",
    deadline: "Within 14 days of acceptance",
    status: "not_started",
    dependencies: ["Foundation creates GitHub org", "CI/CD migration plan"],
  },
  {
    id: "PA-003",
    action: "Transfer FAI Protocol trademark to foundation",
    owner: "Founder + Legal",
    deadline: "Within 30 days of acceptance",
    status: "not_started",
    dependencies: ["Foundation legal team provides trademark assignment agreement"],
  },
  {
    id: "PA-004",
    action: "Update all public references: website, docs, README, npm packages",
    owner: "DevRel + Eng",
    deadline: "Within 14 days of acceptance",
    status: "not_started",
    dependencies: ["New canonical URLs confirmed"],
  },
  {
    id: "PA-005",
    action: "First TSC meeting under foundation governance",
    owner: "TSC Chair",
    deadline: "Within 30 days of acceptance",
    status: "not_started",
    dependencies: ["All TSC members confirmed", "Foundation governance tools set up"],
  },
  {
    id: "PA-006",
    action: "Set up foundation project page with description, governance, community links",
    owner: "DevRel",
    deadline: "Within 7 days of acceptance",
    status: "not_started",
    dependencies: ["Foundation provides CMS access or submission form"],
  },
  {
    id: "PA-007",
    action: "First quarterly report to foundation",
    owner: "Founder",
    deadline: "90 days after acceptance",
    status: "not_started",
    dependencies: ["Foundation provides report template"],
  },
];

// ── Quarterly Reporting ─────────────────────────────────────────────────

export interface QuarterlyReport {
  quarter: string;               // "2027-Q1"
  submittedDate: string;
  submittedBy: string;

  adoption: {
    totalConformantImplementations: number;
    newImplementationsThisQuarter: number;
    vendorsPassingL0Plus: number;
    enterpriseDeploymentsEstimate: number;
    npmDownloadsMonthly: number;
  };

  community: {
    githubStars: number;
    totalContributors: number;
    activeContributorsThisQuarter: number;
    organizationsContributing: number;
    openIssues: number;
    closedIssuesThisQuarter: number;
    rfcsSubmitted: number;
    rfcsAccepted: number;
    rfcsRejected: number;
  };

  governance: {
    tscMeetingsHeld: number;
    tscAttendanceRate: number;
    charterAmendments: number;
    newTSCMembers: number;
    departureTSCMembers: number;
  };

  specification: {
    currentVersion: string;
    changesThisQuarter: number;
    breakingChanges: number;
    conformanceSuiteTests: number;
    backwardCompatIssues: number;
  };

  challenges: string[];
  successes: string[];
  nextQuarterPriorities: string[];
}

export const QUARTERLY_REPORT_TEMPLATE: Omit<QuarterlyReport, "quarter" | "submittedDate" | "submittedBy"> = {
  adoption: { totalConformantImplementations: 0, newImplementationsThisQuarter: 0, vendorsPassingL0Plus: 0, enterpriseDeploymentsEstimate: 0, npmDownloadsMonthly: 0 },
  community: { githubStars: 0, totalContributors: 0, activeContributorsThisQuarter: 0, organizationsContributing: 0, openIssues: 0, closedIssuesThisQuarter: 0, rfcsSubmitted: 0, rfcsAccepted: 0, rfcsRejected: 0 },
  governance: { tscMeetingsHeld: 0, tscAttendanceRate: 0, charterAmendments: 0, newTSCMembers: 0, departureTSCMembers: 0 },
  specification: { currentVersion: "1.0.0", changesThisQuarter: 0, breakingChanges: 0, conformanceSuiteTests: 184, backwardCompatIssues: 0 },
  challenges: [],
  successes: [],
  nextQuarterPriorities: [],
};

// ── Budget Planning ─────────────────────────────────────────────────────

export const FOUNDATION_BUDGET = {
  annualMembership: {
    tier: "Premier" as const,
    estimatedCost: 100000,       // USD — LF Premier membership (may negotiate startup discount)
    startupDiscount: "Negotiate 50% discount for first 2 years (LF has startup programs)",
    adjustedCost: 50000,         // USD — with negotiated discount
  },

  projectInfrastructure: {
    ciCd: { provider: "GitHub Actions", annualCost: 0, notes: "Free for public repos" },
    schemaHosting: { provider: "Azure Front Door CDN", annualCost: 1200, notes: "Immutable schema hosting" },
    conformanceDashboard: { provider: "Azure Static Web App", annualCost: 600, notes: "Public conformance matrix" },
    documentation: { provider: "GitHub Pages or Docusaurus", annualCost: 0, notes: "Free hosting" },
  },

  events: {
    tscMeetings: { cost: 0, notes: "Virtual — no cost" },
    annualSummit: { cost: 15000, notes: "1-day co-located event at KubeCon or similar (venue, catering, A/V)" },
    conferenceSponsorship: { cost: 10000, notes: "2 conference presentations/year (travel, booth)" },
  },

  legal: {
    trademarkTransfer: { cost: 5000, notes: "One-time legal fees for trademark assignment" },
    patentReview: { cost: 3000, notes: "Annual patent landscape review" },
    ipPolicyMaintenance: { cost: 2000, notes: "Annual legal review of IP policy" },
  },

  totalFirstYear: 86800,        // USD (with startup discount)
  totalOngoing: 131800,         // USD (full Premier membership)
  fundingSource: "FrootAI GmbH covers first 2 years; thereafter funded by foundation membership dues from other members",
};

// ── Announcement Pipeline ───────────────────────────────────────────────

export const ANNOUNCEMENT_PIPELINE = {
  channels: [
    { channel: "Friday Letter", timing: "Day of acceptance", owner: "DevRel", content: "Dedicated edition: FAI Protocol joins Linux Foundation" },
    { channel: "Press release", timing: "Day of acceptance", owner: "Founder + PR", content: "Co-authored with LF communications team" },
    { channel: "Foundation blog", timing: "Day of acceptance", owner: "LF + FrootAI", content: "Guest post on LF blog: why FAI Protocol matters" },
    { channel: "Founder LinkedIn", timing: "Day of acceptance", owner: "Founder", content: "Personal story: from idea to foundation-hosted standard" },
    { channel: "X/Twitter thread", timing: "Day of acceptance", owner: "Founder", content: "7-tweet thread: problem → protocol → foundation → what's next" },
    { channel: "Hacker News", timing: "Day of acceptance", owner: "Founder", content: "Show HN: FAI Protocol is now a Linux Foundation project" },
    { channel: "GitHub Discussion", timing: "Day of acceptance", owner: "DevRel", content: "Community announcement + AMA thread" },
    { channel: "Email blast", timing: "Day of acceptance", owner: "DevRel", content: "All customers + newsletter subscribers" },
    { channel: "Partner notification", timing: "Day before public", owner: "Partner Manager", content: "Advance notice to SI partners + cloud partners" },
    { channel: "Analyst notification", timing: "Day before public", owner: "PMM", content: "Advance briefing to Gartner, Forrester, IDC" },
  ],
};

// ── Readiness Gate ──────────────────────────────────────────────────────

export function isReadyForIncubation(app: IncubationApplication): {
  ready: boolean;
  criterionsMet: number;
  criterionsTotal: number;
  packageReady: number;
  packageTotal: number;
  blockers: string[];
} {
  const criterionsMet = app.incubationCriteria.filter((c) => c.met).length;
  const packageReady = app.applicationPackage.filter((p) => p.status === "ready").length;
  const blockers: string[] = [];

  for (const c of app.incubationCriteria) {
    if (!c.met) blockers.push(`Criterion ${c.id}: ${c.criterion}`);
  }
  for (const p of app.applicationPackage) {
    if (p.status !== "ready") blockers.push(`Package: ${p.name} (${p.status})`);
  }

  return {
    ready: blockers.length === 0,
    criterionsMet,
    criterionsTotal: app.incubationCriteria.length,
    packageReady,
    packageTotal: app.applicationPackage.length,
    blockers,
  };
}
