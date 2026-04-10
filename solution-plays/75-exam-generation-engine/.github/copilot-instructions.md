---
description: "Exam Generation Engine domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Exam Generation Engine — Domain Knowledge

This workspace implements AI exam generation — question creation from learning materials, difficulty calibration (Bloom's taxonomy), distractor generation for MCQs, rubric creation, and item response theory (IRT) analysis.

## Exam Generation Architecture (What the Model Gets Wrong)

### Question Generation from Content
```python
class ExamQuestion(BaseModel):
    stem: str              # The question text
    type: str              # mcq, short_answer, essay, fill_blank, true_false
    difficulty: str        # remember, understand, apply, analyze, evaluate, create (Bloom's)
    correct_answer: str
    distractors: list[str] # Wrong answers for MCQ (plausible but incorrect)
    explanation: str       # Why the correct answer is right
    learning_objective: str # Which objective this tests
    points: int

async def generate_exam(content: str, config: ExamConfig) -> list[ExamQuestion]:
    # 1. Extract key concepts from learning material
    concepts = await extract_concepts(content)
    
    # 2. Generate questions across Bloom's levels
    questions = []
    for level in config.bloom_distribution:
        # e.g., {"remember": 20%, "understand": 30%, "apply": 30%, "analyze": 20%}
        q = await generate_question(concepts, bloom_level=level, type=config.question_types)
        questions.append(q)
    
    # 3. Generate plausible distractors (hardest part)
    for q in questions:
        if q.type == "mcq":
            q.distractors = await generate_distractors(q.stem, q.correct_answer, count=3)
            # Distractors must be: plausible, wrong, non-overlapping, similar length
    
    # 4. Validate: no duplicate questions, balanced difficulty, covers all objectives
    validated = await validate_exam(questions, config)
    return validated
```

### Bloom's Taxonomy Distribution
| Level | Verb Examples | Question Type | Typical % |
|-------|-------------|---------------|-----------|
| Remember | Define, list, recall | MCQ, fill blank | 10-20% |
| Understand | Explain, compare, summarize | Short answer, MCQ | 20-30% |
| Apply | Solve, use, implement | Problem-solving, MCQ | 25-30% |
| Analyze | Differentiate, examine, contrast | Essay, case study | 15-20% |
| Evaluate | Justify, critique, assess | Essay, rubric-scored | 5-10% |
| Create | Design, develop, propose | Project, open-ended | 5-10% |

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| All MCQ at "remember" level | Tests memorization, not understanding | Distribute across Bloom's taxonomy |
| Implausible distractors | "Obviously wrong" options = free points | Generate distractors from common misconceptions |
| Distractors different length | Long answer = correct (test-taking trick) | All options similar length and structure |
| No learning objective mapping | Can't prove exam covers curriculum | Map each question to specific learning objective |
| No difficulty calibration | All questions same difficulty | IRT analysis after first administration, calibrate |
| Generate from LLM training data | Questions about content not in the material | Ground generation in provided learning material only |
| No answer key validation | Correct answer may be wrong | Subject matter expert review of answer key |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | Generation model, temperature=0.5 (creative but accurate) |
| `config/guardrails.json` | Bloom's distribution, question count, difficulty targets |
| `config/agents.json` | Question types, constraint rules, validation criteria |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement question generation, distractor creation, rubrics |
| `@reviewer` | Audit question quality, Bloom's alignment, answer accuracy |
| `@tuner` | Optimize difficulty calibration, distractor plausibility, coverage |

## Slash Commands
`/deploy` — Deploy exam engine | `/test` — Generate sample exam | `/review` — Audit quality | `/evaluate` — IRT analysis on results
