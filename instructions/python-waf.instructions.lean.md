---
description: "Python coding standards aligned with Azure Well-Architected Framework pillars — secure credential handling, async patterns, structured error handling, cost-aware AI integration, and production-ready testing."
applyTo: "**/*.py, **/pyproject.toml, **/requirements.txt"
waf:
  - "security"
  - "reliability"
  - "cost-optimization"
  - "performance-efficiency"
---

# Python — FAI Standards

When writing or reviewing Python code in FAI projects, enforce these standards.

## Security (WAF: Security Pillar)

- NEVER hardcode secrets, API keys, connection strings, or tokens in Python files
- Use `os.environ` or `azure.identity.DefaultAzureCredential` for all credentials
- Use `python-dotenv` only in development — production uses Managed Identity or Key Vault
- Validate all external input with Pydantic models or explicit type checks at system boundaries
- Use `secrets` module for generating tokens, not `random`
- Pin all dependency versions in `requirements.txt` or `pyproject.toml` — no floating versions
- Run `pip audit` or `safety check` as part of CI

## Reliability (WAF: Reliability Pillar)

- Use `tenacity` for retry logic with exponential backoff on external API calls
- Set explicit timeouts on ALL HTTP calls: `httpx.AsyncClient(timeout=30.0)`
- Implement circuit breaker patterns for Azure OpenAI and AI Search calls
- Use structured logging (`structlog` or `logging` with JSON formatter) — never bare `print()`
- Handle specific exceptions, not bare `except:` — catch `httpx.TimeoutException`, `openai.RateLimitError`, etc.
- Add health check endpoints for FastAPI/Flask services: `/health` returning `{"status": "ok"}`

## Cost Optimization (WAF: Cost Pillar)

- Use `max_tokens` parameter on all OpenAI API calls — never allow unbounded generation
- Implement model routing: `gpt-4o-mini` for classification/simple tasks, `gpt-4o` for complex reasoning
- Cache AI responses using TTL-based caching (`cachetools`, Redis, or Azure Cache)
- Batch embedding calls: `openai.embeddings.create(input=[list_of_texts])` not one-by-one
- Monitor token usage: log `usage.total_tokens` from every API response
- Use `async` for I/O-bound operations — do not block on sequential API calls

## Performance (WAF: Performance Pillar)

- Use `async`/`await` for all I/O operations (HTTP, database, file)
- Prefer `httpx.AsyncClient` over `requests` for async HTTP
- Use connection pooling for database connections (`asyncpg`, `sqlalchemy` async)
- Stream large LLM responses: `openai.chat.completions.create(stream=True)`
- Use `asyncio.gather()` for concurrent independent operations
- Profile before optimizing — use `cProfile` or `py-spy`, not intuition

## Code Quality

- Type hints on all function signatures — `def process(query: str, limit: int = 10) -> list[dict]:`
- Use Pydantic `BaseModel` for data classes, not raw dicts
- Follow PEP 8 naming: `snake_case` for variables/functions, `PascalCase` for classes
- Maximum function length: 30 lines. Extract helper functions for readability
- Docstrings on public functions (Google style): parameters, returns, raises
- Use `pathlib.Path` instead of `os.path` for file operations

## Testing

- Use `pytest` as the test runner — not `unittest`
- Minimum 80% code coverage for AI pipeline code
- Mock external services in unit tests: `pytest-httpx` for HTTP, `unittest.mock` for SDK calls
- Test edge cases: empty input, rate limit responses, timeout scenarios, malformed AI output
- Use `pytest.mark.parametrize` for testing multiple input variations

## Project Structure

```
project/
├── src/
│   ├── __init__.py
│   ├── main.py           # Entry point
│   ├── config.py          # Settings via pydantic-settings
│   ├── models/            # Pydantic models
│   ├── services/          # Business logic
│   └── utils/             # Shared utilities
├── tests/
│   ├── conftest.py        # Shared fixtures
│   ├── test_services/
│   └── test_utils/
├── pyproject.toml         # Dependencies + tool config
└── .env.example           # Template (never .env in git)
```
