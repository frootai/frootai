---
name: fai-azure-role-selector
description: |
  Select least-privilege Azure RBAC roles by mapping required actions to built-in roles.
  Use when assigning permissions to Managed Identities, service principals, or users
  for AI workloads.
---

# Azure RBAC Role Selector

Find the right Azure role by mapping required actions to least-privilege built-in roles.

## When to Use

- Assigning RBAC to a Managed Identity for a new service
- Reviewing existing role assignments for over-privilege
- Choosing between built-in roles for Cognitive Services, Storage, etc.
- Creating custom roles when no built-in role fits

---

## Common AI Workload Role Map

| Service | Action Needed | Least-Privilege Role | Role ID |
|---------|--------------|---------------------|---------|
| Azure OpenAI | Call completions/embeddings | Cognitive Services OpenAI User | `5e0bd9bd-...` |
| Azure OpenAI | Deploy models | Cognitive Services OpenAI Contributor | `a001fd3d-...` |
| AI Search | Query index | Search Index Data Reader | `1407120a-...` |
| AI Search | Write index data | Search Index Data Contributor | `8eded1b1-...` |
| Storage | Read blobs | Storage Blob Data Reader | `2a2b9908-...` |
| Storage | Write blobs | Storage Blob Data Contributor | `ba92f5b4-...` |
| Key Vault | Read secrets | Key Vault Secrets User | `4633458b-...` |
| App Config | Read config | App Configuration Data Reader | `516239f1-...` |
| Cosmos DB | Read/write data | Cosmos DB Built-in Data Contributor | `00000000-...` |

## CLI: Find Matching Roles

```bash
# List roles that include a specific action
az role definition list \
  --query "[?contains(permissions[0].actions, 'Microsoft.CognitiveServices/accounts/deployments/read')].{Name:roleName, Id:name}" \
  -o table

# Check what permissions a role grants
az role definition list --name "Cognitive Services OpenAI User" \
  --query "[0].permissions[0].{Actions:actions, DataActions:dataActions}" -o json
```

## Assign with Bicep

```bicep
var roles = {
  cognitiveServicesOpenAIUser: '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'
  storageBlobDataReader: '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1'
  keyVaultSecretsUser: '4633458b-17de-408a-b874-0445c86b69e6'
}

resource openAIRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(openAI.id, appIdentity.id, roles.cognitiveServicesOpenAIUser)
  scope: openAI
  properties: {
    principalId: appIdentity.properties.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.cognitiveServicesOpenAIUser)
    principalType: 'ServicePrincipal'
  }
}
```

## Audit Existing Assignments

```bash
# Find over-privileged assignments (Contributor/Owner on broad scope)
az role assignment list --scope /subscriptions/$SUB \
  --query "[?roleDefinitionName=='Contributor' || roleDefinitionName=='Owner'].{Principal:principalName, Role:roleDefinitionName, Scope:scope}" \
  -o table
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Over-privileged identity | Using Contributor when User role suffices | Map actions to narrowest built-in role |
| 403 after role assignment | Role propagation delay (up to 5 min) | Wait and retry; check scope matches |
| No built-in role fits | Unique combination of actions | Create custom role definition |
| Can't find data-plane role | Only searching control-plane roles | Check dataActions, not just actions |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Start simple, add complexity when needed | Avoid over-engineering |
| Automate repetitive tasks | Consistency and speed |
| Document decisions and tradeoffs | Future reference for the team |
| Validate with real data | Don't rely on synthetic tests alone |
| Review with peers | Fresh eyes catch blind spots |
| Iterate based on feedback | First version is never perfect |

## Quality Checklist

- [ ] Requirements clearly defined
- [ ] Implementation follows project conventions
- [ ] Tests cover happy path and error paths
- [ ] Documentation updated
- [ ] Peer reviewed
- [ ] Validated in staging environment

## Related Skills

- `fai-implementation-plan-generator` — Planning and milestones
- `fai-review-and-refactor` — Code review patterns
- `fai-quality-playbook` — Engineering quality standards
