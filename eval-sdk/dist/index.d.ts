/**
 * @frootai/eval-sdk — typed client for the FrootAI Eval-as-Service API.
 *
 * Mirrors `frootai-cloud/eval/openapi.yaml` (v0.1.0). Zero runtime dependencies;
 * uses the global `fetch` (Node 18+, edge runtimes, browsers).
 *
 * Tracker: P2.4.008 · See https://frootai.dev/methodology/eval
 */
export type MetricType = "deterministic" | "non-deterministic";
export type EvalRunStatus = "pending" | "running" | "completed" | "failed";
export interface MetricResult {
    metric: string;
    score: number;
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
export declare class EvalApiError extends Error {
    readonly status: number;
    readonly body: unknown;
    constructor(status: number, message: string, body: unknown);
}
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
export declare class EvalClient {
    private readonly baseUrl;
    private readonly token?;
    private readonly fetchImpl;
    private readonly timeoutMs;
    constructor(options?: EvalClientOptions);
    private request;
    /** Trigger an eval suite against a manifest + output. */
    createRun(req: CreateEvalRunRequest): Promise<EvalRun>;
    /** Get eval run results by id. */
    getRun(id: string): Promise<EvalRun>;
    /** Get the eval dataset for a play slug. */
    getDataset(slug: string): Promise<Dataset>;
    /** Create a scheduled eval run. */
    createSchedule(req: CreateScheduleRequest): Promise<Schedule>;
    /** List the tenant's eval schedules. */
    listSchedules(): Promise<Schedule[]>;
    /** Delete a schedule by id. */
    deleteSchedule(id: string): Promise<void>;
    /** Mint a tenant-scoped, eval-only CI token (default 90-day expiry). */
    mintCiToken(opts?: {
        label?: string;
        expiresInDays?: number;
    }): Promise<CiToken>;
    /** Liveness probe. */
    health(): Promise<Health>;
}
export default EvalClient;
//# sourceMappingURL=index.d.ts.map