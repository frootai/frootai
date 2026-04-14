---
description: "TypeScript security standards — XSS prevention, CSP headers, input sanitization, dependency audit."
applyTo: "**/*.ts, **/*.tsx"
waf:
  - "security"
---

# TypeScript Security Patterns — FAI Standards

## Input Validation

Validate at system boundaries before any processing. Reject unknown fields.

```typescript
import { z } from "zod";

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(4000).trim(),
  sessionId: z.string().uuid(),
  temperature: z.number().min(0).max(1).default(0.3),
});
type ChatRequest = z.infer<typeof ChatRequestSchema>;

// Express route — parse throws on invalid input
app.post("/chat", (req, res) => {
  const body = ChatRequestSchema.parse(req.body); // 400 on failure
});
```

Joi alternative for legacy codebases: `Joi.object({ message: Joi.string().required().max(4000) }).options({ stripUnknown: true })`.

## XSS Prevention

Sanitize all user-generated HTML before rendering. Set CSP headers at the middleware layer.

```typescript
import DOMPurify from "isomorphic-dompurify";
const safeHtml = DOMPurify.sanitize(userInput, { ALLOWED_TAGS: ["b", "i", "a"], ALLOWED_ATTR: ["href"] });

// CSP via helmet (see Security Headers section)
// Never use dangerouslySetInnerHTML with unsanitized content
// Never construct HTML via string concatenation with user input
```

## SQL Injection Prevention

Always use parameterized queries. ORMs like Prisma are safe by default — never drop to raw SQL with interpolation.

```typescript
// Prisma — safe by default
const user = await prisma.user.findUnique({ where: { id: userId } });

// Raw query — MUST use parameterized form
const results = await prisma.$queryRaw`SELECT * FROM users WHERE email = ${email}`;
// ❌ NEVER: prisma.$queryRawUnsafe(`SELECT * FROM users WHERE email = '${email}'`)
```

## CORS Configuration

Explicit origin allowlist. Never use `*` in production.

```typescript
import cors from "cors";
app.use(cors({
  origin: ["https://app.contoso.com", "https://admin.contoso.com"],
  methods: ["GET", "POST"],
  credentials: true,
  maxAge: 86400,
}));
```

## Secrets Management

No secrets in source code. Use env vars for local dev, Azure Key Vault SDK for production.

```typescript
import { SecretClient } from "@azure/keyvault-secrets";
import { DefaultAzureCredential } from "@azure/identity";

const client = new SecretClient("https://my-vault.vault.azure.net", new DefaultAzureCredential());
const apiKey = (await client.getSecret("openai-api-key")).value;
// Local dev: process.env.OPENAI_API_KEY via .env (gitignored)
// ❌ NEVER: const key = "sk-abc123..." in source
```

## JWT Verification

Use `jose` for token verification. Always validate issuer, audience, and expiration.

```typescript
import { jwtVerify, createRemoteJWKSet } from "jose";

const JWKS = createRemoteJWKSet(new URL("https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys"));
const { payload } = await jwtVerify(token, JWKS, {
  issuer: "https://login.microsoftonline.com/{tenant}/v2.0",
  audience: "api://my-app-client-id",
});
// ❌ NEVER: jwt.decode(token) without verification
// ❌ NEVER: algorithms: ["none"] or disabling expiration checks
```

## HTTPS Enforcement

Redirect HTTP → HTTPS. Enforce HSTS in production.

```typescript
app.use((req, res, next) => {
  if (req.header("x-forwarded-proto") !== "https" && process.env.NODE_ENV === "production") {
    return res.redirect(301, `https://${req.hostname}${req.url}`);
  }
  next();
});
// HSTS handled by helmet (see Security Headers)
```

## Rate Limiting

Per-user/IP rate limiting at the middleware layer. Keyed by authenticated user when available.

```typescript
import rateLimit from "express-rate-limit";
app.use("/api/", rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  keyGenerator: (req) => req.user?.id ?? req.ip,
  message: { error: "Rate limit exceeded. Retry after window reset." },
}));
```

## Security Headers (Helmet)

```typescript
import helmet from "helmet";
app.use(helmet({
  contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"] } },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));
```

## CSRF Protection

Use `csurf` or double-submit cookie pattern on state-changing endpoints.

```typescript
import csrf from "csurf";
app.use(csrf({ cookie: { httpOnly: true, sameSite: "strict", secure: true } }));
app.get("/form", (req, res) => res.json({ csrfToken: req.csrfToken() }));
// Client sends token in X-CSRF-Token header on POST/PUT/DELETE
```

## Path Traversal Prevention

Resolve paths and validate against an allowed base directory.

```typescript
import path from "node:path";
const UPLOAD_DIR = path.resolve("/app/uploads");
function safePath(userInput: string): string {
  const resolved = path.resolve(UPLOAD_DIR, userInput);
  if (!resolved.startsWith(UPLOAD_DIR)) throw new Error("Path traversal blocked");
  return resolved;
}
```

## Prototype Pollution Prevention

Freeze prototypes on startup. Reject `__proto__`, `constructor`, `prototype` keys in parsed JSON.

```typescript
Object.freeze(Object.prototype);
// Use Map instead of plain objects for user-keyed data
// Validate with zod .strict() — rejects unknown keys including __proto__
```

## Dependency Scanning

- `npm audit --audit-level=high` in CI — fail on high/critical vulnerabilities
- `npx socket scan` (socket.dev) for supply-chain risk detection
- Pin exact versions in `package-lock.json`, enable Dependabot/Renovate
- Review `postinstall` scripts before adding new dependencies

## Anti-Patterns

- ❌ `eval()`, `new Function()`, or `vm.runInNewContext()` with user input
- ❌ `dangerouslySetInnerHTML` without DOMPurify sanitization
- ❌ String-interpolated SQL: `` `WHERE id = '${id}'` ``
- ❌ `cors({ origin: "*" })` in production
- ❌ Storing secrets in source, environment files committed to git, or client bundles
- ❌ `jwt.decode()` without `jwtVerify()` — decode ≠ verify
- ❌ Disabling TLS certificate verification (`rejectUnauthorized: false`)
- ❌ `JSON.parse(untrusted)` without schema validation (prototype pollution vector)
- ❌ Dependencies with `postinstall` scripts not reviewed for malicious code

## WAF Alignment

| Pillar | TypeScript Security Controls |
|--------|------------------------------|
| **Security** | Zod input validation, DOMPurify XSS sanitization, Prisma parameterized queries, helmet CSP/HSTS, jose JWT verification, Key Vault secrets, CSRF double-submit, path traversal guards |
| **Reliability** | Rate limiting prevents resource exhaustion, input validation rejects malformed requests early, CORS blocks unauthorized origins |
| **Cost Optimization** | Early input rejection avoids wasted compute, rate limiting caps per-user resource consumption, dependency audit prevents incident costs |
| **Operational Excellence** | `npm audit` + socket.dev in CI pipeline, Dependabot automated PRs, structured error responses with correlation IDs |
| **Performance Efficiency** | Zod schema parsing is ~10μs per validation, helmet headers cached per response, JWKS cached via `createRemoteJWKSet` |
| **Responsible AI** | Input sanitization blocks prompt injection vectors, content length limits prevent token abuse, CSRF protects state-changing AI endpoints |
