# @frootai/eval-sdk

Typed, zero-dependency client for the **FrootAI Eval-as-Service API** — run eval suites, fetch datasets, manage scheduled runs, and mint CI tokens.

Mirrors the [Eval methodology](https://frootai.dev/methodology/eval) and the public OpenAPI spec. Works in Node 18+, edge runtimes, and browsers.

```bash
npm install @frootai/eval-sdk
```

## Quick start

```ts
import { EvalClient } from "@frootai/eval-sdk";

const eval = new EvalClient({
  baseUrl: "https://eval.api.frootai.cloud", // default
  token: process.env.FROOTAI_EVAL_TOKEN,     // or pass directly
});

// Run an eval suite against an agent output
const run = await eval.createRun({
  manifestSlug: "01-enterprise-rag",
  suite: "groundedness-v1",
  output: "Refunds are processed within 30 business days.",
  context: "Our policy: refunds within 30 days of purchase.",
});

console.log(run.results);     // [{ metric: "groundedness", score: 0.94, passed: true, ... }]
console.log(run.regressed);   // false
```

## API

| Method | Endpoint | Returns |
|---|---|---|
| `createRun(req)` | `POST /v1/eval/runs` | `EvalRun` |
| `getRun(id)` | `GET /v1/eval/runs/{id}` | `EvalRun` |
| `getDataset(slug)` | `GET /v1/eval/datasets/{slug}` | `Dataset` |
| `createSchedule(req)` | `POST /v1/eval/schedules` | `Schedule` |
| `listSchedules()` | `GET /v1/eval/schedules` | `Schedule[]` |
| `deleteSchedule(id)` | `DELETE /v1/eval/schedules/{id}` | `void` |
| `mintCiToken(opts)` | `POST /v1/eval/api/ci-token` | `CiToken` |
| `health()` | `GET /health` | `Health` |

## CI usage

Mint a scoped token once, then use it in CI:

```ts
const { token } = await eval.mintCiToken({ label: "GitHub Actions — main" });
// set token as the FROOTAI_EVAL_TOKEN secret in your CI provider
```

Or use the [`frootai/eval-action`](https://github.com/frootai/frootai/tree/main/eval-action) GitHub Action, which wraps this SDK.

## Errors

All failures throw `EvalApiError` with `.status` and `.body`:

```ts
import { EvalApiError } from "@frootai/eval-sdk";

try {
  await eval.getRun("nope");
} catch (e) {
  if (e instanceof EvalApiError && e.status === 404) {
    // not found (or cross-tenant access blocked)
  }
}
```

## License

MIT © FrootAI. The eval methodology, judge prompts, and dataset schemas are all open — see [frootai.dev/methodology/eval](https://frootai.dev/methodology/eval).
