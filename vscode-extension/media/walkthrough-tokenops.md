# TokenOps: evidence-first AI FinOps

TokenOps is included in the FrootAI VS Code extension and works locally without a hosted backend.

- **Preview** counts visible input and produces low/base/high planning ranges.
- **Tools** inventories registered tools and labels likely-tool output as an explainable scenario—not observed routing.
- **Reconcile** accepts real provider, gateway, or instrumented MCP receipts and compares them with a correlated estimate.
- **FinOps** summarizes observed cost, budgets, forecasts, chargeback, value attribution, and evidence-backed recommendations.
- **Access** optionally retrieves supported GitHub organization reports. Hidden Copilot IDE context remains unavailable.

TokenOps never upgrades an estimate into an observation. Prompt text, source code, tool arguments, and tool result payloads are not persisted.

[Open TokenOps](command:frootai.tokenOps.openDashboard) · [Save an intentionally invalid receipt template](command:frootai.tokenOps.saveReceiptTemplate) · [Open settings](command:workbench.action.openSettings?%5B%22frootai.tokenOps%22%5D)

After replacing every template placeholder with real evidence, import it from **FrootAI: TokenOps — Import Usage Receipt**. Export or permanently clear the current workspace/repository data from the Command Palette at any time.
