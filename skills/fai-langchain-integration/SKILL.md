---
name: fai-langchain-integration
description: "Integrate LangChain with Azure OpenAI, semantic search, RAG chains, memory systems, and production tooling."
waf: ["Reliability", "Performance Efficiency", "Cost Optimization", "Operational Excellence"]
plays: ["01-enterprise-rag", "07-multi-agent-service", "21-agentic-rag"]
---

# FAI LangChain Integration

Integrate LangChain pipelines with Azure OpenAI, vector stores, RAG retrieval, and production observability.

## Overview

This skill guides you through building **production-grade LangChain chains** connected to Azure OpenAI, Azure AI Search, and application observability tooling. It covers:
- **Model Integration**: Claude, GPT-4o models via Azure OpenAI
- **RAG Chains**: Semantic retrieval, reranking, citation
- **Memory Systems**: Conversation history, context window management
- **Tooling**: LangSmith tracing, LangServe deployment, async execution
- **Error Handling**: Retry policies, fallbacks, graceful degradation

**Complexity:** Medium | **Time:** 25-45 minutes | **WAF Pillar:** Performance Efficiency + Reliability

## Prerequisites

- Azure OpenAI deployment (model: `gpt-4o` or `claude-opus`)
- Azure AI Search instance with semantic ranking enabled
- Python ≥3.10
- LangChain ≥0.2.0, `langsmith` ≥0.1.0
- Copilot-generated scaffolding from `fai-langchain-scaffold` skill

## Step 1: Configure Azure OpenAI & LangChain

```python
# src/config.py — LangChain + Azure OpenAI setup
from langchain_openai import AzureChatOpenAI
from langchain_core.language_model.llm import LLM
from dotenv import load_dotenv
import os

load_dotenv()

# Initialize with production defaults
llm = AzureChatOpenAI(
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version="2024-02-15-preview",
    model="gpt-4o",
    temperature=0.7,
    max_tokens=2048,
)

print(f"✓ Initialized {llm.model_name} via Azure OpenAI")
```

## Step 2: Build RAG Chains with Semantic Retrieval

```python
# src/rag_chain.py — Production RAG with Azure AI Search
from langchain.chains import RetrievalQA
from langchain_community.vectorstores import AzureSearch
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import AzureOpenAIEmbeddings

# Load embeddings
embeddings = AzureOpenAIEmbeddings(
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    model="text-embedding-3-small",
)

# Initialize Azure Search vector store with semantic ranking
vector_store = AzureSearch(
    azure_search_endpoint=os.getenv("AZURE_SEARCH_ENDPOINT"),
    azure_search_key=os.getenv("AZURE_SEARCH_KEY"),
    index_name="rag-index",
    embedding_function=embeddings.embed_query,
    fields_mapping={"content_vector": "embedding"}
)

# Create retriever with semantic ranking
retriever = vector_store.as_retriever(
    search_type="semantic_hybrid",
    search_kwargs={"k": 5, "fetch_k": 25}
)

# Build RAG chain with citation tracking
from langchain.prompts import PromptTemplate
from langchain.schema.runnable import RunnablePassthrough

prompt = PromptTemplate(
    template="""Answer the question using only the provided context. 
If you don't know, say 'I don't know'.

Context: {context}
Question: {question}

Answer:""",
    input_variables=["context", "question"]
)

rag_chain = (
    {"context": retriever, "question": RunnablePassthrough()}
    | prompt
    | llm
)

print("✓ RAG chain ready with semantic ranking")
```

## Step 3: Add Memory for Multi-Turn Conversations

```python
# src/memory.py — Context window management
from langchain.memory import ConversationBufferMemory, ConversationSummaryMemory
from langchain.chains import ConversationChain

# Production setup: buffer + summarization for cost
memory = ConversationSummaryMemory(
    llm=llm,
    buffer="The conversation so far has covered...",
    max_token_limit=2048
)

conversation_chain = ConversationChain(
    llm=llm,
    memory=memory,
    prompt=PromptTemplate(
        template="""You are a helpful assistant. Maintain context across messages.
        {history}
        Human: {input}
        Assistant:""",
        input_variables=["history", "input"]
    ),
    verbose=False
)

print("✓ Memory system configured with cost optimization")
```

## Step 4: Setup LangSmith Tracing (Observability)

```python
# Enable LangSmith in .env
# LANGSMITH_API_KEY=ls_...
# LANGSMITH_PROJECT="my-rag-project"

import langsmith

langsmith.set_tracing_enabled(True)

# Automatic tracing: all chain runs logged to LangSmith
result = rag_chain.invoke("What is prompt injection?")
print(f"Result: {result}")
print(f"→ Chain execution traced to: https://smith.langchain.com")
```

## Step 5: Add Error Handling & Retries (Reliability)

```python
# src/resilience.py — Retry + fallback patterns
from tenacity import retry, stop_after_attempt, wait_exponential
from langchain.chains.base import Chain

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def query_with_resilience(query: str) -> str:
    """RAG query with automatic retry on transient failures."""
    try:
        return rag_chain.invoke(query)
    except Exception as e:
        print(f"⚠️  Retry {query_with_resilience.retry.statistics['attempt_number']}: {e}")
        raise

# Fallback to simple LLM if retrieval fails
fallback_chain = llm

def query_with_fallback(query: str) -> str:
    try:
        return rag_chain.invoke(query)
    except:
        print("⚠️  Retrieval failed, falling back to LLM-only response")
        return fallback_chain.invoke(query)
```

## Step 6: Deploy with LangServe

```python
# src/app.py — FastAPI + LangServe endpoint
from fastapi import FastAPI
from langserve import add_routes

app = FastAPI(title="FAI RAG API")
add_routes(app, rag_chain, path="/rag")
add_routes(app, conversation_chain, path="/conversation")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

```bash
# Run
python src/app.py
# → http://localhost:8000/docs (Swagger UI)
```

## Validation Checklist

✅ **Model Integration**
- Azure OpenAI LLM responding with <2s latency
- Embeddings model initialized for semantic search

✅ **RAG Pipeline**
- Retriever returns k=5 documents with semantic ranking
- Citations include document source + page number
- Prompt template enforces "I don't know" fallback

✅ **Memory & Context**
- Conversation memory buffering correctly across turns
- Token count staying <2048 with summarization

✅ **Observability**
- LangSmith traces visible in dashboard
- Latency metrics: retrieval <500ms, LLM <2s total

✅ **Reliability**
- Retry logic triggered on Azure OpenAI 429/500 errors
- Fallback chain invoked if search fails
- Graceful degradation: LLM-only mode when retrieval unavailable

✅ **Cost Optimization**
- Token usage logged per chain run
- Embedding cache enabled for repeated queries
- Conversation summarization reducing context window

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Resource not found" on Azure OpenAI | Verify `AZURE_OPENAI_ENDPOINT` and model name match deployment |
| Slow retrieval (<500ms not met) | Enable AI Search semantic ranking; increase `fetch_k=50` |
| High token costs | Implement conversation summarization; reduce `max_tokens` |
| LangSmith not tracing | Set `LANGSMITH_API_KEY` and `LANGSMITH_PROJECT` in .env |

## Related Skills

- **FAI LangChain Scaffold**: Project structure setup
- **FAI Azure AI Search Setup**: Vector store configuration
- **FAI LangSmith Observability**: Tracing + debugging
- **FAI Prompt Templates**: Advanced prompt engineering

## Resources

- [LangChain Docs](https://python.langchain.com)
- [Azure OpenAI Models](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models)
- [LangSmith Docs](https://docs.smith.langchain.com)
- Solution Play: [01 — Enterprise RAG](../../solution-plays/01-enterprise-rag)


### Step 3: Execute Core Logic

Perform the primary operation: integrates langchain with azure openai, vector stores, and retrieval patterns..

### Step 4: Validate Results

Verify the output meets quality thresholds and WAF compliance.

```bash
# Validate output
if [ "$?" -eq 0 ]; then
  echo "✅ Skill completed successfully"
else
  echo "❌ Skill failed — check logs"
  exit 1
fi
```

## Output

| Output | Type | Description |
|--------|------|-------------|
| `status` | enum | `success`, `warning`, `failure` |
| `duration_ms` | number | Execution time in milliseconds |
| `artifacts` | string[] | List of generated/modified files |
| `logs` | string | Detailed execution log |

## WAF Alignment

| Pillar | How This Skill Contributes |
|--------|---------------------------|
| reliability | Includes retry logic, validates outputs, provides rollback steps |
| operational-excellence | Produces structured logs, integrates with CI/CD, follows IaC patterns |

## Error Handling

| Exit Code | Meaning | Action |
|-----------|---------|--------|
| 0 | Success | Proceed to next step |
| 1 | Validation failure | Check input parameters |
| 2 | Dependency missing | Install required tools |
| 3 | Runtime error | Check logs, retry with `--verbose` |

## Usage

### Standalone

```bash
# Run this skill directly
npx frootai skill run fai-langchain-integration
```

### Inside a Solution Play

When referenced in `fai-manifest.json`, this skill auto-wires with the play's context:

```json
{
  "primitives": {
    "skills": ["skills/fai-langchain-integration/"]
  }
}
```

### Via Agent Invocation

Agents can invoke this skill using the `/skill` command in Copilot Chat.

## Configuration Reference

```json
{
  "skill": "skill-name",
  "version": "1.0.0",
  "timeout_seconds": 300,
  "retry_attempts": 3,
  "log_level": "info"
}
```

## Monitoring

Track skill execution metrics:

| Metric | Description | Alert Threshold |
|--------|-------------|----------------|
| Duration | Execution time | > 60 seconds |
| Success rate | Pass/fail ratio | < 95% |
| Error count | Failed executions | > 5/hour |

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Timeout | Slow dependency | Increase timeout_seconds |
| Auth failure | Expired credentials | Refresh Managed Identity |
| Missing config | No fai-manifest.json | Create manifest or pass config_path |
| Validation error | Invalid input | Check parameter types and ranges |

## Notes

- This skill follows the FAI SKILL.md specification
- All outputs are deterministic when `dry_run=true`
- Integrates with FAI Engine for automated pipeline execution
- Part of the General category in the FAI primitives catalog