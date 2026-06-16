# frootai-eval-sdk

Standard-library-only Python client for the **FrootAI Eval-as-Service API** — run eval suites, fetch datasets, manage scheduled runs, and mint CI tokens.

Mirrors [`@frootai/eval-sdk`](https://www.npmjs.com/package/@frootai/eval-sdk) (npm) and the [Eval methodology](https://frootai.dev/methodology/eval).

```bash
pip install frootai-eval-sdk
```

## Quick start

```python
import os
from frootai_eval import EvalClient

client = EvalClient(
    base_url="https://eval.api.frootai.cloud",   # default
    token=os.environ["FROOTAI_EVAL_TOKEN"],
)

run = client.create_run(
    manifest_slug="01-enterprise-rag",
    suite="groundedness-v1",
    output="Refunds are processed within 30 business days.",
    context="Our policy: refunds within 30 days of purchase.",
)

for m in run.results:
    print(m.metric, m.score, "PASS" if m.passed else "FAIL")
print("regressed:", run.regressed)
```

## API

| Method | Endpoint | Returns |
|---|---|---|
| `create_run(manifest_slug, suite, output, ...)` | `POST /v1/eval/runs` | `EvalRun` |
| `get_run(run_id)` | `GET /v1/eval/runs/{id}` | `EvalRun` |
| `get_dataset(slug)` | `GET /v1/eval/datasets/{slug}` | `Dataset` |
| `create_schedule(manifest_slug, suite, cron)` | `POST /v1/eval/schedules` | `Schedule` |
| `list_schedules()` | `GET /v1/eval/schedules` | `list[Schedule]` |
| `delete_schedule(schedule_id)` | `DELETE /v1/eval/schedules/{id}` | `None` |
| `mint_ci_token(label, expires_in_days)` | `POST /v1/eval/api/ci-token` | `CiToken` |
| `health()` | `GET /health` | `Health` |

## Errors

All failures raise `EvalApiError` with `.status` and `.body`:

```python
from frootai_eval import EvalApiError

try:
    client.get_run("nope")
except EvalApiError as e:
    if e.status == 404:
        ...  # not found (or cross-tenant access blocked)
```

## License

MIT © FrootAI. The eval methodology, judge prompts, and dataset schemas are all open — see [frootai.dev/methodology/eval](https://frootai.dev/methodology/eval).
