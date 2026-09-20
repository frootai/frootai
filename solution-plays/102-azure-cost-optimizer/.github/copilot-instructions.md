# Azure Cost Optimizer

Azure Cost Optimizer is the product. Azure Cost Intelligence is its deterministic evidence, analysis, reporting, storage, and observability stack. ACO is one Microsoft Agent Framework supervisor over eight typed read-only tools. MCP exposes nine read-only tools over the same engine.

## User Workflow

- Start with `AzureCostOptimizerGuide.md` and `spec/solution-delivery-contract.v1.json`.
- Ask setup questions one at a time. Explain each choice briefly.
- Default to sample mode, cost-only, Entra-authenticated hosting, zero scheduled refresh, and no cloud writes.
- Stop before Azure reads, resource creation, role assignment, model deployment, paid inference, public access, deployment, rollback, or deletion.
- Pass the selected subscription explicitly. Never change the global Azure CLI default.
- Treat organization tags such as `SecurityControl` as user-supplied policy metadata, never a security bypass.

## Financial Truth

- Money uses decimal values with explicit currency and billed/effective basis.
- Missing or incomplete evidence is unknown, not zero.
- Preserve credits, refunds, purchases, taxes, and subscription-scoped costs.
- Azure Advisor savings are estimates that can overlap. They are not approved targets or realized savings.
- Compare portal parity only with the same subscription, dates, Actual cost basis, currency, and collection time.

## Runtime Truth

- One .NET 10 ASP.NET Core process serves the React 19 frontend from `wwwroot`.
- Evidence sources are Cost Management Query, selected Cost Details, Cost Exports, Advisor, and Resource Graph.
- Hosted state uses Blob content plus a Cosmos scope-partitioned revision pointer.
- Azure Monitor OpenTelemetry activates only when configured.
- Thorough answers allow six model/tool rounds; fast answers allow three. Output is bounded and validated.
- Five checked sections are Answer, Evidence, Data health, Risks, and Next action.
- Semantic answer cache is optional, principal-partitioned, tied to the evidence revision, and revalidated before replay.
- Ordinary dashboard/chart/table interactions make zero Azure and model calls.

## Security Boundary

- The product is read-only and refuses mutation or commitment purchase requests.
- Use managed identity and least privilege. Never commit secrets or private IDs.
- Deploy images by digest and Bicep in Incremental mode after what-if.
- Public-anonymous access is an explicit time-bounded demo exception, never the default or a production claim.
- Do not claim production certification, private networking, HA, DR, compliance, or realized savings from this solution.

## Validation

Run `npm run validate` before public packaging or canonical Play 102 synchronization. Report feature implementation, user readiness, financial parity, model activation, hosted readiness, and production certification separately.
