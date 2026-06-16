/**
 * Foundation Selection — Linux Foundation or CNCF: ADR, evaluation, application package.
 *
 * Production-grade:
 *   - ADR documenting decision with weighted criteria
 *   - Evaluation matrix comparing LF, CNCF, Apache, Eclipse, OpenJS
 *   - Application package: spec, conformance suite, governance, community stats
 *   - Submission by Mo 26
 *
 * Tracker: P6.1.002
 */

// ── Architecture Decision Record ────────────────────────────────────────

export const FOUNDATION_ADR = {
  id: "ADR-008",
  title: "Standards foundation selection for FAI Protocol governance",
  date: "2026-05",
  status: "accepted" as const,

  context: `The FAI Protocol v1.0 GA is shipping. To ensure long-term vendor neutrality, credibility, and sustainable governance, the protocol should be hosted by an established open-source foundation. The foundation must:
1. Provide vendor-neutral governance (no single company controls the protocol)
2. Have credibility with enterprise adopters (CISOs, CTOs trust foundation-backed projects)
3. Support open standards (not just open-source code — but protocol/spec governance)
4. Offer IP framework (patent grants, trademark policy, contributor agreements)
5. Be financially sustainable (membership dues or endowment — not dependent on FrootAI)`,

  decision: "Linux Foundation (LF)" as const,

  reasoning: [
    "Vendor neutrality: LF governance is designed for multi-stakeholder projects — no single company veto. FAI Protocol's credibility depends on perceived independence from FrootAI the company.",
    "Standards track record: LF hosts CNCF, OpenSSF, OpenAPI, GraphQL Foundation, SPDX — proven model for open standards that enterprises adopt.",
    "Enterprise credibility: LF membership includes all major tech companies. 'Hosted by Linux Foundation' is a recognized trust signal for enterprise procurement.",
    "IP framework: LF provides DCO (Developer Certificate of Origin), Community Specification License, and trademark management — exactly what a protocol needs.",
    "Cloud-native alignment: FAI Protocol integrates with cloud infrastructure (AKS, EKS, GKE). CNCF (a LF sub-foundation) could be the specific home if we want cloud-native branding.",
    "Financial model: LF membership tiers allow FrootAI to participate at Premier level while other companies join at General/Associate — sustainable without FrootAI subsidy.",
    "Governance templates: LF provides charter templates, TSC formation guides, and legal review — reducing setup time from months to weeks.",
  ],

  alternatives: [
    {
      name: "Cloud Native Computing Foundation (CNCF)",
      relationship: "Sub-foundation of Linux Foundation",
      pros: [
        "Strong cloud-native brand recognition (Kubernetes, Prometheus, Envoy)",
        "Sandbox → Incubating → Graduated maturity model well-understood",
        "TOC (Technical Oversight Committee) provides rigorous technical review",
        "Large contributor community familiar with CNCF processes",
      ],
      cons: [
        "CNCF focuses on cloud-native infrastructure — FAI Protocol is broader (desktop, on-prem, edge)",
        "Graduated status requires significant adoption metrics (may take 2+ years)",
        "CNCF projects tend to be runtime systems, not evaluation protocols",
      ],
      verdict: "Strong alternative. Could apply to CNCF as sub-foundation if LF direct application is rejected. CNCF Sandbox is lower bar than LF incubation.",
    },
    {
      name: "Apache Software Foundation (ASF)",
      relationship: "Independent foundation",
      pros: [
        "Apache License 2.0 widely adopted in enterprise",
        "Strong community governance (The Apache Way)",
        "Proven track record (Kafka, Spark, Airflow)",
      ],
      cons: [
        "Apache Way governance is process-heavy — can slow spec evolution",
        "Apache focuses on software projects, not protocol standards",
        "CLA requirement can deter casual contributors",
        "No protocol-specific governance model",
      ],
      verdict: "Not recommended. Apache governance model is designed for software, not protocol standards.",
    },
    {
      name: "Eclipse Foundation",
      relationship: "Independent, EU-headquartered",
      pros: [
        "EU-headquartered (Brussels) — aligns with FrootAI's EU identity",
        "Hosts Jakarta EE, Eclipse IDE — enterprise credibility",
        "Specification process (Eclipse Foundation Specification Process) designed for standards",
      ],
      cons: [
        "Smaller community than LF/CNCF",
        "Primarily Java/enterprise ecosystem — less alignment with AI/ML community",
        "Less brand recognition in AI/DevTools space",
      ],
      verdict: "Interesting for EU angle but weaker brand in AI/ML ecosystem.",
    },
    {
      name: "OpenJS Foundation (LF sub-foundation)",
      relationship: "Sub-foundation of Linux Foundation",
      pros: [
        "JavaScript ecosystem alignment (FAI tools are TypeScript-based)",
        "Hosts Node.js, Electron, webpack — familiar community",
      ],
      cons: [
        "Too narrow — FAI Protocol is language-agnostic, not JS-specific",
        "Smaller than LF or CNCF for enterprise credibility",
      ],
      verdict: "Not recommended. FAI Protocol is not JavaScript-specific.",
    },
    {
      name: "Self-hosted foundation (FrootAI Foundation)",
      relationship: "Created by FrootAI",
      pros: [
        "Full control over governance",
        "No membership fees",
        "Faster decision-making",
      ],
      cons: [
        "Zero vendor neutrality credibility — 'FrootAI Foundation' is obviously FrootAI-controlled",
        "No independent IP framework",
        "No existing governance infrastructure",
        "Enterprise buyers will see through it",
      ],
      verdict: "Rejected. Self-hosted foundation undermines the entire purpose of foundation governance.",
    },
  ],

  consequences: [
    "Apply to Linux Foundation for project hosting by Mo 26",
    "Prepare application package: v1.0 spec, conformance suite, governance charter, community metrics",
    "Budget: LF Premier membership ~$100k/yr (or negotiate startup discount)",
    "Designate FrootAI TSC representative (founder holds 1 seat)",
    "Transfer protocol trademark to foundation upon acceptance",
    "Maintain MIT license on protocol spec (non-negotiable)",
    "If LF rejects: apply to CNCF Sandbox as fallback",
  ],
};

// ── Evaluation Matrix ───────────────────────────────────────────────────

export interface FoundationEvaluation {
  foundation: string;
  criteria: { name: string; weight: number; score: number; rationale: string }[];
  totalScore: number;
}

export const EVALUATION_CRITERIA = [
  { name: "Vendor Neutrality", weight: 25, description: "Governance prevents single-company control" },
  { name: "Enterprise Credibility", weight: 20, description: "Foundation name is a trust signal for enterprise procurement" },
  { name: "Standards Support", weight: 20, description: "Foundation has experience hosting protocol/standard specifications" },
  { name: "IP Framework", weight: 15, description: "Patent grants, trademark policy, contributor agreements" },
  { name: "Community Alignment", weight: 10, description: "Existing community overlaps with AI/ML/DevTools ecosystem" },
  { name: "Cost & Effort", weight: 10, description: "Membership fees, application effort, ongoing reporting burden" },
];

export const FOUNDATION_EVALUATIONS: FoundationEvaluation[] = [
  {
    foundation: "Linux Foundation (Direct)",
    criteria: [
      { name: "Vendor Neutrality", weight: 25, score: 5, rationale: "Gold standard for vendor-neutral governance. Multiple stakeholder model." },
      { name: "Enterprise Credibility", weight: 20, score: 5, rationale: "Highest enterprise recognition. 'Hosted by LF' is a procurement shortcut." },
      { name: "Standards Support", weight: 20, score: 5, rationale: "Hosts OpenAPI, GraphQL, SPDX — proven protocol governance model." },
      { name: "IP Framework", weight: 15, score: 5, rationale: "Community Specification License, DCO, trademark management all available." },
      { name: "Community Alignment", weight: 10, score: 4, rationale: "Broad community but not AI-specific. Need to build AI sub-community." },
      { name: "Cost & Effort", weight: 10, score: 3, rationale: "$100k/yr Premier membership. Application process is thorough but manageable." },
    ],
    totalScore: 0,
  },
  {
    foundation: "CNCF (LF sub-foundation)",
    criteria: [
      { name: "Vendor Neutrality", weight: 25, score: 5, rationale: "Same LF governance. TOC provides additional technical neutrality." },
      { name: "Enterprise Credibility", weight: 20, score: 5, rationale: "CNCF brand = Kubernetes credibility. Very high enterprise trust." },
      { name: "Standards Support", weight: 20, score: 3, rationale: "Primarily runtime projects, not protocol specs. Would be a first for evaluation protocol." },
      { name: "IP Framework", weight: 15, score: 5, rationale: "Inherits LF IP framework. Apache 2.0 preferred but MIT accepted." },
      { name: "Community Alignment", weight: 10, score: 4, rationale: "Cloud-native alignment strong. AI/ML growing in CNCF (KServe, KubeFlow)." },
      { name: "Cost & Effort", weight: 10, score: 4, rationale: "Sandbox tier has low bar. No membership fee for Sandbox projects." },
    ],
    totalScore: 0,
  },
];

// Calculate weighted scores
for (const evaluation of FOUNDATION_EVALUATIONS) {
  evaluation.totalScore = evaluation.criteria.reduce(
    (sum, c) => sum + (c.score * c.weight) / 100, 0
  );
}

// ── Application Package ─────────────────────────────────────────────────

export interface ApplicationPackage {
  section: string;
  documents: { name: string; description: string; status: "ready" | "in_progress" | "not_started" }[];
}

export const APPLICATION_PACKAGE: ApplicationPackage[] = [
  {
    section: "Protocol Specification",
    documents: [
      { name: "FAI Protocol v1.0 GA Specification", description: "Complete protocol spec (§1–§7, all 12 MUST-FIX resolved)", status: "ready" },
      { name: "JSON Schema Bundle (10 schemas)", description: "Published at schema.frootai.dev/fai/v1/", status: "ready" },
      { name: "Protocol Design Principles", description: "Backward-compat, vendor neutrality, composability, MIT license", status: "ready" },
      { name: "Changelog (v0.1 → v1.0)", description: "Complete version history with breaking change documentation", status: "ready" },
    ],
  },
  {
    section: "Reference Implementation",
    documents: [
      { name: "FrootAI Cloud Engine (reference)", description: "Production-grade implementation passing L0–L3 conformance", status: "ready" },
      { name: "FrootAI Studio Desktop (offline)", description: "Desktop implementation with bundled engine", status: "ready" },
      { name: "Third-party implementations", description: "≥ 1 non-FrootAI implementation passing L0", status: "in_progress" },
    ],
  },
  {
    section: "Conformance Suite",
    documents: [
      { name: "Conformance test suite (L0–L5)", description: "184 automated tests across 6 conformance levels", status: "ready" },
      { name: "Backward compatibility suite", description: "12 tests ensuring v0.9-rc1 manifests validate", status: "ready" },
      { name: "Reference test manifests", description: "104+ validated manifests as conformance fixtures", status: "ready" },
    ],
  },
  {
    section: "Governance",
    documents: [
      { name: "TSC Charter", description: "Technical Steering Committee charter (5–7 outside maintainers, no founder veto)", status: "in_progress" },
      { name: "Contributor Guide", description: "How to contribute to the spec: RFC process, review cadence, merge criteria", status: "ready" },
      { name: "Code of Conduct", description: "Contributor Covenant + enforcement guidelines", status: "ready" },
      { name: "IP Policy", description: "MIT license commitment, DCO sign-off, patent grant", status: "in_progress" },
    ],
  },
  {
    section: "Community Metrics",
    documents: [
      { name: "Adoption dashboard", description: "GitHub stars, forks, contributors, dependent repos, npm downloads", status: "ready" },
      { name: "Endorsement letters (≥ 3)", description: "Written endorsements from external communities/companies", status: "in_progress" },
      { name: "Commercial adoption", description: "FrootAI Cloud customers using FAI Protocol (anonymized metrics)", status: "ready" },
      { name: "Community survey results", description: "Developer satisfaction, feature requests, pain points", status: "not_started" },
    ],
  },
];

export function getApplicationReadiness(): { ready: boolean; readyDocs: number; totalDocs: number; blockers: string[] } {
  const allDocs = APPLICATION_PACKAGE.flatMap((s) => s.documents);
  const readyDocs = allDocs.filter((d) => d.status === "ready").length;
  const blockers = allDocs
    .filter((d) => d.status !== "ready")
    .map((d) => `${d.name}: ${d.status}`);

  return {
    ready: blockers.length === 0,
    readyDocs,
    totalDocs: allDocs.length,
    blockers,
  };
}
