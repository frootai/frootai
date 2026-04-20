---
sidebar_position: 3
title: "F3: AI Glossary"
description: "50 essential AI/ML terms with concise definitions, organized alphabetically and tagged by FrootAI FROOT layer."
---

# F3: AI Glossary

Quick-reference glossary of the 50 most important AI/ML terms. Each term is tagged with the **FROOT layer** it belongs to: **F**oundations, **R**easoning, **O**rchestration, **O**perations, or **T**ransformation.

:::tip How to Use This Glossary
Use `Ctrl+F` to search for a specific term. Layers map to FrootAI modules:
- **F** = Foundations ([F1](./f1-genai-foundations.md), [F2](./f2-llm-landscape.md)) — model mechanics & architecture
- **R** = Reasoning — prompts, RAG, grounding, deterministic AI
- **O** = Orchestration — agents, tools, frameworks, memory
- **Op** = Operations — infrastructure, deployment, monitoring, observability
- **T** = Transformation — fine-tuning, evaluation, responsible AI, alignment
:::

:::info Layer Legend Quick Reference
| Code | FROOT Layer | Focus Area |
|------|-------------|------------|
| **F** | Foundations | Model mechanics, architecture, math, tokenization |
| **R** | Reasoning | Prompts, RAG, grounding, guardrails, search |
| **O** | Orchestration | Agents, tools, frameworks, memory, delegation |
| **Op** | Operations | Infrastructure, deployment, monitoring, cost |
| **T** | Transformation | Fine-tuning, evaluation, responsible AI, alignment |
:::

## Terms A–Z

| Term | Layer | Definition |
|------|-------|------------|
| **Agent** | O | An LLM-powered system that can reason, plan, and take actions using tools. Unlike simple chat, agents operate in loops — observe → think → act → observe. |
| **Alignment** | T | The process of making AI models behave according to human values and intentions. Techniques include RLHF, DPO, and constitutional AI. |
| **Attention** | F | The mechanism that lets transformers weigh the relevance of every token against every other token. Self-attention is the core of all modern LLMs. |
| **Autoregressive** | F | A generation strategy where each new token depends on all previously generated tokens. GPT-family models are autoregressive — they generate left-to-right, one token at a time. |
| **BPE** | F | Byte-Pair Encoding. The tokenization algorithm used by most LLMs. Iteratively merges the most frequent adjacent byte pairs into single tokens. See [F1](./f1-genai-foundations.md). |
| **Chain-of-Thought (CoT)** | R | A prompting technique that instructs the model to show its reasoning step-by-step before giving a final answer. Dramatically improves accuracy on math, logic, and multi-step problems. |
| **Chunking** | R | Splitting documents into smaller segments for RAG retrieval. Strategies include fixed-size (512 tokens), semantic (by topic), and recursive (by structure). Chunk size profoundly affects retrieval quality. |
| **Context Window** | F | The maximum number of tokens a model can process in a single request (input + output). GPT-4o: 128K, GPT-4.1: 1M. Exceeding it causes silent truncation. |
| **Copilot** | O | Microsoft's AI assistant brand. GitHub Copilot assists with code; Microsoft 365 Copilot assists with productivity. Built on GPT-4o with tool integration. |
| **Cosine Similarity** | F | A metric measuring the angle between two vectors (range: -1 to 1). Used to compare embeddings — 1.0 = identical meaning, 0 = unrelated. Core to semantic search and RAG. |
| **Deterministic AI** | R | Making AI outputs reproducible and predictable. Achieved via temperature=0, seed pinning, structured output schemas, and guardrails. See FrootAI Play 03. |
| **DPO** | T | Direct Preference Optimization. A simpler alternative to RLHF that fine-tunes models directly on human preference pairs without training a separate reward model. |
| **Embeddings** | F | Dense vector representations of text (e.g., 1536 or 3072 dimensions). Semantically similar texts have nearby vectors. Used for search, RAG, clustering, and classification. |
| **Encoder/Decoder** | F | Two transformer architectures. Encoders (BERT) create representations for understanding. Decoders (GPT) generate text autoregressively. Encoder-decoder (T5) does both. |
| **Evaluation** | T | Systematic measurement of AI quality. Key metrics: groundedness, relevance, coherence, fluency, safety. FrootAI uses automated eval pipelines with thresholds (≥4.0/5.0). |
| **Few-Shot** | R | Providing 2–5 input/output examples in the prompt so the model learns the pattern in-context. More reliable than zero-shot for formatting and classification tasks. |
| **Fine-Tuning** | T | Training a pre-trained model on domain-specific data to specialize its behavior. Cheaper than training from scratch. Methods: full fine-tuning, LoRA, QLoRA. See Play 13. |
| **Foundation Model** | F | A large pre-trained model (GPT-4o, Llama 3.1, Claude) designed to be adapted for many downstream tasks. Trained on broad data; specialized via prompting or fine-tuning. |
| **Function Calling** | O | An LLM capability where the model outputs structured JSON to invoke external functions/APIs. The model doesn't execute the function — your code does. Enables tool use. |
| **GPU** | Op | Graphics Processing Unit. The parallel-computing hardware that powers AI training and inference. Key metric: VRAM (memory). A100: 80GB, H100: 80GB, H200: 141GB. |
| **Grounding** | R | Connecting AI responses to verified source data (documents, databases, APIs) to reduce hallucination. RAG is the primary grounding technique. See Play 01. |
| **Guardrails** | R | Constraints applied to AI inputs and outputs — content filters, token limits, schema validation, blocklists. Implemented via Azure AI Content Safety or custom rules in `guardrails.json`. |
| **Hallucination** | R | When an AI generates plausible-sounding but factually incorrect information. Mitigated by grounding, RAG, low temperature, and groundedness evaluation. |
| **Hybrid Search** | R | Combining keyword search (BM25) with vector search (embeddings) for retrieval. Typically outperforms either alone. Azure AI Search supports this natively via `search_type: "hybrid"`. |
| **Inference** | F | Running a trained model to generate predictions/outputs. What you do when you call an API. Contrast with training (learning weights from data). See [F1](./f1-genai-foundations.md). |
| **In-Context Learning** | R | The ability of LLMs to learn new tasks from examples provided in the prompt, without any weight updates. Encompasses zero-shot, few-shot, and many-shot prompting. |
| **JSON Mode** | R | A model setting that guarantees the output is valid JSON. OpenAI's `response_format: { type: "json_object" }`. More reliable: Structured Outputs with a JSON schema. |
| **KV Cache** | F | Key-Value cache. An optimization that stores previously computed attention keys and values to avoid recomputation during autoregressive generation. Reduces latency but consumes VRAM. |
| **Knowledge Cutoff** | F | The date after which a model has no training data. GPT-4o: Oct 2023. Information after this date requires RAG or tool use to access. |
| **LangChain** | O | A popular open-source framework for building LLM applications. Provides abstractions for chains, agents, tools, and memory. Python and JavaScript versions available. |
| **LoRA** | T | Low-Rank Adaptation. A parameter-efficient fine-tuning method that freezes the base model and trains small rank-decomposition matrices. Reduces VRAM by 10–100× vs full fine-tuning. |
| **MCP** | O | Model Context Protocol. An open standard (by Anthropic) for connecting AI models to external tools and data sources. FrootAI's MCP server exposes 25 tools. See [F4](./f4-agentic-os.md). |
| **Memory (Agent)** | O | How agents persist information across turns. Short-term: conversation history in context. Long-term: vector store or database. Semantic Kernel uses `ChatHistory` + plugins. |
| **Multi-Agent** | O | Systems where multiple specialized AI agents collaborate on complex tasks. Patterns: supervisor, swarm, pipeline, debate. See Play 07 and Play 22. |
| **Multi-Modal** | F | Models that process multiple input types — text, images, audio, video. GPT-4o and Gemini are natively multimodal. Llama 3.2 Vision adds image understanding. |
| **Next-Token Prediction** | F | The core training objective of autoregressive LLMs. Given all preceding tokens, predict the probability distribution of the next token. This simple objective produces emergent capabilities. |
| **ONNX** | Op | Open Neural Network Exchange. A cross-platform model format for optimized inference. Used with ONNX Runtime for CPU/GPU deployment without framework dependencies. |
| **Parameters** | F | The learnable weights in a neural network. "7B" = 7 billion parameters. More parameters ≈ more capability but higher compute cost. See VRAM formula in [F1](./f1-genai-foundations.md). |
| **Prompt Engineering** | R | The practice of designing effective instructions for LLMs. Techniques: system prompts, few-shot examples, chain-of-thought, structured output, role-playing. |
| **QLoRA** | T | Quantized LoRA. Combines 4-bit quantization of the base model with LoRA adapters. Enables fine-tuning of 70B models on a single 48GB GPU. |
| **Quantization** | F | Reducing the numerical precision of model weights (FP32→FP16→INT8→INT4) to shrink VRAM usage and increase inference speed. Trade-off: some quality loss. |
| **RAG** | R | Retrieval-Augmented Generation. A pattern that retrieves relevant documents from a knowledge base and includes them in the LLM prompt for grounded answers. See Play 01. |
| **RLHF** | T | Reinforcement Learning from Human Feedback. A training technique where humans rank model outputs and a reward model is trained on those preferences to fine-tune the LLM. |
| **Semantic Kernel** | O | Microsoft's open-source SDK for AI orchestration. Supports plugins, planners, memory, and multi-model routing. The recommended orchestration layer for Azure AI apps. |
| **Structured Output** | R | Constraining LLM output to conform to a JSON schema. OpenAI's `response_format: { type: "json_schema", json_schema: {...} }` guarantees schema-valid output with 100% reliability. |
| **Temperature** | F | A generation parameter (0–2) controlling output randomness. 0 = greedy/deterministic, 0.7 = balanced, 1.5+ = highly creative. See [F1](./f1-genai-foundations.md). |
| **Tokenization** | F | The process of converting text into tokens (sub-word integers) that models can process. Different models use different tokenizers — `tiktoken` for OpenAI, `SentencePiece` for Llama. |
| **Transformer** | F | The neural network architecture (2017, "Attention Is All You Need") underlying all modern LLMs. Uses self-attention to process entire sequences in parallel. |
| **Vector Database** | R | A database optimized for storing and querying high-dimensional vectors (embeddings). Examples: Azure AI Search, Pinecone, Weaviate, Qdrant, pgvector. Core infrastructure for RAG. |
| **Zero-Shot** | R | Asking a model to perform a task with no examples — only instructions. Works well for capable models (GPT-4o) on common tasks. Falls back to few-shot when accuracy drops. |

:::info Didn't find your term?
The full FrootAI glossary in the MCP server covers 200+ terms. Run `npx frootai-mcp@latest` and use the `lookup_term` tool, or browse the [Learning Hub](https://frootai.dev/learning-hub).
:::

## Common Confusions

| People Say | They Actually Mean | Correct Term |
|------------|-------------------|-------------|
| "The AI understands me" | Statistical pattern matching on tokens | **Next-Token Prediction** |
| "The model remembers" | Previous turns are re-sent in the context window | **In-Context Learning** |
| "Fine-tuning the prompt" | Iterating on the system/user message text | **Prompt Engineering** |
| "Open-source model" | Weights released but license may restrict commercial use | **Open-Weight** (usually) |
| "The AI is hallucinating" | The model generated ungrounded but plausible text | **Hallucination** |
| "RAG database" | A vector store used for retrieval-augmented generation | **Vector Database** |

## Further Reading

- **[F1: GenAI Foundations](./f1-genai-foundations.md)** — deep dive on tokens, parameters, and context windows
- **[F2: LLM Landscape](./f2-llm-landscape.md)** — model families, pricing, and selection framework
- **[F4: GitHub Agentic OS](./f4-agentic-os.md)** — how agents, skills, and hooks work together

**← [F2: LLM Landscape](./f2-llm-landscape.md)** | **[F4: GitHub Agentic OS →](./f4-agentic-os.md)**
