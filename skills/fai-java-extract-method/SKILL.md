---
name: fai-java-extract-method
description: |
  Apply extract-method refactoring in Java with behavior preservation, test
  coverage validation, and IDE-assisted automation. Use when reducing method
  complexity or improving code readability in Java projects.
---

# Java Extract Method Refactoring

Safely extract methods from complex Java code with behavior preservation.

## When to Use

- Methods exceed 30-50 lines (too long)
- Same logic repeated in multiple places
- Method has multiple responsibilities
- Improving testability by isolating logic

---

## Before: Long Method

```java
public OrderResult processOrder(Order order) {
    // Validate
    if (order.getItems().isEmpty()) throw new IllegalArgumentException("Empty order");
    if (order.getCustomer() == null) throw new IllegalArgumentException("No customer");

    // Calculate totals
    double subtotal = 0;
    for (OrderItem item : order.getItems()) {
        subtotal += item.getPrice() * item.getQuantity();
    }
    double tax = subtotal * 0.08;
    double total = subtotal + tax;

    // Apply discount
    if (order.getCustomer().isVip()) {
        total *= 0.9;
    }

    // Save
    order.setTotal(total);
    orderRepository.save(order);
    notificationService.sendConfirmation(order);

    return new OrderResult(order.getId(), total);
}
```

## After: Extracted Methods

```java
public OrderResult processOrder(Order order) {
    validateOrder(order);
    double total = calculateTotal(order);
    return finalizeOrder(order, total);
}

private void validateOrder(Order order) {
    if (order.getItems().isEmpty()) throw new IllegalArgumentException("Empty order");
    if (order.getCustomer() == null) throw new IllegalArgumentException("No customer");
}

private double calculateTotal(Order order) {
    double subtotal = order.getItems().stream()
        .mapToDouble(i -> i.getPrice() * i.getQuantity())
        .sum();
    double total = subtotal + subtotal * TAX_RATE;
    return order.getCustomer().isVip() ? total * VIP_DISCOUNT : total;
}

private OrderResult finalizeOrder(Order order, double total) {
    order.setTotal(total);
    orderRepository.save(order);
    notificationService.sendConfirmation(order);
    return new OrderResult(order.getId(), total);
}
```

## Extraction Rules

| Rule | Why |
|------|-----|
| Name describes WHAT, not HOW | `calculateTotal` not `doCalculation` |
| Extract when >1 responsibility | Single Responsibility Principle |
| Keep extracted method at same access level | Don't expose internals |
| Parameters: 0-3 max | More = create a parameter object |
| Never change behavior during extraction | Refactor ≠ rewrite |

## IDE Automation

```
IntelliJ: Select code → Ctrl+Alt+M (Extract Method)
Eclipse: Select code → Alt+Shift+M
VS Code: Select code → Ctrl+Shift+R → Extract Method
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Tests break after extract | Changed behavior accidentally | Extract only, don't modify logic |
| Too many parameters | Extracting from middle of method | Pass object or restructure |
| Extracted method too generic | Bad naming | Name by domain intent, not implementation |
| Performance regression | Extra method call overhead | Negligible — JIT inlines small methods |
