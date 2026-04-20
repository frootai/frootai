import Link from "next/link";

interface FrootModule {
  id: string;
  title: string;
  description: string;
  icon: string;
}

interface FrootLayer {
  letter: string;
  name: string;
  color: string;
  bgColor: string;
  modules: FrootModule[];
}

const layers: FrootLayer[] = [
  {
    letter: "F",
    name: "Foundations",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/20",
    modules: [
      { id: "F1", title: "GenAI Foundations", description: "Core generative AI concepts — transformers, attention, tokenization", icon: "🧬" },
      { id: "F2", title: "LLMs", description: "Large language model architectures, capabilities, and limitations", icon: "🧠" },
      { id: "F3", title: "Glossary", description: "200+ AI/ML terms with definitions and context", icon: "📖" },
      { id: "F4", title: "Agentic OS", description: "GitHub Copilot agent primitives — the 7-layer model", icon: "⚙️" },
    ],
  },
  {
    letter: "R",
    name: "Reasoning",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10 border-purple-500/20",
    modules: [
      { id: "R1", title: "Prompts", description: "Prompt engineering patterns — zero-shot, few-shot, chain-of-thought", icon: "✍️" },
      { id: "R2", title: "RAG", description: "Retrieval-Augmented Generation — chunking, indexing, retrieval, reranking", icon: "🔍" },
      { id: "R3", title: "Deterministic AI", description: "Zero-temperature, seed pinning, structured output, guardrails", icon: "🎯" },
    ],
  },
  {
    letter: "O",
    name: "Orchestration",
    color: "text-frootai-emerald",
    bgColor: "bg-emerald-500/10 border-emerald-500/20",
    modules: [
      { id: "O1", title: "Semantic Kernel", description: "SK plugins, planners, function calling, orchestration", icon: "🔗" },
      { id: "O2", title: "Agents", description: "Agent patterns — AutoGen, CrewAI, LangChain, custom agents", icon: "🤖" },
      { id: "O3", title: "MCP & Tools", description: "Model Context Protocol — tool calling, server design, integration", icon: "🔧" },
    ],
  },
  {
    letter: "O",
    name: "Operations",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/20",
    modules: [
      { id: "O4", title: "Azure AI", description: "Azure OpenAI, AI Search, AI Foundry, Content Safety", icon: "☁️" },
      { id: "O5", title: "Infrastructure", description: "GPU sizing, AKS node pools, PTU allocation, networking", icon: "🏗️" },
      { id: "O6", title: "Copilot", description: "GitHub Copilot ecosystem — extensions, agents, workspace", icon: "💎" },
    ],
  },
  {
    letter: "T",
    name: "Transformation",
    color: "text-rose-400",
    bgColor: "bg-rose-500/10 border-rose-500/20",
    modules: [
      { id: "T1", title: "Fine-Tuning", description: "LoRA, QLoRA, JSONL data prep, evaluation pipelines", icon: "🔬" },
      { id: "T2", title: "Responsible AI", description: "Content safety, fairness, bias detection, transparency", icon: "🛡️" },
      { id: "T3", title: "Production", description: "Deployment patterns, monitoring, incident response, scaling", icon: "🚀" },
    ],
  },
];

export default function LearningPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Learning Hub</h1>
        <p className="mt-1 text-sm text-frootai-muted">
          Master the FROOT framework — 5 layers, 16 modules, from foundations to
          production
        </p>
      </div>

      {/* FROOT Visualization */}
      <div className="rounded-xl border border-frootai-border bg-frootai-surface p-6">
        <h2 className="mb-4 text-lg font-semibold">The FROOT Framework</h2>
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          {layers.map((layer, i) => (
            <div key={`${layer.letter}-${layer.name}`} className="flex items-center gap-2">
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl font-black ${layer.bgColor} ${layer.color} border`}
              >
                {layer.letter}
              </span>
              <span className="text-sm font-medium text-frootai-muted">
                {layer.name}
              </span>
              {i < layers.length - 1 && (
                <span className="mx-1 text-frootai-border">→</span>
              )}
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-frootai-muted">
          Each layer builds on the previous — from AI fundamentals to production
          deployment
        </p>
      </div>

      {/* Module Grid by Layer */}
      {layers.map((layer) => (
        <section key={`${layer.letter}-${layer.name}`}>
          <div className="mb-4 flex items-center gap-3">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black ${layer.bgColor} ${layer.color} border`}
            >
              {layer.letter}
            </span>
            <h2 className="text-lg font-semibold">{layer.name}</h2>
            <span className="text-xs text-frootai-muted">
              {layer.modules.length} module{layer.modules.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {layer.modules.map((mod) => (
              <Link
                key={mod.id}
                href={`https://docs.frootai.dev/learning/${mod.id.toLowerCase()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-frootai-border bg-frootai-surface p-5 hover:border-frootai-emerald/50 hover:bg-frootai-surface-hover transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{mod.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-frootai-muted">
                        {mod.id}
                      </span>
                      <h3 className="text-sm font-semibold text-frootai-text group-hover:text-frootai-emerald transition-colors">
                        {mod.title}
                      </h3>
                    </div>
                    <p className="mt-1 text-xs text-frootai-muted leading-relaxed">
                      {mod.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {/* Progress (UI only) */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Your Progress</h2>
        <div className="rounded-xl border border-frootai-border bg-frootai-surface p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-frootai-text">
              0 of 16 modules completed
            </span>
            <span className="text-xs text-frootai-muted">0%</span>
          </div>
          <div className="h-2 rounded-full bg-frootai-dark overflow-hidden">
            <div className="h-full w-0 rounded-full bg-frootai-emerald transition-all" />
          </div>
          <p className="mt-3 text-xs text-frootai-muted">
            Progress tracking requires sign-in — coming soon
          </p>
        </div>
      </section>
    </div>
  );
}
