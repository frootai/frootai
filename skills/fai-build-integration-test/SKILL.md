---
name: fai-build-integration-test
description: |
  Create integration tests with service contracts, seeded fixtures, deterministic
  assertions, and CI-friendly test isolation. Use when testing API endpoints,
  database interactions, or multi-service workflows.
---

# Integration Test Patterns

Build reliable integration tests with fixtures, isolation, and deterministic assertions.

## When to Use

- Testing API endpoints against real or emulated services
- Validating database operations with seeded test data
- Testing multi-service interactions (API -> Queue -> Worker)
- Running tests in CI with isolated environments

---

## Python: FastAPI Integration Test

```python
import pytest
from httpx import AsyncClient, ASGITransport
from main import app

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

@pytest.mark.asyncio
async def test_create_and_get(client):
    resp = await client.post("/items", json={"name": "Test", "category": "test"})
    assert resp.status_code == 201
    item_id = resp.json()["id"]
    resp = await client.get(f"/items/{item_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Test"
```

## .NET: WebApplicationFactory

```csharp
public class ApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    public ApiTests(WebApplicationFactory<Program> factory) =>
        _client = factory.CreateClient();

    [Fact]
    public async Task CreateItem_Returns201()
    {
        var resp = await _client.PostAsJsonAsync("/items",
            new { Name = "Test", Category = "test" });
        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
    }
}
```

## Database Fixture with Rollback

```python
@pytest.fixture
async def db():
    async with engine.begin() as conn:
        session = AsyncSession(bind=conn)
        yield session
        await conn.rollback()
```

## Test Isolation Patterns

| Pattern | How | When |
|---------|-----|------|
| Transaction rollback | Wrap in txn, rollback after | DB tests |
| Testcontainers | Programmatic containers | Local + CI |
| Docker Compose services | Spin up deps per CI run | Multi-service |
| Mock external APIs | responses/respx library | External APIs |

## CI Configuration

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: test }
        ports: ["5432:5432"]
    steps:
      - uses: actions/checkout@v4
      - run: pytest tests/integration/ -v
        env: { DATABASE_URL: "postgresql://postgres:test@localhost/postgres" }
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Flaky tests | Shared state | Use transaction rollback or fresh containers |
| Slow CI | Starting services per test | Use services block or Testcontainers reuse |
| Auth failures | Missing test credentials | Mock auth middleware in test |
| Port conflicts | Same runner, same port | Use dynamic ports or Docker networks |
