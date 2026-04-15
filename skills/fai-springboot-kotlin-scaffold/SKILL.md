---
name: fai-springboot-kotlin-scaffold
description: |
  Scaffold Spring Boot applications in Kotlin with coroutines, WebFlux,
  and Gradle configuration. Use when building Kotlin-based microservices
  with Spring Boot.
---

# Spring Boot Kotlin Scaffold

Build Spring Boot services in Kotlin with coroutines and WebFlux.

## When to Use

- Building Kotlin microservices with Spring Boot
- Using coroutines for async endpoint handling
- Setting up Gradle with Kotlin DSL
- Creating REST APIs with Spring WebFlux

---

## build.gradle.kts

```kotlin
plugins {
    kotlin("jvm") version "2.0.0"
    kotlin("plugin.spring") version "2.0.0"
    id("org.springframework.boot") version "3.3.0"
    id("io.spring.dependency-management") version "1.1.5"
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-webflux")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-reactor")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
}
```

## Controller with Coroutines

```kotlin
@RestController
@RequestMapping("/api")
class ChatController(private val chatService: ChatService) {

    @PostMapping("/chat")
    suspend fun chat(@RequestBody request: ChatRequest): ChatResponse {
        return chatService.chat(request)
    }

    @GetMapping("/health")
    suspend fun health(): Map<String, String> {
        return mapOf("status" to "healthy")
    }
}

data class ChatRequest(val message: String, val model: String = "gpt-4o-mini")
data class ChatResponse(val reply: String, val tokens: Int)
```

## Service

```kotlin
@Service
class ChatService(private val openAIClient: OpenAIClient) {

    suspend fun chat(request: ChatRequest): ChatResponse {
        val response = openAIClient.complete(request.message, request.model)
        return ChatResponse(
            reply = response.content,
            tokens = response.totalTokens
        )
    }
}
```

## Configuration

```kotlin
@Configuration
class OpenAIConfig {
    @Bean
    fun openAIClient(
        @Value("\${azure.openai.endpoint}") endpoint: String
    ): OpenAIClient {
        return OpenAIClient(endpoint, DefaultAzureCredential())
    }
}
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Null safety issues | Java interop | Use `!!` carefully, prefer Kotlin types |
| Coroutine scope leak | Missing structured concurrency | Use coroutineScope in service |
| Jackson serialize error | No Kotlin module | Add jackson-module-kotlin dependency |
| Spring DI fails | Missing open modifier | Apply kotlin-spring plugin (opens classes) |

