---
name: fai-refactor-complexity
description: |
  Reduce code complexity with cyclomatic analysis, extract method patterns,
  and incremental refactoring strategies. Use when code has high complexity
  scores or is difficult to understand and test.
---

# Reduce Code Complexity

Identify and reduce complexity with extraction, simplification, and testing.

## When to Use

- Functions with cyclomatic complexity > 10
- Deeply nested conditionals (> 3 levels)
- Long methods (> 50 lines)
- Code that's hard to test due to branching

---

## Measure Complexity

```bash
# Python: radon
pip install radon
radon cc src/ -a -nb  # Show average, skip low complexity

# JavaScript: complexity-report
npx complexity-report --format json src/

# .NET: dotnet-sonarscanner (or build-in VS metrics)
```

## Reduction Techniques

### 1. Extract Method

```python
# Before: complexity 8
def process_order(order):
    if not order.items:
        raise ValueError("Empty order")
    if not order.customer:
        raise ValueError("No customer")
    subtotal = sum(i.price * i.qty for i in order.items)
    tax = subtotal * 0.08
    total = subtotal + tax
    if order.customer.is_vip:
        total *= 0.9
    order.total = total
    db.save(order)
    notify(order)
    return total

# After: complexity 3 (main) + 2 + 2 = lower per-function
def process_order(order):
    validate(order)
    total = calculate_total(order)
    finalize(order, total)
    return total

def validate(order):
    if not order.items: raise ValueError("Empty")
    if not order.customer: raise ValueError("No customer")

def calculate_total(order):
    subtotal = sum(i.price * i.qty for i in order.items)
    total = subtotal * 1.08
    return total * 0.9 if order.customer.is_vip else total
```

### 2. Early Returns (Guard Clauses)

```python
# Before: nested
def get_discount(user, order):
    if user:
        if user.is_vip:
            if order.total > 100:
                return 0.2
            else:
                return 0.1
        else:
            return 0
    return 0

# After: flat
def get_discount(user, order):
    if not user or not user.is_vip:
        return 0
    return 0.2 if order.total > 100 else 0.1
```

### 3. Replace Conditional with Polymorphism

```python
# Before
def calculate_price(product):
    if product.type == "subscription":
        return product.monthly * 12 * 0.8
    elif product.type == "one_time":
        return product.price
    elif product.type == "usage":
        return product.units * product.rate

# After
class Subscription:
    def price(self): return self.monthly * 12 * 0.8
class OneTime:
    def price(self): return self._price
class Usage:
    def price(self): return self.units * self.rate
```

## Complexity Targets

| Metric | Good | Warning | Refactor |
|--------|------|---------|----------|
| Cyclomatic per function | 1-5 | 6-10 | > 10 |
| Nesting depth | 1-2 | 3 | > 3 |
| Function length | < 30 lines | 30-50 | > 50 |
| Parameters | 0-3 | 4-5 | > 5 |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Complexity still high | Only moved code, didn't simplify | Reduce branching, not just line count |
| Tests break after refactor | Changed behavior | Refactor = same behavior, different structure |
| Team resists refactoring | No time budgeted | Allocate 15-20% of sprint to tech debt |
| New complexity introduced | No CI gate | Add complexity check to CI pipeline |
