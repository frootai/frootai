# Module 11: Quick Reference Cards — AI Essentials at a Glance

> **Type:** Reference | **Level:** All Levels
> **Usage:** Bookmark this page — your daily AI quick-reference
> **Last Updated:** March 2026

---

## How to Use This Page

This module is designed as a **fast-lookup reference**. Every card is self-contained. Use your browser's `Ctrl+F` / `Cmd+F` to jump to any term instantly. No narrative — just facts, tables, and decision shortcuts.

---

## Card 1: LLM Generation Parameters Cheat Sheet

Every parameter you can tune when calling a large language model.

| Parameter | Range | Typical Default | What It Controls | Rule of Thumb |
|---|---|---|---|---|
| **Temperature** | `0.0` – `2.0` | `1.0` | Randomness of token sampling. Lower = deterministic, higher = creative. | `0.0`–`0.3` for factual / extraction. `0.7`–`1.0` for creative writing. Never exceed `1.5` in production. |
| **Top-P (nucleus sampling)** | `0.0` – `1.0` | `1.0` | Cumulative probability cutoff. Only tokens within the top-P mass are considered. | Use `0.9`–`0.95` for balanced output. Set to `1.0` and control via temperature, or vice-versa — avoid tuning both simultaneously. |
| **Top-K** | `1` – `vocabulary size` | Model-dependent | Limits sampling to the K most probable next tokens. | `40`–`100` is a safe range. Not exposed in Azure OpenAI — available in open-source / Hugging Face models. |
| **Frequency Penalty** | `-2.0` – `2.0` | `0.0` | Penalizes tokens proportionally to how often they already appeared. Reduces repetition. | `0.3`–`0.8` to reduce repetitive phrasing. Values above `1.0` can distort output. |
| **Presence Penalty** | `-2.0` – `2.0` | `0.0` | Flat penalty applied once a token has appeared at all. Encourages topic diversity. | `0.3`–`0.6` for varied topic coverage. Combine lightly with frequency penalty — don't max both. |
| **Max Tokens** (max_completion_tokens) | `1` – model context limit | Model-dependent | Hard ceiling on response length in tokens. | Set explicitly to avoid runaway costs. Estimate: 1 paragraph ~ 80–120 tokens, 1 page ~ 600–800 tokens. |
| **Stop Sequences** | Up to 4 strings | `None` | Generation halts when any stop sequence is emitted. | Use `["\n\n"]` for single-paragraph answers. Use `["```"]` to stop after a code block. |
| **Seed** | Any integer | `None` | When set, the service attempts deterministic output (best-effort). | Use for reproducible evaluations and regression testing. Same seed + same prompt + same parameters = same output (mostly). |
| **Response Format** | `text`, `json_object`, `json_schema` | `text` | Forces structured output format. | Use `json_schema` for reliable structured extraction. Always include "respond in JSON" in the prompt when using `json_object`. |
| **N** | `1` – `128` | `1` | Number of completions to generate per request. | Use `n > 1` only for ranking/voting strategies. Multiplies token cost linearly. |
| **Logprobs** | `true/false`, top_logprobs `0`–`20` | `false` | Returns log-probabilities for each output token. | Use for confidence scoring, calibration, and classification thresholds. |
| **Logit Bias** | Token ID → bias (`-100` to `100`) | `{}` | Directly adjusts probability of specific tokens. `-100` = ban token. | Ban unwanted tokens (e.g., profanity token IDs). Use sparingly — hard to maintain. |

### Parameter Interaction Quick Rules

| Scenario | Temperature | Top-P | Freq. Penalty | Presence Penalty |
|---|---|---|---|---|
| **Deterministic extraction** | `0.0` | `1.0` | `0.0` | `0.0` |
| **Conversational chatbot** | `0.7` | `0.95` | `0.3` | `0.3` |
| **Creative writing** | `1.0` | `0.95` | `0.5` | `0.6` |
| **Code generation** | `0.2` | `0.95` | `0.0` | `0.0` |
| **Brainstorming / ideation** | `1.2` | `1.0` | `0.8` | `0.8` |
| **Summarization** | `0.3` | `0.95` | `0.0` | `0.0` |
| **Translation** | `0.3` | `0.95` | `0.0` | `0.0` |
| **Customer support bot** | `0.5` | `0.9` | `0.4` | `0.2` |

### Common API Call Patterns

**Python (Azure OpenAI SDK) — Minimal call:**

```python
from openai import AzureOpenAI
client = AzureOpenAI(
    azure_endpoint="https://<resource>.openai.azure.com/",
    api_key="<key>",            # or use DefaultAzureCredential
    api_version="2025-03-01-preview"
)
response = client.chat.completions.create(
    model="<deployment-name>",
    messages=[{"role": "user", "content": "Hello"}],
    temperature=0.7,
    max_tokens=800
)
print(response.choices[0].message.content)
```

**Key API versions (Azure OpenAI):**

| API Version | Status | Notes |
|---|---|---|
| `2025-03-01-preview` | Latest preview | Newest features |
| `2024-12-01-preview` | Preview | Structured outputs, reasoning |
| `2024-10-21` | GA (stable) | Production recommended |
| `2024-06-01` | GA | Broadly supported |

---

## Card 2: Token Quick Reference

### What Is a Token?

| Fact | Value |
|---|---|
| Average token length (English) | ~4 characters |
| Tokens per word (English avg.) | ~1.33 tokens per word (~0.75 words per token) |
| Tokens per word (code) | ~2–3 tokens per word (symbols split aggressively) |
| Tokens per word (non-Latin scripts) | ~2–4 tokens per character for CJK languages |

### Token Estimation Formulas

```
English text:   tokens ≈ word_count × 1.33
Code:           tokens ≈ character_count ÷ 3
Mixed content:  tokens ≈ character_count ÷ 4
```

### Common Text Lengths in Tokens

| Content Type | Approximate Tokens |
|---|---|
| A short email (3–4 sentences) | ~100–200 |
| One A4 page of text | ~600–800 |
| A long blog post (2,000 words) | ~2,700 |
| A technical whitepaper (10 pages) | ~7,000–9,000 |
| A full novel (80,000 words) | ~107,000 |
| 1 hour of transcribed speech | ~8,000–10,000 |
| A typical Slack conversation (50 messages) | ~2,000–3,000 |
| JSON payload (1 KB) | ~300–400 |
| A complete React component file | ~500–1,500 |

### Context Windows by Model (March 2026)

| Model | Provider | Context Window | Max Output Tokens |
|---|---|---|---|
| **GPT-4.1** | Azure OpenAI | 1,047,576 (1M) | 32,768 |
| **GPT-4.1 mini** | Azure OpenAI | 1,047,576 (1M) | 32,768 |
| **GPT-4.1 nano** | Azure OpenAI | 1,047,576 (1M) | 32,768 |
| **GPT-4o** | Azure OpenAI | 128,000 | 16,384 |
| **GPT-4o mini** | Azure OpenAI | 128,000 | 16,384 |
| **o3** | Azure OpenAI | 200,000 | 100,000 |
| **o4-mini** | Azure OpenAI | 200,000 | 100,000 |
| **o3-mini** | Azure OpenAI | 200,000 | 100,000 |
| **o1** | Azure OpenAI | 200,000 | 100,000 |
| **Claude Opus 4** | Anthropic | 200,000 | 32,000 |
| **Claude Sonnet 4** | Anthropic | 200,000 | 64,000 |
| **Gemini 2.5 Pro** | Google | 1,048,576 (1M) | 65,536 |
| **Gemini 2.5 Flash** | Google | 1,048,576 (1M) | 65,536 |
| **Llama 4 Maverick** | Meta (via Azure) | 1,048,576 (1M) | 32,768 |
| **DeepSeek-R1** | DeepSeek (via Azure) | 128,000 | 16,384 |
| **Mistral Large** | Mistral (via Azure) | 128,000 | 8,192 |
| **Phi-4** | Microsoft | 16,384 | 4,096 |
| **Phi-4-mini** | Microsoft | 128,000 | 4,096 |

### Azure OpenAI Pricing (Pay-As-You-Go, per 1M Tokens)

*Prices reflect Global Standard deployment where available. Check the [Azure OpenAI pricing page](https://azure.microsoft.com/pricing/details/cognitive-services/openai-service/) for latest values.*

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|---|---|---|
| **GPT-4.1** | $2.00 | $8.00 |
| **GPT-4.1 mini** | $0.40 | $1.60 |
| **GPT-4.1 nano** | $0.10 | $0.40 |
| **GPT-4o** | $2.50 | $10.00 |
| **GPT-4o mini** | $0.15 | $0.60 |
| **o3** | $10.00 | $40.00 |
| **o4-mini** | $1.10 | $4.40 |
| **o3-mini** | $1.10 | $4.40 |
| **text-embedding-3-large** | $0.13 | — |
| **text-embedding-3-small** | $0.02 | — |
| **DALL-E 3 (Standard)** | $0.040 / image | — |
| **DALL-E 3 (HD)** | $0.080 / image | — |
| **Whisper** | $0.36 / audio hour | — |

### Global Batch Pricing (50% Discount)

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|---|---|---|
| **GPT-4.1** | $1.00 | $4.00 |
| **GPT-4.1 mini** | $0.20 | $0.80 |
| **GPT-4o** | $1.25 | $5.00 |
| **GPT-4o mini** | $0.075 | $0.30 |

> **Cost rule of thumb:** For a typical chatbot conversation (~1,500 input + 500 output tokens), GPT-4.1 nano costs ~$0.0004 per turn. GPT-4o costs ~$0.009 per turn. That is a ~20x difference.

---

## Card 3: Model Selection Decision Tree

Use this table to pick the right model for your workload. Start from the need.

| Need | Recommended Model | Why | Fallback |
|---|---|---|---|
| **Simple classification / routing** | GPT-4.1 nano | Cheapest, fastest, sufficient for binary/multi-class | GPT-4o mini |
| **Structured data extraction** | GPT-4.1 mini | Great JSON mode, cost efficient | GPT-4.1 |
| **General-purpose chatbot** | GPT-4o | Strong general ability, broad knowledge | GPT-4.1 |
| **Complex multi-step reasoning** | o3 | Deep chain-of-thought, highest reasoning accuracy | o4-mini |
| **Reasoning on a budget** | o4-mini | 80% of o3 capability at ~10% cost | o3-mini |
| **Code generation & review** | GPT-4.1 | Optimized for code, instruction following | o4-mini |
| **Long document analysis (>100K)** | GPT-4.1 | 1M context window, strong recall | Gemini 2.5 Pro |
| **Vision / image understanding** | GPT-4o | Native multimodal, strong vision | GPT-4.1 (vision) |
| **Embeddings** | text-embedding-3-large | Best quality Azure embedding | text-embedding-3-small |
| **On-device / edge** | Phi-4-mini | Small footprint, strong for size | Phi-4 |
| **Open-source self-hosted** | Llama 4 Maverick | Strong open model, permissive license | DeepSeek-R1 |
| **Batch processing (non-real-time)** | GPT-4o (Global Batch) | 50% price discount for async | GPT-4.1 mini (Batch) |
| **Audio transcription** | Whisper | Purpose-built speech-to-text | Azure AI Speech |
| **Text-to-speech** | Azure AI Speech / GPT-4o Audio | High quality neural voices | — |
| **Image generation** | DALL-E 3 / GPT Image Gen | Native Azure integration | — |

### Decision Flowchart (Text)

```
START
  |
  ├─ Need reasoning/math/logic?
  |    ├─ Budget sensitive? → o4-mini
  |    └─ Maximum accuracy?  → o3
  |
  ├─ Need code generation?
  |    └─ → GPT-4.1
  |
  ├─ Need vision/images?
  |    └─ → GPT-4o
  |
  ├─ Simple task (classify, extract, route)?
  |    ├─ High volume? → GPT-4.1 nano
  |    └─ Moderate quality needed? → GPT-4.1 mini
  |
  ├─ Long context (>128K)?
  |    └─ → GPT-4.1 (1M context)
  |
  └─ General conversational?
       └─ → GPT-4o or GPT-4.1
```

### Model Capabilities Matrix

| Capability | GPT-4.1 | GPT-4.1 mini | GPT-4.1 nano | GPT-4o | GPT-4o mini | o3 | o4-mini |
|---|---|---|---|---|---|---|---|
| **Text generation** | Excellent | Very Good | Good | Excellent | Good | Excellent | Very Good |
| **Code generation** | Excellent | Good | Fair | Very Good | Good | Excellent | Very Good |
| **Reasoning / math** | Very Good | Good | Fair | Good | Fair | Excellent | Very Good |
| **Vision / images** | Yes | Yes | No | Yes | Yes | No | No |
| **Structured output** | Excellent | Excellent | Very Good | Excellent | Very Good | Good | Good |
| **Instruction following** | Excellent | Very Good | Good | Very Good | Good | Very Good | Good |
| **Long context (>100K)** | Excellent (1M) | Excellent (1M) | Good (1M) | Good (128K) | Good (128K) | Good (200K) | Good (200K) |
| **Multilingual** | Very Good | Good | Fair | Very Good | Good | Good | Good |
| **Speed (tokens/sec)** | Fast | Very Fast | Fastest | Fast | Very Fast | Slower (thinks) | Moderate |
| **Function calling** | Excellent | Very Good | Good | Excellent | Good | Good | Good |

---

## Card 4: RAG Architecture Cheat Sheet

### Chunking Strategies Comparison

| Strategy | Chunk Size | Overlap | Best For | Drawbacks |
|---|---|---|---|---|
| **Fixed-size** | 512–1024 tokens | 10–20% | Simple docs, uniform structure | Breaks mid-sentence |
| **Sentence-based** | 3–5 sentences | 1 sentence | Articles, natural prose | Inconsistent chunk sizes |
| **Paragraph-based** | 1 paragraph | None or 1 sentence | Well-structured docs | Large variance in size |
| **Recursive character** | 512–1024 tokens | 10–20% | General-purpose (LangChain default) | May split semantic units |
| **Semantic chunking** | Variable | Embedding-based boundaries | Research papers, mixed content | Slower, requires embeddings |
| **Markdown/HTML-aware** | By heading | None | Technical docs, wikis | Requires structured source |
| **Sliding window** | 256–512 tokens | 50% | Dense retrieval, high recall | 2x storage, more chunks |
| **Document-level** | Entire doc | N/A | Short docs (< 1 page) | Poor for long documents |

> **Rule of thumb:** Start with **512 tokens, 10% overlap, recursive character splitting**. Optimize from there.

### Document Pre-Processing Pipeline

```
Source Documents
  │
  ├─ PDF → Extract text (PyMuPDF, Azure Document Intelligence)
  ├─ Word/PPTX → Extract text (python-docx, python-pptx)
  ├─ HTML → Strip tags, keep structure (BeautifulSoup)
  ├─ Markdown → Parse headings as section boundaries
  └─ Scanned images → OCR (Azure Document Intelligence)
  │
  ▼
Clean & Normalize
  │ Remove headers/footers, fix encoding, normalize whitespace
  ▼
Chunk
  │ Apply chunking strategy (see table above)
  ▼
Enrich (optional)
  │ Add metadata: title, source, page, section, date
  │ Generate summaries or hypothetical questions per chunk
  ▼
Embed
  │ Generate vector embeddings for each chunk
  ▼
Index
  │ Upload to Azure AI Search (or other vector store)
  │ Configure vector fields, filterable metadata, semantic config
  ▼
Ready for Retrieval
```

### Embedding Models Comparison

| Model | Dimensions | Max Tokens | Relative Quality | Cost (per 1M tokens) | Notes |
|---|---|---|---|---|---|
| **text-embedding-3-large** | 3,072 (configurable) | 8,191 | Highest | $0.13 | Supports dimension reduction via `dimensions` param |
| **text-embedding-3-small** | 1,536 (configurable) | 8,191 | High | $0.02 | Best price/quality ratio |
| **text-embedding-ada-002** | 1,536 | 8,191 | Good | $0.10 | Legacy — migrate to v3 |
| **Cohere Embed v3** | 1,024 | 512 | High | Varies | Multi-language strength |
| **E5-large-v2** | 1,024 | 512 | Good | Self-hosted | Open-source, no API cost |
| **BGE-large-en-v1.5** | 1,024 | 512 | Good | Self-hosted | Open-source, MTEB top-tier |

### Retrieval Strategy Comparison

| Strategy | How It Works | Precision | Recall | Latency | When to Use |
|---|---|---|---|---|---|
| **Vector search** | Embed query, find nearest neighbors | Medium-High | High | Low | Default starting point |
| **Full-text / keyword (BM25)** | Term frequency matching | High | Medium | Very Low | Exact term matching, codes, IDs |
| **Hybrid (vector + keyword)** | Combines both, fused ranking (RRF) | High | High | Low-Medium | **Recommended default for production** |
| **Semantic ranker (L2 rerank)** | Cross-encoder reranks top-N results | Very High | Depends on Stage 1 | Medium | When precision matters most |
| **Multi-query** | LLM rewrites query N ways, merges results | High | Very High | Higher | Ambiguous or complex queries |
| **HyDE** | LLM generates hypothetical doc, then searches | High | High | Higher | When queries differ from document style |

### Azure AI Search Tiers

| Tier | Price (approx/month) | Storage | Indexes | Replicas | Partitions | Semantic Ranker | Vector Search |
|---|---|---|---|---|---|---|---|
| **Free** | $0 | 50 MB | 3 | 1 | 1 | No | Yes (limited) |
| **Basic** | ~$75 | 2 GB | 15 | 3 | 1 | Yes | Yes |
| **Standard S1** | ~$250 | 25 GB per partition | 50 | 12 | 12 | Yes | Yes |
| **Standard S2** | ~$1,000 | 100 GB per partition | 200 | 12 | 12 | Yes | Yes |
| **Standard S3** | ~$2,000 | 200 GB per partition | 200 | 12 | 12 | Yes | Yes |
| **Storage Optimized L1** | ~$2,500 | 1 TB per partition | 10 | 12 | 12 | Yes | Yes |
| **Storage Optimized L2** | ~$5,000 | 2 TB per partition | 10 | 12 | 12 | Yes | Yes |

### RAG Evaluation Metrics

| Metric | What It Measures | Target | How to Calculate |
|---|---|---|---|
| **Groundedness** | Are answers supported by retrieved context? | > 4.0 / 5.0 | LLM-as-judge or NLI model |
| **Relevance** | Is the answer relevant to the question? | > 4.0 / 5.0 | LLM-as-judge |
| **Coherence** | Is the answer well-structured and logical? | > 4.0 / 5.0 | LLM-as-judge |
| **Fluency** | Is the language natural and grammatical? | > 4.0 / 5.0 | LLM-as-judge |
| **Retrieval Precision** | Are retrieved chunks relevant? | > 0.7 | Manual label or LLM-judge top-K |
| **Retrieval Recall** | Are all relevant chunks retrieved? | > 0.8 | Requires ground truth annotations |
| **NDCG@K** | Quality of ranking in top K results | > 0.7 | Standard IR formula |
| **Answer Similarity** | Closeness to ground truth answer | > 0.8 | Cosine similarity of embeddings |
| **Faithfulness** | No hallucinated facts beyond context | > 0.9 | Claim-level verification |

---

## Card 5: Azure AI Foundry Deployment Types

| Property | **Standard** | **Global Standard** | **Data Zone Standard** | **Provisioned (PTU)** | **Global Batch** |
|---|---|---|---|---|---|
| **Pricing model** | Pay-per-token | Pay-per-token | Pay-per-token | Reserved throughput (PTU/hr) | Pay-per-token (50% discount) |
| **Latency** | Low | Low (optimized routing) | Low | Lowest (guaranteed) | High (async, up to 24h) |
| **Data residency** | Single region | Traffic routed globally | Within data zone (US/EU) | Single region | Traffic routed globally |
| **Data processing** | In-region | May process in any region | US or EU zone | In-region | May process in any region |
| **Rate limits** | Per-deployment TPM | Higher TPM quotas | Per-deployment TPM | Determined by PTU count | Very high (batch queue) |
| **SLA** | 99.9% | 99.9% | 99.9% | 99.9% | Best-effort (24h target) |
| **Min commitment** | None | None | None | 1-month or 1-hour reservation | None |
| **Best for** | Dev/test, moderate prod | High-scale prod, cost optimization | EU/US data residency requirements | Predictable high-throughput prod | Bulk scoring, evaluations, embeddings |
| **Supported models** | Most models | GPT-4o, GPT-4.1, o-series | GPT-4o, GPT-4.1, o-series | GPT-4o, GPT-4.1, o-series | GPT-4o, GPT-4.1 |

### PTU Sizing Quick Reference

| Model | Approx. Tokens per Minute per PTU | Typical PTU for 100 chat users |
|---|---|---|
| **GPT-4o** | ~2,500 TPM | 50–80 PTU |
| **GPT-4.1** | ~2,500 TPM | 50–80 PTU |
| **GPT-4o mini** | ~7,500 TPM | 15–25 PTU |

> **Break-even rule of thumb:** If your monthly PAYG bill exceeds **~$5,000** for a single deployment, evaluate PTU pricing. PTU becomes cost-effective at sustained utilization above **60-70%**.

### Default Quota Limits (Tokens Per Minute)

*Default quotas per subscription per region. Can be increased via support request.*

| Model | Default TPM (Standard) | Default TPM (Global Standard) | Max RPM |
|---|---|---|---|
| **GPT-4.1** | 450K | 2M | 2,700 |
| **GPT-4.1 mini** | 2M | 10M | 12,000 |
| **GPT-4.1 nano** | 2M | 10M | 12,000 |
| **GPT-4o** | 450K | 2M | 2,700 |
| **GPT-4o mini** | 2M | 10M | 12,000 |
| **o3** | 100K | 500K | 600 |
| **o4-mini** | 450K | 2M | 2,700 |

> **Quota tip:** Use Global Standard deployments for higher default TPM limits. Request quota increases via Azure Portal > Azure OpenAI > Quotas.

---

## Card 6: Prompt Engineering Patterns

| Pattern | When to Use | Template | Expected Improvement |
|---|---|---|---|
| **Zero-shot** | Simple, well-defined tasks | `Classify this text as positive or negative: {text}` | Baseline |
| **Few-shot** | When examples clarify the expected format/logic | `Here are examples:\nInput: X → Output: Y\nInput: A → Output: B\nNow: Input: {text} → Output:` | +10–25% accuracy |
| **Chain-of-Thought (CoT)** | Multi-step reasoning, math, logic | `Solve step by step:\n{problem}\nLet's think through this:` | +15–40% on reasoning tasks |
| **Zero-shot CoT** | Quick reasoning boost, no examples needed | `{question}\nLet's think step by step.` | +10–20% on reasoning tasks |
| **ReAct** | Tasks requiring external tools/actions | `Think: {reasoning}\nAction: {tool_call}\nObservation: {result}\nThink: ...` | Enables tool use reliably |
| **Role / System Prompt** | Setting persona, behavior constraints | `You are a {role}. You always {constraint}. You never {restriction}.` | Consistent tone and behavior |
| **Self-consistency** | High-stakes reasoning (run N times, majority vote) | Run CoT N times → pick most common answer | +5–15% on reasoning |
| **Tree-of-Thought** | Complex problem solving with branching paths | Generate multiple approaches → evaluate each → select best | +20–30% on complex planning |
| **Structured Output** | When you need predictable JSON/XML | `Respond in JSON matching this schema: {schema}` + `response_format: json_schema` | Near 100% format compliance |
| **Decomposition** | Break a hard task into subtasks | `First: {subtask1}\nThen: {subtask2}\nFinally: {subtask3}` | Reduces errors on complex tasks |
| **Meta-prompting** | When you want the LLM to write its own prompt | `Write the optimal prompt for: {task_description}` | Variable — good for prompt iteration |
| **Retrieval-augmented** | When current/private knowledge is needed | `Context:\n{retrieved_docs}\n\nUsing ONLY the context above, answer: {question}` | Reduces hallucination dramatically |

### Prompt Structure Best Practice

```
[SYSTEM]
You are {role}. {behavioral constraints}. {output format}.

[USER]
## Context
{background information or retrieved documents}

## Task
{clear, specific instruction}

## Constraints
- {constraint 1}
- {constraint 2}

## Output Format
{expected structure}

## Examples (if few-shot)
Input: ... → Output: ...
```

### Common Prompt Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Vague instructions** | "Do something with this data" → unpredictable output | Be specific: "Extract all dates and amounts from this invoice" |
| **Conflicting constraints** | "Be brief but include all details" → model oscillates | Prioritize: "Summarize in 3 bullet points. Include dollar amounts." |
| **No output format** | Response structure varies per call | Specify format: "Respond as JSON with keys: name, date, amount" |
| **Prompt injection vulnerability** | User input not delimited → hijack risk | Wrap user input in clear delimiters: `"""User message: {input}"""` |
| **Token waste in system prompt** | 2,000-token system prompt on a classification task | Keep system prompts proportional to task complexity |
| **Examples that contradict rules** | Few-shot examples violate stated constraints | Audit examples against constraints before deploying |
| **Asking multi-model questions** | "Is this positive sentiment and extract the entities" → lower accuracy | Split into separate calls or use clear sub-sections |

---

## Card 7: Agent Framework Comparison

| Feature | **Azure AI Agent Service** | **AutoGen** | **Semantic Kernel** | **Copilot Studio** |
|---|---|---|---|---|
| **Type** | Managed cloud service | Open-source framework | Open-source SDK | Low-code platform |
| **Languages** | Python, C#, JavaScript (REST) | Python, .NET | Python, C#, Java | No-code / low-code |
| **Where it runs** | Azure (fully managed) | Self-hosted (any infra) | Self-hosted (any infra) | Microsoft Cloud (managed) |
| **Tool / function calling** | Built-in (code interpreter, file search, Azure Functions, API) | Custom tool definitions | Plugin architecture (native + OpenAPI) | Connectors, Power Automate flows |
| **Multi-agent** | Orchestrated via threads | First-class multi-agent conversations | Experimental multi-agent | Single-agent (can call sub-flows) |
| **Memory / state** | Managed threads with file/vector store | Configurable memory backends | Chat history + plugin state | Conversation context (managed) |
| **Knowledge / RAG** | Built-in file search (vector store) | Custom RAG integration | Built-in text search plugin | Built-in knowledge sources (Dataverse, SharePoint, websites) |
| **Enterprise security** | Azure RBAC, managed identity, VNET | Bring your own | Bring your own | Microsoft Entra ID, DLP, environments |
| **Observability** | Azure Monitor, Application Insights | Custom logging, AutoGen Studio | Custom logging | Built-in analytics dashboard |
| **Best for** | Production AI agents on Azure | Research, complex multi-agent workflows | Integrating AI into existing apps | Business users, citizen developers, rapid prototyping |
| **Learning curve** | Medium | Medium-High | Medium | Low |
| **Cost model** | Pay-per-use (Azure resources) | Infrastructure only | Infrastructure only | Per-user licensing |

### When to Use Which

| Scenario | Recommended |
|---|---|
| Enterprise chatbot with managed infra | Azure AI Agent Service |
| Multi-agent research or simulation | AutoGen |
| Adding AI to existing .NET/Java/Python app | Semantic Kernel |
| Business process automation by non-developers | Copilot Studio |
| Quick prototype with tool calling | Azure AI Agent Service |
| Full control over agent behavior and routing | AutoGen |

---

## Card 8: AI Infrastructure Sizing

### GPU VRAM Requirements by Model Size

| Model Parameters | FP16 VRAM | INT8 VRAM | INT4 (GPTQ/AWQ) VRAM | Example Models |
|---|---|---|---|---|
| **1–3B** | 4–6 GB | 2–3 GB | 1–2 GB | Phi-4-mini, Gemma-3 1B |
| **7–8B** | 14–16 GB | 7–8 GB | 4–5 GB | Llama 3.1 8B, Mistral 7B |
| **13–14B** | 26–28 GB | 13–14 GB | 7–8 GB | Llama 3.1 13B (hypothetical), CodeLlama 13B |
| **34B** | 68 GB | 34 GB | 18–20 GB | CodeLlama 34B |
| **70B** | 140 GB | 70 GB | 36–40 GB | Llama 3.1 70B |
| **405B** | 810 GB | 405 GB | ~200 GB | Llama 3.1 405B |
| **MoE (e.g., Mixtral 8x22B)** | ~280 GB | ~140 GB | ~72 GB | Mixtral 8x22B |

> **Formula:** VRAM (GB) ≈ Parameters (B) x Bytes per parameter. FP16 = 2 bytes. INT8 = 1 byte. INT4 = 0.5 bytes. Add ~20% overhead for KV cache and runtime.

### Azure GPU VM Comparison

| VM Series | GPU | GPU Count | GPU VRAM (total) | vCPUs | RAM (GB) | Approx. Price/hr | Best For |
|---|---|---|---|---|---|---|---|
| **NC4as T4 v3** | T4 | 1 | 16 GB | 4 | 28 | ~$0.53 | Dev/test, small model inference |
| **NC24ads A100 v4** | A100 80GB | 1 | 80 GB | 24 | 220 | ~$3.67 | Single-GPU training, 70B inference (quantized) |
| **NC48ads A100 v4** | A100 80GB | 2 | 160 GB | 48 | 440 | ~$7.35 | 70B FP16 inference, medium training |
| **NC96ads A100 v4** | A100 80GB | 4 | 320 GB | 96 | 880 | ~$14.69 | Large model training, 405B quantized inference |
| **ND96asr v4** | A100 80GB | 8 | 640 GB | 96 | 900 | ~$27.20 | Distributed training, multi-GPU inference |
| **ND96isr H100 v5** | H100 80GB | 8 | 640 GB | 96 | 900 | ~$36.00 | Cutting-edge training, fastest inference |
| **NVadsA10 v5** | A10 | 1 | 24 GB | 6–72 | 55–880 | ~$0.45–$5.00 | Graphics + inference hybrid |

### PTU vs. PAYG Break-Even Reference

```
Monthly PAYG cost       = (input_tokens × input_price) + (output_tokens × output_price)
Monthly PTU cost        = PTU_count × PTU_hourly_rate × 730 hours
Break-even utilization  ≈ 60–70% sustained

Quick check:
  If monthly PAYG spend > $5,000/deployment → evaluate PTU
  If monthly PAYG spend > $15,000/deployment → PTU almost certainly cheaper
```

### Azure AI Search Sizing Recommendations

| Workload Profile | Documents | Vectors | Recommended Tier | Replicas | Partitions |
|---|---|---|---|---|---|
| **Prototype** | < 10K | < 1M | Free or Basic | 1 | 1 |
| **Small production** | 10K–100K | 1M–10M | Basic or S1 | 2 | 1 |
| **Medium production** | 100K–1M | 10M–50M | S1 or S2 | 3 | 2–3 |
| **Large production** | 1M–10M | 50M–500M | S2 or S3 | 3–6 | 3–6 |
| **Enterprise / big data** | > 10M | > 500M | L1 or L2 | 6–12 | 6–12 |

> **High-availability rule:** Always use >= 2 replicas for production SLA (99.9% for reads). Use >= 3 replicas for 99.9% read+write SLA.

### Monthly Cost Estimation Formulas

**Azure OpenAI (PAYG):**
```
Monthly cost = (avg_input_tokens_per_request × requests_per_day × 30 × input_price_per_token)
             + (avg_output_tokens_per_request × requests_per_day × 30 × output_price_per_token)

Example: GPT-4.1 mini, 10K requests/day, 1,500 input + 500 output tokens each:
  Input:  1,500 × 10,000 × 30 × ($0.40 / 1,000,000) = $180/month
  Output:   500 × 10,000 × 30 × ($1.60 / 1,000,000) = $240/month
  Total: $420/month
```

**Azure AI Search:**
```
Monthly cost = service_tier_base_price × partitions × replicas
             + semantic_ranker_queries × $0.01 per 1,000 queries (if S1+)

Example: S1 with 2 replicas, 1 partition:
  $250 × 1 × 2 = $500/month (+ semantic ranker usage)
```

**Embedding indexing (one-time):**
```
Embedding cost = total_chunks × avg_tokens_per_chunk × price_per_token

Example: 100K chunks, 400 tokens avg, text-embedding-3-small:
  100,000 × 400 × ($0.02 / 1,000,000) = $0.80 total
```

---

## Card 9: Responsible AI Checklist

### Pre-Deployment Checklist

| # | Category | Check | Status |
|---|---|---|---|
| 1 | **Purpose** | Documented intended use case and users | &#9744; |
| 2 | **Purpose** | Identified out-of-scope uses | &#9744; |
| 3 | **Fairness** | Tested across demographic groups | &#9744; |
| 4 | **Fairness** | Checked for disparate performance or bias | &#9744; |
| 5 | **Reliability** | Evaluated on diverse test set (> 200 samples) | &#9744; |
| 6 | **Reliability** | Measured hallucination / groundedness rate | &#9744; |
| 7 | **Reliability** | Conducted red-team / adversarial testing | &#9744; |
| 8 | **Safety** | Azure AI Content Safety filters configured | &#9744; |
| 9 | **Safety** | Jailbreak resistance tested | &#9744; |
| 10 | **Privacy** | No PII in training data / prompts without consent | &#9744; |
| 11 | **Privacy** | Data handling complies with GDPR/regional laws | &#9744; |
| 12 | **Transparency** | Users informed they're interacting with AI | &#9744; |
| 13 | **Transparency** | AI-generated content is labeled | &#9744; |
| 14 | **Transparency** | System card / documentation written | &#9744; |
| 15 | **Accountability** | Human escalation path exists | &#9744; |
| 16 | **Accountability** | Monitoring and logging enabled | &#9744; |
| 17 | **Accountability** | Incident response plan documented | &#9744; |
| 18 | **Security** | API keys in Azure Key Vault, not in code | &#9744; |
| 19 | **Security** | Managed Identity used for service-to-service auth | &#9744; |
| 20 | **Security** | Network isolation (VNET/Private Endpoints) configured | &#9744; |

### Azure AI Content Safety — Filter Categories

| Category | What It Detects | Severity Levels | Default Setting |
|---|---|---|---|
| **Hate & Fairness** | Hate speech, discrimination, slurs | Low, Medium, High | Block Medium + High |
| **Sexual** | Sexually explicit content | Low, Medium, High | Block Medium + High |
| **Violence** | Violent content, graphic descriptions | Low, Medium, High | Block Medium + High |
| **Self-Harm** | Self-harm instructions or glorification | Low, Medium, High | Block Medium + High |
| **Jailbreak (Prompt Shield)** | Prompt injection, jailbreak attempts | Detected / Not Detected | Enabled |
| **Protected Material** | Copyrighted text, code licenses | Detected / Not Detected | Enabled |
| **Groundedness Detection** | Hallucinated or ungrounded claims | Grounded / Ungrounded | Available (opt-in) |

### Required Evaluations Before Production

| Evaluation | Minimum Standard | Tool |
|---|---|---|
| **Groundedness** | > 4.0 / 5.0 on test set | Azure AI Evaluation SDK |
| **Relevance** | > 4.0 / 5.0 on test set | Azure AI Evaluation SDK |
| **Red-team testing** | No critical jailbreaks pass | Microsoft PyRIT / manual |
| **Latency P95** | < application SLA (e.g., 5s) | Application Insights |
| **Toxicity rate** | < 0.1% of responses | Content Safety API |
| **Bias audit** | No statistical disparity > 5% across groups | Fairlearn / manual |

### Security Checklist for AI Workloads

| Layer | Requirement | Azure Service |
|---|---|---|
| **Identity** | Managed Identity for all AI services | Entra ID / Managed Identity |
| **Network** | Private Endpoints for AI services | Azure Private Link |
| **Secrets** | API keys in Key Vault | Azure Key Vault |
| **Data** | Encryption at rest and in transit | Azure default (AES-256, TLS 1.2+) |
| **Access control** | RBAC on AI resource operations | Azure RBAC (Cognitive Services User, etc.) |
| **Logging** | Diagnostic logs to Log Analytics | Azure Monitor |
| **Compliance** | AI services in compliant region | Azure compliance documentation |
| **Content** | Content filters enabled on all deployments | Azure AI Content Safety |

---

## Card 10: Microsoft Copilot Ecosystem Map

| Copilot | What It Does | Audience | Licensing / Cost | Key Feature |
|---|---|---|---|---|
| **Microsoft 365 Copilot** | AI assist in Word, Excel, PowerPoint, Outlook, Teams | Enterprise knowledge workers | $30/user/month add-on | Grounded in Microsoft Graph (your emails, docs, meetings) |
| **Copilot in Windows** | OS-level assistant for PC tasks, web search, file finding | All Windows users | Free (basic) / Copilot+ PC features | Deep OS integration, local model on Copilot+ PCs |
| **GitHub Copilot** | AI code completion, chat, code review, agents in IDE | Developers | $10–$39/user/month | Multi-file editing, agent mode, workspace context |
| **Copilot Studio** | Build custom copilots / chatbots with low-code tools | Citizen devs, IT admins | Included in some M365 plans / per-message | Generative AI + topics + connectors |
| **Copilot for Azure** | AI assistant for Azure portal (diagnose, troubleshoot, create) | Azure admins & engineers | Free (in preview for most) | Natural language to Azure CLI/ARM, resource diagnostics |
| **Copilot for Security** | Investigate threats, summarize incidents, reverse-eng malware | SecOps analysts | Standalone: $4/secured compute unit/hr | Grounded in Microsoft Threat Intelligence |
| **Copilot in Power Platform** | AI in Power Apps, Power Automate, Power BI | Makers, analysts | Included in Power Platform licenses | Natural language to app, flow, or DAX formula |
| **Copilot in Dynamics 365** | AI assist across Sales, Service, Finance, Supply Chain | Business users | Included in Dynamics 365 licenses | Contextual to each Dynamics 365 module |
| **Copilot in Fabric** | AI for data engineering, data science, and analytics | Data professionals | Included with Fabric capacity | Natural language to SQL/KQL, auto-insights |
| **Copilot for Sales** | Summarize CRM data, draft emails, meeting prep | Salespeople | $50/user/month or with M365 Copilot | CRM integration (Dynamics 365 + Salesforce) |
| **Copilot for Service** | Summarize cases, draft replies, search knowledge bases | Support agents | $50/user/month or with M365 Copilot | Multi-source knowledge grounding |
| **Copilot for Finance** | Excel-heavy financial workflows, variance analysis | Finance teams | $30/user/month | Automated reconciliation, variance explanations |

### Azure AI Services Quick Map

Beyond Copilots and OpenAI, Azure offers specialized AI services:

| Service | What It Does | Common Use Cases |
|---|---|---|
| **Azure OpenAI Service** | Host GPT, o-series, DALL-E, Whisper models | Chatbots, content generation, code assist |
| **Azure AI Search** | Vector + keyword + semantic search | RAG retrieval, enterprise search, e-commerce |
| **Azure AI Document Intelligence** | Extract text, tables, key-value pairs from documents | Invoice processing, form extraction, ID scanning |
| **Azure AI Speech** | Speech-to-text, text-to-speech, translation, speaker recognition | Call center analytics, accessibility, voice UX |
| **Azure AI Vision** | Image analysis, OCR, face detection, custom models | Product inspection, accessibility, content moderation |
| **Azure AI Language** | NER, sentiment analysis, summarization, PII detection | Text analytics, compliance, customer feedback |
| **Azure AI Translator** | Real-time text and document translation (100+ languages) | Multilingual apps, document localization |
| **Azure AI Content Safety** | Detect harmful content in text and images | Moderation pipelines, UGC platforms |
| **Azure Machine Learning** | Full ML lifecycle: train, deploy, manage models | Custom ML models, MLOps pipelines, AutoML |
| **Azure AI Foundry** | Unified AI development platform | End-to-end AI app development, evaluation, deployment |

---

## Card 11: AI Acronym & Term Glossary

A comprehensive A-Z reference of terms an AI and infrastructure architect encounters daily.

| # | Term | Full Form / Definition |
|---|---|---|
| 1 | **AGI** | Artificial General Intelligence — hypothetical AI with human-level general reasoning across all domains. |
| 2 | **AI Search** | Azure AI Search — Microsoft's managed search service with vector, keyword, and semantic ranking capabilities. |
| 3 | **BERT** | Bidirectional Encoder Representations from Transformers — foundational encoder model for NLP tasks (classification, NER). |
| 4 | **BM25** | Best Matching 25 — classic probabilistic ranking algorithm for keyword/full-text search. |
| 5 | **CoT** | Chain-of-Thought — prompting technique that asks the model to reason step-by-step before answering. |
| 6 | **CUDA** | Compute Unified Device Architecture — NVIDIA's parallel computing platform for GPU programming. |
| 7 | **DAG** | Directed Acyclic Graph — used in ML pipelines and agent orchestration to define task dependencies. |
| 8 | **DPO** | Direct Preference Optimization — alignment technique that fine-tunes LLMs using human preference pairs without a separate reward model. |
| 9 | **Embedding** | A dense vector representation of text (or images/audio) in a continuous vector space where semantic similarity maps to geometric proximity. |
| 10 | **Fine-tuning** | Continued training of a pre-trained model on a domain-specific dataset to improve performance on specialized tasks. |
| 11 | **FP16 / BF16** | 16-bit floating point formats used in GPU training and inference to reduce memory while maintaining precision. |
| 12 | **Function Calling** | LLM capability to output structured JSON matching a tool/function schema, enabling the model to invoke external APIs. |
| 13 | **GGUF** | GPT-Generated Unified Format — file format for quantized models used by llama.cpp and other local inference engines. |
| 14 | **GPT** | Generative Pre-trained Transformer — autoregressive language model architecture. |
| 15 | **Grounding** | Connecting LLM responses to verified data sources (RAG, search results, databases) to reduce hallucination. |
| 16 | **Guardrails** | Safety mechanisms (content filters, input/output validation, topic restrictions) that constrain AI system behavior. |
| 17 | **Hallucination** | When an LLM generates plausible-sounding but factually incorrect or fabricated information. |
| 18 | **HNSW** | Hierarchical Navigable Small World — graph-based algorithm for approximate nearest-neighbor vector search. Used in Azure AI Search. |
| 19 | **Inference** | The process of running a trained model to generate predictions/outputs from new inputs. Contrast with *training*. |
| 20 | **INT4 / INT8** | 4-bit / 8-bit integer quantization — reduces model size and VRAM usage at the cost of slight accuracy loss. |
| 21 | **JSON Mode** | Azure OpenAI feature that forces the model to return valid JSON. Use `json_schema` for strict schema adherence. |
| 22 | **KV Cache** | Key-Value Cache — stores attention key/value pairs from previous tokens to avoid recomputation during autoregressive generation. Dominates VRAM during long-context inference. |
| 23 | **LoRA** | Low-Rank Adaptation — parameter-efficient fine-tuning method that trains small rank-decomposition matrices instead of full weights. |
| 24 | **LLM** | Large Language Model — transformer-based models with billions of parameters trained on massive text corpora. |
| 25 | **MCP** | Model Context Protocol — open protocol for connecting LLMs to external data sources and tools via a standardized interface. |
| 26 | **MoE** | Mixture of Experts — architecture where only a subset of model parameters activate per token, improving efficiency. |
| 27 | **NDCG** | Normalized Discounted Cumulative Gain — ranking quality metric used in search evaluation. Range 0–1, higher is better. |
| 28 | **NER** | Named Entity Recognition — extracting structured entities (people, places, organizations) from text. |
| 29 | **ONNX** | Open Neural Network Exchange — open format for representing ML models, enabling cross-framework portability. |
| 30 | **PEFT** | Parameter-Efficient Fine-Tuning — umbrella term for methods (LoRA, QLoRA, adapters) that fine-tune a small subset of parameters. |
| 31 | **PPO** | Proximal Policy Optimization — reinforcement learning algorithm used in RLHF to align LLMs with human preferences. |
| 32 | **Prompt Injection** | Adversarial attack where malicious input in a prompt attempts to override the model's system instructions. |
| 33 | **PTU** | Provisioned Throughput Unit — Azure OpenAI's reserved capacity pricing model for guaranteed throughput. |
| 34 | **QLoRA** | Quantized LoRA — combines 4-bit quantization with LoRA for fine-tuning large models on consumer GPUs. |
| 35 | **Quantization** | Reducing model weight precision (e.g., FP16 → INT4) to shrink model size and speed up inference. |
| 36 | **RAG** | Retrieval-Augmented Generation — architecture that retrieves relevant documents and includes them in the LLM context before generation. |
| 37 | **RBAC** | Role-Based Access Control — security model where permissions are assigned to roles, used throughout Azure AI services. |
| 38 | **Reasoning Models** | LLMs that use internal chain-of-thought (thinking tokens) before answering. Azure examples: o3, o4-mini, o3-mini. |
| 39 | **RLHF** | Reinforcement Learning from Human Feedback — alignment method using human preference rankings to train a reward model that guides LLM fine-tuning. |
| 40 | **RRF** | Reciprocal Rank Fusion — algorithm for merging ranked results from multiple retrieval methods (used in hybrid search). |
| 41 | **Semantic Kernel** | Microsoft's open-source SDK for integrating AI models into applications. Supports plugins, planners, and memory. |
| 42 | **SFT** | Supervised Fine-Tuning — fine-tuning on labeled instruction-response pairs. First step before RLHF alignment. |
| 43 | **SLM** | Small Language Model — models under ~4B parameters designed for efficiency and on-device deployment (e.g., Phi-4-mini). |
| 44 | **SoTA** | State of the Art — the current best-known performance on a benchmark or task. |
| 45 | **System Prompt** | Instructions placed in the system message to define model behavior, persona, constraints, and output format. |
| 46 | **Temperature** | Generation parameter controlling output randomness. 0 = deterministic, higher = more random. |
| 47 | **Tokenizer** | Algorithm that splits text into tokens (subword units). Different models use different tokenizers (BPE, SentencePiece, etc.). |
| 48 | **Top-P** | Nucleus sampling — limits token selection to the smallest set whose cumulative probability >= P. |
| 49 | **TPM** | Tokens Per Minute — Azure OpenAI rate limit unit. Quota is allocated in TPM per deployment. |
| 50 | **Transformer** | Neural network architecture based on self-attention. Foundation of all modern LLMs. |
| 51 | **Upsampling** | Increasing resolution or representation quality. In AI data: generating synthetic examples to balance datasets. |
| 52 | **vLLM** | Open-source high-throughput LLM serving engine. Uses PagedAttention for efficient KV cache management. |
| 53 | **Vector Database** | Database optimized for storing and querying high-dimensional embedding vectors (Azure AI Search, Pinecone, Qdrant, etc.). |
| 54 | **Vector Search** | Finding similar items by computing distance (cosine, dot product, L2) between embedding vectors. |
| 55 | **VNET Integration** | Deploying Azure AI services within a Virtual Network for network isolation and private connectivity. |
| 56 | **WASM** | WebAssembly — used in edge AI to run inference models in browsers or edge runtimes without native compilation. |
| 57 | **XAI** | Explainable AI — methods and tools for understanding and interpreting AI model decisions (SHAP, LIME, attention visualization). |
| 58 | **Zero-shot** | Asking a model to perform a task without any examples — relying on pre-trained knowledge alone. |
| 59 | **Few-shot** | Providing a small number of examples in the prompt to guide the model's output format and behavior. |
| 60 | **Agentic AI** | AI systems that can autonomously plan, use tools, and take multi-step actions to complete goals. |
| 61 | **Attention** | Core mechanism in transformers that lets tokens attend to (weight) all other tokens in the sequence. Self-attention enables contextual understanding. |
| 62 | **BPE** | Byte Pair Encoding — tokenization algorithm used by GPT models. Iteratively merges frequent character pairs into tokens. |
| 63 | **Chunking** | Splitting documents into smaller segments for indexing and retrieval in RAG pipelines. |
| 64 | **Content Safety** | Azure AI Content Safety — service for detecting harmful content (hate, violence, sexual, self-harm) in text and images. |
| 65 | **Cross-encoder** | Model that takes a query-document pair as input and outputs a relevance score. More accurate than bi-encoder but slower. Used for reranking. |
| 66 | **Distillation** | Training a smaller (student) model to mimic a larger (teacher) model's outputs. Produces efficient models for deployment. |
| 67 | **Document Intelligence** | Azure AI Document Intelligence — service for extracting text, tables, and structure from PDFs, forms, and images. |
| 68 | **Eval / Evaluation** | Systematic measurement of AI system quality using metrics (groundedness, relevance, etc.) and test datasets. |
| 69 | **Foundry** | Azure AI Foundry — Microsoft's unified platform for building, evaluating, and deploying AI applications. |
| 70 | **GAN** | Generative Adversarial Network — architecture with generator and discriminator networks. Largely superseded by diffusion models for image generation. |
| 71 | **GPTQ** | Post-training quantization method that compresses LLMs to 4-bit with minimal quality loss. Popular for local deployment. |
| 72 | **Hybrid Search** | Combining vector (semantic) and keyword (BM25) search with rank fusion (RRF) for best retrieval quality. |
| 73 | **ICL** | In-Context Learning — the ability of LLMs to learn from examples provided in the prompt without weight updates. |
| 74 | **Latency** | Time from sending a request to receiving the first (TTFT) or last (E2E) token of the response. |
| 75 | **MAU** | Monthly Active Users — common metric for sizing AI deployments and estimating costs. |
| 76 | **Multimodal** | Models that process multiple input types (text, images, audio, video) in a single architecture. |
| 77 | **NLI** | Natural Language Inference — task of determining if a hypothesis is entailed by, contradicts, or is neutral to a premise. Used in groundedness evaluation. |
| 78 | **Orchestrator** | Component that routes requests, manages conversation state, calls tools, and coordinates between models in an AI application. |
| 79 | **PagedAttention** | Memory management technique (used in vLLM) that pages KV cache like OS virtual memory, reducing waste. |
| 80 | **Prompt Caching** | Reusing computed prefixes across requests to reduce latency and cost for shared system prompts. |
| 81 | **Red Teaming** | Adversarial testing of AI systems to find safety vulnerabilities, jailbreaks, and failure modes before deployment. |
| 82 | **Retriever** | Component in RAG that searches a knowledge base and returns relevant documents/chunks for the LLM context. |
| 83 | **RPM** | Requests Per Minute — Azure OpenAI rate limit unit. Measured alongside TPM. |
| 84 | **Softmax** | Activation function that converts logits to a probability distribution. Final layer of token prediction in LLMs. |
| 85 | **Streaming** | Returning tokens incrementally as they're generated, reducing perceived latency. Enabled via `stream=True` in API calls. |
| 86 | **TTFT** | Time To First Token — latency metric measuring how quickly the first token of a response is returned. |
| 87 | **Tool Use** | LLM capability to decide when and how to call external tools (APIs, databases, code) during generation. |
| 88 | **TF-IDF** | Term Frequency–Inverse Document Frequency — classic text representation weighting scheme. Predecessor to modern embeddings. |

---

## Card 12: Key Azure AI URLs & Resources

### Azure Portals & Services

| Resource | URL |
|---|---|
| Azure AI Foundry Portal | [https://ai.azure.com](https://ai.azure.com) |
| Azure Portal | [https://portal.azure.com](https://portal.azure.com) |
| Azure OpenAI Studio (legacy) | [https://oai.azure.com](https://oai.azure.com) |
| Azure AI Content Safety | [https://contentsafety.cognitive.azure.com](https://contentsafety.cognitive.azure.com) |

### Pricing Pages

| Service | URL |
|---|---|
| Azure OpenAI Pricing | [https://azure.microsoft.com/pricing/details/cognitive-services/openai-service/](https://azure.microsoft.com/pricing/details/cognitive-services/openai-service/) |
| Azure AI Search Pricing | [https://azure.microsoft.com/pricing/details/search/](https://azure.microsoft.com/pricing/details/search/) |
| Azure AI Services Pricing | [https://azure.microsoft.com/pricing/details/cognitive-services/](https://azure.microsoft.com/pricing/details/cognitive-services/) |
| Azure Virtual Machines Pricing (GPU) | [https://azure.microsoft.com/pricing/details/virtual-machines/linux/](https://azure.microsoft.com/pricing/details/virtual-machines/linux/) |

### Documentation

| Topic | URL |
|---|---|
| Azure OpenAI Documentation | [https://learn.microsoft.com/azure/ai-services/openai/](https://learn.microsoft.com/azure/ai-services/openai/) |
| Azure AI Foundry Documentation | [https://learn.microsoft.com/azure/ai-studio/](https://learn.microsoft.com/azure/ai-studio/) |
| Azure AI Search Documentation | [https://learn.microsoft.com/azure/search/](https://learn.microsoft.com/azure/search/) |
| Azure AI Content Safety Documentation | [https://learn.microsoft.com/azure/ai-services/content-safety/](https://learn.microsoft.com/azure/ai-services/content-safety/) |
| Azure OpenAI Model Catalog | [https://learn.microsoft.com/azure/ai-studio/how-to/model-catalog](https://learn.microsoft.com/azure/ai-studio/how-to/model-catalog) |
| Responsible AI Principles | [https://www.microsoft.com/ai/responsible-ai](https://www.microsoft.com/ai/responsible-ai) |
| Responsible AI Dashboard | [https://learn.microsoft.com/azure/machine-learning/concept-responsible-ai-dashboard](https://learn.microsoft.com/azure/machine-learning/concept-responsible-ai-dashboard) |
| Azure OpenAI Quotas & Limits | [https://learn.microsoft.com/azure/ai-services/openai/quotas-limits](https://learn.microsoft.com/azure/ai-services/openai/quotas-limits) |
| Azure OpenAI What's New | [https://learn.microsoft.com/azure/ai-services/openai/whats-new](https://learn.microsoft.com/azure/ai-services/openai/whats-new) |

### GitHub Repositories

| Repository | URL |
|---|---|
| Semantic Kernel | [https://github.com/microsoft/semantic-kernel](https://github.com/microsoft/semantic-kernel) |
| AutoGen | [https://github.com/microsoft/autogen](https://github.com/microsoft/autogen) |
| Azure AI Samples | [https://github.com/Azure-Samples/azure-ai](https://github.com/Azure-Samples/azure-ai) |
| Azure OpenAI Samples | [https://github.com/Azure-Samples/openai](https://github.com/Azure-Samples/openai) |
| PyRIT (Red Teaming) | [https://github.com/Azure/PyRIT](https://github.com/Azure/PyRIT) |
| Prompty | [https://github.com/microsoft/prompty](https://github.com/microsoft/prompty) |
| AI App Templates | [https://github.com/Azure-Samples/ai-app-templates](https://github.com/Azure-Samples/ai-app-templates) |
| Azure AI Evaluation SDK | [https://github.com/Azure/azure-sdk-for-python/tree/main/sdk/evaluation](https://github.com/Azure/azure-sdk-for-python/tree/main/sdk/evaluation) |

### Community & Learning

| Resource | URL |
|---|---|
| Microsoft Learn AI Training Paths | [https://learn.microsoft.com/training/browse/?terms=AI](https://learn.microsoft.com/training/browse/?terms=AI) |
| Azure AI Blog | [https://techcommunity.microsoft.com/t5/ai-azure-ai-services-blog/bg-p/Azure-AI-Services-blog](https://techcommunity.microsoft.com/t5/ai-azure-ai-services-blog/bg-p/Azure-AI-Services-blog) |
| Microsoft AI (Corporate) | [https://www.microsoft.com/ai](https://www.microsoft.com/ai) |
| Azure AI Discord | [https://aka.ms/azureaicommunity](https://aka.ms/azureaicommunity) |

---

## Quick Lookup Index

Jump to any card by topic:

| Card | Topic | Key Questions Answered |
|---|---|---|
| [Card 1](#card-1-llm-generation-parameters-cheat-sheet) | LLM Parameters | What do temperature, top-p, penalties do? What values should I use? |
| [Card 2](#card-2-token-quick-reference) | Tokens | How many tokens is my text? What does each model cost? |
| [Card 3](#card-3-model-selection-decision-tree) | Model Selection | Which model for my use case? |
| [Card 4](#card-4-rag-architecture-cheat-sheet) | RAG Architecture | Chunking? Embeddings? Retrieval strategy? Evaluation? |
| [Card 5](#card-5-azure-ai-foundry-deployment-types) | Deployment Types | Standard vs. Provisioned vs. Global vs. Batch? |
| [Card 6](#card-6-prompt-engineering-patterns) | Prompt Patterns | Zero-shot vs. few-shot vs. CoT? Prompt template? |
| [Card 7](#card-7-agent-framework-comparison) | Agent Frameworks | Which agent framework should I use? |
| [Card 8](#card-8-ai-infrastructure-sizing) | Infrastructure | GPU sizing? VM selection? PTU break-even? |
| [Card 9](#card-9-responsible-ai-checklist) | Responsible AI | Pre-deployment checks? Content filters? Security? |
| [Card 10](#card-10-microsoft-copilot-ecosystem-map) | Copilot Ecosystem | Which Copilot does what? Licensing? |
| [Card 11](#card-11-ai-acronym--term-glossary) | Glossary | What does this acronym mean? |
| [Card 12](#card-12-key-azure-ai-urls--resources) | URLs & Links | Where is the pricing page? Where is the documentation? |

---

:::tip Bookmark This Page
Press `Ctrl+D` / `Cmd+D` to bookmark. This page is designed to be your daily quick-reference for Azure AI engineering decisions.
:::

---

*Module 11 of 12 in the AI Nexus learning path. Designed as a living reference — updated as Azure AI services evolve.*
