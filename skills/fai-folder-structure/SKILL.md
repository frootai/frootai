---
name: fai-folder-structure
description: |
  Design scalable repository folder structures for monorepos, microservices,
  and AI projects. Use when initializing projects, standardizing layouts
  across teams, or planning repository reorganization.
---

# Repository Folder Structure

Design clear, scalable project layouts for different architecture styles.

## When to Use

- Initializing a new project or monorepo
- Standardizing folder conventions across teams
- Reorganizing a grown-organically codebase
- Setting up solution play repository structure

---

## AI Application Layout

```
my-ai-app/
├── .github/
│   ├── agents/                 # Agent definitions
│   ├── instructions/           # Copilot instructions
│   ├── skills/                 # Copilot skills
│   ├── workflows/              # CI/CD pipelines
│   └── copilot-instructions.md # Project-level guidance
├── src/
│   ├── api/                    # FastAPI/Express endpoints
│   ├── services/               # Business logic
│   ├── models/                 # Pydantic/data models
│   └── utils/                  # Shared utilities
├── infra/
│   ├── main.bicep              # Infrastructure entry point
│   ├── modules/                # Reusable Bicep modules
│   └── main.bicepparam         # Parameter values
├── config/
│   ├── openai.json             # AI model configuration
│   └── guardrails.json         # Safety thresholds
├── evaluation/
│   ├── datasets/               # Test datasets (JSONL)
│   └── metrics/                # Evaluation results
├── tests/
│   ├── unit/                   # Unit tests
│   ├── integration/            # Integration tests
│   └── smoke/                  # Post-deploy smoke tests
├── docs/
│   └── adr/                    # Architecture Decision Records
├── Dockerfile
├── requirements.txt
├── fai-manifest.json           # FAI Protocol manifest
└── README.md
```

## Monorepo Layout

```
monorepo/
├── apps/
│   ├── api/                    # Backend service
│   ├── web/                    # Frontend app
│   └── worker/                 # Background processor
├── packages/
│   ├── shared/                 # Shared types/utils
│   └── sdk/                    # Internal SDK
├── infra/                      # Shared infrastructure
├── tools/                      # Build/dev scripts
└── turbo.json / nx.json        # Monorepo orchestrator config
```

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Folders | lowercase-hyphen | `ai-search/` |
| Files (code) | snake_case (Python), camelCase (TS) | `openai_client.py` |
| Config files | lowercase-hyphen | `openai-config.json` |
| Bicep modules | lowercase-hyphen | `key-vault.bicep` |
| Test files | `test_` prefix (Python) | `test_chat.py` |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Can't find files | No convention | Enforce naming rules in CI |
| Circular imports | Bad dependency direction | Enforce src/ → services/ → utils/ layering |
| Config scattered | No config/ folder | Centralize in config/ or .env |
| Tests mixed with source | No tests/ separation | Use dedicated tests/ tree |

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
