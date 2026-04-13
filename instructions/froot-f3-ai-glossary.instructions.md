---
description: "AI glossary consistency — use standard FAI terminology, avoid ambiguous AI terms in code comments."
applyTo: "**"
waf:
  - "operational-excellence"
---

# AI Glossary & Terminology — FAI Standards

Enforce consistent AI/ML terminology across code, comments, documentation, and variable names. Inconsistent terms confuse contributors, break grep-ability, and create ambiguity in technical docs.

## Preferred Terminology Table

Use the **Preferred** term in all code comments, docstrings, variable names, and documentation. The **Avoid** column lists terms that are ambiguous, informal, or inconsistent with industry standards.

| Preferred Term | Avoid | Context |
|---|---|---|
| completion | response, answer, reply, output | LLM-generated text (`completion_text`, not `response_text`) |
| prompt | query, question, input text | Text sent to an LLM (`system_prompt`, `user_prompt`) |
| system prompt | system message, instructions | The `role: system` portion of a chat completion |
| embedding | vector, representation, encoding | Dense numerical representation (`embedding_model`, not `vectorizer`) |
| token | word, subword, piece | LLM processing unit (`completion_tokens`, not `output_length`) |
| retrieval-augmented generation | RAG (user docs only) | Spell out in user-facing text; `RAG` acceptable in code/comments |
| grounding | hallucination prevention, fact-checking | Anchoring output to source data (`grounding_score`) |
| hallucination | confabulation, fabrication, making up | Model generating unsupported claims (`hallucination_rate`) |
| fine-tuning | training, retraining, customization | Adapting a base model on domain data (`fine_tuning_job`) |
| inference | prediction, scoring, running | Model execution at runtime (`inference_endpoint`) |
| context window | context length, max tokens, memory | Total token capacity of a model (`context_window_size`) |
| chunking | splitting, segmentation, partitioning | Dividing documents for indexing (`chunk_size`, `chunk_overlap`) |
| reranking | re-scoring, second-pass ranking | Reordering search results by relevance (`reranker_model`) |
| semantic search | vector search, similarity search | Meaning-based retrieval (`semantic_search_index`) |
| hybrid search | combined search, multi-signal search | Keyword + semantic fusion (`hybrid_search_config`) |
| content safety | content moderation, filtering | Detecting harmful output (`content_safety_threshold`) |
| prompt injection | jailbreak, prompt attack | Adversarial input manipulation (`prompt_injection_defense`) |
| structured output | JSON mode, function calling output | Schema-constrained LLM response (`structured_output_schema`) |
| model deployment | model hosting, model serving | Making a model available via API (`deployment_name`) |
| temperature | creativity, randomness | Sampling parameter (`temperature: 0.3`, not `creativity_level`) |
| top_p | nucleus sampling | Cumulative probability threshold (`top_p: 0.95`) |
| max_tokens | max length, output limit | Token budget for completion (`max_tokens: 4096`) |
| zero-shot | no examples, direct | Prompting without examples (`zero_shot_classification`) |
| few-shot | with examples, in-context learning | Prompting with examples (`few_shot_examples`) |
| chain-of-thought | step-by-step, reasoning chain | Explicit reasoning in prompt (`chain_of_thought_prompt`) |
| agent | bot, assistant, AI helper | Autonomous AI entity with tool access (`agent_config`) |
| tool calling | function calling, plugin invocation | LLM invoking external functions (`tool_call_result`) |
| guardrail | safety net, filter, constraint | Runtime boundary enforcement (`guardrail_config`) |
| evaluation | eval, testing, benchmarking | Measuring model/pipeline quality (`evaluation_pipeline`) |
| groundedness | faithfulness, factuality | Output fidelity to source docs (`groundedness_score`) |
| latency | response time, delay | Time to first/last token (`p95_latency_ms`) |
| throughput | requests per second, QPS | Processing capacity (`throughput_tokens_per_second`) |
| orchestrator | coordinator, router, dispatcher | Controls multi-step AI workflows (`orchestrator_agent`) |
| Provisioned Throughput Unit | PTU | Azure OpenAI reserved capacity (`ptu_allocation`) |

## Variable & Function Naming

### Python (snake_case)
```python
# ✅ Correct
embedding_model = load_model("text-embedding-3-large")
completion_tokens = response.usage.completion_tokens
chunk_size = config["chunking"]["chunk_size"]
grounding_score = evaluate_groundedness(completion, sources)
reranker_model = CrossEncoderReranker(model_name)

# ❌ Wrong
vectorizer = load_model("text-embedding-3-large")      # Use embedding_model
output_length = response.usage.completion_tokens        # Use completion_tokens
split_size = config["chunking"]["chunk_size"]            # Use chunk_size
fact_check_score = evaluate_groundedness(completion, sources)  # Use grounding_score
```

### TypeScript (camelCase)
```typescript
// ✅ Correct
const embeddingModel = loadModel("text-embedding-3-large");
const completionTokens = response.usage.completionTokens;
const groundingScore = evaluateGroundedness(completion, sources);
const inferenceEndpoint = config.deployment.endpoint;

// ❌ Wrong
const vectorizer = loadModel("text-embedding-3-large");
const outputLength = response.usage.completionTokens;
const factCheckScore = evaluateGroundedness(completion, sources);
const modelUrl = config.deployment.endpoint;  // Use inferenceEndpoint
```

## Comment & Docstring Standards

```python
def generate_completion(prompt: str, temperature: float = 0.3) -> str:
    """Generate an LLM completion from a user prompt.

    Uses retrieval-augmented generation to ground the completion
    in source documents, reducing hallucination risk.

    Args:
        prompt: The user prompt to send to the model.
        temperature: Sampling temperature (0.0 = deterministic).

    Returns:
        The completion text with grounding citations.
    """
```

Rules for AI-related comments:
- Spell out "retrieval-augmented generation" on first use in docstrings; `RAG` thereafter
- Use "completion" not "response" when referring to LLM output
- Use "prompt" not "query" when referring to LLM input
- Use "embedding" not "vector" when referring to the representation itself
- Use "grounding" not "hallucination prevention" — describe the positive pattern
- Reference specific scores: "groundedness_score ≥ 4.0" not "good quality check"

## Documentation Conventions

| Context | Rule | Example |
|---|---|---|
| User-facing docs | Spell out acronyms on first use | "Retrieval-Augmented Generation (RAG)" |
| Code comments | Acronyms acceptable after first use | `# RAG pipeline: embed → retrieve → rerank → generate` |
| API docs | Use "completion" for all LLM outputs | `POST /completions` not `POST /responses` |
| Config files | snake_case keys matching glossary | `"embedding_model"`, `"chunk_size"` |
| Error messages | Plain language, no jargon | "Could not generate a response" not "Completion inference failed" |
| Metric names | Glossary term + unit suffix | `grounding_score`, `p95_latency_ms`, `completion_tokens` |

## Anti-Patterns

- ❌ Mixing "vector" and "embedding" in the same file — pick "embedding"
- ❌ Using "response" for LLM output and HTTP response interchangeably — use "completion" for LLM
- ❌ Abbreviating "retrieval-augmented generation" as "RAG" in user-facing docs without spelling out first
- ❌ Naming variables `output`, `result`, `data` — use domain-specific terms from the glossary
- ❌ Using "AI" as a variable prefix (`ai_response`, `ai_result`) — use the specific concept (`completion`, `embedding`)
- ❌ Inconsistent casing: `ChunkSize` in one file, `chunk_size` in another — follow language convention
- ❌ Using "model" alone as a variable name — qualify it: `embedding_model`, `reranker_model`, `chat_model`
- ❌ Referring to prompt injection as "jailbreak" in code — they are distinct attack types
- ❌ Using "training" when you mean "fine-tuning" — training implies from-scratch pre-training
- ❌ Writing "the AI thinks" in docs — models don't think; use "the model generates" or "the completion contains"

## WAF Alignment

| WAF Pillar | Terminology Impact |
|---|---|
| **Operational Excellence** | Consistent terminology enables grep-ability, onboarding speed, and cross-team communication |
| **Security** | Precise terms for "prompt injection" vs "jailbreak" vs "data exfiltration" prevent misclassification |
| **Reliability** | Standard metric names (`groundedness_score`, `p95_latency_ms`) enable consistent alerting |
| **Cost Optimization** | Correct token terminology (`completion_tokens`, `prompt_tokens`) enables accurate cost attribution |
| **Performance Efficiency** | Uniform naming (`inference_endpoint`, `throughput_tokens_per_second`) supports benchmark comparison |
| **Responsible AI** | Precise language ("hallucination", "grounding", "content safety") ensures accurate incident reporting |
