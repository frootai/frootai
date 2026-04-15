---
name: fai-springboot-test
description: |
  Write Spring Boot tests with MockMvc, TestContainers, slice testing, and
  test profiles. Use when building comprehensive test suites for Spring
  Boot applications.
---

# Spring Boot Testing

Write unit, integration, and slice tests for Spring Boot applications.

## When to Use

- Testing REST controllers with MockMvc
- Integration testing with Testcontainers
- Slice testing with @WebMvcTest, @DataJpaTest
- Configuring test profiles and fixtures

---

## Controller Test (@WebMvcTest)

```java
@WebMvcTest(ChatController.class)
class ChatControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean ChatService chatService;

    @Test
    void chat_validInput_returns200() throws Exception {
        when(chatService.chat(any())).thenReturn(new ChatResponse("Response", 150));

        mockMvc.perform(post("/api/chat")
                .contentType(APPLICATION_JSON)
                .content("""{"message": "Hello"}"""))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.reply").value("Response"))
            .andExpect(jsonPath("$.tokens").value(150));
    }

    @Test
    void chat_emptyMessage_returns400() throws Exception {
        mockMvc.perform(post("/api/chat")
                .contentType(APPLICATION_JSON)
                .content("""{"message": ""}"""))
            .andExpect(status().isBadRequest());
    }
}
```

## Repository Test (@DataJpaTest)

```java
@DataJpaTest
class ConversationRepositoryTest {

    @Autowired ConversationRepository repo;

    @Test
    void findByUserId_returnsOrdered() {
        repo.save(new Conversation("user-1", "First"));
        repo.save(new Conversation("user-1", "Second"));
        repo.save(new Conversation("user-2", "Other"));

        var results = repo.findByUserIdOrderByCreatedAtDesc("user-1");
        assertThat(results).hasSize(2);
        assertThat(results.get(0).getTitle()).isEqualTo("Second");
    }
}
```

## Integration Test (Testcontainers)

```java
@SpringBootTest
@Testcontainers
class ChatIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired TestRestTemplate restTemplate;

    @Test
    void fullFlow_createAndRetrieve() {
        var resp = restTemplate.postForEntity("/api/chat",
            new ChatRequest("Hello"), ChatResponse.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody().reply()).isNotBlank();
    }
}
```

## Test Profile

```yaml
# src/test/resources/application-test.yml
spring:
  datasource:
    url: jdbc:h2:mem:testdb
  jpa:
    hibernate.ddl-auto: create-drop
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Full context loads | Using @SpringBootTest for unit test | Use @WebMvcTest or @DataJpaTest |
| Testcontainers slow | Starting per test class | Use @Container + reusable flag |
| Mock not injected | Wrong annotation | Use @MockBean, not @Mock |
| H2 SQL incompatible | PostgreSQL-specific syntax | Use Testcontainers for Postgres |
