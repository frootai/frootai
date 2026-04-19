# FrootAI — HuggingFace Space Specification

> Interactive MCP tool playground for exploring AI architecture decisions.

---

## Space Card Metadata

```yaml
---
title: FrootAI MCP Playground
emoji: 🧩
colorFrom: emerald
colorTo: green
sdk: gradio
sdk_version: "5.0"
app_file: app.py
pinned: true
license: mit
tags:
  - mcp
  - ai-architecture
  - agents
  - rag
  - solution-plays
  - primitives
  - fai-protocol
short_description: "Explore 45 MCP tools, 104 solution plays, and 860+ AI primitives interactively"
---
```

## Space Type

**Gradio** — chosen for its native tabbed interface, interactive API playground, and built-in sharing. Gradio supports structured inputs/outputs ideal for MCP tool exploration.

## Features

### Tab 1: Knowledge Search
Interactive search across 24 FROOT knowledge modules covering GenAI foundations, RAG patterns, agent orchestration, infrastructure, and production operations.

**Inputs:**
- Query text box (e.g., "how to reduce hallucination in RAG")
- Max results slider (1-10, default: 5)

**Outputs:**
- Matching sections with module ID, title, and content preview
- Relevance scores
- Direct links to full module content

### Tab 2: Solution Play Explorer
Browse and deep-dive into 104 production-ready AI architectures.

**Inputs:**
- Natural language description (e.g., "process invoices from PDF")
- Category filter dropdown (RAG, Agent, Voice, Document, Infrastructure, etc.)
- Top-K slider (1-5, default: 3)

**Outputs:**
- Ranked play matches with confidence scores
- Architecture summary, Azure services, and estimated cost
- Mermaid.js architecture diagram (rendered inline)
- Primitive count per play (agents, skills, instructions)

### Tab 3: Model Comparison
Side-by-side AI model comparison for specific use cases.

**Inputs:**
- Use case description (e.g., "RAG chatbot for legal documents")
- Priority selector (cost, quality, speed, context)

**Outputs:**
- Recommended model with reasoning
- Comparison table (model, context window, cost/1K tokens, strengths, weaknesses)
- Azure OpenAI deployment configuration snippet

### Tab 4: Cost Estimator
Azure cost estimation for any solution play at dev or production scale.

**Inputs:**
- Play selector dropdown (01-104)
- Scale toggle (dev / prod)

**Outputs:**
- Itemized monthly cost breakdown by Azure service
- Total monthly estimate
- Cost optimization recommendations
- Comparison between dev and prod estimates

### Tab 5: Primitive Browser
Explore the full catalog of 860+ AI primitives.

**Inputs:**
- Primitive type selector (agents, instructions, skills, hooks, plugins, workflows, cookbook)
- Search/filter text
- WAF pillar filter (reliability, security, cost, operational excellence, performance, responsible AI)

**Outputs:**
- Paginated primitive list with name, description, and WAF alignment
- Compatible solution plays for each primitive
- Download/copy primitive content

### Tab 6: FAI Protocol Playground
Interactive FAI Protocol manifest editor and validator.

**Inputs:**
- JSON editor with `fai-manifest.json` template
- Validate button

**Outputs:**
- Schema validation results (errors, warnings)
- Suggested improvements
- Resolved primitive wiring visualization

## Demo Tools (Primary 3)

These three tools are featured prominently on the Space landing page:

### 1. `search_knowledge`
```python
result = frootai.search_knowledge(
    query="best practices for chunking in RAG pipelines",
    max_results=5
)
# Returns: Matching sections from R2 (RAG), F1 (Foundations), T3 (Production)
```

### 2. `get_play_detail`
```python
result = frootai.get_play_detail(play_number="01")
# Returns: Full architecture for Enterprise RAG — services, config, eval metrics, file structure
```

### 3. `compare_models`
```python
result = frootai.compare_models(
    use_case="document extraction with structured output",
    priority="quality"
)
# Returns: Model comparison table with recommendation (GPT-4o for quality, GPT-4o-mini for cost)
```

## Technical Implementation

### Dependencies

```txt
gradio>=5.0
frootai-mcp>=5.2.0
```

### Architecture

```
huggingface-space/
├── app.py                  # Main Gradio app with 6 tabs
├── requirements.txt        # Python dependencies
├── README.md              # This file (Space card)
├── assets/
│   ├── logo.png           # FrootAI logo
│   └── banner.png         # Space banner
└── examples/
    ├── knowledge-queries.json   # Pre-filled search examples
    ├── play-descriptions.json   # Natural language play queries
    └── model-comparisons.json   # Model comparison scenarios
```

### Core App Structure

```python
import gradio as gr
from frootai_mcp import FrootAIMCP

client = FrootAIMCP()

def search_knowledge(query: str, max_results: int) -> str:
    results = client.search_knowledge(query=query, max_results=max_results)
    return format_results(results)

def get_play_detail(play_number: str) -> tuple[str, str]:
    detail = client.get_play_detail(play_number=play_number)
    diagram = client.generate_architecture_diagram(play=play_number)
    return format_play(detail), diagram

def compare_models(use_case: str, priority: str) -> str:
    result = client.compare_models(useCase=use_case, priority=priority)
    return format_comparison(result)

with gr.Blocks(title="FrootAI MCP Playground", theme=gr.themes.Soft()) as demo:
    gr.Markdown("# 🧩 FrootAI MCP Playground")
    gr.Markdown("Explore 45 MCP tools, 104 solution plays, and 860+ AI primitives")

    with gr.Tab("Knowledge Search"):
        query = gr.Textbox(label="Search Query", placeholder="e.g., reduce hallucination in RAG")
        max_results = gr.Slider(1, 10, value=5, step=1, label="Max Results")
        search_btn = gr.Button("Search", variant="primary")
        results = gr.Markdown(label="Results")
        search_btn.click(search_knowledge, [query, max_results], results)

    with gr.Tab("Play Explorer"):
        # ... play explorer UI
        pass

    with gr.Tab("Model Comparison"):
        # ... model comparison UI
        pass

    with gr.Tab("Cost Estimator"):
        # ... cost estimator UI
        pass

    with gr.Tab("Primitives"):
        # ... primitive browser UI
        pass

    with gr.Tab("FAI Protocol"):
        # ... manifest editor UI
        pass

demo.launch()
```

## Deployment

```bash
# Local testing
pip install gradio frootai-mcp
python app.py

# Deploy to HuggingFace Spaces
# 1. Create new Space at huggingface.co/new-space
# 2. Select Gradio SDK
# 3. Push this directory to the Space repo
git remote add space https://huggingface.co/spaces/frootai/mcp-playground
git push space main
```

## Key Metrics to Track

| Metric | Target | Measurement |
|--------|--------|-------------|
| Daily active users | 100+ | HF Space analytics |
| Avg session duration | 3+ minutes | Gradio analytics |
| Most-used tab | Knowledge Search | Click tracking |
| Play detail views | 500+/week | API call count |
| GitHub click-throughs | 10%+ of visitors | UTM tracking |

## Links

- **Live Space**: https://huggingface.co/spaces/frootai/mcp-playground
- **FrootAI Website**: https://frootai.dev
- **GitHub**: https://github.com/frootai/frootai
- **MCP Server**: https://www.npmjs.com/package/frootai-mcp
