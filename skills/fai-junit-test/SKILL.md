---
name: fai-junit-test
description: |
  Write JUnit 5 tests with parameterized cases, lifecycle hooks, assertion
  patterns, and Mockito mocking. Use when testing Java or Kotlin applications
  with the JUnit testing framework.
---

# JUnit 5 Testing Patterns

Write reliable JUnit tests with parameterization, mocking, and lifecycle hooks.

## When to Use

- Testing Java/Kotlin applications
- Setting up test conventions for Spring Boot services
- Mocking dependencies with Mockito
- Configuring test coverage with JaCoCo

---

## Basic Test Structure

```java
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;

class OrderServiceTest {

    private OrderService service;

    @BeforeEach
    void setUp() {
        service = new OrderService(new MockRepository());
    }

    @Test
    @DisplayName("calculateTotal returns correct sum with tax")
    void calculateTotal_withItems_returnsCorrectSum() {
        var order = Order.of(item("Widget", 29.99, 2));
        double total = service.calculateTotal(order);
        assertEquals(64.78, total, 0.01); // 59.98 + 8% tax
    }

    @Test
    void calculateTotal_emptyOrder_returnsZero() {
        assertEquals(0.0, service.calculateTotal(Order.empty()));
    }
}
```

## Parameterized Tests

```java
@ParameterizedTest
@CsvSource({
    "100.00, 0.08, 108.00",
    "50.00,  0.10, 55.00",
    "0.00,   0.08, 0.00",
})
void calculateTax(double amount, double rate, double expected) {
    assertEquals(expected, TaxCalculator.calculate(amount, rate), 0.01);
}

@ParameterizedTest
@MethodSource("invalidInputs")
void validate_rejectsInvalidInput(String input) {
    assertThrows(IllegalArgumentException.class, () -> Validator.validate(input));
}

static Stream<String> invalidInputs() {
    return Stream.of("", null, "   ", "<script>alert('xss')</script>");
}
```

## Mockito Mocking

```java
@ExtendWith(MockitoExtension.class)
class ChatServiceTest {

    @Mock OpenAIClient openAIClient;
    @InjectMocks ChatService chatService;

    @Test
    void chat_returnsModelResponse() {
        when(openAIClient.complete(any()))
            .thenReturn(new Completion("Hello from GPT"));

        String result = chatService.chat("Hi");
        assertEquals("Hello from GPT", result);
        verify(openAIClient).complete(argThat(req ->
            req.getPrompt().contains("Hi")));
    }

    @Test
    void chat_handlesApiError() {
        when(openAIClient.complete(any()))
            .thenThrow(new RuntimeException("Rate limited"));

        assertThrows(ServiceException.class, () -> chatService.chat("Hi"));
    }
}
```

## Coverage with JaCoCo

```xml
<!-- pom.xml -->
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <configuration>
        <rules>
            <rule>
                <limits>
                    <limit><counter>LINE</counter><value>COVEREDRATIO</value><minimum>0.80</minimum></limit>
                    <limit><counter>BRANCH</counter><value>COVEREDRATIO</value><minimum>0.70</minimum></limit>
                </limits>
            </rule>
        </rules>
    </configuration>
</plugin>
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Test order dependency | Shared mutable state | Use @BeforeEach for fresh setup |
| Mockito null returns | Missing when() stub | Stub all methods called in test |
| Flaky async tests | Race conditions | Use CountDownLatch or Awaitility |
| Low branch coverage | Missing edge cases | Add null, empty, boundary tests |
