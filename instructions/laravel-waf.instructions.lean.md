---
description: "Laravel standards — Eloquent, Blade, Artisan, queue workers, and security."
applyTo: "**/*.php"
waf:
  - "reliability"
  - "security"
---

# Laravel — FAI Standards

## Eloquent Best Practices

- Define `$fillable` on every model — never use `$guarded = []` in production
- Use query scopes for reusable filters; name them after the domain concept
- Accessors/mutators use the `Attribute` cast syntax (Laravel 9+)
- Always eager-load relationships to prevent N+1 — enforce with `Model::preventLazyLoading()`

```php
class Order extends Model
{
    protected $fillable = ['user_id', 'status', 'total_cents', 'shipped_at'];

    protected function totalCents(): Attribute
    {
        return Attribute::make(
            get: fn (int $value) => $value / 100,
            set: fn (float $value) => (int) ($value * 100),
        );
    }

    public function scopeCompleted(Builder $query): Builder
    {
        return $query->where('status', 'completed');
    }

    public function scopeForUser(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }
}

// Usage: Order::completed()->forUser($id)->with('items')->paginate(25);
```

- Use `firstOrCreate` / `updateOrCreate` for idempotent upserts
- Prefer chunking (`chunkById`) over `get()` for large datasets
- Cast columns: `protected $casts = ['metadata' => 'array', 'shipped_at' => 'datetime'];`

## Routing & Controllers

- Route model binding for all resource endpoints — never manually `findOrFail`
- Thin controllers: validate → delegate to service/action → return resource
- Group routes with middleware: `Route::middleware(['auth:sanctum'])->group(...)`

```php
// routes/api.php
Route::apiResource('orders', OrderController::class);

// Controller — thin, delegates to action class
class OrderController extends Controller
{
    public function store(StoreOrderRequest $request, CreateOrderAction $action): OrderResource
    {
        return new OrderResource($action->execute($request->validated()));
    }

    public function show(Order $order): OrderResource // route model binding
    {
        return new OrderResource($order->load('items'));
    }
}
```

## Form Requests & Validation

- One FormRequest per endpoint — never validate inline in controllers
- Authorization logic lives in `authorize()` method, not middleware

```php
class StoreOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Order::class);
    }

    public function rules(): array
    {
        return [
            'items'            => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.quantity'   => ['required', 'integer', 'min:1', 'max:100'],
            'coupon_code'      => ['nullable', 'string', 'exists:coupons,code'],
        ];
    }
}
```

## Service / Action Classes

- Single-responsibility action classes for business operations — one public `execute()` method
- Services wrap external integrations (payment gateways, APIs) — inject via constructor

```php
class CreateOrderAction
{
    public function __construct(
        private readonly PricingService $pricing,
        private readonly InventoryService $inventory,
    ) {}

    public function execute(array $data): Order
    {
        return DB::transaction(function () use ($data) {
            $this->inventory->reserve($data['items']);
            $order = Order::create([
                'user_id'     => auth()->id(),
                'status'      => 'pending',
                'total_cents' => $this->pricing->calculate($data['items']),
            ]);
            $order->items()->createMany($data['items']);
            OrderCreated::dispatch($order);
            return $order;
        });
    }
}
```

## Queues & Jobs

- All long-running work dispatched to queues — never block HTTP requests
- Implement `ShouldQueue`, set `$tries`, `$backoff`, and `$maxExceptions`
- Use `release()` with backoff for transient failures; `fail()` for permanent errors

```php
class ProcessPayment implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public array $backoff = [10, 60, 300]; // seconds between retries
    public int $maxExceptions = 2;

    public function __construct(public readonly Order $order) {}

    public function handle(PaymentGateway $gateway): void
    {
        $gateway->charge($this->order->total_cents, $this->order->user->payment_method);
        $this->order->update(['status' => 'paid']);
    }

    public function failed(\Throwable $e): void
    {
        $this->order->update(['status' => 'payment_failed']);
        Log::error('Payment failed', ['order' => $this->order->id, 'error' => $e->getMessage()]);
    }
}
```

## Events & Listeners

- Dispatch domain events from actions — decouple side effects via listeners
- Listeners that do I/O must implement `ShouldQueue`

```php
// Event
class OrderCreated { public function __construct(public readonly Order $order) {} }

// Listener — queued
class SendOrderConfirmation implements ShouldQueue
{
    public function handle(OrderCreated $event): void
    {
        Mail::to($event->order->user)->send(new OrderConfirmationMail($event->order));
    }
}
```

## API Resources

- API Resources for all JSON responses — never return raw models or arrays
- Use `whenLoaded()` to conditionally include relationships

```php
class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'status'     => $this->status,
            'total'      => $this->total_cents, // accessor formats it
            'items'      => OrderItemResource::collection($this->whenLoaded('items')),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
```

## Authentication

- API auth: Laravel Sanctum for SPA + token-based; Passport only when OAuth2 flows required
- Protect routes with `auth:sanctum` middleware — never leave API routes unguarded
- Scope tokens: `$user->createToken('api', ['orders:read'])`
- Rate limit auth endpoints: `RateLimiter::for('login', fn () => Limit::perMinute(5))`

## Migrations & Seeding

- Every `up()` must have a reversible `down()` — never leave `down()` empty
- Add indexes on foreign keys and frequently-queried columns
- Use `after()` for column ordering; `nullOnDelete()` for optional foreign keys
- Seeders: `DatabaseSeeder` calls domain seeders; factories for test data only

```php
Schema::create('orders', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->string('status', 20)->default('pending')->index();
    $table->unsignedInteger('total_cents');
    $table->timestamp('shipped_at')->nullable();
    $table->timestamps();
});
```

## Testing

- Use Pest with `RefreshDatabase` trait — Tests\Feature for HTTP, Tests\Unit for isolated logic
- Factory states for domain scenarios; assert database state, not implementation
- Mock external services with `Http::fake()` and `Queue::fake()`

```php
it('creates an order', function () {
    $user = User::factory()->create();
    $product = Product::factory()->create(['price_cents' => 1999]);

    $response = actingAs($user)->postJson('/api/orders', [
        'items' => [['product_id' => $product->id, 'quantity' => 2]],
    ]);

    $response->assertCreated()->assertJsonPath('data.status', 'pending');
    expect(Order::count())->toBe(1);
    Queue::assertPushed(ProcessPayment::class);
});
```

## Configuration & Caching

- All secrets via `.env` — access only through `config()` helper, never `env()` outside config files
- Cache config/routes/views in production: `php artisan config:cache && route:cache && view:cache`
- Use `cache()->remember()` with TTL for expensive queries; tag-based invalidation with Redis

## Blade & Frontend

- Blade Components (`<x-alert type="error">`) over `@include` — typed props, encapsulated logic
- Escape output by default (`{{ }}`) — use `{!! !!}` only for trusted, sanitized HTML
- Anonymous components for presentational markup; class components when logic needed

## Middleware

- Custom middleware for cross-cutting: locale detection, team tenancy, request logging
- Register in `bootstrap/app.php` (Laravel 11+) — avoid stuffing logic into global middleware
- Terminate middleware for post-response work (telemetry flush, audit logging)

## Anti-Patterns

- ❌ `$guarded = []` — allows mass-assignment of any column
- ❌ `env()` calls outside `config/` files — returns `null` when config is cached
- ❌ Business logic in controllers — extract to action/service classes
- ❌ Raw SQL without parameter binding — SQL injection risk
- ❌ `Model::all()` without pagination or chunking — OOM on large tables
- ❌ Synchronous mail/notification sending in HTTP requests — use queues
- ❌ Missing `down()` in migrations — blocks safe rollbacks
- ❌ `dd()` or `dump()` committed to source — use structured logging
- ❌ Fat models with 50+ methods — split with traits, scopes, and action classes
- ❌ Storing uploaded files locally in production — use `Storage::disk('s3')`

## WAF Alignment

| Pillar | Laravel Practice |
| --- | --- |
| **Security** | Sanctum/Passport auth, CSRF via `@csrf`, `$fillable` mass-assignment, parameterized queries, rate limiting, `Hash::make()`, encrypted `.env` |
| **Reliability** | Queue retries with `$backoff`, DB transactions, health checks via `php artisan schedule:test`, failed job monitoring, circuit breaker middleware |
| **Cost Optimization** | Query caching (`cache()->remember`), eager loading (kill N+1), config/route/view caching, queue batching, right-sized Horizon workers |
| **Operational Excellence** | `php artisan` commands, scheduled tasks, structured logging (Monolog + JSON), Telescope in dev, Horizon dashboard, CI with `php artisan test` |
| **Performance** | Redis for cache/session/queue, database indexes, lazy collections for streaming, pagination, octane for long-lived workers |
| **Responsible AI** | Validate + sanitize all user input via FormRequests, log without PII, audit trail via model observers, content filtering on AI outputs |
