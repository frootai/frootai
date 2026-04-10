---
description: "AI Tutoring Agent domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# AI Tutoring Agent — Domain Knowledge

This workspace implements an AI tutoring agent — Socratic questioning, adaptive difficulty, knowledge state tracking, misconception detection, and personalized learning with multi-turn pedagogical conversations.

## Tutoring AI Architecture (What the Model Gets Wrong)

### Socratic Method (Not Direct Answers)
```python
TUTOR_PROMPT = """You are a Socratic tutor. NEVER give the direct answer. Instead:
1. Ask a guiding question that leads the student toward understanding
2. If the student is stuck, give a hint (not the answer)
3. If the student gives a wrong answer, identify the misconception and address it
4. Only after 3 failed attempts, explain the concept step-by-step
5. Always end with a check: "Can you explain this in your own words?"

Student's current knowledge state: {knowledge_state}
Current topic: {topic}
Difficulty level: {difficulty}"""

async def tutor_response(student_msg: str, session: TutoringSession) -> str:
    # 1. Classify student's response
    classification = await classify_response(student_msg)
    # correct, partially_correct, misconception, question, off_topic
    
    # 2. Update knowledge state
    session.update_knowledge(classification)
    
    # 3. Adjust difficulty
    if classification == "correct" and session.streak >= 3:
        session.increase_difficulty()
    elif classification == "misconception":
        session.decrease_difficulty()
        session.flag_misconception(classification.misconception_type)
    
    # 4. Generate Socratic response
    return await generate_response(student_msg, session, TUTOR_PROMPT)
```

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Give direct answers | Student doesn't learn to think | Socratic method: questions → hints → explanation |
| Same difficulty for all | Bored advanced students, frustrated beginners | Adaptive difficulty based on performance |
| No misconception tracking | Same mistake repeats across sessions | Detect + track misconceptions, return to them |
| No knowledge state | Each session starts fresh | Persistent learner profile with topic mastery levels |
| Generic responses | "Good job!" without substance | Specific feedback referencing the student's reasoning |
| No difficulty curve | Random topic jumping | Prerequisites → fundamentals → advanced (scaffold) |
| Ignore emotional state | Frustrated student → give up | Detect frustration (repeated wrong, short answers) → encourage |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | Tutor model, temperature=0.5 (warm but accurate) |
| `config/guardrails.json` | Difficulty ranges, hint-before-answer count, content safety |
| `config/agents.json` | Subject areas, prerequisite graph, assessment criteria |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement tutoring logic, knowledge tracking, Socratic prompts |
| `@reviewer` | Audit pedagogical quality, misconception handling, safety |
| `@tuner` | Optimize difficulty curves, hint quality, engagement metrics |

## Slash Commands
`/deploy` — Deploy tutor | `/test` — Test with sample conversation | `/review` — Audit pedagogy | `/evaluate` — Measure learning outcomes
