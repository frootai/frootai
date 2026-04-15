---
name: fai-langchain-integration
description: |
  Integrate LangChain with Azure OpenAI, tool orchestration, RAG chains,
  and LangSmith tracing. Use when building AI applications with LangChain's
  LCEL chains and agent framework.
---

# LangChain Integration

Build LangChain applications with Azure OpenAI, RAG chains, and tracing.

## When to Use

- Building AI apps with LangChain's chain-of-thought patterns
- Integrating Azure OpenAI as the LLM provider
- Creating RAG chains with document retrieval
- Adding observability with LangSmith tracing

---

## Azure OpenAI Setup

```python
from langchain_openai import AzureChatOpenAI, AzureOpenAIEmbeddings
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)

llm = AzureChatOpenAI(
    azure_deployment="gpt-4o",
    azure_endpoint="https://oai-prod.openai.azure.com",
    azure_ad_token_provider=token_provider,
    api_version="2024-10-21",
    temperature=0.3,
)

embeddings = AzureOpenAIEmbeddings(
    azure_deployment="text-embedding-3-small",
    azure_endpoint="https://oai-prod.openai.azure.com",
    azure_ad_token_provider=token_provider,
)
```

## RAG Chain (LCEL)

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

prompt = ChatPromptTemplate.from_messages([
    ("system", "Answer using ONLY the context. If unknown, say 'I don't know'.\n\nContext:\n{context}"),
    ("user", "{question}"),
])

def format_docs(docs):
    return "\n\n".join(d.page_content for d in docs)

rag_chain = (
    {"context": retriever | format_docs, "question": RunnablePassthrough()}
    | prompt
    | llm
    | StrOutputParser()
)

answer = rag_chain.invoke("How do I configure retry policies?")
```

## Agent with Tools

```python
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.tools import tool

@tool
def search_docs(query: str) -> str:
    """Search the documentation knowledge base."""
    docs = retriever.invoke(query)
    return "\n".join(d.page_content for d in docs[:3])

@tool
def calculate(expression: str) -> str:
    """Evaluate a math expression."""
    return str(eval(expression))  # Use safe_eval in production

agent = create_tool_calling_agent(llm, [search_docs, calculate], prompt)
executor = AgentExecutor(agent=agent, tools=[search_docs, calculate], verbose=True)
result = executor.invoke({"input": "What's the cost of 1M tokens at $2.50/M?"})
```

## LangSmith Tracing

```bash
export LANGCHAIN_TRACING_V2=true
export LANGCHAIN_API_KEY=ls_...
export LANGCHAIN_PROJECT=my-rag-app
```

```python
# Traces appear automatically in LangSmith dashboard
# No code changes needed — just set env vars
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Auth fails with Azure | Missing token provider | Use azure_ad_token_provider with DefaultAzureCredential |
| Chain returns empty | Retriever not connected | Check retriever returns documents |
| Agent infinite loop | No max_iterations | Set max_iterations=5 in AgentExecutor |
| No traces in LangSmith | Env vars not set | Set LANGCHAIN_TRACING_V2=true |
