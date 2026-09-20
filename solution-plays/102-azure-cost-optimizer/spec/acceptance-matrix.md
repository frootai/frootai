# Public Solution Acceptance Matrix

| Gate | Required evidence | Status before user run |
|---|---|---|
| Package hygiene | Validator finds no private/generated paths or producer identifiers | Must pass locally |
| Product build | Locked .NET restore/build and frontend production build | Must pass locally |
| Financial logic | Decimal, currency, basis, credits, unknowns and report parity tests | Must pass locally |
| Response layer | Desktop/mobile streaming, accessibility, artifacts and no overflow | Must pass locally |
| Infrastructure | Every Bicep file compiles | Must pass locally |
| Sample track | Sample UI and reports; zero Azure/model calls | User verifies |
| Live evidence | Authorized scope, source receipts, completeness and freshness | User-specific |
| Financial parity | Same scope/dates/Actual cost/currency/collection time compared in portal | User-specific |
| Model activation | One approved grounded response through selected provider | Optional deployment-specific |
| Foundation plan | Subscription what-if reviewed; no unexpected changes | Required before apply |
| Application plan | Resource-group what-if reviewed; immutable image digest | Required before apply |
| Hosted smoke | Health, readiness, auth, evidence, periods, reports and write refusal | Required after deploy |
| OpenAPI agent | Grounding, Advisor estimate labeling and write refusal | Optional channel |
| MCP agent | Nine read-only tools and cross-scope denial | Optional channel |
| Rollback | Previous digest and config fingerprint recorded | Required before promotion |
| Cleanup | Owner, expiry, preview and exact-name confirmation | Required decision |

## Current Source Coverage

The supplied source includes backend contracts, durable-cache tests, response-layer Playwright tests, report verification utilities, granular visual routing, grounding checks, MCP checks, and stability checks.

## Separate States

Report these independently:

- feature implementation;
- user local readiness;
- user financial parity;
- model activation;
- hosted solution readiness;
- production certification.

A sample run, health endpoint, role assignment, resource deployment, or fluent model answer cannot substitute for another state.
