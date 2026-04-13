---
description: "Django standards — models, views, URLs, ORM queries, and security middleware patterns."
applyTo: "**/*.py, **/settings*.py"
waf:
  - "security"
  - "reliability"
---

# Django — FAI Standards

## Model Best Practices

- Every model must define `class Meta` with `ordering`, `verbose_name`, and `verbose_name_plural`
- Add `db_index=True` on fields used in `filter()`, `order_by()`, or `exclude()` queries
- Use `UniqueConstraint` and `CheckConstraint` in `Meta.constraints` instead of field-level `unique=True` for composite rules
- Define `__str__` on every model — admin and debugging depend on it
- Use `validators=[...]` on model fields for domain rules; reserve `clean()` for cross-field validation
- Prefer `UUIDField(default=uuid.uuid4)` as primary key for public-facing APIs — never expose auto-increment IDs
- Use `related_name` on every `ForeignKey` and `ManyToManyField` — avoid `foo_set` reverse lookups

```python
# ✅ Preferred model pattern
from django.db import models
from django.core.validators import MinValueValidator

class Product(models.Model):
    name = models.CharField(max_length=200, db_index=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    category = models.ForeignKey("Category", on_delete=models.PROTECT, related_name="products")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.CheckConstraint(check=models.Q(price__gte=0), name="product_price_positive")]

    def __str__(self):
        return self.name
```

## Views & URL Patterns

- Use `path()` with typed converters — never raw regex unless `re_path()` is truly needed
- Prefer class-based views (`ListView`, `DetailView`, `CreateView`) for CRUD; use function views for one-off logic
- Use `LoginRequiredMixin` / `PermissionRequiredMixin` on CBVs — never check `request.user` manually in every view
- Return `JsonResponse` with explicit `status` codes — never bare `HttpResponse` with JSON strings
- Apply `@require_http_methods(["GET", "POST"])` on function views to reject unexpected methods

```python
# ✅ URL patterns with typed converters
from django.urls import path
from . import views

urlpatterns = [
    path("products/", views.ProductListView.as_view(), name="product-list"),
    path("products/<int:pk>/", views.ProductDetailView.as_view(), name="product-detail"),
]
```

## ORM Query Optimization

- Use `select_related("fk_field")` for ForeignKey / OneToOneField joins — eliminates N+1 queries
- Use `prefetch_related("m2m_field")` for ManyToMany / reverse FK — batches into 2 queries
- Use `.only("field1", "field2")` or `.defer("large_field")` to limit column fetches
- Call `QuerySet.explain()` during development to verify index usage and scan types
- Use `.iterator(chunk_size=2000)` for large result sets to avoid loading all rows into memory
- Never call `.count()` + `.all()` separately — use `len()` if you need both, or paginate with `Paginator`

```python
# ❌ N+1 query — fires one query per product for category
products = Product.objects.all()
for p in products:
    print(p.category.name)

# ✅ Single JOIN query
products = Product.objects.select_related("category").all()
for p in products:
    print(p.category.name)
```

## Settings Management

- Split settings: `settings/base.py`, `settings/dev.py`, `settings/prod.py` — import from base
- Use `django-environ` or `os.environ.get()` for secrets — never hardcode `SECRET_KEY`, database credentials, or API keys
- Set `DJANGO_SETTINGS_MODULE` via environment variable — not in code
- Keep `DEBUG = False` in production; enforce via environment check in `prod.py`
- Define `ALLOWED_HOSTS` explicitly — never `["*"]` in production

## Security Middleware & Headers

- `SecurityMiddleware` must be first in `MIDDLEWARE` — enables HSTS, SSL redirect, content-type sniffing protection
- Set `SECURE_HSTS_SECONDS = 31536000`, `SECURE_HSTS_INCLUDE_SUBDOMAINS = True`, `SECURE_HSTS_PRELOAD = True`
- Enable `SECURE_SSL_REDIRECT = True` in production
- `CSRFViewMiddleware` must remain active — never disable it globally; use `@csrf_exempt` sparingly with documentation
- Set `SESSION_COOKIE_SECURE = True`, `CSRF_COOKIE_SECURE = True`, `SESSION_COOKIE_HTTPONLY = True`
- Add CSP headers via `django-csp` middleware — default-src 'self', restrict inline scripts

## Django REST Framework

- Use `ModelSerializer` with explicit `fields` list — never `fields = "__all__"` (leaks new fields automatically)
- Apply `permission_classes` on every viewset — default to `IsAuthenticated`
- Use `throttle_classes` for rate limiting — `AnonRateThrottle` and `UserRateThrottle`
- Paginate all list endpoints — set `DEFAULT_PAGINATION_CLASS` in DRF settings
- Use `SerializerMethodField` for computed fields; keep serializer logic out of views

```python
# ✅ Explicit serializer with controlled fields
class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Product
        fields = ["id", "name", "price", "category_name", "created_at"]
        read_only_fields = ["id", "created_at"]
```

## Migrations & Signals

- Run `makemigrations` and `migrate` in CI — never skip migration checks
- Use `RunPython` with `reverse_code` for data migrations — always make them reversible
- Prefer overriding `Model.save()` over signals for single-model side effects — signals hide control flow
- Use signals only for decoupled cross-app events (e.g., user creation triggers profile creation)
- Never import models at module level in signals — use `apps.get_model()` inside the handler
- Add `--check` flag to `makemigrations` in CI to catch uncommitted schema changes

## Template Security

- Use `{{ variable }}` (auto-escaped) — never `{{ variable|safe }}` unless content is explicitly sanitized
- Use `{% url 'name' %}` for all links — never hardcode URL paths in templates
- Mark output of `format_html()` as safe — never concatenate raw HTML strings
- Validate and sanitize user-uploaded file types — never serve uploads from the same domain without checks

## Anti-Patterns

- ❌ `fields = "__all__"` in serializers or `ModelForm` — leaks fields added later
- ❌ Calling `len(queryset)` to check existence — use `queryset.exists()` instead
- ❌ `ForeignKey(on_delete=models.CASCADE)` without considering data integrity — use `PROTECT` or `SET_NULL` where appropriate
- ❌ Business logic in views — extract to model methods or service layer
- ❌ Raw SQL via `cursor.execute()` without parameterized queries — SQL injection risk
- ❌ Disabling CSRF globally or using `@csrf_exempt` without API token auth replacement
- ❌ `DEBUG = True` in production — exposes settings, tracebacks, and SQL queries
- ❌ Storing uploaded files in `MEDIA_ROOT` without filename sanitization
- ❌ Unbounded `queryset.all()` in API endpoints without pagination
- ❌ Catching bare `except Exception` in views — let Django's error handling return proper 500s

## WAF Alignment

| Pillar | Django Practice |
|--------|----------------|
| **Security** | SecurityMiddleware first, HSTS + CSP headers, CSRF protection, `@csrf_exempt` only with token auth, parameterized queries, `SESSION_COOKIE_SECURE`, no `DEBUG=True` in prod |
| **Reliability** | Database connection pooling via `django-db-connection-pool`, health check at `/health/`, graceful SIGTERM handling in ASGI/Gunicorn, migration rollback with `reverse_code` |
| **Cost Optimization** | `select_related`/`prefetch_related` to reduce DB round-trips, `.only()`/`.defer()` to limit data transfer, `Paginator` to bound response sizes, `django.core.cache` with Redis backend |
| **Operational Excellence** | Structured logging via `django-structlog`, split settings per environment, `makemigrations --check` in CI, `django-health-check` for dependency monitoring |
| **Performance Efficiency** | QuerySet `.iterator()` for large scans, database indexes on filter/order fields, `Meta.constraints` for DB-level validation, `@cached_property` for expensive model computations |
| **Responsible AI** | Input sanitization before LLM calls, PII redaction in logs, content safety checks on AI-generated template output, audit trail on AI-assisted actions |
