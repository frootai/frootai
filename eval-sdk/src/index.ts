/**
 * @frootai/eval-sdk — typed client for the FrootAI Eval-as-Service API.
 *
 * Mirrors `frootai-cloud/eval/openapi.yaml` (v0.1.0). Zero runtime dependencies;
 * uses the global `fetch` (Node 18+, edge runtimes, browsers).
 *
 * Tracker: P2.4.008 · See https://frootai.dev/methodology/eval
 */

// ── Types (mirror the OpenAPI schemas) ───────────────────────────────────

export type MetricType = "deterministic" | "non-deterministic";
export type EvalRunStatus = "pending" | "running" | "completed" | "failed";

export interface MetricResult {
  metric: string;
  score: number; // 0..1
  confidence: number | null;
  type: MetricType;
  threshold: number | null;
  passed: boolean;
}

export interface RegressionDetail {
  metric: string;
  previousScore: number;
  currentScore: number;
  delta: number;
  deltaPercent: number;
  regressed: boolean;
  reason: string;
}

export interface EvalRun {
  id: string;
  tenantId: string;
  manifestSlug: string;
  suiteName: string;
  status: EvalRunStatus;
  results: MetricResult[];
  regressed: boolean;
  regressionDetails: RegressionDetail[];
  createdAt: string;
  completedAt: string | null;
}

export interface CreateEvalRunRequest {
  manifestSlug: string;
  suite: string;
  output: string;
  manifestVersion?: string;
  manifest?: Record<string, unknown>;
  input?: Record<string, unknown>;
  context?: string;
  thresholds?: Record<string, number>;
}

export interface DatasetCase {
  id: string;
  input: Record<string, unknown>;
  expected: string;
  judge: string;
  maintainer: string;
}

export interface Dataset {
  slug: string;
  cases: DatasetCase[];
  totalCases: number;
}

export interface Schedule {
  id: string;
  tenantId: string;
  manifestSlug: string;
  suite: string;
  cron: string;
  createdAt: string;
}

export interface CreateScheduleRequest {
  manifestSlug: string;
  suite: string;
  cron: string;
}

export interface CiToken {
  token: string;
  label: string | null;
  expiresAt: string;
}

export interface Health {
  status: "ok";
  service: string;
  version: string;
}

// ── Errors ───────────────────────────────────────────────────────────────

export class EvalApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "EvalApiError";
    this.status = status;
    this.body = body;
  }
}

// ── Client ───────────────────────────────────────────────────────────────

export interface EvalClientOptions {
  /** Base URL of the eval API. Default: https://eval.api.frootai.cloud */
  baseUrl?: string;
  /** Bearer token (tenant JWT or a CI token from `mintCiToken`). */
  token?: string;
  /** Custom fetch (defaults to global fetch). */
  fetch?: typeof fetch;
  /** Per-request timeout in ms. Default: 30000. */
  timeoutMs?: number;
}

const DEFAULT_BASE_URL = "https://eval.api.frootai.cloud";

export class EvalClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: EvalClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.token = options.token ?? process.env.FROOTAI_EVAL_TOKEN;
    const f = options.fetch ?? globalThis.fetch;
    if (!f) {
      throw new Error(
        "No fetch implementation found. Provide options.fetch (Node < 18) or run on Node 18+."
      );
    }
    this.fetchImpl = f;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  // ── HTTP core ──────────────────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (this.token) headers.Authorization = `Bearer ${this.token}`;
      if (body !== undefined) headers["Content-Type"] = "application/json";

      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await res.text();
      const parsed = text ? safeJson(text) : undefined;

      if (!res.ok) {
        const message =
          (parsed && typeof parsed === "object" && "error" in parsed
            ? String((parsed as { error?: unknown }).error)
            : res.statusText) || `HTTP ${res.status}`;
        throw new EvalApiError(res.status, message, parsed ?? text);
      }
      return parsed as T;
    } catch (err) {
      if (err instanceof EvalApiError) throw err;
      if ((err as Error)?.name === "AbortError") {
        throw new EvalApiError(0, `Request timed out after ${this.timeoutMs}ms`, null);
      }
      throw new EvalApiError(0, `Network error: ${(err as Error).message}`, null);
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Eval runs ──────────────────────────────────────────────────────────

  /** Trigger an eval suite against a manifest + output. */
  createRun(req: CreateEvalRunRequest): Promise<EvalRun> {
    return this.request<EvalRun>("POST", "/v1/eval/runs", req);
  }

  /** Get eval run results by id. */
  getRun(id: string): Promise<EvalRun> {
    return this.request<EvalRun>("GET", `/v1/eval/runs/${encodeURIComponent(id)}`);
  }

  // ── Datasets ───────────────────────────────────────────────────────────

  /** Get the eval dataset for a play slug. */
  getDataset(slug: string): Promise<Dataset> {
    return this.request<Dataset>(
      "GET",
      `/v1/eval/datasets/${encodeURIComponent(slug)}`
    );
  }

  // ── Schedules ──────────────────────────────────────────────────────────

  /** Create a scheduled eval run. */
  createSchedule(req: CreateScheduleRequest): Promise<Schedule> {
    return this.request<Schedule>("POST", "/v1/eval/schedules", req);
  }

  /** List the tenant's eval schedules. */
  async listSchedules(): Promise<Schedule[]> {
    const out = await this.request<{ schedules: Schedule[] }>(
      "GET",
      "/v1/eval/schedules"
    );
    return out.schedules ?? [];
  }

  /** Delete a schedule by id. */
  async deleteSchedule(id: string): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/v1/eval/schedules/${encodeURIComponent(id)}`
    );
  }

  // ── CI token ───────────────────────────────────────────────────────────

  /** Mint a tenant-scoped, eval-only CI token (default 90-day expiry). */
  mintCiToken(opts: { label?: string; expiresInDays?: number } = {}): Promise<CiToken> {
    return this.request<CiToken>("POST", "/v1/eval/api/ci-token", opts);
  }

  // ── Health ─────────────────────────────────────────────────────────────

  /** Liveness probe. */
  health(): Promise<Health> {
    return this.request<Health>("GET", "/health");
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export default EvalClient;
