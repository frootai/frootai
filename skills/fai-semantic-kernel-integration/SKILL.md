---
name: fai-semantic-kernel-integration
description: |
  Integrate Semantic Kernel with Azure OpenAI, plugins, planners, and memory.
  Use when building AI orchestration in .NET or Python with Microsoft's
  Semantic Kernel framework.
---

# Semantic Kernel Integration

Build AI orchestration with Semantic Kernel plugins, planners, and memory.

## When to Use

- Building .NET or Python AI apps with Semantic Kernel
- Creating plugins (functions) for AI agent orchestration
- Using planners for multi-step task execution
- Adding memory and context management

---

## .NET Setup

```csharp
using Microsoft.SemanticKernel;
using Azure.Identity;

var builder = Kernel.CreateBuilder();
builder.AddAzureOpenAIChatCompletion(
    deploymentName: "gpt-4o",
    endpoint: Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT")!,
    credentials: new DefaultAzureCredential()
);
var kernel = builder.Build();
```

## Plugin Definition

```csharp
public class SearchPlugin
{
    [KernelFunction("search_documents")]
    [Description("Search the knowledge base for documents matching a query")]
    public async Task<string> SearchAsync(
        [Description("Search query text")] string query,
        [Description("Maximum results")] int limit = 5)
    {
        var results = await _searchClient.SearchAsync(query, limit);
        return JsonSerializer.Serialize(results);
    }
}

// Register plugin
kernel.Plugins.AddFromType<SearchPlugin>();
```

## Function Calling

```csharp
var settings = new OpenAIPromptExecutionSettings
{
    FunctionChoiceBehavior = FunctionChoiceBehavior.Auto()
};

var result = await kernel.InvokePromptAsync(
    "Find documents about retry patterns and summarize them",
    new KernelArguments(settings)
);
Console.WriteLine(result);
```

## Python Setup

```python
import semantic_kernel as sk
from semantic_kernel.connectors.ai.open_ai import AzureChatCompletion
from azure.identity import DefaultAzureCredential

kernel = sk.Kernel()
kernel.add_service(AzureChatCompletion(
    deployment_name="gpt-4o",
    endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    credentials=DefaultAzureCredential(),
))
```

## Python Plugin

```python
from semantic_kernel.functions import kernel_function

class SearchPlugin:
    @kernel_function(name="search", description="Search knowledge base")
    async def search(self, query: str, limit: int = 5) -> str:
        results = await search_service.search(query, limit)
        return json.dumps(results)

kernel.add_plugin(SearchPlugin(), "search")
```

## Chat with History

```csharp
var chatService = kernel.GetRequiredService<IChatCompletionService>();
var history = new ChatHistory("You are a helpful AI assistant.");

history.AddUserMessage("What is a circuit breaker pattern?");
var response = await chatService.GetChatMessageContentAsync(history, settings, kernel);
history.AddAssistantMessage(response.Content!);
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Plugin not invoked | Missing FunctionChoiceBehavior | Set Auto() in execution settings |
| Auth fails | No DefaultAzureCredential | Install Azure.Identity, configure MI |
| Function not found | Missing [KernelFunction] | Add attribute + register plugin |
| High token usage | History too long | Trim history to last N messages |
