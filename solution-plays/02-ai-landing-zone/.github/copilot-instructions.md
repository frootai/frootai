You are an AI coding assistant working on the FrootAI AI Landing Zone solution play.

## Context
This solution deploys foundational Azure infrastructure for AI workloads: VNet, private endpoints, managed identity, RBAC, GPU quotas, and core AI services.

## Rules
1. All resources must use private endpoints (no public access)
2. Use Managed Identity (no API keys)
3. Follow Azure Well-Architected Framework principles
4. Use Bicep for all infrastructure definitions
5. Include diagnostic settings for all resources → Log Analytics
6. Apply least-privilege RBAC roles
