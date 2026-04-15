---
name: fai-plantuml-generator
description: |
  Generate PlantUML diagrams for architecture, sequences, class hierarchies,
  and state machines. Use when creating UML diagrams that render in documentation
  sites, IDEs, and CI pipelines.
---

# PlantUML Generator

Generate UML diagrams with PlantUML syntax for documentation and architecture.

## When to Use

- Creating sequence diagrams for API flows
- Documenting class hierarchies and relationships
- Generating architecture diagrams with deployment views
- Embedding diagrams in documentation via CI rendering

---

## Sequence Diagram

```plantuml
@startuml
actor User
participant "API Gateway" as API
participant "AI Search" as Search
participant "Azure OpenAI" as LLM
database "Cosmos DB" as DB

User -> API: POST /chat
API -> Search: Hybrid search(query)
Search --> API: Top 5 documents
API -> LLM: Generate answer(context, query)
LLM --> API: Streaming response
API -> DB: Save conversation
API --> User: SSE response chunks
@enduml
```

## Component Diagram

```plantuml
@startuml
package "Frontend" {
  [Next.js App] as Web
}

package "Backend" {
  [FastAPI] as API
  [Worker] as Worker
}

cloud "Azure AI" {
  [Azure OpenAI] as LLM
  [AI Search] as Search
}

database "Data" {
  [Cosmos DB] as DB
  [Blob Storage] as Blob
}

Web --> API : HTTPS
API --> LLM : Completions
API --> Search : Hybrid query
API --> DB : Read/write
Worker --> Blob : Process docs
Worker --> Search : Index documents
@enduml
```

## Class Diagram

```plantuml
@startuml
class ChatService {
  -client: OpenAIClient
  -search: SearchClient
  +chat(query: str): Response
  +stream(query: str): AsyncIterator
}

class RAGPipeline {
  -embedder: Embedder
  -retriever: Retriever
  +retrieve(query: str): list[Doc]
  +augment(query: str, docs: list): str
}

ChatService --> RAGPipeline : uses
RAGPipeline --> Embedder : embeds with
RAGPipeline --> Retriever : retrieves from
@enduml
```

## State Diagram

```plantuml
@startuml
[*] --> Pending
Pending --> Processing : Start
Processing --> Completed : Success
Processing --> Failed : Error
Failed --> Processing : Retry
Completed --> [*]
Failed --> [*] : Max retries
@enduml
```

## CI Rendering

```bash
# Install PlantUML
apt-get install plantuml

# Render all .puml files to PNG
find docs/ -name "*.puml" -exec plantuml {} \;
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Diagram not rendering | PlantUML not installed | Install Java + PlantUML |
| Layout messy | Too many elements | Use packages to group |
| Arrows crossing | Default layout | Reorder participants/components |
| Font too small | Default scaling | Add `scale 1.5` at top |
