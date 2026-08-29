import type { SolutionPlay } from "../types";

export interface RepositoryInput { name: string; files: string[]; text: Record<string, string>; truncated?: boolean }
export interface RepositorySignal { id: string; label: string; evidence: string[]; keywords: string[]; weight: number }
export interface RepositoryReport { name: string; fileCount: number; inspectedMetadataCount: number; truncated: boolean; generatedAt: string; source: "local-read-only"; recommendationMode: "evidence-ranked" | "generic-starters"; signals: RepositorySignal[]; technologies: Array<{ name: string; files: number; evidence: string[] }>; readiness: Array<{ id: string; label: string; status: "detected" | "gap"; detail: string; evidence: string[] }>; recommendations: Array<{ play: SolutionPlay; score: number; reasons: string[] }> }

const RULES = [
  { id: "rag", label: "Retrieval and vector search", patterns: [/\brag\b/i, /vector/i, /embedding/i, /semantic[-_ ]search/i, /azure[-_ ]?search/i], keywords: ["rag", "retrieval", "search", "vector", "embedding", "grounding"], weight: 5 },
  { id: "agent", label: "Agents and MCP orchestration", patterns: [/\.agent\.md$/i, /\bagent(ic|s)?\b/i, /modelcontextprotocol/i, /\bmcp\b/i, /langgraph/i, /semantic[-_ ]kernel/i], keywords: ["agent", "multi-agent", "orchestration", "mcp", "tool"], weight: 4 },
  { id: "voice", label: "Voice and speech", patterns: [/voice/i, /speech/i, /transcri/i, /\bstt\b/i, /\btts\b/i], keywords: ["voice", "speech", "call center", "audio"], weight: 5 },
  { id: "document", label: "Document processing", patterns: [/document[-_ ]intelligence/i, /\bocr\b/i, /pdf/i, /form[-_ ]recognizer/i], keywords: ["document", "ocr", "extraction", "pdf"], weight: 5 },
  { id: "infra", label: "Cloud infrastructure", patterns: [/\.bicep$/i, /\.tf$/i, /dockerfile/i, /kubernetes/i, /\baks\b/i, /container[-_ ]apps/i], keywords: ["infra", "infrastructure", "landing zone", "container", "kubernetes", "azure"], weight: 3 },
  { id: "evaluation", label: "Evaluation and quality", patterns: [/evaluation/i, /groundedness/i, /faithfulness/i, /ragas/i, /promptfoo/i], keywords: ["evaluation", "quality", "groundedness", "responsible ai"], weight: 2 },
  { id: "security", label: "Safety and governance", patterns: [/guardrails?/i, /content[-_ ]safety/i, /moderation/i, /prompt[-_ ]injection/i, /pii/i], keywords: ["security", "safety", "moderation", "guardrail", "governance"], weight: 3 },
] as const;

export function analyzeRepository(input: RepositoryInput, plays: readonly SolutionPlay[], now = () => new Date().toISOString()): RepositoryReport {
  const corpus = input.files.map((file) => ({ file, value: `${file}\n${input.text[file] ?? ""}`.slice(0, 20_000) }));
  const detectedSignals: RepositorySignal[] = RULES.flatMap((rule) => {
    const evidence = corpus.filter(({ file, value }) => isConcreteSignalEvidence(rule.id, file, input.text[file] ?? "") && rule.patterns.some((pattern) => pattern.test(value))).map(({ file }) => file).filter((file, index, all) => all.indexOf(file) === index).slice(0, 4);
    return evidence.length ? [{ ...rule, patterns: undefined as never, evidence }] : [];
  }).map(({ id, label, evidence, keywords, weight }) => ({ id, label, evidence, keywords: [...keywords], weight }));
  const signals = detectedSignals.length ? detectedSignals : [{ id: "baseline", label: "No architecture signals detected yet", evidence: input.files.slice(0, 4).length ? input.files.slice(0, 4) : ["No project files detected yet"], keywords: ["infrastructure", "security", "evaluation"], weight: 1 }];
  let recommendations = plays.map((play) => {
    const content = [play.name, play.desc, play.tagline, play.pattern, play.infra, play.cat].filter(Boolean).join(" ").toLowerCase();
    const matched = signals.map((signal) => ({ signal, keywords: signal.keywords.filter((keyword) => content.includes(keyword)) })).filter(({ keywords }) => keywords.length);
    const categoryBoost = signals.find((signal) => (play.cat ?? "").includes(signal.id));
    const score = matched.reduce((total, item) => total + item.signal.weight * (8 + item.keywords.length * 3), 0) + (categoryBoost ? categoryBoost.weight * 25 : 0);
    return { play, score, reasons: matched.slice(0, 3).map(({ signal, keywords }) => `${signal.label}: ${keywords.slice(0, 3).join(", ")}`) };
  }).filter(({ score }) => score > 0).sort((left, right) => right.score - left.score || left.play.id.localeCompare(right.play.id)).slice(0, 5);
  if (!detectedSignals.length) {
    const bootstrap = ["01", "02", "17"].map((id, index) => {
      const play = plays.find((candidate) => candidate.id === id);
      return play ? { play, score: 60 - index * 10, reasons: [id === "01" ? "Start with a complete grounded AI application contract" : id === "02" ? "Establish identity, networking, governance, and infrastructure foundations" : "Add observability and evaluation before production promotion"] } : null;
    }).filter((item): item is NonNullable<typeof item> => Boolean(item));
    recommendations = bootstrap;
  }
  const technologies = detectTechnologies(input.files);
  const signal = (id: string) => detectedSignals.find((item) => item.id === id);
  const readiness: RepositoryReport["readiness"] = [
    { id: "definition", label: "System definition", status: input.files.some((file) => /(^|\/)readme(?:\.md)?$|fai-manifest\.json|architecture/i.test(file)) ? "detected" : "gap", detail: "A README, architecture document, or FAI manifest explains the intended system.", evidence: input.files.filter((file) => /(^|\/)readme(?:\.md)?$|fai-manifest\.json|architecture/i.test(file)).slice(0, 4) },
    { id: "infrastructure", label: "Infrastructure as code", status: signal("infra") ? "detected" : "gap", detail: "Deployment topology, identity, networking, and runtime configuration are represented as code.", evidence: signal("infra")?.evidence ?? [] },
    { id: "security", label: "Safety and governance", status: signal("security") ? "detected" : "gap", detail: "Guardrails, content safety, secret handling, or policy controls are visible in allowlisted metadata.", evidence: signal("security")?.evidence ?? [] },
    { id: "evaluation", label: "Evaluation contract", status: signal("evaluation") ? "detected" : "gap", detail: "Quality metrics, tests, thresholds, or evaluation configuration are declared.", evidence: signal("evaluation")?.evidence ?? [] },
    { id: "observability", label: "Operational evidence", status: input.files.some((file) => /monitor|telemetry|observability|applicationinsights|opentelemetry/i.test(file)) ? "detected" : "gap", detail: "Tracing, metrics, logs, and operational evidence are represented in repository metadata.", evidence: input.files.filter((file) => /monitor|telemetry|observability|applicationinsights|opentelemetry/i.test(file)).slice(0, 4) },
  ];
  return { name: input.name, fileCount: input.files.length, inspectedMetadataCount: Object.keys(input.text).length, truncated: Boolean(input.truncated), generatedAt: now(), source: "local-read-only", recommendationMode: detectedSignals.length ? "evidence-ranked" : "generic-starters", signals, technologies, readiness, recommendations };
}

function isConcreteSignalEvidence(id: string, file: string, content: string): boolean {
  const normalized = file.replace(/\\/g, "/").toLowerCase();
  if (/(^|\/)(readme|docs?|documentation)(\/|\.|$)/.test(normalized)) return false;
  if (id === "infra") return /\.bicep$|\.tf$|dockerfile|compose.*\.ya?ml$|(^|\/)(k8s|kubernetes|helm)(\/|$)/.test(normalized);
  if (id === "evaluation") return /(^|\/)(eval|evaluation|tests?|benchmarks?|promptfoo|ragas)(\/|\.|-)|groundedness|faithfulness/.test(normalized);
  if (id === "security") return /(^|\/)(security|policy|policies|guardrails?|safety)(\/|\.|-)|content[-_]?safety|moderation/.test(normalized);
  const sourceOrManifest = /\.(?:ts|tsx|js|jsx|mjs|cjs|py|cs|java|kt|go|rs)$|(^|\/)(package\.json|pyproject\.toml|requirements[^/]*\.txt|pom\.xml|build\.gradle|fai-manifest\.json)$/.test(normalized);
  if (!sourceOrManifest) return false;
  if (/package\.json$|pyproject\.toml$|requirements[^/]*\.txt$|pom\.xml$|build\.gradle$|fai-manifest\.json$/.test(normalized)) return content.trim().length > 0;
  return true;
}

function detectTechnologies(files: string[]): RepositoryReport["technologies"] {
  const rules: Array<{ name: string; test: RegExp }> = [
    { name: "TypeScript / JavaScript", test: /\.(?:ts|tsx|js|jsx|mjs|cjs)$/i }, { name: "Python", test: /\.py$|requirements.*\.txt$|pyproject\.toml$/i }, { name: ".NET", test: /\.(?:cs|fs|vb|csproj|fsproj|sln)$/i }, { name: "Java / JVM", test: /\.(?:java|kt|kts|gradle)$|pom\.xml$/i }, { name: "Go", test: /\.go$|go\.mod$/i }, { name: "Rust", test: /\.rs$|cargo\.toml$/i }, { name: "Infrastructure", test: /\.bicep$|\.tf$|dockerfile|compose.*\.ya?ml$|k8s|helm/i }, { name: "GitHub Agentic OS", test: /(^|\/)\.github\/(?:agents|skills|instructions|prompts|hooks|workflows)\//i },
  ];
  return rules.map((rule) => { const evidence = files.filter((file) => rule.test.test(file)); return { name: rule.name, files: evidence.length, evidence: evidence.slice(0, 4) }; }).filter((item) => item.files > 0).sort((left, right) => right.files - left.files || left.name.localeCompare(right.name));
}
