---
description: "pytest testing standards — fixtures, parametrize, coverage, and mock patterns for Python."
applyTo: "**/test_*.py, **/*_test.py"
waf:
  - "reliability"
---

# pytest — FAI Standards

## Test Discovery & Naming

Files must match `test_*.py` or `*_test.py`. Classes start with `Test` (no `__init__`). Functions start with `test_`.

```
tests/
├── unit/
│   ├── test_models.py
│   └── test_services.py
├── integration/
│   └── test_api_endpoints.py
├── e2e/
│   └── test_workflows.py
└── conftest.py            # shared fixtures
```

## Fixtures

```python
import pytest

@pytest.fixture
def db_session():
    session = create_session()
    yield session
    session.rollback()
    session.close()

@pytest.fixture(scope="module")
def api_client(db_session):
    return TestClient(app)

# autouse — applies to every test in scope
@pytest.fixture(autouse=True)
def reset_caches():
    cache.clear()
    yield
    cache.clear()
```

### Fixture Factories

```python
@pytest.fixture
def make_user(db_session):
    created = []
    def _make(name="default", role="viewer"):
        user = User(name=name, role=role)
        db_session.add(user)
        db_session.flush()
        created.append(user)
        return user
    yield _make
    for u in created:
        db_session.delete(u)

def test_admin_access(make_user):
    admin = make_user(name="alice", role="admin")
    assert admin.can_access("/settings")
```

### conftest Hierarchy

Place fixtures at the narrowest scope. `conftest.py` in `tests/` is shared across all tests. `tests/unit/conftest.py` only applies to unit tests. pytest merges them automatically — no imports needed.

## Parametrize

```python
@pytest.mark.parametrize("input_val,expected", [
    ("hello", 5),
    ("", 0),
    ("café", 4),
])
def test_string_length(input_val, expected):
    assert len(input_val) == expected

# stacked parametrize = cartesian product
@pytest.mark.parametrize("x", [1, 2])
@pytest.mark.parametrize("y", [10, 20])
def test_multiply(x, y):
    assert x * y > 0
```

## Markers

```python
@pytest.mark.slow
def test_full_reindex():
    reindex_all()

@pytest.mark.skip(reason="upstream bug #1234")
def test_broken_feature(): ...

@pytest.mark.xfail(raises=ValueError, strict=True)
def test_invalid_input():
    parse("bad data")
```

Register custom markers in `pyproject.toml` to silence warnings:

```toml
[tool.pytest.ini_options]
markers = [
    "slow: marks tests as slow (deselect with '-m not slow')",
    "integration: requires external services",
]
```

## Monkeypatch

```python
def test_api_call(monkeypatch):
    monkeypatch.setenv("API_KEY", "test-key-123")
    monkeypatch.setattr("myapp.client.requests.get", lambda *a, **kw: MockResponse(200))
    result = myapp.client.fetch_data()
    assert result["status"] == "ok"

def test_config_missing(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(ConfigError):
        load_config()
```

## tmp_path & capsys

```python
def test_export_csv(tmp_path):
    out = tmp_path / "report.csv"
    export(out, data=[{"a": 1}])
    assert out.read_text().startswith("a\n1")

def test_logging_output(capsys):
    process_item(42)
    captured = capsys.readouterr()
    assert "processed 42" in captured.out
    assert captured.err == ""
```

## Assertions

Use plain `assert` — pytest rewrites the AST to show diffs on failure. Never use `self.assertEqual`.

```python
def test_response():
    data = get_response()
    assert data["count"] == 3               # shows actual vs expected
    assert "error" not in data              # shows dict contents
    assert all(v > 0 for v in data["ids"])  # shows failing element
```

## Coverage (pytest-cov)

```bash
pytest --cov=src --cov-report=term-missing --cov-fail-under=80
```

```toml
[tool.coverage.run]
branch = true
source = ["src"]
omit = ["*/migrations/*", "*/conftest.py"]
```

## Async Tests (pytest-asyncio)

```python
import pytest

@pytest.mark.asyncio
async def test_async_fetch(httpx_mock):
    httpx_mock.add_response(json={"ok": True})
    result = await fetch_data("https://api.example.com/v1")
    assert result["ok"] is True
```

## Custom Plugins

```python
# conftest.py — local plugin
def pytest_collection_modifyitems(items):
    for item in items:
        if "integration" in str(item.fspath):
            item.add_marker(pytest.mark.integration)
```

## pyproject.toml Config

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-ra -q --strict-markers"
filterwarnings = ["error", "ignore::DeprecationWarning:third_party"]
```

## Anti-Patterns

| Anti-Pattern | Fix |
|---|---|
| `self.assertEqual(a, b)` in pytest | Plain `assert a == b` — pytest rewrites for diffs |
| Global mutable state between tests | Use fixtures with proper teardown via `yield` |
| `scope="session"` fixture mutating data | Keep mutating fixtures at `function` scope |
| Importing fixtures manually | Place in `conftest.py` — auto-discovered |
| Hardcoded `/tmp/test_file` paths | Use `tmp_path` fixture — unique per test |
| Mocking with `unittest.mock.patch` everywhere | Prefer `monkeypatch` — lighter, auto-reverted |
| No markers on slow tests | Add `@pytest.mark.slow` + run `-m "not slow"` in CI fast lane |
| Tests depend on execution order | Each test must be independent — use fixtures for setup |

## WAF Alignment

| Pillar | Practice |
|---|---|
| **Reliability** | Fixture teardown via `yield`, strict markers, `--strict-config` |
| **Security** | `monkeypatch.setenv` for secrets — never hardcode in tests |
| **Cost Optimization** | Marker-based `-m "not slow"` for fast CI feedback loops |
| **Operational Excellence** | `--cov-fail-under` in CI, `pyproject.toml` as single config source |
| **Performance Efficiency** | `scope="session"` for expensive setup, `tmp_path` over disk I/O |
| **Responsible AI** | Deterministic seeds in parametrize, snapshot-based output validation |