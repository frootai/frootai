---
description: "Zod validation standards — schema design, type inference, transform, error messages, API input validation."
applyTo: "**/*.ts"
waf:
  - "security"
  - "reliability"
---

# Zod — FAI Standards

## Schema Definition

```ts
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["admin", "editor", "viewer"]),
  tags: z.array(z.string().min(1)).max(20),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Discriminated unions — exhaustive matching on a literal field
const EventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("click"), x: z.number(), y: z.number() }),
  z.object({ type: z.literal("scroll"), offset: z.number() }),
  z.object({ type: z.literal("keypress"), key: z.string() }),
]);
```

## Type Inference

```ts
type User = z.infer<typeof UserSchema>;          // extract TS type from schema
type Event = z.infer<typeof EventSchema>;         // union type auto-derived
type CreateUser = z.input<typeof UserSchema>;     // input type (before transforms)
```

## Refinements

```ts
const PasswordSchema = z.string().min(8).refine(
  (v) => /[A-Z]/.test(v) && /\d/.test(v),
  { message: "Must contain uppercase letter and digit" }
);

// Cross-field validation with superRefine
const SignupSchema = z.object({
  password: z.string().min(8),
  confirm: z.string(),
}).superRefine((data, ctx) => {
  if (data.password !== data.confirm) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Passwords must match", path: ["confirm"] });
  }
});
```

## Transforms & Pipes

```ts
const TrimmedEmail = z.string().trim().toLowerCase().email();
const MoneySchema = z.string()
  .transform((v) => parseFloat(v.replace(/[^0-9.]/g, "")))
  .pipe(z.number().positive().finite());
```

## Defaults & Optionals

```ts
const ConfigSchema = z.object({
  retries: z.number().int().min(0).default(3),
  timeout: z.number().positive().default(30_000),
  verbose: z.boolean().optional(),
});
```

## Error Handling

```ts
const result = UserSchema.safeParse(req.body);      // prefer safeParse at system boundaries
if (!result.success) {
  const flat = result.error.flatten();               // { formErrors, fieldErrors }
  return res.status(400).json({ errors: flat.fieldErrors });
}
const user: User = result.data;
// parse only in trusted contexts (startup config, tests)
const config = ConfigSchema.parse(loadedConfig);     // throws ZodError on failure
```

## Coercion

```ts
const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  active: z.coerce.boolean().default(true),
});
```

## Schema Composition

```ts
const BaseEntity = z.object({ id: z.string().uuid(), createdAt: z.coerce.date() });
const WithTimestamps = BaseEntity.extend({ updatedAt: z.coerce.date() });
const CreateUserInput = UserSchema.omit({ id: true });
const UserSummary = UserSchema.pick({ id: true, email: true });
const Merged = BaseEntity.merge(UserSchema);
```

## Branded Types

```ts
const UserId = z.string().uuid().brand<"UserId">();
const OrderId = z.string().uuid().brand<"OrderId">();  // prevents accidental ID swap
```

## API Input Preprocessing

```ts
const ApiInputSchema = z.preprocess(
  (raw) => (typeof raw === "string" ? JSON.parse(raw) : raw),
  UserSchema
);
```

## React Hook Form Integration

```ts
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const form = useForm<z.infer<typeof SignupSchema>>({
  resolver: zodResolver(SignupSchema),
});
```

## tRPC Integration

```ts
export const userRouter = router({
  create: publicProcedure
    .input(CreateUserInput)             // Zod schema as input validator
    .mutation(({ input }) => db.user.create({ data: input })),
  list: publicProcedure
    .input(PaginationSchema)
    .query(({ input }) => db.user.findMany({ skip: (input.page - 1) * input.limit, take: input.limit })),
});
```

## Environment Variable Validation

```ts
const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  AZURE_OPENAI_KEY: z.string().min(1),
  PORT: z.coerce.number().int().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});
export const env = EnvSchema.parse(process.env);     // fail-fast at startup
```

## OpenAPI Generation

```ts
import { extendZodWithOpenApi } from "zod-to-openapi";
extendZodWithOpenApi(z);
const UserSchemaOA = UserSchema.openapi("User", { description: "Application user" });
```

## Anti-Patterns

| Anti-Pattern | Fix |
|---|---|
| `schema.parse()` in request handlers | Use `safeParse` — never throw in hot paths |
| `.any()` / `.unknown()` without narrowing | Add `.refine()` or `.pipe()` to validate shape |
| Duplicating TS types alongside Zod schemas | Derive types via `z.infer<typeof Schema>` |
| Skipping `.trim()` on string inputs | Chain `.trim()` before `.email()` / `.url()` |
| Hardcoded error messages without i18n key | Use `errorMap` or structured `message` objects |
| Coercing without upper bounds | Always chain `.max()` / `.finite()` after coerce |

## WAF Alignment

| Pillar | Practice |
|---|---|
| **Security** | Validate all external input at system boundaries; reject unknown keys with `.strict()`; branded types prevent ID mixups |
| **Reliability** | `safeParse` returns structured errors instead of throwing; `EnvSchema.parse(process.env)` fails fast at startup |
| **Cost Optimization** | Derive types from schemas to eliminate drift; schema composition reduces duplication |
| **Performance** | Coercion avoids manual parsing; `.pipe()` chains avoid intermediate allocations |
| **Operational Excellence** | Centralize schemas in a shared package; `zod-to-openapi` keeps spec in sync with code |
