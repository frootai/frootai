---
name: fai-power-apps-scaffold
description: |
  Scaffold Power Apps canvas and model-driven applications with Dataverse
  integration, responsive layouts, and component libraries. Use when building
  low-code business apps on Microsoft Power Platform.
---

# Power Apps Scaffold

Build Power Apps with Dataverse, responsive layouts, and component libraries.

## When to Use

- Building line-of-business apps with low code
- Creating forms and dashboards backed by Dataverse
- Setting up canvas app structure with screens and navigation
- Building model-driven apps with business process flows

---

## Canvas App Structure

```
App/
├── Screens/
│   ├── HomeScreen          # Main dashboard
│   ├── ListScreen          # Data list with search/filter
│   ├── DetailScreen        # Record detail view
│   └── FormScreen          # Create/edit form
├── Components/
│   ├── HeaderComponent     # Shared header with nav
│   └── StatusBadge         # Reusable status indicator
├── Connections/
│   ├── Dataverse           # Primary data source
│   └── Office365Users      # User info connector
└── Variables/
    ├── varCurrentUser      # Logged-in user
    └── varSelectedRecord   # Currently selected item
```

## Key Formulas

```
// Navigate with context
Navigate(DetailScreen, ScreenTransition.None, {selectedItem: ThisItem})

// Filter gallery with search
Filter(Conversations,
    StartsWith(Title, txtSearch.Text) || IsBlank(txtSearch.Text),
    Status = "Active"
)

// Patch (create/update) record
Patch(Conversations, Defaults(Conversations),
    { Title: txtTitle.Text, Status: "Active", Owner: varCurrentUser })

// Delegation-safe lookup
LookUp(Conversations, ID = varSelectedRecord.ID)
```

## Dataverse Table Design

| Table | Key Columns | Relationships |
|-------|------------|---------------|
| Conversation | Title, Status, Owner, CreatedOn | 1:N Messages |
| Message | Content, Role, Tokens, ConversationId | N:1 Conversation |
| Evaluation | Score, Metric, RunDate | N:1 Conversation |

## Best Practices

| Practice | Why |
|----------|-----|
| Use Dataverse, not SharePoint | Better performance, relationships, security |
| Minimize OnStart formulas | Faster app load time |
| Use components for reuse | DRY, consistent UI |
| Delegation-safe queries | Avoid 500-row limit warnings |
| Environment variables | No hardcoded values |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Delegation warning | Non-delegable function | Use delegable alternatives (Filter, not Search) |
| Slow gallery load | Too many columns fetched | Select only needed columns |
| Form validation fails | Required fields missing | Add proper error handling on SubmitForm |
| App won't publish | Environment permissions | Check Maker role in environment |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Convention over configuration | Reduce decisions, increase consistency |
| Separate concerns by folder | Clear boundaries, easy navigation |
| Include health endpoint | Operational readiness from day one |
| Add .editorconfig | Consistent formatting across IDEs |
| Include Dockerfile | Containerization-ready from start |
| Add CI workflow file | Quality gates from first commit |

## Project Initialization Checklist

- [ ] Folder structure created with conventions documented
- [ ] Dependencies installed and lockfile committed
- [ ] Health/ready endpoints implemented
- [ ] Dockerfile with multi-stage build
- [ ] CI workflow (lint + test + build)
- [ ] README with quickstart instructions
- [ ] .gitignore with language-specific exclusions

## Related Skills

- `fai-folder-structure` — Repository layout conventions
- `fai-readme-generator` — README documentation
- `fai-multi-stage-docker` — Optimized Dockerfiles
- `fai-build-github-workflow` — CI/CD setup
