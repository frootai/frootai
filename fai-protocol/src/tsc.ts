/**
 * Technical Steering Committee — 5–7 outside maintainers, charter, governance.
 *
 * Production-grade:
 *   - TSC with ≥ 5 outside maintainers (not FrootAI employees)
 *   - Composition: frameworks, hyperscalers, eval vendors, enterprise, academic
 *   - Charter: voting rights, conflict-of-interest, meeting cadence
 *   - Founder holds 1 seat but no veto power
 *   - Protocol evolves by consensus, not authority
 *
 * Tracker: P6.1.003
 */

// ── TSC Charter ─────────────────────────────────────────────────────────

export const TSC_CHARTER = {
  version: "1.0",
  effectiveDate: "2026-09-01",
  publishedAt: "fai-protocol/governance/TSC-CHARTER.md",

  purpose: "The Technical Steering Committee (TSC) provides technical leadership and governance for the FAI Protocol specification, conformance suite, and reference implementations. The TSC ensures the protocol evolves in the interest of the entire community — not any single company.",

  scope: [
    "FAI Protocol specification (all versions)",
    "Conformance suite and conformance levels (L0–L5)",
    "Reference implementations (canonical engines)",
    "Protocol extension mechanisms (guardrails, hooks, knowledge modules, MCP bridge)",
    "Schema publication and versioning policy",
    "Backward-compatibility decisions",
    "Security vulnerability response for the protocol itself",
  ],

  outOfScope: [
    "FrootAI commercial products (Studio, Cloud, Desktop, Marketplace) — those are company decisions",
    "Pricing, licensing, or business model of FrootAI GmbH",
    "Individual vendor implementations (unless claiming conformance)",
    "Marketing or positioning of the protocol",
  ],

  composition: {
    totalSeats: 7,
    minimumOutside: 5,
    maximumFromSingleOrg: 1,
    founderSeat: {
      holder: "FrootAI Founder (ex-officio)",
      votingPower: "Equal (1 vote, same as all other members)",
      vetoRight: false,
      termLimit: "No term limit for founder seat (unless founder resigns)",
    },
    seatAllocation: [
      { seat: 1, category: "AI Frameworks", description: "Representative from LangChain, Semantic Kernel, CrewAI, LlamaIndex, or equivalent", required: true },
      { seat: 2, category: "Hyperscaler / Cloud", description: "Representative from Microsoft, AWS, Google Cloud, or equivalent", required: true },
      { seat: 3, category: "Eval / Observability Vendor", description: "Representative from Braintrust, Arize, Humanloop, Weights & Biases, or equivalent", required: true },
      { seat: 4, category: "Enterprise Adopter", description: "Representative from a company using FAI Protocol in production (500+ employees)", required: true },
      { seat: 5, category: "Academic / Research", description: "Researcher from university or research institution working on AI evaluation", required: true },
      { seat: 6, category: "Community / Open Source", description: "Active community contributor or open-source AI project maintainer", required: false },
      { seat: 7, category: "Founder (FrootAI)", description: "FrootAI founder — ex-officio, equal voting, no veto", required: true },
    ],
  },

  terms: {
    termLength: "2 years",
    termLimit: "Maximum 3 consecutive terms (6 years), then 1-year cooling off",
    staggeredElection: "Half the seats up for election each year (staggered start)",
    vacancyFilling: "TSC appoints interim member within 30 days; formal election at next cycle",
    removalProcess: "Member can be removed by 2/3 supermajority vote of remaining TSC for: inactivity (miss 3 consecutive meetings), conflict of interest, or Code of Conduct violation",
  },

  voting: {
    quorum: "Simple majority (≥ 4 of 7 members present)",
    decisions: {
      specChanges: "Simple majority (≥ 4 votes) for non-breaking changes",
      breakingChanges: "Supermajority (≥ 5 votes) for any change that breaks backward compatibility",
      newConformanceLevel: "Simple majority",
      memberRemoval: "Supermajority (≥ 5 votes, excluding the member in question)",
      charterAmendment: "Supermajority (≥ 5 votes)",
    },
    tieBreaking: "Chair casts deciding vote in case of tie. Chair rotates annually among TSC members.",
    asyncVoting: "Allowed via GitHub issue with 5-business-day voting window. Quorum same as synchronous.",
    conflictOfInterest: "Members must disclose any financial interest in a decision. Conflicted members must abstain from voting on that decision.",
  },

  meetings: {
    cadence: "Bi-weekly (every 2 weeks), 60 minutes",
    format: "Video call (Zoom/Meet) + GitHub Discussions for async follow-up",
    publicMinutes: true,
    minutesPublishDeadline: "Within 5 business days of meeting",
    publicAttendance: true,
    observerPolicy: "Community members may attend as observers (muted). Speaking rights on invitation by Chair.",
    recordingPolicy: "Meetings recorded and published (with 48h delay for review)",
  },

  rfcProcess: {
    description: "All spec changes go through the RFC (Request for Comments) process",
    stages: [
      { stage: "Draft", description: "Author opens RFC as GitHub PR with rationale, spec diff, and impact assessment", duration: "No limit" },
      { stage: "Review", description: "TSC reviews in meeting. Community comments on PR. Minimum 14-day review window.", duration: "≥ 14 days" },
      { stage: "Final Comment Period (FCP)", description: "TSC member motions to enter FCP. 7-day countdown. Any blocking concern pauses FCP.", duration: "7 days" },
      { stage: "Accepted", description: "FCP completes without blocking concerns. PR merged. Spec updated.", duration: "Immediate" },
      { stage: "Rejected", description: "TSC vote: rejected with documented rationale. Author may revise and resubmit.", duration: "N/A" },
    ],
    emergencyProcess: "Security-critical changes: TSC Chair + 2 members can fast-track (24h review). Full TSC ratifies within 7 days post-merge.",
  },
};

// ── TSC Member Model ────────────────────────────────────────────────────

export interface TSCMember {
  seatNumber: number;
  category: string;
  name: string;
  organization: string;
  title: string;
  email: string;
  githubHandle: string;
  termStart: string;
  termEnd: string;
  status: "active" | "on_leave" | "vacant";
  meetingsAttended: number;
  meetingsTotal: number;
  rfcsAuthored: number;
  rfcsReviewed: number;
  isFounder: boolean;
  conflictsOfInterest: string[];
}

export interface TSCMeeting {
  id: string;
  date: string;
  attendees: string[];            // member names
  quorumMet: boolean;
  agenda: string[];
  decisions: TSCDecision[];
  actionItems: { item: string; owner: string; dueDate: string; status: "open" | "done" }[];
  minutesUrl: string;
  recordingUrl: string | null;
  duration: number;               // minutes
}

export interface TSCDecision {
  id: string;
  title: string;
  type: "spec_change" | "breaking_change" | "conformance_level" | "member_action" | "charter_amendment" | "other";
  votesFor: number;
  votesAgainst: number;
  abstentions: number;
  result: "approved" | "rejected" | "tabled";
  rationale: string;
  rfcLink: string | null;
}

// ── Recruitment Pipeline ────────────────────────────────────────────────

export interface TSCCandidate {
  name: string;
  organization: string;
  category: string;
  seatTarget: number;
  qualifications: string[];
  outreachStatus: "identified" | "contacted" | "interested" | "committed" | "declined";
  contactMethod: string;
  notes: string;
}

export const TSC_RECRUITMENT = {
  timeline: [
    { month: 24, action: "Identify candidate pool: 3–4 candidates per seat category", owner: "Founder" },
    { month: 24, action: "Draft invitation letter explaining TSC purpose, commitment, and benefits", owner: "Founder" },
    { month: 25, action: "Begin outreach: personal emails/calls to top candidates", owner: "Founder" },
    { month: 25, action: "Host information session for interested candidates (30 min video call)", owner: "Founder" },
    { month: 25, action: "Collect commitment confirmations from ≥ 5 outside members", owner: "Founder" },
    { month: 25, action: "TSC Charter reviewed and accepted by all confirmed members", owner: "All members" },
    { month: 26, action: "First TSC meeting: introductions, charter ratification, roadmap review", owner: "Chair (elected at first meeting)" },
    { month: 26, action: "Public announcement: TSC formation + member bios published", owner: "DevRel" },
  ],

  candidateEvaluation: {
    criteria: [
      { name: "Technical depth", weight: 30, description: "Deep understanding of AI evaluation, protocols, or related standards" },
      { name: "Community standing", weight: 25, description: "Respected in their community, history of constructive collaboration" },
      { name: "Organizational independence", weight: 20, description: "Can represent community interest, not just their employer's agenda" },
      { name: "Time commitment", weight: 15, description: "Can attend bi-weekly meetings + review RFCs (estimated: 4–6 hours/month)" },
      { name: "Diversity of perspective", weight: 10, description: "Brings a viewpoint not already represented on the TSC" },
    ],
    minimumScore: 3.5,              // out of 5.0 weighted average
  },

  commitmentExpectations: [
    "Attend ≥ 75% of bi-weekly TSC meetings (30 per year, ≥ 23 attended)",
    "Review ≥ 3 RFCs per quarter (provide substantive feedback, not just +1)",
    "Disclose conflicts of interest proactively",
    "Act in the interest of the FAI Protocol community, not your employer",
    "Respond to async votes within 5 business days",
    "Participate in annual planning session (half-day, virtual)",
    "Estimated time: 4–6 hours/month",
  ],

  benefits: [
    "Shape the future of AI agent evaluation standards",
    "Public recognition: name, bio, and organization on protocol governance page",
    "Early access to all spec drafts (8 weeks ahead of public)",
    "Direct influence on conformance levels and certification requirements",
    "Network with leaders across AI frameworks, cloud providers, and enterprise adopters",
    "No financial compensation (by design — independence requires no payment from FrootAI)",
  ],

  invitationTemplate: `Dear {{name}},

I'm writing to invite you to join the Technical Steering Committee (TSC) for the FAI Protocol — the open evaluation standard for AI agents.

FAI Protocol v1.0 GA is shipping, and we're establishing a vendor-neutral TSC to govern the protocol's evolution. The TSC will have 7 seats, with ≥ 5 held by individuals outside FrootAI.

Your seat category: {{category}}
Why you: {{personal_rationale}}

The commitment is ~4–6 hours/month: bi-weekly 60-min meetings + RFC review. No compensation (by design — independence matters). Your name and bio will be publicly listed on the protocol governance page.

The TSC charter is attached. I'd welcome a 30-minute call to discuss.

Best,
Pavleen Bali
Founder, FrootAI`,
};

// ── Health Metrics ──────────────────────────────────────────────────────

export interface TSCHealthMetrics {
  totalMembers: number;
  outsideMembers: number;
  vacantSeats: number;
  avgAttendanceRate: number;       // %
  rfcsProcessedThisQuarter: number;
  avgDecisionTime: number;         // days from RFC draft to accepted/rejected
  meetingsHeldThisQuarter: number;
  quorumFailures: number;
  publicMinutesPublished: boolean;
  charterVersion: string;
}

export function isTSCHealthy(metrics: TSCHealthMetrics): { healthy: boolean; issues: string[] } {
  const issues: string[] = [];

  if (metrics.outsideMembers < 5) issues.push(`Only ${metrics.outsideMembers} outside members (need ≥ 5)`);
  if (metrics.vacantSeats > 1) issues.push(`${metrics.vacantSeats} vacant seats (max 1 acceptable)`);
  if (metrics.avgAttendanceRate < 75) issues.push(`Attendance rate ${metrics.avgAttendanceRate}% (target ≥ 75%)`);
  if (metrics.quorumFailures > 0) issues.push(`${metrics.quorumFailures} quorum failures this quarter`);
  if (!metrics.publicMinutesPublished) issues.push("Public minutes not published");
  if (metrics.avgDecisionTime > 30) issues.push(`Avg decision time ${metrics.avgDecisionTime} days (target ≤ 30)`);

  return { healthy: issues.length === 0, issues };
}
