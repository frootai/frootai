---
description: "Kotlin coding standards — coroutines, data classes, null safety, extension functions, and Gradle build patterns."
applyTo: "**/*.kt"
waf:
  - "performance-efficiency"
  - "reliability"
---

# Kotlin — FAI Standards

## Data Classes & Sealed Hierarchies
- Use `data class` for DTOs — get `equals`, `hashCode`, `copy`, destructuring free
- Prefer `val` properties; mutable `var` only when genuinely needed
- Use `sealed class`/`sealed interface` for closed type hierarchies — exhaustive `when`

```kotlin
data class ChatMessage(val role: Role, val content: String, val tokens: Int = 0)

sealed interface ChatResult {
    data class Success(val message: ChatMessage, val latencyMs: Long) : ChatResult
    data class RateLimited(val retryAfterMs: Long) : ChatResult
    data class Error(val code: Int, val reason: String) : ChatResult
}

fun handle(result: ChatResult): String = when (result) {
    is ChatResult.Success -> result.message.content
    is ChatResult.RateLimited -> "Retry in ${result.retryAfterMs}ms"
    is ChatResult.Error -> "Error ${result.code}: ${result.reason}"
    // no else — sealed = exhaustive, compiler enforces new branches
}
```

## Null Safety
- Never use `!!` in production — it crashes. Use `?.let`, `?:`, or `requireNotNull`
- `?.let { }` for optional transforms; `?: return` / `?: throw` for early exits
- `requireNotNull` / `checkNotNull` at system boundaries with descriptive messages

```kotlin
fun resolveEndpoint(config: AppConfig): String {
    val endpoint = config.openAiEndpoint
        ?: throw IllegalStateException("OPENAI_ENDPOINT missing in config")
    val key = requireNotNull(config.apiKey) { "API key must not be null" }
    return endpoint
}

// ?.let for optional chains — NOT nested if-null checks
user?.subscription?.plan?.let { plan ->
    billingService.charge(plan)
} ?: logger.warn("Skipping billing — no active plan")
```

## Scope Functions — When to Use Each
- **`let`** — null-safe transforms, scoping temporary results: `x?.let { use(it) }`
- **`run`** — compute a result using an object's context: `config.run { "$host:$port" }`
- **`apply`** — configure/mutate an object, return it: `Builder().apply { timeout = 30 }`
- **`also`** — side effects (logging, validation): `result.also { logger.info("Got $it") }`
- **`with`** — multiple calls on same object, no null check: `with(response) { status to body }`

```kotlin
// apply for builder configuration
val client = OkHttpClient.Builder().apply {
    connectTimeout(Duration.ofSeconds(10))
    addInterceptor(retryInterceptor)
    addInterceptor(loggingInterceptor)
}.build()

// let + elvis for defaults
val model = env["MODEL_NAME"]?.let { ModelId(it) } ?: ModelId("gpt-4o-mini")
```

## Coroutines & Structured Concurrency
- Every coroutine runs in a `CoroutineScope` — never use `GlobalScope`
- Use `supervisorScope` when child failures should not cancel siblings
- `Flow` for streaming data; `channelFlow` for concurrent emission
- `withTimeout` for bounded operations; `withContext(Dispatchers.IO)` for blocking I/O

```kotlin
suspend fun fetchDocuments(ids: List<String>): List<Document> =
    supervisorScope {
        ids.map { id ->
            async(Dispatchers.IO) {
                runCatching { documentClient.get(id) }
                    .getOrElse { e ->
                        logger.error("Failed to fetch $id", e)
                        null
                    }
            }
        }.awaitAll().filterNotNull()
    }

fun streamTokens(prompt: String): Flow<String> = flow {
    openAiClient.chatCompletionStream(prompt).collect { chunk ->
        chunk.choices.firstOrNull()?.delta?.content?.let { emit(it) }
    }
}.flowOn(Dispatchers.IO)
```

## Extension Functions & Property Delegation
- Extension functions for adding domain behavior without subclassing
- `by lazy` for expensive one-time init; `Delegates.observable` for reactive state

```kotlin
fun String.truncateTokens(maxTokens: Int): String =
    split(" ").take(maxTokens).joinToString(" ")

val embeddingCache by lazy { ConcurrentHashMap<String, FloatArray>() }

var threshold: Double by Delegates.observable(0.7) { _, old, new ->
    logger.info("Threshold changed: $old → $new")
}
```

## Inline/Value Classes
- Use `@JvmInline value class` for type-safe wrappers with zero overhead
- Prevents mixing up `String` parameters (model IDs, API keys, tenant IDs)

```kotlin
@JvmInline value class ModelId(val value: String)
@JvmInline value class ApiKey(val value: String)
@JvmInline value class TenantId(val value: String)

fun deploy(model: ModelId, key: ApiKey, tenant: TenantId) { /* type-safe, no mixups */ }
```

## Serialization
- Prefer `kotlinx.serialization` — compile-time, no reflection, multiplatform
- Use `@Serializable` + `Json { ignoreUnknownKeys = true }` for resilient parsing
- Gson only for legacy Java interop; never mix both in the same module

```kotlin
@Serializable
data class CompletionRequest(
    val model: String,
    val messages: List<ChatMessage>,
    @SerialName("max_tokens") val maxTokens: Int = 1024,
    val temperature: Double = 0.0,
)

val json = Json { ignoreUnknownKeys = true; encodeDefaults = false }
val request = json.decodeFromString<CompletionRequest>(rawBody)
```

## Companion Object & DSL Builders
- `companion object` for factory methods and constants — not for utility dumps
- DSL builders with `@DslMarker` for type-safe, readable configuration

```kotlin
class RetryPolicy private constructor(val maxRetries: Int, val baseDelayMs: Long) {
    companion object {
        val DEFAULT = RetryPolicy(maxRetries = 3, baseDelayMs = 1000)
        fun custom(block: Builder.() -> Unit) = Builder().apply(block).build()
    }
    class Builder {
        var maxRetries = 3; var baseDelayMs = 1000L
        fun build() = RetryPolicy(maxRetries, baseDelayMs)
    }
}
// Usage: RetryPolicy.custom { maxRetries = 5; baseDelayMs = 500 }
```

## Ktor / Spring Boot
- Ktor: use `install()` for plugins, structured routing via `routing { }` DSL
- Spring Boot: prefer constructor injection, `@ConfigurationProperties` for typed config
- Both: health endpoint at `/health`, graceful shutdown, structured JSON logging

## Kotest Testing
- Use `StringSpec` or `FunSpec` — descriptive test names, not JUnit-style method names
- `shouldBe`, `shouldThrow<T>`, `forAll` (property-based), `eventually` (async assertions)
- `mockk` for mocking — `every`, `coEvery` for suspend functions, `verify` for assertions

```kotlin
class ChatServiceTest : FunSpec({
    test("rate-limited response triggers retry") {
        val client = mockk<OpenAiClient>()
        coEvery { client.complete(any()) } returnsMany listOf(
            ChatResult.RateLimited(retryAfterMs = 100),
            ChatResult.Success(ChatMessage(Role.ASSISTANT, "Hello"), 42),
        )
        val result = ChatService(client).send("Hi")
        result shouldBe "Hello"
        coVerify(exactly = 2) { client.complete(any()) }
    }
})
```

## Anti-Patterns
- ❌ `!!` operator in production — use `?.let`, `?:`, or `requireNotNull` instead
- ❌ `GlobalScope.launch` — always use structured `coroutineScope` or `supervisorScope`
- ❌ `var` in data classes — breaks `hashCode`/`equals` contract, use `copy()` instead
- ❌ `Gson` + `kotlinx.serialization` in the same module — pick one
- ❌ `runBlocking` on Dispatchers.Main or inside coroutines — causes deadlocks
- ❌ Catching `Exception` broadly — catch specific types, let `CancellationException` propagate
- ❌ Empty `catch` blocks — at minimum log with context
- ❌ Mutable collections in public APIs — expose `List`, return `MutableList` internally

## WAF Alignment

| Pillar | Kotlin Practice |
| --- | --- |
| **Security** | `@JvmInline value class` for secrets (no accidental logging), `requireNotNull` at boundaries, no `!!` |
| **Reliability** | `supervisorScope` for fault isolation, `retry` with exponential backoff in `Flow`, sealed result types |
| **Performance** | `Flow` streaming (no buffering full responses), `Dispatchers.IO` for blocking, `by lazy` for heavy init |
| **Cost** | `temperature = 0.0` default, `maxTokens` from config, model routing via sealed `ModelTier` |
| **Ops Excellence** | Structured logging with `also { logger.info() }`, Kotest in CI, `kotlinx.serialization` for type safety |
| **Responsible AI** | Content safety checks before emitting `Flow` items, PII redaction extensions, audit logging |
