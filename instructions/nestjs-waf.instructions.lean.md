---
description: "NestJS standards — DI, decorators, modular architecture, Pipes validation, and TypeORM patterns."
applyTo: "**/*.ts"
waf:
  - "reliability"
  - "security"
---

# NestJS — FAI Standards

## Module Organization

- One feature module per domain (`UsersModule`, `OrdersModule`) — never dump everything in `AppModule`
- `SharedModule` with `@Global()` for cross-cutting providers (Logger, ConfigService, CacheService)
- Barrel exports — only expose what consumers need via `exports: []`, keep repos private
- Lazy-load heavy modules with `LazyModuleLoader` to reduce cold-start time

## Dependency Injection

- Constructor injection only — never use `ModuleRef.get()` outside factories
- `@Inject(TOKEN)` with `InjectionToken` for interfaces — NestJS can't resolve interfaces directly
- `useClass` for swappable impls, `useFactory` for async setup, `useValue` for constants
- `Scope.REQUEST` only when truly needed — it propagates to all dependents, kills singleton perf

```typescript
const AI_CLIENT = Symbol('AI_CLIENT');
const aiProvider: Provider = {
  provide: AI_CLIENT,
  useFactory: async (config: ConfigService) => {
    return new OpenAIClient(config.getOrThrow('AZURE_OPENAI_ENDPOINT'), new DefaultAzureCredential());
  },
  inject: [ConfigService],
};
```

## Request Pipeline (Guards → Interceptors → Pipes → Handler → Filters)

- **Guards** for authZ — return `boolean`, throw `ForbiddenException`. Bind globally via `APP_GUARD`
- **Interceptors** for cross-cutting: logging, response mapping, timeout. Use `tap()`/`map()` on Observable
- **Pipes** — always apply `ValidationPipe` globally with `whitelist: true`, `forbidNonWhitelisted: true`
- **Exception filters** map domain errors to HTTP — never leak stack traces

```typescript
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));
```

## DTOs with class-validator / class-transformer

- One DTO per operation: `CreateOrderDto`, `UpdateOrderDto`, `OrderResponseDto`
- `PartialType()`, `PickType()`, `OmitType()` from `@nestjs/mapped-types` — never duplicate fields
- `@Exclude()` sensitive fields on response DTOs, apply `ClassSerializerInterceptor` globally
- Nested: `@ValidateNested()` + `@Type(() => ChildDto)` — both required

```typescript
export class CreateOrderDto {
  @IsString() @IsNotEmpty() customerId: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => OrderItemDto) items: OrderItemDto[];
  @IsOptional() @IsEnum(Priority) priority?: Priority = Priority.NORMAL;
}
```

## Database Integration

- **TypeORM**: `@InjectRepository(Entity)` — never inject `DataSource` in services. Migrations over `synchronize: true` (dev-only). `QueryRunner` for transactions, `release()` in `finally`. No eager relations — explicit `find({ relations })`
- **Prisma**: `PrismaService` extending `OnModuleInit`/`OnModuleDestroy`. `$on('query')` dev-only. `$transaction([])` for batch, interactive for complex flows

## ConfigModule with Validation

- `ConfigModule.forRoot({ isGlobal: true, validationSchema })` — validate at boot, fail fast
- `ConfigService.getOrThrow<T>()` — never use raw `process.env`

```typescript
ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: Joi.object({
    DATABASE_URL: Joi.string().uri().required(),
    AZURE_OPENAI_ENDPOINT: Joi.string().uri().required(),
    PORT: Joi.number().default(3000),
  }),
})
```

## Health Checks (Terminus)

- `TerminusModule` — check DB, Redis, external APIs
- Separate `/health/live` (process alive) from `/health/ready` (can serve traffic)
- Custom health indicators for domain checks (queue depth, model availability)

## Swagger / OpenAPI

- `@ApiTags()` per controller, `@ApiOperation()` per endpoint, `@ApiResponse()` per status
- `@ApiBearerAuth()` on protected controllers — generate client SDKs from spec

## CQRS, Microservices, WebSockets

- **CQRS**: `@nestjs/cqrs` — `CommandHandler` (writes) vs `QueryHandler` (reads). Events for side-effects. Sagas for long-running workflows
- **Microservices**: `ClientProxy` abstracts transport (TCP/Redis/NATS/gRPC/Kafka). `@MessagePattern()` for request-response, `@EventPattern()` for fire-and-forget. Always use `@Payload()`/`@Ctx()` explicitly
- **WebSockets**: `@WebSocketGateway()` + `@SubscribeMessage()`. Use `WsException` not `HttpException`. Auth in `handleConnection()`, not per-message

## Caching

- `CacheModule.register()` with Redis store for multi-instance deployments
- `@CacheKey()`+`@CacheTTL()` on GET handlers or `CacheInterceptor` per controller
- Manual `cacheManager.del()` on mutations — stale cache is worse than no cache

## Testing

- `Test.createTestingModule()` — override providers with `.overrideProvider().useValue(mock)`
- Never import real DB module in unit tests — mock the repository
- `supertest` with `app.getHttpAdapter()` for e2e — tests full pipeline (guards, pipes, filters)
- `moduleRef.close()` in `afterAll` — prevents Jest open handle warnings

```typescript
const module = await Test.createTestingModule({
  providers: [OrdersService, { provide: getRepositoryToken(Order), useValue: mockRepo }],
}).compile();
```

## Anti-Patterns

- ❌ Business logic in controllers — controllers only parse input, call service, return response
- ❌ `synchronize: true` in production TypeORM config — data loss risk
- ❌ Catching exceptions in controllers — use exception filters
- ❌ `Scope.REQUEST` on shared services — destroys singleton performance, cascades to every consumer
- ❌ `@Res()` passthrough in controllers — breaks interceptors and serialization
- ❌ Circular dependencies — refactor with `forwardRef()` only as a last resort, prefer events
- ❌ Raw SQL in services — use QueryBuilder or repositories
- ❌ Missing `whitelist: true` on ValidationPipe — allows mass-assignment attacks
- ❌ God modules with 20+ providers — split by domain

## WAF Alignment

| Pillar | NestJS Practice |
| --- | --- |
| **Security** | Global `ValidationPipe` with whitelist, `@UseGuards(AuthGuard)`, helmet middleware, CORS allowlist, rate limiting via `ThrottlerModule` |
| **Reliability** | Terminus health checks, graceful `enableShutdownHooks()`, circuit breakers in `HttpService` interceptors, retry on transient DB errors |
| **Cost** | `CacheInterceptor` on read-heavy endpoints, connection pooling (TypeORM `extra.max`), lazy module loading, right-sized Fastify over Express |
| **Ops Excellence** | Structured logging with `PinoLogger` or `WinstonModule`, OpenTelemetry via `@opentelemetry/nestjs`, correlation IDs in `ClsModule`, Swagger auto-gen |
| **Performance** | Fastify adapter, streaming with `StreamableFile`, `@nestjs/bull` for background jobs, `compression()` middleware, `@CacheTTL()` on hot paths |
| **Responsible AI** | Content safety middleware on AI endpoints, input sanitization pipes, audit logging interceptors, output filtering before response |
