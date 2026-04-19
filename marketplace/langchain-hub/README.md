# FrootAI — LangChain Hub Integration

> Publish FrootAI's RAG chains, agent configs, and prompt templates to LangChain Hub for cross-framework reuse.

---

## What to Publish

FrootAI's 104 solution plays contain production-tested patterns that translate directly into LangChain Hub artifacts. The following categories are published:

### 1. RAG Chain Templates (15 chains)

Production-ready LCEL chains extracted from RAG-focused solution plays:

| Hub Artifact | Source Play | Description |
|-------------|-------------|-------------|
| `frootai/enterprise-rag` | Play 01 | Hybrid search (keyword + vector) → semantic reranker → GPT-4o with citations |
| `frootai/agentic-rag` | Play 21 | Tool-calling RAG agent with dynamic retrieval, query decomposition, and self-reflection |
| `frootai/graphrag` | Play 28 | Graph-based RAG with entity extraction, relationship mapping, and community summaries |
| `frootai/multimodal-rag` | Play 15 | GPT-4o Vision document processing → vector store → structured extraction |
| `frootai/conversational-rag` | Play 09 | Multi-turn conversational retrieval with memory and context window management |
| `frootai/streaming-rag` | Play 20 | SSE streaming RAG with token-by-token delivery and source attribution |
| `frootai/cached-rag` | Play 14 | Semantic caching layer with cost-optimized model routing |
| `frootai/evaluation-rag` | Play 17 | RAG evaluation chain (groundedness, relevance, coherence, fluency scoring) |
| `frootai/chunking-strategies` | Play 01 | Configurable chunking (fixed, semantic, recursive) with overlap tuning |
| `frootai/hybrid-search` | Play 26 | Combined keyword + vector + semantic ranking retrieval |
| `frootai/citation-chain` | Play 01 | Source attribution and citation formatting for RAG responses |
| `frootai/query-decomposition` | Play 21 | Multi-step query breakdown for complex questions |
| `frootai/reranking-chain` | Play 01 | Cross-encoder reranking with configurable top-K |
| `frootai/guardrailed-rag` | Play 10 | Content safety filtered RAG with Azure AI Content Safety |
| `frootai/multilingual-rag` | Play 57 | Cross-language retrieval with translation-aware embeddings |

### 2. Agent Configurations (10 configs)

Agent architectures with tool bindings, memory configuration, and orchestration patterns:

| Hub Artifact | Source Play | Description |
|-------------|-------------|-------------|
| `frootai/deterministic-agent` | Play 03 | Zero-temperature agent with seed pinning and structured output |
| `frootai/multi-agent-supervisor` | Play 07 | Supervisor-worker pattern with LangGraph state management |
| `frootai/swarm-agent` | Play 22 | Distributed agent team with topology and conflict resolution |
| `frootai/tool-calling-agent` | Play 05 | ReAct agent with dynamic tool selection and execution |
| `frootai/browser-agent` | Play 23 | Web browsing agent with Playwright integration |
| `frootai/code-execution-agent` | Play 07 | Sandboxed code execution with Docker isolation |
| `frootai/planning-agent` | Play 21 | Plan-and-execute agent with step validation |
| `frootai/retrieval-agent` | Play 21 | Agent that dynamically selects retrieval strategies |
| `frootai/evaluation-agent` | Play 18 | Automated evaluation with human-in-the-loop escalation |
| `frootai/cost-aware-agent` | Play 14 | Token budget enforcement with model routing |

### 3. Prompt Templates (20 templates)

Battle-tested prompt templates with variable slots and few-shot examples:

| Hub Artifact | Category | Description |
|-------------|----------|-------------|
| `frootai/rag-system-prompt` | RAG | System prompt for grounded retrieval with citation format |
| `frootai/rag-user-prompt` | RAG | User query template with context injection |
| `frootai/agent-system-prompt` | Agent | Multi-tool agent system prompt with role definition |
| `frootai/evaluation-prompt` | Eval | Groundedness scoring prompt (1-5 scale) |
| `frootai/relevance-prompt` | Eval | Relevance scoring with rubric |
| `frootai/coherence-prompt` | Eval | Coherence evaluation template |
| `frootai/summarization-prompt` | NLP | Document summarization with length control |
| `frootai/extraction-prompt` | NLP | Structured data extraction from unstructured text |
| `frootai/classification-prompt` | NLP | Multi-label classification with confidence scores |
| `frootai/translation-prompt` | NLP | Context-aware translation with terminology preservation |
| `frootai/code-review-prompt` | Dev | Security-focused code review with OWASP checklist |
| `frootai/architecture-prompt` | Dev | Solution architecture recommendation template |
| `frootai/test-generation-prompt` | Dev | Unit test generation from function signatures |
| `frootai/incident-prompt` | Ops | Incident triage and root cause analysis |
| `frootai/cost-analysis-prompt` | Ops | Azure cost optimization recommendation |
| `frootai/content-safety-prompt` | Safety | Content moderation classification |
| `frootai/bias-detection-prompt` | Safety | Fairness and bias detection in AI outputs |
| `frootai/handoff-prompt` | Agent | Agent-to-agent delegation with context transfer |
| `frootai/planning-prompt` | Agent | Step-by-step plan generation with validation |
| `frootai/reflection-prompt` | Agent | Self-reflection and answer refinement |

## Package Structure

```
langchain-hub/
├── README.md                         # This file
├── chains/
│   ├── enterprise-rag/
│   │   ├── chain.py                  # LCEL chain definition
│   │   ├── config.yaml               # LangSmith config
│   │   ├── README.md                 # Usage documentation
│   │   └── examples/
│   │       ├── basic.py              # Minimal example
│   │       └── production.py         # Full production setup
│   ├── agentic-rag/
│   │   ├── chain.py
│   │   ├── graph.py                  # LangGraph state definition
│   │   └── ...
│   └── ... (15 chains)
├── agents/
│   ├── deterministic-agent/
│   │   ├── agent.py                  # Agent definition
│   │   ├── tools.py                  # Tool bindings
│   │   ├── config.yaml               # Agent config
│   │   └── README.md
│   └── ... (10 agents)
├── prompts/
│   ├── rag-system-prompt/
│   │   ├── prompt.yaml               # LangChain Hub format
│   │   ├── few_shot_examples.json    # Few-shot examples
│   │   └── README.md
│   └── ... (20 prompts)
└── shared/
    ├── fai_adapter.py                # FAI Protocol → LangChain adapter
    ├── tracing.py                    # LangSmith tracing setup
    └── evaluation.py                 # LangSmith evaluation helpers
```

## Integration with fai-manifest.json

The FAI Protocol adapter (`fai_adapter.py`) translates `fai-manifest.json` into LangChain configurations:

```python
from frootai.adapters.langchain import FAILangChainAdapter

adapter = FAILangChainAdapter("./fai-manifest.json")

# Generate LCEL chain from manifest
chain = adapter.build_chain()

# Generate agent from manifest
agent = adapter.build_agent()

# Generate LangSmith evaluation config from guardrails
eval_config = adapter.build_evaluation()

# Extract prompt templates from manifest context
prompts = adapter.extract_prompts()
```

### Manifest-to-LangChain Mapping

| FAI Protocol Field | LangChain Equivalent |
|-------------------|---------------------|
| `primitives.agents` | Agent definitions with tool bindings |
| `context.knowledge` | Retriever configuration (vector store, search params) |
| `context.waf` | Quality gate thresholds in evaluation config |
| `guardrails.thresholds` | LangSmith evaluator scoring criteria |
| `contracts.routing` | Model selection in `ChatOpenAI` initialization |
| `contracts.cost` | Token counting callbacks and budget enforcement |
| `contracts.observability` | LangSmith project and tracing configuration |
| `contracts.handoff` | LangGraph edge definitions and state transitions |

## Publishing to LangChain Hub

```bash
# Install LangChain CLI
pip install langchain-cli

# Authenticate with LangSmith
export LANGCHAIN_API_KEY="your-api-key"

# Push a chain template
langchain hub push frootai/enterprise-rag chains/enterprise-rag/

# Push a prompt template
langchain hub push frootai/rag-system-prompt prompts/rag-system-prompt/

# Pull and use in your project
langchain hub pull frootai/enterprise-rag
```

## Usage Examples

### Use a FrootAI RAG chain

```python
from langchain import hub

# Pull the Enterprise RAG chain from LangChain Hub
chain = hub.pull("frootai/enterprise-rag")

# Configure with your Azure resources
chain = chain.with_config({
    "azure_search_endpoint": "https://your-search.search.windows.net",
    "azure_openai_endpoint": "https://your-openai.openai.azure.com",
    "index_name": "your-index",
    "model": "gpt-4o"
})

# Run
result = chain.invoke({"question": "What are the best practices for RAG chunking?"})
print(result["answer"])
print(result["sources"])
```

### Use a FrootAI prompt template

```python
from langchain import hub

# Pull the evaluation prompt
prompt = hub.pull("frootai/evaluation-prompt")

# Use in your evaluation pipeline
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
eval_chain = prompt | llm
score = eval_chain.invoke({
    "question": "What is RAG?",
    "answer": "RAG stands for Retrieval-Augmented Generation...",
    "context": "Retrieved documents..."
})
```

## Version Sync

LangChain Hub artifacts are versioned in sync with FrootAI releases:

| FrootAI Version | Hub Version | Changes |
|----------------|-------------|---------|
| 5.2.0 | 5.2.0 | 45 tools, 104 plays, 860+ primitives |

Artifacts are auto-published via the FrootAI CI/CD pipeline (`npm run release` triggers Hub push).

## Links

- **LangChain Hub**: https://smith.langchain.com/hub/frootai
- **FrootAI Website**: https://frootai.dev
- **GitHub**: https://github.com/frootai/frootai
- **FAI Protocol**: https://frootai.dev/fai-protocol
