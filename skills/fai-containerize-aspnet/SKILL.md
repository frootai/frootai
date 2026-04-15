---
name: fai-containerize-aspnet
description: |
  Containerize ASP.NET applications with multi-stage builds, non-root runtime,
  health probes, chiseled base images, and vulnerability scanning. Use when
  deploying .NET services to AKS or Azure Container Apps.
---

# Containerize ASP.NET

Multi-stage Dockerfile for production .NET services with security best practices.

## When to Use

- Containerizing ASP.NET Core APIs or workers
- Deploying .NET services to AKS or Container Apps
- Optimizing image size for fast cold starts
- Hardening containers with non-root and chiseled images

---

## Multi-Stage Dockerfile

```dockerfile
# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY *.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish --no-restore

# Stage 2: Runtime (chiseled = no shell, no root, minimal)
FROM mcr.microsoft.com/dotnet/aspnet:8.0-noble-chiseled
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:8080/health || exit 1
ENTRYPOINT ["dotnet", "MyApp.dll"]
```

## Non-Chiseled Alternative (with shell access for debugging)

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
RUN groupadd -r appuser && useradd -r -g appuser appuser
COPY --from=build /app/publish .
USER appuser
EXPOSE 8080
ENTRYPOINT ["dotnet", "MyApp.dll"]
```

## .dockerignore

```
**/bin
**/obj
**/.vs
**/node_modules
**/*.md
**/tests
.git
```

## Image Size Comparison

| Base Image | Size | Security |
|-----------|------|----------|
| aspnet:8.0 | ~220MB | Standard |
| aspnet:8.0-alpine | ~110MB | Minimal, musl libc |
| aspnet:8.0-noble-chiseled | ~110MB | No shell, no root, distroless |

## Health Endpoint

```csharp
app.MapHealthChecks("/health");
app.MapHealthChecks("/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Large image (>500MB) | Using SDK as runtime | Use multi-stage, aspnet base only |
| Permission denied | Running as root | Add USER directive or use chiseled |
| Health check fails | Wrong port | Match EXPOSE and Kestrel configured port |
| Missing .NET runtime | Wrong base image | Use aspnet (not runtime) for web apps |

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
