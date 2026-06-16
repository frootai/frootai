/**
 * @frootai/eval-sdk — typed client for the FrootAI Eval-as-Service API.
 *
 * Mirrors `frootai-cloud/eval/openapi.yaml` (v0.1.0). Zero runtime dependencies;
 * uses the global `fetch` (Node 18+, edge runtimes, browsers).
 *
 * Tracker: P2.4.008 · See https://frootai.dev/methodology/eval
 */
// ── Errors ───────────────────────────────────────────────────────────────
export class EvalApiError extends Error {
    status;
    body;
    constructor(status, message, body) {
        super(message);
        this.name = "EvalApiError";
        this.status = status;
        this.body = body;
    }
}
const DEFAULT_BASE_URL = "https://eval.api.frootai.cloud";
export class EvalClient {
    baseUrl;
    token;
    fetchImpl;
    timeoutMs;
    constructor(options = {}) {
        this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
        this.token = options.token ?? process.env.FROOTAI_EVAL_TOKEN;
        const f = options.fetch ?? globalThis.fetch;
        if (!f) {
            throw new Error("No fetch implementation found. Provide options.fetch (Node < 18) or run on Node 18+.");
        }
        this.fetchImpl = f;
        this.timeoutMs = options.timeoutMs ?? 30_000;
    }
    // ── HTTP core ──────────────────────────────────────────────────────────
    async request(method, path, body) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const headers = { Accept: "application/json" };
            if (this.token)
                headers.Authorization = `Bearer ${this.token}`;
            if (body !== undefined)
                headers["Content-Type"] = "application/json";
            const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });
            const text = await res.text();
            const parsed = text ? safeJson(text) : undefined;
            if (!res.ok) {
                const message = (parsed && typeof parsed === "object" && "error" in parsed
                    ? String(parsed.error)
                    : res.statusText) || `HTTP ${res.status}`;
                throw new EvalApiError(res.status, message, parsed ?? text);
            }
            return parsed;
        }
        catch (err) {
            if (err instanceof EvalApiError)
                throw err;
            if (err?.name === "AbortError") {
                throw new EvalApiError(0, `Request timed out after ${this.timeoutMs}ms`, null);
            }
            throw new EvalApiError(0, `Network error: ${err.message}`, null);
        }
        finally {
            clearTimeout(timer);
        }
    }
    // ── Eval runs ──────────────────────────────────────────────────────────
    /** Trigger an eval suite against a manifest + output. */
    createRun(req) {
        return this.request("POST", "/v1/eval/runs", req);
    }
    /** Get eval run results by id. */
    getRun(id) {
        return this.request("GET", `/v1/eval/runs/${encodeURIComponent(id)}`);
    }
    // ── Datasets ───────────────────────────────────────────────────────────
    /** Get the eval dataset for a play slug. */
    getDataset(slug) {
        return this.request("GET", `/v1/eval/datasets/${encodeURIComponent(slug)}`);
    }
    // ── Schedules ──────────────────────────────────────────────────────────
    /** Create a scheduled eval run. */
    createSchedule(req) {
        return this.request("POST", "/v1/eval/schedules", req);
    }
    /** List the tenant's eval schedules. */
    async listSchedules() {
        const out = await this.request("GET", "/v1/eval/schedules");
        return out.schedules ?? [];
    }
    /** Delete a schedule by id. */
    async deleteSchedule(id) {
        await this.request("DELETE", `/v1/eval/schedules/${encodeURIComponent(id)}`);
    }
    // ── CI token ───────────────────────────────────────────────────────────
    /** Mint a tenant-scoped, eval-only CI token (default 90-day expiry). */
    mintCiToken(opts = {}) {
        return this.request("POST", "/v1/eval/api/ci-token", opts);
    }
    // ── Health ─────────────────────────────────────────────────────────────
    /** Liveness probe. */
    health() {
        return this.request("GET", "/health");
    }
}
function safeJson(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
export default EvalClient;
//# sourceMappingURL=index.js.map