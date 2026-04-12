// Play 101 — Pester Test Development
// Infrastructure: Minimal — no Azure AI services required
// This play runs locally in PowerShell with Pester 5.x
// Optional: Azure DevOps pipeline + Azure Storage for test artifacts

// If CI/CD artifact storage is needed:
// - Azure Storage Account (Standard LRS) for test reports
// - Azure DevOps Service Connection for pipeline integration

// No Bicep template needed — deploy via:
// 1. Install-Module Pester -MinimumVersion 5.0
// 2. Invoke-Pester -Configuration $config -CodeCoverage
// 3. Publish results to Azure DevOps / GitHub Actions
