---
name: fai-mcp-csharp-scaffold
description: |
  Scaffold C# MCP servers with the ModelContextProtocol NuGet package, typed
  tool definitions, input validation, and ASP.NET hosting. Use when building
  MCP servers in .NET for AI agent tool access.
---

# C# MCP Server Scaffold

Build MCP servers in C# with typed tools, validation, and ASP.NET hosting.

## When to Use

- Building MCP tool servers in .NET
- Exposing enterprise .NET APIs as AI agent tools
- Creating type-safe tool definitions with C# records
- Hosting MCP servers alongside ASP.NET APIs

---

## Project Setup

```bash
dotnet new console -n MyMcpServer
cd MyMcpServer
dotnet add package ModelContextProtocol
dotnet add package Microsoft.Extensions.Hosting
```

## Tool Definition

```csharp
using ModelContextProtocol;
using System.ComponentModel;

[McpTool("search_documents")]
[Description("Search knowledge base documents by query")]
public class SearchDocumentsTool
{
    [McpParameter("query", Required = true)]
    [Description("Search query text")]
    public string Query { get; set; } = "";

    [McpParameter("top_k")]
    [Description("Number of results to return")]
    public int TopK { get; set; } = 5;

    public async Task<string> ExecuteAsync()
    {
        var results = await searchClient.SearchAsync(Query, TopK);
        return JsonSerializer.Serialize(results);
    }
}
```

## Server Host

```csharp
using ModelContextProtocol;
using Microsoft.Extensions.Hosting;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddMcpServer(options =>
{
    options.ServerName = "my-mcp-server";
    options.ServerVersion = "1.0.0";
})
.AddTool<SearchDocumentsTool>()
.AddTool<CalculateCostTool>();

var host = builder.Build();
await host.RunAsync();
```

## Input Validation

```csharp
public async Task<string> ExecuteAsync()
{
    if (string.IsNullOrWhiteSpace(Query))
        throw new ArgumentException("Query cannot be empty");
    if (TopK < 1 || TopK > 50)
        throw new ArgumentOutOfRangeException(nameof(TopK), "Must be 1-50");

    var results = await searchClient.SearchAsync(Query, TopK);
    return JsonSerializer.Serialize(results);
}
```

## Docker Deployment

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY *.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:8.0-noble-chiseled
WORKDIR /app
COPY --from=build /app .
ENTRYPOINT ["dotnet", "MyMcpServer.dll"]
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Tool not discovered | Missing [McpTool] attribute | Add attribute + register with AddTool<T>() |
| Serialization error | Non-serializable return type | Return string or JsonSerializer.Serialize() |
| Timeout on long operations | No cancellation token | Add CancellationToken parameter |
| Auth not working | No credential setup | Use DefaultAzureCredential in DI |
