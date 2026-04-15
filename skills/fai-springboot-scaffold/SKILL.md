---
name: fai-springboot-scaffold
description: |
  Scaffold Spring Boot Java applications with REST controllers, JPA/Hibernate,
  security configuration, and test setup. Use when building Java microservices
  with Spring Boot.
---

# Spring Boot Java Scaffold

Build Spring Boot services with REST, JPA, security, and testing.

## When to Use

- Building Java REST APIs with Spring Boot
- Setting up JPA/Hibernate data access
- Configuring Spring Security with OAuth2/JWT
- Creating test infrastructure with MockMvc

---

## Project Structure

```
src/main/java/com/example/
├── Application.java
├── controller/
│   └── ChatController.java
├── service/
│   └── ChatService.java
├── model/
│   ├── ChatRequest.java
│   └── ChatResponse.java
├── repository/
│   └── ConversationRepository.java
└── config/
    └── SecurityConfig.java
```

## Controller

```java
@RestController
@RequestMapping("/api")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@Valid @RequestBody ChatRequest request) {
        var response = chatService.chat(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "healthy");
    }
}

public record ChatRequest(
    @NotBlank @Size(max = 4000) String message,
    String model
) {
    public ChatRequest {
        if (model == null) model = "gpt-4o-mini";
    }
}

public record ChatResponse(String reply, int tokens) {}
```

## JPA Repository

```java
@Entity
@Table(name = "conversations")
public class Conversation {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    private String userId;
    private String title;
    @Column(name = "created_at")
    private Instant createdAt = Instant.now();
}

public interface ConversationRepository extends JpaRepository<Conversation, UUID> {
    List<Conversation> findByUserIdOrderByCreatedAtDesc(String userId);
}
```

## Test with MockMvc

```java
@WebMvcTest(ChatController.class)
class ChatControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean ChatService chatService;

    @Test
    void chat_returnsResponse() throws Exception {
        when(chatService.chat(any())).thenReturn(new ChatResponse("Hello", 100));

        mockMvc.perform(post("/api/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"message": "Hi"}"""))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.reply").value("Hello"));
    }
}
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| 400 on valid request | Missing @Valid or wrong content type | Add @Valid + Content-Type header |
| JPA entity not found | Missing @Entity annotation | Add annotation + table mapping |
| DI circular reference | Constructor cycle | Use @Lazy or redesign dependencies |
| Tests slow | Loading full context | Use @WebMvcTest for controller tests |
