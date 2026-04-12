---
name: "deploy-exam-generation-engine"
description: "Deploy Exam Generation Engine — question creation from learning materials, Bloom's taxonomy distribution, MCQ distractor generation, rubric creation, IRT calibration."
---

# Deploy Exam Generation Engine

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- Learning materials (PDF, DOCX, or structured content)
- Python 3.11+ with `azure-openai`, `pyirt` (Item Response Theory)

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-exam-engine \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure OpenAI | Question + distractor generation (gpt-4o) | S0 |
| Azure AI Search | Learning material indexing + retrieval | Basic |
| Azure Document Intelligence | Extract text from PDF/DOCX materials | S0 |
| Cosmos DB | Question bank, exam records, IRT parameters | Serverless |
| Azure Storage | Source materials + generated exam PDFs | Standard LRS |
| Container Apps | Exam generation API | Consumption |
| Azure Key Vault | API keys | Standard |

## Step 2: Ingest Learning Materials

```python
# Extract content from learning materials
from azure.ai.documentintelligence import DocumentIntelligenceClient

async def ingest_materials(file_paths: list[str]) -> list[ContentChunk]:
    """Extract and chunk learning materials for question generation."""
    chunks = []
    for path in file_paths:
        # Extract text preserving structure (headings, tables, formulas)
        result = await doc_client.begin_analyze_document(
            "prebuilt-layout", document=open(path, "rb")
        )
        
        # Chunk by section (heading-based), not fixed-size
        sections = extract_sections(result)
        for section in sections:
            chunks.append(ContentChunk(
                text=section.text,
                heading=section.heading,
                source=path,
                page_numbers=section.pages,
                learning_objectives=extract_objectives(section)
            ))
    
    # Index into AI Search for retrieval during generation
    await index_chunks(chunks, index_name="learning-materials")
    return chunks
```

## Step 3: Deploy Question Generator

```python
QUESTION_TYPES = {
    "mcq": {
        "template": "Generate a multiple-choice question with 4 options (1 correct, 3 distractors)",
        "constraints": [
            "All options similar length (±20% characters)",
            "Distractors from common misconceptions, not obviously wrong",
            "Correct answer position randomized",
            "No 'all of the above' or 'none of the above'"
        ]
    },
    "short_answer": {
        "template": "Generate a question requiring a 1-3 sentence answer",
        "constraints": ["Clear expected answer length", "Include rubric criteria"]
    },
    "essay": {
        "template": "Generate an essay question with detailed rubric",
        "constraints": ["Multiple valid approaches", "Point distribution in rubric"]
    },
    "fill_blank": {
        "template": "Generate a fill-in-the-blank from key concept sentences",
        "constraints": ["Blank is a key term, not a trivial word"]
    },
    "true_false": {
        "template": "Generate a true/false statement with explanation",
        "constraints": ["Statement must be unambiguously true or false", "Include explanation"]
    }
}

BLOOM_TAXONOMY = {
    "remember": {"verbs": ["define", "list", "recall", "identify"], "weight": 0.15},
    "understand": {"verbs": ["explain", "compare", "summarize", "describe"], "weight": 0.25},
    "apply": {"verbs": ["solve", "use", "implement", "demonstrate"], "weight": 0.30},
    "analyze": {"verbs": ["differentiate", "examine", "contrast", "organize"], "weight": 0.20},
    "evaluate": {"verbs": ["justify", "critique", "assess", "recommend"], "weight": 0.07},
    "create": {"verbs": ["design", "develop", "propose", "construct"], "weight": 0.03}
}
```

## Step 4: Deploy Distractor Generator

```python
async def generate_distractors(stem: str, correct: str, content: str, count: int = 3) -> list[str]:
    """Generate plausible MCQ distractors from common misconceptions."""
    prompt = f"""Generate {count} wrong answers (distractors) for this question.

Question: {stem}
Correct answer: {correct}
Source content: {content}

Distractor rules:
1. Each distractor must be PLAUSIBLE — a student with partial knowledge might choose it
2. Base distractors on COMMON MISCONCEPTIONS for this topic
3. All distractors must be similar LENGTH to the correct answer (±20% characters)
4. No overlap between distractors (each tests a different misconception)
5. No distractors that are partially correct
6. No "obviously wrong" distractors (no jokes, no absurd answers)

Return JSON array of {count} distractors with misconception_type for each."""
    
    result = await openai.chat.completions.create(
        model="gpt-4o", temperature=0.5, response_format={"type": "json_object"},
        messages=[{"role": "system", "content": prompt}]
    )
    return parse_distractors(result)
```

## Step 5: Deploy Rubric Generator

```python
async def generate_rubric(question: ExamQuestion) -> Rubric:
    """Generate scoring rubric for essay/short-answer questions."""
    RUBRIC_TEMPLATE = {
        "criteria": [
            {"name": "content_accuracy", "weight": 0.40, "levels": 4},
            {"name": "completeness", "weight": 0.25, "levels": 4},
            {"name": "reasoning_quality", "weight": 0.25, "levels": 4},
            {"name": "clarity", "weight": 0.10, "levels": 4}
        ],
        "levels": ["excellent", "proficient", "developing", "beginning"]
    }
    # Generate level descriptors grounded in the question content
    return await create_rubric(question, RUBRIC_TEMPLATE)
```

## Step 6: Configure Exam Assembly

```json
// config/agents.json — exam configuration
{
  "exam_assembly": {
    "default_question_count": 30,
    "bloom_distribution": {
      "remember": 0.15, "understand": 0.25, "apply": 0.30,
      "analyze": 0.20, "evaluate": 0.07, "create": 0.03
    },
    "question_type_mix": {
      "mcq": 0.50, "short_answer": 0.25, "essay": 0.15, "true_false": 0.10
    },
    "time_per_question_min": {"mcq": 1.5, "short_answer": 3, "essay": 15, "true_false": 1},
    "no_duplicate_concepts": true,
    "learning_objective_coverage": 1.0,
    "output_formats": ["pdf", "json", "qti"]
  }
}
```

## Step 7: Smoke Test

```bash
# Generate exam from uploaded material
curl -s https://api-exam.azurewebsites.net/api/generate \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"material_id": "algebra-101", "question_count": 10, "bloom_distribution": "default"}' | jq '.questions[:2]'

# Validate question quality
curl -s https://api-exam.azurewebsites.net/api/validate \
  -H "Authorization: Bearer $TOKEN" \
  -d @evaluation/data/sample_exam.json | jq '.validation'

# Export as PDF
curl -s https://api-exam.azurewebsites.net/api/export/pdf \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"exam_id": "..."}' -o exam-output.pdf
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Questions not grounded in material | LLM using training data | Enforce RAG: retrieve→generate, block ungrounded |
| Distractors obviously wrong | Temperature too low, no misconception grounding | Use misconception database, increase temperature |
| All questions same difficulty | No Bloom's distribution enforcement | Validate Bloom's level with classifier post-generation |
| Answer key has errors | LLM hallucinated correct answer | SME review pipeline, fact-check against source |
| Duplicate concepts tested | No deduplication | Track tested concepts, skip duplicates |
