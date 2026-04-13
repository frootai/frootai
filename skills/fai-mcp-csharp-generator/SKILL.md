---
name: fai-mcp-csharp-generator
description: 'Scaffolds a complete C#/.NET MCP server project with ModelContextProtocol NuGet, dependency injection, [McpServerTool] attributes, IHostedService lifecycle, and Azure Managed Identity integration.'
---

# FAI MCP C# Generator

Scaffold a production-ready C#/.NET MCP server.

## Parameters

- **Server Name**: ${SERVER_NAME="MyMcpServer"}
- **Tools**: ${TOOL_COUNT="1|3|5|10"}
- **Azure Integration**: ${AZURE="None|KeyVault|Search|OpenAI|Full"}

## Generated Files

```
{SERVER_NAME}/
├── {SERVER_NAME}.csproj       # NuGet refs: ModelContextProtocol, Azure.Identity
├── Program.cs                  # Host builder with MCP server setup
├── Tools/
│   └── ExampleTools.cs         # [McpServerTool] sample implementations
├── Services/
│   └── IExampleService.cs      # DI interface pattern
├── Dockerfile
├── README.md
└── appsettings.json            # Non-secret configuration
```

## Key Patterns

```csharp
// Program.cs
var builder = Host.CreateApplicationBuilder(args);
builder.Services
    .AddMcpServer()
    .WithStdioTransport()
    .WithTools<ExampleTools>();
builder.Services.AddSingleton<IExampleService, ExampleService>();
var host = builder.Build();
await host.RunAsync();
```

## Verification

- `dotnet build` compiles without errors
- `dotnet run` starts MCP server on stdio
- [Description] attributes present on all tools and parameters
- DefaultAzureCredential used for Azure services (no keys)

## Tool Implementation Pattern

```csharp
[McpServerTool, Description("Search FAI solution plays by keyword")]
public static async Task<string> SearchPlays(
    [Description("Search query")] string query,
    [Description("Max results (1-20)")] int maxResults = 5,
    IPlaySearchService searchService = null!)
{
    ArgumentException.ThrowIfNullOrWhiteSpace(query);
    maxResults = Math.Clamp(maxResults, 1, 20);
    var results = await searchService.SearchAsync(query, maxResults);
    return JsonSerializer.Serialize(results, new JsonSerializerOptions 
    { WriteIndented = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
}
```

## Azure Integration Patterns

### Key Vault
```csharp
builder.Configuration.AddAzureKeyVault(
    new Uri("https://my-vault.vault.azure.net/"),
    new DefaultAzureCredential());
```

### Azure OpenAI
```csharp
builder.Services.AddSingleton(_ => new AzureOpenAIClient(
    new Uri(config["AzureOpenAI:Endpoint"]!),
    new DefaultAzureCredential()));
```

### AI Search
```csharp
builder.Services.AddSingleton(_ => new SearchClient(
    new Uri(config["Search:Endpoint"]!),
    config["Search:IndexName"],
    new DefaultAzureCredential()));
```

## Testing

```csharp
[Fact]
public async Task SearchPlays_ReturnsResults()
{
    var mockService = new Mock<IPlaySearchService>();
    mockService.Setup(s => s.SearchAsync("rag", 5))
        .ReturnsAsync(new[] { new PlayResult("01", "Enterprise RAG") });
    var result = await ExampleTools.SearchPlays("rag", 5, mockService.Object);
    Assert.Contains("Enterprise RAG", result);
}
```

## Deployment

### NuGet Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| ModelContextProtocol | 0.1.0-preview | MCP server SDK |
| Azure.Identity | 1.13.x | Managed Identity auth |
| Microsoft.Extensions.Hosting | 9.0.x | Host builder pattern |
| Azure.AI.OpenAI | 2.1.x | Azure OpenAI client |
| Azure.Search.Documents | 11.7.x | AI Search client |

## Configuration Reference

```json
{
  "McpServer": { "Name": "my-fai-mcp", "Version": "1.0.0", "Transport": "stdio" },
  "AzureOpenAI": { "Endpoint": "https://my-oai.openai.azure.com/", "DeploymentName": "gpt-4o" },
  "Search": { "Endpoint": "https://my-search.search.windows.net", "IndexName": "fai-knowledge" }
}
```
