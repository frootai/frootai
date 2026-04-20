"use client";

import { useState } from "react";

interface ToolParam {
  name: string;
  type: "string" | "number" | "select";
  required: boolean;
  placeholder?: string;
  options?: string[];
}

interface McpTool {
  name: string;
  description: string;
  params: ToolParam[];
}

const mcpTools: McpTool[] = [
  {
    name: "search_knowledge",
    description: "Search across all FrootAI modules for a topic",
    params: [
      { name: "query", type: "string", required: true, placeholder: "e.g., RAG architecture patterns" },
      { name: "max_results", type: "number", required: false, placeholder: "5" },
    ],
  },
  {
    name: "get_play_detail",
    description: "Get detailed info about a solution play",
    params: [
      { name: "play_number", type: "string", required: true, placeholder: "e.g., 01" },
    ],
  },
  {
    name: "compare_models",
    description: "Side-by-side comparison of AI models for a use case",
    params: [
      { name: "useCase", type: "string", required: true, placeholder: "e.g., RAG chatbot" },
      { name: "priority", type: "select", required: false, options: ["quality", "cost", "speed", "context"] },
    ],
  },
  {
    name: "lookup_term",
    description: "Look up an AI/ML term in the glossary (200+ terms)",
    params: [
      { name: "term", type: "string", required: true, placeholder: "e.g., transformer" },
    ],
  },
  {
    name: "estimate_cost",
    description: "Calculate Azure costs for a solution play",
    params: [
      { name: "play", type: "string", required: true, placeholder: "e.g., 01" },
      { name: "scale", type: "select", required: false, options: ["dev", "prod"] },
    ],
  },
  {
    name: "semantic_search_plays",
    description: "Describe what you want to build, get matching plays",
    params: [
      { name: "query", type: "string", required: true, placeholder: "e.g., process invoices with OCR" },
      { name: "top_k", type: "number", required: false, placeholder: "3" },
    ],
  },
];

const promptTemplates = [
  {
    name: "RAG System Prompt",
    system:
      "You are an AI assistant that answers questions based on the provided context. Only use information from the context to answer. If the answer is not in the context, say so. Always cite your sources.",
    user: "Based on the context, what is {{topic}}?",
  },
  {
    name: "Code Review Agent",
    system:
      "You are a senior code reviewer. Analyze the provided code for bugs, security issues, performance problems, and style violations. Provide actionable feedback with line-level suggestions.",
    user: "Review this code:\n```\n{{code}}\n```",
  },
  {
    name: "Classification Agent",
    system:
      'You are a classification agent. Classify the input into one of the provided categories. Return JSON: {"category": "...", "confidence": 0.0-1.0, "reasoning": "..."}',
    user: "Classify: {{input}}",
  },
];

export default function PlaygroundPage() {
  const [tab, setTab] = useState<"mcp" | "prompt">("mcp");
  const [selectedTool, setSelectedTool] = useState(mcpTools[0]);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState(promptTemplates[0]);
  const [systemPrompt, setSystemPrompt] = useState(promptTemplates[0].system);
  const [userMessage, setUserMessage] = useState(promptTemplates[0].user);
  const [promptOutput, setPromptOutput] = useState("");

  const handleToolSelect = (tool: McpTool) => {
    setSelectedTool(tool);
    setParamValues({});
    setResponse("");
  };

  const handleRun = () => {
    const args: Record<string, string | number> = {};
    for (const p of selectedTool.params) {
      if (paramValues[p.name]) {
        args[p.name] = p.type === "number" ? Number(paramValues[p.name]) : paramValues[p.name];
      }
    }
    const mockResponse = {
      tool: selectedTool.name,
      arguments: args,
      status: "simulated",
      note: "Connect your MCP server to test tools live: npx frootai-mcp@latest",
      result: {
        message: `This is a simulated response for ${selectedTool.name}. In production, this would call the actual MCP tool.`,
        timestamp: new Date().toISOString(),
      },
    };
    setResponse(JSON.stringify(mockResponse, null, 2));
  };

  const handleGenerate = () => {
    const formatted = JSON.stringify(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        model: "gpt-4o",
        temperature: 0.7,
        max_tokens: 1000,
      },
      null,
      2
    );
    setPromptOutput(formatted);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">FAI Playground</h1>
        <p className="mt-1 text-sm text-frootai-muted">
          Test MCP tools and prototype prompts interactively
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-frootai-surface p-1 w-fit">
        <button
          onClick={() => setTab("mcp")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "mcp"
              ? "bg-frootai-emerald/10 text-frootai-emerald"
              : "text-frootai-muted hover:text-frootai-text"
          }`}
        >
          🔧 MCP Tool Tester
        </button>
        <button
          onClick={() => setTab("prompt")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "prompt"
              ? "bg-frootai-emerald/10 text-frootai-emerald"
              : "text-frootai-muted hover:text-frootai-text"
          }`}
        >
          ✍️ Prompt Lab
        </button>
      </div>

      {tab === "mcp" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input panel */}
          <div className="space-y-4">
            <div className="rounded-xl border border-frootai-border bg-frootai-surface p-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-frootai-muted">
                  Select Tool
                </label>
                <select
                  value={selectedTool.name}
                  onChange={(e) => {
                    const tool = mcpTools.find((t) => t.name === e.target.value);
                    if (tool) handleToolSelect(tool);
                  }}
                  className="w-full rounded-lg border border-frootai-border bg-frootai-dark px-3 py-2 text-sm text-frootai-text focus:border-frootai-emerald focus:outline-none"
                >
                  {mcpTools.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-frootai-muted">
                  {selectedTool.description}
                </p>
              </div>

              {selectedTool.params.map((param) => (
                <div key={param.name}>
                  <label className="mb-1.5 block text-xs font-semibold text-frootai-muted">
                    {param.name}
                    {param.required && (
                      <span className="ml-1 text-red-400">*</span>
                    )}
                  </label>
                  {param.type === "select" && param.options ? (
                    <select
                      value={paramValues[param.name] ?? ""}
                      onChange={(e) =>
                        setParamValues((v) => ({ ...v, [param.name]: e.target.value }))
                      }
                      className="w-full rounded-lg border border-frootai-border bg-frootai-dark px-3 py-2 text-sm text-frootai-text focus:border-frootai-emerald focus:outline-none"
                    >
                      <option value="">Select...</option>
                      {param.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={param.type === "number" ? "number" : "text"}
                      value={paramValues[param.name] ?? ""}
                      onChange={(e) =>
                        setParamValues((v) => ({ ...v, [param.name]: e.target.value }))
                      }
                      placeholder={param.placeholder}
                      className="w-full rounded-lg border border-frootai-border bg-frootai-dark px-3 py-2 text-sm text-frootai-text placeholder:text-frootai-muted/50 focus:border-frootai-emerald focus:outline-none"
                    />
                  )}
                </div>
              ))}

              <button
                onClick={handleRun}
                className="w-full rounded-lg bg-frootai-emerald px-4 py-2.5 text-sm font-medium text-white hover:bg-frootai-emerald/80 transition-colors"
              >
                ▶ Run Tool
              </button>
            </div>
          </div>

          {/* Response panel */}
          <div className="rounded-xl border border-frootai-border bg-frootai-surface p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-frootai-muted">
              Response
            </h3>
            {response ? (
              <pre className="overflow-auto rounded-lg bg-frootai-dark p-4 text-xs font-mono text-frootai-text leading-relaxed max-h-[500px]">
                {response}
              </pre>
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-frootai-muted">
                Run a tool to see the response
              </div>
            )}
            <p className="mt-3 text-[11px] text-frootai-muted">
              💡 Connect to your MCP server for live results:{" "}
              <code className="text-frootai-emerald">npx frootai-mcp@latest</code>
            </p>
          </div>
        </div>
      )}

      {tab === "prompt" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input panel */}
          <div className="space-y-4">
            <div className="rounded-xl border border-frootai-border bg-frootai-surface p-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-frootai-muted">
                  Template
                </label>
                <select
                  value={selectedTemplate.name}
                  onChange={(e) => {
                    const tmpl = promptTemplates.find((t) => t.name === e.target.value);
                    if (tmpl) {
                      setSelectedTemplate(tmpl);
                      setSystemPrompt(tmpl.system);
                      setUserMessage(tmpl.user);
                      setPromptOutput("");
                    }
                  }}
                  className="w-full rounded-lg border border-frootai-border bg-frootai-dark px-3 py-2 text-sm text-frootai-text focus:border-frootai-emerald focus:outline-none"
                >
                  {promptTemplates.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-frootai-muted">
                  System Prompt
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={5}
                  className="w-full rounded-lg border border-frootai-border bg-frootai-dark px-3 py-2 text-sm text-frootai-text placeholder:text-frootai-muted/50 focus:border-frootai-emerald focus:outline-none resize-y"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-frootai-muted">
                  User Message
                </label>
                <textarea
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-frootai-border bg-frootai-dark px-3 py-2 text-sm text-frootai-text placeholder:text-frootai-muted/50 focus:border-frootai-emerald focus:outline-none resize-y"
                />
              </div>

              <button
                onClick={handleGenerate}
                className="w-full rounded-lg bg-frootai-emerald px-4 py-2.5 text-sm font-medium text-white hover:bg-frootai-emerald/80 transition-colors"
              >
                ✨ Generate Request
              </button>
            </div>
          </div>

          {/* Output panel */}
          <div className="rounded-xl border border-frootai-border bg-frootai-surface p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-frootai-muted">
              Formatted API Request
            </h3>
            {promptOutput ? (
              <pre className="overflow-auto rounded-lg bg-frootai-dark p-4 text-xs font-mono text-frootai-text leading-relaxed max-h-[500px]">
                {promptOutput}
              </pre>
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-frootai-muted">
                Click Generate to preview the API request
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
