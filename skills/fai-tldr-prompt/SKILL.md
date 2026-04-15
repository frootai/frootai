---
name: fai-tldr-prompt
description: |
  Generate concise TL;DR summaries from long documents, code reviews,
  or conversation threads. Use when condensing lengthy content into
  actionable summaries.
---

# TL;DR Summary Generator

Generate concise, actionable summaries from long content.

## When to Use

- Summarizing long documents or reports
- Creating executive summaries from technical content
- Condensing PR reviews or discussion threads
- Generating meeting notes from transcripts

---

## Summary Prompts by Type

### Document Summary

```python
def summarize_document(text: str, max_bullets: int = 5) -> str:
    return llm(f"""Summarize in {max_bullets} bullet points.
Rules:
- Each bullet is one clear sentence
- Focus on decisions, actions, and key facts
- Skip background and filler
- Include numbers and specifics where available

Document:
{text}""")
```

### Code Review Summary

```python
def summarize_pr_review(comments: list[dict]) -> str:
    formatted = "\n".join(f"- [{c['severity']}] {c['file']}:{c['line']}: {c['comment']}"
                          for c in comments)
    return llm(f"""Summarize this code review in 3-5 bullets.
Group by: blocking issues, improvements, positive feedback.

Comments:
{formatted}""")
```

### Thread Summary

```python
def summarize_thread(messages: list[dict]) -> str:
    formatted = "\n".join(f"{m['author']}: {m['content']}" for m in messages)
    return llm(f"""Summarize this discussion thread.
Output:
- Decision: [what was decided]
- Action items: [who does what by when]
- Open questions: [unresolved items]

Thread:
{formatted}""")
```

## Summary Quality Checklist

| Check | Requirement |
|-------|-------------|
| Length | 3-5 bullets for short docs, 5-10 for long |
| Specifics | Numbers, names, dates — not vague |
| Actionable | Reader knows what to do next |
| Accurate | No hallucinated details |
| Self-contained | Makes sense without reading original |

## Output Formats

| Format | Template |
|--------|---------|
| Bullet | - Key point 1\n- Key point 2 |
| Executive | ## Summary\n[paragraph]\n## Actions\n[list] |
| One-liner | "[Subject] — [key decision] — [next step]" |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Summary too vague | No specifics rule | Add "include numbers and names" |
| Important detail missed | Content too long | Chunk and summarize sections, then merge |
| Hallucinated facts | Model fills gaps | Add "only include facts from the document" |
| Too long | No length constraint | Set explicit bullet count limit |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Always include grounding rules | Prevents hallucination |
| Set explicit output format | Consistent, parseable responses |
| Use temperature 0-0.3 for factual tasks | Reduces randomness |
| Add few-shot examples for complex formats | Shows model the expected pattern |
| Test prompts with evaluation dataset | Measure quality objectively |
| Version control all prompts | Track changes, enable rollback |

## Prompt Quality Checklist

- [ ] Role clearly defined
- [ ] Output format specified (JSON schema, markdown, etc.)
- [ ] Grounding rule: "Answer ONLY from context"
- [ ] Safety rules: refuse harmful content
- [ ] Length constraint specified
- [ ] Few-shot examples for complex tasks
- [ ] Tested against evaluation dataset

## Related Skills

- `fai-prompt-builder` — Structured prompt construction
- `fai-boost-prompt` — Interactive prompt refinement
- `fai-basic-prompt-optimization` — Prompt quality patterns
- `fai-finalize-agent-prompt` — Production prompt validation
